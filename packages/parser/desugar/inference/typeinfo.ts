import { invariant, QuerySyntaxError, ValueReferenceError } from '@getlang/lib'
import { NodeKind, type CExpr, type Expr } from '../../ast/ast.js'
import { RootScope } from '../../ast/scope.js'
import type { TransformVisitor, Visit } from '../../visitor/transform.js'
import { traceVisitor } from '../trace.js'
import { Type, type TypeInfo } from '../../ast/typeinfo.js'
import { render, selectTypeInfo } from '../utils.js'

function clone(a: unknown) {
  return JSON.parse(JSON.stringify(a))
}

function unwrap(typeInfo: TypeInfo) {
  if (typeInfo.type === Type.List) {
    return unwrap(typeInfo.of)
  }
  return typeInfo
}

function rewrap(
  typeInfo: TypeInfo | undefined,
  itemTypeInfo: TypeInfo,
): TypeInfo {
  if (typeInfo?.type !== Type.List) {
    return clone(itemTypeInfo)
  }
  return { ...typeInfo, of: rewrap(typeInfo.of, itemTypeInfo) }
}

export function inferTypeInfo(): TransformVisitor {
  const scope = new RootScope<Expr>()

  function itemVisit(node: CExpr, visit: Visit): Visit {
    return child => {
      if (child === node.context || !scope.context?.typeInfo) {
        return visit(child)
      }
      scope.pushContext({
        ...scope.context,
        typeInfo: unwrap(scope.context.typeInfo),
      })
      const xnode = visit(child)
      scope.popContext()
      return xnode
    }
  }

  // SliceExpr and ModuleCallExpr use default Type.Value
  const trace = traceVisitor(scope)

  return {
    ...trace,

    IdentifierExpr(node) {
      const id = node.value.value
      const value = scope.vars[id]
      invariant(value, new ValueReferenceError(node.value.value))
      const { typeInfo } = value
      return { ...node, typeInfo: clone(typeInfo) }
    },

    RequestExpr(node) {
      return {
        ...node,
        typeInfo: {
          type: Type.Struct,
          schema: {
            url: { type: Type.Value },
            status: { type: Type.Value },
            headers: { type: Type.Headers },
            body: { type: Type.Value },
          },
        },
      }
    },

    SliceExpr: {
      enter(node, visit) {
        const xnode = trace.SliceExpr.enter(node, itemVisit(node, visit))
        const typeInfo: TypeInfo = { type: Type.Value }
        return { ...xnode, typeInfo: rewrap(xnode.context?.typeInfo, typeInfo) }
      },
    },

    ModuleCallExpr: {
      enter(node, visit) {
        const xnode = trace.ModuleCallExpr.enter(node, itemVisit(node, visit))
        const typeInfo: TypeInfo = { type: Type.Value }
        return { ...xnode, typeInfo: rewrap(xnode.context?.typeInfo, typeInfo) }
      },
    },

    SelectorExpr: {
      enter(node, visit) {
        const xnode = trace.SelectorExpr.enter(node, itemVisit(node, visit))
        let typeInfo: TypeInfo = unwrap(
          xnode.context?.typeInfo ?? { type: Type.Value },
        )
        if (typeInfo.type === Type.Struct) {
          typeInfo = selectTypeInfo(typeInfo, xnode.selector) ?? {
            type: Type.Value,
          }
        } else if (
          typeInfo.type === Type.Headers ||
          typeInfo.type === Type.Cookies
        ) {
          typeInfo = { type: Type.Value }
        }
        if (xnode.expand) typeInfo = { type: Type.List, of: typeInfo }
        return { ...xnode, typeInfo: rewrap(xnode.context?.typeInfo, typeInfo) }
      },
    },

    ModifierExpr: {
      enter(node, visit) {
        const modTypeMap: Record<string, TypeInfo> = {
          html: { type: Type.Html },
          json: { type: Type.Value },
          js: { type: Type.Js },
          headers: { type: Type.Headers },
          cookies: { type: Type.Cookies },
          link: { type: Type.Value },
        }
        const xnode = trace.ModifierExpr.enter(node, itemVisit(node, visit))
        const mod = xnode.value.value
        const typeInfo = modTypeMap[mod]
        invariant(typeInfo, new QuerySyntaxError(`Unknown modifier: ${mod}`))
        return { ...xnode, typeInfo: rewrap(xnode.context?.typeInfo, typeInfo) }
      },
    },

    FunctionExpr: {
      enter(node, visit) {
        const xnode = trace.FunctionExpr.enter(node, itemVisit(node, visit))
        const typeInfo = xnode.body.find(
          stmt => stmt.kind === NodeKind.ExtractStmt,
        )?.value.typeInfo ?? { type: Type.Never }
        return { ...xnode, typeInfo: rewrap(xnode.context?.typeInfo, typeInfo) }
      },
    },

    ObjectLiteralExpr: {
      enter(node, visit) {
        const xnode = trace.ObjectLiteralExpr.enter(
          node,
          itemVisit(node, visit),
        )
        const typeInfo: TypeInfo = {
          type: Type.Struct,
          schema: Object.fromEntries(
            xnode.entries.map(e => {
              const key = render(e.key)
              invariant(
                key,
                new QuerySyntaxError('Object keys must be string literals'),
              )
              const value = e.value.typeInfo
              return [key, value]
            }),
          ),
        }
        return { ...xnode, typeInfo: rewrap(xnode.context?.typeInfo, typeInfo) }
      },
    },
  }
}
