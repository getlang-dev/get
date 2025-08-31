import { cookies, html, js, json } from '@getlang/lib'
import { invariant } from '@getlang/utils'
import { ValueReferenceError } from '@getlang/utils/errors'
import type { RuntimeValue } from './value.js'
import { toValue } from './value.js'

export function callModifier(
  mod: string,
  args: Record<string, unknown>,
  context: RuntimeValue,
) {
  let { data, typeInfo } = context
  if (mod === 'link') {
    const tag = data.type === 'tag' ? data.name : undefined
    if (tag === 'a') {
      data = html.select(data, 'xpath:@href', false)
    } else if (tag === 'img') {
      data = html.select(data, 'xpath:@src', false)
    }
  }

  const doc = toValue(data, typeInfo)

  switch (mod) {
    case 'link':
      invariant(typeof args.base === 'string', '@link requires base url')
      return new URL(doc, args.base).toString()
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
