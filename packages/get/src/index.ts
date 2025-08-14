import { http, slice } from '@getlang/lib'
import { desugar, parse } from '@getlang/parser'
import type { Program } from '@getlang/parser/ast'
import type { UserHooks } from '@getlang/utils'
import { ImportError, invariant, wait } from '@getlang/utils'
import type { InternalHooks } from './execute.js'
import { execute as exec, Modules } from './execute.js'

function buildHooks(hooks: UserHooks = {}): InternalHooks {
  return {
    import: (module: string) => {
      invariant(
        hooks.import,
        new ImportError('Imports are not supported by the current runtime'),
      )
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

export async function executeModule(
  module: string,
  inputs: Record<string, unknown> = {},
  _hooks?: UserHooks,
) {
  const hooks = buildHooks(_hooks)
  const modules = new Modules(hooks.import)
  const source = await modules.import(module)
  return exec(source.program, inputs, hooks, modules)
}
