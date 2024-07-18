import { parse } from 'acorn'
import detect from 'acorn-globals'
import globals from 'globals'
import type { TransformVisitor } from '../../visitor/transform.js'
import { t } from '../../ast/ast.js'
import { createToken } from '../utils.js'

const browserGlobals = [
  ...Object.keys(globals.browser),
  ...Object.keys(globals.builtin),
]

const analyzeSlice = (_source: string, includeDeps: boolean) => {
  const ast = parse(_source, {
    ecmaVersion: 'latest',
    allowReturnOutsideFunction: true,
  })

  let source = _source

  // auto-insert the return statement
  if (ast.body.length === 1 && ast.body[0]?.type !== 'ReturnStatement') {
    source = `return ${source}`
  }

  if (!includeDeps) {
    return { source, deps: [] }
  }

  // detect globals and load them from context
  const deps = detect(ast)
    .map(id => id.name)
    .filter(id => !browserGlobals.includes(id))

  if (deps.includes('$') || deps.includes('$$')) {
    return { source, deps: [] }
  }

  if (deps.length) {
    const contextVars = deps.join(', ')
    const loadContext = `const { ${contextVars} } = $\n`
    source = loadContext + source
  }

  return { source, deps }
}

export function inferSliceDeps(): TransformVisitor {
  return {
    SliceExpr(node) {
      const stat = analyzeSlice(node.slice.value, !node.context)
      const slice = createToken(stat.source)
      if (stat.deps.length === 0) {
        return { ...node, slice }
      }
      const deps = stat.deps.map(id => ({
        key: t.templateExpr([createToken(id)]),
        value: t.identifierExpr(createToken(id)),
        optional: false,
      }))

      const context = t.objectLiteralExpr(deps)
      return { ...node, slice, context }
    },
  }
}
