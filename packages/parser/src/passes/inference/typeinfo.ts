import type { Expr, Node, Program, TypeInfo } from '@getlang/ast'
import { Type, t } from '@getlang/ast'
import { invariant } from '@getlang/lib'
import { QuerySyntaxError, ValueReferenceError } from '@getlang/lib/errors'
import type { Path, TransformVisitor } from '@getlang/walker'
import { ScopeTracker, transform } from '@getlang/walker'
import { toPath } from 'lodash-es'
import { render, tx } from '../../utils.js'

function unwrap(typeInfo: TypeInfo) {
  switch (typeInfo.type) {
    case Type.List:
      return unwrap(typeInfo.of)
    case Type.Maybe:
      return unwrap(typeInfo.option)
    default:
      return structuredClone(typeInfo)
  }
}

function rewrap(
  typeInfo: TypeInfo | undefined,
  itemTypeInfo: TypeInfo,
  optional?: boolean,
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

class ItemScopeTracker extends ScopeTracker<Expr> {
  optional = [false]

  override enter(node: Node) {
    super.enter(node)
    if (this.context && 'typeInfo' in node) {
      this.push({
        ...this.context,
        typeInfo: unwrap(this.context.typeInfo),
      })
    }
  }

  override exit(node: Node, path: Path) {
    if (this.context && 'typeInfo' in node) {
      this.pop()
      node.typeInfo = rewrap(
        this.context.typeInfo,
        structuredClone(node.typeInfo),
        this.optional.at(-1),
      )
    }
    super.exit(node, path)
  }
}

type ResolveTypeOptions = {
  returnTypes: { [module: string]: TypeInfo }
  contextType?: TypeInfo
}

export function resolveTypes(ast: Program, options: ResolveTypeOptions) {
  const { returnTypes, contextType = { type: Type.Context } } = options
  const scope = new ItemScopeTracker()
  let ex: Expr | undefined

  const visitor: TransformVisitor = {
    Program: {
      enter() {
        scope.context = {
          ...t.InputExpr(tx.token(''), false),
          typeInfo: contextType,
        }
      },
      exit() {
        ex = scope.extracted
      },
    },

    InputExpr(node) {
      let typeInfo: TypeInfo = { type: Type.Value }
      if (node.optional) {
        typeInfo = { type: Type.Maybe, option: typeInfo }
      }
      return { ...node, typeInfo }
    },

    AssignmentStmt: {
      enter(node) {
        scope.optional.push(node.optional)
      },
      exit() {
        scope.optional.pop()
      },
    },

    IdentifierExpr(node) {
      const id = node.id.value
      const value = scope.lookup(id)
      invariant(value, new ValueReferenceError(id))
      const typeInfo = structuredClone(value.typeInfo)
      return { ...node, typeInfo }
    },

    DrillIdentifierExpr(node) {
      const id = node.id.value
      const value = scope.lookup(id)
      invariant(value, new ValueReferenceError(id))
      let typeInfo = structuredClone(value.typeInfo)
      if (node.expand) {
        typeInfo = { type: Type.List, of: typeInfo }
      }
      return { ...node, typeInfo }
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

    SliceExpr(node) {
      let typeInfo: TypeInfo = { type: Type.Value }
      if (scope.optional.at(-1)) {
        typeInfo = { type: Type.Maybe, option: typeInfo }
      }
      return { ...node, typeInfo }
    },

    SelectorExpr(node) {
      function selectorTypeInfo(): TypeInfo {
        invariant(
          node.selector.kind === 'TemplateExpr',
          new QuerySyntaxError('Selector requires template'),
        )
        const scopeT = scope.context!.typeInfo
        switch (scopeT.type) {
          case Type.Headers:
          case Type.Cookies:
            return { type: Type.Value }
          case Type.Struct: {
            const sel = render(node.selector)
            return toPath(sel).reduce<TypeInfo>(
              (acc, cur) =>
                (acc.type === Type.Struct && acc.schema[cur]) || {
                  type: Type.Value,
                },
              scopeT,
            )
          }
          default:
            return scopeT
        }
      }

      let typeInfo: TypeInfo = structuredClone(selectorTypeInfo())
      if (node.expand) {
        typeInfo = { type: Type.List, of: typeInfo }
      } else if (scope.optional.at(-1)) {
        typeInfo = { type: Type.Maybe, option: typeInfo }
      }
      return { ...node, typeInfo }
    },

    ModifierExpr(node) {
      const modTypeMap: Record<string, TypeInfo> = {
        html: { type: Type.Html },
        js: { type: Type.Js },
        json: { type: Type.Value },
        link: { type: Type.Value },
        headers: { type: Type.Headers },
        cookies: { type: Type.Cookies },
      }
      const mod = node.modifier.value
      const typeInfo = modTypeMap[mod] || returnTypes[mod]
      invariant(typeInfo, 'Modifier type lookup failed')
      return { ...node, typeInfo }
    },

    ModuleExpr(node) {
      let typeInfo: TypeInfo = { type: Type.Value }
      if (node.call) {
        const returnType = returnTypes[node.module.value]
        invariant(returnType, 'Module return type lookup failed')
        typeInfo = specialize(returnType, scope.context?.typeInfo)
      }
      return { ...node, typeInfo }
    },

    SubqueryExpr(node) {
      const typeInfo = scope.extracted?.typeInfo || { type: Type.Never }
      return { ...node, typeInfo: structuredClone(typeInfo) }
    },

    DrillExpr(node) {
      const typeInfo = structuredClone(node.body.at(-1)!.typeInfo)
      return { ...node, typeInfo }
    },

    ObjectEntryExpr: {
      enter(node) {
        scope.optional.push(node.optional)
      },
      exit() {
        scope.optional.pop()
      },
    },

    ObjectLiteralExpr(node) {
      const typeInfo: TypeInfo = {
        type: Type.Struct,
        schema: Object.fromEntries(
          node.entries.map(e => {
            const key = render(e.key)
            invariant(
              key,
              new QuerySyntaxError('Object keys must be string literals'),
            )
            const value = structuredClone(e.value.typeInfo)
            return [key, value]
          }),
        ),
      }
      return { ...node, typeInfo }
    },
  }

  const program = transform(ast, { scope, ...visitor })
  const returnType = ex?.typeInfo ?? { type: Type.Never }

  return { program, returnType: returnType }
}
