export type MaybePromise<T> = T | Promise<T>

export function wait<V, X>(
  value: MaybePromise<V>,
  then: (value: V) => X
): MaybePromise<X> {
  return value instanceof Promise ? value.then(then) : then(value)
}

export function waitMap<V, X>(
  values: V[],
  mapper: (value: V) => MaybePromise<X>
): MaybePromise<X[]> {
  return values.reduce(
    (acc, value) =>
      acc instanceof Promise
        ? acc.then(async acc => [...acc, await mapper(value)])
        : wait(mapper(value), value => [...acc, value]),
    [] as MaybePromise<X[]>
  )
}
