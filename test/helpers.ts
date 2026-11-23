import { expect } from 'bun:test'
import { executeModule } from '@getlang/get'
import type { Hooks, Inputs, MaybePromise } from '@getlang/lib'
import { invariant } from '@getlang/lib'
import { desugar, parse, print } from '@getlang/parser'
import dedent from 'dedent'
import './expect.js'

type ExecuteOptions = Partial<{
  fetch: Fetch
  willThrow: boolean
  hooks: Hooks
}>

export type Fetch = (url: string, opts: RequestInit) => MaybePromise<Response>

export const SELSYN = true

async function testIdempotency(source: string) {
  const print1 = print(await desugar(parse(source)))
  const print2 = print(await desugar(parse(print1)))
  expect(print2).toEqual(print1)
}

export async function execute(
  program: string | Record<string, string>,
  inputs?: Inputs,
  options: ExecuteOptions = {},
): Promise<any> {
  const { fetch, willThrow } = options
  const normalized = typeof program === 'string' ? { Home: program } : program
  const modules: Record<string, string> = {}
  for (const [name, source] of Object.entries(normalized)) {
    modules[name] = dedent(source)
    if (!willThrow) {
      await testIdempotency(source)
    }
  }

  const hooks: Hooks = {
    import(module) {
      return modules[module]
    },
    async request(url, opts) {
      invariant(fetch, `Fetch required: ${url}`)
      const res = await fetch(url, opts)
      return {
        status: res.status,
        headers: res.headers,
        body: await res.text(),
      }
    },
    ...options.hooks,
  }

  return executeModule('Home', inputs, hooks)
}
