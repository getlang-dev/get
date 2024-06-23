import type { Program, AsyncExhaustiveVisitor } from '@getlang/parser'
import { visit, SKIP, NodeKind, t, createToken } from '@getlang/parser'
import { RootScope } from './scope'
import * as type from './value'
import {
  invariant,
  NullSelectionError,
  GetReferenceError,
  GetSyntaxError,
  ImportError,
} from '../errors'
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

Headers

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
  const scope = new RootScope()
  const optional = [false]
  const allowNull = () => optional.at(-1) === true

  const visitor: AsyncExhaustiveVisitor<void, type.Value> = {
    async DeclImportStmt(node) {
      const module = node.id.value
      try {
        await modules.import(module)
      } catch (e) {
        throw new ImportError(`Failed to import module: ${module}`)
      }
    },

    async ModuleCallExpr(node) {
      const module = node.name.value
      const external = await modules.get(module)
      invariant(external, new GetReferenceError(module))
      const output = await execute(external, node.args.raw, hooks, modules)
      return new type.Value(output, null)
    },

    /**
     * Expression nodes
     */
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
      invariant(value, new GetReferenceError(node.value.value))
      if (value instanceof type.NullValue) {
        invariant(allowNull(), new NullSelectionError(value.selector))
      }
      return value
    },

    async SliceExpr(node) {
      const { slice } = node
      const fauxSelector = `slice@${slice.line}:${slice.col}`
      const value = await lang.runSlice(slice.value, scope.context?.raw)
      return value === null
        ? new type.NullValue(fauxSelector)
        : new type.Value(value, null)
    },

    DrillExpr: {
      async enter(node, visit) {
        // ensure simplified ast
        invariant(
          node.target !== 'context',
          new GetSyntaxError('Unresolved context drill'),
        )

        const context = await visit(node.target)

        if (context instanceof type.NullValue) {
          invariant(allowNull(), new NullSelectionError(context.selector))
          return context
        }
        const isListContext = context instanceof type.ListValue
        const isSelector = node.bit.kind === NodeKind.TemplateExpr

        if ((node.expand && !isSelector) || isListContext) {
          invariant(
            Array.isArray(context.raw),
            new TypeError('Cannot expand non-list context'),
          )
          const values: type.Value[] = []
          for (const item of context.raw) {
            scope.pushContext(
              item instanceof type.Value
                ? item
                : new type.Value(item, context.base),
            )
            let op = node.bit
            if (isListContext) {
              op = t.drillExpr(
                t.identifierExpr(createToken('')),
                node.bit,
                node.expand,
              )
            }
            values.push(await visit(op))
            scope.popContext()
          }
          return new type.ListValue(values, context.base)
        }

        scope.pushContext(context)
        const bit = await visit(node.bit)
        scope.popContext()

        if (isSelector) {
          invariant(
            typeof bit.raw === 'string',
            new TypeError('Selector must be a string'),
          )
          return select(context, bit.raw, node.expand, allowNull())
        }

        return bit
      },
    },

    ModifierExpr(node) {
      const mod = node.value.value
      const { context } = scope
      invariant(
        context,
        new GetReferenceError('Modifier failed to locate context'),
      )

      const doc = toValue(context)
      invariant(
        typeof doc === 'string',
        new TypeError('Modifier requires string input'),
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
          throw new GetReferenceError(`Unsupported modifier: ${mod}`)
      }
    },

    ObjectLiteralExpr: {
      async enter(node, visit) {
        const obj: Record<string, unknown> = {}
        for (const entry of node.entries) {
          optional.push(entry.optional)
          const key = await visit(entry.key)
          const value = await visit(entry.value)
          optional.pop()
          invariant(
            key instanceof type.StringValue,
            new TypeError('Only string keys are supported'),
          )
          if (value instanceof type.NullValue) {
            continue
          }
          obj[key.raw] = toValue(value)
        }
        return new type.Value(obj, null)
      },
    },

    FunctionExpr: {
      async enter(node, visit) {
        scope.push()
        for (const stmt of node.body) {
          await visit(stmt)
          if (stmt.kind === NodeKind.ExtractStmt) {
            break
          }
        }
        const data = scope.pop()
        return new type.Value(data ? toValue(data) : null, null)
      },
    },

    /**
     * Statement nodes
     */

    DeclInputsStmt() {},

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

        const method = node.method.value
        const url = node.url.raw
        const body = node.body?.raw || ''

        invariant(
          typeof url === 'string',
          new TypeError('Request URL expected string'),
        )
        invariant(
          typeof body === 'string',
          new TypeError('Request body expected string'),
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
        scope.pushContext(
          new type.Value(
            { ...res, headers: new type.HeadersValue(res.headers, url) },
            url,
          ),
        )
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
