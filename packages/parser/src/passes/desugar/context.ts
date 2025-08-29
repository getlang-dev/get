import { invariant } from '@getlang/utils'
import { QuerySyntaxError } from '@getlang/utils/errors'
import { ScopeTracker, walk } from '@getlang/walker'
import { t } from '../../ast/ast.js'
import type { DesugarPass } from '../desugar.js'

export const resolveContext: DesugarPass = (ast, { parsers, macros }) => {
  const scope = new ScopeTracker()

  const program = walk(ast, {
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

    DrillBitExpr(node, path) {
      const ctx = scope.context
      const { bit } = node
      const isModifier = bit.kind === 'ModifierExpr'
      const requireContext =
        isModifier ||
        bit.kind === 'SelectorExpr' ||
        (bit.kind === 'ModuleExpr' && macros.includes(bit.module.value))

      if (!requireContext || ctx?.kind !== 'RequestExpr') {
        return
      }

      const field = isModifier ? bit.modifier.value : undefined
      const resolved = t.drillBitExpr(parsers.lookup(ctx, field))

      if (isModifier) {
        // replace modifier with shared parser
        return resolved
      }

      path.insertBefore(resolved)
    },
  })

  invariant(
    program.kind === 'Program',
    new QuerySyntaxError('Context inference exception'),
  )

  return program
}
