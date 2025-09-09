import { describe, expect, test } from 'bun:test'
import { RecursiveCallError } from '@getlang/lib/errors'
import { execute } from './helpers.js'

describe('calls', () => {
  test('modules', async () => {
    const result = await execute({
      Auth: 'extract { token: `"abc"` }',
      Home: `extract {
        auth: @Auth -> token
      }`,
    })
    expect(result).toEqual({
      auth: 'abc',
    })
  })

  describe('semantics', () => {
    const Call = `
      inputs { called }
      extract { called: |true| }
    `

    test('select', async () => {
      const modules = {
        Call,
        Home: `
          set called = |false|
          extract {
            select: @Call({ $called }) -> called
          }
        `,
      }
      const result = await execute(modules)
      expect(result).toEqual({ select: true })
    })

    test('from var', async () => {
      const modules = {
        Call,
        Home: `
          set called = |false|
          set as_var = @Call({ $called })
          extract {
            from_var: $as_var -> called
          }
        `,
      }
      const result = await execute(modules)
      expect(result).toEqual({ from_var: true })
    })

    test('subquery', async () => {
      const modules = {
        Call,
        Home: `
          set called = |false|
          extract {
            subquery: (
              extract @Call({ $called })
            ) -> called
          }
        `,
      }
      const result = await execute(modules)
      expect(result).toEqual({ subquery: true })
    })

    test('from subquery', async () => {
      const modules = {
        Call,
        Home: `
        set called = |false|
        set as_subquery = ( extract @Call({ $called }) )

        extract {
          from_subquery: $as_subquery -> called
        }
      `,
      }
      const result = await execute(modules)
      expect(result).toEqual({ from_subquery: true })
    })

    test.skip('object key', async () => {
      const modules = {
        Call,
        Home: `
        set called = |false|
        extract {
          object: as_entry = { key: @Call({ $called }) } -> key -> called
        }
      `,
      }
      const result = await execute(modules)
      expect(result).toEqual({ object: true })
    })
  })

  test('drill return value', async () => {
    const modules = {
      Req: `
        GET http://stub

        extract @html
      `,
      Home: `
        set req = @Req
        extract $req -> { div, span }
      `,
    }

    const result = await execute(
      modules,
      {},
      {
        fetch: () => new Response(`<!doctype html><div>x</div><span>y</span>`),
      },
    )
    expect(result).toEqual({ div: 'x', span: 'y' })
  })

  test.skip('drill returned request', async () => {
    const modules = {
      Req: `
        GET http://stub

        extract $
      `,
      Home: `
        set req = @Req
        extract $req -> { div, span }
      `,
    }

    const result = await execute(
      modules,
      {},
      {
        fetch: () => new Response(`<!doctype html><div>x</div><span>y</span>`),
      },
    )
    expect(result).toEqual({ div: 'x', span: 'y' })
  })

  test('links', async () => {
    const modules = {
      Search: 'extract `1`',
      Product: 'extract `2`',
      Home: `
        inputs { query, page? }

        GET https://search.com/
        [query]
        s: $query
        page: $page

        set results = => li.result -> @Product({
          @link: a
          name: a
          desc: p.description
        })

        extract {
          items: $results
          pager: .pager -> {
            next: @Search) a.next
            prev: @Search) a.prev
          }
        }
      `,
    }

    const result = await execute(
      modules,
      { query: 'gifts' },
      {
        fetch: () =>
          new Response(`
          <!doctype html>
          <ul>
            <li class="result">
              <a href="/products/1">Deck o cards</a>
              <p class="description">Casino grade playing cards</p>
            </li>
          </ul>
          <div class="pager">
            <a class="next" href="/?s=gifts&page=2">next</a>
          </div>
        `),
      },
    )
    expect(result).toEqual({
      items: [
        {
          '@link': 'https://search.com/products/1',
          name: 'Deck o cards',
          desc: 'Casino grade playing cards',
        },
      ],
      pager: {
        next: {
          '@link': 'https://search.com/?s=gifts&page=2',
        },
        prev: {},
      },
    })
  })

  test('links pre/post-amble', async () => {
    const modules = {
      Home: `
        GET http://stub/x/y/z

        extract #a
          -> :scope > #b
          -> @Link) :scope > #c
            -> :scope > #d
      `,
      Link: `
        extract {
          _module: |'Link'|
        }
      `,
    }
    const result = await execute(
      modules,
      {},
      {
        fetch: () =>
          new Response(`
          <!doctype html>
          <body>
            <div id="a">
              <div id="b">
                <div id="c">
                  <a id="d" href="/a/b/c/d">link</a>
              </div>
            </div>
          </body>
        `),
      },
    )

    expect(result).toEqual({
      '@link': 'http://stub/a/b/c/d',
    })
  })

  test('context propagation', async () => {
    const modules = {
      Home: `
        GET http://stub

        extract {
          a: @Data({ text: |'first'| })
          b: @Data({ text: |'second'| })
        }
      `,
      Data: `
        inputs { text }

        extract xpath://div[p[contains(text(), '$text')]]
          -> xpath:@data-json
          -> @json
      `,
    }

    const result = await execute(
      modules,
      {},
      {
        fetch: () =>
          new Response(`
          <!doctype html>
          <div data-json='{"x": 1}'><p>first</p></li>
          <div data-json='{"y": 2}'><p>second</p></li>
        `),
      },
    )

    expect(result).toEqual({
      a: { x: 1 },
      b: { y: 2 },
    })
  })

  test('drill macro return types', async () => {
    const modules = {
      Home: `
        GET http://stub

        extract @Data({text: |'first'|})
          -> xpath:@data-json
          -> @json
      `,
      Data: `
        inputs { text }

        extract xpath://div[p[contains(text(), '$text')]]
      `,
    }

    const result = await execute(
      modules,
      {},
      {
        fetch: () =>
          new Response(`<div data-json='{"x": 1}'><p>first</p></li>`),
      },
    )

    expect(result).toEqual({ x: 1 })
  })

  test('recursive', async () => {
    const modules = {
      Home: `
        extract {
          value: @Page -> value
        }
      `,
      Page: `
        extract {
          value: @Home -> value
        }
      `,
    }

    const result = execute(modules)
    return expect(result).rejects.toThrow(
      new RecursiveCallError(['Home', 'Page', 'Home']),
    )
  })

  test('recursive link not called', async () => {
    const modules = {
      Home: `
        extract {
          page: @Page -> value
        }
      `,
      Page: `
        extract {
          value: @Home({
            called: |false|
          })
        }
      `,
    }

    const result = await execute(modules)
    expect(result).toEqual({
      page: { called: false },
    })
  })
})
