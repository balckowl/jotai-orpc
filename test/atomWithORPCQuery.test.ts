import type { Client } from '@orpc/client'
import { atom, createStore } from 'jotai/vanilla'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { atomWithORPCQuery, DISABLED } from '../src/index.js'

describe('atomWithORPCQuery', () => {
  it('calls a procedure with input derived from another atom', async () => {
    const idAtom = atom(1)
    const findPlanet = vi.fn(async ({ id }: { id: number }) => ({
      id,
      name: `Planet ${id}`,
    }))
    const planetAtom = atomWithORPCQuery(findPlanet, (get) => ({
      id: get(idAtom),
    }))
    const store = createStore()

    await expect(store.get(planetAtom)).resolves.toEqual({
      id: 1,
      name: 'Planet 1',
    })

    store.set(idAtom, 2)

    await expect(store.get(planetAtom)).resolves.toEqual({
      id: 2,
      name: 'Planet 2',
    })
    expect(findPlanet).toHaveBeenCalledTimes(2)
  })

  it('can be refreshed without changing its input', async () => {
    let revision = 0
    const getRevision = vi.fn(async (_input: undefined) => ++revision)
    const revisionAtom = atomWithORPCQuery(getRevision, () => undefined)
    const store = createStore()

    await expect(store.get(revisionAtom)).resolves.toBe(1)
    store.set(revisionAtom)
    await expect(store.get(revisionAtom)).resolves.toBe(2)
  })

  it('accepts fixed, promised, and asynchronous getter inputs', async () => {
    const procedure = vi.fn(async ({ id }: { id: number }) => id)
    const idAtom = atom(3)
    const store = createStore()

    const fixedAtom = atomWithORPCQuery(procedure, { id: 1 })
    const promisedAtom = atomWithORPCQuery(
      procedure,
      Promise.resolve({ id: 2 }),
    )
    const asyncGetterAtom = atomWithORPCQuery(procedure, async (get) => ({
      id: get(idAtom),
    }))

    await expect(store.get(fixedAtom)).resolves.toBe(1)
    await expect(store.get(promisedAtom)).resolves.toBe(2)
    await expect(store.get(asyncGetterAtom)).resolves.toBe(3)

    store.set(idAtom, 4)
    await expect(store.get(asyncGetterAtom)).resolves.toBe(4)
  })

  it('skips a query and supports a custom disabled output', async () => {
    const procedure = vi.fn(async ({ id }: { id: number }) => id)
    const enabledAtom = atom(false)
    const fallbackValueAtom = atom('not-ready')
    const store = createStore()

    const optionalAtom = atomWithORPCQuery(procedure, (get) =>
      get(enabledAtom) ? { id: 1 } : DISABLED,
    )
    const fallbackAtom = atomWithORPCQuery(
      procedure,
      () => DISABLED as { id: number } | typeof DISABLED,
      (get) => ({ disabledOutput: get(fallbackValueAtom) }),
    )

    await expect(store.get(optionalAtom)).resolves.toBeUndefined()
    await expect(store.get(fallbackAtom)).resolves.toBe('not-ready')
    expectTypeOf(await store.get(fallbackAtom)).toEqualTypeOf<number | string>()
    expect(procedure).not.toHaveBeenCalled()

    store.set(fallbackValueAtom, 'still-waiting')
    await expect(store.get(fallbackAtom)).resolves.toBe('still-waiting')

    store.set(enabledAtom, true)
    await expect(store.get(optionalAtom)).resolves.toBe(1)
    expect(procedure).toHaveBeenCalledTimes(1)
  })

  it('automatically passes the Jotai abort signal with client options', async () => {
    const procedure = vi.fn(
      async (
        _input: { id: number },
        options?: { signal?: AbortSignal; context?: { token: string } },
      ) => options,
    )
    const queryAtom = atomWithORPCQuery(
      procedure,
      () => ({ id: 1 }),
      () => ({ context: { token: 'secret' } }),
    )
    const store = createStore()

    const result = await store.get(queryAtom)

    expect(result?.signal).toBeInstanceOf(AbortSignal)
    expect(result?.signal?.aborted).toBe(false)
    expect(result?.context).toEqual({ token: 'secret' })
  })

  it('accepts fixed client options and still adds the abort signal', async () => {
    const procedure = vi.fn(
      async (
        _input: undefined,
        options: { context: { token: string }; signal?: AbortSignal },
      ) => options,
    )
    const queryAtom = atomWithORPCQuery(procedure, undefined, {
      context: { token: 'fixed-token' },
    })

    const result = await createStore().get(queryAtom)

    expect(result.context).toEqual({ token: 'fixed-token' })
    expect(result.signal).toBeInstanceOf(AbortSignal)
  })

  it('lets client options override the Jotai abort signal like jotai-trpc', async () => {
    const customController = new AbortController()
    const procedure = vi.fn(
      async (_input: undefined, options?: { signal?: AbortSignal }) =>
        options?.signal,
    )
    const queryAtom = atomWithORPCQuery(procedure, undefined, {
      signal: customController.signal,
    })

    const receivedSignal = await createStore().get(queryAtom)

    expect(receivedSignal).toBe(customController.signal)
  })

  it('preserves input and output types from an oRPC Client', async () => {
    type FindPlanetClient = Client<
      Record<never, never>,
      { id: number },
      { id: number; name: string },
      never
    >

    const findPlanet = (async ({ id }: { id: number }) => ({
      id,
      name: 'Earth',
    })) as unknown as FindPlanetClient
    const planetAtom = atomWithORPCQuery(findPlanet, () => ({ id: 1 }))
    const result = await createStore().get(planetAtom)

    expectTypeOf(result).toEqualTypeOf<{ id: number; name: string }>()
    expect(result).toEqual({ id: 1, name: 'Earth' })
  })
})
