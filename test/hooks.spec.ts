import { describe, expect, mock, test } from 'bun:test'
import type {
  CallHook,
  ExtractHook,
  Hooks,
  ImportHook,
  RequestHook,
  SliceHook,
} from '@getlang/lib'
import { invariant } from '@getlang/lib'
import { execute } from './helpers.js'

describe('hook', () => {
  test('on request', async () => {
    const src = `
      GET http://get.com
      Accept: text/html

      extract -> h1
    `

    const request = mock<RequestHook>(async () => ({
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: '<!doctype html><h1>test</h1>',
    }))

    const result = await execute(src, {}, { hooks: { request } })

    expect(request).toHaveServed('http://get.com/', {
      method: 'GET',
      headers: new Headers({
        Accept: 'text/html',
      }),
    })
    expect(result).toEqual('test')
  })

  test('on slice', async () => {
    const slice = mock<SliceHook>(() => 3)
    const result = await execute('extract `1 + 2`', {}, { hooks: { slice } })
    expect(slice).toHaveBeenCalledWith('return 1 + 2;;', undefined)
    expect(result).toEqual(3)
  })

  test('module lifecycle', async () => {
    const modules: Record<string, string> = {
      Top: `
        inputs { inputA }
        extract { value: |"top::" + inputA| }
      `,
      Mid: `
        set inputA = |"bar"|
        extract {
          value: {
            topValue: @Top({ $inputA }) -> value
            midValue: |"mid"|
          }
        }
      `,
      Home: `
        set inputA = |"foo"|

        extract {
          topValue: @Top({ $inputA }) -> value
          midValue: @Mid -> value
          botValue: |"bot"|
        }
      `,
    }

    const hooks: Hooks = {
      import: mock<ImportHook>(async (module: string) => {
        const src = modules[module]
        invariant(src, `Unexpected import: ${module}`)
        return src
      }),
      call: mock<CallHook>(() => {}),
      extract: mock<ExtractHook>(() => {}),
    }
    const result = await execute(modules, {}, { hooks })

    expect(result).toEqual({
      topValue: 'top::foo',
      midValue: {
        topValue: 'top::bar',
        midValue: 'mid',
      },
      botValue: 'bot',
    })

    expect(hooks.import).toHaveBeenCalledTimes(3)
    expect(hooks.import).toHaveBeenNthCalledWith(1, 'Home')
    expect(hooks.import).toHaveBeenNthCalledWith(2, 'Top')
    expect(hooks.import).toHaveBeenNthCalledWith(3, 'Mid')

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
