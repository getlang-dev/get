import type { Expr, Program } from '@getlang/ast'
import { isToken } from '@getlang/ast'
import { walk } from '@getlang/walker'
import { LineageTracker } from '../lineage.js'

export function registerCalls(ast: Program, macros: string[] = []) {
  const scope = new LineageTracker()

  function registerCall(node?: Expr) {
    const lineage = node && scope.traceLineageRoot(node)
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

    DrillBitExpr({ bit }) {
      switch (bit.kind) {
        case 'SelectorExpr':
        case 'ModifierExpr':
          registerCall(scope.context)
          break

        case 'ModuleExpr':
          if (macros.includes(bit.module.value)) {
            bit.call = true
          }
          break
      }
    },
  })
}
