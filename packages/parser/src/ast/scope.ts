import { invariant } from '@getlang/utils'
import { ValueReferenceError } from '@getlang/utils/errors'

class Scope<T> {
  vars: Record<string, T>
  extracted: T | undefined
  contextStack: T[]

  constructor(parentVars: Record<string, T>, context?: T) {
    this.vars = Object.create(parentVars)
    this.contextStack = context ? [context] : []
  }
}

export class RootScope<T> {
  scopeStack: Scope<T>[] = []

  private get scope() {
    const scope = this.scopeStack.at(-1)
    invariant(scope, new ValueReferenceError('Corrupted scope stack'))
    return scope
  }

  get vars() {
    return this.scope.vars
  }

  pushContext(context: T) {
    this.scope.contextStack.push(context)
    this.updateContext()
  }

  popContext() {
    this.scope.contextStack.pop()
    this.updateContext()
  }

  get context() {
    return this.scopeStack.at(-1)?.contextStack.at(-1)
  }

  updateContext() {
    if (this.context) {
      this.vars[''] = this.context
    } else {
      delete this.scopeStack.at(-1)?.vars['']
    }
  }

  set extracted(data: T) {
    if (this.scope.extracted !== undefined) {
      console.warn('Subqueries must contain a single extract statement')
    } else {
      this.scope.extracted = data
    }
  }

  push(context: T | undefined = this.context) {
    const current = this.scopeStack.at(-1)
    const vars = Object.create(current ? this.vars : null)
    this.scopeStack.push(new Scope(vars, context))
    this.updateContext()
  }

  pop() {
    const data = this.scope.extracted
    this.scopeStack.pop()
    return data
  }
}
