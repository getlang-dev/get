export enum Type {
  Unknown = 'unknown',
  Html = 'html',
  Js = 'js',
  Headers = 'headers',
  Cookies = 'cookies',
  Null = 'null',
  List = 'list',
  Struct = 'struct',
  Maybe = 'maybe',
}

type ScalarType = {
  type: Exclude<Type, Type.List | Type.Struct>
}

type List = {
  type: Type.List
  of: TypeInfo
}

type Struct = {
  type: Type.Struct
  schema: Record<string, TypeInfo>
}

type Maybe = {
  type: Type.Maybe
  of: TypeInfo
}

export type TypeInfo = ScalarType | List | Struct | Maybe
