import type { TypeInfo } from '@getlang/ast'
import { Type } from '@getlang/ast'
import { invariant, ValueTypeError } from '@getlang/lib/errors'
import { inference } from '@getlang/parser'
import type { ModifierPipeline } from './modifier.ts'
import type { ModulePipeline } from './module.ts'

export type InstancePipeline = ReturnType<typeof instancePipeline>

type LoadModifier = (modifier: string) => ModifierPipeline
type LoadModule = (module: string) => ModulePipeline
type LoadInstance = (module: string, contextType?: TypeInfo) => InstancePipeline

export function buildKey(module: string, typeInfo?: TypeInfo) {
  function repr(ti: TypeInfo): string {
    switch (ti.type) {
      case Type.Maybe:
        return `maybe<${repr(ti.option)}>`
      case Type.List:
        return `${repr(ti.of)}[]`
      case Type.Struct: {
        const fields = Object.entries(ti.schema)
          .map(e => `${e[0]}: ${repr(e[1])};`)
          .join(' ')
        return `{ ${fields} }`
      }
      case Type.Context:
      case Type.Never:
        throw new ValueTypeError('Unsupported key type')
      default:
        return ti.type
    }
  }

  let key = module
  if (typeInfo) {
    key += `<${repr(typeInfo)}>`
  }
  return key
}

export function instancePipeline(
  loadModifier: LoadModifier,
  loadModule: LoadModule,
  loadInstance: LoadInstance,
  load: () => ModulePipeline,
  contextType?: TypeInfo,
) {
  return {
    async types(): ReturnType<typeof inference> {
      const { program } = await load().desugar()
      return inference(program, {
        contextType,
        async getModifier(mod) {
          const entry = await loadModifier(mod).load()
          invariant(entry, `Unable to locate modifier: ${mod}`)
          return { returnType: entry.returnType }
        },
        async getModule(module) {
          const { isMacro } = await loadModule(module).parse()
          return { isMacro }
        },
        async getInstance(module, contextType) {
          const { returnType } = await loadInstance(module, contextType).types()
          return { returnType }
        },
      })
    },
  }
}
