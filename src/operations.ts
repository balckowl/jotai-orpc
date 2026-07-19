import type { ORPCEventIteratorProcedure, ORPCProcedure } from './types.js'

const operationDescriptor = Symbol('jotai-orpc.operation')

export type ORPCOperationKind = 'query' | 'mutation' | 'subscription'

export interface ORPCOperationDescriptor<
  TKind extends ORPCOperationKind,
  TProcedure extends ORPCProcedure,
> {
  readonly kind: TKind
  readonly procedure: TProcedure
  readonly [operationDescriptor]: true
}

export type ORPCQueryDescriptor<TProcedure extends ORPCProcedure> =
  ORPCOperationDescriptor<'query', TProcedure>

export type ORPCMutationDescriptor<TProcedure extends ORPCProcedure> =
  ORPCOperationDescriptor<'mutation', TProcedure>

export type ORPCSubscriptionDescriptor<
  TProcedure extends ORPCEventIteratorProcedure,
> = ORPCOperationDescriptor<'subscription', TProcedure>

export type ORPCAnyOperationDescriptor =
  | ORPCQueryDescriptor<ORPCProcedure>
  | ORPCMutationDescriptor<ORPCProcedure>
  | ORPCSubscriptionDescriptor<ORPCEventIteratorProcedure>

export type ORPCTaggedRouter = {
  readonly [key: string]: ORPCAnyOperationDescriptor | ORPCTaggedRouter
}

export type ORPCClientFromTaggedRouter<TRouter> =
  TRouter extends ORPCOperationDescriptor<ORPCOperationKind, infer TProcedure>
    ? TProcedure
    : TRouter extends object
      ? { [TKey in keyof TRouter]: ORPCClientFromTaggedRouter<TRouter[TKey]> }
      : never

function operation<
  TKind extends ORPCOperationKind,
  TProcedure extends ORPCProcedure,
>(
  kind: TKind,
  procedure: TProcedure,
): ORPCOperationDescriptor<TKind, TProcedure> {
  return Object.freeze({
    kind,
    procedure,
    [operationDescriptor]: true as const,
  })
}

/** Marks an oRPC procedure as a read operation. */
export function query<TProcedure extends ORPCProcedure>(
  procedure: TProcedure extends ORPCEventIteratorProcedure ? never : TProcedure,
): ORPCQueryDescriptor<TProcedure> {
  return operation('query', procedure)
}

/** Marks an oRPC procedure as a write operation. */
export function mutation<TProcedure extends ORPCProcedure>(
  procedure: TProcedure extends ORPCEventIteratorProcedure ? never : TProcedure,
): ORPCMutationDescriptor<TProcedure> {
  return operation('mutation', procedure)
}

/** Marks an Event Iterator procedure as a subscription operation. */
export function subscription<TProcedure extends ORPCEventIteratorProcedure>(
  procedure: TProcedure,
): ORPCSubscriptionDescriptor<TProcedure> {
  return operation('subscription', procedure)
}

export function isORPCOperationDescriptor(
  value: unknown,
): value is ORPCAnyOperationDescriptor {
  return (
    typeof value === 'object' && value !== null && operationDescriptor in value
  )
}
