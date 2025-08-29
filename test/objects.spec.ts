import { describe, expect, test } from 'bun:test'
import { execute } from './helpers.js'

describe('objects', () => {
  test('inline', async () => {
    const result = await execute('extract { x: `"object"` }')
    expect(result).toEqual({ x: 'object' })
  })

  test('variable', async () => {
    const result = await execute(`
      set x = { test: |true| }
      extract $x
    `)
    expect(result).toEqual({ test: true })
  })

  test('variable ref', async () => {
    const result = await execute(`
      set x = |"varref"|
      extract { x: $x }
    `)
    expect(result).toEqual({ x: 'varref' })
  })

  test('variable ref shorthand', async () => {
    const result = await execute(`
      set x = |"varref"|
      extract { $x }
    `)
    expect(result).toEqual({ x: 'varref' })
  })

  test('variable combination', async () => {
    const result = await execute(`
      set foo = |"foo"|
      set bar = |"bar"|
      extract {
        $foo,
        bar: $bar
        baz: |"baz"|
        xyz: $foo
      }
    `)

    expect(result).toEqual({
      foo: 'foo',
      bar: 'bar',
      baz: 'baz',
      xyz: 'foo',
    })
  })

  test('nested inline', async () => {
    const result = await execute(`
      extract {
        pos: |"outer"|,
        value: {
          pos: |"inner"|
        }
      }
    `)
    expect(result).toEqual({
      pos: 'outer',
      value: {
        pos: 'inner',
      },
    })
  })

  test('nested variable ref shorthand', async () => {
    const result = await execute(`
      set value = { pos: |"inner"| }
      extract {
        pos: |"outer"|,
        $value
      }
    `)
    expect(result).toEqual({
      pos: 'outer',
      value: {
        pos: 'inner',
      },
    })
  })
})
