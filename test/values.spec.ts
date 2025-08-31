import { describe, expect, test } from 'bun:test'
import {
  ConversionError,
  NullSelectionError,
  SelectorSyntaxError,
} from '@getlang/utils/errors'
import { execute, SELSYN } from './helpers.js'

describe('values', () => {
  test('into JS object', async () => {
    const result = await execute(`
      set obj = |{ a: "b" }|
      extract $obj -> a
    `)
    expect(result).toEqual('b')
  })

  test('unbound drills can be variable ref', async () => {
    const result = await execute(`
      set x = |{ a: "b" }|
      extract $x -> a
    `)
    expect(result).toEqual('b')
  })

  test('nested drills into JSON', async () => {
    const result = await execute(`
      set x = |{ a: { b: ["c", "d"] } }|
      extract $x -> a -> b[1]
    `)
    expect(result).toEqual('d')
  })

  test('nested drill not a variable ref', async () => {
    const result = await execute(`
      set a = |"unused A"|
      set b = |"unused B"|
      set obj = |{ a: { b: "c" } }|
      extract $obj -> a -> b
    `)
    expect(result).toEqual('c')
  })

  test('wide arrow expands drill into variable', async () => {
    const result = await execute(`
      set list = |[{a: 1}, {a: 2}]|
      extract $list => $ -> a
    `)
    expect(result).toEqual([1, 2])
  })

  test('wide arrow expands drill into context', async () => {
    const result = await execute(`
      set list = |[{a: 1}, {a: 2}]|
      extract $list => $ -> (
        extract a
      )
    `)
    expect(result).toEqual([1, 2])
  })

  test('arrow prefix on context selector', async () => {
    // nested scope context is an element of `list`
    // `n` in the nested scope selects from this context
    const result = await execute(`
      set list = |[{n:'one'},{n:'two'},{n:'three'}]|
      extract $list => $ -> (
        extract n
      )
    `)
    expect(result).toEqual(['one', 'two', 'three'])
  })

  test('make reference to context variable ($)', async () => {
    const result = await execute(`
      set list = |['one','two','three']|
      extract $list => $ -> {
        id: $
      }
    `)
    expect(result).toEqual([{ id: 'one' }, { id: 'two' }, { id: 'three' }])
  })

  test('thin arrow does not expand list', async () => {
    let result = await execute(`
      set list = |[{a: 1}, {a: 2}]|
      extract $list -> 0
    `)
    expect(result).toEqual({ a: 1 })

    result = await execute(`
      set list = |[{a: 1}, {a: 2}]|
      extract $list -> (
        extract [1].a
      )
    `)
    expect(result).toEqual(2)
  })

  test('list of lists', async () => {
    const result = await execute(`
        set data = |[ {list: [{n: "one"}, {n: "two"}]}, {list: [{n: "three"}, {n: "four"}]} ]|
        extract $data => $ => list -> n
      `)

    expect(result).toEqual([
      ['one', 'two'],
      ['three', 'four'],
    ])
  })

  test('values not closed until final extract stmt', async () => {
    const result = await execute(`
        set fn_out = (
          set html = |"<html><h1>unweb</h1><html>"|
          extract {
            doc: $html -> @html
          }
        )
        extract $fn_out -> doc -> h1
      `)
    expect(result).toEqual('unweb')
  })

  describe('json', () => {
    test('parse string', async () => {
      const result = await execute(`
        set json = |'{"test": true }'|
        extract $json -> @json
      `)
      expect(result).toEqual({ test: true })
    })

    test('select from value', async () => {
      const result = await execute(`
        set json = |'{"test": true }'|
        extract $json -> @json -> test
      `)
      expect(result).toEqual(true)
    })

    test('nested selectors', async () => {
      const result = await execute(`
        set json = |'{"data": { "list": ["item one", "item two"] } }'|
        extract $json -> @json -> data -> list[1]
      `)
      expect(result).toEqual('item two')
    })

    test('wide arrow expansion', async () => {
      const result = await execute(`
        set json = |'{"data": { "list": [{"name": "item one"}, {"name": "item two"}] } }'|
        extract $json -> @json => data.list -> (
          extract name
        )
      `)
      expect(result).toEqual(['item one', 'item two'])
    })
  })

  describe('html', () => {
    test('parse string', async () => {
      const result = await execute(`
        set html = |"<html><h1>unweb</h1><html>"|
        extract $html -> @html
      `)
      expect(result).toEqual('unweb')
    })

    test('select from doc', async () => {
      const result = await execute(`
        set html = |"<html><h1>unweb</h1><p>welcome</p><html>"|
        extract $html -> @html -> p
      `)
      expect(result).toEqual('welcome')
    })

    test.if(SELSYN)('css parsing error', () => {
      const result = execute(`
        set html = |'<div>test</div>'|
        extract $html -> @html -> p/*&@#^
      `)
      return expect(result).rejects.toThrow(
        new SelectorSyntaxError('CSS', 'p/*&@#^'),
      )
    })

    test('nested selectors', async () => {
      const result = await execute(`
        set html = |"<html><h1>unweb</h1><ul><li>item one</li><li>item two</li></ul><html>"|
        extract $html -> @html -> ul -> li:nth-child(2)
      `)
      expect(result).toEqual('item two')
    })

    test('xpath selector', async () => {
      const result = await execute(`
        set html = |"<html><h1>unweb</h1><p class='intro'>welcome</p><html>"|
        extract $html -> @html -> xpath://p/@class
      `)
      expect(result).toEqual('intro')
    })

    test.if(SELSYN)('xpath parsing error', async () => {
      const result = execute(`
        set html = |'<div>test</div>'|
        extract $html -> @html -> xpath:p/*&@#^
      `)
      return expect(result).rejects.toThrow(
        new SelectorSyntaxError('XPath', 'p/*&@#^'),
      )
    })

    test('wide arrow expansion', async () => {
      const result = await execute(`
        set html = |"<html><h1>unweb</h1><ul><li>item one</li><li>item two</li></ul><html>"|
        extract $html -> @html => ul li
      `)
      expect(result).toEqual(['item one', 'item two'])
    })

    test('drilling into items in an expanded lists', async () => {
      const result = await execute(`
        set html = |"<html><h1>unweb</h1><ul><li>item <span>one</span></li><li>item <span>two</span></li></ul><html>"|
        extract $html -> @html => ul li -> span
      `)
      expect(result).toEqual(['one', 'two'])
    })
  })

  describe('js ast', () => {
    test('parse string', async () => {
      const result = await execute(`
        set js = |'var a = 2;'|
        extract $js -> @js -> Literal
      `)
      expect(result).toEqual(2)
    })

    test('select from tree', async () => {
      const result = await execute(`
        set js = |'var a = 2;'|
        set ast = $js -> @js
        set descend = $ast -> VariableDeclaration Literal
        set child = $ast -> VariableDeclarator > Literal
        extract { $descend, $child }
      `)
      expect(result.descend).toEqual(2)
      expect(result.child).toEqual(2)
    })

    test.if(SELSYN)('esquery parsing error', () => {
      const result = execute(`
        set js = |'console.log(1 + 2)'|
        extract $js -> @js -> Litera#$*& ><<>F
      `)
      return expect(result).rejects.toThrow(
        new SelectorSyntaxError('AST', 'Litera#$*& ><<>F'),
      )
    })

    test('select non-literal from tree throws conversion error', () => {
      const result = execute(`
        set js = |'var a = 2;'|
        extract $js -> @js -> Identifier
      `)
      return expect(result).rejects.toThrow(new ConversionError('Identifier'))
    })

    test('nested selector', async () => {
      const result = await execute(`
        set js = |'var a = 501;'|
        extract $js -> @js -> VariableDeclarator -> Literal
      `)
      expect(result).toEqual(501)
    })

    test('wide arrow expansion', async () => {
      const result = await execute(`
        set js = |'var a = 501; var x = "many"'|
        extract $js -> @js => Literal
      `)
      expect(result).toEqual([501, 'many'])
    })
  })

  test('headers', async () => {
    const headers = new Headers({
      foo: 'bar',
      baz: 'quux',
    })
    headers.append('baz', 'qaax')

    const result = await execute(
      `
        GET https://example.com

        extract {
          all: @headers
          one: @headers -> foo
          many_as_one: @headers -> baz
          many_as_many: @headers => baz
        }
      `,
      {},
      () => new Response('<!doctype html><h1>test</h1>', { headers }),
    )
    expect(result).toEqual({
      all: expect.objectContaining({
        foo: 'bar',
        baz: 'quux, qaax',
      }),
      one: 'bar',
      many_as_one: 'quux, qaax',
      many_as_many: ['quux', 'qaax'],
    })
  })

  describe('cookies', () => {
    test('parse string', async () => {
      const result = await execute(`
        set cookies = |"gt=1326368972816650241; Max-Age=10800; Domain=.twitter.com; Path=/; Secure"|
        extract $cookies -> @cookies
      `)
      expect(result).toEqual({ gt: '1326368972816650241' })
    })

    test('select from cookie set', async () => {
      const result = await execute(`
        set cookies = |"gt=1326368972816650241; Max-Age=10800; Domain=.twitter.com; Path=/; Secure"|
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
      const literal = `&lt;p cooked=${cookie}&gt;attr&lt;/p&gt;`
      const docHtml = `<!doctype html><h1>test</h1><pre>var a = ${JSON.stringify(literal)}</pre>`
      const obj = { docHtml }
      return JSON.stringify(obj)
    }
    /* eslint-enable prefer-template */

    const src = `
      set all = |(${slice.toString()})()|
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
    test('error when html selector fails to locate', () => {
      const result = execute(`
        set html = |'<div>test</div>'|
        extract $html -> @html -> p
      `)
      return expect(result).rejects.toThrow(new NullSelectionError('p'))
    })

    test('error when json selector fails to locate', () => {
      const result = execute(`
        set val = |{x: 1}|
        extract $val -> y
      `)
      return expect(result).rejects.toThrow(new NullSelectionError('y'))
    })

    test('null, zero, or empty string are valid', async () => {
      const result = await execute(`
        set o = |return {"nul":null,"num":0,"str":""}|
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
        set json = |{ x: 'test' }|
        extract {
          x: $json -> x
          opt?: $json -> a -> b -> c
        }
      `)
      expect(result).toEqual({ x: 'test' })
    })

    test('optional html selection', async () => {
      const result = await execute(`
        set html = |'<div>test</div>'| -> @html
        extract {
          el?: $html -> p
        }
      `)
      expect(result).toEqual({})
    })

    test('optional html selection chaining', async () => {
      const result = await execute(`
        set html = |'<div>test</div>'| -> @html
        extract {
          el?: $html -> p -> span
        }
      `)
      expect(result).toEqual({})
    })

    test('optional js selection', async () => {
      const result = await execute(`
        set js = |'const test = {};'| -> @js
        extract {
          val?: $js -> Literal
        }
      `)
      expect(result).toEqual({})
    })

    test('optional headers and cookies selection', async () => {
      const src = `
        GET https://example.com

        extract {
          hdr?: @headers -> transfer-encoding
          cki?: @cookies -> gt
        }
      `
      const result = await execute(
        src,
        {},
        () => new Response('<!doctype html><h1>test</h1>'),
      )
      expect(result).toEqual({})
    })

    test('complex drill bits are dropped for optionals', async () => {
      const result = await execute(`
        inputs { undefined? }
        extract {
          test?: $undefined -> { a }
        }
      `)
      // i.e. does not equal { test: { a: ... } }
      expect(result).toEqual({})
    })
  })
})
