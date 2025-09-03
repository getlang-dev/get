import type { Program, TypeInfo } from '@getlang/ast'
import { Type } from '@getlang/ast'
import type { Hooks, Modifier } from '@getlang/lib'
import { RecursiveCallError, ValueTypeError } from '@getlang/lib/errors'
import { analyze, desugar, inference, parse } from '@getlang/parser'
import type { Pattern } from 'acorn'
import { parse as acorn } from 'acorn'
import { traverse } from 'estree-toolkit'

type ModEntry = {
  mod: Modifier
  useContext: boolean
  returnType: TypeInfo
}

type Info = {
  ast: Program
  imports: Set<string>
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

function inferContext(mod: Modifier) {
  const src = mod.toString()
  const ast = acorn(src, { ecmaVersion: 'latest' })
  let useContext = false
  traverse(ast, {
    $: { scope: true },
    Program(path) {
      const fn = ast.body[0]
      let ctxParam: Pattern | undefined
      if (fn?.type === 'FunctionDeclaration') {
        ctxParam = fn.params[0]
      } else if (fn?.type === 'ExpressionStatement') {
        if (fn.expression.type === 'ArrowFunctionExpression') {
          ctxParam = fn.expression.params[0]
        }
      }
      const fnScope = path.scope?.children[0]
      const bindings = Object.values(fnScope?.bindings || {})
      const ctxBinding = bindings.find(b => b?.identifierPath.node === ctxParam)
      useContext = Boolean(ctxBinding?.references.length)
    },
  })
  return useContext
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
      const fn = compiled.modifier
      const useContext = inferContext(fn)
      const returnType = compiled.typeInfo || { type: Type.Value }
      return { mod: fn, useContext, returnType }
    })
    return this.modifiers[mod]
  }

  private getInfo(module: string) {
    this.info[module] ??= Promise.resolve().then(async () => {
      const source = await this.hooks.import(module)
      const ast = parse(source)
      const { imports, ...info } = analyze(ast)
      let isMacro = info.hasUnboundSelector
      for (const [mod, unbound] of info.modifiers) {
        if (unbound && !isMacro) {
          const entry = await this.importMod(mod)
          isMacro = entry?.useContext || false
        }
      }
      return { ast, imports, isMacro }
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
      const { ast, imports } = await this.getInfo(module)
      const macros: string[] = []
      for (const i of imports) {
        const depInfo = await this.getInfo(i)
        if (depInfo.isMacro) {
          macros.push(i)
        }
      }
      const simplified = desugar(ast, macros)
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
