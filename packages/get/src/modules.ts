import { analyze, desugar, inference, parse } from '@getlang/parser'
import type { ModuleExpr, Program } from '@getlang/parser/ast'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import type { Hooks, Inputs } from '@getlang/utils'
import {
  ImportError,
  RecursiveCallError,
  ValueTypeError,
} from '@getlang/utils/errors'
import { partition } from 'lodash-es'
import { toValue } from './value.js'

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

export type Execute = (entry: Entry, inputs: Inputs) => Promise<any>

function buildImportKey(module: string, typeInfo?: TypeInfo) {
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

export class Modules {
  private info: Record<string, Promise<Info>> = {}
  private entries: Record<string, Promise<Entry>> = {}

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
    const { program: simplified, calls } = desugar(ast, macros)

    const returnTypes: Record<string, TypeInfo> = {}
    for (const call of calls) {
      const { returnType } = await this.import(call, stack)
      returnTypes[call] = returnType
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

  async call(node: ModuleExpr, args: any, contextType?: TypeInfo) {
    const module = node.module.value
    let entry: Entry
    try {
      entry = await this.import(module, [], contextType)
    } catch (e) {
      const err = `Failed to import module: ${module}`
      throw new ImportError(err, { cause: e })
    }
    const [inputArgs, attrArgs] = partition(Object.entries(args), e =>
      entry.inputs.has(e[0]),
    )
    const inputs = Object.fromEntries(inputArgs)
    let extracted = await this.hooks.call(module, inputs)
    if (typeof extracted === 'undefined') {
      extracted = await this.execute(entry, inputs)
    }
    await this.hooks.extract(module, inputs, extracted)

    if (typeof extracted !== 'object' || entry.returnType.type !== Type.Value) {
      if (attrArgs.length) {
        const dropped = attrArgs.map(e => e[0]).join(', ')
        const err = [
          `Module '${module}' returned a primitive`,
          `dropping view attributes: ${dropped}`,
        ].join(', ')
        console.warn(err)
      }
      return extracted
    }

    const attrs = Object.fromEntries(attrArgs)
    const raster = toValue(attrs, node.args.typeInfo)
    return { ...raster, ...extracted }
  }
}
