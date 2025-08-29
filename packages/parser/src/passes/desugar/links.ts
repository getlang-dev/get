import { invariant } from '@getlang/utils'
import { QuerySyntaxError } from '@getlang/utils/errors'
import { ScopeTracker, walk } from '@getlang/walker'
import type { Expr, RequestExpr } from '../../ast/ast.js'
import { t } from '../../ast/ast.js'
import { render, tx } from '../../utils.js'
import type { DesugarPass } from '../desugar.js'

export const settleLinks: DesugarPass = (ast, { parsers }) => {
  const scope = new ScopeTracker()

  const bases = new Map<Expr, RequestExpr>()
  function inherit(c: Expr, n: Expr) {
    const base = bases.get(c)
    base && bases.set(n, base)
  }

  const ret = walk(ast, {
    scope,

    IdentifierExpr(node) {
      const value = scope.lookup(node.id.value)
      inherit(value, node)
    },

    DrillExpr(node) {
      inherit(node.body.at(-1), node)
    },

    DrillBitExpr(node) {
      inherit(node.bit, node)
    },

    DrillIdentifierExpr(node) {
      const value = scope.lookup(node.id.value)
      inherit(value, node)
    },

    SelectorExpr(node) {
      invariant(scope.context, new QuerySyntaxError('Unresolved context'))
      inherit(scope.context, node)
    },

    ModifierExpr(node) {
      invariant(
        node.args.kind === 'ObjectLiteralExpr',
        new QuerySyntaxError('Modifier options must be an object'),
      )

      const ctx = scope.context
      if (node.modifier.value === 'link' && ctx) {
        const contextBase = bases.get(ctx)
        const hasBase = node.args.entries.some(e => render(e.key) === 'base')
        if (contextBase && !hasBase) {
          node.args.entries.push(
            t.objectEntryExpr(
              tx.template('base'),
              parsers.lookup(contextBase, 'link'),
            ),
          )
        }
      }

      invariant(ctx, new QuerySyntaxError('Unresolved context'))
      inherit(ctx, node)
    },

    ModuleExpr(node) {
      return {
        ...node,
        args: {
          ...node.args,
          entries: node.args.entries.map(e => {
            if (
              render(e.key) !== '@link' ||
              (e.value.kind === 'ModifierExpr' &&
                e.value.modifier.value === 'link')
            ) {
              return e
            }
            const value = t.modifierExpr(tx.token('link'), undefined, e.value)
            return { ...e, value }
          }),
        },
      }
    },

    RequestExpr(node) {
      parsers.visit(node)
      bases.set(node, node)
      return node
    },

    Program(node) {
      const body = parsers.insert(node.body)
      return { ...node, body }
    },

    SubqueryExpr(node) {
      if (scope.extracted) {
        inherit(scope.extracted, node)
      }
      const body = parsers.insert(node.body)
      return { ...node, body }
    },
  })

  return ret
}
