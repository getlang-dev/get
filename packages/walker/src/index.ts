import type { Node } from '@getlang/ast'
import { wait, waitMap } from '@getlang/utils'
import { Path } from './path.js'
import type { ScopeTracker } from './scope.js'
import type { NodeConfig, Visitor } from './visitor.js'
import { normalize } from './visitor.js'

export { ScopeTracker } from './scope.js'
export type { Visitor, Path }

export type WalkOptions = Visitor & {
  scope?: ScopeTracker
}

export const walk = <N extends Node>(
  node: N,
  options: WalkOptions,
  parent?: Path,
) => {
  const { scope, ...visitor } = options
  const config = visitor[node.kind] as NodeConfig<N>
  const { enter, exit } = normalize<N>(config)

  scope?.enter(node)

  const path = parent?.add(node) || new Path(node)
  return wait(enter(node, path), e => {
    const entered = e || node
    let visited = entered

    if (!path.skipped) {
      const entries = waitMap(Object.entries(entered), e => {
        const [key, value] = e
        let val = value
        if (Array.isArray(value)) {
          val = waitMap(value, el =>
            isNode(el) ? walk(el, options, path) : el,
          )
        } else if (isNode(value)) {
          val = walk(value, options, path)
        }
        return wait(val, x => [key, x])
      })

      const transformed = wait(entries, Object.fromEntries)
      visited = wait(transformed, t => {
        return wait(exit(t, path), x => x || t)
      })
    }

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
