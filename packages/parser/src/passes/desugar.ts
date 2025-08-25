import type { Program } from '../ast/ast.js'
import type { TransformVisitor } from '../visitor/visitor.js'
import { visit } from '../visitor/visitor.js'
import { resolveContext } from './desugar/context.js'
import { settleLinks } from './desugar/links.js'
import { RequestParsers } from './desugar/reqparse.js'
import { insertSliceDeps } from './desugar/slicedeps.js'
import { registerCalls } from './inference/calls.js'

export type DesugarPass = (tools: {
  parsers: RequestParsers
  macros: string[]
}) => TransformVisitor

function listCalls(ast: Program) {
  const calls = new Set<string>()
  const modifiers = new Set<string>()
  visit(ast, {
    ModuleExpr(node) {
      if (node.call) {
        calls.add(node.module.value)
      }
    },
    ModifierExpr(node) {
      modifiers.add(node.modifier.value)
    },
  } as TransformVisitor)
  return { calls, modifiers }
}

export function desugar(ast: Program, macros: string[] = []) {
  const parsers = new RequestParsers()
  const visitors = [resolveContext, settleLinks, insertSliceDeps]
  let program = visitors.reduce((ast, pass) => {
    parsers.reset()
    const visitor = pass({ parsers, macros })
    return visit(ast, visitor)
  }, ast)

  // inference pass `registerCalls` is included in the desugar phase
  // it produces the list of called modules required for type inference
  program = registerCalls(program, macros)
  const { calls, modifiers } = listCalls(program)
  return { program, calls, modifiers }
}
