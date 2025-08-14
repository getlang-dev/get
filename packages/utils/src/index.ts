export * from './errors.js'
export * from './hooks.js'
export * from './wait.js'

export class NullSelection {
  constructor(public selector: string) {}
}
