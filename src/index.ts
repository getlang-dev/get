import nearley from 'nearley'
import grammar from './grammar'
import lexer from './parse/lexer'
import { desugar } from './ast/simplified'
import { print } from './ast/print'
import { execute as exec } from './execute/execute'
import type * as http from './execute/net/http'
import { SyntaxError, invariant } from './errors'

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
  invariant(results.length !== 0, new SyntaxError('Unexpected end of input'))
  invariant(results.length === 1, new SyntaxError('Ambiguous source'))
  return results[0]
}

function execute(
  source: string,
  inputs: Record<string, unknown> = {},
  requestFn?: http.RequestFn
) {
  const ast = parse(source)
  const simplified = desugar(ast)

  return exec(simplified, inputs, requestFn)
}

export { parse, desugar, execute, print }
