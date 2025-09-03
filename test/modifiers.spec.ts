import { describe, expect, test } from 'bun:test'
import type { Modifier } from '@getlang/lib'
import { invariant } from '@getlang/lib'
import { ValueTypeError } from '@getlang/lib/errors'
import { execute as exec } from './helpers.js'

function execute(
  source: string | Record<string, string>,
  name: string,
  modifier: Modifier,
) {
  return exec(
    source,
    {},
    {
      modifier(mod) {
        expect(mod).toEqual(name)
        return { modifier }
      },
    },
  )
}

describe('modifiers', () => {
  test('hook', async () => {
    const result = await execute('extract @rnd', 'rnd', () => 300)
    expect(result).toEqual(300)
  })

  test('with context', async () => {
    const result = await execute(
      'extract 1 -> @add_one',
      'add_one',
      (ctx: number) => {
        expect(ctx).toEqual(1)
        return ctx + 1
      },
    )
    expect(result).toEqual(2)
  })

  test('with args', async () => {
    const result = await execute(
      'extract @product({ a: 7, b: 6 })',
      'product',
      (_ctx, { a, b }) => {
        invariant(
          typeof a === 'number' && typeof b === 'number',
          new ValueTypeError('@product expects two numbers'),
        )
        expect(a).toEqual(7)
        expect(b).toEqual(6)
        return a * b
      },
    )
    expect(result).toEqual(42)
  })

  test('in macros', async () => {
    const result = await execute(
      {
        MyMacro: `extract @add_ten`,
        Home: `extract 4 -> @MyMacro`,
      },
      'add_ten',
      function mymod(ctx: number) {
        expect(ctx).toEqual(4)
        return ctx + 10
      },
    )
    expect(result).toEqual(14)
  })

  test('in macros, arrow function', async () => {
    const result = await execute(
      {
        MyMacro: `extract @add_ten`,
        Home: `extract 4 -> @MyMacro`,
      },
      'add_ten',
      (ctx: number) => {
        expect(ctx).toEqual(4)
        return ctx + 10
      },
    )
    expect(result).toEqual(14)
  })
})
