import { vi } from 'vitest'
import { execute as _exec, testIdempotency } from './helpers'
import type { RequestFn } from './helpers'

const requestFn = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
const execute = (src: string) => _exec(src, {}, requestFn)

expect.extend({
  headers(received: unknown, expected: Headers) {
    if (!(received instanceof Headers)) {
      return {
        message: () => `expected headers object`,
        pass: false,
      }
    }

    const pass = this.equals(
      Object.fromEntries(received as any),
      Object.fromEntries(expected as any)
    )

    const message = () => 'todo'
    return { pass, message }
  },
})

beforeEach(() => {
  requestFn.mockResolvedValue({
    status: 200,
    headers: new Headers({ 'content-type': 'text/html' }),
    body: '<!doctype html><h1>test</h1>',
  })
})

afterEach(() => {
  requestFn.mockClear()
})

describe('request', () => {
  describe('verbs', () => {
    test('get', async () => {
      const result = await execute(`
        GET http://get.com

        extract -> h1
      `)
      expect(requestFn.mock.calls[0]?.[1]).toMatchObject({
        method: 'GET',
      })
      expect(result).toEqual('test')
    })

    test('post', async () => {
      await execute('POST http://post.com')
      expect(requestFn.mock.calls[0]?.[1]).toMatchObject({
        method: 'POST',
      })
    })

    test('put', async () => {
      await execute('PUT http://put.com')
      expect(requestFn.mock.calls[0]?.[1]).toMatchObject({
        method: 'PUT',
      })
    })

    test('patch', async () => {
      await execute('PATCH http://patch.com')
      expect(requestFn.mock.calls[0]?.[1]).toMatchObject({
        method: 'PATCH',
      })
    })

    test('delete', async () => {
      await execute('DELETE http://delete.com')
      expect(requestFn.mock.calls[0]?.[1]).toMatchObject({
        method: 'DELETE',
      })
    })
  })

  describe('urls', () => {
    test('literal', async () => {
      await execute('GET http://get.com')
      expect(requestFn).toHaveBeenCalledWith('http://get.com/', {
        method: 'GET',
        headers: expect.headers(new Headers()),
      })
    })

    test('identifier', async () => {
      await execute(`
        set ident = \`'http://ident.com'\`
        GET $ident
      `)
      expect(requestFn).toHaveBeenCalledWith('http://ident.com/', {
        method: 'GET',
        headers: expect.headers(new Headers()),
      })
    })

    test('interpolated', async () => {
      await execute(`
        set query = \`'monterey'\`
        GET https://boogle.com/search/$query
      `)
      expect(requestFn).toHaveBeenCalledWith(
        'https://boogle.com/search/monterey',
        {
          method: 'GET',
          headers: expect.headers(new Headers()),
        }
      )
    })

    test('interpolated expression', async () => {
      await execute(`
        set query = \`'big sur'\`
        GET https://ging.com/\${query}_results
      `)
      expect(requestFn).toHaveBeenCalledWith(
        'https://ging.com/big%20sur_results',
        {
          method: 'GET',
          headers: expect.headers(new Headers()),
        }
      )
    })
  })

  test('headers', async () => {
    await execute(`
      set token = \`123\`

      GET http://api.unweb.com
      Authorization: Bearer $token
      Accept: application/json
    `)

    expect(requestFn).toHaveBeenCalledWith('http://api.unweb.com/', {
      method: 'GET',
      headers: expect.headers(
        new Headers({
          Authorization: 'Bearer 123',
          Accept: 'application/json',
        })
      ),
    })
  })

  describe('blocks', () => {
    test('querystring', async () => {
      await execute(`
        set ident = \`"b"\`
        set interp = \`"olated"\`

        GET https://example.com
        X-Test: true
        [query]
        a: literal
        b: $ident
        c: interp$interp
      `)

      expect(requestFn).toHaveBeenCalledWith(
        'https://example.com/?a=literal&b=b&c=interpolated',
        {
          method: 'GET',
          headers: expect.headers(
            new Headers({
              'X-Test': 'true',
            })
          ),
        }
      )
    })

    test('cookies, encoded', async () => {
      await execute(`
        GET https://example.com
        [cookies]
        a: A
        b: 123
        c: /here&we!are?
      `)

      expect(requestFn).toHaveBeenCalledWith('https://example.com/', {
        method: 'GET',
        headers: expect.headers(
          new Headers({
            Cookie: 'a=A; b=123; c=%2Fhere%26we%21are%3F',
          })
        ),
      })
    })

    test('json body', async () => {
      await execute(`
        POST https://example.com/login
        [json]
        username: admin
        password: test
      `)

      expect(requestFn).toHaveBeenCalledWith('https://example.com/login', {
        method: 'POST',
        headers: expect.headers(new Headers()),
        body: '{"username":"admin","password":"test"}',
      })
    })

    test('raw body', async () => {
      await execute(`
        set hello = \`"hi there"\`

        POST https://example.com
        [body]
        well $hello !!
      `)

      expect(requestFn).toHaveBeenCalledWith('https://example.com/', {
        method: 'POST',
        headers: expect.headers(new Headers()),
        body: '        well hi there !!',
      })
    })

    test('omits undefined', async () => {
      await execute(`
        set foo = \`undefined\`

        GET https://example.com
        X-Foo: $foo
        X-Bar: bar
        [query]
        foo: $foo
        bar: bar
        [cookies]
        foo: $foo
        bar: bar
        [json]
        foo: $foo
        bar: bar
      `)

      expect(requestFn).toHaveBeenCalledWith('https://example.com/?bar=bar', {
        method: 'GET',
        headers: expect.headers(
          new Headers({
            'X-Bar': 'bar',
            Cookie: 'bar=bar',
          })
        ),
        body: '{"bar":"bar"}',
      })
    })
  })

  describe('context switching', () => {
    it('updates context variable ($) dynamically', async () => {
      requestFn.mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        body: '{"which":1}',
      })
      requestFn.mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
        body: '{"which":2}',
      })
      const result = await execute(`
        GET https://example.com/api
        Accept: application/json

        set whicha = $ -> body -> @json -> which

        GET https://example.com/api
        Accept: application/json

        set whichb = $ -> body -> @json -> which

        extract { $whicha, $whichb }
      `)
      expect(result).toEqual({ whicha: 1, whichb: 2 })
    })
  })

  describe('inference', () => {
    it('examines accept header', async () => {
      requestFn.mockResolvedValue({
        status: 200,
        headers: new Headers(),
        body: '{"works":true}',
      })
      const result = await execute(`
        GET https://example.com/api
        Accept: application/json

        extract -> works
      `)
      expect(result).toEqual(true)
    })

    it('can be overridden manually with explicit modifiers', async () => {
      const result = await execute(`
        GET https://example.com/api
        Accept: application/json

        extract @html -> h1
      `)
      expect(result).toEqual('test')
    })
  })

  describe('url resolution', () => {
    it('resolves urls against request context', async () => {
      requestFn.mockResolvedValue({
        status: 200,
        headers: new Headers(),
        body: `{
          "link": "../xyz.html",
          "html": "<div><a class='link' href='/from/root'>click here</a></div>"
        }`,
      })

      const result = await execute(`
        GET https://base.com/a/b/c
        Accept: application/json

        extract {
          link1: link -> @resolve
          link2: html -> @html -> a -> @resolve
        }
      `)

      expect(result).toEqual({
        link1: 'https://base.com/a/xyz.html',
        link2: 'https://base.com/from/root',
      })
    })

    it('resolves nested urls', async () => {
      requestFn.mockResolvedValue({
        status: 200,
        headers: new Headers(),
        body: `<div>
          <a href="../xyz.html">first</a>
          <a href="/from/root">second</a>
        </div>`,
      })

      const result = await execute(`
        GET https://base.com/a/b/c

        extract => a -> {
          text: $
          link: @resolve
        }
      `)

      expect(result).toEqual([
        { text: 'first', link: 'https://base.com/a/xyz.html' },
        { text: 'second', link: 'https://base.com/from/root' },
      ])
    })
  })

  describe('non-body selectors', () => {
    test('header', async () => {
      const result = await execute(`
          GET https://example.com

          extract @headers -> content-type
        `)

      expect(result).toEqual('text/html')
    })

    test('cookie', async () => {
      requestFn.mockResolvedValue({
        status: 200,
        headers: new Headers({
          'set-cookie':
            'session=jZDE5MDBhNzczNDMzMTk4; Domain=.example.com; Path=/; Expires=Tue, 16 Jun 2026 07:31:59 GMT; Secure',
        }),
        body: '<!doctype html><h1>test</h1>',
      })
      const result = await execute(`
        GET https://example.com

        extract @cookies -> session
        `)

      expect(result).toEqual('jZDE5MDBhNzczNDMzMTk4')
    })
  })

  test('idempotency', () => {
    testIdempotency().forEach(({ a, b }) => expect(a).toEqual(b))
  })
})
