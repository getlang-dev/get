import type { Expr, TypeInfo } from '@getlang/ast'
import { isToken, Type } from '@getlang/ast'
import { cookies, headers, html, http, js, json } from '@getlang/lib'
import type { Hooks, Inputs } from '@getlang/utils'
import { invariant, NullSelection } from '@getlang/utils'
import * as errors from '@getlang/utils/errors'
import type { Path, WalkOptions } from '@getlang/walker'
import { ScopeTracker, walk } from '@getlang/walker'
import { callModifier } from './modifiers.js'
import type { Execute } from './modules.js'
import { Modules } from './modules.js'
import type { RuntimeValue } from './value.js'
import { assert, toValue } from './value.js'

const {
  NullInputError,
  QuerySyntaxError,
  SliceError,
  UnknownInputsError,
  ValueTypeError,
} = errors

class ExecutionTracker extends ScopeTracker {
  override exit(value: RuntimeValue, path: Path) {
    if ('typeInfo' in path.node) {
      assert(value)
    }
    super.exit(value, path)
  }
}

export async function execute(
  rootModule: string,
  rootInputs: Inputs,
  hooks: Required<Hooks>,
) {
  const scope = new ExecutionTracker()

  const executeModule: Execute = async (entry, inputs) => {
    const provided = new Set(Object.keys(inputs))
    const unknown = provided.difference(entry.inputs)
    invariant(unknown.size === 0, new UnknownInputsError([...unknown]))

    async function withItemContext(expr: Expr): Promise<RuntimeValue> {
      const ctx = scope.context
      if (ctx?.typeInfo.type !== Type.List) {
        return walk(expr, visitor)
      }
      const list = []
      for (const data of ctx.data) {
        scope.push({ data, typeInfo: ctx.typeInfo.of })
        const value = await withItemContext(expr)
        list.push(value.data)
        scope.pop()
      }
      return { data: list, typeInfo: expr.typeInfo }
    }

    const visitor: WalkOptions = {
      scope,

      /**
       * Statement nodes
       */

      InputExpr(node) {
        const name = node.id.value
        let data = inputs[name]
        if (data === undefined) {
          if (!node.optional) {
            throw new NullInputError(name)
          } else if (node.defaultValue) {
            data = node.defaultValue.data
          } else {
            data = new NullSelection(`input:${name}`)
          }
        }
        return { data, typeInfo: node.typeInfo }
      },

      Program: {
        enter() {
          scope.extracted = { data: null, typeInfo: { type: Type.Value } }
        },
        exit() {
          return scope.extracted
        },
      },

      /**
       * Expression nodes
       */
      TemplateExpr(node, path) {
        const firstNull = node.elements.find(
          el => el.data instanceof NullSelection,
        )
        if (firstNull) {
          const isRoot = path.parent?.node.kind !== 'TemplateExpr'
          return isRoot ? firstNull : ''
        }
        const els = node.elements.map(el => {
          return isToken(el) ? el.value : toValue(el.data, el.typeInfo)
        })
        const data = els.join('')
        return { data, typeInfo: node.typeInfo }
      },

      async SliceExpr({ slice, typeInfo }) {
        try {
          const ctx = scope.context
          const deps = ctx && toValue(ctx.data, ctx.typeInfo)
          const ret = await hooks.slice(slice.value, deps)
          const data = ret === undefined ? new NullSelection('<slice>') : ret
          return { data, typeInfo }
        } catch (e) {
          throw new SliceError({ cause: e })
        }
      },

      IdentifierExpr(node) {
        return scope.lookup(node.id.value)
      },

      DrillIdentifierExpr(node) {
        const { data } = scope.lookup(node.id.value)
        return { data, typeInfo: node.typeInfo }
      },

      SelectorExpr(node) {
        const selector = node.selector.data
        invariant(
          typeof selector === 'string',
          new ValueTypeError('Expected selector string'),
        )

        const args = [scope.context.data, selector, node.expand] as const

        function select(typeInfo: TypeInfo) {
          switch (typeInfo.type) {
            case Type.Maybe:
              return select(typeInfo.option)
            case Type.Html:
              return html.select(...args)
            case Type.Js:
              return js.select(...args)
            case Type.Headers:
              return headers.select(...args)
            case Type.Cookies:
              return cookies.select(...args)
            default:
              return json.select(...args)
          }
        }

        const data = select(scope.context.typeInfo)
        return { data, typeInfo: node.typeInfo }
      },

      ModifierExpr(node) {
        const mod = node.modifier.value
        const args = node.args.data
        return {
          data: callModifier(mod, args, scope.context),
          typeInfo: node.typeInfo,
        }
      },

      ModuleExpr(node) {
        if (node.call) {
          return modules.call(node, node.args.data, scope.context?.typeInfo)
        }
        return {
          data: toValue(node.args.data, node.args.typeInfo),
          typeInfo: node.typeInfo,
        }
      },

      ObjectEntryExpr(node) {
        const data = [node.key.data, node.value.data]
        return { data, typeInfo: { type: Type.Value } }
      },

      ObjectLiteralExpr(node) {
        const data = Object.fromEntries(
          node.entries
            .map(e => e.data)
            .filter(e => !(e[1] instanceof NullSelection)),
        )
        return { data, typeInfo: node.typeInfo }
      },

      SubqueryExpr() {
        const ex = scope.extracted
        invariant(ex, new QuerySyntaxError('Subquery must extract a value'))
        return ex
      },

      DrillExpr: {
        async enter(node, path) {
          for (const expr of node.body) {
            scope.context = await withItemContext(expr)
            const optional = expr.typeInfo.type === Type.Maybe
            if (optional && scope.context.data instanceof NullSelection) {
              break
            }
          }
          path.skip()
          return scope.context
        },
      },

      async RequestExpr(node) {
        const method = node.method.value
        const url = node.url.data
        const body = node.body?.data ?? ''

        const headers = node.headers.data[1]
        const blocks = Object.fromEntries(node.blocks.map(v => v.data))

        const data = await http.request(
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
            .filter(e => !(e[1] instanceof NullSelection)),
        )
        const data = [node.name.value, value]
        return { data, typeInfo: node.typeInfo }
      },

      RequestEntryExpr(node) {
        const data = [node.key.data, node.value.data]
        return { data, typeInfo: { type: Type.Value } }
      },
    }

    return walk(entry.program, visitor)
  }

  const modules = new Modules(hooks, executeModule)
  const rootEntry = await modules.import(rootModule)
  const ex = await executeModule(rootEntry, rootInputs)
  return ex && toValue(ex.data, ex.typeInfo)
}
