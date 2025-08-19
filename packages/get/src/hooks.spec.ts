import { describe, expect, mock, test } from 'bun:test'
import type {
  CallHook,
  ExtractHook,
  Hooks,
  ImportHook,
  RequestHook,
  SliceHook,
} from '@getlang/utils'
import { invariant } from '@getlang/utils'
import { execute } from './index.js'

describe('hook', () => {
  test('on request', async () => {
    const src = `
      GET http://get.com
      Accept: text/html

      extract -> h1
    `

    const requestHook = mock<RequestHook>(async () => ({
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
    const sliceHook = mock<SliceHook>(() => 3)

    const result = await execute('extract `1 + 2`', {}, { slice: sliceHook })

    expect(sliceHook).toHaveBeenCalledWith('return 1 + 2', {}, {})
    expect(result).toEqual(3)
  })

  test('module lifecycle', async () => {
    const modules: Record<string, string> = {
      Top: `
        inputs { inputA }
        extract { value: \`"top::" + inputA\` }
      `,
      Mid: `
        set inputA = \`"bar"\`
        extract {
          value: {
            topValue: @Top({ $inputA }) -> value
            midValue: \`"mid"\`
          }
        }
      `,
    }

    const src = `
      set inputA = \`"foo"\`

      extract {
        topValue: @Top({ $inputA }) -> value
        midValue: @Mid -> value
        botValue: \`"bot"\`
      }
    `

    const hooks: Hooks = {
      import: mock<ImportHook>(async (module: string) => {
        const src = modules[module]
        invariant(src, `Unexpected import: ${module}`)
        return src
      }),
      call: mock<CallHook>(() => {}),
      extract: mock<ExtractHook>(() => {}),
    }
    const result = await execute(src, {}, hooks)

    expect(result).toEqual({
      topValue: 'top::foo',
      midValue: {
        topValue: 'top::bar',
        midValue: 'mid',
      },
      botValue: 'bot',
    })

    expect(hooks.import).toHaveBeenCalledTimes(2)
    expect(hooks.import).toHaveBeenNthCalledWith(1, 'Top')
    expect(hooks.import).toHaveBeenNthCalledWith(2, 'Mid')

    expect(hooks.call).toHaveBeenCalledTimes(3)
    expect(hooks.call).toHaveBeenNthCalledWith(1, 'Top', { inputA: 'foo' })
    expect(hooks.call).toHaveBeenNthCalledWith(2, 'Mid', {})
    expect(hooks.call).toHaveBeenNthCalledWith(3, 'Top', { inputA: 'bar' })

    expect(hooks.extract).toHaveBeenCalledTimes(3)
    expect(hooks.extract).toHaveBeenNthCalledWith(
      1,
      'Top',
      { inputA: 'foo' },
      { value: 'top::foo' },
    )
    expect(hooks.extract).toHaveBeenNthCalledWith(
      2,
      'Top',
      { inputA: 'bar' },
      { value: 'top::bar' },
    )
    expect(hooks.extract).toHaveBeenNthCalledWith(
      3,
      'Mid',
      {},
      {
        value: {
          topValue: 'top::bar',
          midValue: 'mid',
        },
      },
    )
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
