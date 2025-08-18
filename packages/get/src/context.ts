import type { CExpr, Expr } from '@getlang/parser/ast'
import type { RootScope } from '@getlang/parser/scope'
import type { TypeInfo } from '@getlang/parser/typeinfo'
import { Type } from '@getlang/parser/typeinfo'
import type { MaybePromise } from '@getlang/utils'
import { NullSelection } from '@getlang/utils'
import { assert } from './value.js'

type Contextual = { value: any; typeInfo: TypeInfo }

export async function withContext(
  scope: RootScope<any>,
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
