import type { Getter } from 'jotai/vanilla'

import {
  atomWithORPCMutationInternal,
  type ORPCMutationAtom,
} from './atomWithORPCMutation.js'
import {
  atomWithORPCQueryInternal,
  type ORPCQueryAtom,
} from './atomWithORPCQuery.js'
import {
  atomWithORPCSubscriptionInternal,
  type ORPCSubscriptionAtom,
} from './atomWithORPCSubscription.js'
import {
  isORPCOperationDescriptor,
  type ORPCClientFromTaggedRouter,
  type ORPCMutationDescriptor,
  type ORPCQueryDescriptor,
  type ORPCSubscriptionDescriptor,
  type ORPCTaggedRouter,
} from './operations.js'
import type {
  AtomWithORPCQueryOptions,
  AtomWithORPCQueryOptionsWithDisabledOutput,
  AtomWithORPCSubscriptionOptions,
  ORPCEventIteratorProcedure,
  ORPCProcedure,
  ORPCQueryInput,
  ORPCSkippableQueryInput,
  ORPCSubscriptionInput,
  ProcedureClientOptions,
} from './types.js'

export type ORPCClientGetter<TClient> = (get: Getter) => TClient

export type ORPCClientRouter = {
  readonly [key: string]: ORPCProcedure | ORPCClientRouter
}

type ORPCQueryResolverOptionsArgs<TProcedure extends ORPCProcedure, TClient> =
  undefined extends ProcedureClientOptions<TProcedure>
    ? [
        options?: AtomWithORPCQueryOptions<TProcedure>,
        getClient?: ORPCClientGetter<TClient>,
      ]
    : [
        options: AtomWithORPCQueryOptions<TProcedure>,
        getClient?: ORPCClientGetter<TClient>,
      ]

export type ORPCQueryResolver<
  TProcedure extends ORPCProcedure,
  TClient = unknown,
> = {
  (
    input: ORPCQueryInput<TProcedure>,
    ...args: ORPCQueryResolverOptionsArgs<TProcedure, TClient>
  ): ORPCQueryAtom<TProcedure>
  (
    input: ORPCSkippableQueryInput<TProcedure>,
    ...args: ORPCQueryResolverOptionsArgs<TProcedure, TClient>
  ): ORPCQueryAtom<TProcedure, undefined>
  <TDisabledOutput>(
    input: ORPCSkippableQueryInput<TProcedure>,
    options: AtomWithORPCQueryOptionsWithDisabledOutput<
      TProcedure,
      TDisabledOutput
    >,
    getClient?: ORPCClientGetter<TClient>,
  ): ORPCQueryAtom<TProcedure, TDisabledOutput>
}

export type ORPCMutationResolver<
  TProcedure extends ORPCProcedure,
  TClient = unknown,
> = (getClient?: ORPCClientGetter<TClient>) => ORPCMutationAtom<TProcedure>

type ORPCSubscriptionResolverOptionsArgs<
  TProcedure extends ORPCEventIteratorProcedure,
  TClient = unknown,
> =
  undefined extends ProcedureClientOptions<TProcedure>
    ? [
        options?: AtomWithORPCSubscriptionOptions<TProcedure>,
        getClient?: ORPCClientGetter<TClient>,
      ]
    : [
        options: AtomWithORPCSubscriptionOptions<TProcedure>,
        getClient?: ORPCClientGetter<TClient>,
      ]

export type ORPCSubscriptionResolver<
  TProcedure extends ORPCEventIteratorProcedure,
  TClient,
> = (
  input: ORPCSubscriptionInput<TProcedure>,
  ...args: ORPCSubscriptionResolverOptionsArgs<TProcedure, TClient>
) => ORPCSubscriptionAtom<TProcedure>

export type ORPCJotaiTaggedClient<
  TRouter,
  TClient = ORPCClientFromTaggedRouter<TRouter>,
> = {
  [TKey in keyof TRouter]: TRouter[TKey] extends ORPCQueryDescriptor<
    infer TProcedure
  >
    ? { atomWithQuery: ORPCQueryResolver<TProcedure, TClient> }
    : TRouter[TKey] extends ORPCMutationDescriptor<infer TProcedure>
      ? { atomWithMutation: ORPCMutationResolver<TProcedure, TClient> }
      : TRouter[TKey] extends ORPCSubscriptionDescriptor<infer TProcedure>
        ? {
            atomWithSubscription: ORPCSubscriptionResolver<TProcedure, TClient>
          }
        : TRouter[TKey] extends object
          ? ORPCJotaiTaggedClient<TRouter[TKey], TClient>
          : never
}

