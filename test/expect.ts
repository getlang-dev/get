import { expect } from 'bun:test'
import { diff } from 'jest-diff'

async function toObject(req: Request) {
  return {
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers),
    body: await req.text(),
  }
}

expect.extend({
  async toHaveServed(received: unknown, expected: Request) {
    const calls: [unknown][] = (received as any)?.mock?.calls
    const expObj = await toObject(expected)
    expObj.headers = expect.objectContaining(expObj.headers)

    let receivedObj: any

    for (const [req] of calls) {
      if (!(req instanceof Request)) {
        return {
          pass: false,
          message: () => `Received non-Request object: ${req}`,
        }
      }

      const recObj = await toObject(req)
      receivedObj ??= recObj
      const pass = this.equals(recObj, expObj)
      if (pass) {
        return { pass, message: () => 'Pass' }
      }
    }

    return {
      pass: false,
      message: () => {
        const diffString = diff(expObj, receivedObj)
        return ['Difference:', diffString].join('\n\n')
      },
    }
  },
})
