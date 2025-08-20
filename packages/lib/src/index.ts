export * as http from './net/http.js'
export * as cookies from './values/cookies.js'
export * as headers from './values/headers.js'
export * as html from './values/html.js'
export * as js from './values/js.js'
export * as json from './values/json.js'

const AsyncFunction: any = (async () => {}).constructor

function runSlice(slice: string, context: unknown = {}) {
  return new AsyncFunction('$', slice)(context)
}

export const slice = { runSlice }
