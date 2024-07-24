import type { ElementType } from 'domelementtype'
import { Node, type AnyNode } from 'domhandler'

declare module 'domhandler' {
  class Attribute extends Node {
    type: ElementType.Text
    get nodeType(): 2
    value: string
  }

  type AnyHtmlNode = AnyNode | Attribute
}
