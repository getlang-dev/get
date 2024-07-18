export const select = (headers: Headers, path: string, expand: boolean) => {
  if (expand && path === 'set-cookie') {
    return headers.getSetCookie()
  }
  const result = headers.get(path)
  if (expand) {
    return result ? result.split(',').map(x => x.trimStart()) : []
  }
  return result === null ? undefined : result
}
