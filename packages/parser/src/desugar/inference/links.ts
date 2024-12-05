import {
  QuerySyntaxError,
  ValueReferenceError,
  invariant,
} from '@getlang/utils'
import type { Expr, RequestExpr, Stmt } from '../../ast/ast.js'
import { NodeKind, t } from '../../ast/ast.js'
import { RootScope } from '../../ast/scope.js'
import type { TransformVisitor } from '../../visitor/transform.js'
import { traceVisitor } from '../trace.js'
import { render, tx } from '../utils.js'

type Urls = Map<RequestExpr, [index: number]>

function insertUrls(stmts: Stmt[], urls: Urls) {
  return stmts.flatMap(stmt => {
    const url =
      stmt.kind === NodeKind.RequestStmt &&
      stmt.request.kind === NodeKind.RequestExpr &&
      urls.get(stmt.request)
    if (!url) {
      return stmt
    }
    const [index] = url
    const contextId = tx.ident('')
    const selector = tx.template('url')
    const expr: Expr = t.selectorExpr(selector, false, contextId)
    const id = `__url_${index}`
    const assign = t.assignmentStmt(tx.token(id), expr, false)
    return [stmt, assign]
  })
}

export function inferLinks(): TransformVisitor {
  const scope = new RootScope<Expr>()

  const bases = new Map<Expr, RequestExpr>()
  function inherit(c: Expr, n: Expr) {
    const base = bases.get(c)
    base && bases.set(n, base)
  }

  const urls: Urls = new Map()
  function getUrl(req: RequestExpr) {
    const [index] = urls.get(req) ?? [urls.size]
    urls.set(req, [index])
    const id = `__url_${index}`
    const stub = tx.ident(id)
    scope.vars[id] ??= stub
    inherit(req, stub)
    return stub
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
            inputs: {
              ...tnode.inputs,
              entries: tnode.inputs.entries.map(e => {
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
            xnode.inputs.kind === NodeKind.ObjectLiteralExpr,
          new QuerySyntaxError('Modifier options must be an object'),
        )

        if (xnode.callee.value === 'link' && xnode.context) {
          const contextBase = bases.get(xnode.context)
          const hasBase = xnode.inputs.entries.some(
            e => render(e.key) === 'base',
          )
          if (contextBase && !hasBase) {
            xnode.inputs.entries.push(
              t.objectEntry(tx.template('base'), getUrl(contextBase)),
            )
          }
        }
        invariant(xnode.context, new QuerySyntaxError('Unresolved context'))
        inherit(xnode.context, xnode)
        return xnode
      },
    },

    RequestExpr(node) {
      bases.set(node, node)
      return node
    },

    Program(node) {
      return { ...node, body: insertUrls(node.body, urls) }
    },

    SubqueryExpr: {
      enter(node, visit) {
        const xnode = trace.SubqueryExpr.enter(node, visit)
        return { ...xnode, body: insertUrls(xnode.body, urls) }
      },
    },
  }
}
