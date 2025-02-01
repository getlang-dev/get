import { expect } from 'bun:test'

expect.extend({
  toHaveServed(actual: unknown, expected: Request) {
    const calls: [unknown][] = (actual as any)?.mock?.calls
    for (const [req] of calls) {
      if (!(req instanceof Request)) {
        console.log(req)
        return { pass: false, message: () => 'Received non-Request object' }
      }
      const pass =
        this.equals(req.url, expected.url) &&
        this.equals(req.method, expected.method) &&
        this.equals(
          Object.fromEntries(req.headers),
          Object.fromEntries(expected.headers),
        )
      if (pass) {
        return { pass, message: () => 'Pass' }
      }
    }
    return { pass: false, message: () => 'Request objects did not match' }
  },
})
