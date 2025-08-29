import { invariant } from '@getlang/utils'
import { SliceSyntaxError } from '@getlang/utils/errors'
import { ScopeTracker, walk } from '@getlang/walker'
import { parse as acorn } from 'acorn'
import { traverse } from 'estree-toolkit'
import globals from 'globals'
import { t } from '../../ast/ast.js'
import { render, tx } from '../../utils.js'
import type { DesugarPass } from '../desugar.js'

const browserGlobals = [
  ...Object.keys(globals.browser),
  ...Object.keys(globals.builtin),
]

function parse(source: string) {
  try {
    return acorn(source, {
      ecmaVersion: 'latest',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    })
  } catch (e) {
    throw new SliceSyntaxError('Could not parse slice', { cause: e })
  }
}

const validAutoInserts = ['ExpressionStatement', 'BlockStatement']

const analyzeSlice = (slice: string) => {
  let source = slice

  const ast = parse(slice)
  if (ast.body.at(-1)?.type === 'EmptyStatement') {
    return null
  }

  const init = ast.body[0]
  invariant(init, new SliceSyntaxError('Empty slice body'))
  if (ast.body.length === 1 && init.type !== 'ReturnStatement') {
    // auto-insert the return statement
    invariant(
      validAutoInserts.includes(init.type),
      new SliceSyntaxError(`Invalid slice body: ${init.type}`),
    )
    source = `return ${source}`
  }

  let ids: string[] = []
  traverse(ast, {
    $: { scope: true },
    Program(path) {
      ids = Object.keys(path.scope?.globalBindings ?? {})
    },
  })
  ids = ids.filter(id => !browserGlobals.includes(id))

  const usesVars = ids.some(d => d !== '$')
  const deps = new Set(ids)
  if (usesVars) {
    const names = [...deps].join(', ')
    source = `var { ${names} } = $\n${source}`
  }

  // add postmark to prevent slice from being re-processed
  source = `${source};;`
  return { source, deps, usesVars }
}

export const insertSliceDeps: DesugarPass = ast => {
  const scope = new ScopeTracker()
  return walk(ast, {
    scope,

    SliceExpr(node, path) {
      const stat = analyzeSlice(node.slice.value)
      if (!stat) {
        return
      }

      const { source, deps, usesVars } = stat
      const xnode = { ...node, slice: tx.token(source) }

      let context = scope.context

      if (usesVars) {
        if (context?.kind !== 'ObjectLiteralExpr') {
          context = t.objectLiteralExpr([])
        }
        const keys = new Set(context.entries.map(e => render(e.key)))
        const missing = deps.difference(keys)
        for (const dep of missing) {
          const id = tx.token(dep, dep === '$' ? '' : dep)
          context.entries.push(
            t.objectEntryExpr(tx.template(dep), t.identifierExpr(id), false),
          )
        }
      }

      if (context !== scope.context) {
        invariant(
          path.parent?.node.kind === 'DrillBitExpr',
          'Slice dependencies require drill expression',
        )
        path.parent.insertBefore(t.drillBitExpr(context))
      }

      return xnode
    },
  })
}
