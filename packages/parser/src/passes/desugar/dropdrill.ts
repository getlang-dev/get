import type { Program } from '@getlang/ast'
import { ScopeTracker, transform } from '@getlang/walker'

export function dropDrills(ast: Program) {
  const scope = new ScopeTracker()

  return transform(ast, {
    scope,

    DrillExpr(node) {
      const [first, ...rest] = node.body
      if (rest.length === 0) {
        return first
      }
    },
  })
}
