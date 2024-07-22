import { slice, http } from '@getlang/lib'
import type { Hooks } from '@getlang/utils'
import { wait, ImportError } from '@getlang/utils'
import { parse, desugar } from '@getlang/parser'
import type { Program } from '@getlang/parser/ast'
import { execute as exec } from './execute.js'
import type { InternalHooks } from './execute.js'

export const version = '0.0.21'
export type UserHooks = Partial<Hooks>

function buildHooks(hooks: UserHooks = {}): InternalHooks {
  return {
    import: (module: string) => {
      if (!hooks.import) {
        throw new ImportError(
          'Imports are not supported by the current runtime',
        )
      }
      return wait(hooks.import(module), src => desugar(parse(src)))
    },
    request: hooks.request ?? http.requestHook,
    slice: hooks.slice ?? slice.runSlice,
  }
}

export function execute(
  source: string,
  inputs: Record<string, unknown> = {},
  hooks?: UserHooks,
) {
  const ast = parse(source)
  const simplified = desugar(ast)
  return exec(simplified, inputs, buildHooks(hooks))
}

export function executeAST(
  ast: Program,
  inputs: Record<string, unknown> = {},
  hooks?: UserHooks,
) {
  return exec(ast, inputs, buildHooks(hooks))
}
