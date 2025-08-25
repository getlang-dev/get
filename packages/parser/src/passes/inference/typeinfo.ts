import { invariant } from '@getlang/utils'
import { QuerySyntaxError, ValueReferenceError } from '@getlang/utils/errors'
import type { CExpr, Program } from '../../ast/ast.js'
import { NodeKind, t } from '../../ast/ast.js'
import type { TypeInfo } from '../../ast/typeinfo.js'
import { Type } from '../../ast/typeinfo.js'
import { render, selectTypeInfo } from '../../utils.js'
import type { TransformVisitor, Visit } from '../../visitor/transform.js'
import { visit } from '../../visitor/visitor.js'
import { traceVisitor } from '../trace.js'

const modTypeMap: Record<string, TypeInfo> = {
  html: { type: Type.Html },
  js: { type: Type.Js },
  json: { type: Type.Value },
  link: { type: Type.Value },
  headers: { type: Type.Headers },
  cookies: { type: Type.Cookies },
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

function specialize(macroType: TypeInfo, contextType?: TypeInfo) {
  function walk(ti: TypeInfo): TypeInfo {
    switch (ti.type) {
      case Type.Context:
        invariant(contextType, 'Specialize requires context type')
        return contextType
      case Type.Maybe:
        return { ...ti, option: walk(ti.option) }
      case Type.List:
        return { ...ti, of: walk(ti.of) }
      case Type.Struct: {
        const schema = Object.fromEntries(
          Object.entries(ti.schema).map(e => [e[0], walk(e[1])]),
        )
        return { ...ti, schema }
      }
      default:
        return ti
    }
  }
  return walk(macroType)
}

type ResolveTypeOptions = {
  returnTypes: { [module: string]: TypeInfo }
  contextType?: TypeInfo
}

export function resolveTypes(ast: Program, options: ResolveTypeOptions) {
  const { returnTypes, contextType } = options
  const { scope, trace } = traceVisitor(contextType)
  let optional = false
  function setOptional<T>(opt: boolean, cb: () => T): T {
    const last = optional
    optional = opt
    const ret = cb()
    optional = last
    return ret
  }

  function withContext<C extends CExpr>(cb: (tnode: C, ivisit: Visit) => C) {
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

  const visitor: TransformVisitor = {
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

    IdentifierExpr: {
      enter: withContext((node, visit) => {
        const id = node.id.value
        const xnode = trace.IdentifierExpr.enter(node, visit)
        const value = id ? scope.vars[id] : xnode.context || scope.context
        invariant(value, new ValueReferenceError(id))
        let typeInfo = structuredClone(value.typeInfo)
        if (xnode.expand) {
          typeInfo = { type: Type.List, of: typeInfo }
        }
        return { ...xnode, typeInfo }
      }),
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
      enter: withContext((node, visit) => {
        const xnode = trace.SliceExpr.enter(node, visit)
        let typeInfo: TypeInfo = { type: Type.Value }
        if (optional) {
          typeInfo = { type: Type.Maybe, option: typeInfo }
        }
        return { ...xnode, typeInfo }
      }),
    },

    SelectorExpr: {
      enter: withContext((node, visit) => {
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
      enter: withContext((node, visit) => {
        const mod = node.modifier.value
        const xnode = trace.ModifierExpr.enter(node, visit)
        const typeInfo = modTypeMap[mod] || returnTypes[mod]
        invariant(typeInfo, 'Modifier type lookup failed')
        return { ...xnode, typeInfo }
      }),
    },

    ModuleExpr: {
      enter: withContext((node, visit) => {
        const xnode = trace.ModuleExpr.enter(node, visit)
        if (!node.call) {
          return { ...xnode, typeInfo: { type: Type.Value } }
        }
        const returnType = returnTypes[node.module.value]
        invariant(returnType, 'Module return type lookup failed')
        const typeInfo = specialize(returnType, xnode.context?.typeInfo)
        return { ...xnode, typeInfo }
      }),
    },

    SubqueryExpr: {
      enter: withContext((node, visit) => {
        const xnode = trace.SubqueryExpr.enter(node, visit)
        const typeInfo = xnode.body.find(
          stmt => stmt.kind === NodeKind.ExtractStmt,
        )?.value.typeInfo ?? { type: Type.Never }
        return { ...xnode, typeInfo }
      }),
    },

    ObjectLiteralExpr: {
      enter: withContext((node, visit) => {
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
  }

  const program: Program = visit(ast, visitor)
  const ex = program.body.find(s => s.kind === NodeKind.ExtractStmt)
  const returnType = ex?.value.typeInfo ?? { type: Type.Never }

  return { program, returnType }
}
