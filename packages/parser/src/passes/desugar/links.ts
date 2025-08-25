import { invariant } from '@getlang/utils'
import { QuerySyntaxError, ValueReferenceError } from '@getlang/utils/errors'
import type { Expr, RequestExpr } from '../../ast/ast.js'
import { NodeKind, t } from '../../ast/ast.js'
import { render, tx } from '../../utils.js'
import type { DesugarPass } from '../desugar.js'
import { traceVisitor } from '../trace.js'

export const settleLinks: DesugarPass = ({ parsers }) => {
  const { scope, trace } = traceVisitor()

  const bases = new Map<Expr, RequestExpr>()
  function inherit(c: Expr, n: Expr) {
    const base = bases.get(c)
    base && bases.set(n, base)
  }

  return {
    ...trace,

    IdentifierExpr: {
      enter(node, visit) {
        const id = node.id.value
        const xnode = trace.IdentifierExpr.enter(node, visit)
        const value = id ? scope.vars[id] : scope.context
        invariant(value, new ValueReferenceError(id))
        inherit(value, xnode)
        return xnode
      },
    },

    SelectorExpr: {
      enter(node, visit) {
        const xnode = trace.SelectorExpr.enter(node, visit)
        const context = xnode.context || scope.context
        invariant(context, new QuerySyntaxError('Unresolved context'))
        inherit(context, xnode)
        return xnode
      },
    },

    ModifierExpr: {
      enter(node, visit) {
        const xnode = trace.ModifierExpr.enter(node, visit)
        invariant(
          xnode.args.kind === NodeKind.ObjectLiteralExpr,
          new QuerySyntaxError('Modifier options must be an object'),
        )

        if (xnode.modifier.value === 'link' && xnode.context) {
          const contextBase = bases.get(xnode.context)
          const hasBase = xnode.args.entries.some(e => render(e.key) === 'base')
          if (contextBase && !hasBase) {
            xnode.args.entries.push(
              t.objectEntry(
                tx.template('base'),
                parsers.lookup(contextBase, 'url'),
              ),
            )
          }
        }

        const context = xnode.context || scope.context
        invariant(context, new QuerySyntaxError('Unresolved context'))
        inherit(context, xnode)
        return xnode
      },
    },

    ModuleExpr: {
      enter(node, visit) {
        const tnode = {
          ...node,
          args: {
            ...node.args,
            entries: node.args.entries.map(e => {
              if (
                render(e.key) !== '@link' ||
                (e.value.kind === NodeKind.ModifierExpr &&
                  e.value.modifier.value === 'link')
              ) {
                return e
              }
              const value = t.modifierExpr(tx.token('link'), undefined, e.value)
              return { ...e, value }
            }),
          },
        }
        return trace.ModuleExpr.enter(tnode, visit)
      },
    },

    RequestExpr(node) {
      parsers.visit(node)
      bases.set(node, node)
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
        let xnode = trace.SubqueryExpr.enter(node, visit)
        const extracted = xnode.body.find(
          stmt => stmt.kind === NodeKind.ExtractStmt,
        )
        xnode = { ...xnode, body: parsers.insert(xnode.body) }
        extracted && inherit(extracted.value, xnode)
        return xnode
      },
    },
  }
}
