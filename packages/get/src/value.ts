import type { TypeInfo } from '@getlang/ast'
import { Type } from '@getlang/ast'
import { cookies, headers, html, js, NullSelection } from '@getlang/lib'
import { mapValues } from 'lodash-es'
import {
  NullSelectionError,
  ValueTypeError,
} from '../../lib/src/core/errors.js'

export type RuntimeValue = {
  data: any
  typeInfo: TypeInfo
}

export function materialize({ data, typeInfo }: RuntimeValue): any {
  switch (typeInfo.type) {
    case Type.Html:
      return html.toValue(data)
    case Type.Js:
      return js.toValue(data)
    case Type.Headers:
      return headers.toValue(data)
    case Type.Cookies:
      return cookies.toValue(data)
    case Type.List:
      return data.map((item: any) =>
        materialize({ data: item, typeInfo: typeInfo.of }),
      )
    case Type.Struct:
      return mapValues(data, (v, k) =>
        materialize({ data: v, typeInfo: typeInfo.schema[k]! }),
      )
    case Type.Maybe:
      return materialize({ data, typeInfo: typeInfo.option })
    case Type.Value:
      return data
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
