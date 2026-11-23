import { Type } from '@getlang/ast'
import type { ModifierHook } from '@getlang/lib'
import { invariant, modifiers } from '@getlang/lib'
import { ValueReferenceError } from '@getlang/lib/errors'

export type ModifierPipeline = ReturnType<typeof modifierPipeline>

export function modifierPipeline(
  modifier: string,
  modifierHook?: ModifierHook,
) {
  return {
    async load() {
      const spec =
        modifiers.systemModifiers[modifier] || (await modifierHook?.(modifier))
      invariant(
        spec,
        new ValueReferenceError(`Unsupported modifier: ${modifier}`),
      )

      const {
        modifier: fn,
        useContext = false,
        returnType = { type: Type.Value },
      } = spec

      return {
        mod: fn,
        useContext,
        returnType,
      }
    },
  }
}
