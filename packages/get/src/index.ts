import { http, slice } from '@getlang/lib'
import type { Hooks, Inputs, UserHooks } from '@getlang/utils'
import { invariant } from '@getlang/utils'
import { ImportError } from '@getlang/utils/errors'
import { execute as exec } from './execute.js'

function buildHooks(hooks: UserHooks = {}): Hooks {
  return {
    import: (module: string) => {
      invariant(
        hooks.import,
        new ImportError('Imports are not supported by the current runtime'),
      )
      return hooks.import(module)
    },
    call: hooks.call ?? (() => {}),
    request: hooks.request ?? http.requestHook,
    slice: hooks.slice ?? slice.runSlice,
    extract: hooks.extract ?? (() => {}),
  }
}

export function execute(
  source: string,
  inputs: Inputs = {},
  hooks?: UserHooks,
) {
  const system = buildHooks(hooks)
  let rootImported = false
  return exec('Default', inputs, {
    ...system,
    import(module) {
      if (rootImported) {
        return system.import(module)
      }
      rootImported = true
      return source
    },
  })
}

export async function executeModule(
  module: string,
  inputs: Inputs = {},
  hooks?: UserHooks,
) {
  return exec(module, inputs, buildHooks(hooks))
}
