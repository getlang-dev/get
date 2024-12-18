import { QuerySyntaxError, invariant } from '@getlang/utils'
import type { CExpr, Expr, RequestExpr, Stmt } from '../../ast/ast.js'
import { NodeKind, t } from '../../ast/ast.js'
import { RootScope } from '../../ast/scope.js'
import type { TransformVisitor } from '../../visitor/transform.js'
import { traceVisitor } from '../trace.js'
import { getContentMod, tx } from '../utils.js'

type Parsers = Map<RequestExpr, [mods: Set<string>, index: number]>

function insertParsers(stmts: Stmt[], parsers: Parsers) {
  return stmts.flatMap(stmt => {
    const parser =
      stmt.kind === NodeKind.RequestStmt &&
      stmt.request.kind === NodeKind.RequestExpr &&
      parsers.get(stmt.request)
    if (!parser) {
      return stmt
    }
    const [mods, index] = parser
    const parserStmts = [...mods].map(mod => {
      let field = 'body'
      if (mod === 'link') {
        field = 'url'
      } else if (mod === 'headers' || mod === 'cookies') {
        field = 'headers'
      }

      const contextId = tx.ident('')
      const selector = tx.template(field)

      let expr: Expr = t.selectorExpr(selector, false, contextId)
      if (mod !== 'headers' && mod !== 'link') {
        if (mod === 'cookies') {
          expr = t.selectorExpr(tx.template('set-cookie'), false, expr)
        }
        expr = t.callExpr(tx.token(mod), undefined, expr)
      }

      const id = `__${mod}_${index}`
      const optional = mod === 'cookies'
      return t.assignmentStmt(tx.token(id), expr, optional)
    })
    return [stmt, ...parserStmts]
  })
}

export function inferContext(): TransformVisitor {
  const scope = new RootScope<Expr>()

  const parsers: Parsers = new Map()
  function getParser(req: RequestExpr, mod: string = getContentMod(req)) {
    const [mods, index] = parsers.get(req) ?? [new Set(), parsers.size]
    mods.add(mod)
    parsers.set(req, [mods, index])
    const id = `__${mod}_${index}`
    return tx.ident(id)
  }

  function infer(node: CExpr, mod?: string) {
    let resolved: Expr
    let from: Expr | undefined
    if (node.context) {
      resolved = node.context
    } else {
      from = scope.context
      invariant(from, new QuerySyntaxError('Unresolved context'))
      resolved =
        from.kind === NodeKind.RequestExpr ? getParser(from, mod) : tx.ident('')
    }
    return { resolved, from }
  }

  const trace = traceVisitor(scope)

  return {
    ...trace,

    Program(node) {
      return { ...node, body: insertParsers(node.body, parsers) }
    },

    SubqueryExpr: {
      enter(node, visit) {
        const xnode = trace.SubqueryExpr.enter(node, visit)
        return { ...xnode, body: insertParsers(xnode.body, parsers) }
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
