import type { Expr, RequestExpr } from '@getlang/ast'
import { isToken, t } from '@getlang/ast'

export const render = (template: Expr) => {
  if (template.kind !== 'TemplateExpr') {
    return null
  }
  const els = template.elements
  return els?.every(isToken) ? els.map(el => el.value).join('') : null
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

function select(selector: string) {
  return t.selectorExpr(template(selector), false)
}

function drill(...bits: Expr[]) {
  return t.drillExpr(bits.map(bit => t.drillBitExpr(bit)))
}

export const tx = { token, ident, template, select, drill }
