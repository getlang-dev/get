import { invariant } from '@getlang/lib'
import { QuerySyntaxError } from '@getlang/lib/errors'
import { ScopeTracker, transform } from '@getlang/walker'
import type { DesugarPass } from '../desugar.js'

export const resolveContext: DesugarPass = (ast, { parsers, contextual }) => {
  const scope = new ScopeTracker()

  const program = transform(ast, {
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
      invariant(node.headers.kind === 'RequestBlockExpr', '')
      node.headers
      parsers.visit(node)
    },

    SelectorExpr(_node, path) {
      const ctx = scope.context
      if (ctx?.kind === 'RequestExpr') {
        path.insertBefore(parsers.lookup(ctx))
      }
    },

    ModifierExpr(node) {
      const ctx = scope.context
      const mod = node.modifier.value
      if (contextual.includes(mod) && ctx?.kind === 'RequestExpr') {
        // replace modifier with shared parser
        return parsers.lookup(ctx, mod)
      }
    },

    ModuleExpr(node, path) {
      const ctx = scope.context
      const module = node.module.value
      if (contextual.includes(module) && ctx?.kind === 'RequestExpr') {
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
