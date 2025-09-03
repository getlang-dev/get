export { invariant, NullSelection } from './core/errors.js'
export * from './core/hooks.js'
export * as http from './net/http.js'
export * as slice from './slice.js'
export * as cookies from './values/cookies.js'
export * as headers from './values/headers.js'
export * as html from './values/html.js'
export * as js from './values/js.js'
export * as json from './values/json.js'

export type Inputs = Record<string, unknown>
export type MaybePromise<T> = T | Promise<T>
