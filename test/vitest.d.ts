import type { Assertion, AsymmetricMatchersContaining } from 'vitest'

interface CustomMatchers<R = unknown> {
  headers: (headers: Headers) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
