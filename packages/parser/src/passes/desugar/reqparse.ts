import type { RequestExpr, Stmt } from '@getlang/ast'
import { t } from '@getlang/ast'
import { invariant } from '@getlang/lib'
import { QuerySyntaxError } from '@getlang/lib/errors'
import { getContentField, tx } from '../../utils.js'

type Parsers = Record<string, { written: boolean }>

export class RequestParsers {
  private requests: RequestExpr[] = []
  private parsers: Parsers[] = []

  private require(req: RequestExpr) {
    const idx = this.requests.indexOf(req)
    invariant(idx !== -1, new QuerySyntaxError('Unmapped request'))
    return idx
  }

  private id(idx: number, field: string) {
    return `__${field}_${idx}`
  }

  visit(req: RequestExpr) {
    let idx = this.requests.indexOf(req)
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
    return tx.ident(this.id(idx, field))
  }

  private writeParser(idx: number, field: string): Stmt {
    const req = t.drillIdentifierExpr(tx.token(''), false)
    const id = tx.token(this.id(idx, field))
    const modbit = t.modifierExpr(tx.token(field))

    switch (field) {
      case 'link': {
        const expr = t.drillExpr([req, tx.select('url')])
        return t.assignmentStmt(id, expr, false)
      }

      case 'headers': {
        const expr = t.drillExpr([req, tx.select('headers')])
        return t.assignmentStmt(id, expr, false)
      }

      case 'cookies': {
        const expr = t.drillExpr([
          req,
          tx.select('headers'),
          tx.select('set-cookie'),
          modbit,
        ])
        return t.assignmentStmt(id, expr, true)
      }

      default: {
        const expr = t.drillExpr([req, tx.select('body'), modbit])
        return t.assignmentStmt(id, expr, false)
      }
    }
  }

  insert(stmts: Stmt[]) {
    return stmts.flatMap(stmt => {
      if (stmt.kind !== 'RequestStmt') {
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
