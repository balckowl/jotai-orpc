import type { Getter } from 'jotai/vanilla'

import type {
  AsyncValueOrGetter,
  ORPCProcedure,
  ProcedureClientOptions,
  ValueOrGetter,
} from './types.js'

export function resolveAsyncValueOrGetter<T>(
  valueOrGetter: AsyncValueOrGetter<T>,
  get: Getter,
): T | PromiseLike<T> {
  if (typeof valueOrGetter === 'function') {
    return (valueOrGetter as (get: Getter) => T | PromiseLike<T>)(get)
  }

  return valueOrGetter
}

export function resolveValueOrGetter<T>(
  valueOrGetter: ValueOrGetter<T>,
  get: Getter,
): T {
  if (typeof valueOrGetter === 'function') {
    return (valueOrGetter as (get: Getter) => T)(get)
  }

  return valueOrGetter
}

export function withAbortSignal<TProcedure extends ORPCProcedure>(
  clientOptions: ProcedureClientOptions<TProcedure> | undefined,
  signal: AbortSignal,
): ProcedureClientOptions<TProcedure> {
  return {
    signal,
    ...(clientOptions as object | undefined),
  } as ProcedureClientOptions<TProcedure>
}
