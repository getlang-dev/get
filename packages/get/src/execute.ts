import { cookies, headers, html, http, js, json } from '@getlang/lib'
import type { Node, Program, Stmt } from '@getlang/parser/ast'
import { isToken, NodeKind } from '@getlang/parser/ast'
import { RootScope } from '@getlang/parser/scope'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import type { AsyncInterpretVisitor } from '@getlang/parser/visitor'
import { visit } from '@getlang/parser/visitor'
import type { Hooks, Inputs } from '@getlang/utils'
import { invariant, NullSelection } from '@getlang/utils'
import {
  NullInputError,
  QuerySyntaxError,
  SliceError,
  ValueReferenceError,
} from '@getlang/utils/errors'
import { withContext } from './context.js'
import { callModifier } from './modifiers.js'
import { Modules } from './modules.js'
import { assert, validate } from './validation.js'
import { toValue } from './value.js'

export async function execute(
  rootModule: string,
  rootInputs: Inputs,
  hooks: Hooks,
) {
  const scope = new RootScope<any>()
  const modules = new Modules({
    ...hooks,
    async call(module, inputs) {
      let value = await hooks.call(module, inputs)
      if (typeof value === 'undefined') {
        const { program } = await modules.import(module)
        value = await executeModule(program, inputs)
      }
      await hooks.extract(module, inputs, value)
      return value
    },
  })

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

  async function executeModule(program: Program, inputs: Inputs) {
    validate(program, inputs)
    scope.push()
    let ex: any

    await visit<Node, AsyncInterpretVisitor<void, any>>(program, {
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

      IdentifierExpr(node) {
        const value = scope.vars[node.value.value]
        invariant(
          value !== undefined,
          new ValueReferenceError(node.value.value),
        )
        return value
      },

      SliceExpr: {
        async enter(node, visit) {
          return withContext(scope, node, visit, async context => {
            const { slice } = node
            try {
              const value = await hooks.slice(
                slice.value,
                context ? toValue(context.value, context.typeInfo) : {},
                context?.value ?? {},
              )
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

      SelectorExpr: {
        async enter(node, visit) {
          return withContext(scope, node, visit, async context => {
            const selector = await visit(node.selector)
            if (typeof selector !== 'string') {
              return selector
            }
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

      CallExpr: {
        enter(node, visit) {
          return withContext(scope, node, visit, async context => {
            const args = await visit(node.args)
            switch (node.calltype) {
              case 'link':
                return toValue(args, node.args.typeInfo)
              case 'module':
                return modules.call(node, args)
              case 'modifier': {
                const { value, typeInfo } = context!
                return callModifier(node, args, value, typeInfo)
              }
              default:
                throw new Error(`Unknown calltype: ${node.calltype}`)
            }
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

  const { program } = await modules.import(rootModule)
  const ex = await executeModule(program, rootInputs)
  const retType: any = program.body.find(
    stmt => stmt.kind === NodeKind.ExtractStmt,
  )
  return retType ? toValue(ex, retType.value.typeInfo) : ex
}
