import type { Program } from '@getlang/ast'
import { invariant } from '@getlang/lib'
import { QuerySyntaxError } from '@getlang/lib/errors'
import nearley from 'nearley'
import lexer from './grammar/lexer.js'
import grammar from './grammar.js'

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
