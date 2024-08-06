import { get } from 'lodash-es'
import { NullSelection } from '@getlang/utils'

export const parse = (json: string) => JSON.parse(json)

// only an `undefined` result is considered a null selection
// if result itself is null, the key is present. This is a
// valid scenario that should not raise a NullSelectionError
export const select = (value: any, selector: string, expand: boolean) => {
  return get(value, selector, expand ? [] : new NullSelection(selector))
}
