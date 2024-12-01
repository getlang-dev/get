type ObjMap<T = unknown> = Record<string, T>

export const ws = /[ \t\r\f\v]+/
export const identifier = /[a-zA-Z_]\w*/
export const identifierExpr = /\$\w*/

export function popAll(tokens: ObjMap<string | ObjMap>) {
  return Object.fromEntries(
    Object.entries(tokens).map(([name, match]) => [
      name,
      typeof match === 'string' ? { match, pop: 1 } : { ...match, pop: 1 },
    ]),
  )
}
