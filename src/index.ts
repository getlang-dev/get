import nearley from 'nearley'
import grammar from './grammar'
import lexer from './parse/lexer'
import { desugar } from './ast/simplified'
import { print } from './ast/print'
import type { Program } from './ast/ast'
import { execute as exec } from './execute/execute'
import type { InternalHooks } from './execute/execute'
import * as http from './execute/net/http'
import { SyntaxError, ImportError, invariant } from './errors'
import { wait } from './utils'

export type { Program }
export { NodeKind } from './ast/ast'
export { RuntimeError } from './errors'

function parse(source: string): Program {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
  try {
    parser.feed(source)
  } catch (e: unknown) {
    if (typeof e === 'object' && e && 'token' in e) {
      throw new SyntaxError(
        lexer.formatError(e.token, 'SyntaxError: Invalid token')
      )
    }
    throw e
  }

  const { results } = parser
  invariant(results.length !== 0, new SyntaxError('Unexpected end of input'))
  invariant(results.length === 1, new SyntaxError('Unexpected parsing error'))
  return results[0]
}

export type RequestHook = InternalHooks['request']
export type ImportHook = (module: string) => string | Promise<string>
export type Hooks = Partial<{ request: RequestHook; import: ImportHook }>

function buildHooks(hooks: Hooks = {}): InternalHooks {
  return {
    request: hooks.request ?? http.requestHook,
    import: (module: string) => {
      if (!hooks.import) {
        throw new ImportError(
          'Imports are not supported by the current runtime'
        )
      }
      return wait(hooks.import(module), src => desugar(parse(src)))
    },
  }
}

function execute(
  source: string,
  inputs: Record<string, unknown> = {},
  hooks?: Hooks
) {
  const ast = parse(source)
  const simplified = desugar(ast)
  return exec(simplified, inputs, buildHooks(hooks))
}

function executeAST(
  ast: Program,
  inputs: Record<string, unknown> = {},
  hooks?: Hooks
) {
  return exec(ast, inputs, buildHooks(hooks))
}

export { parse, desugar, execute, print, executeAST }
