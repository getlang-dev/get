import { QuerySyntaxError, invariant } from '@getlang/utils'
import type { CExpr, Expr } from '../../ast/ast.js'
import { NodeKind } from '../../ast/ast.js'
import { RootScope } from '../../ast/scope.js'
import type { TransformVisitor } from '../../visitor/transform.js'
import type { RequestParsers } from '../reqparse.js'
import { traceVisitor } from '../trace.js'
import { tx } from '../utils.js'

export function inferContext(parsers: RequestParsers): TransformVisitor {
  const scope = new RootScope<Expr>()

  function infer(node: CExpr, mod?: string) {
    let resolved: Expr
    let from: Expr | undefined
    if (node.context) {
      resolved = node.context
    } else {
      from = scope.context
      invariant(from, new QuerySyntaxError('Unresolved context'))
      if (from.kind === NodeKind.RequestExpr) {
        const field = mod === 'link' ? 'url' : mod
        resolved = tx.ident(parsers.lookup(from, field))
      } else {
        resolved = tx.ident('')
      }
    }
    return { resolved, from }
  }

  const trace = traceVisitor(scope)

  return {
    ...trace,

    RequestExpr(node) {
      parsers.visit(node)
      return node
    },

    Program(node) {
      return { ...node, body: parsers.insert(node.body) }
    },

    SubqueryExpr: {
      enter(node, visit) {
        const xnode = trace.SubqueryExpr.enter(node, visit)
        return { ...xnode, body: parsers.insert(xnode.body) }
      },
    },

    SelectorExpr: {
      enter(node, visit) {
        const { resolved: context } = infer(node)
        return trace.SelectorExpr.enter({ ...node, context }, visit)
      },
    },

    CallExpr: {
      enter(node, visit) {
        const callee = node.callee.value
        if (node.calltype === 'module') {
          return trace.CallExpr.enter(node, visit)
        }

        const { resolved: context, from } = infer(node, callee)
        const xnode = trace.CallExpr.enter({ ...node, context }, visit)

        const onRequest = from?.kind === NodeKind.RequestExpr
        // when inferred to request parser, replace modifier
        if (onRequest) {
          invariant(xnode.context, new QuerySyntaxError('Unresolved context'))
          return xnode.context
        }
        return xnode
      },
    },
  }
}
