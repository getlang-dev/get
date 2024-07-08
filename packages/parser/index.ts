import nearley from 'nearley'
import { QuerySyntaxError } from '@getlang/lib'
import grammar from './grammar'
import lexer from './parse/lexer'
import type { Program } from './ast/ast'

export { NodeKind, t } from './ast/ast'
export type { Program, Stmt } from './ast/ast'
export { visit, SKIP } from './ast/visitor'
export type * from './ast/visitor'
export { RootScope } from './ast/scope'
export type { TypeInfo } from './ast/typeinfo'
export { Type } from './ast/typeinfo'
export { desugar } from './ast/simplified'
export { createToken } from './ast/desugar/utils'
export { print } from './ast/print'

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
