import { invariant } from '@getlang/utils'
import { QuerySyntaxError } from '@getlang/utils/errors'
import { isToken, NodeKind, t } from '../ast/ast.js'
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
      if (isToken(el)) {
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
  const elements = d[0].reduce((els: any, dd: any) => {
    const el = dd[0]
    if (el.kind) {
      invariant(
        el.kind === 'TemplateExpr',
        `Unexpected template element: ${el.kind}`,
      )
      els.push(el)
    } else if (el.type === 'interpvar' || el.type === 'identifier') {
      els.push(t.identifierExpr(el))
    } else if (el.type === 'literal') {
      if (el.value) {
        const prev = els.at(-1)
        if (prev?.type === 'literal') {
          els.pop()
          els.push({ ...prev, value: prev.value + el.value })
        } else {
          els.push(el)
        }
      }
    } else {
      throw new QuerySyntaxError(`Unknown template element: ${el.type}`)
    }

    return els
  }, [])

  const first = elements.at(0)
  if (first.type === 'literal') {
    elements[0] = { ...first, value: first.value.trimLeft() }
  }

  const lastIdx = elements.length - 1
  const last = elements[lastIdx]
  if (last.type === 'literal') {
    elements[lastIdx] = { ...last, value: last.value.trimRight() }
  }

  return t.templateExpr(elements)
}

export const interpExpr: PP = ([, , token]) => token
export const interpTmpl: PP = ([, , template]) => template

export const slice: PP = d => t.sliceExpr(d[0])

export const ws: PP = () => null

export const idd: PP = d => d[0][0]
