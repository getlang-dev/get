import { desugar, parse } from '@getlang/parser'
import type { CallExpr, Program } from '@getlang/parser/ast'
import type { Hooks, MaybePromise } from '@getlang/utils'
import { ImportError } from '@getlang/utils/errors'
import { partition } from 'lodash-es'
import { collectInputs } from './validation.js'
import { toValue } from './value.js'

type Entry = { source: string; program: Program; inputs: Set<string> }
type Cache = Record<string, MaybePromise<Entry>>

export class Modules {
  private cache: Cache = {}
  constructor(private hooks: Hooks) {}

  async load(module: string) {
    const source = await this.hooks.import(module)
    const ast = parse(source)
    const program = desugar(ast)
    const inputs = collectInputs(program)
    return { source, program, inputs }
  }

  import(module: string) {
    this.cache[module] ??= this.load(module)
    return this.cache[module]
  }

  async call(node: CallExpr, args: any) {
    const callee = node.callee.value
    let entry: Entry
    try {
      entry = await this.import(callee)
    } catch (e) {
      const err = `Failed to import module: ${callee}`
      throw new ImportError(err, { cause: e })
    }
    const [inputArgs, attrArgs] = partition(Object.entries(args), e =>
      entry.inputs.has(e[0]),
    )
    const inputs = Object.fromEntries(inputArgs)
    const extracted = await this.hooks.call(callee, inputs)

    if (typeof extracted !== 'object') {
      if (attrArgs.length) {
        const dropped = attrArgs.map(e => e[0]).join(', ')
        const err = [
          `Module '${callee}' returned a primitive`,
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
