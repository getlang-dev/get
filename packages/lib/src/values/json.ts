import { get, toPath } from 'lodash-es'
import { NullSelection } from '../core/errors.js'

export const parse = (json: string) => JSON.parse(json)

// only an `undefined` result is considered a null selection
// if result itself is null, the key is present. This is a
// valid scenario that should not raise a NullSelectionError
export const select = (value: any, selector: string, expand: boolean) => {
  const path = toPath(selector)
  const fallback = expand ? [] : new NullSelection(selector)
  return get(value, path, fallback)
}
