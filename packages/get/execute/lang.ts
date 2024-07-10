import { SliceError, NullInputError } from '@getlang/lib'
import * as json from './values/json.js'

export const runSlice = async (
  slice: string,
  context: unknown = {},
  raw: unknown = {},
) => {
  try {
    const fn = new Function('$', '$$', slice)
    return await fn(context, raw)
  } catch (e) {
    throw new SliceError({ cause: e })
  }
}

export const selectInput = (
  input: Record<string, unknown>,
  inputName: string,
  optional: boolean,
) => {
  const value = json.select(input, inputName, false)
  if (value === undefined && !optional) {
    throw new NullInputError(inputName)
  }
  return value
}
