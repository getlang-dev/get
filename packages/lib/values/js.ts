import { parse as acorn } from 'acorn'
import type { AnyNode } from 'acorn'
import esquery from 'esquery'
import { SelectorSyntaxError, ConversionError, invariant } from '@getlang/utils'

export const parse = (js: string): AnyNode => {
  return acorn(js, { ecmaVersion: 'latest' })
}

export const select = (node: AnyNode, selector: string, expand: boolean) => {
  try {
    const matches = esquery(node, selector)
    if (expand) {
      return matches
    }
    return matches.length ? matches[0] : undefined
  } catch (e: any) {
    invariant(
      e.name !== 'SyntaxError',
      new SelectorSyntaxError('AST', selector, { cause: e }),
    )
    throw e
  }
}

export const toValue = (node: AnyNode) => {
  invariant(node.type === 'Literal', new ConversionError(node.type))
  return node.value
}
