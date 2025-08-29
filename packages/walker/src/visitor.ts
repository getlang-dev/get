import type { Node } from '@getlang/ast'
import type { Path } from './index.js'

type Visit<N extends Node> =
  | ((node: N, path: Path) => N)
  | ((node: N, path: Path) => void)
type NodeVisitor<N extends Node> = { enter: Visit<N>; exit: Visit<N> }
type NodeConfig<N extends Node> = Visit<N> | Partial<NodeVisitor<N>>

export type Visitor = Partial<{
  [N in Node as N['kind']]: NodeConfig<N>
}>

export function normalize<N extends Node>(
  visitor?: NodeConfig<N>,
): NodeVisitor<N> {
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
