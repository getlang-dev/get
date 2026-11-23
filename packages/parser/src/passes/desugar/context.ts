import { invariant } from '@getlang/lib'
import { QuerySyntaxError } from '@getlang/lib/errors'
import { ScopeTracker, transform } from '@getlang/walker'
import type { DesugarPass } from './desugar.js'

export const resolveContext: DesugarPass = async (
  ast,
  parsers,
  { usesContext },
) => {
  const scope = new ScopeTracker()

  const program = await transform(ast, {
    scope,

    Program(node) {
      const body = parsers.insert(node.body)
      return { ...node, body }
    },

    SubqueryExpr(node) {
      const body = parsers.insert(node.body)
      return { ...node, body }
    },

    RequestExpr(node) {
      parsers.visit(node)
    },

    SelectorExpr(_node, path) {
      const ctx = scope.context
      if (ctx?.kind === 'RequestExpr') {
        path.insertBefore(parsers.lookup(ctx))
      }
    },

    async ModifierExpr(node) {
      const ctx = scope.context
      const modifier = node.modifier.value
      if (ctx?.kind === 'RequestExpr' && (await usesContext({ modifier }))) {
        // replace modifier with shared parser
        return parsers.lookup(ctx, modifier)
      }
    },

    async ModuleExpr(node, path) {
      const ctx = scope.context
      const module = node.module.value
      if (ctx?.kind === 'RequestExpr' && (await usesContext({ module }))) {
        path.insertBefore(parsers.lookup(ctx))
      }
    },
  })

  invariant(
    program.kind === 'Program',
    new QuerySyntaxError('Context inference exception'),
  )

  return program
}
