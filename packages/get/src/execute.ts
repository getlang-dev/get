import { cookies, headers, html, http, js, json } from '@getlang/lib'
import type { Program, Stmt } from '@getlang/parser/ast'
import { isToken, NodeKind } from '@getlang/parser/ast'
import { RootScope } from '@getlang/parser/scope'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import type { AsyncInterpretVisitor } from '@getlang/parser/visitor'
import { visit } from '@getlang/parser/visitor'
import type { Hooks, MaybePromise } from '@getlang/utils'
import { invariant, NullSelection } from '@getlang/utils'
import {
  ImportError,
  NullInputError,
  QuerySyntaxError,
  SliceError,
  ValueReferenceError,
} from '@getlang/utils/errors'
import { mapValues, partition } from 'lodash-es'
import { withContext } from './context.js'
import { assert, collectInputs, validate } from './validation.js'

export type InternalHooks = Omit<Hooks, 'import'> & {
  import: (module: string) => MaybePromise<Program>
}

function toValue(value: any, typeInfo: TypeInfo): any {
  switch (typeInfo.type) {
    case Type.Html:
      return html.toValue(value)
    case Type.Js:
      return js.toValue(value)
    case Type.Headers:
      return headers.toValue(value)
    case Type.Cookies:
      return cookies.toValue(value)
    case Type.List:
      return value.map((item: any) => toValue(item, typeInfo.of))
    case Type.Struct:
      return mapValues(value, (v, k) => toValue(v, typeInfo.schema[k]!))
    case Type.Maybe:
      return toValue(value, typeInfo.option)
    case Type.Value:
      return value
  }
}

type ModulesEntry = { program: Program; inputs: Set<string> }

export class Modules {
  private cache: Record<string, MaybePromise<ModulesEntry>> = {}
  constructor(private importHook: InternalHooks['import']) {}

  import(module: string) {
    if (!this.cache[module]) {
      this.cache[module] = Promise.resolve(this.importHook(module)).then(
        program => {
          const inputs = collectInputs(program)
          return { program, inputs }
        },
      )
    }

    return this.cache[module]
  }
}

export async function execute(
  program: Program,
  inputs: Record<string, unknown>,
  hooks: InternalHooks,
  modules: Modules = new Modules(hooks.import),
) {
  validate(program, inputs)
  const scope = new RootScope<any>()

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

  const visitor: AsyncInterpretVisitor<void, any> = {
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
      invariant(value !== undefined, new ValueReferenceError(node.value.value))
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
      async enter(node, visit) {
        return withContext(scope, node, visit, async context => {
          const callee = node.callee.value
          const args = await visit(node.args)

          if (node.calltype === 'module') {
            let entry: ModulesEntry
            try {
              entry = await modules.import(callee)
            } catch (e) {
              const err = `Failed to import module: ${callee}`
              throw new ImportError(err, { cause: e })
            }
            const [inputArgs, attrArgs] = partition(Object.entries(args), e =>
              entry.inputs.has(e[0]),
            )
            const inputs = Object.fromEntries(inputArgs)
            return hooks.call(callee, inputs, async () => {
              const extracted = await execute(
                entry.program,
                inputs,
                hooks,
                modules,
              )
              if (typeof extracted === 'object') {
                const attrs = Object.fromEntries(attrArgs)
                const raster = toValue(attrs, node.args.typeInfo)
                return { ...raster, ...extracted }
              }
              if (attrArgs.length) {
                const dropped = attrArgs.map(e => e[0]).join(', ')
                console.warn(
                  [
                    `Module '${callee}' returned a primitive`,
                    `dropping view attributes: ${dropped}`,
                  ].join(', '),
                )
              }
              return extracted
            })
          }

          let from = context!
          if (callee === 'link') {
            const el = scope.context
            const tag = el.type === 'tag' ? el.name : undefined
            if (tag === 'a') {
              from = { ...from, value: html.select(el, 'xpath:@href', false) }
            } else if (tag === 'img') {
              from = { ...from, value: html.select(el, 'xpath:@src', false) }
            }
          }

          const doc = toValue(from.value, from.typeInfo)

          switch (callee) {
            case 'link':
              return doc
                ? new URL(doc, args.base).toString()
                : new NullSelection('@link')
            case 'html':
              return html.parse(doc)
            case 'js':
              return js.parse(doc)
            case 'json':
              return json.parse(doc)
            case 'cookies':
              return cookies.parse(doc)
            default:
              throw new ValueReferenceError(`Unsupported modifier: ${callee}`)
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
          invariant(
            ex,
            new QuerySyntaxError('Subquery missing extract statement'),
          )
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
        scope.extracted = await executeBody(visit, node.body)
      },
    },
  }

  await visit(program, visitor)

  const ex = scope.pop()
  const retType: any = program.body.find(
    stmt => stmt.kind === NodeKind.ExtractStmt,
  )
  return retType ? toValue(ex, retType.value.typeInfo) : ex
}
