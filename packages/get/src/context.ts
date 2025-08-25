import type { CExpr, Expr } from '@getlang/parser/ast'
import type { RootScope } from '@getlang/parser/scope'
import { Type } from '@getlang/parser/typeinfo'
import type { MaybePromise } from '@getlang/utils'
import { NullSelection } from '@getlang/utils'
import type { RuntimeValue } from './value.js'
import { assert } from './value.js'

export async function withContext(
  scope: RootScope<RuntimeValue>,
  node: CExpr,
  visit: (node: Expr) => MaybePromise<any>,
  cb: (ctx?: RuntimeValue) => MaybePromise<any>,
): Promise<any> {
  async function unwrap(
    context: RuntimeValue | undefined,
    cb: (ctx?: RuntimeValue) => MaybePromise<any>,
  ): Promise<any> {
    if (context?.typeInfo.type === Type.List) {
      const list = []
      for (const item of context.data) {
        const itemCtx = { data: item, typeInfo: context.typeInfo.of }
        list.push(await unwrap(itemCtx, cb))
      }
      return list
    }

    context && scope.pushContext(context)
    const value = await cb(context)
    context && scope.popContext()
    return value
  }

  let context = scope.context
  if (node.context) {
    let value = await visit(node.context)
    const optional = node.typeInfo.type === Type.Maybe
    value = optional ? value : assert(value)
    if (value instanceof NullSelection) {
      return value
    }
    context = { data: value, typeInfo: node.context.typeInfo }
  }
  return unwrap(context, cb)
}
