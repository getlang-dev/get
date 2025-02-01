import { describe, expect, test } from 'bun:test'
import { NullInputError } from '@getlang/utils'
import { helper } from './helpers.js'

const { execute, testIdempotency } = helper()

describe('modules', () => {
  test('extract', async () => {
    const src = 'extract `501`'
    const result = await execute(src)
    expect(result).toEqual(501)
  })

  test('syntax error', () => {
    const result = execute(`
      GET https://test.com

      extrct { title }
    `)
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

    test('optional input', async () => {
      const src = `
        inputs { value? }
        extract \`12\`
      `
      const result = await execute(src)
      // does not throw error
      expect(result).toEqual(12)
    })

    test('default value', async () => {
      const src = `
        inputs { stopA = \`'big sur'\`, stopB = \`'carmel'\` }

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
        inputs { offset = \`0\` }
        extract { $offset }
      `
      const result = await execute(src, {})
      expect(result).toEqual({ offset: 0 })
    })
  })

  test('calls', async () => {
    const result = await execute({
      Auth: 'extract { token: `"abc"` }',
      Home: 'extract { auth: @Auth }',
    })
    expect(result).toEqual({
      auth: {
        token: 'abc',
      },
    })
  })

  test('links', async () => {
    const modules = {
      Product: `
        extract {
          _module: \`'Product'\`
        }
      `,
      Search: `
        extract {
          _module: \`'Search'\`
        }
      `,
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
      () =>
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
    )
    expect(result).toEqual({
      items: [
        {
          _module: 'Product',
          '@link': 'https://search.com/products/1',
          name: 'Deck o cards',
          desc: 'Casino grade playing cards',
        },
      ],
      pager: {
        next: {
          _module: 'Search',
          '@link': 'https://search.com/?s=gifts&page=2',
        },
        prev: {
          _module: 'Search',
          '@link': undefined,
        },
      },
    })
  })

  test('variables', async () => {
    const result = await execute(`
      set x = \`{ test: true }\`
      extract $x
    `)
    expect(result).toEqual({ test: true })
  })

  test('subquery scope with context', async () => {
    const result = await execute(`
      set x = \`{ test: true }\`
      extract $x -> ( extract $ )
    `)
    expect(result).toEqual({ test: true })
  })

  test('subquery scope with closures', async () => {
    const result = await execute(`
      set x = \`{ test: true }\`
      extract (
        extract $x
      )
    `)
    expect(result).toEqual({ test: true })
  })

  test('idempotency', () => {
    for (const { a, b } of testIdempotency()) {
      expect(a).toEqual(b)
    }
  })
})
