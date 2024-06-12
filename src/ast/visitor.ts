import type { Node, Stmt, Expr } from './ast'
import { NodeKind } from './ast'

type Transform<T, OldT1, NewT1, OldT2, NewT2> = T extends OldT1
  ? NewT1
  : T extends OldT2
    ? NewT2
    : T extends Array<infer E>
      ? Transform<E, OldT1, NewT1, OldT2, NewT2>[]
      : T extends Record<string, unknown>
        ? { [Key in keyof T]: Transform<T[Key], OldT1, NewT1, OldT2, NewT2> }
        : T

type TransformNode<T extends Node, ST, ET> = Omit<
  {
    [Key in keyof T]: Transform<T[Key], Stmt, ST, Expr, ET>
  } & {
    $visitorInfo?: any
  },
  'kind'
>

type EntryVisitor<N extends Node, ST, ET> = (
  node: N,
  visit: any
) => TransformNode<N, ST, ET> | void

type ExitVisitor<N extends Node, ST, ET> = (
  node: TransformNode<N, ST, ET>
) => N extends Stmt ? ST : ET

type NodeVisitor<N extends Node, ST, ET> = {
  enter?: EntryVisitor<N, ST, ET>
  exit: ExitVisitor<N, ST, ET>
}

type NodeConfig<N extends Node, ST, ET> =
  | NodeVisitor<N, ST, ET>
  | ExitVisitor<N, ST, ET>

type Nodes = typeof NodeKind

export type Visitor<StmtT, ExprT = StmtT> = {
  [N in keyof Nodes]?: NodeConfig<
    Extract<Node, { kind: Nodes[N] }>,
    StmtT,
    ExprT
  >
}

export type ExhaustiveVisitor<StmtT, ExprT = StmtT> = Required<
  Visitor<StmtT, ExprT>
>

const isVisitable = (node: any): node is Node =>
  node && Object.keys(NodeKind).includes(node.kind)

const id = (_id: any) => _id

const getFinalVisitor = <N extends Node, ST, ET>(
  cfg: NodeConfig<N, ST, ET>
): NodeVisitor<N, ST, ET> => {
  if (typeof cfg === 'function') {
    return { exit: cfg }
  }

  const defaultVisitor = { exit: id }
  return Object.assign(defaultVisitor, cfg)
}

function visit<ST, ET>(node: Stmt, visitor: Visitor<ST, ET>): ST
function visit<ST, ET>(node: Expr, visitor: Visitor<ST, ET>): ST
function visit<ST, ET>(node: Stmt | Expr, visitor: Visitor<ST, ET>): ST {
  function _visit(node: Stmt): ST
  function _visit(node: Expr): ET
  function _visit(node: Node): ST | ET {
    const transform = (node: any): any => {
      const entries = Object.entries(node).map(([key, value]) => {
        if (isVisitable(value as any)) {
          return [key, _visit(value as any)]
        }

        if (Array.isArray(value)) {
          if (!value.length) {
            return [key, []]
          }
          if (isVisitable(value[0])) {
            return [key, value.map(v => _visit(v))]
          }
          return [key, value.map(v => transform(v))]
        }

        if (typeof value === 'object') {
          return [key, transform(value)]
        }

        return [key, value]
      })
      return Object.fromEntries(entries)
    }

    const cfg = visitor[node.kind] || {}
    const nodeVisitor = getFinalVisitor(cfg as any)
    const transformedNode = nodeVisitor.enter?.(node, _visit) || transform(node)
    return nodeVisitor.exit(transformedNode) as any
  }

  return _visit(node as Stmt)
}

export { visit }
