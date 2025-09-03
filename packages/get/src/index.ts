import type { Hooks, Inputs } from '@getlang/lib'
import { buildHooks } from '@getlang/lib'
import { execute as exec } from './execute.js'

export function execute(
  source: string,
  inputs: Inputs = {},
  hooks: Hooks = {},
) {
  const system = buildHooks(hooks)
  return exec('Default', inputs, {
    ...system,
    import() {
      this.import = system.import
      return source
    },
  })
}

export async function executeModule(
  module: string,
  inputs: Inputs = {},
  hooks: Hooks = {},
) {
  return exec(module, inputs, buildHooks(hooks))
}
