import type { Program } from '../ast/ast.js'
import type { TransformVisitor } from '../visitor/visitor.js'
import { visit } from '../visitor/visitor.js'
import { resolveContext } from './desugar/context.js'
import { settleLinks } from './desugar/links.js'
import { RequestParsers } from './desugar/reqparse.js'
import { insertSliceDeps } from './desugar/slicedeps.js'

export type DesugarPass = (tools: {
  parsers: RequestParsers
  macros: string[]
}) => TransformVisitor

export function desugar(ast: Program, macros: string[] = []) {
  const parsers = new RequestParsers()
  const visitors = [resolveContext, settleLinks, insertSliceDeps]
  return visitors.reduce((ast, pass) => {
    parsers.reset()
    const visitor = pass({ parsers, macros })
    return visit(ast, visitor)
  }, ast)
}
