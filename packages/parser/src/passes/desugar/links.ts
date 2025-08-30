import { t } from '@getlang/ast'
import { invariant } from '@getlang/utils'
import { QuerySyntaxError } from '@getlang/utils/errors'
import { walk } from '@getlang/walker'
import { render, tx } from '../../utils.js'
import type { DesugarPass } from '../desugar.js'
import { LineageTracker } from '../lineage.js'

export const settleLinks: DesugarPass = (ast, { parsers }) => {
  const scope = new LineageTracker()

  const ret = walk(ast, {
    scope,

    ModifierExpr(node) {
      invariant(
        node.args.kind === 'ObjectLiteralExpr',
        new QuerySyntaxError('Modifier options must be an object'),
      )

      const ctx = scope.context
      if (node.modifier.value === 'link' && ctx) {
        const lineage = scope.traceLineageRoot(ctx)
        const hasBase = node.args.entries.some(e => render(e.key) === 'base')
        if (lineage?.kind === 'RequestExpr' && !hasBase) {
          node.args.entries.push(
            t.objectEntryExpr(
              tx.template('base'),
              parsers.lookup(lineage, 'link'),
            ),
          )
        }
      }
    },

    ModuleExpr(node) {
      const linkArg = node.args.entries.find(e => render(e.key) === '@link')
      if (!linkArg) {
        return
      }
      const { value } = linkArg
      invariant(value.kind === 'DrillExpr', 'Module links [1]')
      const base = scope.getLineage(value)
      invariant(base, 'Module links [2]')
      if (base.kind === 'ModifierExpr') {
        return
      }
      const root = scope.traceLineageRoot(value)
      invariant(root?.kind === 'RequestExpr', 'Module links [3]')
      const mod = t.modifierExpr(
        tx.token('link'),
        t.objectLiteralExpr([
          t.objectEntryExpr(tx.template('base'), parsers.lookup(root, 'link')),
        ]),
      )
      value.body.push(mod)
    },

    RequestExpr(node) {
      parsers.visit(node)
    },

    Program(node) {
      const body = parsers.insert(node.body)
      return { ...node, body }
    },

    SubqueryExpr(node) {
      const body = parsers.insert(node.body)
      return { ...node, body }
    },
  })

  return ret
}
