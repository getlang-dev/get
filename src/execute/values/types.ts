export type SelectFn<T, V = T> = (
  context: T,
  selector: string,
  expand: boolean,
  allowNull: boolean
) => V | V[] | undefined
