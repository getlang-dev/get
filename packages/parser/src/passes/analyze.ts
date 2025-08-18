import type { CExpr, Program } from '../ast/ast.js'
import { Type } from '../ast/typeinfo.js'
import type { TransformVisitor } from '../visitor/transform.js'
import { visit } from '../visitor/visitor.js'
import { traceVisitor } from './trace.js'

export function analyze(ast: Program) {
  const { scope, trace } = traceVisitor()
  const inputs = new Set<string>()
  const imports = new Set<string>()
  let isMacro = false

  function checkMacro(node: CExpr) {
    if (!node.context) {
      const implicitType = scope.context?.typeInfo.type
      isMacro ||= implicitType === Type.Context
    }
  }

  const visitor: TransformVisitor = {
    ...trace,
    InputDeclStmt(node) {
      inputs.add(node.id.value)
      return trace.InputDeclStmt(node)
    },
    CallExpr: {
      enter(node, visit) {
        if (node.calltype === 'module') {
          imports.add(node.callee.value)
        } else {
          checkMacro(node)
        }
        return trace.CallExpr.enter(node, visit)
      },
    },
    SelectorExpr: {
      enter(node, visit) {
        checkMacro(node)
        return trace.SelectorExpr.enter(node, visit)
      },
    },
  }

  visit(ast, visitor)

  return { inputs, imports, isMacro }
}
