import type { Getter } from 'jotai/vanilla'

import type { DISABLED } from './disabled.js'

/** A structurally typed oRPC client procedure. */
export type ORPCProcedure = (...args: any[]) => PromiseLike<any>

export type ProcedureInput<TProcedure extends ORPCProcedure> =
  Parameters<TProcedure>[0]

export type ProcedureOutput<TProcedure extends ORPCProcedure> = Awaited<
  ReturnType<TProcedure>
>

export type ProcedureClientOptions<TProcedure extends ORPCProcedure> =
  Parameters<TProcedure>[1]

export type ValueOrGetter<T> = T | ((get: Getter) => T)

export type AsyncValueOrGetter<T> =
  | T
  | PromiseLike<T>
  | ((get: Getter) => T | PromiseLike<T>)

export type ORPCQueryInput<TProcedure extends ORPCProcedure> =
  AsyncValueOrGetter<ProcedureInput<TProcedure>>

export type ORPCSkippableQueryInput<TProcedure extends ORPCProcedure> =
  AsyncValueOrGetter<ProcedureInput<TProcedure> | typeof DISABLED>

type DefinedProcedureClientOptions<TProcedure extends ORPCProcedure> = Exclude<
  ProcedureClientOptions<TProcedure>,
  undefined
>

type ORPCQueryClientOptions<TProcedure extends ORPCProcedure> = [
  DefinedProcedureClientOptions<TProcedure>,
] extends [never]
  ? object
  : DefinedProcedureClientOptions<TProcedure>

export type AtomWithORPCQueryOptions<TProcedure extends ORPCProcedure> =
  ValueOrGetter<
    ORPCQueryClientOptions<TProcedure> & {
      disabledOutput?: undefined
    }
  >

export type AtomWithORPCQueryOptionsWithDisabledOutput<
  TProcedure extends ORPCProcedure,
  TDisabledOutput,
> = ValueOrGetter<
  ORPCQueryClientOptions<TProcedure> & {
    disabledOutput: TDisabledOutput
  }
>

export type ORPCEventIteratorProcedure = (
  ...args: any[]
) => PromiseLike<AsyncIterator<any, any, any>>

export type ProcedureEvent<TProcedure extends ORPCEventIteratorProcedure> =
  Awaited<ReturnType<TProcedure>> extends AsyncIterator<infer TEvent, any, any>
    ? TEvent
    : never

export type ORPCSubscriptionInput<
  TProcedure extends ORPCEventIteratorProcedure,
> = ValueOrGetter<ProcedureInput<TProcedure>>

export type AtomWithORPCSubscriptionOptions<
  TProcedure extends ORPCEventIteratorProcedure,
> = ValueOrGetter<
  [DefinedProcedureClientOptions<TProcedure>] extends [never]
    ? object
    : DefinedProcedureClientOptions<TProcedure>
>

export type ORPCQueryOptionsArgs<TProcedure extends ORPCProcedure> =
  undefined extends ProcedureClientOptions<TProcedure>
    ? [options?: AtomWithORPCQueryOptions<TProcedure>]
    : [options: AtomWithORPCQueryOptions<TProcedure>]

export type ORPCMutationArgs<TProcedure extends ORPCProcedure> =
  Parameters<TProcedure>

export type ORPCSubscriptionOptionsArgs<
  TProcedure extends ORPCEventIteratorProcedure,
> =
  undefined extends ProcedureClientOptions<TProcedure>
    ? [options?: AtomWithORPCSubscriptionOptions<TProcedure>]
    : [options: AtomWithORPCSubscriptionOptions<TProcedure>]
