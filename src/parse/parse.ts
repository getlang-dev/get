import { t, NodeKind } from '../ast/ast'

type PP = nearley.Postprocessor

export const program: PP = ([, maybeHeader, body]) => {
  const header = maybeHeader || []
  const stmts = [...header, ...body]
  return t.program(stmts)
}

export const header: PP = d => d[0].map((dd: any) => dd[0][0])

export const statements: PP = ([stmt, stmts]) => [
  stmt,
  ...stmts.map((d: any) => d[1]),
]

export const declImport: PP = ([, , id]) => t.declImportStmt(id)

export const declInputs: PP = ([, , , , first, maybeRest]) => {
  const rest = maybeRest || []
  const restIds = rest.map((d: any) => d[3])
  const ids = [first, ...restIds]
  return t.declInputsStmt(ids)
}

export const inputDecl: PP = ([id, optional, maybeDefault]) => {
  const defaultValue = maybeDefault?.[3]
  return t.inputDeclStmt(id, !!optional, defaultValue)
}

export const request: PP = ([method, url, headerBlock, namedBlocks, body]) => {
  const headers = headerBlock?.[1] ?? []
  const blocks: any = {}
  namedBlocks
    .map((d: any) => d[1])
    .forEach((block: any) => {
      blocks[block.name] = block.entries
    })

  return t.requestStmt(method, url, headers, blocks, body?.[1])
}

export const requestBlockNamed: PP = ([name, , entries]) => ({ name, entries })

export const requestBlockBody: PP = ([, body]) => body

export const requestBlock: PP = ([entry, entries]) => [
  entry,
  ...entries.map((d: any) => d[1]),
]

export const requestEntry: PP = ([key, , maybeValue]) => {
  let value = maybeValue?.[1]
  if (typeof value === 'undefined') {
    value = t.literalExpr({
      ...key.value, // key is already a literal expr
      value: '',
      text: '',
    })
  }
  return { key, value }
}

export const assignment: PP = ([, , name, optional, , , , expr]) =>
  t.assignmentStmt(name, expr, !!optional)

export const extract: PP = ([, , exports]) => t.extractStmt(exports)

export const fn: PP = ([, , stmts]) => t.functionExpr(stmts)

export const moduleCall: PP = ([name, , optArgs]) => {
  const args = optArgs?.[0]
  return t.moduleCallExpr(name, args)
}

export const object: PP = d => {
  const entries = d[2].map((dd: any) => dd[0])
  return t.objectLiteralExpr(entries)
}

export const objectEntry: PP = ([identifier, optional, , , value]) => ({
  key: t.literalExpr(identifier),
  value,
  optional: Boolean(optional),
})

export const objectEntryShorthandDrill: PP = ([identifier, optional]) => {
  const value = t.templateExpr([t.literalExpr(identifier)])
  const drill = t.drillExpr('context', value, false)
  return objectEntry([identifier, optional, null, null, drill])
}

export const objectEntryShorthandIdent: PP = ([identifier, optional]) => {
  const value = t.identifierExpr(identifier)
  return objectEntry([identifier, optional, null, null, value])
}

export const drill: PP = ([target, , arrow, , bit]) => {
  const expand = arrow.value.startsWith('=')
  return t.drillExpr(target, bit, expand)
}

const contextSelectors = [NodeKind.TemplateExpr, NodeKind.ModifierExpr]
export const drillContext: PP = ([arrow, expr]) => {
  if (!contextSelectors.includes(expr.kind)) {
    return expr
  }
  const expand = arrow?.[0].value === '=>'
  return t.drillExpr('context', expr, expand)
}

export const idRef: PP = ([, id]) => id

export const identifier: PP = ([id]) => {
  return t.identifierExpr(id)
}

export const template: PP = d => {
  // filter out any empty tokens (that were used for peeking)
  let elements = d[0].filter((dd: any) => !!dd[0].value)

  // create the AST nodes for each element
  elements = elements.map((dd: any) => {
    const token = dd[0]
    switch (token.type) {
      case 'literal':
        return t.literalExpr(token)
      case 'interpvar':
        return t.identifierExpr(token)
      case 'identifier':
        return t.identifierExpr(token)
      default:
        throw new Error(`Unkown template element: ${token.type}`)
    }
  })

  return t.templateExpr(elements)
}

// limited support, simple identifier passthrough for now
export const interpExpr: PP = ([, , token]) => token

export const slice: PP = d => t.sliceExpr(d[0])

export const modifier: PP = d => t.modifierExpr(d[0])

export const ws: PP = () => null

export const idd: PP = d => d[0][0]
