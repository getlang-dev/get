import type { Node } from '@getlang/ast'
import { wait, waitMap } from '@getlang/utils'
import { Path } from './path.js'
import type { ScopeTracker } from './scope.js'
import type { Visitor } from './visitor.js'
import { normalize } from './visitor.js'

export { ScopeTracker } from './scope.js'
export { Path }
export type { Visitor }

export type WalkOptions = Visitor & {
  scope?: ScopeTracker
}

export function walk(node: Node, options: WalkOptions, parent?: Path) {
  const { scope, ...visitor } = options
  const { enter, exit } = normalize(visitor[node.kind])

  scope?.enter(node)

  return wait(enter(node, parent), e => {
    const entered = e || node
    const path = parent?.add(entered) || new Path(entered)

    const entries = waitMap(Object.entries(path.node), e => {
      const [key, value] = e
      let val = value
      if (Array.isArray(value)) {
        val = waitMap(value, el => (isNode(el) ? walk(el, options, path) : el))
      } else if (isNode(value)) {
        val = walk(value, options, path)
      }
      return wait(val, x => [key, x])
    })

    const transformed = wait(entries, Object.fromEntries)
    const visited = wait(transformed, t => {
      return wait(exit(t, path), x => x || t)
    })
    return wait(visited, xnode => {
      const applied = path.apply(xnode)
      scope?.exit(applied, path)
      return applied
    })
  })
}

const isNode = (test: unknown): test is Node =>
  typeof test === 'object' &&
  test !== null &&
  'kind' in test &&
  typeof test.kind === 'string'
