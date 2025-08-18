import { invariant } from '@getlang/utils'
import { ValueReferenceError } from '@getlang/utils/errors'

class Scope<T> {
  extracted: T | undefined
  private contextStack: T[] = []

  constructor(
    public vars: Record<string, T>,
    context?: T,
  ) {
    context && this.push(context)
  }

  get context() {
    return this.contextStack.at(-1)
  }

  private update() {
    if (this.context) {
      this.vars[''] = this.context
    } else {
      delete this.vars['']
    }
  }

  push(context: T) {
    this.contextStack.push(context)
    this.update()
  }

  pop() {
    this.contextStack.pop()
    this.update()
  }
}

export class RootScope<T> {
  private scopeStack: Scope<T>[] = []

  private get head() {
    return this.scopeStack.at(-1)
  }

  private get ensure() {
    const scope = this.head
    invariant(scope, new ValueReferenceError('Invalid scope stack'))
    return scope
  }

  get vars() {
    return this.ensure.vars
  }

  get context() {
    return this.head?.context
  }

  pushContext(context: T) {
    this.ensure.push(context)
  }

  popContext() {
    this.ensure.pop()
  }

  set extracted(data: T) {
    this.ensure.extracted = data
  }

  push(context: T | undefined = this.head?.context) {
    const vars = Object.create(this.head?.vars ?? null)
    this.scopeStack.push(new Scope(vars, context))
  }

  pop() {
    const data = this.ensure.extracted
    this.scopeStack.pop()
    return data
  }
}
