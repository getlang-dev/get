import type { Program } from '@getlang/ast'
import { ScopeTracker, transform } from '@getlang/walker'

export function analyze(ast: Program) {
  const scope = new ScopeTracker()
  const inputs = new Set<string>()
  const calls = new Set<string>()
  const modifiers = new Map<string, boolean>()
  const imports = new Set<string>()
  let hasUnboundSelector = false

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
      hasUnboundSelector ||= !scope.context
    },
    ModifierExpr(node) {
      const mod = node.modifier.value
      const unbound = modifiers.get(mod) || !scope.context
      modifiers.set(mod, unbound)
    },
  })

  return {
    inputs,
    imports,
    calls,
    modifiers,
    hasUnboundSelector,
  }
}
