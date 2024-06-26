import type { Program, AsyncExhaustiveVisitor } from '@getlang/parser'
import { visit, SKIP, NodeKind } from '@getlang/parser'
import { RootScope } from '@getlang/utils'
import * as type from './value'
import {
  invariant,
  NullSelectionError,
  QuerySyntaxError,
  ValueTypeError,
  ValueReferenceError,
  ImportError,
} from '@getlang/utils'
import * as http from './net/http'
import * as html from './values/html'
import * as json from './values/json'
import * as js from './values/js'
import * as cookies from './values/cookies'
import * as lang from './lang'
import { select } from './select'

export type InternalHooks = {
  request: http.RequestHook
  import: (module: string) => Program | Promise<Program>
}

class Modules {
  private cache: Record<string, Program | Promise<Program>> = {}
  constructor(private importHook: InternalHooks['import']) {}

  import(module: string) {
    this.cache[module] ??= this.importHook(module)
    return this.cache[module]
  }

  get(module: string) {
    return this.cache[module]
  }
}

function toValue(value: type.Value): unknown {
  if (value instanceof type.HtmlValue) {
    return html.getValue(value.raw)
  }
  if (value instanceof type.JsValue) {
    return js.getValue(value.raw)
  }
  if (value instanceof type.HeadersValue) {
    return Object.fromEntries(value.raw)
  }
  if (value instanceof type.CookieSetValue) {
    return Object.fromEntries(
      Object.entries(value.raw).map(e => [e[0], e[1].value]),
    )
  }
  if (value instanceof type.ListValue) {
    return value.raw.map(item => toValue(item))
  }
  return value.raw
}

