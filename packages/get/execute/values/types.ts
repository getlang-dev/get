export type SelectFn<T, V = T> = (
  context: T,
  selector: string,
  expand: boolean,
) => V | V[] | undefined
