import { cookies, html, js, json } from '@getlang/lib'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { NullSelection } from '@getlang/utils'
import { ValueReferenceError } from '@getlang/utils/errors'
import { toValue } from './value.js'

export function callModifier(
  mod: string,
  args: any,
  value: any,
  typeInfo: TypeInfo,
) {
  if (mod === 'link') {
    const tag = value.type === 'tag' ? value.name : undefined
    if (tag === 'a') {
      value = html.select(value, 'xpath:@href', false)
    } else if (tag === 'img') {
      value = html.select(value, 'xpath:@src', false)
    }
  }

  const doc = toValue(value, typeInfo)

  switch (mod) {
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
      throw new ValueReferenceError(`Unsupported modifier: ${mod}`)
  }
}
