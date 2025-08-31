import type { Program, TypeInfo } from '@getlang/ast'
import { Type } from '@getlang/ast'
import { analyze, desugar, inference, parse } from '@getlang/parser'
import type { Hooks, Inputs, Modifier } from '@getlang/utils'
import {
  ImportError,
  RecursiveCallError,
  ValueTypeError,
} from '@getlang/utils/errors'
import { partition } from 'lodash-es'
import type { RuntimeValue } from './value.js'
import { materialize } from './value.js'

type Info = {
  ast: Program
  inputs: Set<string>
  imports: Set<string>
  isMacro: boolean
}

type Entry = {
  program: Program
  inputs: Set<string>
  returnType: TypeInfo
}

type ModEntry = {
  mod: Modifier
  returnType: TypeInfo
}

export type Execute = (entry: Entry, inputs: Inputs) => Promise<any>

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

export class Modules {
  private info: Record<string, Promise<Info>> = {}
  private entries: Record<string, Promise<Entry>> = {}
  private modifiers: Record<string, Promise<ModEntry | null>> = {}

  constructor(
    private hooks: Required<Hooks>,
    private execute: Execute,
  ) {}

  async load(module: string): Promise<Info> {
    const source = await this.hooks.import(module)
    const ast = parse(source)
    const info = analyze(ast)
    return { ast, ...info }
  }

  async getInfo(module: string) {
    this.info[module] ??= this.load(module)
    return this.info[module]
  }

  async compile(
    module: string,
    stack: string[],
    contextType?: TypeInfo,
  ): Promise<Entry> {
    const { ast, inputs, imports } = await this.getInfo(module)
    const macros: string[] = []
    for (const i of imports) {
      const depInfo = await this.getInfo(i)
      if (depInfo.isMacro) {
        macros.push(i)
      }
    }
    const { program: simplified, calls, modifiers } = desugar(ast, macros)

    const returnTypes: Record<string, TypeInfo> = {}
    for (const call of calls) {
      const { returnType } = await this.import(call, stack)
      returnTypes[call] = returnType
    }
    for (const mod of modifiers) {
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
  }

  import(module: string, prev: string[] = [], contextType?: TypeInfo) {
    const stack = [...prev, module]
    if (prev.includes(module)) {
      throw new RecursiveCallError(stack)
    }
    const key = buildImportKey(module, contextType)
    this.entries[key] ??= this.compile(module, stack, contextType)
    return this.entries[key]
  }

  async compileMod(mod: string): Promise<ModEntry | null> {
    const compiled = await this.hooks.modifier(mod)
    if (!compiled) {
      return null
    }
    return { mod: compiled.modifier, returnType: { type: Type.Value } }
  }

  importMod(mod: string) {
    this.modifiers[mod] ??= this.compileMod(mod)
    return this.modifiers[mod]
  }

  async call(module: string, args: RuntimeValue, contextType?: TypeInfo) {
    let entry: Entry
    try {
      entry = await this.import(module, [], contextType)
    } catch (e) {
      const err = `Failed to import module: ${module}`
      throw new ImportError(err, { cause: e })
    }
    const [inputArgs, attrArgs] = partition(Object.entries(args.data), e =>
      entry.inputs.has(e[0]),
    )
    const inputs = Object.fromEntries(inputArgs)
    let extracted = await this.hooks.call(module, inputs)
    if (typeof extracted === 'undefined') {
      extracted = await this.execute(entry, inputs)
    }
    await this.hooks.extract(module, inputs, extracted.data)

    function dropWarning(reason: string) {
      if (attrArgs.length) {
        const dropped = attrArgs.map(e => e[0]).join(', ')
        const err = [
          `Module '${module}' ${reason}`,
          `dropping view attributes: ${dropped}`,
        ].join(', ')
        console.warn(err)
      }
    }

    if (entry.returnType.type !== Type.Value) {
      dropWarning(`returned ${repr(entry.returnType)}`)
      return extracted
    }

    if (typeof extracted !== 'object') {
      dropWarning('returned a primitive')
      return extracted
    }

    const data = Object.fromEntries(attrArgs)
    const raster = materialize({ data, typeInfo: args.typeInfo })
    return { ...raster, ...extracted }
  }
}
