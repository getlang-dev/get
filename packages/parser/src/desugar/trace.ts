import type { CExpr, Expr } from '../ast/ast.js'
import { t } from '../ast/ast.js'
import { RootScope } from '../ast/scope.js'
import type { TransformVisitor, Visit } from '../visitor/transform.js'

export function traceVisitor() {
  const scope = new RootScope<Expr>()

  function withContext<C extends CExpr>(
    node: C,
    visit: Visit,
    cb: (tnode: C) => C,
  ) {
    if (!node.context) {
      return cb(node)
    }
    const context = visit(node.context)
    scope.pushContext(context)
    const xnode = cb({ ...node, context })
    scope.popContext()
    return xnode
  }

  const trace = {
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

    Program: {
      enter(node, visit) {
        scope.push()
        const body = node.body.map(visit)
        scope.pop()
        return { ...node, body }
      },
    },

    // contextual expressions
    SubqueryExpr: {
      enter(node, visit) {
        return withContext(node, visit, node => {
          scope.push()
          const body = node.body.map(visit)
          scope.pop()
          return { ...node, body }
        })
      },
    },

    ObjectLiteralExpr: {
      enter(node, visit) {
        return withContext(node, visit, node => {
          const entries = node.entries.map(e => {
            const value = visit(e.value)
            return { ...e, value }
          })
          return { ...node, entries }
        })
      },
    },

    SelectorExpr: {
      enter(node, visit) {
        return withContext(node, visit, node => {
          return { ...node, selector: visit(node.selector) }
        })
      },
    },

    CallExpr: {
      enter(node, visit) {
        return withContext(node, visit, node => {
          return { ...node, args: visit(node.args) }
        })
      },
    },

    SliceExpr: {
      enter(node, visit) {
        // contains no additional expressions (only .context)
        return withContext(node, visit, node => node)
      },
    },
  } satisfies TransformVisitor

  return { scope, trace }
}
