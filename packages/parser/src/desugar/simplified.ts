import { invariant } from '@getlang/utils'
import { QuerySyntaxError } from '@getlang/utils/errors'
import type { Program } from '../ast/ast.js'
import { NodeKind } from '../ast/ast.js'
import { visit } from '../visitor/visitor.js'
import { inferContext } from './inference/context.js'
import { inferLinks } from './inference/links.js'
import { inferSliceDeps } from './inference/slicedeps.js'
import { inferTypeInfo } from './inference/typeinfo.js'
import { RequestParsers } from './reqparse.js'

export function desugar(ast: Program): Program {
  const parsers = new RequestParsers()

  const visitors = [
    inferContext(parsers),
    inferLinks(parsers),
    inferSliceDeps(),
    inferTypeInfo(),
  ]

  const simplified = visitors.reduce((prev, curr) => {
    parsers.reset()
    return visit(prev, curr)
  }, ast)

  invariant(
    simplified.kind === NodeKind.Program,
    new QuerySyntaxError('Desugar encountered unexpected error'),
  )

  return simplified
}
