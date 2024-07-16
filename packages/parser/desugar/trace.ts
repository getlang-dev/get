import type { Expr, CExpr } from '../ast/ast.js'
import { t } from '../ast/ast.js'
import type { RootScope } from '../ast/scope.js'
import type { Visitor } from '../ast/visitor.js'

export function traceVisitor(scope: RootScope<Expr>) {
  function ctx(
    node: CExpr,
    visit: (node: Expr) => Expr,
    cb: (tnode: Expr) => Expr,
  ) {
    const context = node.context && visit(node.context)
    context && scope.pushContext(context)
    const xnode = cb({ ...node, context })
    context && scope.popContext()
    return xnode
  }

  return {
    // statements with scope affect
    InputDeclStmt(node) {
      scope.vars[node.id.value] = t.identifierExpr(node.id)
      return node
    },

    RequestStmt(node) {
      scope.pushContext(node.request)
      return node
    },

    AssignmentStmt(node) {
      scope.vars[node.name.value] = node.value
      return node
    },

    ExtractStmt(node) {
      scope.extracted = node.value
      return node
    },

    // contextual expressions
    FunctionExpr: {
      enter(node, visit) {
        return ctx(node, visit, node => {
          scope.push()
          const body = node.body.map(visit)
          scope.pop()
          return { ...node, body }
        })
      },
    },

    ObjectLiteralExpr: {
      enter(node, visit) {
        return ctx(node, visit, node => {
          const entries = node.entries.map(e => {
            const value = visit(e.value)
            return { ...e, value }
          })
          return { ...node, entries }
        })
      },
    },

    ModuleCallExpr: {
      enter(node, visit) {
        return ctx(node, visit, node => {
          return { ...node, inputs: visit(node.inputs) }
        })
      },
    },

    SelectorExpr: {
      enter(node, visit) {
        return ctx(node, visit, node => {
          return { ...node, selector: visit(node.selector) }
        })
      },
    },

    ModifierExpr: {
      enter(node, visit) {
        return ctx(node, visit, node => {
          return { ...node, options: visit(node.options) }
        })
      },
    },

    SliceExpr: {
      enter(node, visit) {
        // contains no additional expressions beyond .context
        return ctx(node, visit, node => node)
      },
    },
  } satisfies Visitor
}
