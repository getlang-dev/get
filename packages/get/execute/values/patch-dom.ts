// @sideEffects
import { compareDocumentPosition } from 'domutils'
import ds from 'dom-serializer'
import type { AnyNode } from 'domhandler'
import { Node, Element } from 'domhandler'

function main() {
  ;(Node.prototype as any).compareDocumentPosition = function (other: AnyNode) {
    return compareDocumentPosition(this, other)
  }

  Element.prototype.toString = function () {
    return ds(this)
  }

  Object.defineProperty(Element.prototype, 'outerHTML', {
    get() {
      return ds(this)
    },
  })

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
