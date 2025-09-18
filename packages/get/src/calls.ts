import type { TypeInfo } from '@getlang/ast'
import { Type } from '@getlang/ast'
import type { Hooks, Inputs } from '@getlang/lib'
import { cookies, html, invariant, js, json } from '@getlang/lib'
import { ImportError, ValueReferenceError } from '@getlang/lib/errors'
import { partition } from 'lodash-es'
import type { Entry, Registry } from './registry.js'
import type { RuntimeValue } from './value.js'
import { materialize } from './value.js'

export async function callModifier(
  registry: Registry,
  mod: string,
  args: Record<string, unknown>,
  context?: RuntimeValue,
) {
  const entry = await registry.importMod(mod)
  if (entry) {
    let ctx: any
    if (entry?.useContext) {
      if (context && entry.materialize) {
        ctx = materialize(context)
      } else {
        ctx = context?.data
      }
    }
    return entry.mod(ctx, args)
  }

  invariant(context, 'Modifier requires context')

  if (mod === 'link') {
    invariant(typeof args.base === 'string', '@link requires base url')
    const data = html.findLink(context.data)
    const link = materialize({ data, typeInfo: context.typeInfo })
    return new URL(link, args.base).toString()
  }

  const doc = materialize(context)

  switch (mod) {
    case 'html':
      return html.parse(doc)
    case 'js':
      return js.parse(doc)
    case 'json':
      return json.parse(doc)
    case 'cookies':
      return cookies.parse(doc)
    default:
      throw new ValueReferenceError(`Unsupported modifier: ${mod}`)
  }
}

export type Execute = (entry: Entry, inputs: Inputs) => Promise<any>

export async function callModule(
  registry: Registry,
  execute: Execute,
  hooks: Required<Hooks>,
  module: string,
  args: RuntimeValue,
  contextType?: TypeInfo,
) {
  let entry: Entry
  try {
    entry = await registry.import(module, [], contextType)
  } catch (e) {
    const err = `Failed to import module: ${module}`
    throw new ImportError(err, { cause: e })
  }
  const [inputArgs, attrArgs] = partition(Object.entries(args.data), e =>
    entry.inputs.has(e[0]),
  )
  const inputs = Object.fromEntries(inputArgs)
  let extracted = await hooks.call(module, inputs)
  if (typeof extracted === 'undefined') {
    extracted = await execute(entry, inputs)
  }
  await hooks.extract(module, inputs, extracted.data)

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
    dropWarning('returned unmaterialized value')
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
