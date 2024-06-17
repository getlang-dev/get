import { SliceError, NullInputError } from '../errors'
import * as json from './values/json'

export const runSlice = async (
  slice: string,
  context: Record<string, unknown> = {}
) => {
  try {
    const fn = new Function('context', slice)
    const value = await fn(context)
    // convert an undefined result into explicit null
    return typeof value === 'undefined' ? null : value
  } catch (e: any) {
    throw new SliceError({ cause: e })
  }
}

export const selectInput = (
  input: any,
  inputName: string,
  optional: boolean
) => {
  try {
    return json.select(input, inputName, false, optional)
  } catch (e) {
    throw new NullInputError(inputName)
  }
}
