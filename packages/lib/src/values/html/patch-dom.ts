import ds from 'dom-serializer'
// @sideEffects
import type { ElementType } from 'domelementtype'
import type { AnyNode } from 'domhandler'
import { Element, Node } from 'domhandler'

declare module 'domhandler' {
  class Attribute extends Node {
    type: ElementType.Text
    get nodeType(): 2
    value: string
  }

  type AnyHtmlNode = AnyNode | Attribute
}

function main() {
  Element.prototype.toString = function () {
    return ds(this)
  }

  Object.defineProperty(Node.prototype, 'nodeName', {
    get: function () {
      return this.name
    },
  })

  Object.defineProperty(Node.prototype, 'localName', {
    get: function () {
      return this.name
    },
  })

  const origAttributes = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'attributes',
  )?.get

  if (origAttributes) {
    Object.defineProperty(Element.prototype, 'attributes', {
      get: function (...args) {
        const attrs = origAttributes.call(this, ...args)
        attrs.item = (idx: number) => {
          const el = attrs[idx]
          return { ...el, nodeType: 2, localName: el.name }
        }
        return attrs
      },
    })
  } else {
    console.warn(
      '[WARN] Unable to patch DOM: Element.attributes property descriptor not found',
    )
  }
}

main()
