import {
  visit,
  SKIP,
  type AsyncExhaustiveVisitor,
} from '@getlang/parser/visitor'
import { RootScope } from '@getlang/parser/scope'
import { NodeKind, type Stmt, type Program } from '@getlang/parser/ast'
import type { Hooks, MaybePromise } from '@getlang/lib'
import {
  invariant,
  NullSelectionError,
  QuerySyntaxError,
  ValueTypeError,
  ValueReferenceError,
  ImportError,
} from '@getlang/lib'
import * as http from './net/http.js'
import * as type from './value.js'
import * as html from './values/html.js'
import * as json from './values/json.js'
import * as js from './values/js.js'
import * as cookies from './values/cookies.js'
import * as lang from './lang.js'
import { select } from './select.js'

export type InternalHooks = {
  import: (module: string) => MaybePromise<Program>
  request: Hooks['request']
  slice: Hooks['slice']
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

function toValue(value: unknown): unknown {
  if (value instanceof type.HtmlValue) {
    return html.getValue(value.raw)
  } else if (value instanceof type.JsValue) {
    return js.getValue(value.raw)
  } else if (value instanceof type.HeadersValue) {
    return Object.fromEntries(value.raw)
  } else if (value instanceof type.CookieSetValue) {
    return Object.fromEntries(
      Object.entries(value.raw).map(e => [e[0], e[1].value]),
    )
  } else if (value instanceof type.ListValue) {
    return value.raw.map(item => toValue(item))
  } else if (value instanceof type.Value) {
    return toValue(value.raw)
  } else if (Array.isArray(value)) {
    return value.map(toValue)
  } else if (typeof value === 'object' && value) {
    return Object.fromEntries(
      Object.entries(value).map(e => [e[0], toValue(e[1])]),
    )
  } else {
    return value
  }
}

export async function execute(
  program: Program,
  inputs: Record<string, unknown>,
  hooks: InternalHooks,
  modules: Modules = new Modules(hooks.import),
) {
  const scope = new RootScope<type.Value>()

  function assert(value: type.Value) {
    if (value instanceof type.UndefinedValue) {
      throw new NullSelectionError(value.selector)
    }
  }

  async function executeBody(
    visit: (stmt: Stmt) => void,
    body: Stmt[],
    context?: type.Value,
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

  async function contextual(
    context: type.Value | undefined,
    cb: () => Promise<type.Value>,
  ): Promise<type.Value> {
    if (context instanceof type.UndefinedValue) {
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

    TemplateExpr(node) {
      let hasUndefined = false
      const value = node.elements
        .map(e => {
          if ('offset' in e) {
            return e.value
          }
          if (e.raw === null || e.raw === undefined) {
            hasUndefined = true
            return '<null>'
          }
          return e.raw
        })
        .join('')
      if (hasUndefined) {
        return new type.UndefinedValue(value)
      }
      return new type.StringValue(value, null)
    },

    IdentifierExpr(node) {
      const value = scope.vars[node.value.value]
      invariant(value, new ValueReferenceError(node.value.value))
      return value
    },

    SliceExpr: {
      async enter(node, visit) {
        const context = node.context && (await visit(node.context))
        return contextual(context, async () => {
          const { slice } = node
          const fauxSelector = `slice@${slice.line}:${slice.col}`
          const value = await hooks.slice(
            slice.value,
            scope.context ? toValue(scope.context) : {},
            scope.context?.raw,
          )
          return value === undefined
            ? new type.UndefinedValue(fauxSelector)
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
            return select(context, selector.raw, node.expand)
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
              return resolved
                ? new type.StringValue(resolved, null)
                : new type.UndefinedValue('@link')
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
            const value = await visit(entry.value)
            entry.optional || assert(value)
            if (!(value instanceof type.UndefinedValue)) {
              obj[entry.key.value] = value
            }
          }
          return new type.Value(obj, null)
        })
      },
    },

    FunctionExpr: {
      async enter(node, visit) {
        const context = node.context && (await visit(node.context))
        if (!(context instanceof type.ListValue)) {
          const ex = await executeBody(visit, node.body, context)
          invariant(ex, new QuerySyntaxError('Missing extract statement'))
          return ex
        }

        const values: type.Value[] = []
        for (const item of context.raw) {
          const itemContext =
            item instanceof type.Value
              ? item
              : new type.Value(item, context.base)
          const ex = await executeBody(visit, node.body, itemContext)
          invariant(ex, new QuerySyntaxError('Missing extract statement'))
          values.push(ex)
        }
        return new type.ListValue(values, context.base)
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
          e.key instanceof type.UndefinedValue ||
          e.value instanceof type.UndefinedValue
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
        scope.vars[inputName] =
          inputValue === undefined
            ? new type.UndefinedValue(`input:${inputName}`)
            : new type.Value(inputValue, null)
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
