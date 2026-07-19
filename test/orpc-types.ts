import type { Client } from '@orpc/client'
import { createStore } from 'jotai/vanilla'

import {
  atomWithORPCMutation,
  atomWithORPCQuery,
  atomWithORPCSubscription,
  createORPCJotai,
  mutation,
  query,
  DISABLED,
  subscription,
} from '../src/index.js'

declare const publicProcedure: Client<
  Record<never, never>,
  { id: number },
  { name: string },
  never
>

declare const authenticatedProcedure: Client<
  { token: string },
  { id: number },
  { name: string },
  never
>

declare const eventProcedure: Client<
  Record<never, never>,
  { channel: string },
  AsyncGenerator<{ message: string }, void, unknown>,
  never
>

declare const untaggedClient: {
  planet: {
    find: typeof publicProcedure
  }
}

function typeTests() {
  atomWithORPCQuery(publicProcedure, () => ({ id: 1 }))
  atomWithORPCQuery(publicProcedure, { id: 1 })
  atomWithORPCQuery(publicProcedure, Promise.resolve({ id: 1 }))
  atomWithORPCQuery(publicProcedure, () =>
    Math.random() > 0.5 ? { id: 1 } : DISABLED,
  )
  atomWithORPCQuery(
    publicProcedure,
    () => DISABLED as { id: number } | typeof DISABLED,
    { disabledOutput: 'not-ready' as const },
  )
  atomWithORPCMutation(publicProcedure)
  atomWithORPCSubscription(eventProcedure, { channel: 'planets' })

  const simpleORPC = createORPCJotai(untaggedClient)
  simpleORPC.planet.find.atomWithQuery({ id: 1 })
  simpleORPC.planet.find.atomWithMutation()
  // @ts-expect-error Mutation options are supplied when the atom is executed.
  atomWithORPCMutation(authenticatedProcedure, {
    clientOptions: { context: { token: 'secret' } },
  })

  const orpc = createORPCJotai({
    planet: {
      find: query(publicProcedure),
      create: mutation(authenticatedProcedure),
      events: subscription(eventProcedure),
    },
  })
  orpc.planet.find.atomWithQuery({ id: 1 })
  const createAtom = orpc.planet.create.atomWithMutation()
  orpc.planet.events.atomWithSubscription({ channel: 'planets' })

  // @ts-expect-error Tagged queries do not expose mutation factories.
  orpc.planet.find.atomWithMutation()
  // @ts-expect-error Subscription inputs must be synchronous.
  atomWithORPCSubscription(eventProcedure, async () => ({ channel: 'planets' }))

  atomWithORPCQuery(
    authenticatedProcedure,
    { id: 1 },
    {
      context: { token: 'secret' },
    },
  )
  atomWithORPCQuery(authenticatedProcedure, { id: 1 }, () => ({
    context: { token: 'secret' },
  }))

  const store = createStore()
  store.set(createAtom, [{ id: 1 }, { context: { token: 'secret' } }])
  // @ts-expect-error Authenticated mutations require per-call client options.
  store.set(createAtom, [{ id: 1 }])

  // @ts-expect-error Authenticated Query clients require client context.
  atomWithORPCQuery(authenticatedProcedure, { id: 1 })
}

void typeTests
