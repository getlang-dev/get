import type { Expr, Node, Stmt } from '../ast/ast.js'
import type { TypeInfo } from '../ast/typeinfo.js'

type FilterNarrow<T> = Expr extends T
  ? FilterNarrow<Exclude<T, Expr>>
  : T extends Stmt | TypeInfo
    ? never
    : T extends Expr
      ? T
      : T extends readonly (infer E)[]
        ? FilterNarrow<E>
        : T extends object
          ? Collect<T>
          : never

type Collect<T> = T extends T
  ? { [K in keyof T]: FilterNarrow<T[K]> }[keyof T]
  : never

type NarrowExpr = Collect<Node>

type Transform<N> = N extends NarrowExpr ? N : N extends Expr ? Expr : Stmt
export type Visit = <C extends Node>(child: C) => Transform<C>

type NodeConfig<
  N extends Node,
  TN = Transform<N>,
  EntryVisitor = (node: N, visit: Visit) => TN,
  ExitVisitor = (node: N) => TN,
> =
  | ExitVisitor
  | {
      enter?: EntryVisitor
      exit?: ExitVisitor
    }

export type TransformVisitor = {
  [N in Node as N['kind']]?: NodeConfig<N>
}
