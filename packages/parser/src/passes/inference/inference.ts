import type { Program, TypeInfo } from '@getlang/ast'
import { registerCalls } from './calls.js'
import { resolveTypes } from './typeinfo.js'

export type InferenceOptions = {
  contextType?: TypeInfo
  getModifier(modifier: string): Promise<{ returnType: TypeInfo }>
  getModule(module: string): Promise<{ isMacro: boolean }>
  getInstance(
    module: string,
    contextType?: TypeInfo,
  ): Promise<{ returnType: TypeInfo }>
}

export async function inference(ast: Program, options: InferenceOptions) {
  const program = await registerCalls(ast, options)
  return resolveTypes(program, options)
}
