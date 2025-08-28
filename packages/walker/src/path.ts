import type { Node } from '@getlang/parser/ast'
import { invariant } from '@getlang/utils'

type Staging = {
  before: Node[]
}

type Mutation = Map<Node, Staging>

export class Path {
  private staging: Staging = { before: [] }
  protected mutations: Mutation = new Map()

  constructor(
    public node: Node,
    private parent?: Path,
  ) {}

  add(node: Node) {
    return new Path(node, this)
  }

  insertBefore(node: Node) {
    this.staging.before.push(node)
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
      invariant(this.parent, 'Unable to apply path mutations')
      this.parent.mutations.set(applied, this.staging)
    }
    return applied
  }
}
