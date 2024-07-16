import { dump } from 'js-yaml'
import { invariant, QuerySyntaxError } from '@getlang/lib'
import type { Program } from '../ast/ast.js'
import { NodeKind } from '../ast/ast.js'
import { visit } from '../ast/visitor.js'
import { inferContext } from './inference/context.js'
import { inferBase } from './inference/base.js'
import { inferSliceDeps } from './inference/slicedeps.js'
import { inferTypeInfo } from './inference/typeinfo.js'

import { print } from '../ast/print.js'
const DEBUG = Boolean(process.env.SIMP)
const DEBUG_AST = Boolean(process.env.AST)

function printYaml(ast: Program) {
  console.log('\n---- execute ast ----')
  console.log(
    dump(ast, {
      indent: 4,
      replacer(_, value) {
        if (typeof value === 'object' && value) {
          if ('offset' in value && 'lineBreaks' in value && 'value' in value) {
            return `TOKEN(${value.value})`
          }
        }
        return value
      },
    }),
  )
}

export function desugar(ast: Program): Program {
  const visitors = [
    inferContext(),
    inferBase(),
    inferSliceDeps(),
    inferTypeInfo(),
  ]

  // const simplified = visitors.reduce(visit, ast)
  // printYaml(ast)

  let prev = print(ast)
  if (DEBUG) {
    console.log('\n---- desugar start ----')
    console.log(prev)
  }

  const simplified = visitors.reduce((ast, visitor, idx) => {
    DEBUG && console.log(`\n---- desugar pass ${idx} ----`)
    const newAst = visit(ast, visitor)
    if (DEBUG) {
      const next = print(newAst)
      console.log(next === prev ? '      ""' : next)
      prev = next
    }
    return newAst
  }, ast)

  invariant(
    simplified.kind === NodeKind.Program,
    new QuerySyntaxError('Desugar encountered unexpected error'),
  )
  DEBUG_AST && printYaml(simplified)
  return simplified
}
