import type { Node } from '@getlang/ast'
import { wait, waitMap } from '@getlang/utils'
import { Path } from './path.js'
import type { ScopeTracker } from './scope.js'
import type {
  NodeConfig,
  NodeVisitor,
  ReduceVisitor,
  TransformVisitor,
} from './visitor.js'

export { ScopeTracker } from './scope.js'
export type { TransformVisitor, ReduceVisitor, Path }

export type WalkOptions<Visitor> = Visitor & {
  scope?: ScopeTracker
}

function normalize<N extends Node, S, E>(
  visitor?: NodeConfig<N, S, E>,
): NodeVisitor<N, S, E> {
  if (!visitor) {
    return { enter: () => {}, exit: () => {} }
  } else if (typeof visitor === 'function') {
    return { enter: () => {}, exit: visitor }
  } else {
    return {
      enter: visitor.enter || (() => {}),
      exit: visitor.exit || (() => {}),
    }
  }
}

const isNode = (test: unknown): test is Node =>
  typeof test === 'object' &&
  test !== null &&
  'kind' in test &&
  typeof test.kind === 'string'

function walk<N extends Node>(
  node: N,
  visitor: TransformVisitor,
  scope?: ScopeTracker,
  parent?: Path,
) {
  const config = visitor[node.kind] as NodeConfig<N, unknown, unknown>
  const { enter, exit } = normalize<N, unknown, unknown>(config)

  scope?.enter(node)

  const path = parent?.add(node) || new Path(node)
  return wait(enter(node, path), () => {
    let xnode: any = path.replacement
    if (!xnode) {
      const entries = waitMap(Object.entries(node), e => {
        const [key, value] = e
        let val = value
        if (Array.isArray(value)) {
          val = waitMap(value, el =>
            isNode(el) ? walk(el, visitor, scope, path) : el,
          )
        } else if (isNode(value)) {
          val = walk(value, visitor, scope, path)
        }
        return wait(val, x => [key, x])
      })

      const tnode = wait(entries, Object.fromEntries)

      xnode = wait(tnode, t => {
        return wait(exit(t, path), x => x || t)
      })
    }

    return wait(xnode, xnode => {
      const applied = path.apply(xnode)
      scope?.exit(applied, path)
      return applied
    })
  })
}

export function transform(node: Node, options: WalkOptions<TransformVisitor>) {
  return walk(node, options, options.scope)
}

export function reduce<S, E = S>(
  node: Node,
  options: WalkOptions<ReduceVisitor<S, E>>,
) {
  return walk(node, options as TransformVisitor, options.scope)
}
