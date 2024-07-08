import type { SelectFn } from './values/types'
import * as html from './values/html'
import * as json from './values/json'
import * as js from './values/js'
import * as headers from './values/headers'
import * as cookies from './values/cookies'
import * as type from './value'
import { invariant, ValueTypeError } from '@getlang/lib'

function selectValue<T extends type.Value, V extends type.Value>(
  ValueType: { new (...args: any[]): V },
  fn: SelectFn<T['raw'], V['raw']>,
  context: T,
  selector: string,
  expand: boolean,
): V | type.ListValue<V> | type.UndefinedValue {
  const result = fn(context.raw, selector, expand)
  if (expand) {
    invariant(
      Array.isArray(result),
      new ValueTypeError('Expanding selector encountered non-array'),
    )
    return new type.ListValue(
      result.map(x => new ValueType(x, context.base)),
      context.base,
    )
  }
  return result === undefined
    ? new type.UndefinedValue(selector)
    : new ValueType(result, context.base)
}

export function select<T extends type.Value>(
  context: T,
  selector: string,
  expand: boolean,
): type.Value {
  const args = [context, selector, expand] as const
  if (context instanceof type.HtmlValue) {
    return selectValue(type.HtmlValue, html.select, ...args)
  }
  if (context instanceof type.JsValue) {
    return selectValue(type.JsValue, js.select, ...args)
  }
  if (context instanceof type.HeadersValue) {
    return selectValue(type.StringValue, headers.select, ...args)
  }
  if (context instanceof type.CookieSetValue) {
    return selectValue(type.StringValue, cookies.select, ...args)
  }

  const result = selectValue(type.Value, json.select, ...args)
  return result?.raw instanceof type.Value ? result.raw : result
}
