import * as scp from 'set-cookie-parser'
import type { SelectFn } from './types'
import { NullSelectionError, QuerySyntaxError, invariant } from '@getlang/utils'

export const parse = (from: string) => {
  const cookie = scp.splitCookiesString(from)
  return scp.parse(cookie, { map: true })
}

export const select: SelectFn<scp.CookieMap, string> = (
  cookies,
  path,
  expand,
  allowNull,
) => {
  invariant(!expand, new QuerySyntaxError('Cannot expand cookies selector'))
  const result = cookies[path]?.value
  if (result !== undefined) {
    return result
  }
  invariant(allowNull, new NullSelectionError(path))
}
