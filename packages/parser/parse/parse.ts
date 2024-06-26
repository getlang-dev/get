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

export const request: PP = ([
  method,
  url,
  headerBlock,
  namedBlocks,
  maybeBody,
]) => {
  const headers = headerBlock?.[1] ?? []

  const blocks: Record<string, unknown> = {}
  for (const [, block] of namedBlocks) {
    blocks[block.name] = block.entries
  }

  const body = maybeBody?.[1]
  if (body) {
    for (const el of body.elements) {
      if (el.kind === NodeKind.LiteralExpr) {
        // restore original token text
        el.value.value = el.value.text
      }
    }
  }

  return t.requestStmt(t.requestExpr(method, url, headers, blocks, body))
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

export const objectEntryShorthandSelect: PP = ([identifier, optional]) => {
  const value = t.templateExpr([t.literalExpr(identifier)])
  const selector = t.selectorExpr(value, false)
  return objectEntry([identifier, optional, null, null, selector])
}

export const objectEntryShorthandIdent: PP = ([identifier, optional]) => {
  const value = t.identifierExpr(identifier)
  return objectEntry([identifier, optional, null, null, value])
}

const expandingSelectors = [NodeKind.TemplateExpr, NodeKind.IdentifierExpr]
export const drill: PP = ([context, , arrow, , bit]) => {
  const expand = arrow.value.startsWith('=')
  if (expandingSelectors.includes(bit.kind)) {
    return t.selectorExpr(bit, expand, context)
  }
  if (expand) {
    throw new SyntaxError('Wide arrow drill requires selector on RHS')
  }
  if (!('context' in bit)) {
    throw new SyntaxError('Invalid drill value')
  }
  bit.context = context
  return bit
}

export const drillContext: PP = ([arrow, expr]) => {
  const expand = arrow?.[0].value === '=>'
  if (expr.kind === NodeKind.TemplateExpr) {
    return t.selectorExpr(expr, expand)
  }
  if (expand) {
    throw new SyntaxError('Wide arrow drill requires selector on RHS')
  }
  return expr
}

export const identifier: PP = ([id]) => {
  return t.identifierExpr(id)
}

export const template: PP = d => {
  // filter out any empty tokens (that were used for peeking)
  let elements = d[0].filter((dd: any) => !!dd[0].value)

  // create the AST nodes for each element
  elements = elements.flatMap((dd: any, i: number) => {
    const token = dd[0]

    switch (token.type) {
      case 'interpvar':
      case 'identifier':
        return t.identifierExpr(token)

      case 'literal': {
        let { value } = token
        if (i === 0) {
          value = value.trimLeft()
        }
        if (i === elements.length - 1) {
          value = value.trimRight()
        }
        if (!value) {
          return []
        }
        return t.literalExpr({ ...token, value })
      }

      default:
        throw new SyntaxError(`Unkown template element: ${token.type}`)
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
