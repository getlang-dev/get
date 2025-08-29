import type { Visitor } from '@getlang/walker'
import { walk } from '@getlang/walker'
import { builders, printer } from 'prettier/doc'
import { render } from '../utils.js'
import type { Node } from './ast.js'
import { isToken } from './ast.js'

type Doc = builders.Doc

// NOTE: avoid using template interpolation with prettier.Doc
// as the Doc may be a Doc array or Doc command

const { group, indent, join, line, hardline, softline, ifBreak } = builders

const printVisitor: Visitor = {
  Program(node) {
    return join(hardline, node.body)
  },

  DeclInputsStmt(node) {
    return group([
      'inputs {',
      indent([line, join([',', line], node.inputs)]),
      line,
      '}',
    ])
  },

  RequestExpr(node) {
    const parts: Doc[] = [node.method.value, ' ', node.url]
    for (const block of node.blocks) {
      parts.push(block)
    }
    if (node.body) {
      parts.push(hardline, '[body]', hardline, node.body, hardline, '[/body]')
    }
    parts.push(hardline) // terminal
    return group(parts)
  },

  RequestBlockExpr(node) {
    const parts: Doc[] = []
    const name = node.name.value
    if (name) {
      parts.unshift(hardline, '[', name, ']')
    }
    for (const entry of node.entries) {
      parts.push(hardline, entry)
    }
    return parts
  },

  RequestEntryExpr(node) {
    return [node.key, ': ', node.value]
  },

  InputExpr(node) {
    const parts: Doc[] = [node.id.text]
    if (node.optional) {
      parts.push('?')
    }
    if (node.defaultValue) {
      parts.push(' = ', node.defaultValue)
    }
    return group(parts)
  },

  RequestStmt(node) {
    return node.request
  },

  AssignmentStmt(node) {
    return group([
      'set ',
      node.name.value,
      node.optional ? '?' : '',
      ' = ',
      node.value,
    ])
  },

  ExtractStmt(node) {
    return group(['extract ', node.value])
  },

  DrillExpr(node) {
    const [first, ...rest] = node.body
    const [, arrow, bit] = first.contents
    const lead = arrow === '=> ' ? [arrow, bit] : bit
    return [lead, ...rest]
  },

  DrillBitExpr(node, { node: orig }) {
    let arrow = '-> '
    if (
      (orig.kind === 'SelectorExpr' || orig.kind === 'DrillIdentifierExpr') &&
      orig.expand
    ) {
      arrow = '=> '
    }
    return indent([line, arrow, node.bit])
  },

  ObjectEntryExpr(node, { node: orig }) {
    if (orig.value.kind === 'IdentifierExpr') {
      const key = render(orig.key)
      const value = orig.value.id.value
      if (key === value || (key === '$' && value === '')) {
        return node.value
      }
    }

    const keyGroup: Doc[] = [node.key]
    if (node.optional) {
      keyGroup.push('?')
    }

    // seperator
    keyGroup.push(': ')

    // value
    const value = node.value
    let shValue: Doc = node.value
    if (
      Array.isArray(shValue) &&
      shValue.length === 1 &&
      typeof shValue[0] === 'string'
    ) {
      shValue = shValue[0]
    }
    if (typeof shValue === 'string' && node.key === shValue) {
      return [value, node.optional ? '?' : '']
    }
    return group([keyGroup, value])
  },

  ObjectLiteralExpr(node, { node: orig }) {
    const shouldBreak = orig.entries.some(e => {
      switch (e.value.kind) {
        case 'SelectorExpr':
          return true
        case 'DrillExpr':
          return e.value.body.at(-1).bit.kind === 'SelectorExpr'
      }
    })
    const sep = ifBreak(line, [',', line])
    return group(['{', indent([line, join(sep, node.entries)]), line, '}'], {
      shouldBreak,
    })
  },

  TemplateExpr(node, { node: orig }) {
    return node.elements.map((el, i) => {
      const og = orig.elements[i]!
      if (isToken(og)) {
        return og.value
      }

      if (typeof el !== 'string' && !Array.isArray(el)) {
        throw new Error(`Unsupported template node: ${el.type} command`)
      } else if (og.kind === 'TemplateExpr') {
        return ['$[', el, ']']
      } else if (og.kind !== 'IdentifierExpr') {
        throw new Error(`Unexpected template node: ${og?.kind}`)
      }

      let id: Doc = [og.id.value]
      const nextEl = node.elements[i + 1]
      if (isToken(nextEl) && /^\w/.test(nextEl.value)) {
        // use ${id} syntax to delineate against next element in template
        id = ['{', id, '}']
      }
      return [og.isUrlComponent ? ':' : '$', id]
    })
  },

  IdentifierExpr(node) {
    return ['$', node.id.value]
  },

  DrillIdentifierExpr(node) {
    return ['$', node.id.value]
  },

  SelectorExpr(node) {
    return node.selector
  },

  ModifierExpr(node, { node: orig }) {
    const call: Doc[] = ['@', node.modifier.value]
    if (orig.args.entries.length) {
      call.push('(', node.args, ')')
    }
    return call
  },

  ModuleExpr(node, { node: orig }) {
    const call: Doc[] = ['@', node.module.value]
    if (orig.args.entries.length) {
      call.push('(', node.args, ')')
    }
    return call
  },

  SliceExpr(node) {
    const { value } = node.slice
    const quot = value.includes('`') ? '|' : '`'
    const lines = value.split('\n')
    return group([
      quot,
      indent([softline, join(hardline, lines)]),
      softline,
      quot,
    ])
  },

  SubqueryExpr(node) {
    return ['(', indent(node.body.flatMap(x => [hardline, x])), hardline, ')']
  },
}

export function print(ast: Node) {
  if (!(ast.kind === 'Program')) {
    throw new Error(`Non-program AST node provided: ${ast}`)
  }
  const doc = walk(ast, printVisitor)
  // propagateBreaks(doc)
  return printer.printDocToString(doc, {
    printWidth: 70,
    tabWidth: 2,
    useTabs: false,
  }).formatted
}
