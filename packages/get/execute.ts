import { mapValues } from 'lodash-es'
import { visit, type AsyncInterpretVisitor } from '@getlang/parser/visitor'
import { RootScope } from '@getlang/parser/scope'
import type { Stmt, Program, Expr, CExpr } from '@getlang/parser/ast'
import { NodeKind } from '@getlang/parser/ast'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import { http, html, json, js, headers, cookies } from '@getlang/lib'
import type { Hooks, MaybePromise } from '@getlang/utils'
import {
  invariant,
  NullSelectionError,
  QuerySyntaxError,
  ValueReferenceError,
  ImportError,
  NullInputError,
  NullSelection,
} from '@getlang/utils'

export type InternalHooks = {
  import: (module: string) => MaybePromise<Program>
  request: Hooks['request']
  slice: Hooks['slice']
}

type Contextual = { value: any; typeInfo: TypeInfo }

function assert(value: any) {
  if (value instanceof NullSelection) {
    throw new NullSelectionError(value.selector)
  }
  return value
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
      if (context?.typeInfo.type === Type.List) {
        const list = []
        for (const item of context.value) {
          const itemCtx = { value: item, typeInfo: context.typeInfo.of }
          list.push(await unwrap(itemCtx, cb))
        }
        return list
      }

      context && scope.pushContext(context.value)
      const value = await cb(context)
      context && scope.popContext()
      return value
    }

    let context: Contextual | undefined
    if (node.context) {
      let value = await visit(node.context)
      const optional = node.typeInfo.type === Type.Maybe
      value = optional ? value : assert(value)
      if (value instanceof NullSelection) return value
      context = { value, typeInfo: node.context.typeInfo }
    }
    return unwrap(context, cb)
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
          const value = await hooks.slice(
            slice.value,
            context ? toValue(context.value, context.typeInfo) : {},
            context?.value ?? {},
          )
          const optional = node.typeInfo.type === Type.Maybe
          return optional ? value : assert(value)
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
      async enter(node, visit) {
        return ctx(node, visit, async context => {
          const mod = node.value.value

          if (mod === 'link') {
            const options = await visit(node.options)
            const resolved = http.constructUrl(
              scope.context,
              options.base ?? undefined,
            )
            return resolved ?? new NullSelection('@link')
          }

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
