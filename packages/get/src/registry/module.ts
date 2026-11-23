import type { Program } from '@getlang/ast'
import type { ImportHook } from '@getlang/lib'
import { invariant } from '@getlang/lib'
import { ImportError } from '@getlang/lib/errors'
import { desugar, parse } from '@getlang/parser'
import { ScopeTracker, transform } from '@getlang/walker'
import type { ModifierPipeline } from './modifier.ts'

export type ModulePipeline = ReturnType<typeof modulePipeline>

type LoadModifier = (modifier: string) => ModifierPipeline
type LoadModule = (module: string) => ModulePipeline

async function isMacro(program: Program, modifier: LoadModifier) {
  const scope = new ScopeTracker()
  let isMacro = false
  await transform(program, {
    scope,
    SelectorExpr() {
      isMacro ||= !scope.context
    },
    async ModifierExpr(node) {
      const entry = await modifier(node.modifier.value).load()
      if (entry?.useContext) {
        isMacro ||= !scope.context
      }
    },
  })
  return isMacro
}

function inputs(program: Program) {
  const inputs = new Set<string>()
  transform(program, {
    InputExpr(node) {
      inputs.add(node.id.value)
    },
  })
  return inputs
}

export function modulePipeline(
  module: string,
  loadModifier: LoadModifier,
  loadModule: LoadModule,
  importHook?: ImportHook,
) {
  return {
    async parse() {
      invariant(
        importHook,
        new ImportError('Imports are not supported by the current runtime'),
      )
      const source = await importHook(module)
      invariant(source, new ImportError(`Failed to import module: ${module}`))
      const program = parse(source)
      return {
        program,
        isMacro: await isMacro(program, loadModifier),
      }
    },

    async desugar() {
      const { program: ast } = await this.parse()

      const program = await desugar(ast, {
        async usesContext(spec) {
          if ('modifier' in spec) {
            const entry = await loadModifier(spec.modifier).load()
            return entry?.useContext || true
          } else {
            const entry = await loadModule(spec.module).parse()
            return entry.isMacro
          }
        },
      })

      return { program, inputs: inputs(program) }
    },
  }
}
