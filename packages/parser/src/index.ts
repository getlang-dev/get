import { invariant } from '@getlang/utils'
import { QuerySyntaxError } from '@getlang/utils/errors'
import nearley from 'nearley'
import type { Program } from './ast/ast.js'
import lexer from './grammar/lexer.js'
import grammar from './grammar.js'

export { lexer }
export { print } from './ast/print.js'
export { analyze } from './passes/analyze.js'
export { desugar } from './passes/desugar.js'
export { buildCallTable } from './passes/inference/calltable.js'
export { inference } from './passes/inference.js'

export function parse(source: string): Program {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
  try {
    parser.feed(source)
  } catch (e: unknown) {
    if (typeof e === 'object' && e && 'token' in e) {
      throw new QuerySyntaxError(
        lexer.formatError(e.token, 'SyntaxError: Invalid token'),
      )
    }
    throw e
  }

  const [ast, ...rest] = parser.results
  invariant(ast, new QuerySyntaxError('Unexpected end of input'))
  invariant(!rest.length, new QuerySyntaxError('Unexpected parsing error'))
  return ast
}
