import * as scp from 'set-cookie-parser'
import { QuerySyntaxError, invariant } from '@getlang/lib'

export const parse = (from: string) => {
  const cookie = scp.splitCookiesString(from)
  return scp.parse(cookie, { map: true })
}

export const select = (
  cookies: scp.CookieMap,
  path: string,
  expand: boolean,
) => {
  invariant(!expand, new QuerySyntaxError('Cannot expand cookies selector'))
  return cookies[path]?.value
}
