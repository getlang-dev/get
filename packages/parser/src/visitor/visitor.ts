import { wait, waitMap } from '@getlang/utils'
import type { Node } from '../ast/ast.js'
import { NodeKind } from '../ast/ast.js'
import type { AsyncInterpretVisitor, InterpretVisitor } from './interpret.js'
import type { TransformVisitor } from './transform.js'

export type { TransformVisitor, InterpretVisitor, AsyncInterpretVisitor }

interface NodeVisitor {
  enter?: (node: Node, visit: (c: Node) => any) => any
  exit?: (node: any, path: Node[], originalNode: Node) => any
}

type Visitor =
  | TransformVisitor
  | InterpretVisitor<any, any>
  | AsyncInterpretVisitor<any, any>

export function visit<N extends Node, V extends Visitor>(
  node: N,
  visitor: V,
): any {
  function impl<N extends Node>(node: N, path: Node[]) {
    function transform<T>(value: T, isRoot?: boolean): any {
      if (!isRoot && isNode(value)) {
        return impl(value, path)
      } else if (Array.isArray(value)) {
        return waitMap(value, el => transform(el))
      } else if (typeof value === 'object' && value) {
        const entries = waitMap(Object.entries(value), e =>
          wait(transform(e[1]), v => [e[0], v]),
        )
        return wait(entries, e => Object.fromEntries(e))
      } else {
        return value
      }
    }

    const config = visitor[node.kind] ?? {}

    const { enter, exit } = (
      typeof config === 'function' ? { exit: config } : config
    ) as NodeVisitor

    path.push(node)
    const tnode = enter
      ? enter(node, n => impl(n, path))
      : transform(node, true)
    const xnode = wait(tnode, t => (exit ? exit(t, path, node) : t))
    return wait(xnode, x => {
      path.pop()
      return x
    })
  }

  return impl(node, [])
}

function isNode(value: unknown): value is Node {
  const kind = (value as any)?.kind
  return typeof kind === 'string' && Object.keys(NodeKind).includes(kind)
}
