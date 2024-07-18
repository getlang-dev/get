import { mapValues } from 'lodash-es'
import { visit, type AsyncInterpretVisitor } from '@getlang/parser/visitor'
import { RootScope } from '@getlang/parser/scope'
import type { Stmt, Program, Expr, CExpr } from '@getlang/parser/ast'
import { NodeKind } from '@getlang/parser/ast'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import type { Hooks, MaybePromise } from '@getlang/lib'
import {
  invariant,
  NullSelectionError,
  QuerySyntaxError,
  ValueReferenceError,
  ImportError,
  NullInputError,
} from '@getlang/lib'
import * as http from './net/http.js'
import * as html from './values/html.js'
import * as json from './values/json.js'
import * as js from './values/js.js'
import * as headers from './values/headers.js'
import * as cookies from './values/cookies.js'

export type InternalHooks = {
  import: (module: string) => MaybePromise<Program>
  request: Hooks['request']
  slice: Hooks['slice']
}

type Contextual = { value: any; typeInfo: TypeInfo }

class NullSelection {
  constructor(public selector: string) {}
}

function assert(value: any) {
  if (value instanceof NullSelection) {
    throw new NullSelectionError(value.selector)
  }
}

function toValue(value: any, typeInfo: TypeInfo): any {
  switch (typeInfo.type) {
    case Type.Html:
      return html.toValue(value)
    case Type.Js:
      return js.toValue(value)
    case Type.Headers:
      return Object.fromEntries(value)
    case Type.Cookies:
      return mapValues(value, c => c.value)
    case Type.List:
      return value.map((item: any) => toValue(item, typeInfo.of))
    case Type.Struct:
      return mapValues(value, (v, k) => toValue(v, typeInfo.schema[k]!))
    case Type.Value:
      return value
  }
}

class Modules {
  private cache: Record<string, MaybePromise<Program>> = {}
  constructor(private importHook: InternalHooks['import']) {}

  import(module: string) {
    this.cache[module] ??= this.importHook(module)
    return this.cache[module]
  }

  get(module: string) {
    return this.cache[module]
  }
}

export async function execute(
  program: Program,
  inputs: Record<string, unknown>,
  hooks: InternalHooks,
  modules: Modules = new Modules(hooks.import),
) {
  const scope = new RootScope<any>()

  async function executeBody(
    visit: (stmt: Stmt) => void,
    body: Stmt[],
    context?: any,
  ) {
    scope.push(context)
    for (const stmt of body) {
      await visit(stmt)
      if (stmt.kind === NodeKind.ExtractStmt) {
        break
      }
    }
    return scope.pop()
  }

  async function ctx(
    node: CExpr,
    visit: (node: Expr) => MaybePromise<any>,
    cb: (ctx?: Contextual) => MaybePromise<any>,
  ): Promise<any> {
    async function unwrap(
      context: Contextual | undefined,
      cb: (ctx?: Contextual) => MaybePromise<any>,
    ): Promise<any> {
      if (!context) {
        return cb()
      } else if (context.typeInfo.type === Type.List) {
        const list = []
        for (const item of context.value) {
          const itemCtx = { value: item, typeInfo: context.typeInfo.of }
          list.push(await unwrap(itemCtx, cb))
        }
        return list
      } else {
        context && scope.pushContext(context.value)
        const value = await cb(context)
        context && scope.popContext()
        return value
      }
    }

    let context: Contextual | undefined
    if (node.context) {
      context = {
        value: await visit(node.context),
        typeInfo: node.context.typeInfo,
      }
    }

    return context?.value instanceof NullSelection
      ? context.value
      : await unwrap(context, cb)
  }

  const visitor: AsyncInterpretVisitor<void, any> = {
    /**
     * Expression nodes
     */
    ModuleCallExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async () => {
          const module = node.name.value
          const external = await modules.get(module)
          invariant(external, new ValueReferenceError(module))
          const inputs = await visit(node.inputs)
          return await execute(external, inputs as any, hooks, modules)
        })
      },
    },

    TemplateExpr(node) {
      const firstNull = node.elements.find(el => el instanceof NullSelection)
      if (firstNull) {
        return firstNull
      }
      return node.elements
        .map(el =>
          typeof el === 'object' && el && 'offset' in el ? el.value : el,
        )
        .join('')
    },

    IdentifierExpr(node) {
      const value = scope.vars[node.value.value]
      invariant(value !== undefined, new ValueReferenceError(node.value.value))
      return value
    },

    SliceExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async context => {
          const { slice } = node
          const fauxSelector = `slice@${slice.line}:${slice.col}`
          const value = await hooks.slice(
            slice.value,
            context ? toValue(context.value, context.typeInfo) : {},
            context?.value ?? {},
          )
          return value === undefined ? new NullSelection(fauxSelector) : value
        })
      },
    },

    SelectorExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async context => {
          const selector = await visit(node.selector)
          if (typeof selector !== 'string') {
            return selector
          }
          const args = [context!.value, selector, node.expand] as const

          function select() {
            switch (context!.typeInfo.type) {
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

          const result = select()
          return result === undefined ? new NullSelection(selector) : result
        })
      },
    },

    ModifierExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async context => {
          const mod = node.value.value
          const doc = toValue(context!.value, context!.typeInfo)

          switch (mod) {
            case 'html':
              return html.parse(doc)
            case 'js':
              return js.parse(doc)
            case 'json':
              return json.parse(doc)
            case 'cookies':
              return cookies.parse(doc)
            case 'link': {
              const options = await visit(node.options)
              const resolved = http.constructUrl(
                scope.context,
                options.base ?? undefined,
              )
              return resolved ?? new NullSelection('@link')
            }
            default:
              throw new ValueReferenceError(`Unsupported modifier: ${mod}`)
          }
        })
      },
    },

    ObjectLiteralExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async () => {
          const obj: Record<string, any> = {}
          for (const entry of node.entries) {
            const value = await visit(entry.value)
            entry.optional || assert(value)
            if (!(value instanceof NullSelection)) {
              const key = await visit(entry.key)
              obj[key] = value
            }
          }
          return obj
        })
      },
    },

    FunctionExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async () => {
          const ex = await executeBody(visit, node.body, scope.context)
          invariant(
            ex,
            new QuerySyntaxError('Function missing extract statement'),
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

    async DeclImportStmt(node) {
      const module = node.id.value
      try {
        await modules.import(module)
      } catch (e) {
        throw new ImportError(`Failed to import module: ${module}`, {
          cause: e,
        })
      }
    },

    InputDeclStmt: {
      async enter(node, visit) {
        const inputName = node.id.value
        let inputValue = json.select(inputs, inputName, false)
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
      node.optional || assert(node.value)
      scope.vars[node.name.value] = node.value
    },

    RequestStmt(node) {
      scope.pushContext(node.request)
    },

    ExtractStmt(node) {
      assert(node.value)
      scope.extracted = node.value
    },

    Program: {
      async enter(node, visit) {
        const ex = await executeBody(visit, node.body)
        if (ex) {
          scope.extracted = ex
        }
      },
    },
  }

  await visit(program, visitor)

  const ex = scope.pop()
  const retType: any = program.body.find(
    stmt => stmt.kind === NodeKind.ExtractStmt,
  )
  return ex ? toValue(ex, retType.value.typeInfo) : null
}
