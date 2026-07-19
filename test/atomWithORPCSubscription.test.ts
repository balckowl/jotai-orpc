import type { Client } from '@orpc/client'
import { atom, createStore } from 'jotai/vanilla'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { atomWithORPCSubscription } from '../src/index.js'

describe('atomWithORPCSubscription', () => {
  it('exposes the latest event and cancels the iterator when unmounted', async () => {
    let receivedSignal: AbortSignal | undefined
    const finished = vi.fn()
    const procedure = vi.fn(
      async (
        { channel }: { channel: string },
        options?: { signal?: AbortSignal },
      ) => {
        receivedSignal = options?.signal

        return (async function* () {
          try {
            yield { channel, message: 'connected' }

            await new Promise<void>((resolve) => {
              options?.signal?.addEventListener('abort', () => resolve(), {
                once: true,
              })
            })
          } finally {
            finished()
          }
        })()
      },
    )
    const subscriptionAtom = atomWithORPCSubscription(procedure, {
      channel: 'planets',
    })
    const store = createStore()
    const unsubscribe = store.sub(subscriptionAtom, () => {})

    await expect(store.get(subscriptionAtom)).resolves.toEqual({
      channel: 'planets',
      message: 'connected',
    })
    expect(receivedSignal).toBeInstanceOf(AbortSignal)
    expect(receivedSignal?.aborted).toBe(false)

    unsubscribe()
    expect(receivedSignal?.aborted).toBe(true)
    await vi.waitFor(() => expect(finished).toHaveBeenCalledOnce())
  })

  it('restarts with a new input when a dependency changes', async () => {
    const channelAtom = atom('planets')
    const signals: AbortSignal[] = []
    const procedure = vi.fn(
      async (
        { channel }: { channel: string },
        options?: { signal?: AbortSignal },
      ) => {
        if (options?.signal) {
          signals.push(options.signal)
        }

        return (async function* () {
          yield channel
          await new Promise<void>(() => {})
        })()
      },
    )
    const subscriptionAtom = atomWithORPCSubscription(procedure, (get) => ({
      channel: get(channelAtom),
    }))
    const store = createStore()
    const unsubscribe = store.sub(subscriptionAtom, () => {})

    await expect(store.get(subscriptionAtom)).resolves.toBe('planets')
    store.set(channelAtom, 'missions')
    await expect(store.get(subscriptionAtom)).resolves.toBe('missions')

    expect(procedure).toHaveBeenCalledTimes(2)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)

    unsubscribe()
  })

  it('updates the atom with the latest event', async () => {
    let releaseSecondEvent: (() => void) | undefined
    const procedure = async (_input: undefined) =>
      (async function* () {
        yield 1
        await new Promise<void>((resolve) => {
          releaseSecondEvent = resolve
        })
        yield 2
        await new Promise<void>(() => {})
      })()
    const subscriptionAtom = atomWithORPCSubscription(procedure, undefined)
    const store = createStore()
    const unsubscribe = store.sub(subscriptionAtom, () => {})

    await expect(store.get(subscriptionAtom)).resolves.toBe(1)
    releaseSecondEvent?.()
    await vi.waitFor(() => expect(store.get(subscriptionAtom)).toBe(2))

    unsubscribe()
  })

  it('preserves the event type from an oRPC Client', async () => {
    type EventsClient = Client<
      Record<never, never>,
      { channel: string },
      AsyncGenerator<{ message: string }, void, unknown>,
      never
    >

    const events = (async () =>
      (async function* () {
        yield { message: 'hello' }
      })()) as unknown as EventsClient
    const eventsAtom = atomWithORPCSubscription(events, {
      channel: 'planets',
    })
    const result = await createStore().get(eventsAtom)

    expectTypeOf(result).toEqualTypeOf<{ message: string }>()
    expect(result).toEqual({ message: 'hello' })
  })

  it('derives client options from atoms and adds a cancellation signal', async () => {
    const tokenAtom = atom('token-from-atom')
    let receivedOptions:
      | { context: { token: string }; signal?: AbortSignal }
      | undefined
    const events = async (
      _input: undefined,
      options: { context: { token: string }; signal?: AbortSignal },
    ) => {
      receivedOptions = options
      return (async function* () {
        yield 'connected'
      })()
    }
    const eventsAtom = atomWithORPCSubscription(events, undefined, (get) => ({
      context: { token: get(tokenAtom) },
    }))

    await expect(createStore().get(eventsAtom)).resolves.toBe('connected')
    expect(receivedOptions?.context).toEqual({ token: 'token-from-atom' })
    expect(receivedOptions?.signal).toBeInstanceOf(AbortSignal)
  })
})
