import type { Hooks } from '@getlang/lib'
import { wait, ImportError } from '@getlang/lib'
import { parse, desugar } from '@getlang/parser'
import type { Program } from '@getlang/parser'
import { execute as exec } from './execute/execute'
import type { InternalHooks } from './execute/execute'
import * as http from './execute/net/http'
import { runSlice } from './execute/lang'

export { version } from './package.json'

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
    slice: hooks.slice ?? runSlice,
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
