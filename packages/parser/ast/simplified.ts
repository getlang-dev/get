import { invariant, QuerySyntaxError } from '@getlang/lib'
import type { Node, Program, Expr } from './ast.js'
import { NodeKind, t } from './ast.js'
import type { Visitor } from './visitor.js'
import { visit } from './visitor.js'
import { RootScope } from './scope.js'
import type { TypeInfo } from './typeinfo.js'
import { Type } from './typeinfo.js'
import { analyzeSlice } from './desugar/slice.js'
import type { Parsers } from './desugar/parsers.js'
import { insertParsers } from './desugar/parsers.js'
import {
  createToken,
  getContentMod,
  getTypeInfo,
  selectTypeInfo,
  getModTypeInfo,
} from './desugar/utils.js'

export function desugar(ast: Node): Program {
  invariant(
    ast.kind === NodeKind.Program,
    new QuerySyntaxError(`Non-program AST node provided: ${ast}`),
  )

  const scope = new RootScope<Expr>()
  const parsers: Parsers = new Map()

  function requireContext() {
    invariant(
      scope.context,
      new QuerySyntaxError('Unable to locate active context'),
    )
    return scope.context
  }

  function render(expr: Expr) {
    switch (expr.kind) {
      case NodeKind.LiteralExpr:
        return expr.value.value
      case NodeKind.TemplateExpr: {
        const template: string[] = []
        for (const el of expr.elements) {
          const r = render(el)
          if (typeof r !== 'string') {
            return
          }
          template.push(r)
        }
        return template.join('')
      }
    }
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
          new QuerySyntaxError('Failed to create item context'),
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
      return { ...node, typeInfo: { type: Type.Unknown } }
    },

    TemplateExpr(node) {
      return { ...node, typeInfo: { type: Type.Unknown } }
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
          const typeInfo: TypeInfo = {
            type: Type.Struct,
            schema: Object.fromEntries(
              entries.flatMap(e => {
                const key = render(e.key)
                return key ? [[key, getTypeInfo(e.value)]] : []
              }),
            ),
          }
          return { ...node, entries, typeInfo }
        })
      },
    },

    SelectorExpr: {
      enter(node, visit) {
        const context = visit(node.context ?? inferContext())
        const itemContext = t.selectorExpr(node.selector, node.expand)
        return contextual(context, itemContext, visit, () => {
          const ctype = getTypeInfo(context)
          let typeInfo: TypeInfo = ctype
          if (ctype.type === Type.Struct) {
            const selStr = render(node.selector)
            typeInfo = selStr
              ? selectTypeInfo(context, selStr)
              : { type: Type.Unknown }
          }
          if (node.expand) {
            typeInfo = { type: Type.List, of: typeInfo }
          }
          return { ...node, context, typeInfo }
        })
      },
    },

    ModifierExpr: {
      enter(node, visit) {
        const mod = node.value.value
        const context = visit(node.context ?? inferContext(mod))
        const itemContext = t.modifierExpr(node.value)
        const onRequest =
          !node.context && scope.context?.kind === NodeKind.RequestExpr
        return contextual(context, itemContext, visit, () => {
          // if request context, replace modifier with parser identifier
          return onRequest
            ? context
            : { ...node, context, typeInfo: getModTypeInfo(mod) }
        })
      },
    },

    // typeinfo is lost / resets back to Type.Unknown
    SliceExpr: {
      enter(node, visit) {
        const context = node.context && visit(node.context)
        const itemContext = t.sliceExpr(node.slice)
        return contextual(context, itemContext, visit, () => {
          const stat = analyzeSlice(node.slice.value, !context)
          const slice = createToken(stat.source)
          const typeInfo: TypeInfo = { type: Type.Unknown }
          if (stat.deps.length === 0) {
            return {
              ...t.sliceExpr(slice, context),
              typeInfo,
            }
          }
          const contextEntries = stat.deps.map(id => ({
            key: t.literalExpr(createToken(id)),
            value: t.identifierExpr(createToken(id)),
            optional: false,
          }))

          return {
            ...node,
            slice,
            context: t.objectLiteralExpr(contextEntries),
            typeInfo,
          }
        })
      },
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
            status: { type: Type.Unknown },
            headers: { type: Type.Headers },
            body: { type: Type.Unknown },
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
  invariant(
    simplified.kind === NodeKind.Program,
    new QuerySyntaxError('Desugar encountered unexpected error'),
  )
  return simplified
}
