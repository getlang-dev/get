import { expect } from 'bun:test'
import { diff } from 'jest-diff'

expect.extend({
  async toHaveServed(received: unknown, url: string, opts: RequestInit) {
    const calls: [unknown, any][] = (received as any)?.mock?.calls
    const { method, headers = {}, body } = opts
    const expObj = { url, method, headers, body }

    let receivedObj: any

    for (const [url, { method, headers, body }] of calls) {
      const recObj = { url, method, headers, body }
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
