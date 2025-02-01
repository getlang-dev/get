export abstract class RuntimeError extends Error {
  toJSON() {
    return { name: this.name, message: this.message }
  }
}

export class FatalError extends RuntimeError {
  public override name = 'FatalError'

  constructor(options?: ErrorOptions) {
    super('A fatal runtime error occurred', options)
  }
}

export class QuerySyntaxError extends RuntimeError {
  public override name = 'SyntaxError'
}

export class ValueTypeError extends RuntimeError {
  public override name = 'TypeError'
}

export class ValueReferenceError extends RuntimeError {
  public override name = 'ReferenceError'

  constructor(varName: string, options?: ErrorOptions) {
    super(`Unable to locate variable: ${varName}`, options)
  }
}

export class SliceError extends RuntimeError {
  public override name = 'SliceError'

  constructor(options?: ErrorOptions) {
    super('An exception was thrown by the client-side slice', options)
  }
}

export class SliceSyntaxError extends RuntimeError {
  public override name = 'SliceSyntaxError'
}

export class ConversionError extends RuntimeError {
  public override name = 'ConversionError'

  constructor(type: string, options?: ErrorOptions) {
    super(`Attempted to convert unsupported type to value: ${type}`, options)
  }
}

export class SelectorSyntaxError extends RuntimeError {
  public override name = 'SelectorSyntaxError'

  constructor(type: string, selector: string, options?: ErrorOptions) {
    super(`Could not parse ${type} selector '${selector}'`, options)
  }
}

export class NullSelectionError extends RuntimeError {
  public override name = 'NullSelectionError'

  constructor(selector: string, options?: ErrorOptions) {
    super(`The selector '${selector}' did not produce a result`, options)
  }
}

export class NullInputError extends RuntimeError {
  public override name = 'NullInputError'

  constructor(inputName: string, options?: ErrorOptions) {
    super(`Required input '${inputName}' not provided`, options)
  }
}

export class RequestError extends RuntimeError {
  public override name = 'RequestError'

  constructor(url: string, options?: ErrorOptions) {
    super(`Request to url failed: ${url}`, options)
  }
}

export class ImportError extends RuntimeError {
  public override name = 'ImportError'
}

export function invariant(
  condition: unknown,
  err: string | RuntimeError,
): asserts condition {
  if (!condition) {
    throw typeof err === 'string' ? new FatalError({ cause: err }) : err
  }
}
