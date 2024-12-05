type ObjMap<T = unknown> = Record<string, T>

export const patterns = {
  ws: /[ \t\r\f\v]+/,
  identifier: /[a-zA-Z_]\w*/,
  identifierExpr: /\$\w*/,
  call: /\@\w+/,
  link: /\@\w+\)/,
}

export function popAll(tokens: ObjMap<string | ObjMap>) {
  return Object.fromEntries(
    Object.entries(tokens).map(([name, match]) => [
      name,
      typeof match === 'string' ? { match, pop: 1 } : { ...match, pop: 1 },
    ]),
  )
}
