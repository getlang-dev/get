import { RequestError } from '../core/errors.js'
import type { RequestHook } from '../core/hooks.js'

type StringMap = Record<string, string>

type Blocks = {
  query?: StringMap
  cookies?: StringMap
  json?: StringMap
  form?: StringMap
}

// RFC 3986 compliance
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#description
const fixedEncodeURIComponent = (str: string) => {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

export const requestHook: RequestHook = async (url, opts) => {
  const res = await fetch(url, opts)
  return {
    status: res.status,
    headers: res.headers,
    body: await res.text(),
  }
}

function constructUrl(start: string, query: StringMap = {}) {
  let url: URL
  let stripProtocol = false

  try {
    url = new URL(start)
  } catch (_) {
    url = new URL(`http://${start}`)
    stripProtocol = true
  }

  for (const entry of Object.entries(query)) {
    url.searchParams.append(...entry)
  }

  const str = url.toString()
  return stripProtocol ? str.slice(7) : str
}

export const request = async (
  method: string,
  url: string,
  _headers: StringMap,
  blocks: Blocks,
  bodyRaw: string,
  hook: RequestHook,
) => {
  const urlString = constructUrl(url, blocks.query)

  // construct headers
  const headers = new Headers(_headers)
  if (blocks.cookies) {
    const pairs = Object.entries(blocks.cookies).map(entry =>
      entry.map(fixedEncodeURIComponent).join('='),
    )
    const cookieHeader = pairs.join('; ')
    headers.set('cookie', cookieHeader)
  }

  // construct body
  let body: string | undefined
  if (bodyRaw) {
    body = bodyRaw
  } else if (blocks.json) {
    body = JSON.stringify(blocks.json)
  }

  // make request
  try {
    const res = await hook(urlString, { method, headers, body })
    return { url: urlString, ...res }
  } catch (e) {
    throw new RequestError(urlString, { cause: e })
  }
}
