import { atom, createStore, type Getter } from 'jotai/vanilla'
import { describe, expect, it, vi } from 'vitest'

import { createORPCJotai, mutation, query, subscription } from '../src/index.js'

describe('createORPCJotai', () => {
  it('only exposes the selected factory on tagged procedures', async () => {
    const listPlanets = vi.fn(async ({ search }: { search: string }) => [
      { id: 1, name: search || 'Earth' },
    ])
    const createPlanet = vi.fn(async ({ name }: { name: string }) => ({
      id: 2,
      name,
    }))
    const activity = async ({ channel }: { channel: string }) =>
      (async function* () {
        yield { channel, message: 'connected' }
      })()
    const orpc = createORPCJotai({
      planet: {
        list: query(listPlanets),
        create: mutation(createPlanet),
        activity: subscription(activity),
      },
    })
    const store = createStore()

    const planetsAtom = orpc.planet.list.atomWithQuery({ search: '' })
    const createPlanetAtom = orpc.planet.create.atomWithMutation()
    const activityAtom = orpc.planet.activity.atomWithSubscription({
      channel: 'planets',
    })

    await expect(store.get(planetsAtom)).resolves.toEqual([
      { id: 1, name: 'Earth' },
    ])
    await expect(
      store.set(createPlanetAtom, [{ name: 'Mars' }]),
    ).resolves.toEqual({ id: 2, name: 'Mars' })
    await expect(store.get(activityAtom)).resolves.toEqual({
      channel: 'planets',
      message: 'connected',
    })

    expect(
      (orpc.planet.list as unknown as Record<string, unknown>).atomWithMutation,
    ).toBeUndefined()
    expect(
      (orpc.planet.create as unknown as Record<string, unknown>).atomWithQuery,
    ).toBeUndefined()
    expect(
      (orpc.planet.activity as unknown as Record<string, unknown>)
        .atomWithQuery,
    ).toBeUndefined()

    // @ts-expect-error Query descriptors do not expose mutation factories.
    void orpc.planet.list.atomWithMutation
    // @ts-expect-error Mutation descriptors do not expose query factories.
    void orpc.planet.create.atomWithQuery
    // @ts-expect-error Subscription descriptors only expose subscriptions.
    void orpc.planet.activity.atomWithMutation
  })

  it('only accepts Event Iterator procedures as subscriptions', () => {
    const eventProcedure = async (_input: undefined) =>
      (async function* () {
        yield 'event'
      })()
    const regularProcedure = async (_input: undefined) => 'result'

    expect(subscription(eventProcedure).kind).toBe('subscription')

    const typeErrors = () => {
      // @ts-expect-error Event Iterator procedures cannot be tagged as queries.
      query(eventProcedure)
      // @ts-expect-error Event Iterator procedures cannot be tagged as mutations.
      mutation(eventProcedure)
      // @ts-expect-error Regular procedures cannot be tagged as subscriptions.
      subscription(regularProcedure)
    }

    void typeErrors
  })

  it('creates a router-shaped API directly from an oRPC client', async () => {
    const client = {
      planet: {
        list: async ({ search }: { search: string }) => [
          { id: 1, name: search || 'Earth' },
        ],
        create: async ({ name }: { name: string }) => ({ id: 2, name }),
        activity: async ({ channel }: { channel: string }) =>
          (async function* () {
            yield { channel, message: 'connected' }
          })(),
      },
    }
    const orpc = createORPCJotai(client)
    const store = createStore()

    const planetsAtom = orpc.planet.list.atomWithQuery({ search: '' })
    const createPlanetAtom = orpc.planet.create.atomWithMutation()
    const activityAtom = orpc.planet.activity.atomWithSubscription({
      channel: 'planets',
    })

    await expect(store.get(planetsAtom)).resolves.toEqual([
      { id: 1, name: 'Earth' },
    ])
    await expect(
      store.set(createPlanetAtom, [{ name: 'Mars' }]),
    ).resolves.toEqual({ id: 2, name: 'Mars' })
    await expect(store.get(activityAtom)).resolves.toEqual({
      channel: 'planets',
      message: 'connected',
    })

    // Regular oRPC procedures have no Query/Mutation discriminator.
    void orpc.planet.list.atomWithMutation
    void orpc.planet.create.atomWithQuery
    // @ts-expect-error Event Iterator procedures expose subscriptions only.
    void orpc.planet.activity.atomWithQuery
    // @ts-expect-error Regular procedures do not expose subscriptions.
    void orpc.planet.list.atomWithSubscription
  })

  it('selects a client from the Jotai store in the simple form', async () => {
    type Client = {
      planet: {
        list: (input: { id: number }) => Promise<{ source: string; id: number }>
        create: (input: {
          name: string
        }) => Promise<{ source: string; name: string }>
        activity: (input: {
          channel: string
        }) => Promise<AsyncGenerator<{ source: string; channel: string }>>
      }
    }

    const createClient = (source: string): Client => ({
      planet: {
        list: async ({ id }) => ({ source, id }),
        create: async ({ name }) => ({ source, name }),
        activity: async ({ channel }) =>
          (async function* () {
            yield { source, channel }
            await new Promise<void>(() => {})
          })(),
      },
    })

    const firstClient = createClient('first')
    const secondClient = createClient('second')
    const clientAtom = atom<Client>(firstClient)
    const getClient = (get: Getter) => get(clientAtom)
    const orpc = createORPCJotai(firstClient)
    const listAtom = orpc.planet.list.atomWithQuery(
      { id: 1 },
      undefined,
      getClient,
    )
    const createAtom = orpc.planet.create.atomWithMutation(getClient)
    const activityAtom = orpc.planet.activity.atomWithSubscription(
      { channel: 'planets' },
      undefined,
      getClient,
    )
    const store = createStore()
    const unsubscribe = store.sub(activityAtom, () => {})

    await expect(store.get(listAtom)).resolves.toEqual({
      source: 'first',
      id: 1,
    })
    await expect(store.set(createAtom, [{ name: 'Earth' }])).resolves.toEqual({
      source: 'first',
      name: 'Earth',
    })
    expect(await store.get(activityAtom)).toEqual({
      source: 'first',
      channel: 'planets',
    })

    store.set(clientAtom, secondClient)

    await expect(store.get(listAtom)).resolves.toEqual({
      source: 'second',
      id: 1,
    })
    await expect(store.set(createAtom, [{ name: 'Mars' }])).resolves.toEqual({
      source: 'second',
      name: 'Mars',
    })
    await vi.waitFor(() =>
      expect(store.get(activityAtom)).toEqual({
        source: 'second',
        channel: 'planets',
      }),
    )

    unsubscribe()
  })
})
