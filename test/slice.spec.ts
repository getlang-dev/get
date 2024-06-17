import { RuntimeError } from '../src/errors'
import { execute, testIdempotency } from './helpers'

describe('slice', () => {
  it('evaluates javascript with implicit return', async () => {
    const result = await execute('extract `1 + 2`')
    expect(result).toEqual(3)
  })

  it('has access to script variables', async ({ expect }) => {
    const result = await execute(
      `
      inputs { id, foo = \`[1]\` }

      set bar = \`['x']\`
      set baz = \`{ id, foo, bar }\`

      extract { $baz }
    `,
      { id: '123' }
    )
    expect(result).toEqual({
      baz: {
        id: '123',
        foo: [1],
        bar: ['x'],
      },
    })
  })

  it('can reference and convert variables from outer scope', async () => {
    // note: the slice is statically analyzed to find which script variables
    // are used, and converts only those to values. Any unused and incompatible
    // variables should not cause ConversionError's (ie the BinaryExpression)
    const result = await execute(
      `
        set js = \`'5 + 1'\`
        set x = $js -> @js -> BinaryExpression
        set y = $js -> @js -> Literal
        set out = (
          extract {
            greet: \`'hi there ' + y\`
          }
        )
        extract $out
      `
    )

    expect(result).toEqual({
      greet: 'hi there 5',
    })
  })

  it('supports escaped backticks', async () => {
    const result = await execute('extract `\\`escaped\\``')
    expect(result).toEqual('escaped')
  })

  it('triple backticks as delimiter allow non-escaped backticks', async () => {
    const result = await execute('extract ```return `escaped````')
    expect(result).toEqual('escaped')
  })

  it('supports analysis on nested slices', async () => {
    const result = await execute(`
      set x = \`0\`

      extract $x -> (
        set y = \`1\`
        extract $y
      )
    `)
    expect(result).toEqual(1)
  })

  describe('errors', () => {
    test.skip('parsing', async () => {
      const result = execute(`
        extract \`{ a: "b" \`
      `)

      // expect(result).rejects.toMatchInlineSnapshot()
      expect(result).rejects.toBeInstanceOf(RuntimeError)
    })

    test('running', async () => {
      const result = execute(`
        extract \`({}).no.no.yes\`
      `)

      expect(result).rejects.toMatchInlineSnapshot(
        `[SliceError: An exception was thrown by the client-side slice]`
      )
      expect(result).rejects.toBeInstanceOf(RuntimeError)
    })
  })

  test('idempotency', () => {
    testIdempotency().forEach(({ a, b }) => expect(a).toEqual(b))
  })
})
