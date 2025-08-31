import type { Expr, Node } from '@getlang/ast'
import type { Path } from '@getlang/walker'
import { ScopeTracker } from '@getlang/walker'

export class LineageTracker extends ScopeTracker<Expr> {
  private lineage = new Map<Expr, Expr>()

  getLineage(expr: Expr) {
    return this.lineage.get(expr)
  }

  traceLineageRoot(expr: Expr) {
    let parent = this.lineage.get(expr)
    while (parent && this.lineage.has(parent)) {
      parent = this.lineage.get(parent)
    }
    return parent
  }

  override exit(node: Node, path: Path) {
    const derive = (base: Expr) => this.lineage.set(node as Expr, base)

    switch (node.kind) {
      case 'IdentifierExpr':
      case 'DrillIdentifierExpr':
        derive(this.lookup(node.id.value))
        break

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
    }

    super.exit(node, path)
  }
}
