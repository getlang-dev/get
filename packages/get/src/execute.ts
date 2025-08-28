import { cookies, headers, html, http, js, json } from '@getlang/lib'
import { isToken } from '@getlang/parser/ast'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import type { Hooks, Inputs } from '@getlang/utils'
import { invariant, NullSelection, wait, waitMap } from '@getlang/utils'
import * as errors from '@getlang/utils/errors'
import type { WalkOptions } from '@getlang/walker'
import { ScopeTracker, walk } from '@getlang/walker'
import { withContext } from './context.js'
import { callModifier } from './modifiers.js'
import type { Execute } from './modules.js'
import { Modules } from './modules.js'
import { assert, toValue } from './value.js'

const {
  NullInputError,
  QuerySyntaxError,
  SliceError,
  UnknownInputsError,
  ValueTypeError,
} = errors

export async function execute(
  rootModule: string,
  rootInputs: Inputs,
  hooks: Required<Hooks>,
) {
  const executeModule: Execute = async (entry, inputs) => {
    const provided = new Set(Object.keys(inputs))
    const unknown = provided.difference(entry.inputs)
    invariant(unknown.size === 0, new UnknownInputsError([...unknown]))

    const scope = new ScopeTracker()

    // function withItemContext(cb) {
    //   const ctx = scope.context
    //   if (ctx?.typeInfo.type === Type.List) {
    //     scope.push()
    //     const list = waitMap(ctx.data, item => {
    //       scope.context = { data: item, typeInfo: ctx.typeInfo.of }
    //       return withItemContext(cb)
    //     })
    //     return wait(list, list => {
    //       scope.pop()
    //       return list
    //     })
    //   }
    //   return cb()
    // }

    const visitor: WalkOptions = {
      scope,

      /**
       * Statement nodes
       */

      InputDeclStmt: {
        async enter(node, visit) {
          const inputName = node.id.value
          let inputValue = inputs[inputName]
          if (inputValue === undefined) {
            if (!node.optional) {
              throw new NullInputError(inputName)
            }
            inputValue = node.defaultValue
              ? await visit(node.defaultValue)
              : new NullSelection(`input:${inputName}`)
          }
          scope.vars[inputName] = inputValue
        },
      },

      ExtractStmt(node) {
        assert(node.value)
      },

      Program() {
        return scope.extracted
      },

      /**
       * Expression nodes
       */
      TemplateExpr(node, { node: orig }) {
        const firstNull = node.elements.find(el => el instanceof NullSelection)
        if (firstNull) {
          const parents = path.slice(0, -1)
          const isRoot = !parents.find(n => n.kind === 'TemplateExpr')
          return isRoot ? firstNull : ''
        }
        const els = node.elements.map((el, i) => {
          const og = orig.elements[i]!
          return isToken(og) ? og.value : toValue(el, og.typeInfo)
        })
        return els.join('')
      },

      async SliceExpr({ slice, typeInfo }) {
        try {
          const ctx = scope.context
          const deps = ctx && toValue(ctx.data, ctx.typeInfo)
          const ret = await hooks.slice(slice.value, deps)
          const data = ret === undefined ? new NullSelection('<slice>') : ret
          return assert({ data, typeInfo })
        } catch (e) {
          throw new SliceError({ cause: e })
        }
      },

      IdentifierExpr(node) {
        return scope.lookup(node.id.value)
      },

      DrillIdentifierExpr(node) {
        return scope.lookup(node.id.value)
      },

      SelectorExpr(node) {
        invariant(
          typeof node.selector === 'string',
          new ValueTypeError('Expected selector string'),
        )

        const args = [scope.context.data, node.selector, node.expand] as const

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
        return {
          data: callModifier(node, scope.context),
          typeInfo: node.typeInfo,
        }
      },

      ModuleExpr: {
        enter(node, visit) {
          return withContext(scope, node, visit, async context => {
            const args = await visit(node.args)
            return node.call
              ? modules.call(node, args, context?.typeInfo)
              : toValue(args, node.args.typeInfo)
          })
        },
      },

      ObjectEntryExpr(node) {
        const value = assert(node.value)
        return [node.key, value.data]
      },

      ObjectLiteralExpr(node) {
        const data = Object.fromEntries(
          node.entries.filter(e => !(e[1] instanceof NullSelection)),
        )
        return { data, typeInfo: node.typeInfo }
      },

      SubqueryExpr() {
        const ex = scope.extracted
        invariant(ex, new QuerySyntaxError('Subquery must extract a value'))
        return ex
      },

      DrillExpr(node) {
        return node.body.at(-1)
      },

      DrillBitExpr: {
        async enter(node) {
          const ctx = scope.context
          const optional = node.typeInfo.type === Type.Maybe
          if (optional && ctx?.data instanceof NullSelection) {
            return scope.context
          }

          async function withItemContext() {
            const ctx = scope.context
            if (ctx?.typeInfo.type === Type.List) {
              const list = []
              scope.push()
              for (const data of ctx.data) {
                scope.context = { data, typeInfo: ctx.typeInfo.of }
                const item = await withItemContext()
                list.push(item)
              }
              scope.pop()
              return list
            }
            const { data } = await walk(node.bit, visitor)
            return data
          }

          const data = await withItemContext()
          const bit = { data, typeInfo: node.typeInfo }
          return { ...node, bit }
        },
        exit(node) {
          return node.bit
        },
      },

      async RequestExpr(node) {
        const method = node.method.value
        const url = node.url
        const body = node.body ?? ''
        const data = await http.request(
          method,
          url,
          node.headers,
          node.blocks,
          body,
          hooks.request,
        )
        return { data, typeInfo: node.typeInfo }
      },
    }

    return walk(entry.program, visitor)
  }

  const modules = new Modules(hooks, executeModule)
  const rootEntry = await modules.import(rootModule)
  const ex = await executeModule(rootEntry, rootInputs)
  return ex && toValue(ex.data, ex.typeInfo)
}
