import { RequestError } from '@getlang/utils'
import type { Element } from 'domhandler'

type StringMap = Record<string, string>
export type RequestHook = (url: string, opts: RequestOpts) => Promise<Response>

type RequestOpts = {
  method?: string
  headers?: Headers
  body?: string
}

type Response = {
  status: number
  headers: Headers
  body?: string
}

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

export const constructUrl = (
  elementOrString: string | Element,
  base: string | undefined,
) => {
  let href: string | undefined
  if (typeof elementOrString === 'string') {
    href = elementOrString
  } else {
    const el = elementOrString
    if (el.type === 'tag') {
      if (el.name === 'a') {
        href = el.attribs.href
      } else if (el.name === 'img') {
        href = el.attribs.src
      }
    }
  }
  if (!href) {
    return null
  }
  return new URL(href, base).toString()
}

export const requestHook: RequestHook = async (url, opts) => {
  const res = await fetch(url, opts)
  return {
    status: res.status,
    headers: res.headers,
    body: await res.text(),
  }
}

export const request = async (
  method: string,
  url: string,
  _headers: StringMap,
  blocks: Blocks,
  bodyRaw: string,
  hook: RequestHook,
) => {
  // construct url
  const finalUrl = new URL(url)
  if (blocks.query) {
    for (const entry of Object.entries(blocks.query)) {
      finalUrl.searchParams.append(...entry)
    }
  }
  const urlString = finalUrl.toString()

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
