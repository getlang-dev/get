import type { Expr, Program } from '../../ast/ast.js'
import { isToken, NodeKind } from '../../ast/ast.js'
import type { TransformVisitor } from '../../visitor/visitor.js'
import { visit } from '../../visitor/visitor.js'
import { traceVisitor } from '../trace.js'

export function registerCalls(ast: Program, macros: string[] = []) {
  const { scope, trace } = traceVisitor()
  const mutable = visit(ast, {} as TransformVisitor)

  function registerCall(node?: Expr) {
    switch (node?.kind) {
      case NodeKind.IdentifierExpr: {
        const id = node.id.value
        if (id) {
          return registerCall(scope.vars[id])
        }
        const ctxs = scope.scopeStack.flatMap(s => s.contextStack)
        return registerCall(
          ctxs.findLast(
            c => c.kind !== NodeKind.IdentifierExpr || c.id.value !== '',
          ),
        )
      }
      case NodeKind.SubqueryExpr: {
        const ex = node.body.find(s => s.kind === NodeKind.ExtractStmt)
        return registerCall(ex?.value)
      }
      case NodeKind.ModuleExpr: {
        node.call = true
      }
    }
  }

  const visitor: TransformVisitor = {
    ...trace,

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
      enter(node, visit) {
        registerCall(node.context)
        return trace.SelectorExpr.enter(node, visit)
      },
    },

    ModifierExpr: {
      enter(node, visit) {
        registerCall(node.context)
        return trace.ModifierExpr.enter(node, visit)
      },
    },

    ModuleExpr: {
      enter(node, visit) {
        const module = node.module.value
        if (macros.includes(module)) {
          registerCall(node)
        }
        return trace.ModuleExpr.enter(node, visit)
      },
    },
  }

  return visit(mutable, visitor)
}
