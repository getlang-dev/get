import * as scp from 'set-cookie-parser'
import type { SelectFn } from './types'
import { QuerySyntaxError, invariant } from '@getlang/utils'

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
