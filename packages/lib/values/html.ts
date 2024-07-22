import type { ElementType } from 'domelementtype'
import type * as dh from 'domhandler'
import { parse as parse5 } from 'parse5'
import { adapter } from 'parse5-htmlparser2-tree-adapter'
import xpath from '@getlang/xpath'
import { textContent } from 'domutils'
import { selectAll, selectOne } from 'css-select'
import { parse as parseCss } from 'css-what'
import {
  SelectorSyntaxError,
  NullSelectionError,
  invariant,
} from '@getlang/utils'
import './patch-dom.js'

declare class Attribute extends dh.Node {
  type: ElementType.Text
  get nodeType(): 2
  value: string
}

export type AnyHtmlNode = dh.AnyNode | Attribute

export const parse = (html: string): AnyHtmlNode => {
  return parse5(html, { treeAdapter: adapter })
}

const selectXpath = (el: AnyHtmlNode, selector: string, expand: boolean) => {
  try {
    const parseXpath = new xpath.XPathParser()
    parseXpath.parse(selector)
  } catch (e) {
    throw new SelectorSyntaxError('XPath', selector, { cause: e })
  }

  let root: AnyHtmlNode = el
  if (el.nodeType === 9) {
    // Document -> HtmlElement
    const html = el.childNodes.find(x => x.nodeType === 1 && x.name === 'html')
    invariant(html, new NullSelectionError(selector))
    root = html
  }

  const result = xpath.select(selector, root)
  if (expand) {
    return result
  }
  return result.length ? result[0] : undefined
}

const selectCss = (el: AnyHtmlNode, selector: string, expand: boolean) => {
  try {
    parseCss(selector)
  } catch (e) {
    throw new SelectorSyntaxError('CSS', selector, { cause: e })
  }
  const result = expand ? selectAll(selector, el) : selectOne(selector, el)
  if (expand) {
    return result ?? []
  }
  return result === null ? undefined : result
}

export const select = (el: AnyHtmlNode, selector: string, expand: boolean) => {
  return selector.startsWith('xpath:')
    ? selectXpath(el, selector.slice(6), expand)
    : selectCss(el, selector, expand)
}

export const toValue = (el: AnyHtmlNode) => {
  let str = ''
  if (el.nodeType === 2) {
    str = el.value
  } else if (textContent(el)) {
    str = textContent(el)
  }
  return str.trim()
}
