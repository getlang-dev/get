import * as scp from 'set-cookie-parser'
import type { SelectFn } from './types.js'
import { QuerySyntaxError, invariant } from '@getlang/lib'

export const parse = (from: string) => {
  const cookie = scp.splitCookiesString(from)
  return scp.parse(cookie, { map: true })
}

export const select: SelectFn<scp.CookieMap, string> = (
  cookies,
  path,
  expand,
) => {
  invariant(!expand, new QuerySyntaxError('Cannot expand cookies selector'))
  return cookies[path]?.value
}
