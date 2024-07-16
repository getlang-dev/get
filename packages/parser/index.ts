import nearley from 'nearley'
import { QuerySyntaxError } from '@getlang/lib'
import grammar from './grammar.js'
import lexer from './grammar/lexer.js'
import type { Program } from './ast/ast.js'

export { desugar } from './desugar/simplified.js'
export { print } from './ast/print.js'

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

  const { results } = parser
  switch (results.length) {
    case 1:
      return results[0]
    case 0:
      throw new QuerySyntaxError('Unexpected end of input')
    default:
      throw new QuerySyntaxError('Unexpected parsing error')
  }
}
