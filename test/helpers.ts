import { expect } from 'bun:test'
import dedent from 'dedent'
import { parse, desugar, print } from '@getlang/parser'
import { execute as exec } from '@getlang/get'
import type { Hooks } from '@getlang/lib'

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

export function helper() {
  const collected: string[] = []

  function execute(
    _src: string,
    inputs?: Record<string, unknown>,
    hooks?: Partial<Hooks>,
  ): any {
    const src = dedent(_src)
    collected.push(src)
    return exec(src, inputs, hooks)
  }

  function testIdempotency() {
    // desugar, pretty-print, then desugar & pretty-print
    // once again to make sure the output is equal
    return collected.flatMap(src => {
      let ast1: ReturnType<typeof parse>
      try {
        ast1 = parse(src)
      } catch (_e) {
        // some sources may not compile, e.g. error tests
        return []
      }

      const simplified1 = desugar(ast1)
      const print1 = print(simplified1)

      const ast2 = parse(print1)
      const simplified2 = desugar(ast2)
      const print2 = print(simplified2)

      return { a: print1, b: print2 }
    })
  }

  return { execute, testIdempotency }
}
