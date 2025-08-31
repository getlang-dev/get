import type { TemplateExpr } from '@getlang/ast'
import { isToken, t } from '@getlang/ast'
import { ScopeTracker, transform } from '@getlang/walker'
import { tx } from '../../utils.js'
import type { DesugarPass } from '../desugar.js'

export const addUrlInputs: DesugarPass = ast => {
  const scope = new ScopeTracker()
  const implied = new Set<string>()

  return transform(ast, {
    scope,

    RequestExpr: {
      enter(node) {
        function walkUrl(t: TemplateExpr) {
          for (const el of t.elements) {
            if (isToken(el)) {
              // continue
            } else if (el.kind === 'TemplateExpr') {
              walkUrl(el)
            } else if (el.kind === 'IdentifierExpr') {
              const id = el.id.value
              if (el.isUrlComponent && !scope.vars[id]) {
                implied.add(el.id.value)
              }
            }
          }
        }

        walkUrl(node.url)
      },
    },

    Program(node) {
      if (implied.size) {
        let decl = node.body.find(s => s.kind === 'DeclInputsStmt')
        if (!decl) {
          decl = t.declInputsStmt([])
          node.body.unshift(decl)
        }
        for (const i of implied) {
          decl.inputs.push(t.InputExpr(tx.token(i), false))
        }
      }
    },
  })
}
