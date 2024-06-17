export abstract class RuntimeError extends Error {
  public override name = 'RuntimeError'

  constructor(...args: any[]) {
    super(...args)
    // workaround: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, RuntimeError.prototype)
  }
}

export class FatalError extends RuntimeError {
  public override name = 'FatalError'

  constructor(...args: any[]) {
    super('A fatal runtime error occurred', ...args)
  }
}

export class SyntaxError extends RuntimeError {
  public override name = 'SyntaxError'
}

export class TypeError extends RuntimeError {
  public override name = 'TypeError'
}

export class SliceError extends RuntimeError {
  public override name = 'SliceError'

  constructor(...args: any[]) {
    super('An exception was thrown by the client-side slice', ...args)
  }
}

export class SliceSyntaxError extends RuntimeError {
  public override name = 'SliceSyntaxError'

  constructor(...args: any[]) {
    super('Could not parse slice', ...args)
  }
}

export class ConversionError extends RuntimeError {
  public override name = 'ConversionError'

  constructor(type: string, ...args: any[]) {
    super(`Attempted to convert unsupported type to value: ${type}`, ...args)
  }
}

export class SelectorSyntaxError extends RuntimeError {
  public override name = 'SelectorSyntaxError'

  constructor(type: string, selector: string, ...args: any[]) {
    super(`Could not parse ${type} selector '${selector}'`, ...args)
  }
}

export class NullSelectionError extends RuntimeError {
  public override name = 'NullSelectionError'

  constructor(selector: string, ...args: any[]) {
    super(`The selector '${selector}' did not produce a result`, args)
  }
}

export class NullInputError extends RuntimeError {
  public override name = 'NullInputError'

  constructor(inputName: string, ...args: any[]) {
    super(`Required input '${inputName}' not provided`, ...args)
  }
}

export class RequestError extends RuntimeError {
  public override name = 'RequestError'

  constructor(url: string, ...args: any[]) {
    super(`Request to url failed: ${url}`, ...args)
  }
}

export class ReferenceError extends RuntimeError {
  public override name = 'ReferenceError'

  constructor(varName: string, ...args: any[]) {
    super(`Unable to locate variable: ${varName}`, ...args)
  }
}

export function invariant(
  condition: unknown,
  err: string | RuntimeError
): asserts condition {
  if (!condition) {
    throw typeof err === 'string' ? new FatalError(err) : err
  }
}
