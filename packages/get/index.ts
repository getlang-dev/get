import { wait, ImportError } from '@getlang/utils'
import { parse, desugar } from '@getlang/parser'
import type { Program } from '@getlang/parser'
import { execute as exec } from './execute/execute'
import type { InternalHooks } from './execute/execute'
import * as http from './execute/net/http'

export { RuntimeError } from '@getlang/utils'
export * as errors from '@getlang/utils'
export { version } from './package.json'
export { parse, desugar, print, NodeKind } from '@getlang/parser'
export type { Program } from '@getlang/parser'

export type RequestHook = InternalHooks['request']
export type ImportHook = (module: string) => string | Promise<string>
export type Hooks = Partial<{ request: RequestHook; import: ImportHook }>

function buildHooks(hooks: Hooks = {}): InternalHooks {
  return {
    request: hooks.request ?? http.requestHook,
    import: (module: string) => {
      if (!hooks.import) {
        throw new ImportError(
          'Imports are not supported by the current runtime',
        )
      }
      return wait(hooks.import(module), src => desugar(parse(src)))
    },
  }
}

export function execute(
  source: string,
  inputs: Record<string, unknown> = {},
  hooks?: Hooks,
) {
  const ast = parse(source)
  const simplified = desugar(ast)
  return exec(simplified, inputs, buildHooks(hooks))
}

export function executeAST(
  ast: Program,
  inputs: Record<string, unknown> = {},
  hooks?: Hooks,
) {
  return exec(ast, inputs, buildHooks(hooks))
}
