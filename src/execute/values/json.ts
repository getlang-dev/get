import { get } from 'lodash-es'
import { NullSelectionError, invariant } from '../../errors'
import type { SelectFn } from './types'

export const parse = (json: string) => JSON.parse(json)

export const select: SelectFn<any> = (value, selector, expand, allowNull) => {
  if (expand) {
    const list = Array.isArray(value) ? value : [value]
    return list
      .map(value => get(value, selector))
      .filter(value => value !== undefined)
  }
  const result = get(value, selector)
  // if value is null, the key is present. Despite the operand
  // name of `allowNull`, this is a valid scenario that should
  // not raise a NullSelectionError
  if (result !== undefined) {
    return result
  }
  invariant(allowNull, new NullSelectionError(selector))
}