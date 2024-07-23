declare module '@getlang/xpath' {
  import type { AnyHtmlNode } from 'domhandler'

  export function select(
    selector: string,
    node: AnyHtmlNode,
  ): Array<AnyHtmlNode>

  export class XPathParser {
    parse(selector: string): unknown
  }
}
