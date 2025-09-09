import type { Expr } from '@getlang/ast'
import { isToken, t } from '@getlang/ast'
import { invariant } from '@getlang/lib'
import { QuerySyntaxError } from '@getlang/lib/errors'
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
  return t.InputExpr(id, Boolean(optional || defaultValue), defaultValue)
}

export const request: PP = ([method, url, headerBlock, { blocks, body }]) => {
  const headers = t.requestBlockExpr(tx.token(''), headerBlock?.[1] ?? [])
  const req = t.requestExpr(method, url, headers, blocks, body)
  return t.requestStmt(req)
}

export const requestBlocks: PP = ([namedBlocks, maybeBody]) => {
  const blocks = namedBlocks.map((d: any) => d[1])

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

export const link: PP = ([context, callee, _, link]) => {
  const bit = t.moduleExpr(
    callee,
    t.objectLiteralExpr([t.objectEntryExpr(tx.template('@link'), link, true)]),
  )
  const [drill, , arrow] = context || []
  const body = drill?.body || []
  return t.drillExpr([...body, drillBase(bit, arrow)])
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
  const selector = t.drillExpr([t.selectorExpr(value, false)])
  return objectEntry([null, identifier, optional, null, null, selector])
}

export const objectEntryShorthandIdent: PP = ([identifier, optional]) => {
  const value = t.identifierExpr(identifier)
  return objectEntry([null, identifier, optional, null, null, value])
}

function drillBase(bit: Expr, arrow?: string): Expr {
  const expand = arrow === '=>'
  if (bit.kind === 'SelectorExpr' || bit.kind === 'DrillIdentifierExpr') {
    bit.expand = expand
  } else if (expand) {
    throw new QuerySyntaxError('Misplaced wide arrow drill')
  }
  return bit
}

export const drill: PP = ([arrow, bit, bits]) => {
  const expr = drillBase(bit, arrow?.[0].value)
  const exprs = bits.map(([, arrow, , bit]: any) => {
    return drillBase(bit, arrow.value)
  })
  return t.drillExpr([expr, ...exprs])
}

export const selector: PP = ([template]) => t.selectorExpr(template, false)
export const idbit: PP = ([id]) => t.drillIdentifierExpr(id, false)

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
    } else if (el.type === 'str') {
      if (el.value) {
        const prev = els.at(-1)
        if (prev?.type === 'str') {
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
  if (first.type === 'str') {
    elements[0] = { ...first, value: first.value.trimLeft() }
  }

  const lastIdx = elements.length - 1
  const last = elements[lastIdx]
  if (last.type === 'str') {
    elements[lastIdx] = { ...last, value: last.value.trimRight() }
  }

  return t.templateExpr(elements)
}

export const literal: PP = ([[token]]) => t.literalExpr(token)
export const string: PP = ([, template]) => template

export const interpExpr: PP = ([, , token]) => token
export const interpTmpl: PP = ([, , template]) => template

export const slice: PP = d => t.sliceExpr(d[0])

export const ws: PP = () => null

export const idd: PP = d => d[0][0]
