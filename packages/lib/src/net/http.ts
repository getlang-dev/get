import { invariant, QuerySyntaxError, RequestError } from '../core/errors.js'
import type { RequestHook } from '../core/hooks.js'

type StringMap = Record<string, string>

type Blocks = {
  query?: StringMap
  cookies?: StringMap
  json?: StringMap
  form?: StringMap
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
    const pairs = Object.entries(blocks.cookies).map(entry => entry.join('='))
    const cookieHeader = pairs.join('; ')
    headers.set('cookie', cookieHeader)
  }

  // construct body
  let body: string | undefined
  const { json, form } = blocks
  invariant(
    [bodyRaw, json, form].filter(Boolean).length <= 1,
    new QuerySyntaxError('Request accepts only one of: [body], [json], [form]'),
  )
  if (bodyRaw) {
    body = bodyRaw
  } else if (json) {
    body = JSON.stringify(blocks.json)
  } else if (form) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(form)) {
      fd.append(k, v)
    }
    const req = new Request('http://dummy', { method: 'POST', body: fd })
    const ct = req.headers.get('content-type')
    invariant(ct, 'Form serialization error')
    headers.append('content-type', ct)
    body = await req.text()
  }

  // make request
  try {
    const res = await hook(urlString, { method, headers, body })
    return { url: urlString, ...res }
  } catch (e) {
    throw new RequestError(urlString, { cause: e })
  }
}
