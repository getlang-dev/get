import { wait, waitMap } from '@getlang/utils'
import type { MaybePromise } from '@getlang/utils'
import type { Node, Stmt, Expr } from './ast'
import { NodeKind } from './ast'

export const SKIP = { __skip: true }

type Control = typeof SKIP

type Transform<V, S, E> = V extends V
  ? V extends Stmt
    ? S
    : V extends Expr
      ? E
      : { [K in keyof V]: Transform<V[K], S, E> }
  : never

type TransformNode<N extends Node, S, E> = {
  [K in keyof N]: Transform<N[K], S, E>
}

type NodeConfig<
  N extends Node,
  S,
  E,
  A extends boolean = false,
  TN = TransformNode<N, S, E>,
  XN = Transform<N, S, E>,
  Visit = <C extends Node>(child: C) => Transform<C, S, E>,
  EntryVisitor = (
    node: N,
    visit: Visit,
  ) => A extends true
    ? MaybePromise<TN | undefined | Control>
    : TN | undefined | Control,
  ExitVisitor = (
    node: TN,
    originalNode: N,
  ) => A extends true ? MaybePromise<XN> : XN,
  EntryExitVisitor = (
    node: N,
    visit: Visit,
  ) => A extends true ? MaybePromise<XN | Control> : XN | Control,
> =
  | ExitVisitor
  | { enter?: EntryVisitor; exit?: ExitVisitor }
  | { enter: EntryExitVisitor }

interface NodeVisitor {
  enter?: (node: Node, visit: (c: Node) => any) => any
  exit?: (node: any, originalNode: Node) => any
}

// visitor types
type ExhaustiveVisitor<
  StmtT = Stmt,
  ExprT = StmtT extends Stmt ? Expr : StmtT,
> = {
  [N in Node as N['kind']]: NodeConfig<N, StmtT, ExprT>
}
type PartialVisitor<StmtT = Stmt, ExprT = StmtT extends Stmt ? Expr : StmtT> = {
  [N in Node as N['kind']]?: NodeConfig<N, StmtT, ExprT>
}

type AsyncExhaustiveVisitor<
  StmtT = Stmt,
  ExprT = StmtT extends Stmt ? Expr : StmtT,
> = {
  [N in Node as N['kind']]: NodeConfig<N, StmtT, ExprT, true>
}

type AsyncPartialVisitor<
  StmtT = Stmt,
  ExprT = StmtT extends Stmt ? Expr : StmtT,
> = {
  [N in Node as N['kind']]?: NodeConfig<N, StmtT, ExprT, true>
}

type Visitor<S, E> =
  | ExhaustiveVisitor<S, E>
  | PartialVisitor<S, E>
  | AsyncExhaustiveVisitor<S, E>
  | AsyncPartialVisitor<S, E>

export function visit<N extends Node, S, E>(
  node: N,
  visitor: ExhaustiveVisitor<S, E>,
): Transform<N, S, E>

export function visit<N extends Node, S, E>(
  node: N,
  visitor: PartialVisitor<S, E>,
): [S, E] extends [Stmt, Expr] ? Transform<N, S, E> : unknown

export function visit<N extends Node, S, E>(
  node: N,
  visitor: AsyncExhaustiveVisitor<S, E>,
): Promise<Transform<N, S, E>>

export function visit<N extends Node, S, E>(
  node: N,
  visitor: AsyncPartialVisitor<S, E>,
): Promise<[S, E] extends [Stmt, Expr] ? Transform<N, S, E> : unknown>

export function visit<N extends Node, V extends Visitor<any, any>>(
  node: N,
  visitor: V,
): any {
  function transform<T>(value: T, isRoot?: boolean): any {
    if (!isRoot && isNode(value)) {
      return visit(value, visitor)
    }
    if (Array.isArray(value)) {
      return waitMap(value, el => transform(el))
    }
    if (typeof value === 'object' && value) {
      const entries = waitMap(Object.entries(value), e =>
        wait(transform(e[1]), v => [e[0], v]),
      )
      return wait(entries, e => Object.fromEntries(e))
    }
    return value
  }

  const config = visitor[node.kind] ?? {}
  const nodeVisitor = (
    typeof config === 'function' ? { exit: config } : config
  ) as NodeVisitor

  const entryValue = nodeVisitor.enter?.(node, n => visit(n, visitor))

  return wait(entryValue, x => {
    if (x === SKIP) {
      return node
    }
    const tnode = x ?? transform(node, true)
    return wait(tnode, y => {
      const exitValue = nodeVisitor.exit?.(y, node)
      return wait(exitValue, z => z ?? y)
    })
  })
}

function isNode(value: unknown): value is Node {
  const kind = (value as any)?.kind
  return typeof kind === 'string' && Object.keys(NodeKind).includes(kind)
}

export type {
  ExhaustiveVisitor,
  PartialVisitor as Visitor,
  AsyncExhaustiveVisitor,
  AsyncPartialVisitor as AsyncVisitor,
}
