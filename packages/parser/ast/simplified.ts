import { RootScope, Type, type TypeInfo, invariant } from '@getlang/utils'
import type { Node, Program, Expr } from './ast'
import { NodeKind, t } from './ast'
import type { Visitor } from './visitor'
import { visit } from './visitor'
import { analyzeSlice } from './desugar/slice'
import type { Parsers } from './desugar/parsers'
import { insertParsers } from './desugar/parsers'
import {
  createToken,
  getContentMod,
  getTypeInfo,
  getModTypeInfo,
} from './desugar/utils'

export function desugar(ast: Node): Program {
  if (!(ast.kind === NodeKind.Program)) {
    throw new SyntaxError(`Non-program AST node provided: ${ast}`)
  }

  const scope = new RootScope<Expr>()
  const parsers: Parsers = new Map()

  function requireContext() {
    invariant(scope.context, new SyntaxError('Unable to locate active context'))
    return scope.context
  }

  function inferContext(_mod?: string) {
    const context = requireContext()
    if (context.kind !== NodeKind.RequestExpr) {
      return t.identifierExpr(createToken(''))
    }
    const mod = _mod ?? getContentMod(context)
    const [mods, index] = parsers.get(context) ?? [new Set(), parsers.size]
    mods.add(mod)
    parsers.set(context, [mods, index])
    const id = `__${mod}_${index}`
    scope.vars[id] ??= {
      ...t.modifierExpr(createToken(mod)),
      typeInfo: getModTypeInfo(mod),
    }
    return t.identifierExpr(createToken(id))
  }

  function contextual(
    context: Expr | undefined,
    itemContext: Expr,
    visit: (expr: Expr) => Expr,
    cb: () => Expr,
  ): Expr {
    if (context) {
      const ctype = getTypeInfo(context)
      if (ctype.type === Type.List) {
        scope.pushContext(context)
        const fn = visit(
          t.functionExpr(
            [t.extractStmt(itemContext)],
            t.identifierExpr(createToken('')),
          ),
        )
        invariant(
          fn.kind === NodeKind.FunctionExpr,
          new SyntaxError('Failed to create item context'),
        )
        scope.popContext()
        const typeInfo: TypeInfo = { type: Type.List, of: getTypeInfo(fn) }
        return { ...fn, context, typeInfo }
      }
    }

    context && scope.pushContext(context)
    const node = cb()
    context && scope.popContext()
    return node
  }

  const visitor: Visitor = {
    LiteralExpr(node) {
      return { ...node, typeInfo: { type: Type.String } }
    },

    TemplateExpr(node) {
      return { ...node, typeInfo: { type: Type.String } }
    },

    IdentifierExpr(node) {
      const id = node.value.value
      const typeInfo = getTypeInfo(
        scope.vars[id],
        `Failed to find type info for variable '${id}'`,
      )
      return { ...node, typeInfo }
    },

    FunctionExpr: {
      enter(node, visit) {
        let context: Expr | undefined = node.context && visit(node.context)
        if (context) {
          const ctype = getTypeInfo(context)
          if (ctype.type === Type.List) {
            // item context
            context = { ...context, typeInfo: ctype.of }
          }
        }
        scope.push(context)
        const body = node.body.map(stmt => visit(stmt))
        const extracted = scope.pop()
        return {
          ...node,
          body: insertParsers(body, parsers),
          typeInfo: getTypeInfo(extracted),
        }
      },
    },

    ObjectLiteralExpr: {
      enter(node, visit) {
        const context = node.context && visit(node.context)
        const itemContext = t.objectLiteralExpr(node.entries)
        return contextual(context, itemContext, visit, () => {
          const entries = node.entries.map(e => ({
            key: visit(e.key),
            value: visit(e.value),
            optional: e.optional,
          }))
          return {
            ...node,
            entries,
            typeInfo: { type: Type.Unknown },
          }
        })
      },
    },

    SelectorExpr: {
      enter(node, visit) {
        const context = visit(
          node.context === 'infer' ? inferContext() : node.context,
        )
        const itemContext = t.selectorExpr(node.selector, node.expand)
        return contextual(context, itemContext, visit, () => {
          const ctype = getTypeInfo(context)
          const typeInfo: TypeInfo = node.expand
            ? { type: Type.List, of: ctype }
            : ctype
          return { ...node, context, typeInfo }
        })
      },
    },

    ModifierExpr: {
      enter(node, visit) {
        const mod = node.value.value
        const context = visit(
          node.context === 'infer' ? inferContext(mod) : node.context,
        )
        const itemContext = t.modifierExpr(node.value)
        return contextual(context, itemContext, visit, () => {
          const ctype = getTypeInfo(context)
          const mtype = getModTypeInfo(mod)
          if (ctype.type === mtype.type) {
            // remove modifier
            return context
          }
          return { ...node, context, typeInfo: mtype }
        })
      },
    },

    // typeinfo is lost / resets back to Type.Unknown
    SliceExpr(node) {
      const stat = analyzeSlice(node.slice.value, !node.context)
      const slice = createToken(stat.source)
      const typeInfo: TypeInfo = { type: Type.Unknown }
      if (stat.deps.length === 0) {
        return {
          ...t.sliceExpr(slice, node.context),
          typeInfo,
        }
      }
      const contextEntries = stat.deps.map(id => ({
        key: t.literalExpr(createToken(id)),
        value: t.identifierExpr(createToken(id)),
        optional: false,
      }))
      const context = t.objectLiteralExpr(contextEntries)
      return { ...node, slice, context, typeInfo }
    },

    // typeinfo is lost / resets back to Type.Unknown
    ModuleCallExpr(node) {
      return { ...node, typeInfo: { type: Type.Unknown } }
    },

    RequestExpr(node) {
      return {
        ...node,
        typeInfo: {
          type: Type.Struct,
          schema: {
            status: { type: Type.Json },
            headers: { type: Type.Headers },
            body: { type: Type.String },
          },
        },
      }
    },

    InputDeclStmt(node) {
      scope.vars[node.id.value] = {
        ...t.identifierExpr(node.id),
        typeInfo: { type: Type.Unknown },
      }
      return node
    },

    RequestStmt(node) {
      scope.pushContext(node.request)
      return node
    },

    AssignmentStmt(node) {
      scope.vars[node.name.value] = node.value
      return node
    },

    ExtractStmt(node) {
      scope.extracted = node.value
      return node
    },

    Program(node) {
      return { ...node, body: insertParsers(node.body, parsers) }
    },
  }

  const simplified = visit(ast, visitor)
  if (simplified.kind !== NodeKind.Program) {
    throw new SyntaxError('Desugar encountered unexpected error')
  }
  return simplified
}
