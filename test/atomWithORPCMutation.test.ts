import { createStore } from 'jotai/vanilla'
import { describe, expect, it, vi } from 'vitest'

import { atomWithORPCMutation } from '../src/index.js'

describe('atomWithORPCMutation', () => {
  it('calls a procedure and returns its result', async () => {
    const createPlanet = vi.fn(async (input: { name: string }) => ({
      id: 1,
      ...input,
    }))
    const createPlanetAtom = atomWithORPCMutation(createPlanet)
    const store = createStore()

    expect(store.get(createPlanetAtom)).toBeNull()
    await expect(
      store.set(createPlanetAtom, [{ name: 'Earth' }]),
    ).resolves.toEqual({ id: 1, name: 'Earth' })
    expect(store.get(createPlanetAtom)).toEqual({ id: 1, name: 'Earth' })
    expect(createPlanet).toHaveBeenCalledWith({ name: 'Earth' })
  })

  it('calls a procedure without input using an empty argument tuple', async () => {
    const procedure = vi.fn(async () => 'completed')
    const mutationAtom = atomWithORPCMutation(procedure)
    const store = createStore()

    await expect(store.set(mutationAtom, [])).resolves.toBe('completed')
    expect(procedure).toHaveBeenCalledWith()
    expect(store.get(mutationAtom)).toBe('completed')
  })

  it('preserves procedure errors', async () => {
    const failure = new Error('The procedure failed')
    const procedure = vi.fn(async (_input: { id: number }) => {
      throw failure
    })
    const mutationAtom = atomWithORPCMutation(procedure)
    const store = createStore()

    await expect(store.set(mutationAtom, [{ id: 1 }])).rejects.toBe(failure)
  })

  it('passes per-call client options directly to the procedure', async () => {
    const procedure = vi.fn(
      async (
        input: { name: string },
        options: { context: { token: string } },
      ) => ({ input, token: options.context.token }),
    )
    const mutationAtom = atomWithORPCMutation(procedure)
    const store = createStore()

    await expect(
      store.set(mutationAtom, [
        { name: 'Earth' },
        { context: { token: 'call-token' } },
      ]),
    ).resolves.toEqual({
      input: { name: 'Earth' },
      token: 'call-token',
    })
    expect(procedure).toHaveBeenCalledWith(
      { name: 'Earth' },
      { context: { token: 'call-token' } },
    )
  })
})
