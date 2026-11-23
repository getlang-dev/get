import type { Hooks, Inputs } from '@getlang/lib'
import { execute as exec } from './execute.js'

export { factory, memodag } from './memodag.js'
export type { Registry } from './registry/index.js'
export { createRegistry } from './registry/index.js'
export { buildKey } from './registry/instance.js'

export function execute(
  source: string,
  inputs: Inputs = {},
  hooks: Hooks = {},
) {
  return exec('Default', inputs, {
    ...hooks,
    import(module) {
      return module === 'Default' ? source : undefined
    },
  })
}

export function executeModule(
  module: string,
  inputs: Inputs = {},
  hooks: Hooks = {},
) {
  return exec(module, inputs, hooks)
}
