import type * as dh from 'domhandler'

declare module 'domhandler' {
  declare class Attribute extends Node {
    get nodeType(): 2
    value: string
  }
  export type AnyHtmlNode = dh.AnyNode | Attribute
  export type FOO = string
}
