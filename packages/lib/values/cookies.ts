import * as scp from 'set-cookie-parser'
import { mapValues } from 'lodash-es'
import { QuerySyntaxError, invariant, NullSelection } from '@getlang/utils'

export const parse = (source: string) => {
  const cookie = scp.splitCookiesString(source)
  return scp.parse(cookie, { map: true })
}

export const select = (
  cookies: scp.CookieMap,
  selector: string,
  expand: boolean,
) => {
  invariant(!expand, new QuerySyntaxError('Cannot expand cookies selector'))
  return cookies[selector]?.value ?? new NullSelection(selector)
}

export const toValue = (cookies: scp.CookieMap) => {
  return mapValues(cookies, c => c.value)
}
