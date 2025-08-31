import type { Program } from '@getlang/ast'
import { ScopeTracker, transform } from '@getlang/walker'

export function analyze(ast: Program) {
  const scope = new ScopeTracker()
  const inputs = new Set<string>()
  const imports = new Set<string>()
  let isMacro = false

  transform(ast, {
    scope,
    InputExpr(node) {
      inputs.add(node.id.value)
    },
    ModuleExpr(node) {
      imports.add(node.module.value)
    },
    SelectorExpr() {
      isMacro ||= !scope.context
    },
    ModifierExpr() {
      isMacro ||= !scope.context
    },
  })

  return { inputs, imports, isMacro }
}
