import type { TypeInfo } from '@getlang/ast'
import type { Hooks } from '@getlang/lib'
import { RecursiveCallError } from '@getlang/lib/errors'
import { factory } from '../memodag.js'
import type { InstancePipeline } from './instance.ts'
import { buildKey, instancePipeline } from './instance.ts'
import type { ModifierPipeline } from './modifier.ts'
import { modifierPipeline } from './modifier.ts'
import type { ModulePipeline } from './module.ts'
import { modulePipeline } from './module.ts'

export interface Registry {
  importModifier(modifier: string): ModifierPipeline
  importModule(module: string): ModulePipeline
  importInstance(
    module: string,
    contextType?: TypeInfo,
    ancestors?: ReadonlySet<string>,
  ): InstancePipeline
}

export function createRegistry(hooks: Hooks = {}) {
  return {
    importModifier: factory(
      (modifier: string): ModifierPipeline =>
        modifierPipeline(modifier, hooks.modifier),
    ),

    importModule: factory(function (
      this: Registry,
      module: string,
    ): ModulePipeline {
      return modulePipeline(
        module,
        modifier => this.importModifier(modifier),
        module => this.importModule(module),
        hooks.import,
      )
    }),

    importInstance: factory(
      function (
        this: Registry,
        module: string,
        contextType?: TypeInfo,
        ancestors: ReadonlySet<string> = new Set(),
      ): InstancePipeline {
        const path = new Set([...ancestors, module])
        return instancePipeline(
          modifier => this.importModifier(modifier),
          module => this.importModule(module),
          (callee, contextType) => {
            if (path.has(callee)) {
              throw new RecursiveCallError([...path, callee])
            }
            return this.importInstance(callee, contextType, path)
          },
          () => this.importModule(module),
          contextType,
        )
      },
      { keyBy: buildKey },
    ),
  }
}
