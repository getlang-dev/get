export enum Type {
  Html = 'html',
  Json = 'json',
  Js = 'js',
  Headers = 'headers',
  Cookies = 'cookies',
  String = 'string',
  Null = 'null',

  List = 'list',
  Struct = 'struct',

  Unknown = 'unknown',
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

export type TypeInfo = ScalarType | List | Struct
