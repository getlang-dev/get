import type { SelectFn } from './types'

export const select: SelectFn<Headers, string> = (headers, path, expand) => {
  if (expand && path === 'set-cookie') {
    return headers.getSetCookie()
  }
  const result = headers.get(path)
  if (expand) {
    return result ? result.split(',').map(x => x.trimStart()) : []
  }
  return result === null ? undefined : result
}
