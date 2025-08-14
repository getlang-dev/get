import type { RuntimeError } from './errors.js'
import { FatalError } from './errors.js'

export * from './hooks.js'
export * from './wait.js'

export class NullSelection {
  constructor(public selector: string) {}
}

export function invariant(
  condition: unknown,
  err: string | RuntimeError,
): asserts condition {
  if (!condition) {
    throw typeof err === 'string' ? new FatalError({ cause: err }) : err
  }
}
