import { mapValues } from 'lodash-es'
import {
  visit,
  SKIP,
  type AsyncExhaustiveVisitor,
} from '@getlang/parser/visitor'
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
  ValueTypeError,
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

type Value = { raw: unknown; typeInfo: TypeInfo; selector?: string }

function assert(value: Value) {
  if (value.raw === undefined) {
    throw new NullSelectionError(value.selector ?? '<unknown>')
  }
}

function toValue({ raw, typeInfo }: Value): unknown {
  switch (typeInfo.type) {
    case Type.Html:
      return html.getValue(raw)
    case Type.Js:
      return js.getValue(raw)
    case Type.Headers:
      return Object.fromEntries(raw)
    case Type.Cookies:
      return mapValues(raw, c => c.value)
    case Type.List:
      return raw.map(item => toValue({ raw: item, typeInfo: typeInfo.of }))
    case Type.Struct:
      return mapValues(raw, (v, k) =>
        toValue({ raw: v, typeInfo: typeInfo.schema[k] }),
      )
    case Type.Value:
      return raw
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
  const scope = new RootScope<Value>()

  async function executeBody(
    visit: (stmt: Stmt) => void,
    body: Stmt[],
    context?: Value,
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

  async function unwrap(
    context: Value | undefined,
    cb: () => MaybePromise<Value>,
  ): Value {
    const { raw: cval, typeInfo } = context ?? {}
    if (typeInfo?.type !== Type.List) {
      context && scope.pushContext(context)
      const value = await cb()
      context && scope.popContext()
      return value
    }
    invariant(
      Array.isArray(cval),
      new ValueTypeError('List context requires a list value'),
    )
    const list = []
    for (const item of cval) {
      const itemContext: Value = { raw: item, typeInfo: typeInfo.of }
      const { raw: itemValue } = await unwrap(itemContext, cb)
      list.push(itemValue)
    }
    return { raw: list, typeInfo }
  }

  async function ctx(
    node: CExpr,
    visit: (node: Expr) => MaybePromise<Value>,
    cb: () => MaybePromise<Value>,
  ): Promise<Value> {
    const context = node.context && (await visit(node.context))
    if (context && context.raw === undefined) {
      return { ...context, typeInfo: node.typeInfo }
    }
    const value = await unwrap(context, cb)
    return { ...value, typeInfo: node.typeInfo }
  }

  function requireCtx(
    node: CExpr,
    visit: (node: Expr) => MaybePromise<Value>,
    cb: (context: Value) => MaybePromise<Value>,
  ): Promise<Value> {
    return ctx(node, visit, () => {
      invariant(scope.context, new QuerySyntaxError('Unresolved context'))
      return cb(scope.context)
    })
  }

  const visitor: AsyncExhaustiveVisitor<void, Value> = {
    /**
     * Expression nodes
     */
    ModuleCallExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async () => {
          const module = node.name.value
          const external = await modules.get(module)
          invariant(external, new ValueReferenceError(module))
          const { raw: inputs } = await visit(node.inputs)
          const output = await execute(external, inputs, hooks, modules)
          return { raw: output, typeInfo: node.typeInfo }
        })
      },
    },

    TemplateExpr(node) {
      const els = node.elements.map(el => ('offset' in el ? el.value : el.raw))
      const hasUndefined = els.some(el => el === undefined)
      const value = hasUndefined ? undefined : els.join('')
      return { raw: value, typeInfo: node.typeInfo }
    },

    IdentifierExpr(node) {
      const value = scope.vars[node.value.value]
      invariant(value, new ValueReferenceError(node.value.value))
      return value
    },

    SliceExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async () => {
          const { slice } = node
          const fauxSelector = `slice@${slice.line}:${slice.col}`
          const value = await hooks.slice(
            slice.value,
            scope.context ? toValue(scope.context) : {},
            scope.context?.raw ?? {},
          )
          return { raw: value, typeInfo: node.typeInfo, selector: fauxSelector }
        })
      },
    },

    SelectorExpr: {
      async enter(node, visit) {
        return requireCtx(node, visit, async context => {
          const { raw: selector } = await visit(node.selector)

          if (typeof selector !== 'string') {
            return { raw: selector, typeInfo: node.typeInfo }
          }
          const { raw: subject, typeInfo: ctype } = context
          const args = [subject, selector, node.expand] as const

          const ret = (result: unknown) => ({
            raw: result,
            typeInfo: node.typeInfo,
            selector,
          })

          switch (ctype.type) {
            case Type.Html:
              return ret(html.select(...args))
            case Type.Js:
              return ret(js.select(...args))
            case Type.Headers:
              return ret(headers.select(...args))
            case Type.Cookies:
              return ret(cookies.select(...args))
            default:
              return ret(json.select(...args))
          }
        })
      },
    },

    ModifierExpr: {
      async enter(node, visit) {
        return requireCtx(node, visit, async context => {
          const mod = node.value.value
          const doc = toValue(context)
          const { raw: options } = await visit(node.options)
          invariant(
            typeof doc === 'string',
            new ValueTypeError('Modifier requires string input'),
          )
          const ret = (result: unknown) => ({
            raw: result,
            typeInfo: node.typeInfo,
          })
          switch (mod) {
            case 'html':
              return ret(html.parse(doc))
            case 'js':
              return ret(js.parse(doc))
            case 'json':
              return ret(json.parse(doc))
            case 'cookies':
              return ret(cookies.parse(doc))
            case 'link': {
              const resolved = http.constructUrl(
                context.raw,
                options.base ?? undefined,
              )
              return ret(resolved ?? undefined)
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
          const obj: Record<string, unknown> = {}
          for (const entry of node.entries) {
            const value = await visit(entry.value)
            entry.optional || assert(value)
            if (value.raw !== undefined) {
              const key = await visit(entry.key)
              obj[key.raw] = value.raw
            }
          }
          return { raw: obj, typeInfo: node.typeInfo }
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
      const url = node.url.raw
      const body = node.body?.raw || ''

      invariant(
        typeof url === 'string',
        new ValueTypeError('Request URL expected string'),
      )
      invariant(
        typeof body === 'string',
        new ValueTypeError('Request body expected string'),
      )

      const res = await http.request(
        method,
        url,
        node.headers.raw,
        mapValues(node.blocks, b => b.raw),
        body,
        hooks.request,
      )
      return { raw: res, typeInfo: node.typeInfo }
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
        const isOptional = node.optional || !!node.defaultValue
        let inputValue = json.select(inputs, inputName, false)
        invariant(
          inputValue !== undefined || isOptional,
          new NullInputError(inputName),
        )
        if (inputValue === undefined && node.defaultValue) {
          inputValue = (await visit(node.defaultValue)).raw
        }
        scope.vars[inputName] = {
          raw: inputValue,
          typeInfo: { type: Type.Value },
          selector: `input:${inputName}`,
        }
        return SKIP
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
        return SKIP
      },
    },
  }

  await visit(program, visitor)
  const ex = scope.pop()
  return ex ? toValue(ex) : null
}
