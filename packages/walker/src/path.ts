import type { Node } from '@getlang/ast'

type Staging = {
  before: Node[]
}

type Mutation = Map<Node, Staging>

export class Path<N extends Node = Node> {
  private staging: Staging = { before: [] }
  protected mutations: Mutation = new Map()
  public replacement?: { value: unknown }

  constructor(
    public node: N,
    public parent?: Path,
  ) {}

  add<N extends Node>(node: N) {
    return new Path<N>(node, this)
  }

  insertBefore(node: Node) {
    this.staging.before.push(node)
  }

  replace(value?: any) {
    this.replacement = { value }
  }

  private mutate(node: Node) {
    if (this.mutations.size === 0) {
      return node
    }

    const entries = []
    for (const [key, value] of Object.entries(node)) {
      let val = value
      if (Array.isArray(value)) {
        val = value.flatMap(el => {
          const mut = this.mutations.get(el)
          const { before = [] } = mut ?? {}
          return [...before, el]
        })
      }
      entries.push([key, val])
    }

    return Object.fromEntries(entries)
  }

  apply(node: Node) {
    const applied = this.mutate(node)
    if (this.staging.before.length) {
      if (!this.parent) {
        throw new Error('Unable to apply path mutations')
      }
      this.parent.mutations.set(applied, this.staging)
    }
    return applied
  }
}
