/// <reference types="./acorn-globals.d.ts" />

import { invariant } from '@getlang/utils'
import { SliceSyntaxError } from '@getlang/utils/errors'
import type { Program } from 'acorn'
import { parse } from 'acorn'
import detect from 'acorn-globals'
import globals from 'globals'
import type { Expr } from '../../ast/ast.js'
import { t } from '../../ast/ast.js'
import { tx } from '../../utils.js'
import type { DesugarPass } from '../desugar.js'

const browserGlobals = [
  ...Object.keys(globals.browser),
  ...Object.keys(globals.builtin),
]

const analyzeSlice = (_source: string, analyzeDeps: boolean) => {
  let ast: Program
  try {
    ast = parse(_source, {
      ecmaVersion: 'latest',
      allowReturnOutsideFunction: true,
    })
  } catch (e) {
    throw new SliceSyntaxError('Could not parse slice', { cause: e })
  }

  let source = _source

  // auto-insert the return statement
  if (ast.body.length === 1 && ast.body[0]?.type !== 'ReturnStatement') {
    source = `return ${source}`
  }

  const deps: string[] = []
  if (analyzeDeps) {
    for (const dep of detect(ast).map(id => id.name)) {
      if (!browserGlobals.includes(dep)) {
        deps.push(dep)
      }
    }
  }

  const usesContext = deps.some(d => ['$', '$$'].includes(d))
  const usesVars = deps.some(d => !['$', '$$'].includes(d))

  invariant(
    !(usesContext && usesVars),
    new SliceSyntaxError('Slice must not use context ($) and outer variables'),
  )

  if (usesVars) {
    const contextVars = deps.join(', ')
    const loadContext = `const { ${contextVars} } = $\n`
    source = loadContext + source
  }

  return { source, deps, usesContext }
}

export const insertSliceDeps: DesugarPass = () => {
  return {
    SliceExpr(node) {
      const stat = analyzeSlice(node.slice.value, !node.context)
      const slice = tx.token(stat.source)
      let context: Expr | undefined = node.context
      if (!node.context) {
        if (stat.usesContext) {
          context = tx.ident('')
        } else if (stat.deps.length) {
          const deps = stat.deps.map(id =>
            t.objectEntry(tx.template(id), tx.ident(id)),
          )
          context = t.objectLiteralExpr(deps)
        }
      }
      return { ...node, slice, context }
    },
  }
}
