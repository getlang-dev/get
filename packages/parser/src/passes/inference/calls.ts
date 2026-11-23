import type { Expr, Program } from '@getlang/ast'
import { isToken } from '@getlang/ast'
import { transform } from '@getlang/walker'
import { LineageTracker } from '../lineage.js'
import type { InferenceOptions } from './inference.js'

export function registerCalls(
  ast: Program,
  options: InferenceOptions,
): Program {
  const scope = new LineageTracker()

  function registerCall(node: Expr) {
    const lineage = scope.traceLineageRoots(node) || node
    const roots = Array.isArray(lineage) ? lineage : [lineage]
    for (const root of roots) {
      if (root?.kind === 'ModuleExpr') {
        root.call = true
      }
    }
  }

  return transform(ast, {
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

    async ModuleExpr(node) {
      const { isMacro } = await options.getModule(node.module.value)
      if (isMacro) {
        node.call = true
      } else {
        const usesResponse = node.args.entries.some(e => {
          const lineage = scope.traceLineageRoots(e.value)
          const roots = Array.isArray(lineage) ? lineage : [lineage]
          return roots
            .map(r => r?.kind)
            .some(k => k === 'RequestExpr' || k === 'ModuleExpr')
        })
        if (!usesResponse) {
          node.call = true
        }
      }
    },
  })
}
