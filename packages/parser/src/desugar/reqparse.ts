import { QuerySyntaxError, invariant } from '@getlang/utils'
import type { Expr, RequestExpr, Stmt } from '../ast/ast.js'
import { NodeKind, t } from '../ast/ast.js'
import { getContentField, tx } from './utils.js'

type Parsers = Record<string, { written: boolean }>

export class RequestParsers {
  private requests: RequestExpr[] = []
  private parsers: Parsers[] = []

  private require(req: RequestExpr) {
    const idx = this.requests.findIndex(r => r === req)
    invariant(idx !== -1, new QuerySyntaxError('Unmapped request'))
    return idx
  }

  private id(idx: number, field: string) {
    return `__${field}_${idx}`
  }

  visit(req: RequestExpr) {
    let idx = this.requests.findIndex(r => r === req)
    if (idx === -1) {
      idx = this.requests.length
      this.requests.push(req)
    }
  }

  lookup(req: RequestExpr, field: string = getContentField(req)) {
    const idx = this.require(req)
    this.parsers[idx] ??= {}
    const parsers = this.parsers[idx]
    parsers[field] ??= { written: false }
    return this.id(idx, field)
  }

  private writeParser(idx: number, field: string): Stmt {
    function expr() {
      const reqId = tx.ident('')
      let context: Expr
      switch (field) {
        case 'url':
          return tx.select('url', reqId)
        case 'headers':
          return tx.select('headers', reqId)
        case 'cookies': {
          context = tx.select('set-cookie', tx.select('headers', reqId))
          break
        }
        default: {
          context = tx.select('body', reqId)
        }
      }
      return t.callExpr(tx.token(field), undefined, context)
    }

    const id = this.id(idx, field)
    const optional = field === 'cookies'
    return t.assignmentStmt(tx.token(id), expr(), optional)
  }

  insert(stmts: Stmt[]) {
    return stmts.flatMap(stmt => {
      if (stmt.kind !== NodeKind.RequestStmt) {
        return stmt
      }
      const idx = this.require(stmt.request)
      const parsers = this.parsers[idx]
      if (!parsers) {
        return stmt
      }
      const unwritten = Object.entries(parsers).filter(e => !e[1].written)
      const parserStmts = unwritten.map(([field, parser]) => {
        parser.written = true
        return this.writeParser(idx, field)
      })
      return [stmt, ...parserStmts]
    })
  }

  reset() {
    this.requests = []
  }
}
