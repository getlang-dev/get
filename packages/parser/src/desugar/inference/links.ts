import {
  invariant,
  QuerySyntaxError,
  ValueReferenceError,
} from '@getlang/utils'
import type { Expr, RequestExpr } from '../../ast/ast.js'
import { NodeKind, t } from '../../ast/ast.js'
import { RootScope } from '../../ast/scope.js'
import type { TransformVisitor } from '../../visitor/transform.js'
import type { RequestParsers } from '../reqparse.js'
import { traceVisitor } from '../trace.js'
import { render, tx } from '../utils.js'

export function inferLinks(parsers: RequestParsers): TransformVisitor {
  const scope = new RootScope<Expr>()

  const bases = new Map<Expr, RequestExpr>()
  function inherit(c: Expr, n: Expr) {
    const base = bases.get(c)
    base && bases.set(n, base)
  }

  const trace = traceVisitor(scope)

  return {
    ...trace,

    IdentifierExpr(node) {
      const id = node.value.value
      const value = scope.vars[id]
      invariant(value, new ValueReferenceError(id))
      inherit(value, node)
      return node
    },

    SelectorExpr: {
      enter(node, visit) {
        const xnode = trace.SelectorExpr.enter(node, visit)
        invariant(xnode.context, new QuerySyntaxError('Unresolved context'))
        inherit(xnode.context, xnode)
        return xnode
      },
    },

    CallExpr: {
      enter(node, visit) {
        let tnode = node
        if (tnode.calltype === 'module') {
          tnode = {
            ...tnode,
            args: {
              ...tnode.args,
              entries: tnode.args.entries.map(e => {
                if (
                  render(e.key) !== '@link' ||
                  (e.value.kind === NodeKind.CallExpr &&
                    e.value.callee.value === 'link')
                ) {
                  return e
                }
                const value = t.callExpr(tx.token('link'), undefined, e.value)
                return { ...e, value }
              }),
            },
          }
        }

        const xnode = trace.CallExpr.enter(tnode, visit)

        if (xnode.calltype === 'module') {
          return xnode
        }

        invariant(
          xnode.kind === NodeKind.CallExpr &&
            xnode.args.kind === NodeKind.ObjectLiteralExpr,
          new QuerySyntaxError('Modifier options must be an object'),
        )

        if (xnode.callee.value === 'link' && xnode.context) {
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
        invariant(xnode.context, new QuerySyntaxError('Unresolved context'))
        inherit(xnode.context, xnode)
        return xnode
      },
    },

    RequestExpr(node) {
      parsers.visit(node)
      bases.set(node, node)
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
  }
}
