import type { MaybePromise } from '@getlang/utils'
import type { Expr, Node, Stmt } from '../ast/ast.js'

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
  ST,
  ET,
  A extends boolean = false,
  TN = TransformNode<N, ST, ET>,
  XN = Transform<N, ST, ET>,
  Visit = <C extends Node>(
    child: C,
  ) => A extends true
    ? MaybePromise<Transform<C, ST, ET>>
    : Transform<C, ST, ET>,
  EntryVisitor = (
    node: N,
    visit: Visit,
  ) => A extends true ? MaybePromise<TN> : TN,
  ExitVisitor = (
    node: TN,
    originalNode: N,
  ) => A extends true ? MaybePromise<XN> : XN,
  EntryExitVisitor = (
    node: N,
    visit: Visit,
  ) => A extends true ? MaybePromise<XN> : XN,
> =
  | ExitVisitor
  | { enter?: EntryVisitor; exit?: ExitVisitor }
  | { enter: EntryExitVisitor }

export type InterpretVisitor<ST, ET = ST> = {
  [N in Node as N['kind']]: NodeConfig<N, ST, ET>
}

export type AsyncInterpretVisitor<ST, ET = ST> = {
  [N in Node as N['kind']]: NodeConfig<N, ST, ET, true>
}
