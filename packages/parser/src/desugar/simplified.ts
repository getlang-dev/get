import { QuerySyntaxError, invariant } from '@getlang/utils'
import type { Program } from '../ast/ast.js'
import { NodeKind } from '../ast/ast.js'
import { visit } from '../visitor/visitor.js'
import { inferContext } from './inference/context.js'
import { inferLinks } from './inference/links.js'
import { inferSliceDeps } from './inference/slicedeps.js'
import { inferTypeInfo } from './inference/typeinfo.js'

export function desugar(ast: Program): Program {
  const visitors = [
    inferContext(),
    inferLinks(),
    inferSliceDeps(),
    inferTypeInfo(),
  ]

  const simplified = visitors.reduce(visit, ast)
  invariant(
    simplified.kind === NodeKind.Program,
    new QuerySyntaxError('Desugar encountered unexpected error'),
  )
  return simplified
}
