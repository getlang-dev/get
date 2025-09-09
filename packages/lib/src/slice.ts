const AsyncFunction: any = (async () => {}).constructor

export function runSlice(slice: string, context: unknown = {}) {
  return new AsyncFunction('$', slice)(context)
}
