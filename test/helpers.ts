import dedent from 'dedent'
import { parse, desugar, print } from '@getlang/parser'
import { execute as exec } from '@getlang/get'
import type { Hooks } from '@getlang/get'

export const collected: string[] = []

export function execute(
  _src: string,
  inputs?: Record<string, unknown>,
  hooks?: Hooks,
): any {
  const src = dedent(_src)
  collected.push(src)
  return exec(src, inputs, hooks)
}

export function testIdempotency() {
  // desugar, pretty-print, then desugar & pretty-print
  // once again to make sure the output is equal
  return collected.flatMap(src => {
    let ast1: ReturnType<typeof parse>
    try {
      ast1 = parse(src)
    } catch (e) {
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
