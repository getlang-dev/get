interface MyCustomMatchers {
  headers(headers: globalThis.Headers): any
}
declare module 'bun:test' {
  interface Matchers extends MyCustomMatchers {}
  interface AsymmetricMatchers extends MyCustomMatchers {}
}
