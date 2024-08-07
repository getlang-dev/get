import { SliceError, NullSelection } from '@getlang/utils'

export const runSlice = async (
  slice: string,
  context: unknown = {},
  raw: unknown = {},
) => {
  try {
    const fn = new Function('$', '$$', slice)
    const value = await fn(context, raw)
    return value === undefined ? new NullSelection('<slice>') : value
  } catch (e) {
    throw new SliceError({ cause: e })
  }
}
