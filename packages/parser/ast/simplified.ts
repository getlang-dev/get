import type { Node, Stmt, Expr, Program } from './ast'
import { NodeKind, t } from './ast'
import type { Visitor } from './visitor'
import { visit } from './visitor'
import { analyzeSlice } from './desugar/slice'
import { createToken, getContentMod } from './desugar/utils'

type Context = Stmt | Expr
type RequestStmt = ReturnType<typeof t.requestStmt>
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
      throw new SyntaxError('Request cannot be parsed, does not exist in scope')
    }
    const pos = [...this.parsedResponses.keys()].indexOf(req)
    const name = `__${mod}_${pos}`
    parsed[mod] = name
    return name
  }

  finalize() {
    const parserStmts = new Map<RequestStmt, Stmt[]>()
    for (const [req, parsed] of this.parsedResponses.entries()) {
      const stmts = Object.entries(parsed).map(([mod, id]) => {
        const contextId = t.identifierExpr(createToken(''))
        let target: Expr
        let field = 'body'

        if (mod === 'cookies') {
          target = t.drillExpr(
            contextId,
            t.templateExpr([t.literalExpr(createToken('headers'))]),
            false,
          )
          field = 'set-cookie'
        } else {
          target = contextId
          if (mod === 'headers') {
            field = 'headers'
          }
        }
        let expr: Expr = t.drillExpr(
          target,
          t.templateExpr([t.literalExpr(createToken(field))]),
          false,
        )

        if (mod !== 'headers') {
          expr = t.drillExpr(
            expr,
            t.modifierExpr(createToken(`@${mod}`, mod)),
            false,
          )
        }

        const optional = mod === 'cookies'
        return t.assignmentStmt(createToken(id), expr, optional)
      })
      parserStmts.set(req, stmts)
    }
    return { parserStmts }
  }
}

class ScopeStack {
  stack: Scope[] = []

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
    throw new SyntaxError('Attempted to finalize scope on an empty stack')
  }

  get current(): Scope {
    const scope = this.stack.at(-1)
    if (!scope) {
      throw new SyntaxError('Scope not found')
    }
    return scope
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
    throw new SyntaxError(`Non-program AST node provided: ${ast}`)
  }

  const scopes = new ScopeStack()
  let disableSliceAnalysis = false

  const visitor: Visitor = {
    Program: {
      enter() {
        scopes.newScope()
        return undefined
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
        return undefined
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
      enter(node, visit) {
        let target: Expr
        let bit: Expr = node.bit

        if (node.target === 'context') {
          const { context } = scopes.current
          if (!context) {
            throw new SyntaxError('Drill unable to locate active context')
          }
          if (context.kind === NodeKind.RequestStmt) {
            const bit = node.bit
            const isModifier = bit.kind === NodeKind.ModifierExpr
            const mod = isModifier ? bit.value.value : undefined
            const scope = scopes.stack.find(x => x.hasRequest(context))
            if (!scope) {
              throw new SyntaxError('Encountered orphan context')
            }
            const id = scope.getParsedRequestId(context, mod)
            target = t.identifierExpr(createToken(id))
            if (isModifier) {
              // replace the context drill with identifier for the
              // parsed value, essentially removing the modifier expr
              return target
            }
          } else {
            target = t.identifierExpr(createToken(''))
          }
        } else {
          target = visit(node.target)
        }

        scopes.current.pushContext(target)
        disableSliceAnalysis = bit.kind === NodeKind.SliceExpr
        bit = visit(node.bit)
        disableSliceAnalysis = false
        scopes.current.popContext()
        return t.drillExpr(target, bit, node.expand)
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

  const simplified = visit(ast, visitor)
  if (simplified.kind !== NodeKind.Program) {
    throw new SyntaxError('Desugar encountered unexpected error')
  }
  return simplified
}
