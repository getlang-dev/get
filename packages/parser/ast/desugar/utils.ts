import type { Expr } from '../ast'
import { NodeKind, type t } from '../ast'

type RequestStmt = ReturnType<typeof t.requestStmt>

export function createToken(text: string, value = text) {
  return {
    text,
    value,
    lineBreaks: 0,
    offset: 0,
    line: 0,
    col: 0,
  }
}

function literalExpr(expr: Expr): string | null {
  if (expr.kind === NodeKind.LiteralExpr) {
    return expr.value.value
  }
  if (expr.kind !== NodeKind.TemplateExpr || expr.elements.length !== 1) {
    return null
  }
  return expr.elements[0] ? literalExpr(expr.elements[0]) : null
}

export function getContentMod(req: RequestStmt) {
  const accept = req.headers.find(
    e => literalExpr(e.key)?.toLowerCase() === 'accept',
  )
  switch (accept && literalExpr(accept.value)?.toLowerCase()) {
    case 'application/json':
      return 'json'
    case 'application/javascript':
      return 'js'
    default:
      return 'html'
  }
}
