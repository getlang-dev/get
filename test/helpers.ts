import { expect } from 'bun:test'
import { executeModule } from '@getlang/get'
import { desugar, parse, print } from '@getlang/parser'
import type { Hooks, Inputs, MaybePromise, ModifierHook } from '@getlang/utils'
import { invariant } from '@getlang/utils'
import { ImportError } from '@getlang/utils/errors'
import dedent from 'dedent'
import './expect.js'

export type ExecuteOptions = Partial<{
  fetch: Fetch
  modifier: ModifierHook
  willThrow: boolean
}>

export type Fetch = (req: Request) => MaybePromise<Response>

export const SELSYN = true

function testIdempotency(source: string) {
  const print1 = print(desugar(parse(source)).program)
  const print2 = print(desugar(parse(print1)).program)
  expect(print1).toEqual(print2)
}

export async function execute(
  program: string | Record<string, string>,
  inputs?: Inputs,
  options: ExecuteOptions = {},
): Promise<any> {
  const { fetch, modifier, willThrow } = options
  const normalized = typeof program === 'string' ? { Home: program } : program
  const modules: Record<string, string> = {}
  for (const [name, source] of Object.entries(normalized)) {
    modules[name] = dedent(source)
    if (!willThrow) {
      testIdempotency(source)
    }
  }

  const hooks: Hooks = {
    modifier,
    import(module) {
      const src = modules[module]
      invariant(src, new ImportError(`Failed to import module: ${module}`))
      return src
    },
    async request(url, opts) {
      invariant(fetch, `Fetch required: ${url}`)
      const res = await fetch(new Request(url, opts))
      return {
        status: res.status,
        headers: res.headers,
        body: await res.text(),
      }
    },
  }

  return executeModule('Home', inputs, hooks)
}
