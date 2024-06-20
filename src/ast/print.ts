import type { Doc } from 'prettier'
import { doc } from 'prettier'
import type { Node, Expr } from './ast'
import { NodeKind } from './ast'
import type { ExhaustiveVisitor } from './visitor'
import { visit } from './visitor'

const {
  builders: { group, indent, join, line, hardline, softline, ifBreak },
  printer,
} = doc

const unwrapHead = (expr: Expr): Expr => {
  if (expr.kind === NodeKind.DrillExpr) {
    if (expr.target === 'context') {
      return expr.bit
    }
    if (expr.target.kind === NodeKind.DrillExpr) {
      return unwrapHead(expr.target)
    }
    return expr.target
  }
  return expr
}

const unwrapTail = (expr: Expr): Expr => {
  if (expr.kind === NodeKind.DrillExpr) {
    return expr.bit
  }
  return expr
}

const printVisitor: ExhaustiveVisitor<Doc> = {
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

  DeclImportStmt(node) {
    return group(['import ', node.id.value])
  },

  ModuleCallExpr(node) {
    return group(['$', node.name.value, '(', node.args, ')'])
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
    const parts: Doc[] = [node.method.value, ' ', node.url]
    for (const h of node.headers) {
      parts.push(hardline, h.key, ': ', h.value)
    }
    for (const [blockName, blockEntries] of Object.entries(node.blocks)) {
      parts.push(hardline, '[', blockName, ']')
      for (const e of blockEntries) {
        parts.push(hardline, e.key, ': ', e.value)
      }
    }
    if (node.body) {
      parts.push(hardline, '[body]', hardline, node.body, hardline, '[/body]')
    }
    parts.push(hardline) // terminal
    return group(parts)
  },

  AssignmentStmt(node, orig) {
    const idTarget = unwrapHead(orig.value).kind === NodeKind.IdentifierExpr
    const parts: Doc[] = ['set ', node.name.value]
    if (node.optional) {
      parts.push('?')
    }
    const sep = idTarget ? ' = $' : ' = '
    parts.push(sep, node.value)
    return group(parts)
  },

  ExtractStmt(node, orig) {
    const head = unwrapHead(orig.value)
    const punct = head.kind === NodeKind.IdentifierExpr ? ['$'] : []
    return group(['extract ', ...punct, node.value])
  },

  ObjectLiteralExpr(node, orig) {
    const shorthand: Doc[] = []
    const shouldBreak = orig.entries.some(
      e => unwrapTail(e.value).kind === NodeKind.TemplateExpr
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
      const head = unwrapHead(origEntry.value)
      let value = entry.value
      if (head.kind === NodeKind.IdentifierExpr) {
        value = ['$', value]
      }
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
    return group(['{', indent([line, join(sep, inner)]), line, '}'], {
      shouldBreak,
    })
  },

  TemplateExpr(node, orig) {
    return node.elements.map((el, i) => {
      const origEl = orig.elements[i]
      if (!origEl) {
        throw new Error('Unmatched object literal entry')
      } else if (origEl.kind === NodeKind.LiteralExpr) {
        return el
      } else if (origEl.kind !== NodeKind.IdentifierExpr) {
        throw new Error(`Unexpected template node: ${origEl?.kind}`)
      }
      const nextEl = node.elements[i + 1]
      if (typeof nextEl === 'string' && /^\w/.test(nextEl)) {
        // use ${id} syntax to delineate against next element in template
        el = `{${el}}`
      }
      return origEl.isUrlComponent ? `:${el}` : `$${el}`
    })
  },

  LiteralExpr(node) {
    return node.value.value
  },

  IdentifierExpr(node) {
    return node.value.value
  },

  DrillExpr(node) {
    if (node.target === 'context') {
      return node.bit
    }
    const arrow = node.expand ? '=> ' : '-> '
    return [node.target, indent([line, arrow, node.bit])]
    // return group([node.target, line, arrow, node.bit])
    // return fill([node.target, line, arrow, node.bit])
  },

  ModifierExpr(node) {
    return `@${node.value.value}`
  },

  SliceExpr(node) {
    const { value } = node.slice
    const quot = value.includes('`') ? '```' : '`'
    const lines = value.split('\n')
    return group([
      quot,
      indent([softline, join(hardline, lines)]),
      softline,
      quot,
    ])
  },

  FunctionExpr(node) {
    return ['(', indent(node.body.flatMap(x => [hardline, x])), hardline, ')']
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
