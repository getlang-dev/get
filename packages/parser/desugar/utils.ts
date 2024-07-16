import { toPath } from 'lodash-es'
import type { TemplateExpr, RequestExpr } from '../ast/ast.js'
import { t } from '../ast/ast.js'
import type { TypeInfo, Struct } from '../ast/typeinfo.js'
import { Type } from '../ast/typeinfo.js'

export const render = (template: TemplateExpr) =>
  template.elements.every(e => 'offset' in e)
    ? template.elements.map(e => e.value).join('')
    : null

export function selectTypeInfo(
  typeInfo: Struct,
  selector: TemplateExpr,
): TypeInfo | null {
  const sel = render(selector)
  if (!sel) return null
  return toPath(sel).reduce<TypeInfo>(
    (acc, cur) =>
      (acc.type === Type.Struct && acc.schema[cur]) || { type: Type.Value },
    typeInfo,
  )
}

export function getContentMod(req: RequestExpr) {
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

export function template(contents: string) {
  return t.templateExpr([createToken(contents)])
}
