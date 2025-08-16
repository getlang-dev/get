import { describe, expect, test } from 'bun:test'
import { helper } from './helpers.js'

const { execute, testIdempotency } = helper()

describe('call', () => {
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

  test('links', async () => {
    const modules = {
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

        extract #a -> >#b -> @Link) >#c -> >#d
      `,
      Link: `
        extract {
          _module: \`'Link'\`
        }
      `,
    }
    const result = await execute(
      modules,
      {},
      () =>
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
    )

    expect(result).toEqual({
      '@link': 'http://stub/a/b/c/d',
    })
  })

  test('idempotency', () => {
    for (const { a, b } of testIdempotency()) {
      expect(a).toEqual(b)
    }
  })
})
