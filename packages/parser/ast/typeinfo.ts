export enum Type {
  Value = 'value',
  Html = 'html',
  Js = 'js',
  Headers = 'headers',
  Cookies = 'cookies',
  List = 'list',
  Struct = 'struct',
  Never = 'never',
  Maybe = 'maybe',
}

export type List = {
  type: Type.List
  of: TypeInfo
}

export type Maybe = {
  type: Type.Maybe
  option: TypeInfo
}

export type Struct = {
  type: Type.Struct
  schema: Record<string, TypeInfo>
}

type ScalarType = {
  type: Exclude<Type, Type.List | Type.Struct | Type.Maybe>
}

export type TypeInfo = ScalarType | List | Struct | Maybe

export function tequal(a: TypeInfo, b: TypeInfo): boolean {
  if (a.type === 'list' && b.type === 'list') {
    return tequal(a.of, b.of)
  } else if (a.type === 'struct' && b.type === 'struct') {
    const ax = Object.entries(a.schema)
    const bx = Object.entries(b.schema)
    if (ax.length !== bx.length) return false
    return ax.every(([ak, av]) => {
      const bv = b.schema[ak]
      return bv && tequal(av, bv)
    })
  } else if (a.type === 'maybe' && b.type === 'maybe') {
    return tequal(a.option, b.option)
  } else {
    return a.type === b.type
  }
}
