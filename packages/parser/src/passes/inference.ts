import type { Program } from '../ast/ast.js'
import type { TypeInfo } from '../ast/typeinfo.js'
import { resolveTypes } from './inference/typeinfo.js'

type InferenceOptions = {
  returnTypes: { [module: string]: TypeInfo }
  contextType?: TypeInfo
}

export function inference(ast: Program, options: InferenceOptions) {
  const { program, returnType } = resolveTypes(ast, options)
  return { program, returnType }
}
