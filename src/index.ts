import nearley from 'nearley'
import grammar from './grammar'
import lexer from './parse/lexer'
import type { Program } from './ast/ast'

function parse(source: string) {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
  try {
    parser.feed(source)
  } catch (e: unknown) {
    if (typeof e === 'object' && e && 'token' in e) {
      throw new SyntaxError(
        lexer.formatError(e.token, 'SyntaxError: Invalid token')
      )
    }
    throw e
  }

  const { results } = parser

  if (results.length === 1) {
    return results[0] as Program
  } else if (!results.length) {
    throw new SyntaxError('Unexpected end of input')
  } else {
    throw new Error('Ambiguous source')
  }
}

const program = parse(`GET https://example.com\n\nextract { title }`)
console.log(JSON.stringify(program, null, 4))
