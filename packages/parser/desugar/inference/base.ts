import { invariant, QuerySyntaxError, ValueReferenceError } from '@getlang/lib'
import type { Expr, RequestExpr, Stmt } from '../../ast/ast.js'
import { NodeKind, t } from '../../ast/ast.js'
import { RootScope } from '../../ast/scope.js'
import type { Visitor } from '../../ast/visitor.js'
import { createToken, render, template } from '../utils.js'
import { traceVisitor } from '../trace.js'

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
    const contextId = t.identifierExpr(createToken(''))
    const selector = template('url')
    const expr: Expr = t.selectorExpr(selector, false, contextId)
    const id = `__url_${index}`
    const assign = t.assignmentStmt(createToken(id), expr, false)
    return [stmt, assign]
  })
}

export function inferBase(): Visitor {
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
    const stub = t.identifierExpr(createToken(id))
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
        inherit(xnode.context, xnode)
        return xnode
      },
    },

    ModifierExpr: {
      enter(node, visit) {
        const xnode = trace.ModifierExpr.enter(node, visit)
        invariant(
          xnode.kind === NodeKind.ModifierExpr &&
            xnode.options.kind === NodeKind.ObjectLiteralExpr,
          new QuerySyntaxError('Modifier options must be an object'),
        )

        if (xnode.value.value === 'link' && xnode.context) {
          const contextBase = bases.get(xnode.context)
          const hasBase = xnode.options.entries.some(
            e => render(e.key) === 'base',
          )
          if (contextBase && !hasBase) {
            xnode.options.entries.push({
              key: template('base'),
              value: getUrl(contextBase),
              optional: false,
            })
          }
        }
        inherit(xnode.context, xnode)
        return xnode
      },
    },

    RequestExpr(node) {
      bases.set(node, node)
    },

    Program(node) {
      return { ...node, body: insertUrls(node.body, urls) }
    },

    FunctionExpr: {
      enter(node, visit) {
        const xnode = trace.FunctionExpr.enter(node, visit)
        return { ...xnode, body: insertUrls(xnode.body, urls) }
      },
    },
  }
}
