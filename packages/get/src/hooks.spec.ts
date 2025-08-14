import { describe, expect, mock, test } from 'bun:test'
import type { Hooks } from '@getlang/utils'
import { invariant } from '@getlang/utils'
import { execute } from './index.js'

describe('hook', () => {
  test('on request', async () => {
    const src = `
      GET http://get.com
      Accept: text/html

      extract -> h1
    `

    const requestHook = mock<Hooks['request']>(async () => ({
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: '<!doctype html><h1>test</h1>',
    }))

    const result = await execute(src, {}, { request: requestHook })

    expect(requestHook).toHaveBeenCalledWith('http://get.com/', {
      method: 'GET',
      headers: expect.headers(
        new globalThis.Headers({
          Accept: 'text/html',
        }),
      ),
    })
    expect(result).toEqual('test')
  })

  test('on slice', async () => {
    const sliceHook = mock<Hooks['slice']>(() => 3)

    const result = await execute('extract `1 + 2`', {}, { slice: sliceHook })

    expect(sliceHook).toHaveBeenCalledWith('return 1 + 2', {}, {})
    expect(result).toEqual(3)
  })

  test('on import (cached) and call', async () => {
    const modules: Record<string, string> = {
      Top: `extract \`"top"\``,
      Mid: `
        set inputA = \`"bar"\`
        extract {
          topValue: @Top({ $inputA })
          midValue: \`"mid"\`
        }
      `,
    }

    const importHook = mock<Hooks['import']>(async (module: string) => {
      const src = modules[module]
      invariant(src, `Unexpected import: ${module}`)
      return src
    })

    const src = `
      set inputA = \`"foo"\`

      extract {
        topValue: @Top({ $inputA })
        midValue: @Mid
        botValue: \`"bot"\`
      }
    `

    const hooks = { import: importHook }
    const result = await execute(src, {}, hooks)

    expect(result).toEqual({
      topValue: 'top',
      midValue: {
        topValue: 'top',
        midValue: 'mid',
      },
      botValue: 'bot',
    })

    expect(importHook).toHaveBeenCalledTimes(2)
    expect(importHook).toHaveBeenNthCalledWith(1, 'Top')
    expect(importHook).toHaveBeenNthCalledWith(2, 'Mid')
  })
})

expect.extend({
  headers(received: unknown, expected: Headers) {
    if (!(received instanceof Headers)) {
      return {
        message: () => 'expected headers object',
        pass: false,
      }
    }

    const pass = this.equals(
      Object.fromEntries(received as any),
      Object.fromEntries(expected as any),
    )

    const message = () => 'todo'
    return { pass, message }
  },
})
