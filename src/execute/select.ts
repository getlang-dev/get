import type { SelectFn } from './values/types'
import * as html from './values/html'
import * as json from './values/json'
import * as js from './values/js'
import * as headers from './values/headers'
import * as cookies from './values/cookies'
import * as type from './value'
import { invariant, TypeError } from '../errors'

type Args = [selector: string, expand: boolean, allowNull: boolean]

function selectValue<T extends type.Value, V extends type.Value>(
  ValueType: { new (...args: any[]): V },
  fn: SelectFn<T['raw'], V['raw']>,
  context: T,
  ...args: Args
): V | type.List<V> | type.Null {
  const result = fn(context.raw, ...args)
  const [, expand] = args
  if (expand) {
    invariant(
      Array.isArray(result),
      new TypeError('Expanding selector encountered non-array')
    )
    return new type.List(
      result.map(x => new ValueType(x, context.base)),
      context.base
    )
  } else if (result !== undefined) {
    return new ValueType(result, context.base)
  }

  return new type.Null(args[0])
}

export function select<T extends type.Value>(
  context: T,
  ...args: Args
): type.Value {
  if (context instanceof type.Html) {
    return selectValue(type.Html, html.select, context, ...args)
  } else if (context instanceof type.Js) {
    return selectValue(type.Js, js.select, context, ...args)
  } else if (context instanceof type.Headers) {
    return selectValue(type.String, headers.select, context, ...args)
  } else if (context instanceof type.CookieSet) {
    return selectValue(type.String, cookies.select, context, ...args)
  }

  const result = selectValue(type.Value, json.select, context, ...args)
  return result?.raw instanceof type.Value ? result.raw : result
}
