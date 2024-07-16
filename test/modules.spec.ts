import { describe, test, mock, expect } from 'bun:test'
import { NullInputError } from '@getlang/lib'
import { helper } from './helpers.js'

const { execute, testIdempotency } = helper()

describe('modules', () => {
  test('extract', async () => {
    const src = 'extract `501`'
    const result = await execute(src)
    expect(result).toEqual(501)
  })

  test('syntax error', () => {
    expect(() => {
      execute(`
        GET https://test.com

        extrct { title }
      `)
    }).toThrow(
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

  test('imports', async () => {
    const importHook = mock(() => 'extract { token: `"abc"` }')
    const src = `
      import Auth
      extract { auth: $Auth() }
    `
    const result = await execute(src, {}, { import: importHook })

    expect(result).toEqual({
      auth: {
        token: 'abc',
      },
    })
    expect(importHook).toHaveBeenCalledWith('Auth')
  })

  test('imports cache', async () => {
    const importHook = mock(async (module: string) => {
      if (module === 'Top') return `extract \`"top"\``
      if (module === 'Mid')
        return `
        import Top
        set inputA = \`"foo"\`
        extract {
          topValue: $Top({ $inputA })
          midValue: \`"mid"\`
        }
      `
      throw new Error(`Unexpected import: ${module}`)
    })

    const src = `
      import Top
      import Mid

      set inputA = \`"foo"\`

      extract {
        topValue: $Top({ $inputA })
        midValue: $Mid()
        botValue: \`"bot"\`
      }
    `

    const result = await execute(src, {}, { import: importHook })

    // Top should only importHook & execute once
    // FIXME: asserting on importHook doesn't fully assert the module wasn't re-run
    //        e.g. if the runtime caches the source string result of `importHook`
    //        (which it currently doesn't)
    expect(importHook).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      topValue: 'top',
      midValue: {
        topValue: 'top',
        midValue: 'mid',
      },
      botValue: 'bot',
    })
  })

  test('variables', async () => {
    const result = await execute(`
      set x = \`{ test: true }\`
      extract $x
    `)
    expect(result).toEqual({ test: true })
  })

  test('func scope with context', async () => {
    const result = await execute(`
      set x = \`{ test: true }\`
      extract $x -> ( extract $ )
    `)
    expect(result).toEqual({ test: true })
  })

  test('func scope with closures', async () => {
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
