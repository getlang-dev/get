export * as http from './net/http.js'
export * as html from './values/html.js'
export * as json from './values/json.js'
export * as js from './values/js.js'
export * as headers from './values/headers.js'
export * as cookies from './values/cookies.js'

function runSlice(slice: string, context: unknown = {}, raw: unknown = {}) {
  return new Function('$', '$$', slice)(context, raw)
}

export const slice = { runSlice }
