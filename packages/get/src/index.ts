import { http, slice } from '@getlang/lib'
import type { Hooks, Inputs } from '@getlang/utils'
import { invariant } from '@getlang/utils'
import { ImportError } from '@getlang/utils/errors'
import { execute as exec } from './execute.js'

function buildHooks(hooks: Hooks): Required<Hooks> {
  return {
    import: (module: string) => {
      const err = 'Imports are not supported by the current runtime'
      invariant(hooks.import, new ImportError(err))
      return hooks.import(module)
    },
    modifier: modifier => hooks.modifier?.(modifier),
    call: hooks.call ?? (() => {}),
    request: hooks.request ?? http.requestHook,
    slice: hooks.slice ?? slice.runSlice,
    extract: hooks.extract ?? (() => {}),
  }
}

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
