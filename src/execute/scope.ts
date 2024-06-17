import { invariant, ReferenceError } from '../errors'
import type { Value } from './value'

class Scope {
  vars: Record<string, Value>
  extracted: Value | undefined
  contextStack: Value[]

  constructor(
    parentVars: Record<string, Value> = Object.create(null),
    context?: Value
  ) {
    this.vars = Object.create(parentVars)
    this.contextStack = context ? [context] : []
  }
}

export class RootScope {
  scopeStack: Scope[] = [new Scope()]

  private get scope() {
    const scope = this.scopeStack.at(-1)
    invariant(scope, new ReferenceError('Corrupted scope stack'))
    return scope
  }

  get vars() {
    return this.scope.vars
  }

  pushContext(context: Value) {
    this.scope.contextStack.push(context)
    this.updateContext()
  }

  popContext() {
    this.scope.contextStack.pop()
    this.updateContext()
  }

  get context() {
    return this.scope.contextStack.at(-1)
  }

  updateContext() {
    if (this.context) {
      this.vars[''] = this.context
    } else {
      delete this.vars['']
    }
  }

  set extracted(data: Value) {
    this.scope.extracted = data
  }

  push() {
    this.scopeStack.push(new Scope(this.vars, this.context))
  }

  pop() {
    const data = this.scope.extracted
    this.scopeStack.pop()
    return data
  }
}
