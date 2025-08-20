import { cookies, headers, html, http, js, json } from '@getlang/lib'
import type { Node, Stmt } from '@getlang/parser/ast'
import { isToken, NodeKind } from '@getlang/parser/ast'
import { RootScope } from '@getlang/parser/scope'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import type { AsyncInterpretVisitor } from '@getlang/parser/visitor'
import { visit } from '@getlang/parser/visitor'
import type { Hooks, Inputs } from '@getlang/utils'
import { invariant, NullSelection } from '@getlang/utils'
import * as errors from '@getlang/utils/errors'
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
  ValueReferenceError,
  ValueTypeError,
} = errors

export async function execute(
  rootModule: string,
  rootInputs: Inputs,
  hooks: Required<Hooks>,
) {
  async function executeBody(visit: (stmt: Stmt) => void, body: Stmt[]) {
    scope.push()
    for (const stmt of body) {
      await visit(stmt)
      if (stmt.kind === NodeKind.ExtractStmt) {
        break
      }
    }
    return scope.pop()
  }

  const executeModule: Execute = async (entry, inputs) => {
    const provided = new Set(Object.keys(inputs))
    const unknown = provided.difference(entry.inputs)
    invariant(unknown.size === 0, new UnknownInputsError([...unknown]))
    scope.push()
    let ex: any

    await visit<Node, AsyncInterpretVisitor<void, any>>(entry.program, {
      /**
       * Expression nodes
       */
      TemplateExpr(node, path, origNode) {
        const firstNull = node.elements.find(el => el instanceof NullSelection)
        if (firstNull) {
          const parents = path.slice(0, -1)
          const isRoot = !parents.find(n => n.kind === NodeKind.TemplateExpr)
          return isRoot ? firstNull : ''
        }
        const els = node.elements.map((el, i) => {
          const og = origNode.elements[i]!
          return isToken(og) ? og.value : toValue(el, og.typeInfo)
        })
        return els.join('')
      },

      SliceExpr: {
        async enter(node, visit) {
          return withContext(scope, node, visit, async context => {
            const { slice } = node
            try {
              const deps = context && toValue(context.value, context.typeInfo)
              const value = await hooks.slice(slice.value, deps)
              const ret =
                value === undefined ? new NullSelection('<slice>') : value
              const optional = node.typeInfo.type === Type.Maybe
              return optional ? ret : assert(ret)
            } catch (e) {
              throw new SliceError({ cause: e })
            }
          })
        },
      },

      IdentifierExpr: {
        async enter(node, visit) {
          return withContext(scope, node, visit, async () => {
            const id = node.id.value
            const value = id ? scope.vars[id] : scope.context
            invariant(
              value !== undefined,
              new ValueReferenceError(node.id.value),
            )
            return value
          })
        },
      },

      SelectorExpr: {
        async enter(node, visit) {
          return withContext(scope, node, visit, async context => {
            const selector = await visit(node.selector)
            invariant(
              typeof selector === 'string',
              new ValueTypeError('Expected selector string'),
            )
            const args = [context!.value, selector, node.expand] as const

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

            const value = select(context!.typeInfo)
            const optional = node.typeInfo.type === Type.Maybe
            return optional ? value : assert(value)
          })
        },
      },

      ModifierExpr: {
        enter(node, visit) {
          return withContext(scope, node, visit, async context => {
            const args = await visit(node.args)
            const { value, typeInfo } = context!
            return callModifier(node, args, value, typeInfo)
          })
        },
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

      ObjectLiteralExpr: {
        async enter(node, visit) {
          return withContext(scope, node, visit, async () => {
            const obj: Record<string, any> = {}
            for (const entry of node.entries) {
              const value = await visit(entry.value)
              if (!(value instanceof NullSelection)) {
                const key = await visit(entry.key)
                obj[key] = value
              }
            }
            return obj
          })
        },
      },

      SubqueryExpr: {
        async enter(node, visit) {
          return withContext(scope, node, visit, async () => {
            const ex = await executeBody(visit, node.body)
            const err = new QuerySyntaxError('Subquery must extract a value')
            invariant(ex, err)
            return ex
          })
        },
      },

      async RequestExpr(node) {
        const method = node.method.value
        const url = node.url
        const body = node.body ?? ''
        return await http.request(
          method,
          url,
          node.headers,
          node.blocks,
          body,
          hooks.request,
        )
      },

      /**
       * Statement nodes
       */

      DeclInputsStmt() {},

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

      AssignmentStmt(node) {
        scope.vars[node.name.value] = node.value
      },

      RequestStmt(node) {
        scope.pushContext(node.request)
      },

      ExtractStmt(node) {
        scope.extracted = assert(node.value)
      },

      Program: {
        async enter(node, visit) {
          ex = await executeBody(visit, node.body)
        },
      },
    })

    return ex
  }

  const scope = new RootScope<any>()
  const modules = new Modules(hooks, executeModule)

  const rootEntry = await modules.import(rootModule)
  const ex = await executeModule(rootEntry, rootInputs)

  const retType: any = rootEntry.program.body.find(
    stmt => stmt.kind === NodeKind.ExtractStmt,
  )

  return retType ? toValue(ex, retType.value.typeInfo) : ex
}
