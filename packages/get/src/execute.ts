import type { Expr, TypeInfo } from '@getlang/ast'
import { isToken, Type } from '@getlang/ast'
import type { Hooks, Inputs } from '@getlang/lib'
import * as lib from '@getlang/lib'
import * as errors from '@getlang/lib/errors'
import type { ReduceVisitor } from '@getlang/walker'
import { reduce, ScopeTracker } from '@getlang/walker'
import type { Execute } from './calls.js'
import { callModifier, callModule } from './calls.js'
import { Registry } from './registry.js'
import type { RuntimeValue } from './value.js'
import { assert, materialize } from './value.js'

const {
  NullInputError,
  QuerySyntaxError,
  SliceError,
  UnknownInputsError,
  ValueTypeError,
  ValueReferenceError,
} = errors

export async function execute(
  rootModule: string,
  rootInputs: Inputs,
  hooks: Required<Hooks>,
) {
  const scope = new ScopeTracker<RuntimeValue>()

  const executeModule: Execute = async (entry, inputs) => {
    const provided = new Set(Object.keys(inputs))
    const unknown = provided.difference(entry.inputs)
    lib.invariant(unknown.size === 0, new UnknownInputsError([...unknown]))

    async function withItemContext(expr: Expr): Promise<any> {
      const ctx = scope.context
      if (ctx?.typeInfo.type !== Type.List) {
        const { data } = await reduce(expr, options)
        return data
      }
      const list = []
      for (const data of ctx.data) {
        scope.push({ data, typeInfo: ctx.typeInfo.of })
        const item = await withItemContext(expr)
        list.push(item)
        scope.pop()
      }
      return list
    }

    function lookup(id: string, typeInfo: TypeInfo) {
      const value = scope.lookup(id)
      lib.invariant(value, new ValueReferenceError(id))
      return { data: value.data, typeInfo }
    }

    let ex: RuntimeValue | undefined

    const visitor: ReduceVisitor<void, RuntimeValue> = {
      InputExpr(node) {
        const name = node.id.value
        let data = inputs[name]
        if (data === undefined) {
          if (!node.optional) {
            throw new NullInputError(name)
          } else if (node.defaultValue) {
            data = node.defaultValue.data
          } else {
            data = new lib.NullSelection(`input:${name}`)
          }
        }
        return { data, typeInfo: node.typeInfo }
      },

      AssignmentStmt(node) {
        assert(node.value)
      },

      LiteralExpr(node) {
        return { data: node.value, typeInfo: node.typeInfo }
      },

      Program: {
        enter() {
          scope.extracted = { data: null, typeInfo: { type: Type.Value } }
        },
        exit() {
          ex = scope.extracted
        },
      },

      TemplateExpr(node, path) {
        const firstNull = node.elements.find(
          el => 'data' in el && el.data instanceof lib.NullSelection,
        )
        if (firstNull) {
          const isRoot = path.parent?.node.kind !== 'TemplateExpr'
          return isRoot ? firstNull : ''
        }
        const els = node.elements.map(el => {
          return isToken(el) ? el.value : materialize(el)
        })
        const data = els.join('')
        return { data, typeInfo: node.typeInfo }
      },

      async SliceExpr({ slice, typeInfo }) {
        try {
          const ctx = scope.context
          const deps = ctx ? materialize(ctx) : {}
          const ret = await hooks.slice(slice.value, deps)
          const data =
            ret === undefined ? new lib.NullSelection('<slice>') : ret
          return { data, typeInfo }
        } catch (e) {
          throw new SliceError({ cause: e })
        }
      },

      IdentifierExpr(node) {
        return lookup(node.id.value, node.typeInfo)
      },

      DrillIdentifierExpr(node) {
        return lookup(node.id.value, node.typeInfo)
      },

      SelectorExpr(node) {
        lib.invariant(scope.context, 'Unresolved context')

        const selector = node.selector.data
        lib.invariant(
          typeof selector === 'string',
          new ValueTypeError('Expected selector string'),
        )

        const args = [scope.context.data, selector, node.expand] as const

        function select(typeInfo: TypeInfo) {
          switch (typeInfo.type) {
            case Type.Maybe:
              return select(typeInfo.option)
            case Type.Html:
              return lib.html.select(...args)
            case Type.Js:
              return lib.js.select(...args)
            case Type.Headers:
              return lib.headers.select(...args)
            case Type.Cookies:
              return lib.cookies.select(...args)
            default:
              return lib.json.select(...args)
          }
        }

        const data = select(scope.context.typeInfo)
        return { data, typeInfo: node.typeInfo }
      },

      async ModifierExpr(node) {
        const mod = node.modifier.value
        const args = materialize(node.args)
        const data = await callModifier(registry, mod, args, scope.context)
        return { data, typeInfo: node.typeInfo }
      },

      ModuleExpr(node) {
        return node.call
          ? callModule(
              registry,
              executeModule,
              hooks,
              node.module.value,
              node.args,
              scope.context?.typeInfo,
            )
          : {
              data: materialize(node.args),
              typeInfo: node.typeInfo,
            }
      },

      ObjectEntryExpr(node) {
        assert(node.value)
        const data = [node.key.data, node.value.data]
        return { data, typeInfo: { type: Type.Value } }
      },

      ObjectLiteralExpr(node) {
        const data = Object.fromEntries(
          node.entries
            .map(e => e.data)
            .filter(e => !(e[1] instanceof lib.NullSelection)),
        )
        return { data, typeInfo: node.typeInfo }
      },

      SubqueryExpr() {
        const ex = scope.extracted
        lib.invariant(ex, new QuerySyntaxError('Subquery must extract a value'))
        return ex
      },

      DrillExpr: {
        async enter(node, path) {
          for (const expr of node.body) {
            if (!(scope.context?.data instanceof lib.NullSelection)) {
              const data = await withItemContext(expr)
              scope.context = { data, typeInfo: expr.typeInfo }
            }
          }
          path.replace(scope.context)
        },
      },

      async RequestExpr(node) {
        const method = node.method.value
        const url = node.url.data
        const body = node.body?.data ?? ''

        const headers = node.headers.data[1]
        const blocks = Object.fromEntries(node.blocks.map(v => v.data))

        const data = await lib.http.request(
          method,
          url,
          headers,
          blocks,
          body,
          hooks.request,
        )
        return { data, typeInfo: node.typeInfo }
      },

      RequestBlockExpr(node) {
        const value = Object.fromEntries(
          node.entries
            .map(e => e.data)
            .filter(e => !(e[1] instanceof lib.NullSelection)),
        )
        const data = [node.name.value, value]
        return { data, typeInfo: node.typeInfo }
      },

      RequestEntryExpr(node) {
        const data = [node.key.data, node.value.data]
        return { data, typeInfo: { type: Type.Value } }
      },
    }

    const options = { scope, ...visitor }
    await reduce(entry.program, options)
    return ex
  }

  const registry = new Registry(hooks)
  const rootEntry = await registry.import(rootModule)
  const ex = await executeModule(rootEntry, rootInputs)
  return ex && assert(ex) && materialize(ex)
}
