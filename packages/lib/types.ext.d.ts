import type { ElementType } from 'domelementtype'
import type * as dh from 'domhandler'

declare module 'domhandler' {
  class Attribute extends dh.Node {
    type: ElementType.Text
    get nodeType(): 2
    value: string
  }

  export type AnyNode = dh.ParentNode | dh.ChildNode | Attribute
}
