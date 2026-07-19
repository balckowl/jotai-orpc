import { atom } from 'jotai/vanilla'
import type { Getter, WritableAtom } from 'jotai/vanilla'

import type {
  AtomWithORPCQueryOptions,
  AtomWithORPCQueryOptionsWithDisabledOutput,
  ORPCProcedure,
  ORPCQueryInput,
  ORPCQueryOptionsArgs,
  ORPCSkippableQueryInput,
  ProcedureClientOptions,
  ProcedureInput,
  ProcedureOutput,
} from './types.js'
import {
  resolveAsyncValueOrGetter,
  resolveValueOrGetter,
  withAbortSignal,
} from './internal.js'
import { DISABLED } from './disabled.js'

export type ORPCQueryAtom<
  TProcedure extends ORPCProcedure,
  TDisabledOutput = never,
> = WritableAtom<
  Promise<ProcedureOutput<TProcedure> | TDisabledOutput>,
  [],
  void
>

export function atomWithORPCQueryInternal<
  TProcedure extends ORPCProcedure,
  TDisabledOutput,
>(
  procedure: TProcedure,
  getInput: ORPCSkippableQueryInput<TProcedure>,
  options:
    | AtomWithORPCQueryOptions<TProcedure>
    | AtomWithORPCQueryOptionsWithDisabledOutput<TProcedure, TDisabledOutput>
    | undefined,
  getProcedure?: (get: Getter) => TProcedure,
): ORPCQueryAtom<TProcedure, TDisabledOutput> {
  const refreshAtom = atom(0)

  const resultAtom = atom<
    Promise<ProcedureOutput<TProcedure> | TDisabledOutput>
  >(async (get, { signal }) => {
    get(refreshAtom)

    const resolvedProcedure = getProcedure?.(get) ?? procedure
    const input = await resolveAsyncValueOrGetter(getInput, get)
    const resolvedOptions = options
      ? resolveValueOrGetter(options, get)
      : undefined

    if (input === DISABLED) {
      return (
        resolvedOptions as { disabledOutput?: TDisabledOutput } | undefined
      )?.disabledOutput as TDisabledOutput
    }

    const { disabledOutput: _disabledOutput, ...clientOptions } =
      (resolvedOptions ?? {}) as Record<string, unknown>
    return await resolvedProcedure(
      input as ProcedureInput<TProcedure>,
      withAbortSignal<TProcedure>(
        clientOptions as ProcedureClientOptions<TProcedure>,
        signal,
      ),
    )
  })

  return atom(
    (get) => get(resultAtom),
    (_get, set) => {
      set(refreshAtom, (value) => value + 1)
    },
  )
}

/**
 * Creates a refreshable async atom backed by an oRPC client procedure.
 *
 * The input factory may read other atoms. When one of those atoms changes,
 * Jotai automatically calls the procedure again with the new input.
 */
export function atomWithORPCQuery<TProcedure extends ORPCProcedure>(
  procedure: TProcedure,
  getInput: ORPCQueryInput<TProcedure>,
  ...optionsArgs: ORPCQueryOptionsArgs<TProcedure>
): ORPCQueryAtom<TProcedure>
export function atomWithORPCQuery<TProcedure extends ORPCProcedure>(
  procedure: TProcedure,
  getInput: ORPCSkippableQueryInput<TProcedure>,
  ...optionsArgs: ORPCQueryOptionsArgs<TProcedure>
): ORPCQueryAtom<TProcedure, undefined>
export function atomWithORPCQuery<
  TProcedure extends ORPCProcedure,
  TDisabledOutput,
>(
  procedure: TProcedure,
  getInput: ORPCSkippableQueryInput<TProcedure>,
  options: AtomWithORPCQueryOptionsWithDisabledOutput<
    TProcedure,
    TDisabledOutput
  >,
): ORPCQueryAtom<TProcedure, TDisabledOutput>
export function atomWithORPCQuery<TProcedure extends ORPCProcedure>(
  procedure: TProcedure,
  getInput: ORPCSkippableQueryInput<TProcedure>,
  ...optionsArgs: [
    options?:
      | AtomWithORPCQueryOptions<TProcedure>
      | AtomWithORPCQueryOptionsWithDisabledOutput<TProcedure, unknown>,
  ]
) {
  const options = optionsArgs[0] as
    | AtomWithORPCQueryOptionsWithDisabledOutput<TProcedure, unknown>
    | undefined
  return atomWithORPCQueryInternal(procedure, getInput, options)
}
