import { SliceError } from '@getlang/utils'

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
