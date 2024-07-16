import { invariant, QuerySyntaxError } from '@getlang/lib'
import type { CExpr, Expr, RequestExpr, Stmt } from '../../ast/ast.js'
import { NodeKind, t } from '../../ast/ast.js'
import { RootScope } from '../../ast/scope.js'
import type { Visitor } from '../../ast/visitor.js'
import { createToken, getContentMod, template } from '../utils.js'
import { traceVisitor } from '../trace.js'

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
      if (mod === 'url') {
        field = 'url'
      } else if (mod === 'headers' || mod === 'cookies') {
        field = 'headers'
      }

      const contextId = t.identifierExpr(createToken(''))
      const selector = template(field)

      let expr: Expr = t.selectorExpr(selector, false, contextId)
      if (mod !== 'headers' && mod !== 'url') {
        if (mod === 'cookies') {
          expr = t.selectorExpr(template('set-cookie'), false, expr)
        }
        expr = t.modifierExpr(createToken(mod), undefined, expr)
      }

      const id = `__${mod}_${index}`
      const optional = mod === 'cookies'
      return t.assignmentStmt(createToken(id), expr, optional)
    })
    return [stmt, ...parserStmts]
  })
}

export function inferContext(): Visitor {
  const scope = new RootScope<Expr>()

  function requireContext() {
    invariant(scope.context, new QuerySyntaxError('Unresolved context'))
    return scope.context
  }

  const parsers: Parsers = new Map()
  function getParser(req: RequestExpr, mod: string = getContentMod(req)) {
    const [mods, index] = parsers.get(req) ?? [new Set(), parsers.size]
    mods.add(mod)
    parsers.set(req, [mods, index])
    const id = `__${mod}_${index}`
    return t.identifierExpr(createToken(id))
  }

  function infer(node: CExpr, mod?: string) {
    let context = node.context
    let from: Expr | undefined
    if (!node.context) {
      from = requireContext()
      context =
        from.kind === NodeKind.RequestExpr
          ? getParser(from, mod)
          : t.identifierExpr(createToken(''))
    }
    return { context, from }
  }

  const trace = traceVisitor(scope)

  return {
    ...trace,

    Program(node) {
      return { ...node, body: insertParsers(node.body, parsers) }
    },

    FunctionExpr: {
      enter(node, visit) {
        const xnode = trace.FunctionExpr.enter(node, visit)
        return { ...xnode, body: insertParsers(xnode.body, parsers) }
      },
    },

    SelectorExpr: {
      enter(node, visit) {
        const { context } = infer(node)
        return trace.SelectorExpr.enter({ ...node, context }, visit)
      },
    },

    ModifierExpr: {
      enter(node, visit) {
        const mod = node.value.value
        const { context, from } = infer(node, mod)
        const onRequest = from?.kind === NodeKind.RequestExpr
        const xnode = trace.ModifierExpr.enter({ ...node, context }, visit)
        // when inferred to request parser, replace modifier
        return onRequest ? xnode.context : xnode
      },
    },
  }
}
