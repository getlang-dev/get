import type { Node } from '@getlang/ast'
import { invariant } from '@getlang/utils'
import { ValueReferenceError } from '@getlang/utils/errors'
import type { Path } from './index.js'

class Scope<T> {
  extracted?: T

  constructor(
    public vars: { [name: string]: T },
    public context: T | undefined,
  ) {}

  lookup(id: string) {
    const value = id ? this.vars[id] : this.context
    invariant(value !== undefined, new ValueReferenceError(id))
    return value
  }
}

export class ScopeTracker<T = any> {
  scopeStack: Scope<T>[] = []

  push(context: T | undefined = this.head?.context) {
    const vars = Object.create(this.head?.vars ?? null)
    this.scopeStack.push(new Scope(vars, context))
  }

  pop() {
    this.scopeStack.pop()
  }

  private get head() {
    return this.scopeStack.at(-1)
  }

  private get ensure() {
    invariant(this.head, new ValueReferenceError('Invalid scope stack'))
    return this.head
  }

  set context(value: T) {
    this.ensure.context = value
  }

  get context(): T | undefined {
    return this.ensure.context
  }

  get vars() {
    return this.ensure.vars
  }

  get extracted(): T | undefined {
    return this.ensure.extracted
  }

  set extracted(data: T) {
    this.ensure.extracted = data
  }

  lookup(id: string) {
    return this.ensure.lookup(id)
  }

  enter(node: Node) {
    switch (node.kind) {
      case 'Program':
      case 'SubqueryExpr':
      case 'DrillExpr':
        this.push()
        break
    }
  }

  exit(xnode: any, path: Path) {
    switch (path.node.kind) {
      case 'Program':
      case 'SubqueryExpr':
      case 'DrillExpr':
        this.pop()
        break

      case 'RequestStmt':
        this.context = xnode.request
        break

      case 'InputExpr':
        this.vars[path.node.id.value] = xnode
        break

      case 'AssignmentStmt':
        this.vars[path.node.name.value] = xnode.value
        break

      case 'ExtractStmt':
        this.extracted = xnode.value
        break
    }

    if (path.parent?.node.kind === 'DrillExpr') {
      this.context = xnode
    }
  }
}
