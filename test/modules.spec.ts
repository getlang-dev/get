import { describe, expect, test } from 'bun:test'
import {
  NullInputError,
  RecursiveCallError,
  UnknownInputsError,
} from '@getlang/lib/errors'
import { execute } from './helpers.js'

describe('modules', () => {
  test('extract', async () => {
    const src = 'extract `501`'
    const result = await execute(src)
    expect(result).toEqual(501)
  })

  test('syntax error', () => {
    const result = execute(
      `
      GET https://test.com

      extrct { title }
    `,
      {},
      { willThrow: true },
    )
    return expect(result).rejects.toThrow(
      'SyntaxError: Invalid token at line 3 col 1:\n\n1  GET https://test.com\n2  \n3  extrct { title }\n   ^',
    )
  })

  describe('inputs', () => {
    test('single', async () => {
      const src = `
        inputs { value }
        extract $value
      `
      const result = await execute(src, { value: 'ping' })
      expect(result).toEqual('ping')
    })

    test('multiple', async () => {
      const src = `
        inputs { x, y }
        extract $y
      `
      const result = await execute(src, { x: 10, y: 20 })
      expect(result).toEqual(20)
    })

    test('required input missing', () => {
      const result = execute(`
        inputs { value }
        extract $value
      `)
      return expect(result).rejects.toThrow(new NullInputError('value'))
    })

    test('unknown input provided', () => {
      const result = execute('extract `123`', { x: 1 })
      return expect(result).rejects.toThrow(new UnknownInputsError(['x']))
    })

    test('unknown inputs provided', () => {
      const result = execute('extract `123`', { x: 1, y: 2 })
      return expect(result).rejects.toThrow(new UnknownInputsError(['x', 'y']))
    })

    test('optional input', async () => {
      const src = `
        inputs { value? }
        extract |12|
      `
      const result = await execute(src)
      // does not throw error
      expect(result).toEqual(12)
    })

    test('default value', async () => {
      const src = `
        inputs { stopA = |'big sur'|, stopB = |'carmel'| }

        extract { $stopA, $stopB }
      `
      const result = await execute(src, { stopB: 'monterey' })
      expect(result).toEqual({
        stopA: 'big sur',
        stopB: 'monterey',
      })
    })

    test('falsy default value', async () => {
      const src = `
        inputs { offset = |0| }
        extract { $offset }
      `
      const result = await execute(src, {})
      expect(result).toEqual({ offset: 0 })
    })
  })

  test('variables', async () => {
    const result = await execute(`
      set x = |{ test: true }|
      extract $x
    `)
    expect(result).toEqual({ test: true })
  })

  test('subquery scope with context', async () => {
    const result = await execute(`
      set x = |{ test: true }|
      extract $x -> ( extract $ )
    `)
    expect(result).toEqual({ test: true })
  })

  test('subquery scope with closures', async () => {
    const result = await execute(`
      set x = |{ test: true }|
      extract (
        extract $x
      )
    `)
    expect(result).toEqual({ test: true })
  })

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

    test('paint inputs', async () => {
      const modules = {
        Reverse: `
          inputs { list }
          set result = | list.map(x => Number(x) * 10).reverse() |
          extract { $result }
        `,
        Home: `
          set list = "<ul><li>1</li><li>2</li><li>3</li></ul>" -> @html => li
          extract @Reverse({ $list }) -> result
        `,
      }

      const result = await execute(modules)
      expect(result).toEqual([30, 20, 10])
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
          fetch: () =>
            new Response(`<!doctype html><div>x</div><span>y</span>`),
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
          fetch: () =>
            new Response(`<!doctype html><div>x</div><span>y</span>`),
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

          extract //div[p[contains(text(), '$text')]]
            -> ./@data-json
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
            -> ./@data-json
            -> @json
        `,
        Data: `
          inputs { text }

          extract //div[p[contains(text(), '$text')]]
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

    test('non-macro not called', async () => {
      const modules = {
        NotMacro: `
          extract "<p>100<p>" -> @html -> p
        `,
        Home: `
          extract @NotMacro({ num: 0 })
        `,
      }

      const result = await execute(modules)
      expect(result).toEqual({ num: 0 })
    })
  })
})
