import type { CallExpr, Expr, Program } from '../../ast/ast.js'
import { isToken, NodeKind } from '../../ast/ast.js'
import type { TransformVisitor } from '../../visitor/visitor.js'
import { visit } from '../../visitor/visitor.js'

export function buildCallTable(ast: Program, macros: string[] = []) {
  const callTable = new Set<CallExpr>()
  function registerCall(e?: Expr) {
    if (e?.kind === NodeKind.CallExpr && e.calltype === 'module') {
      callTable.add(e)
    }
  }

  // note: `visit` is mutative on exit, so entry visitors must be used
  // to ensure node references collected point to provided AST
  const visitor: TransformVisitor = {
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
      enter(node) {
        registerCall(node.context)
        return node
      },
    },

    CallExpr: {
      enter(node) {
        if (macros.includes(node.callee.value)) {
          registerCall(node)
        }
        return node
      },
    },
  }

  visit(ast, visitor)

  return callTable
}
