import { describe, expect, test } from 'bun:test'
import type { Modifier } from '@getlang/utils'
import { invariant } from '@getlang/utils'
import { ValueTypeError } from '@getlang/utils/errors'
import type { ExecuteOptions } from './helpers.js'
import { execute as exec } from './helpers.js'

function execute(source: string, name: string, modifier: Modifier) {
  const opts: ExecuteOptions = {
    modifier(mod) {
      expect(mod).toEqual(name)
      return { modifier }
    },
  }
  return exec(source, {}, opts)
}

describe('modifiers', () => {
  test('hook', async () => {
    const result = await execute('extract @rnd', 'rnd', () => 300)
    expect(result).toEqual(300)
  })

  test('with context', async () => {
    const result = await execute(
      'extract `1` -> @add_one',
      'add_one',
      (ctx: number) => {
        invariant(
          typeof ctx === 'number',
          new ValueTypeError('@add_one expects number context'),
        )
        return ctx + 1
      },
    )
    expect(result).toEqual(2)
  })

  test('with args', async () => {
    const result = await execute(
      'extract @product({ a: `7`, b: `6` })',
      'product',
      (_ctx, { a, b }) => {
        invariant(
          typeof a === 'number' && typeof b === 'number',
          new ValueTypeError('@product expects two numbers'),
        )
        return a * b
      },
    )
    expect(result).toEqual(42)
  })
})
