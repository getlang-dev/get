import { invariant } from '@getlang/utils'
import { QuerySyntaxError, ValueReferenceError } from '@getlang/utils/errors'
import type { CallExpr, Expr, RequestExpr } from '../../ast/ast.js'
import { isToken, NodeKind, t } from '../../ast/ast.js'
import type { TransformVisitor } from '../../visitor/transform.js'
import type { RequestParsers } from '../reqparse.js'
import { traceVisitor } from '../trace.js'
import { render, tx } from '../utils.js'

export function inferLinks(parsers: RequestParsers): TransformVisitor {
  const { scope, trace } = traceVisitor()

  const bases = new Map<Expr, RequestExpr>()
  function inherit(c: Expr, n: Expr) {
    const base = bases.get(c)
    base && bases.set(n, base)
  }

  const links = new Set<CallExpr>()
  function registerModule(e: Expr) {
    if (e.kind === NodeKind.CallExpr && e.calltype === 'link') {
      e.calltype = 'module'
    }
  }

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
        registerModule(xnode.context)
        return xnode
      },
    },

    TemplateExpr(node) {
      for (const el of node.elements) {
        if (!isToken(el)) {
          registerModule(el)
        }
      }
      return node
    },

    CallExpr: {
      enter(node, visit) {
        let tnode = node
        if (tnode.calltype === 'link') {
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

        if (xnode.calltype === 'link') {
          links.add(xnode)
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
