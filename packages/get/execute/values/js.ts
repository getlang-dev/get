import { parse as acorn } from 'acorn'
import type { AnyNode } from 'acorn'
import esquery from 'esquery'
import {
  SelectorSyntaxError,
  NullSelectionError,
  ConversionError,
  invariant,
} from '@getlang/utils'
import type { SelectFn } from './types'

export const parse = (js: string): AnyNode => {
  return acorn(js, { ecmaVersion: 'latest' })
}

export const select: SelectFn<AnyNode> = (
  node,
  selector,
  expand,
  allowNull,
) => {
  try {
    const matches = esquery(node, selector)
    if (expand) {
      return matches
    }
    if (matches.length) {
      return matches[0]
    }
    invariant(allowNull, new NullSelectionError(selector))
  } catch (e: any) {
    invariant(
      e.name !== 'SyntaxError',
      new SelectorSyntaxError('AST', selector, { cause: e }),
    )
    throw e
  }
}

export const getValue = (node: AnyNode) => {
  invariant(node.type === 'Literal', new ConversionError(node.type))
  return node.value
}