export type ORPCJotaiClient<TRouter, TClient = TRouter> = {
  [TKey in keyof TRouter]: TRouter[TKey] extends ORPCEventIteratorProcedure
    ? {
        atomWithSubscription: ORPCSubscriptionResolver<TRouter[TKey], TClient>
      }
    : TRouter[TKey] extends ORPCProcedure
      ? {
          atomWithQuery: ORPCQueryResolver<TRouter[TKey], TClient>
          atomWithMutation: ORPCMutationResolver<TRouter[TKey], TClient>
        }
      : TRouter[TKey] extends object
        ? ORPCJotaiClient<TRouter[TKey], TClient>
        : never
}

function getValueAtPath(value: unknown, path: readonly string[]): unknown {
  let current = value as Record<string, unknown>

  for (const key of path) {
    current = current[key] as Record<string, unknown>
  }

  return current
}

/** Creates a strict router-shaped API from explicitly tagged procedures. */
export function createORPCJotai<TRouter extends ORPCTaggedRouter>(
  taggedRouter: TRouter,
): ORPCJotaiTaggedClient<TRouter, ORPCClientFromTaggedRouter<TRouter>>

/**
 * Creates a router-shaped API directly from an oRPC client. Regular
 * procedures expose Query and Mutation factories; Event Iterator procedures
 * expose the Subscription factory.
 */
export function createORPCJotai<TClient extends ORPCClientRouter>(
  client: TClient,
): ORPCJotaiClient<TClient>

export function createORPCJotai(
  routerOrClient: ORPCTaggedRouter | ORPCClientRouter,
): unknown {
  type RuntimeClient = ORPCClientRouter

  const createProxy = (target: unknown, path: readonly string[]): unknown => {
    const descriptor = isORPCOperationDescriptor(target) ? target : undefined
    const directProcedure =
      typeof target === 'function' ? (target as ORPCProcedure) : undefined
    const procedure = descriptor?.procedure ?? directProcedure

    const getDynamicProcedure = (
      getClient: ORPCClientGetter<RuntimeClient> | undefined,
    ) =>
      getClient
        ? (get: Getter) => getValueAtPath(getClient(get), path) as ORPCProcedure
        : undefined

    return new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'atomWithQuery') {
            if (!procedure || (descriptor && descriptor.kind !== 'query')) {
              return undefined
            }

            return (
              input: unknown,
              options?: AtomWithORPCQueryOptions<ORPCProcedure>,
              getClient?: ORPCClientGetter<RuntimeClient>,
            ) =>
              atomWithORPCQueryInternal(
                procedure,
                input,
                options,
                getDynamicProcedure(getClient),
              )
          }

          if (property === 'atomWithMutation') {
            if (!procedure || (descriptor && descriptor.kind !== 'mutation')) {
              return undefined
            }

            return (getClient?: ORPCClientGetter<RuntimeClient>) =>
              atomWithORPCMutationInternal(
                procedure,
                getDynamicProcedure(getClient),
              )
          }

          if (property === 'atomWithSubscription') {
            if (
              !procedure ||
              (descriptor && descriptor.kind !== 'subscription')
            ) {
              return undefined
            }

            return (
              input: unknown,
              options?: AtomWithORPCSubscriptionOptions<ORPCEventIteratorProcedure>,
              getClient?: ORPCClientGetter<RuntimeClient>,
            ) =>
              atomWithORPCSubscriptionInternal(
                procedure as ORPCEventIteratorProcedure,
                input,
                options,
                getDynamicProcedure(getClient) as
                  | ((get: Getter) => ORPCEventIteratorProcedure)
                  | undefined,
              )
          }

          if (typeof property !== 'string' || descriptor || directProcedure) {
            return undefined
          }

          return createProxy((target as Record<string, unknown>)[property], [
            ...path,
            property,
          ])
        },
      },
    )
  }

  return createProxy(routerOrClient, [])
}
