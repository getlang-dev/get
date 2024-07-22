export const select = (headers: Headers, selector: string, expand: boolean) => {
  if (expand && selector === 'set-cookie') {
    return headers.getSetCookie()
  }
  const result = headers.get(selector)
  if (expand) {
    return result ? result.split(',').map(x => x.trimStart()) : []
  }
  return result === null ? undefined : result
}

export const toValue = (headers: Headers) => {
  return Object.fromEntries(headers)
}
