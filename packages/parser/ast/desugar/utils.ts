import { Type, type TypeInfo } from '@getlang/utils'
import type { Expr, Node } from '../ast'
import { NodeKind, type RequestExpr } from '../ast'

const modTypeMap: Record<string, TypeInfo> = {
  html: { type: Type.Html },
  json: { type: Type.Json },
  js: { type: Type.Js },
  headers: { type: Type.Headers },
  cookies: { type: Type.Cookies },
  link: { type: Type.String },
}

export function getTypeInfo(node: Node | undefined, msg?: string) {
  if (node && 'typeInfo' in node && node.typeInfo) {
    return node.typeInfo
  }
  throw new Error(msg || 'nyet 100')
}

export function getModTypeInfo(mod: string): TypeInfo {
  const typeInfo = modTypeMap[mod]
  if (typeInfo) {
    return typeInfo
  }
  throw new Error('nyet 200')
}

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

export function getContentMod(req: RequestExpr) {
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
