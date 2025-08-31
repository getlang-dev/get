declare module 'bun:test' {
  interface AsymmetricMatchers {
    toHaveServed(url: string, opts: RequestInit): void
  }
  interface Matchers<R> {
    toHaveServed(url: string, opts: RequestInit): R
  }
}
