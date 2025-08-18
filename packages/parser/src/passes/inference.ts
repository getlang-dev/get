import type { Program } from '../ast/ast.js'
import type { TypeInfo } from '../ast/typeinfo.js'
import { buildCallTable } from './inference/calltable.js'
import { resolveTypes } from './inference/typeinfo.js'

type InferenceOptions = Partial<{
  contextType: TypeInfo
  returnTypes: { [module: string]: TypeInfo }
  macros: string[]
}>

export function inference(ast: Program, options: InferenceOptions = {}) {
  const { contextType, macros } = options
  const { program, returnType } = resolveTypes(ast, contextType)
  const callTable = buildCallTable(program, macros)
  return { program, returnType, callTable }
}
