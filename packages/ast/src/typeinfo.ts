export enum Type {
  Value = 'value',
  Html = 'html',
  Js = 'js',
  Headers = 'headers',
  Cookies = 'cookies',
  Context = 'context',
  List = 'list',
  Struct = 'struct',
  Never = 'never',
  Maybe = 'maybe',
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
  option: TypeInfo
}

type ScalarType = {
  type: Exclude<Type, Type.List | Type.Struct | Type.Maybe>
}

export type TypeInfo = ScalarType | List | Struct | Maybe
