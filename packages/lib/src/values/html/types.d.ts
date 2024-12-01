declare module '@getlang/xpath' {
  import type { AnyHtmlNode } from 'domhandler'

  function select(selector: string, node: AnyHtmlNode): Array<AnyHtmlNode>

  class XPathParser {
    parse(selector: string): unknown
  }
}
