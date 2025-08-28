import { ScopeTracker, walk } from '@getlang/walker'
import type { Expr, Program } from '../../ast/ast.js'
import { isToken } from '../../ast/ast.js'

export function registerCalls(ast: Program, macros: string[] = []) {
  const scope = new ScopeTracker()

  function registerCall(node?: Expr) {
    switch (node?.kind) {
      case 'IdentifierExpr': {
        const id = node.id.value
        if (id) {
          return registerCall(scope.vars[id])
        }
        const ctxs = scope.scopeStack.flatMap(s => s.contextStack)
        return registerCall(
          ctxs.findLast(c => c.kind !== 'IdentifierExpr' || c.id.value !== ''),
        )
      }
      case 'SubqueryExpr': {
        const ex = node.body.find(s => s.kind === 'ExtractStmt')
        return registerCall(ex?.value)
      }
      case 'ModuleExpr': {
        node.call = true
      }
    }
  }

  return walk(ast, {
    scope,
    TemplateExpr: {
      enter(node) {
        for (const el of node.elements) {
          if (!isToken(el)) {
            registerCall(el)
          }
        }
        return node
      },
    },

    SelectorExpr: {
      enter() {
        registerCall(scope.context)
      },
    },

    ModifierExpr: {
      enter() {
        registerCall(scope.context)
      },
    },

    ModuleExpr: {
      enter(node) {
        const module = node.module.value
        if (macros.includes(module)) {
          registerCall(node)
        }
      },
    },
  })
}
