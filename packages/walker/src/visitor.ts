import type { Expr, Node, Stmt } from '@getlang/ast'
import type { Path } from './index.js'

// -------- Utilities

type Transform<V, S, E> = V extends readonly (infer T)[]
  ? Transform<T, S, E>[]
  : V extends (...args: any) => any
    ? V
    : V extends object
      ? V extends Stmt
        ? S
        : V extends Expr
          ? E
          : { [K in keyof V]: Transform<V[K], S, E> }
      : V

type TNode<N, S, E> = {
  [K in keyof N]: Transform<N[K], S, E>
}

type NodeResult<N, S, E> = N extends Stmt ? S : N extends Expr ? E : never

type Visit<N extends Node, X, R> =
  | ((node: X, path: Path<N>) => R)
  | ((node: X, path: Path<N>) => void)

export type NodeVisitor<N extends Node, X, R> = {
  enter: Visit<N, N, undefined>
  exit: Visit<N, X, R>
}

export type NodeConfig<N extends Node, X, R> =
  | Visit<N, X, R>
  | Partial<NodeVisitor<N, X, R>>

export type TransformVisitor = Partial<{
  [N in Node as N['kind']]: NodeConfig<N, N, N>
}>

export type ReduceVisitor<S, E = S> = Partial<{
  [N in Node as N['kind']]: NodeConfig<N, TNode<N, S, E>, NodeResult<N, S, E>>
}>
