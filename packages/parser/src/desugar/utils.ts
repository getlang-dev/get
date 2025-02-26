import { toPath } from 'lodash-es'
import type { Expr, RequestExpr } from '../ast/ast.js'
import { NodeKind, isToken, t } from '../ast/ast.js'
import type { Struct, TypeInfo } from '../ast/typeinfo.js'
import { Type } from '../ast/typeinfo.js'

export const render = (template: Expr) => {
  if (template.kind !== NodeKind.TemplateExpr) {
    return null
  }
  const els = template.elements
  return els?.every(isToken) ? els.map(el => el.value).join('') : null
}

export function selectTypeInfo(
  typeInfo: Struct,
  selector: Expr,
): TypeInfo | null {
  const sel = render(selector)
  if (!sel) {
    return null
  }
  return toPath(sel).reduce<TypeInfo>(
    (acc, cur) =>
      (acc.type === Type.Struct && acc.schema[cur]) || { type: Type.Value },
    typeInfo,
  )
}

export function getContentField(req: RequestExpr) {
  const accept = req.headers.entries.find(
    e => render(e.key)?.toLowerCase() === 'accept',
  )
  switch (accept && render(accept.value)?.toLowerCase()) {
    case 'application/json':
      return 'json'
    case 'application/javascript':
      return 'js'
    default:
      return 'html'
  }
}

function token(text: string, value = text) {
  return {
    text,
    value,
    lineBreaks: 0,
    offset: 0,
    line: 0,
    col: 0,
  }
}

function ident(id: string) {
  return t.identifierExpr(token(id))
}

function template(contents: string) {
  return t.templateExpr([token(contents)])
}

function select(selector: string, context: Expr) {
  return t.selectorExpr(template(selector), false, context)
}

export const tx = { token, ident, template, select }
