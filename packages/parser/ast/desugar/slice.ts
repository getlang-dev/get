import { parse } from 'acorn'
import detect from 'acorn-globals'
import globals from 'globals'

const browserGlobals = [
  ...Object.keys(globals.browser),
  ...Object.keys(globals.builtin),
]

export const analyzeSlice = (source: string, includeDeps: boolean) => {
  const ast = parse(source, {
    ecmaVersion: 'latest',
    allowReturnOutsideFunction: true,
  })

  let src = source

  // auto-insert the return statement
  if (ast.body.length === 1 && ast.body[0]?.type !== 'ReturnStatement') {
    src = `return ${src}`
  }

  if (!includeDeps) {
    return { source: src, deps: [] }
  }

  // detect globals and load them from context
  const deps = detect(ast)
    .map(id => id.name)
    .filter(id => !browserGlobals.includes(id))

  if (deps.length) {
    const contextVars = deps.join(', ')
    const loadContext = `const { ${contextVars} } = $\n`
    src = loadContext + src
  }

  return { source: src, deps }
}
