import { RuntimeError } from '../src/errors'
import { execute, testIdempotency } from './helpers'
import type { RequestFn } from './helpers'

describe('drills & parsers', () => {
  test('into JS object', async () => {
    const result = await execute(`
      set obj = \`{ a: "b" }\`
      extract $obj -> a
    `)
    expect(result).toEqual('b')
  })

  test('unbound drills can be variable ref', async () => {
    const result = await execute(`
      set x = \`{ a: "b" }\`
      extract $x -> a
    `)
    expect(result).toEqual('b')
  })

  test('nested drills into JSON', async () => {
    const result = await execute(`
      set x = \`{ a: { b: ["c", "d"] } }\`
      extract $x -> a -> b[1]
    `)
    expect(result).toEqual('d')
  })

  test('nested drill not a variable ref', async () => {
    const result = await execute(`
      set a = \`"unused A"\`
      set b = \`"unused B"\`
      set obj = \`{ a: { b: "c" } }\`
      extract $obj -> a -> b
    `)
    expect(result).toEqual('c')
  })

  test('wide arrow expands drill into variable', async () => {
    const result = await execute(`
      set list = \`[{a: 1}, {a: 2}]\`
      extract $list => a
    `)
    expect(result).toEqual([1, 2])
  })

  test('wide arrow expands drill into context', async () => {
    const result = await execute(`
      set list = \`[{a: 1}, {a: 2}]\`
      extract $list -> (
        extract => a
      )
    `)
    expect(result).toEqual([1, 2])
  })

  test('arrow prefix on context selector', async () => {
    // nested scope context is an element of `list`
    // `-> length` in the nested scope selects from this context
    // note: these test don't work in python vm due to
    //       use of JS-native String.prototype.length
    const result = await execute(`
      set list = \`['one','two','three']\`
      extract $list => (
        extract -> length
      )
    `)
    expect(result).toEqual([3, 3, 5])
  })

  test('make reference to context variable ($)', async () => {
    const result = await execute(`
      set list = \`['one','two','three']\`
      extract $list => {
        id: $
      }
    `)
    expect(result).toEqual([{ id: 'one' }, { id: 'two' }, { id: 'three' }])
  })

  test('thin arrow does not expand list', async () => {
    let result = await execute(`
      set list = \`[{a: 1}, {a: 2}]\`
      extract $list -> 0
    `)
    expect(result).toEqual({ a: 1 })

    result = await execute(`
      set list = \`[{a: 1}, {a: 2}]\`
      extract $list -> (
        extract -> length
      )
    `)
    expect(result).toEqual(2)
  })

  describe('json', () => {
    test('parse string', async () => {
      const result = await execute(`
        set json = \`'{"test": true }'\`
        extract $json -> @json
      `)
      expect(result).toEqual({ test: true })
    })

    test('select from value', async () => {
      const result = await execute(`
        set json = \`'{"test": true }'\`
        extract $json -> @json -> test
      `)
      expect(result).toEqual(true)
    })

    test('nested selectors', async () => {
      const result = await execute(`
        set json = \`'{"data": { "list": ["item one", "item two"] } }'\`
        extract $json -> @json -> data -> list[1]
      `)
      expect(result).toEqual('item two')
    })

    test('wide arrow expansion', async () => {
      const result = await execute(`
        set json = \`'{"data": { "list": ["item one", "item two"] } }'\`
        extract $json -> @json -> data.list => (
          extract -> length
        )
      `)
      expect(result).toEqual([8, 8])
    })
  })

  describe('html', () => {
    test('parse string', async () => {
      const result = await execute(`
        set html = \`"<html><h1>unweb</h1><html>"\`
        extract $html -> @html
      `)
      expect(result).toEqual('unweb')
    })

    test('select from doc', async () => {
      const result = await execute(`
        set html = \`"<html><h1>unweb</h1><p>welcome</p><html>"\`
        extract $html -> @html -> p
      `)
      expect(result).toEqual('welcome')
    })

    test('css parsing error @selsyn', () => {
      const result = execute(`
        set html = \`'<div>test</div>'\`
        extract $html -> @html -> p/*&@#^
      `)
      expect(result).rejects.toBeInstanceOf(RuntimeError)
      return expect(result).rejects.toMatchInlineSnapshot(
        `[SelectorSyntaxError: Could not parse CSS selector 'p/*&@#^']`
      )
    })

    test('nested selectors', async () => {
      const result = await execute(`
        set html = \`"<html><h1>unweb</h1><ul><li>item one</li><li>item two</li></ul><html>"\`
        extract $html -> @html -> ul -> li:nth-child(2)
      `)
      expect(result).toEqual('item two')
    })

    test('xpath selector', async () => {
      const result = await execute(`
        set html = \`"<html><h1>unweb</h1><p class='intro'>welcome</p><html>"\`
        extract $html -> @html -> xpath://p/@class
      `)
      expect(result).toEqual('intro')
    })

    test('xpath parsing error @selsyn', async () => {
      const result = execute(`
        set html = \`'<div>test</div>'\`
        extract $html -> @html -> xpath:p/*&@#^
      `)
      // expect(result).rejects.toBeInstanceOf(RuntimeError)
      return expect(result).rejects.toMatchInlineSnapshot(
        `[SelectorSyntaxError: Could not parse XPath selector 'p/*&@#^']`
      )
    })

    test('wide arrow expansion', async () => {
      const result = await execute(`
        set html = \`"<html><h1>unweb</h1><ul><li>item one</li><li>item two</li></ul><html>"\`
        extract $html -> @html => ul li
      `)
      expect(result).toEqual(['item one', 'item two'])
    })

    test('drilling into items in an expanded lists', async () => {
      const result = await execute(`
        set html = \`"<html><h1>unweb</h1><ul><li>item <span>one</span></li><li>item <span>two</span></li></ul><html>"\`
        extract $html -> @html => ul li -> span
      `)
      expect(result).toEqual(['one', 'two'])
    })
  })

  describe('js ast', () => {
    test('parse string', async () => {
      const result = await execute(`
        set js = \`'var a = 2;'\`
        extract $js -> @js -> Literal
      `)
      expect(result).toEqual(2)
    })

    test('select from tree', async () => {
      const result = await execute(`
        set js = \`'var a = 2;'\`
        set ast = $js -> @js
        set descend = $ast -> VariableDeclaration Literal
        set child = $ast -> VariableDeclarator > Literal
        extract { $descend, $child }
      `)
      expect(result.descend).toEqual(2)
      expect(result.child).toEqual(2)
    })

    test('esquery parsing error @selsyn', () => {
      const result = execute(`
        set js = \`'console.log(1 + 2)'\`
        extract $js -> @js -> Litera#$*& ><<>F
      `)
      expect(result).rejects.toBeInstanceOf(RuntimeError)
      return expect(result).rejects.toMatchInlineSnapshot(
        `[SelectorSyntaxError: Could not parse AST selector 'Litera#$*& ><<>F']`
      )
    })

    test('select non-literal from tree throws conversion error', () => {
      const result = execute(`
        set js = \`'var a = 2;'\`
        extract $js -> @js -> Identifier
      `)
      expect(result).rejects.toBeInstanceOf(RuntimeError)
      return expect(result).rejects.toMatchInlineSnapshot(
        `[ConversionError: Attempted to convert unsupported type to value: Identifier]`
      )
    })

    test('nested selector', async () => {
      const result = await execute(`
        set js = \`'var a = 501;'\`
        extract $js -> @js -> VariableDeclarator -> Literal
      `)
      expect(result).toEqual(501)
    })

    test('wide arrow expansion', async () => {
      const result = await execute(`
        set js = \`'var a = 501; var x = "many"'\`
        extract $js -> @js => Literal
      `)
      expect(result).toEqual([501, 'many'])
    })
  })

  describe('cookies', () => {
    test('parse string', async () => {
      const result = await execute(`
        set cookies = \`"gt=1326368972816650241; Max-Age=10800; Domain=.twitter.com; Path=/; Secure"\`
        extract $cookies -> @cookies
      `)
      expect(result).toEqual({ gt: '1326368972816650241' })
    })

    test('select from cookie set', async () => {
      const result = await execute(`
        set cookies = \`"gt=1326368972816650241; Max-Age=10800; Domain=.twitter.com; Path=/; Secure"\`
        extract $cookies -> @cookies -> gt
      `)
      expect(result).toEqual('1326368972816650241')
    })
  })

  test('parse/select chaining', async () => {
    /* eslint-disable prefer-template */
    const slice = () => {
      const cookie =
        'patientZero=501; Max-Age=10800; Domain=.unweb.com; Path=/; Secure'
      const literal = '&lt;p cooked=' + cookie + '&gt;attr&lt;/p&gt;'
      const docHtml =
        '<!doctype html><h1>test</h1><pre>var a = ' +
        JSON.stringify(literal) +
        '</pre>'
      const obj = { docHtml }
      return JSON.stringify(obj)
    }
    /* eslint-enable prefer-template */

    const src = `
      set all = \`(${slice.toString()})()\`
      extract $all
        -> @json -> docHtml
        -> @html -> pre
        -> @js -> Literal
        -> @html -> xpath://p/@cooked
        -> @cookies -> patientZero
    `

    const result = await execute(src)
    expect(result).toEqual('501')
  })

  describe('optional v required', () => {
    test('error when html selector fails to locate', async () => {
      let err
      try {
        await execute(`
          set html = \`'<div>test</div>'\`
          extract $html -> @html -> p
        `)
      } catch (e) {
        err = e
      }
      expect(err).toMatchInlineSnapshot(
        `[NullSelectionError: The selector 'p' did not produce a result]`
      )
      expect(err).toBeInstanceOf(RuntimeError)
    })

    test('error when json selector fails to locate', async () => {
      let err
      try {
        await execute(`
          set val = \`{x: 1}\`
          extract $val -> y
        `)
      } catch (e) {
        err = e
      }
      expect(err).toMatchInlineSnapshot(
        `[NullSelectionError: The selector 'y' did not produce a result]`
      )
      expect(err).toBeInstanceOf(RuntimeError)
    })

    test('null, zero, or empty string are valid', async () => {
      const result = await execute(`
        set o = \`return {"nul":null,"num":0,"str":""}\`
        extract {
          nul: $o -> nul
          num: $o -> num
          str: $o -> str
        }
      `)
      expect(result).toEqual({ nul: null, num: 0, str: '' })
    })

    test('optional value selection', async () => {
      const result = await execute(`
        set json = \`{ x: 'test' }\`
        extract {
          x: $json -> x
          opt?: $json -> a -> b -> c
        }
      `)
      expect(result).toEqual({ x: 'test' })
    })

    test('optional html selection', async () => {
      const result = await execute(`
        set html = \`'<div>test</div>'\` -> @html
        extract {
          el?: $html -> p
        }
      `)
      expect(result).toEqual({})
    })

    test('optional html selection chaining', async () => {
      const result = await execute(`
        set html = \`'<div>test</div>'\` -> @html
        extract {
          el?: $html -> p -> span
        }
      `)
      expect(result).toEqual({})
    })

    test('optional js selection', async () => {
      const result = await execute(`
        set js = \`'const test = {};'\` -> @js
        extract {
          val?: $js -> Literal
        }
      `)
      expect(result).toEqual({})
    })

    test('optional headers and cookies selection', async () => {
      const requestFn = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>()
      requestFn.mockResolvedValue({
        status: 200,
        headers: new Headers({
          // 'set-cookie':
          //   'session=jZDE5MDBhNzczNDMzMTk4; Domain=.example.com; Path=/; Expires=Tue, 16 Jun 2026 07:31:59 GMT; Secure',
        }),
        body: '<!doctype html><h1>test</h1>',
      })
      const result = await execute(
        `
        GET https://example.com

        extract {
          hdr?: @headers -> content-type
          cki?: @cookies -> gt
        }
      `,
        {},
        requestFn
      )
      expect(result).toEqual({})
    })

    test('complex drill bits are null for optionals', async () => {
      const result = await execute(`
        set null = \`null\`
        extract {
          test?: $null -> { a }
        }
      `)
      // i.e. does not equal { test: { a: ... } }
      expect(result).toEqual({})
    })
  })

  test('idempotency', () => {
    testIdempotency().forEach(({ a, b }) => expect(a).toEqual(b))
  })
})
