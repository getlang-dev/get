import {
  ConversionError,
  NullSelection,
  SelectorSyntaxError,
  SliceSyntaxError,
  invariant,
} from '@getlang/utils'
import { parse as acorn } from 'acorn'
import type { AnyNode } from 'acorn'
import esquery from 'esquery'

export const parse = (js: string): AnyNode => {
  try {
    return acorn(js, { ecmaVersion: 'latest' })
  } catch (e) {
    throw new SliceSyntaxError('Could not parse slice', { cause: e })
  }
}

export const select = (node: AnyNode, selector: string, expand: boolean) => {
  try {
    const matches = esquery(node as any, selector)
    if (expand) {
      return matches
    }
    return matches.length ? matches[0] : new NullSelection(selector)
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
