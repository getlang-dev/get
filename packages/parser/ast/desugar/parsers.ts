import type { Stmt, RequestExpr, Expr } from '../ast'
import { NodeKind, t } from '../ast'
import { createToken } from './utils'

export type Parsers = Map<RequestExpr, [Set<string>, number]>

function template(contents: string) {
  return t.templateExpr([t.literalExpr(createToken(contents))])
}

export function insertParsers(stmts: Stmt[], parsers: Parsers) {
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
      const contextId = t.identifierExpr(createToken(''))
      const field = ['headers', 'cookies'].includes(mod) ? 'headers' : 'body'
      const selector = template(field)
      let expr: Expr = t.selectorExpr(selector, false, contextId)

      if (mod !== 'headers') {
        if (mod === 'cookies') {
          expr = t.selectorExpr(template('set-cookie'), false, expr)
        }
        expr = t.modifierExpr(createToken(mod), expr)
      }

      const id = `__${mod}_${index}`
      const optional = mod === 'cookies'
      return t.assignmentStmt(createToken(id), expr, optional)
    })
    return [stmt, ...parserStmts]
  })
}
