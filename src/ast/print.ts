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
      parts.push(hardline, '[body]', hardline, node.body)
    }
    parts.push(hardline) // terminal
    return group(parts)
  },

  AssignmentStmt: {
    enter(node, _visit) {
      const idTarget = unwrapHead(node.value).kind === NodeKind.IdentifierExpr
      return {
        ...node,
        value: _visit(node.value),
        $visitorInfo: {
          idTarget,
        },
      }
    },
    exit(node) {
      const { idTarget } = node.$visitorInfo
      const parts: Doc[] = ['set ', node.name.value]
      if (node.optional) {
        parts.push('?')
      }
      const sep = idTarget ? ' = $' : ' = '
      parts.push(sep, node.value)
      return group(parts)
    },
  },

  ExtractStmt: {
    enter(node, _visit) {
      const head = unwrapHead(node.value)
      const value = _visit(node.value)
      return {
        value,
        $visitorInfo: { idHead: head.kind === NodeKind.IdentifierExpr },
      }
    },
    exit(node) {
      const punct = node.$visitorInfo.idHead ? ['$'] : []
      return group(['extract ', ...punct, node.value])
    },
  },

  ObjectLiteralExpr: {
    enter(node, _visit) {
      const shorthand: string[] = []
      const shouldBreak = node.entries.some(
        e => unwrapTail(e.value).kind === NodeKind.TemplateExpr
      )

      const entries = node.entries.map((e, i) => {
        // key
        const key = _visit(e.key)
        const keyGroup: Doc[] = [key]
        if (e.optional) {
          keyGroup.push('?')
        }

        // seperator
        keyGroup.push(': ')

        // value
        const head = unwrapHead(e.value)
        const rawValue = _visit(e.value)
        let value = rawValue
        if (head.kind === NodeKind.IdentifierExpr) {
          value = ['$', value]
        }
        if (key === rawValue) {
          shorthand[i] = value
        }
        return { ...e, key: keyGroup, value }
      })

      return { entries, $visitorInfo: { shouldBreak, shorthand } }
    },
    exit(node) {
      const { shouldBreak, shorthand } = node.$visitorInfo
      const inner = node.entries.map(
        (e, i) => shorthand[i] || group([e.key, e.value])
      )
      const sep = ifBreak(line, [',', line])
      return group(['{', indent([line, join(sep, inner)]), line, '}'], {
        shouldBreak,
      })
    },
  },

  TemplateExpr: {
    enter(node, _visit) {
      const elements = node.elements.map(el => {
        const { kind } = el
        if (kind !== NodeKind.IdentifierExpr && kind !== NodeKind.LiteralExpr) {
          throw new Error(`Unexpected template node: ${kind}`)
        }
        const isUrlComp = kind === NodeKind.IdentifierExpr && el.isUrlComponent
        const doc = _visit(el)
        if (typeof doc !== 'string') {
          throw new Error(`Unexepected template element type: ${typeof doc}`)
        }
        return { doc, kind, isUrlComp }
      })
      return {
        elements: elements.map((el, i) => {
          if (el.kind === NodeKind.LiteralExpr) {
            return el.doc
          }
          const nextEl = elements[i + 1]
          let { doc } = el
          if (nextEl?.kind === NodeKind.LiteralExpr && /^\w/.test(nextEl.doc)) {
            if (el.isUrlComp) {
              throw new Error(
                `Malformed URL component identifier: ${nextEl.doc}`
              )
            }
            // use ${id} syntax to delineate against next element in template
            doc = `{${doc}}`
          }
          return el.isUrlComp ? `:${doc}` : `$${doc}`
        }),
      }
    },
    exit(node) {
      return node.elements
    },
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
    const lines = value.replace(/`/g, '\\`').split('\n')
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
