declare module 'bun:test' {
  interface AsymmetricMatchers {
    toHaveServed(request: Request): void
  }
  interface Matchers<R> {
    toHaveServed(request: Request): R
  }
}
