import type { SelectFn } from './types'
import { NullSelectionError, invariant } from '../../errors'

export const select: SelectFn<Headers, string> = (
  headers,
  path,
  expand,
  allowNull,
) => {
  if (expand && path === 'set-cookie') {
    return headers.getSetCookie()
  }
  const result = headers.get(path)
  if (expand) {
    return result ? result.split(',').map(x => x.trimStart()) : []
  }
  if (result !== null) {
    return result
  }
  invariant(allowNull, new NullSelectionError(path))
}
