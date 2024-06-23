import type { SelectFn } from './values/types'
import * as html from './values/html'
import * as json from './values/json'
import * as js from './values/js'
import * as headers from './values/headers'
import * as cookies from './values/cookies'
import * as type from './value'
import { invariant, GetTypeError } from '../errors'

type Args = [selector: string, expand: boolean, allowNull: boolean]

function selectValue<T extends type.Value, V extends type.Value>(
  ValueType: { new (...args: any[]): V },
  fn: SelectFn<T['raw'], V['raw']>,
  context: T,
  ...args: Args
): V | type.ListValue<V> | type.NullValue {
  const result = fn(context.raw, ...args)
  const [, expand] = args
  if (expand) {
    invariant(
      Array.isArray(result),
      new GetTypeError('Expanding selector encountered non-array'),
    )
    return new type.ListValue(
      result.map(x => new ValueType(x, context.base)),
      context.base,
    )
  }
  if (result !== undefined) {
    return new ValueType(result, context.base)
  }

  return new type.NullValue(args[0])
}

export function select<T extends type.Value>(
  context: T,
  ...args: Args
): type.Value {
  if (context instanceof type.HtmlValue) {
    return selectValue(type.HtmlValue, html.select, context, ...args)
  }
  if (context instanceof type.JsValue) {
    return selectValue(type.JsValue, js.select, context, ...args)
  }
  if (context instanceof type.HeadersValue) {
    return selectValue(type.StringValue, headers.select, context, ...args)
  }
  if (context instanceof type.CookieSetValue) {
    return selectValue(type.StringValue, cookies.select, context, ...args)
  }

  const result = selectValue(type.Value, json.select, context, ...args)
  return result?.raw instanceof type.Value ? result.raw : result
}
