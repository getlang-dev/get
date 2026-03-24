import { describe, expect, test } from 'bun:test'
import { ValueTypeError } from '@getlang/lib/errors'
import { execute } from './helpers.js'

describe('optionality', () => {
  describe('ternary', () => {
    test('true branch', async () => {
      const result = await execute(`
        extract 12 ? 34 : 56
      `)
      expect(result).toEqual(34)
    })
    test('false branch', async () => {
      const result = await execute(`
        extract |undefined| ? 34 : 56
      `)
      expect(result).toEqual(56)
    })
  })

  describe('ternary drill', () => {
    test('true branch', async () => {
      const result = await execute(`
        extract "<p>para</p>" -> @html -> p ?: i
      `)
      expect(result).toEqual('para')
    })
    test('false branch', async () => {
      const result = await execute(`
        extract "<i>ital</i>" -> @html -> p ?: i
      `)
      expect(result).toEqual('ital')
    })
  })

  test('type matching', async () => {
    const result = execute(`
      extract 12 ? { a: true } : { b: false }
    `)
    return expect(result).rejects.toThrow(
      new ValueTypeError(
        'Test expression type mismatch: { a: value; } !== { b: value; }',
      ),
    )
  })
})
