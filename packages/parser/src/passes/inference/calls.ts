import type { Expr, Program } from '@getlang/ast'
import { isToken } from '@getlang/ast'
import { walk } from '@getlang/walker'
import { LineageTracker } from '../lineage.js'

export function registerCalls(ast: Program, macros: string[] = []) {
  const scope = new LineageTracker()

  function registerCall(node: Expr) {
    const lineage = scope.traceLineageRoot(node) || node
    if (lineage?.kind === 'ModuleExpr') {
      lineage.call = true
    }
  }

  return walk(ast, {
    scope,

    TemplateExpr(node) {
      for (const el of node.elements) {
        if (!isToken(el)) {
          registerCall(el)
        }
      }
      return node
    },

    SelectorExpr() {
      if (scope.context) {
        registerCall(scope.context)
      }
    },

    ModifierExpr() {
      if (scope.context) {
        registerCall(scope.context)
      }
    },

    ModuleExpr(node) {
      if (macros.includes(node.module.value)) {
        return { ...node, call: true }
      }
    },
  })
}
