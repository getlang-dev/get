import { invariant } from '@getlang/utils'
import { QuerySyntaxError } from '@getlang/utils/errors'
import type { CExpr, Expr } from '../../ast/ast.js'
import { NodeKind } from '../../ast/ast.js'
import { tx } from '../../utils.js'
import type { DesugarPass } from '../desugar.js'
import { traceVisitor } from '../trace.js'

export const resolveContext: DesugarPass = ({ parsers, macros }) => {
  const { scope, trace } = traceVisitor()

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
        resolved = parsers.lookup(from, field)
      } else {
        resolved = tx.ident('')
      }
    }
    return { resolved, from }
  }

  return {
    ...trace,

    RequestExpr(node) {
      parsers.visit(node)
      return node
    },

    Program: {
      enter(node, visit) {
        const xnode = trace.Program.enter(node, visit)
        return { ...xnode, body: parsers.insert(xnode.body) }
      },
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

    ModifierExpr: {
      enter(node, visit) {
        const modifier = node.modifier.value
        const { resolved: context, from } = infer(node, modifier)
        const xnode = trace.ModifierExpr.enter({ ...node, context }, visit)
        const onRequest = from?.kind === NodeKind.RequestExpr
        // when inferred to request parser, replace modifier
        if (onRequest) {
          invariant(xnode.context, new QuerySyntaxError('Unresolved context'))
          return xnode.context
        }
        return xnode
      },
    },

    ModuleExpr: {
      enter(node, visit) {
        const module = node.module.value
        const context = macros.includes(module)
          ? infer(node).resolved
          : node.context
        return trace.ModuleExpr.enter({ ...node, context }, visit)
      },
    },
  }
}
