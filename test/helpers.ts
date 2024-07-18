import { expect } from 'bun:test'
import dedent from 'dedent'
import { dump } from 'js-yaml'
import type { Program } from '@getlang/parser/ast'
import { parse, desugar, print } from '@getlang/parser'
import { executeAST as exec } from '@getlang/get'
import type { Hooks } from '@getlang/lib'

const DEBUG = Boolean(process.env.AST)

function printYaml(ast: Program) {
  console.log('\n---- execute ast ----')
  console.log(
    dump(ast, {
      indent: 4,
      replacer(_, value) {
        if (typeof value === 'object' && value) {
          if ('offset' in value && 'lineBreaks' in value && 'value' in value) {
            return `TOKEN(${value.value})`
          }
        }
        return value
      },
    }),
  )
}

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

    const ast = desugar(parse(src))
    DEBUG && printYaml(ast)

    return exec(ast, inputs, hooks)
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
