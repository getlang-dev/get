declare module 'acorn-globals' {
  import type { Program } from 'acorn'
  type Ref = { name: string }
  function detect(source: Program): Ref[]
  export = detect
}

declare module 'esquery' {
  import type { AnyNode } from 'acorn'
  export default function query(ast: AnyNode, selector: string): AnyNode[]
}

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
