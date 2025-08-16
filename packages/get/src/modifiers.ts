import { cookies, html, js, json } from '@getlang/lib'
import type { CallExpr } from '@getlang/parser/ast'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { NullSelection } from '@getlang/utils'
import { ValueReferenceError } from '@getlang/utils/errors'
import { toValue } from './value.js'

export function callModifier(
  node: CallExpr,
  args: any,
  value: any,
  typeInfo: TypeInfo,
) {
  const callee = node.callee.value

  if (callee === 'link') {
    const tag = value.type === 'tag' ? value.name : undefined
    if (tag === 'a') {
      value = html.select(value, 'xpath:@href', false)
    } else if (tag === 'img') {
      value = html.select(value, 'xpath:@src', false)
    }
  }

  const doc = toValue(value, typeInfo)

  switch (callee) {
    case 'link':
      return doc
        ? new URL(doc, args.base).toString()
        : new NullSelection('@link')
    case 'html':
      return html.parse(doc)
    case 'js':
      return js.parse(doc)
    case 'json':
      return json.parse(doc)
    case 'cookies':
      return cookies.parse(doc)
    default:
      throw new ValueReferenceError(`Unsupported modifier: ${callee}`)
  }
}
