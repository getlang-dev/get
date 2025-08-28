import { invariant } from '@getlang/utils'
import { QuerySyntaxError } from '@getlang/utils/errors'
import type { Expr } from '../ast/ast.js'
import { isToken, t } from '../ast/ast.js'
import { tx } from '../utils.js'

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
  const headers = t.requestBlockExpr(tx.token(''), headerBlock?.[1] ?? [])
  const req = t.requestExpr(method, url, headers, blocks, body)
  return t.requestStmt(req)
}

export const requestBlocks: PP = ([blocks, maybeBody]) => {
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

export const requestBlockNamed: PP = ([name, , entries]) =>
  t.requestBlockExpr(name, entries)

export const requestBlockBody: PP = ([, body]) => body

export const requestBlock: PP = ([entry, entries]) => [
  entry,
  ...entries.map((d: any) => d[1]),
]

export const requestEntry: PP = ([key, , maybeValue]) => {
  let value = maybeValue?.[1]
  if (typeof value === 'undefined') {
    value = {
      ...key.value, // key is already a literal expr
      value: '',
      text: '',
    }
  }
  return t.requestEntryExpr(key, value)
}

export const assignment: PP = ([, , name, optional, , , , expr]) =>
  t.assignmentStmt(name, expr, !!optional)

export const extract: PP = ([, , exports]) => t.extractStmt(exports)

export const subquery: PP = ([, , stmts]) => t.subqueryExpr(stmts)

export const call: PP = ([callee, maybeInputs]) => {
  const inputs = maybeInputs?.[1]
  return /^[a-z]/.test(callee.value)
    ? t.modifierExpr(callee, inputs)
    : t.moduleExpr(callee, inputs)
}

export const link: PP = ([maybePrior, callee, _, link]) => {
  const bit = t.moduleExpr(
    callee,
    t.objectLiteralExpr([t.objectEntryExpr(tx.template('@link'), link, true)]),
  )
  if (!maybePrior) {
    return bit
  }
  const [context, , arrow] = maybePrior
  return drill([context, null, arrow, null, bit])
}

export const object: PP = d => {
  const entries = d[2].map((dd: any) => dd[0])
  return t.objectLiteralExpr(entries)
}

export const objectEntry: PP = ([callkey, identifier, optional, , , value]) => {
  const key = {
    ...identifier,
    value: `${callkey ? '@' : ''}${identifier.value || '$'}`,
  }
  return t.objectEntryExpr(t.templateExpr([key]), value, Boolean(optional))
}

export const objectEntryShorthandSelect: PP = ([identifier, optional]) => {
  const value = t.templateExpr([identifier])
  const selector = t.drillExpr([t.drillBitExpr(t.selectorExpr(value, false))])
  return objectEntry([null, identifier, optional, null, null, selector])
}

export const objectEntryShorthandIdent: PP = ([identifier, optional]) => {
  const value = t.identifierExpr(identifier)
  return objectEntry([null, identifier, optional, null, null, value])
}

function drillBase(bit: Expr, arrow?: string): Expr {
  const expand = arrow === '=>'
  if (bit.kind === 'TemplateExpr') {
    bit = t.selectorExpr(bit, expand)
  } else if (bit.kind === 'IdentifierExpr') {
    bit = t.drillIdentifierExpr(bit.id, expand)
  } else if (expand) {
    throw new QuerySyntaxError('Wide arrow drill requires selector on RHS')
  }
  return t.drillBitExpr(bit)
}

export const drill: PP = ([arrow, bit, bits]) => {
  return t.drillExpr([
    drillBase(bit, arrow?.[0].value),
    ...bits.map(([, arrow, , bit]: any) => drillBase(bit, arrow.value)),
  ])
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
