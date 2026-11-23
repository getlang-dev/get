import type { TypeInfo } from '@getlang/ast'
import { Type } from '@getlang/ast'
import type { Hooks, Inputs } from '@getlang/lib'
import { invariant } from '@getlang/lib'
import { ImportError, RuntimeError, SliceError } from '@getlang/lib/errors'
import { partition } from 'lodash-es'
import type { Registry } from './registry/index.js'
import type { InstancePipeline } from './registry/instance.js'
import type { RuntimeValue } from './value.js'
import { materialize } from './value.js'

export async function callModifier(
  registry: Registry,
  modifier: string,
  args: Record<string, unknown>,
  context?: RuntimeValue,
) {
  const spec = await registry.importModifier(modifier).load()
  let ctx: any = {}
  if (spec.useContext) {
    invariant(context, `Modifier '${modifier}' requires context`)
    ctx = materialize(context)
  }
  try {
    const { mod } = spec
    const options = { ...args, _raw: context?.data }
    return await mod(ctx, options)
  } catch (e) {
    if (e instanceof RuntimeError) {
      throw e
    }
    throw new SliceError({ cause: e })
  }
}

export type Execute = (
  module: string,
  contextType: TypeInfo | undefined,
  inputs: Inputs,
) => Promise<any>

export async function callModule(
  registry: Registry,
  execute: Execute,
  hooks: Hooks,
  module: string,
  args: RuntimeValue,
  contextType?: TypeInfo,
) {
  let instance: InstancePipeline
  try {
    instance = registry.importInstance(module, contextType)
  } catch (e) {
    const err = `Failed to import module: ${module}`
    throw new ImportError(err, { cause: e })
  }
  const simplified = await registry.importModule(module).desugar()
  const [inputArgs, attrArgs] = partition(Object.entries(args.data), e =>
    simplified.inputs.has(e[0]),
  )
  const inputs = materialize({
    data: Object.fromEntries(inputArgs),
    typeInfo: args.typeInfo,
  })

  let extracted = await hooks.call?.(module, inputs)
  if (typeof extracted === 'undefined') {
    extracted = await execute(module, contextType, inputs)
  }
  await hooks.extract?.(module, inputs, extracted.data)

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

  const { returnType } = await instance.types()
  if (returnType.type !== Type.Value) {
    dropWarning('returned unmaterialized value')
    return extracted
  }

  if (typeof extracted !== 'object') {
    dropWarning('returned a primitive')
    return extracted
  }

  const raster = materialize({
    data: Object.fromEntries(attrArgs),
    typeInfo: args.typeInfo,
  })

  return { ...raster, ...extracted }
}
