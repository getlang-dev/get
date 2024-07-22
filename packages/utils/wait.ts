export type MaybePromise<T> = T | Promise<T>

export function wait<V, X>(
  value: MaybePromise<V>,
  then: (value: V) => X,
): MaybePromise<X> {
  return value instanceof Promise ? value.then(then) : then(value)
}

export function waitMap<V, X>(
  values: V[],
  mapper: (value: V) => MaybePromise<X>,
): MaybePromise<X[]> {
  return values.reduce(
    (acc, value) =>
      acc instanceof Promise
        ? acc.then(async acc => {
            acc.push(await mapper(value))
            return acc
          })
        : wait(mapper(value), value => {
            acc.push(value)
            return acc
          }),
    [] as MaybePromise<X[]>,
  )
}
