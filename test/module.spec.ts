import { vi } from 'vitest'
import { execute, testIdempotency } from './helpers'
import { RuntimeError } from '../src'

afterEach(() => {
  vi.clearAllMocks()
})

describe('getlang modules', () => {
  test('extract', async () => {
    const src = 'extract `501`'
    const result = await execute(src)
    expect(result).toEqual(501)
  })

  test('syntax error', async () => {
    const src = `
      GET https://test.com

      extrct { title }
    `

    let err
    try {
      await execute(src)
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toEqual(
      'SyntaxError: Invalid token at line 4 col 7:\n\n2  \n3        extrct { title }\n4      \n         ^'
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

    test('required input missing', async () => {
      const src = `
        inputs { value }
        extract $value
      `
      let err
      try {
        await execute(src)
      } catch (e) {
        err = e
      }

      expect(err).toBeInstanceOf(RuntimeError)
      expect(err).toMatchInlineSnapshot(
        `[NullInputError: Required input 'value' not provided]`
      )
    })

    test('optional input', async () => {
      const src = `
        inputs { value? }
        extract $value
      `
      const result = await execute(src)
      // does not throw error
      expect(result).toBeUndefined()
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
    const importHook = vi.fn(() => 'extract { token: `"abc"` }')
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
    const importHook = vi.fn(async (module: string) => {
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

  test('idempotency', () => {
    testIdempotency().forEach(({ a, b }) => expect(a).toEqual(b))
  })
})
