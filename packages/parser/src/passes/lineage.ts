import type { Expr, Node } from '@getlang/ast'
import { invariant } from '@getlang/lib'
import { ValueReferenceError } from '@getlang/lib/errors'
import type { Path } from '@getlang/walker'
import { ScopeTracker } from '@getlang/walker'

type Parent = Expr | Expr[]

export class LineageTracker extends ScopeTracker<Expr> {
  private lineage = new Map<Expr, Parent>()

  getLineage(expr: Expr) {
    return this.lineage.get(expr)
  }

  traceLineageRoots(from: Expr): Parent | undefined {
    const plan = new Set([from])
    const roots = new Set<Expr>()

    for (const expr of plan) {
      const lineage = this.getLineage(expr)
      if (lineage) {
        const list = Array.isArray(lineage) ? lineage : [lineage]
        for (const expr of list) {
          plan.add(expr)
        }
      } else if (expr !== from) {
        roots.add(expr)
      }
    }

    const [first, ...rest] = roots
    return rest.length ? Array.from(roots) : first
  }

  override exit(node: Node, path: Path) {
    const derive = (base: Parent) => this.lineage.set(node as Expr, base)

    switch (node.kind) {
      case 'IdentifierExpr':
      case 'DrillIdentifierExpr': {
        const id = node.id.value
        const value = this.lookup(id)
        invariant(value, new ValueReferenceError(id))
        derive(value)
        break
      }

      case 'DrillExpr':
        derive(node.body.at(-1)!)
        break

      case 'ModifierExpr':
      case 'SelectorExpr':
        derive(this.context!)
        break

      case 'SubqueryExpr':
        if (this.extracted) {
          derive(this.extracted)
        }
        break

      case 'ObjectLiteralExpr':
        derive(node.entries.map(x => x.value))
        break
    }

    super.exit(node, path)
  }
}
