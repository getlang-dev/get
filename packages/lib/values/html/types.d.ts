declare module '@getlang/xpath' {
  import type { AnyNode } from 'domhandler'

  export function select(selector: string, node: AnyNode): Array<AnyNode>

  export class XPathParser {
    parse(selector: string): unknown
  }
}
