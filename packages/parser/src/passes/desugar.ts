import type { Program } from '@getlang/ast'
import { resolveContext } from './desugar/context.js'
import { dropDrills } from './desugar/dropdrill.js'
import { settleLinks } from './desugar/links.js'
import { RequestParsers } from './desugar/reqparse.js'
import { insertSliceDeps } from './desugar/slicedeps.js'
import { addUrlInputs } from './desugar/urlinputs.js'
import { registerCalls } from './inference/calls.js'

export type DesugarPass = (
  ast: Program,
  tools: {
    parsers: RequestParsers
    macros: string[]
  },
) => Program

const visitors = [
  addUrlInputs,
  resolveContext,
  settleLinks,
  insertSliceDeps,
  dropDrills,
]

export function desugar(ast: Program, macros: string[] = []) {
  const parsers = new RequestParsers()
  const program = visitors.reduce((ast, pass) => {
    parsers.reset()
    return pass(ast, { parsers, macros })
  }, ast)
  // inference pass `registerCalls` is included in the desugar phase
  // it produces the list of called modules required for type inference
  return registerCalls(program, macros)
}
