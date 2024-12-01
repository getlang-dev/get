import {
  QuerySyntaxError,
  ValueReferenceError,
  invariant,
} from '@getlang/utils'
import { type CExpr, type Expr, NodeKind, t } from '../../ast/ast.js'
import { RootScope } from '../../ast/scope.js'
import { Type, type TypeInfo } from '../../ast/typeinfo.js'
import type { TransformVisitor, Visit } from '../../visitor/transform.js'
import { traceVisitor } from '../trace.js'
import { render, selectTypeInfo } from '../utils.js'

const modTypeMap: Record<string, TypeInfo> = {
  html: { type: Type.Html },
  json: { type: Type.Value },
  js: { type: Type.Js },
  headers: { type: Type.Headers },
  cookies: { type: Type.Cookies },
  link: { type: Type.Value },
}

function unwrap(typeInfo: TypeInfo) {
  switch (typeInfo.type) {
    case Type.List:
      return unwrap(typeInfo.of)
    case Type.Maybe:
      return unwrap(typeInfo.option)
    default:
      return typeInfo
  }
}

function rewrap(
  typeInfo: TypeInfo | undefined,
  itemTypeInfo: TypeInfo,
  optional: boolean,
): TypeInfo {
  switch (typeInfo?.type) {
    case Type.List:
      return { ...typeInfo, of: rewrap(typeInfo.of, itemTypeInfo, optional) }
    case Type.Maybe: {
      const option = rewrap(typeInfo.option, itemTypeInfo, optional)
      if (option.type === Type.Maybe || !optional) {
        return option
      }
      return { ...typeInfo, option }
    }
    default:
      return structuredClone(itemTypeInfo)
  }
}

export function inferTypeInfo(): TransformVisitor {
  const scope = new RootScope<Expr>()

  let optional = false
  function setOptional<T>(opt: boolean, cb: () => T): T {
    const last = optional
    optional = opt
    const ret = cb()
    optional = last
    return ret
  }

  function ctx<C extends CExpr>(cb: (tnode: C, ivisit: Visit) => C) {
    return function enter(node: C, visit: Visit): C {
      if (!node.context) {
        return cb(node, visit)
      }
      const context = visit(node.context)
      const itemContext: any = {
        ...context,
        typeInfo: unwrap(context.typeInfo),
      }

      const ivisit: Visit = child =>
        child === itemContext ? itemContext : visit(child)

      const xnode = cb({ ...node, context: itemContext }, ivisit)

      const typeInfo = rewrap(context.typeInfo, xnode.typeInfo, optional)
      return { ...xnode, context, typeInfo }
    }
  }

  const trace = traceVisitor(scope)

  return {
    ...trace,

    InputDeclStmt: {
      enter(node, visit) {
        const xnode = { ...node }
        const dv = node.defaultValue
        xnode.defaultValue = dv && setOptional(node.optional, () => visit(dv))
        const input = t.identifierExpr(node.id)
        if (node.optional) {
          input.typeInfo = { type: Type.Maybe, option: input.typeInfo }
        }
        scope.vars[node.id.value] = input
        return xnode
      },
    },

    AssignmentStmt: {
      enter(node, visit) {
        const value = setOptional(node.optional, () => visit(node.value))
        return trace.AssignmentStmt({ ...node, value })
      },
    },

    IdentifierExpr(node) {
      const id = node.value.value
      const value = scope.vars[id]
      invariant(value, new ValueReferenceError(node.value.value))
      return { ...node, typeInfo: structuredClone(value.typeInfo) }
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
      enter: ctx((node, visit) => {
        const xnode = trace.SliceExpr.enter(node, visit)
        let typeInfo: TypeInfo = { type: Type.Value }
        if (optional) {
          typeInfo = { type: Type.Maybe, option: typeInfo }
        }
        return { ...xnode, typeInfo }
      }),
    },

    SelectorExpr: {
      enter: ctx((node, visit) => {
        const xnode = trace.SelectorExpr.enter(node, visit)
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

        if (xnode.expand) {
          typeInfo = { type: Type.List, of: typeInfo }
        } else if (optional) {
          typeInfo = { type: Type.Maybe, option: typeInfo }
        }

        return { ...xnode, typeInfo }
      }),
    },

    ModifierExpr: {
      enter: ctx((node, visit) => {
        const xnode = trace.ModifierExpr.enter(node, visit)
        const mod = xnode.value.value
        const typeInfo = modTypeMap[mod]
        invariant(typeInfo, new QuerySyntaxError(`Unknown modifier: ${mod}`))
        return { ...xnode, typeInfo }
      }),
    },

    SubqueryExpr: {
      enter: ctx((node, visit) => {
        const xnode = trace.SubqueryExpr.enter(node, visit)
        const typeInfo = xnode.body.find(
          stmt => stmt.kind === NodeKind.ExtractStmt,
        )?.value.typeInfo ?? { type: Type.Never }
        return { ...xnode, typeInfo }
      }),
    },

    ObjectLiteralExpr: {
      enter: ctx((node, visit) => {
        const xnode = trace.ObjectLiteralExpr.enter(node, child => {
          if (child === node.context) {
            return visit(child)
          }
          const entry = node.entries.find(e => e.value === child)
          invariant(
            entry,
            new QuerySyntaxError('Object entry missing typeinfo'),
          )
          return setOptional(entry.optional, () => visit(child))
        })

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

        return { ...xnode, typeInfo }
      }),
    },

    ModuleCallExpr: {
      enter: ctx((node, visit) => {
        const xnode = trace.ModuleCallExpr.enter(node, visit)
        const typeInfo: TypeInfo = { type: Type.Value }
        return { ...xnode, typeInfo }
      }),
    },
  }
}
