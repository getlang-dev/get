import type { Program, TypeInfo } from '@getlang/ast'
import { Type } from '@getlang/ast'
import type { Hooks, Modifier } from '@getlang/lib'
import { RecursiveCallError, ValueTypeError } from '@getlang/lib/errors'
import { analyze, desugar, inference, parse } from '@getlang/parser'

type ModEntry = {
  mod: Modifier
  useContext: boolean
  materialize: boolean
  returnType: TypeInfo
}

type Info = {
  ast: Program
  imports: string[]
  contextMods: string[]
  isMacro: boolean
}

export type Entry = {
  program: Program
  inputs: Set<string>
  returnType: TypeInfo
}

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

function buildImportKey(module: string, typeInfo?: TypeInfo) {
  let key = module
  if (typeInfo) {
    key += `<${repr(typeInfo)}>`
  }
  return key
}

export class Registry {
  private info: Record<string, Promise<Info>> = {}
  private entries: Record<string, Promise<Entry>> = {}
  private modifiers: Record<string, Promise<ModEntry | null>> = {}

  constructor(private hooks: Required<Hooks>) {}

  importMod(mod: string) {
    this.modifiers[mod] ??= Promise.resolve().then(async () => {
      const compiled = await this.hooks.modifier(mod)
      if (!compiled) {
        return null
      }

      const {
        modifier: fn,
        useContext = false,
        materialize = true,
        returnType = { type: Type.Value },
      } = compiled

      return {
        mod: fn,
        useContext,
        materialize,
        returnType,
      }
    })
    return this.modifiers[mod]
  }

  private getInfo(module: string) {
    this.info[module] ??= Promise.resolve().then(async () => {
      const source = await this.hooks.import(module)
      const ast = parse(source)
      const info = analyze(ast)
      const imports = [...info.imports]
      const contextMods: string[] = []
      for (const mod of info.modifiers.keys()) {
        const entry = await this.importMod(mod)
        if (entry?.useContext ?? true) {
          contextMods.push(mod)
        }
      }
      const isMacro =
        info.hasUnboundSelector ||
        contextMods.some(mod => info.modifiers.get(mod))
      return { ast, imports, contextMods, isMacro }
    })
    return this.info[module]
  }

  import(module: string, prev: string[] = [], contextType?: TypeInfo) {
    const stack = [...prev, module]
    if (prev.includes(module)) {
      throw new RecursiveCallError(stack)
    }
    const key = buildImportKey(module, contextType)
    this.entries[key] ??= Promise.resolve().then(async () => {
      const { ast, imports, contextMods } = await this.getInfo(module)
      const contextual = [...contextMods]
      for (const i of imports) {
        const depInfo = await this.getInfo(i)
        if (depInfo.isMacro) {
          contextual.push(i)
        }
      }
      const simplified = desugar(ast, contextual)
      const { inputs, calls, modifiers } = analyze(simplified)

      const returnTypes: Record<string, TypeInfo> = {}
      for (const call of calls) {
        const { returnType } = await this.import(call, stack)
        returnTypes[call] = returnType
      }
      for (const mod of modifiers.keys()) {
        const entry = await this.importMod(mod)
        if (entry) {
          returnTypes[mod] = entry.returnType
        }
      }

      const { program, returnType } = inference(simplified, {
        returnTypes,
        contextType,
      })

      return { program, inputs, returnType }
    })
    return this.entries[key]
  }
}
