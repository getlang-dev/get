import { builders, printer } from 'prettier/doc'
import type { InterpretVisitor } from '../visitor/visitor.js'
import { visit } from '../visitor/visitor.js'
import type { Node } from './ast.js'
import { NodeKind } from './ast.js'

type Doc = builders.Doc

// NOTE: avoid using template interpolation with prettier.Doc
// as the Doc may be a Doc array or Doc command

const { group, indent, join, line, hardline, softline, ifBreak } = builders

const printVisitor: InterpretVisitor<Doc> = {
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

  RequestExpr: {
    enter(node, visit) {
      const parts: Doc[] = [node.method.value, ' ', visit(node.url)]
      for (const h of node.headers.entries) {
        parts.push(hardline, visit(h.key), ': ', visit(h.value))
      }
      for (const [blockName, block] of Object.entries(node.blocks)) {
        parts.push(hardline, '[', blockName, ']')
        for (const e of block.entries) {
          parts.push(hardline, visit(e.key), ': ', visit(e.value))
        }
      }
      if (node.body) {
        parts.push(
          hardline,
          '[body]',
          hardline,
          visit(node.body),
          hardline,
          '[/body]',
        )
      }
      parts.push(hardline) // terminal
      return group(parts)
    },
  },

  InputDeclStmt(node) {
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

  ObjectLiteralExpr(node, _path, orig) {
    const shorthand: Doc[] = []
    const shouldBreak = orig.entries.some(
      e => e.value.kind === NodeKind.SelectorExpr,
    )
    const entries = node.entries.map((entry, i) => {
      const origEntry = orig.entries[i]
      if (!origEntry) {
        throw new Error('Unmatched object literal entry')
      }
      const keyGroup: Doc[] = [entry.key]
      if (entry.optional) {
        keyGroup.push('?')
      }

      // seperator
      keyGroup.push(': ')

      // value
      const value = entry.value
      let shValue: Doc = entry.value
      if (
        Array.isArray(shValue) &&
        shValue.length === 1 &&
        typeof shValue[0] === 'string'
      ) {
        shValue = shValue[0]
      }
      if (typeof shValue === 'string' && entry.key === shValue) {
        shorthand[i] = [value, entry.optional ? '?' : '']
      }
      return { ...entry, key: keyGroup, value }
    })

    const inner = entries.map((e, i) => shorthand[i] || group([e.key, e.value]))
    const sep = ifBreak(line, [',', line])
    const obj = group(['{', indent([line, join(sep, inner)]), line, '}'], {
      shouldBreak,
    })
    return node.context ? [node.context, indent([line, '-> ', obj])] : obj
  },

  TemplateExpr(node, _path, orig) {
    return node.elements.map((el, i) => {
      const origEl = orig.elements[i]
      if (!origEl) {
        throw new Error('Unmatched object literal entry')
      } else if ('offset' in origEl) {
        return origEl.value
      }

      if (typeof el !== 'string' && !Array.isArray(el)) {
        throw new Error(`Unsupported template node: ${el.type} command`)
      } else if (origEl.kind === NodeKind.TemplateExpr) {
        return ['$[', el, ']']
      } else if (origEl.kind !== NodeKind.IdentifierExpr) {
        throw new Error(`Unexpected template node: ${origEl?.kind}`)
      }

      // strip the leading `$` character
      let ret = el.slice(1)

      const nextEl = node.elements[i + 1]
      if (
        typeof nextEl === 'object' &&
        'offset' in nextEl &&
        /^\w/.test(nextEl.value)
      ) {
        // use ${id} syntax to delineate against next element in template
        ret = ['{', ret, '}']
      }
      return [origEl.isUrlComponent ? ':' : '$', ret]
    })
  },

  IdentifierExpr(node) {
    return ['$', node.value.value]
  },

  SelectorExpr(node) {
    if (!node.context) {
      const arrow = node.expand ? '=> ' : ''
      return [arrow, node.selector]
    }
    const arrow = node.expand ? '=> ' : '-> '
    return [node.context, indent([line, arrow, node.selector])]
  },

  CallExpr(node) {
    const call: Doc[] = ['@', node.callee.value, '(', node.inputs, ')']
    return node.context ? [node.context, indent([line, '-> ', call])] : call
  },

  SliceExpr(node) {
    const { value } = node.slice
    const quot = value.includes('`') ? '```' : '`'
    const lines = value.split('\n')
    const slice = group([
      quot,
      indent([softline, join(hardline, lines)]),
      softline,
      quot,
    ])
    return node.context ? [node.context, indent([line, '-> ', slice])] : slice
  },

  SubqueryExpr(node) {
    const subquery = [
      '(',
      indent(node.body.flatMap(x => [hardline, x])),
      hardline,
      ')',
    ]
    return node.context
      ? [node.context, indent([line, '-> ', subquery])]
      : subquery
  },
}

export function print(ast: Node) {
  if (!(ast.kind === NodeKind.Program)) {
    throw new Error(`Non-program AST node provided: ${ast}`)
  }
  const doc = visit(ast, printVisitor)
  // propagateBreaks(doc)
  return printer.printDocToString(doc, {
    printWidth: 70,
    tabWidth: 2,
    useTabs: false,
  }).formatted
}
