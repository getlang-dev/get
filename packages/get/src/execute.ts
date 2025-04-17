import { http, cookies, headers, html, js, json } from '@getlang/lib'
import type { CExpr, Expr, Program, Stmt } from '@getlang/parser/ast'
import { NodeKind, isToken } from '@getlang/parser/ast'
import { RootScope } from '@getlang/parser/scope'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import { type AsyncInterpretVisitor, visit } from '@getlang/parser/visitor'
import type { Hooks, MaybePromise } from '@getlang/utils'
import {
  ImportError,
  NullInputError,
  NullSelection,
  NullSelectionError,
  QuerySyntaxError,
  SliceError,
  ValueReferenceError,
  invariant,
} from '@getlang/utils'
import { mapValues } from 'lodash-es'

export type InternalHooks = Omit<Hooks, 'import'> & {
  import: (module: string) => MaybePromise<Program>
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

export class Modules {
  private cache: Record<string, MaybePromise<Program>> = {}
  constructor(private importHook: InternalHooks['import']) {}

  import(module: string) {
    this.cache[module] ??= this.importHook(module)
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
      if (value instanceof NullSelection) {
        return value
      }
      context = { value, typeInfo: node.context.typeInfo }
    }
    return unwrap(context, cb)
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
        return ctx(node, visit, async context => {
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

    CallExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async context => {
          const callee = node.callee.value
          const inputs = await visit(node.inputs)

          if (node.calltype === 'module') {
            let external: Program
            try {
              external = await modules.import(callee)
            } catch (e) {
              throw new ImportError(`Failed to import module: ${callee}`, {
                cause: e,
              })
            }
            const raster = toValue(inputs, node.inputs.typeInfo)
            return hooks.call(callee, inputs, raster, () =>
              execute(external, inputs, hooks, modules),
            )
          }

          if (callee === 'link') {
            const resolved = http.constructUrl(
              scope.context,
              inputs.base ?? undefined,
            )
            return resolved ?? new NullSelection('@link')
          }

          const doc = toValue(context!.value, context!.typeInfo)
          switch (callee) {
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

    SubqueryExpr: {
      async enter(node, visit) {
        return ctx(node, visit, async () => {
          const ex = await executeBody(visit, node.body, scope.context)
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
