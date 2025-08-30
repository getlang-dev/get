import type { Program } from '@getlang/ast'
import { ScopeTracker, walk } from '@getlang/walker'

export function dropDrills(ast: Program) {
  const scope = new ScopeTracker()

  return walk(ast, {
    scope,

    DrillExpr(node) {
      const [first, ...rest] = node.body
      if (rest.length === 0) {
        return first
      }
    },
  })
}