export async function execute(
  program: Program,
  inputs: Record<string, unknown>,
  hooks: InternalHooks,
  modules: Modules = new Modules(hooks.import),
) {
  const scope = new RootScope<type.Value>()
  const optional = [false]
  const allowNull = () => optional.at(-1) === true

  async function contextual(
    context: type.Value | undefined,
    cb: () => Promise<type.Value>,
  ): Promise<type.Value> {
    if (context instanceof type.NullValue) {
      invariant(allowNull(), new NullSelectionError(context.selector))
      return context
    }
    try {
      context && scope.pushContext(context)
      return await cb()
    } finally {
      context && scope.popContext()
    }
  }

  const visitor: AsyncExhaustiveVisitor<void, type.Value> = {
    /**
     * Expression nodes
     */
    ModuleCallExpr: {
      async enter(node, visit) {
        const context = node.context && (await visit(node.context))
        return contextual(context, async () => {
          const module = node.name.value
          const external = await modules.get(module)
          invariant(external, new ValueReferenceError(module))
          const args = await visit(node.args)
          const output = await execute(external, args.raw, hooks, modules)
          return new type.Value(output, null)
        })
      },
    },

    LiteralExpr(node) {
      return new type.StringValue(node.value.value, null)
    },

    TemplateExpr(node) {
      const { elements: els } = node
      return new type.StringValue(
        els.map(v => v.raw).join(''),
        (els.length === 1 && els[0]?.base) || null,
        els.some(v => v.raw === null || v.raw === undefined),
      )
    },

    IdentifierExpr(node) {
      const value = scope.vars[node.value.value]
      invariant(value, new ValueReferenceError(node.value.value))
      if (value instanceof type.NullValue) {
        invariant(allowNull(), new NullSelectionError(value.selector))
      }
      return value
    },

    SliceExpr: {
      async enter(node, visit) {
        const context = node.context && (await visit(node.context))
        return contextual(context, async () => {
          const { slice } = node
          const fauxSelector = `slice@${slice.line}:${slice.col}`
          const value = await lang.runSlice(
            slice.value,
            scope.context ? toValue(scope.context) : {},
          )
          return value === null
            ? new type.NullValue(fauxSelector)
            : new type.Value(value, null)
        })
      },
    },

    SelectorExpr: {
      async enter(node, visit) {
        invariant(node.context, new QuerySyntaxError('Unresolved context'))
        const context = await visit(node.context)
        return contextual(context, async () => {
          const selector = await visit(node.selector)
          if (selector instanceof type.StringValue) {
            return select(context, selector.raw, node.expand, allowNull())
          }
          return node.expand
            ? new type.ListValue(selector.raw, selector.base)
            : selector
        })
      },
    },

    ModifierExpr: {
      async enter(node, visit) {
        invariant(node.context, new QuerySyntaxError('Unresolved context'))
        const context = await visit(node.context)
        return contextual(context, async () => {
          const mod = node.value.value
          const doc = toValue(context)
          invariant(
            typeof doc === 'string',
            new ValueTypeError('Modifier requires string input'),
          )

          switch (mod) {
            case 'html':
              return new type.HtmlValue(html.parse(doc), context.base)

            case 'js':
              return new type.JsValue(js.parse(doc), context.base)

            case 'json':
              return new type.Value(json.parse(doc), context.base)

            case 'cookies':
              return new type.CookieSetValue(cookies.parse(doc), context.base)

            case 'link': {
              const resolved = http.constructUrl(
                context.raw,
                context.base ?? undefined,
              )
              if (resolved) {
                return new type.StringValue(resolved, null)
              }
              invariant(allowNull(), new NullSelectionError('@link'))
              return new type.NullValue('@link')
            }

            default:
              throw new ValueReferenceError(`Unsupported modifier: ${mod}`)
          }
        })
      },
    },

    ObjectLiteralExpr: {
      async enter(node, visit) {
        const context = node.context && (await visit(node.context))
        return contextual(context, async () => {
          const obj: Record<string, unknown> = {}
          for (const entry of node.entries) {
            optional.push(entry.optional)
            const key = await visit(entry.key)
            const value = await visit(entry.value)
            optional.pop()
            invariant(
              key instanceof type.StringValue,
              new ValueTypeError('Only string keys are supported'),
            )
            if (value instanceof type.NullValue) {
              continue
            }
            obj[key.raw] = toValue(value)
          }
          return new type.Value(obj, null)
        })
      },
    },

    FunctionExpr: {
      async enter(node, visit) {
        async function visitBody(context?: type.Value) {
          scope.push()
          if (context) {
            scope.pushContext(context)
          }
          for (const stmt of node.body) {
            await visit(stmt)
            if (stmt.kind === NodeKind.ExtractStmt) {
              break
            }
          }
          const data = scope.pop()
          invariant(data, new QuerySyntaxError('Missing extract statement'))
          return data
        }

        const context = node.context && (await visit(node.context))

        if (context instanceof type.ListValue) {
          const values: type.Value[] = []
          for (const item of context.raw) {
            const itemContext =
              item instanceof type.Value
                ? item
                : new type.Value(item, context.base)
            const data = await visitBody(itemContext)
            values.push(data)
          }
          return new type.ListValue(values, context.base)
        }

        const data = await visitBody(context)
        return new type.Value(toValue(data), null)
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

      const obj = (entries: (typeof node)['headers']) => {
        const filteredEntries = entries.flatMap(e =>
          e.key.hasUndefined || e.value.hasUndefined
            ? []
            : [[e.key.raw, e.value.raw]],
        )
        return Object.fromEntries(filteredEntries)
      }

      const headers = obj(node.headers)
      const blocks = Object.fromEntries(
        Object.entries(node.blocks).map(e => [e[0], obj(e[1])]),
      )

      const res = await http.request(
        method,
        url,
        headers,
        blocks,
        body,
        hooks.request,
      )
      return new type.Value(
        { ...res, headers: new type.HeadersValue(res.headers, url) },
        url,
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
        const isOptional = node.optional || !!node.defaultValue
        let inputValue = lang.selectInput(inputs, inputName, isOptional)
        if (!inputValue && node.defaultValue) {
          inputValue = (await visit(node.defaultValue)).raw
        }
        scope.vars[inputName] = new type.Value(inputValue, null)
        return SKIP
      },
    },

    AssignmentStmt: {
      enter(node) {
        optional.push(node.optional)
      },
      exit(node) {
        optional.pop()
        scope.vars[node.name.value] = node.value
      },
    },

    RequestStmt: {
      enter() {
        optional.push(true)
      },

      async exit(node) {
        optional.pop()
        scope.pushContext(node.request)
      },
    },

    ExtractStmt(node) {
      scope.extracted = node.value
    },

    Program: {
      async enter(node, visit) {
        for (const stmt of node.body) {
          await visit(stmt)
          if (stmt.kind === NodeKind.ExtractStmt) {
            break
          }
        }
        return SKIP
      },
    },
  }

  await visit(program, visitor)

  const value = scope.pop()
  return value ? toValue(value) : null
}
