import { executeAST as exec } from '@getlang/get'
import { desugar, parse, print } from '@getlang/parser'
import type { Program } from '@getlang/parser/ast'
import type { UserHooks } from '@getlang/utils'
import { invariant } from '@getlang/utils'
import dedent from 'dedent'
import { dump } from 'js-yaml'
import './expect.js'

export type Fetch = (req: Request) => Promise<Response> | Response

const DEBUG = Boolean(process.env.AST)
export const SELSYN = true

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

export function helper() {
  const collected: string[] = []

  async function execute(
    program: string | Record<string, string>,
    inputs?: Record<string, unknown>,
    fetch?: Fetch,
  ): Promise<any> {
    const normalized = typeof program === 'string' ? { Home: program } : program
    const modules: Record<string, string> = {}
    for (const [name, source] of Object.entries(normalized)) {
      modules[name] = dedent(source)
      collected.push(source)
    }

    const hooks: UserHooks = {
      call: async (_m, _i, raster, execute) => {
        const value = await execute()
        return { ...raster, ...value }
      },
      import(module) {
        const src = modules[module]
        invariant(src, `Failed to import module: ${module}`)
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

    invariant(modules.Home, 'Expected module entry source')
    const ast = desugar(parse(modules.Home))
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
