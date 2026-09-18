import type { Program } from '@getlang/ast'
import { invariant } from '@getlang/lib'
import { QuerySyntaxError } from '@getlang/lib/errors'
import nearley from 'nearley'
import { lexer } from './grammar/lexer.js'
import grammar from './grammar.js'

export function parse(source: string): Program {
  const gr = nearley.Grammar.fromCompiled(grammar)
  const parser = new nearley.Parser(gr)
  try {
    parser.feed(source)
  } catch (e: any) {
    if (e?.token) {
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
