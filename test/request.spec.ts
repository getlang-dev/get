import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Fetch } from './helpers.js'
import { helper } from './helpers.js'

const { execute: _exec, testIdempotency } = helper()

const mockFetch = mock<Fetch>(
  () =>
    new Response('<!doctype html><h1>test</h1>', {
      headers: {
        'content-type': 'text/html',
      },
    }),
)

const execute = (
  src: string,
  inputs: Record<string, unknown> = {},
  fetch: Fetch = mockFetch,
) => _exec(src, inputs, fetch)

beforeEach(() => {
  mockFetch.mockClear()
})

describe('request', () => {
  describe('verbs', () => {
    test('get', async () => {
      const result = await execute(`
        GET http://get.com

        extract -> h1
      `)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      await expect(mockFetch).toHaveServed(
        new Request('http://get.com', { method: 'GET' }),
      )
      expect(result).toEqual('test')
    })

    test('post', async () => {
      await execute('POST http://post.com')
      await expect(mockFetch).toHaveServed(
        new Request('http://post.com', { method: 'POST' }),
      )
    })

    test('put', async () => {
      await execute('PUT http://put.com')
      await expect(mockFetch).toHaveServed(
        new Request('http://put.com', { method: 'PUT' }),
      )
    })

    test('patch', async () => {
      await execute('PATCH http://patch.com')
      await expect(mockFetch).toHaveServed(
        new Request('http://patch.com', { method: 'PATCH' }),
      )
    })

    test('delete', async () => {
      await execute('DELETE http://delete.com')
      await expect(mockFetch).toHaveServed(
        new Request('http://delete.com', { method: 'DELETE' }),
      )
    })
  })

  describe('urls', () => {
    test('literal', async () => {
      await execute('GET http://get.com')
      await expect(mockFetch).toHaveServed(
        new Request('http://get.com', {
          method: 'GET',
        }),
      )
    })

    test('identifier', async () => {
      await execute(`
        set ident = \`'http://ident.com'\`
        GET $ident
      `)
      await expect(mockFetch).toHaveServed(
        new Request('http://ident.com/', {
          method: 'GET',
        }),
      )
    })

    test('interpolated', async () => {
      await execute(`
        set query = \`'monterey'\`
        GET https://boogle.com/search/$query
      `)
      await expect(mockFetch).toHaveServed(
        new Request('https://boogle.com/search/monterey', {
          method: 'GET',
        }),
      )
    })

    test('interpolated expression', async () => {
      await execute(`
        set query = \`'big sur'\`
        GET https://ging.com/\${query}_results
      `)
      await expect(mockFetch).toHaveServed(
        new Request('https://ging.com/big%20sur_results', {
          method: 'GET',
        }),
      )
    })

    test('interpolated value', async () => {
      await execute(`
        set loc = \`'<div>sea ranch</div>'\` -> @html
        GET https://goto.ca/:loc
      `)
      await expect(mockFetch).toHaveServed(
        new Request('https://goto.ca/sea%20ranch', { method: 'GET' }),
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

    await expect(mockFetch).toHaveServed(
      new Request('http://api.unweb.com/', {
        method: 'GET',
        headers: new Headers({
          Authorization: 'Bearer 123',
          Accept: 'application/json',
        }),
      }),
    )
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

      await expect(mockFetch).toHaveServed(
        new Request('https://example.com/?a=literal&b=b&c=interpolated', {
          method: 'GET',
          headers: new Headers({
            'X-Test': 'true',
          }),
        }),
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

      await expect(mockFetch).toHaveServed(
        new Request('https://example.com/', {
          method: 'GET',
          headers: new Headers({
            Cookie: 'a=A; b=123; c=%2Fhere%26we%21are%3F',
          }),
        }),
      )
    })

    test('json body', async () => {
      await execute(`
        POST https://example.com/login
        [json]
        username: admin
        password: test
      `)

      await expect(mockFetch).toHaveServed(
        new Request('https://example.com/login', {
          method: 'POST',
          body: '{"username":"admin","password":"test"}',
        }),
      )
    })

    test('raw body', async () => {
      await execute(`
        set hello = \`"hi there"\`

        POST https://example.com
        [body]
        hello
          g'day
            welcome

        [/body]
      `)

      await expect(mockFetch).toHaveServed(
        new Request('https://example.com/', {
          method: 'POST',
          headers: new Headers(),
          body: "hello\n  g'day\n    welcome\n",
        }),
      )
    })

    test('omits undefined', async () => {
      await execute(`
        set foo? = \`undefined\`

        POST https://example.com
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

      await expect(mockFetch).toHaveServed(
        new Request('https://example.com/?bar=bar', {
          method: 'POST',
          headers: new Headers({
            'X-Bar': 'bar',
            Cookie: 'bar=bar',
          }),
          body: '{"bar":"bar"}',
        }),
      )
    })

    test('optional template groups', async () => {
      await execute(`
        set foo? = \`undefined\`

        GET https://example.com/pre$[/:foo]/post
        X-Foo: $foo
        X-Bar: bar
        X-Baz: baz$[$foo]zza
      `)

      await expect(mockFetch).toHaveServed(
        new Request('https://example.com/pre/post', {
          method: 'GET',
          headers: new Headers({
            'X-Bar': 'bar',
            'X-Baz': 'bazzza',
          }),
        }),
      )
    })

    test('nested template parts', async () => {
      const src = `
        inputs { x?, y? }

        GET https://getlang.dev
        Header: aa$[bb\${x}cc$[dd\${y}ee]ff]gg
      `

      await execute(src)
      await execute(src, { x: '0x0' })
      await execute(src, { y: '0y0' })
      await execute(src, { x: '0x0', y: '0y0' })

      await expect(mockFetch).toHaveServed(
        new Request('https://getlang.dev/', {
          method: 'GET',
          headers: new Headers({ Header: 'aagg' }),
        }),
      )

      await expect(mockFetch).toHaveServed(
        new Request('https://getlang.dev/', {
          method: 'GET',
          headers: new Headers({ Header: 'aabb0x0ccffgg' }),
        }),
      )

      await expect(mockFetch).toHaveServed(
        new Request('https://getlang.dev/', {
          method: 'GET',
          headers: new Headers({ Header: 'aagg' }),
        }),
      )

      await expect(mockFetch).toHaveServed(
        new Request('https://getlang.dev/', {
          method: 'GET',
          headers: new Headers({ Header: 'aabb0x0ccdd0y0eeffgg' }),
        }),
      )
    })
  })

  describe('context switching', () => {
    test('updates context variable ($) dynamically', async () => {
      let fetched = 0
      const mockFetch = mock<Fetch>(() => {
        const which = ++fetched
        return new Response(JSON.stringify({ which }))
      })

      const result = await execute(
        `
        GET https://example.com/api
        Accept: application/json

        set whicha = $ -> body -> @json -> which

        GET https://example.com/api
        Accept: application/json

        set whichb = $ -> body -> @json -> which

        extract { $whicha, $whichb }
      `,
        {},
        mockFetch,
      )

      expect(result).toEqual({ whicha: 1, whichb: 2 })
    })

    test('updates subquery context', async () => {
      const result = await execute(`
        set x? = \`'<p>'\` -> @html -> (
          GET http://example.com

          extract h1
        )

        extract $x
      `)

      expect(result).toEqual('test')
    })
  })

  describe('inference', () => {
    test('examines accept header', async () => {
      const result = await execute(
        `
        GET https://example.com/api
        Accept: application/json

        extract -> works
      `,
        {},
        () => new Response('{"works":true}'),
      )
      expect(result).toEqual(true)
    })

    test('can be overridden manually with explicit modifiers', async () => {
      const result = await execute(`
        GET https://example.com/api
        Accept: application/json

        extract @html -> h1
      `)
      expect(result).toEqual('test')
    })
  })

  describe('url resolution', () => {
    test('resolves urls against request context', async () => {
      const result = await execute(
        `
        GET https://base.com/a/b/c
        Accept: application/json

        extract {
          link1: link -> @link
          link2: html -> @html -> a -> @link
        }
      `,
        {},
        () =>
          new Response(
            JSON.stringify({
              link: '../xyz.html',
              html: "<div><a class='link' href='/from/root'>click here</a></div>",
            }),
          ),
      )

      expect(result).toEqual({
        link1: 'https://base.com/a/xyz.html',
        link2: 'https://base.com/from/root',
      })
    })

    test('resolves nested urls', async () => {
      const result = await execute(
        `
        GET https://base.com/a/b/c

        extract => a -> {
          text: $
          link: @link
        }
      `,
        {},
        () =>
          new Response(`<div>
          <a href="../xyz.html">first</a>
          <a href="/from/root">second</a>
        </div>`),
      )

      expect(result).toEqual([
        { text: 'first', link: 'https://base.com/a/xyz.html' },
        { text: 'second', link: 'https://base.com/from/root' },
      ])
    })

    test('infers base inside list context', async () => {
      const result = await execute(
        `
          GET https://bar.com/with/links

          extract => a -> @link
        `,
        {},
        () => new Response(`<a href="/foo">click here</a>`),
      )

      expect(result).toEqual(['https://bar.com/foo'])
    })

    test('resolved standalone links to context url', async () => {
      const src = `
        inputs { query, page? }

        GET https://example.com/search/:query
        [query]
        page: $page

        extract {
          url: @link
        }
      `

      const page1 = await execute(src, { query: 'any' })
      expect(page1).toEqual({
        url: 'https://example.com/search/any',
      })

      const page2 = await execute(src, { query: 'any', page: 2 })
      expect(page2).toEqual({
        url: 'https://example.com/search/any?page=2',
      })
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
      const result = await execute(
        `
        GET https://example.com

        extract @cookies -> session
        `,
        {},
        () =>
          new Response('<!doctype html><h1>test</h1>', {
            headers: {
              'set-cookie':
                'session=jZDE5MDBhNzczNDMzMTk4; Domain=.example.com; Path=/; Expires=Tue, 16 Jun 2026 07:31:59 GMT; Secure',
            },
          }),
      )

      expect(result).toEqual('jZDE5MDBhNzczNDMzMTk4')
    })
  })

  test('idempotency', () => {
    for (const { a, b } of testIdempotency()) {
      expect(a).toEqual(b)
    }
  })
})
