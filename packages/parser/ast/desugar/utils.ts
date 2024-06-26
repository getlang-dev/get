import { toPath } from 'lodash-es'
import { Type, type TypeInfo, ValueTypeError } from '@getlang/utils'
import type { Expr } from '../ast'
import { NodeKind, type RequestExpr } from '../ast'

const modTypeMap: Record<string, TypeInfo> = {
  html: { type: Type.Html },
  json: { type: Type.Unknown },
  js: { type: Type.Js },
  headers: { type: Type.Headers },
  cookies: { type: Type.Cookies },
  link: { type: Type.Unknown },
}

export function getTypeInfo(expr: Expr | undefined, msg?: string) {
  if (expr && 'typeInfo' in expr && expr.typeInfo) {
    return expr.typeInfo
  }
  const errMsg = msg ?? `Failed to locate type info for node: ${expr?.kind}`
  throw new ValueTypeError(errMsg)
}

export function selectTypeInfo(expr: Expr, selector: string): TypeInfo {
  const ti = getTypeInfo(expr)
  return toPath(selector).reduce(
    (acc, cur) =>
      (acc.type === Type.Struct && acc.schema[cur]) || { type: Type.Unknown },
    ti,
  )
}

export function getModTypeInfo(mod: string): TypeInfo {
  const typeInfo = modTypeMap[mod]
  if (typeInfo) {
    return typeInfo
  }
  throw new ValueTypeError(`Failed to locate type info for modifier: ${mod}`)
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
