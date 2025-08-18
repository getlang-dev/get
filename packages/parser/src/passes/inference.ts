import type { Program } from '../ast/ast.js'
import type { TypeInfo } from '../ast/typeinfo.js'
import { buildCallTable } from './inference/calltable.js'
import { resolveTypes } from './inference/typeinfo.js'

type InferenceOptions = {
  macros: string[]
  returnTypes: { [module: string]: TypeInfo }
  contextType?: TypeInfo
}

export function inference(ast: Program, options: InferenceOptions) {
  const { macros } = options
  const { program, returnType } = resolveTypes(ast, {
    callTable: buildCallTable(ast, macros),
    ...options,
  })
  const callTable = buildCallTable(program, macros)
  return { program, returnType, callTable }
}
