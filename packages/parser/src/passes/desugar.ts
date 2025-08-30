import type { Program } from '@getlang/ast'
import { walk } from '@getlang/walker'
import { resolveContext } from './desugar/context.js'
import { dropDrills } from './desugar/dropdrill.js'
import { settleLinks } from './desugar/links.js'
import { RequestParsers } from './desugar/reqparse.js'
import { insertSliceDeps } from './desugar/slicedeps.js'
import { registerCalls } from './inference/calls.js'

export type DesugarPass = (
  ast: Program,
  tools: {
    parsers: RequestParsers
    macros: string[]
  },
) => Program

function listCalls(ast: Program) {
  const calls = new Set<string>()
  walk(ast, {
    ModuleExpr(node) {
      node.call && calls.add(node.module.value)
    },
  })
  return calls
}

const visitors = [resolveContext, settleLinks, insertSliceDeps, dropDrills]

export function desugar(ast: Program, macros: string[] = []) {
  const parsers = new RequestParsers()
  let program = visitors.reduce((ast, pass) => {
    parsers.reset()
    return pass(ast, { parsers, macros })
  }, ast)

  // inference pass `registerCalls` is included in the desugar phase
  // it produces the list of called modules required for type inference
  program = registerCalls(program, macros)
  const calls = listCalls(program)
  return { program, calls }
}
