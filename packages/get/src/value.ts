import { cookies, headers, html, js } from '@getlang/lib'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import { invariant, NullSelection } from '@getlang/utils'
import { NullSelectionError, ValueTypeError } from '@getlang/utils/errors'
import { mapValues } from 'lodash-es'

export type RuntimeValue = {
  data: any
  typeInfo: TypeInfo
}

export function toValue(value: any, typeInfo: TypeInfo): any {
  switch (typeInfo.type) {
    case Type.Html:
      return html.toValue(value)
    case Type.Js:
      return js.toValue(value)
    case Type.Headers:
      return headers.toValue(value)
    case Type.Cookies:
      return cookies.toValue(value)
    case Type.List:
      return value.map((item: any) => toValue(item, typeInfo.of))
    case Type.Struct:
      return mapValues(value, (v, k) => toValue(v, typeInfo.schema[k]!))
    case Type.Maybe:
      return toValue(value, typeInfo.option)
    case Type.Value:
      return value
    default:
      throw new ValueTypeError('Unsupported conversion type')
  }
}

export function assert(value: RuntimeValue) {
  const optional = value.typeInfo.type === Type.Maybe
  if (!optional && value.data instanceof NullSelection) {
    throw new NullSelectionError(value.data.selector)
  }
  return value
}
