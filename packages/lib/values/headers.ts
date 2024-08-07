import { NullSelection } from '@getlang/utils'

export const select = (headers: Headers, selector: string, expand: boolean) => {
  if (expand && selector === 'set-cookie') {
    return headers.getSetCookie()
  }
  const value = headers.get(selector)
  if (expand) {
    return value ? value.split(',').map(x => x.trimStart()) : []
  }
  return value === null ? new NullSelection(selector) : value
}

export const toValue = (headers: Headers) => {
  return Object.fromEntries(headers)
}
