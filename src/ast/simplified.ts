import type { Node, Stmt, Expr, Program } from './ast'
import { NodeKind, t } from './ast'
import type { Visitor } from './visitor'
import { visit } from './visitor'
import { analyzeSlice } from './desugar/slice'
import { createToken, getContentMod } from './desugar/utils'

type Context = Stmt | Expr
type RequestStmt = ReturnType<typeof t.requestStmt>
type IdentifierExpr = ReturnType<typeof t.identifierExpr>
type Parsed = { [mod: string]: string }

class Scope {
  private contextStack: Context[] = []
  private parsedResponses = new Map<RequestStmt, Parsed>()

  constructor(initialContext?: Context) {
    if (initialContext) {
      this.contextStack.push(initialContext)
    }
  }

  pushContext(context: Context) {
    this.contextStack.push(context)
    if (context.kind === NodeKind.RequestStmt) {
      this.parsedResponses.set(context, {})
    }
  }

  popContext() {
    this.contextStack.pop()
  }

  get context() {
    return this.contextStack.at(-1)
  }

  hasRequest(req: RequestStmt) {
    return this.parsedResponses.has(req)
  }

  getParsedRequestId(req: RequestStmt, mod = getContentMod(req)): string {
    const parsed = this.parsedResponses.get(req)
    if (!parsed) {
      throw new Error('Request cannot be parsed, does not exist in scope')
    }
    const pos = [...this.parsedResponses.keys()].indexOf(req)
    const name = `_res_${pos}_parsed_${mod}_`
    parsed[mod] = name
    return name
  }

  finalize() {
    const parserStmts = new Map<RequestStmt, Stmt[]>()
    for (const [req, parsed] of this.parsedResponses.entries()) {
      const stmts = Object.entries(parsed).map(([mod, id]) => {
        const selectBody = t.drillExpr(
          t.identifierExpr(createToken('_context_')),
          t.templateExpr([t.literalExpr(createToken('body'))]),
          false
        )
        const parseBody = t.drillExpr(
          selectBody,
          t.modifierExpr(createToken(`@${mod}`, mod)),
          false
        )
        return t.assignmentStmt(createToken(id), parseBody, false)
      })
      parserStmts.set(req, stmts)
    }
    return { parserStmts }
  }
}

class ScopeStack {
  private stack: Scope[] = []

  newScope() {
    let initialContext: Context | undefined
    if (this.stack.length) {
      initialContext = this.current.context
    }
    const scope = new Scope(initialContext)
    this.stack.push(scope)
  }

  finalizeScope() {
    const scope = this.stack.pop()
    if (scope) {
      return scope.finalize()
    }
    throw new Error('Attempted to finalize scope on an empty stack')
  }

  get current(): Scope {
    const scope = this.stack.at(-1)
    if (!scope) {
      throw new Error('Scope not found')
    }
    return scope
  }

  drillContext(bit: Expr, expand: boolean): Expr {
    let target: IdentifierExpr
    const { context } = this.current
    if (!context) {
      throw new Error('Drill unable to locate active context')
    }
    if (context.kind === NodeKind.RequestStmt) {
      const isModifier = bit.kind === NodeKind.ModifierExpr
      const mod = isModifier ? bit.value.value : undefined
      const scope = this.stack.find(x => x.hasRequest(context))
      if (!scope) {
        throw new Error('Encountered orphan context')
      }
      const id = scope.getParsedRequestId(context, mod)
      target = t.identifierExpr(createToken(id))
      if (isModifier) {
        return target
      }
    } else {
      target = t.identifierExpr(createToken('_context_'))
    }
    return t.drillExpr(target, bit, expand)
  }
}

const appendTrailing = (body: Stmt[], map: Map<Stmt, Stmt[]>) => {
  return body.flatMap(stmt => {
    const withTrailing = [stmt, ...(map.get(stmt) || [])]
    return withTrailing
  })
}

export function desugar(ast: Node): Program {
  if (!(ast.kind === NodeKind.Program)) {
    throw new Error(`Non-program AST node provided: ${ast}`)
  }

  const scopes = new ScopeStack()
  let disableSliceAnalysis = false

  const visitor: Visitor<any> = {
    Program: {
      enter() {
        scopes.newScope()
      },
      exit(node) {
        const final = scopes.finalizeScope()
        const body = appendTrailing(node.body, final?.parserStmts)
        return { ...node, body }
      },
    },

    FunctionExpr: {
      enter() {
        scopes.newScope()
      },
      exit(node) {
        scopes.finalizeScope()
        return node
      },
    },

    RequestStmt(node) {
      scopes.current.pushContext(node as any)
      return node
    },

    DrillExpr: {
      enter(node, _visit) {
        if (node.target === 'context') {
          return
        }
        const target = _visit(node.target)
        scopes.current.pushContext(target)
        disableSliceAnalysis = node.bit.kind === NodeKind.SliceExpr
        const bit = _visit(node.bit)
        disableSliceAnalysis = false
        return { ...node, target, bit }
      },
      exit(node) {
        if (node.target === 'context') {
          return scopes.drillContext(node.bit as Expr, node.expand)
        }
        scopes.current.popContext()
        return node
      },
    },

    SliceExpr(node) {
      if (disableSliceAnalysis) {
        // a context for the slice has already been defined
        // avoid desugar, which may have already been run
        return node
      }

      const stat = analyzeSlice(node.slice.value)
      const slice = t.sliceExpr(createToken(stat.source))
      if (!stat.deps.length) {
        return slice
      }
      const contextEntries = stat.deps.map(id => ({
        key: t.literalExpr(createToken(id)),
        value: t.identifierExpr(createToken(id)),
        optional: false,
      }))
      const context = t.objectLiteralExpr(contextEntries)
      return t.drillExpr(context, slice, false)
    },
  }

  return visit(ast, visitor)
}
