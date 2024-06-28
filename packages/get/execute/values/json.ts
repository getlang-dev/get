import { get } from 'lodash-es'
import type { SelectFn } from './types'

export const parse = (json: string) => JSON.parse(json)

// only an `undefined` result is considered a null selection
// if result itself is null, the key is present. This is a
// valid scenario that should not raise a NullSelectionError
export const select: SelectFn<any> = (value, selector, expand) => {
  return get(value, selector, expand ? [] : undefined)
}
