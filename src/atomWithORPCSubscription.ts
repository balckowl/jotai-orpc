import type { Atom, Getter } from 'jotai/vanilla'
import { atomWithObservable } from 'jotai/vanilla/utils'

import { resolveValueOrGetter, withAbortSignal } from './internal.js'
import type {
  AtomWithORPCSubscriptionOptions,
  ORPCEventIteratorProcedure,
  ORPCSubscriptionInput,
  ORPCSubscriptionOptionsArgs,
  ProcedureEvent,
  ProcedureInput,
} from './types.js'

type Observer<T> = {
  next: (value: T) => void
  error: (error: unknown) => void
  complete: () => void
}

type Subscription = {
  unsubscribe: () => void
}

export type ORPCSubscriptionAtom<
  TProcedure extends ORPCEventIteratorProcedure,
> = Atom<ProcedureEvent<TProcedure> | Promise<ProcedureEvent<TProcedure>>>

export function atomWithORPCSubscriptionInternal<
  TProcedure extends ORPCEventIteratorProcedure,
>(
  procedure: TProcedure,
  getInput: ORPCSubscriptionInput<TProcedure>,
  options: AtomWithORPCSubscriptionOptions<TProcedure> | undefined,
  getProcedure?: (get: Getter) => TProcedure,
): ORPCSubscriptionAtom<TProcedure> {
  return atomWithObservable<ProcedureEvent<TProcedure>>((get: Getter) => {
    let controller = new AbortController()
    const input = resolveValueOrGetter(getInput, get)
    const clientOptions = options
      ? resolveValueOrGetter(options, get)
      : undefined
    const resolvedProcedure = getProcedure?.(get) ?? procedure

    return {
      subscribe(observer: Observer<ProcedureEvent<TProcedure>>): Subscription {
        if (controller.signal.aborted) {
          controller = new AbortController()
        }

        let active = true
        let eventIterator: AsyncIterator<ProcedureEvent<TProcedure>> | undefined
        const iteratorPromise = Promise.resolve().then(() =>
          resolvedProcedure(
            input as ProcedureInput<TProcedure>,
            withAbortSignal<TProcedure>(clientOptions, controller.signal),
          ),
        )

        const consume = async () => {
          try {
            eventIterator = await iteratorPromise

            for (;;) {
              if (!active) {
                break
              }

              const result = await eventIterator.next()

              if (!active) {
                break
              }

              if (result.done) {
                observer.complete()
                return
              }

              observer.next(result.value)
            }
          } catch (error) {
            if (active && !controller.signal.aborted) {
              observer.error(error)
            }
          }
        }

        void consume()

        return {
          unsubscribe: () => {
            active = false
            controller.abort()
            void Promise.resolve(eventIterator?.return?.()).catch(() => {})
          },
        }
      },
    }
  })
}

/**
 * Creates an atom that contains the latest event from an oRPC Event Iterator.
 *
 * The iterator is canceled when the atom is unmounted or when an atom read by
 * the input/options factories changes.
 */
export function atomWithORPCSubscription<
  TProcedure extends ORPCEventIteratorProcedure,
>(
  procedure: TProcedure,
  getInput: ORPCSubscriptionInput<TProcedure>,
  ...optionsArgs: ORPCSubscriptionOptionsArgs<TProcedure>
): ORPCSubscriptionAtom<TProcedure> {
  const options = optionsArgs[0] as
    | AtomWithORPCSubscriptionOptions<TProcedure>
    | undefined
  return atomWithORPCSubscriptionInternal(procedure, getInput, options)
}
