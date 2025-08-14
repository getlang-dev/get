/// <reference types="./html/types.d.ts" />

import { invariant, NullSelection } from '@getlang/utils'
import { NullSelectionError, SelectorSyntaxError } from '@getlang/utils/errors'
import xpath from '@getlang/xpath'
import { selectAll, selectOne } from 'css-select'
import { parse as parseCss } from 'css-what'
import type { AnyHtmlNode } from 'domhandler'
import { textContent } from 'domutils'
import { parse as parse5 } from 'parse5'
import { adapter } from 'parse5-htmlparser2-tree-adapter'
import './html/patch-dom.js'

export { Element } from 'domhandler'

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

  let root = el
  if (el.nodeType === 9) {
    // Document -> HtmlElement
    const html = el.childNodes.find(x => x.nodeType === 1 && x.name === 'html')
    invariant(html, new NullSelectionError(selector))
    root = html
  }

  const value = xpath.select(selector, root)
  if (expand) {
    return value
  }
  return value.length ? value[0] : new NullSelection(selector)
}

const selectCss = (el: AnyHtmlNode, selector: string, expand: boolean) => {
  try {
    parseCss(selector)
  } catch (e) {
    throw new SelectorSyntaxError('CSS', selector, { cause: e })
  }
  const value = expand ? selectAll(selector, el) : selectOne(selector, el)
  if (expand) {
    return value ?? []
  }
  return value === null ? new NullSelection(selector) : value
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
    str = textContent(el).replaceAll(/\s+/g, ' ')
  }
  return str.trim()
}
