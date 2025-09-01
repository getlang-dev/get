import type { Program } from '@getlang/ast'
import { ScopeTracker, transform } from '@getlang/walker'

export function analyze(ast: Program) {
  const scope = new ScopeTracker()
  const inputs = new Set<string>()
  const calls = new Set<string>()
  const modifiers = new Set<string>()
  const imports = new Set<string>()
  let isMacro = false

  transform(ast, {
    scope,
    InputExpr(node) {
      inputs.add(node.id.value)
    },
    ModuleExpr(node) {
      imports.add(node.module.value)
      node.call && calls.add(node.module.value)
    },
    SelectorExpr() {
      isMacro ||= !scope.context
    },
    ModifierExpr(node) {
      isMacro ||= !scope.context
      modifiers.add(node.modifier.value)
    },
  })

  return { inputs, imports, calls, modifiers, isMacro }
}
