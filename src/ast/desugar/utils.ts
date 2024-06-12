import { NodeKind, t } from '../ast'

type RequestStmt = ReturnType<typeof t.requestStmt>
type TemplateExpr = ReturnType<typeof t.templateExpr>

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

function renderTemplate(template: TemplateExpr) {
  let s = ''
  for (const e of template.elements) {
    if (e.kind !== NodeKind.LiteralExpr) {
      return null
    }
    s += e.value.value
  }
  return s
}

export function getContentMod(req: RequestStmt) {
  const accept = req.headers.find(
    e => renderTemplate(e.key)?.toLowerCase() === 'accept'
  )
  if (accept) {
    const value = renderTemplate(accept.value)?.toLowerCase()
    if (value === 'application/json') {
      return 'json'
    } else if (value === 'application/javascript') {
      return 'js'
    }
  }
  return 'html'
}
