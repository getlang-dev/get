import type { CallExpr, Expr, Program } from '../../ast/ast.js'
import { isToken, NodeKind } from '../../ast/ast.js'
import type { TransformVisitor } from '../../visitor/visitor.js'
import { visit } from '../../visitor/visitor.js'
import { traceVisitor } from '../trace.js'

export function buildCallTable(ast: Program, macros: string[] = []) {
  const { scope, trace } = traceVisitor()

  const callTable = new Set<CallExpr>()
  function registerCall(node?: Expr) {
    while (node?.kind === NodeKind.IdentifierExpr) {
      node = scope.vars[node.value.value]
    }
    if (node?.kind === NodeKind.CallExpr && node.calltype === 'module') {
      callTable.add(node)
    }
  }

  // note: `visit` is mutative on exit, so entry visitors must be used
  // to ensure node references collected point to provided AST
  const visitor: TransformVisitor = {
    ...trace,

    AssignmentStmt: {
      // overwrites trace visitor to use pre-mutation node
      enter(node) {
        scope.vars[node.name.value] = node.value
        return node
      },
    },

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

    CallExpr: {
      enter(node, visit) {
        if (macros.includes(node.callee.value)) {
          registerCall(node)
        }
        return trace.CallExpr.enter(node, visit)
      },
    },
  }

  visit(ast, visitor)
  return callTable
}
