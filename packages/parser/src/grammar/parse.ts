import { QuerySyntaxError, invariant } from '@getlang/utils'
import { NodeKind, t } from '../ast/ast.js'
import { tx } from '../desugar/utils.js'

type PP = nearley.Postprocessor

export const program: PP = ([, maybeInputs, body]) => {
  const inputs = maybeInputs?.[0]
  const stmts = inputs ? [inputs] : []
  stmts.push(...body)
  return t.program(stmts)
}

export const statements: PP = ([stmt, stmts]) => [
  stmt,
  ...stmts.map((d: any) => d[1]),
]

export const declInputs: PP = ([, , , , first, maybeRest]) => {
  const rest = maybeRest || []
  const restIds = rest.map((d: any) => d[3])
  const ids = [first, ...restIds]
  return t.declInputsStmt(ids)
}

export const inputDecl: PP = ([id, optional, maybeDefault]) => {
  const defaultValue = maybeDefault?.[3]
  return t.inputDeclStmt(id, Boolean(optional || defaultValue), defaultValue)
}

export const request: PP = ([method, url, headerBlock, { blocks, body }]) => {
  const headers = headerBlock?.[1] ?? t.objectLiteralExpr([])
  return t.requestStmt(t.requestExpr(method, url, headers, blocks, body))
}

export const requestBlocks: PP = ([namedBlocks, maybeBody]) => {
  const blocks: Record<string, unknown> = {}
  for (const [, block] of namedBlocks) {
    blocks[block.name] = block.entries
  }

  const body = maybeBody?.[1]
  if (body) {
    for (const el of body.elements) {
      if ('offset' in el) {
        // a token - restore original text
        el.value = el.text
      }
    }
  }

  return { blocks, body }
}

export const requestBlockNamed: PP = ([name, , entries]) => ({ name, entries })

export const requestBlockBody: PP = ([, body]) => body

export const requestBlock: PP = ([entry, entries]) =>
  t.objectLiteralExpr([entry, ...entries.map((d: any) => d[1])])

export const requestEntry: PP = ([key, , maybeValue]) => {
  let value = maybeValue?.[1]
  if (typeof value === 'undefined') {
    value = {
      ...key.value, // key is already a literal expr
      value: '',
      text: '',
    }
  }
  return { key, value, optional: true }
}

export const assignment: PP = ([, , name, optional, , , , expr]) =>
  t.assignmentStmt(name, expr, !!optional)

export const extract: PP = ([, , exports]) => t.extractStmt(exports)

export const subquery: PP = ([, , stmts]) => t.subqueryExpr(stmts)

export const call: PP = ([callee, maybeInputs]) =>
  t.callExpr(callee, maybeInputs?.[1])

export const link: PP = ([callee, _, link]) =>
  t.callExpr(
    callee,
    t.objectLiteralExpr([t.objectEntry(tx.template('@link'), link, true)]),
  )

export const object: PP = d => {
  const entries = d[2].map((dd: any) => dd[0])
  return t.objectLiteralExpr(entries)
}

export const objectEntry: PP = ([callkey, identifier, optional, , , value]) => {
  const key = {
    ...identifier,
    value: `${callkey ? '@' : ''}${identifier.value}`,
  }
  return {
    key: t.templateExpr([key]),
    value,
    optional: Boolean(optional),
  }
}

export const objectEntryShorthandSelect: PP = ([identifier, optional]) => {
  const value = t.templateExpr([identifier])
  const selector = t.selectorExpr(value, false)
  return objectEntry([null, identifier, optional, null, null, selector])
}

export const objectEntryShorthandIdent: PP = ([identifier, optional]) => {
  const value = t.identifierExpr(identifier)
  return objectEntry([null, identifier, optional, null, null, value])
}

const expandingSelectors = [NodeKind.TemplateExpr, NodeKind.IdentifierExpr]
export const drill: PP = ([context, , arrow, , bit]) => {
  const expand = arrow.value.startsWith('=')
  if (expandingSelectors.includes(bit.kind)) {
    return t.selectorExpr(bit, expand, context)
  }
  invariant(
    !expand,
    new QuerySyntaxError('Wide arrow drill requires selector on RHS'),
  )
  invariant('context' in bit, new QuerySyntaxError('Invalid drill value'))
  bit.context = context
  return bit
}

export const drillContext: PP = ([arrow, expr]) => {
  const expand = arrow?.[0].value === '=>'
  if (expr.kind === NodeKind.TemplateExpr) {
    return t.selectorExpr(expr, expand)
  }
  invariant(
    !expand,
    new QuerySyntaxError('Wide arrow drill requires selector on RHS'),
  )
  return expr
}

export const identifier: PP = ([id]) => {
  return t.identifierExpr(id)
}

export const template: PP = d => {
  // filter out any empty tokens (that were used for peeking)
  let elements = d[0].filter((dd: any) => dd[0].kind || dd[0].value)

  // create the AST nodes for each element
  elements = d[0].flatMap((dd: any, i: number) => {
    const element = dd[0]

    if (element.kind) {
      if (element.kind !== 'TemplateExpr') {
        throw new Error(`Unexpected template element: ${element.kind}`)
      }
      return element
    }

    switch (element.type) {
      case 'interpvar':
      case 'identifier':
        return t.identifierExpr(element)

      case 'literal': {
        let { value } = element
        if (i === 0) {
          value = value.trimLeft()
        }
        if (i === elements.length - 1) {
          value = value.trimRight()
        }
        if (!value) {
          return []
        }
        return { ...element, value }
      }

      default:
        throw new QuerySyntaxError(`Unknown template element: ${element.type}`)
    }
  })

  return t.templateExpr(elements)
}

export const interpExpr: PP = ([, , token]) => token
export const interpTmpl: PP = ([, , template]) => template

export const slice: PP = d => t.sliceExpr(d[0])

export const ws: PP = () => null

export const idd: PP = d => d[0][0]
