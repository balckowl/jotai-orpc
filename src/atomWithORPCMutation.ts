import { atom } from 'jotai/vanilla'
import type { Getter, WritableAtom } from 'jotai/vanilla'

import type {
  ORPCMutationArgs,
  ORPCProcedure,
  ProcedureOutput,
} from './types.js'

export type ORPCMutationAtom<TProcedure extends ORPCProcedure> = WritableAtom<
  ProcedureOutput<TProcedure> | null,
  [args: ORPCMutationArgs<TProcedure>],
  Promise<ProcedureOutput<TProcedure>>
>

export function atomWithORPCMutationInternal<TProcedure extends ORPCProcedure>(
  procedure: TProcedure,
  getProcedure?: (get: Getter) => TProcedure,
): ORPCMutationAtom<TProcedure> {
  const mutationAtom: ORPCMutationAtom<TProcedure> = atom<
    ProcedureOutput<TProcedure> | null,
    [args: ORPCMutationArgs<TProcedure>],
    Promise<ProcedureOutput<TProcedure>>
  >(null, async (get, set, args) => {
    const resolvedProcedure = getProcedure?.(get) ?? procedure
    const result = await resolvedProcedure(...args)

    set(mutationAtom, result)
    return result
  })

  return mutationAtom
}

/**
 * Creates an atom that invokes an oRPC client procedure and stores its latest
 * successful result. The promise returned by store.set/useSetAtom resolves to
 * the same result.
 */
export function atomWithORPCMutation<TProcedure extends ORPCProcedure>(
  procedure: TProcedure,
): ORPCMutationAtom<TProcedure> {
  return atomWithORPCMutationInternal(procedure)
}
