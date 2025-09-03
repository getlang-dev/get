import type { TypeInfo } from '@getlang/ast'
import type { Inputs, MaybePromise } from '../index.js'
import { requestHook } from '../net/http.js'
import { runSlice } from '../slice.js'
import { ImportError, invariant } from './errors.js'

export type ImportHook = (module: string) => MaybePromise<string>

export type CallHook = (module: string, inputs: Inputs) => MaybePromise<any>

export type RequestHook = (
  url: string,
  opts: RequestInit,
) => MaybePromise<Response>

export type SliceHook = (
  slice: string,
  context?: unknown,
) => MaybePromise<unknown>

export type ExtractHook = (
  module: string,
  inputs: Inputs,
  value: any,
) => MaybePromise<any>

export type Modifier = (context: any, options: Record<string, unknown>) => any
export type ModifierHook = (modifier: string) => MaybePromise<
  | {
      modifier: Modifier
      typeInfo?: TypeInfo
    }
  | undefined
>

export type Hooks = Partial<{
  import: ImportHook
  request: RequestHook
  slice: SliceHook
  call: CallHook
  extract: ExtractHook
  modifier: ModifierHook
}>

type RequestInit = {
  method?: string
  headers?: Headers
  body?: string
}

export type Response = {
  status: number
  headers: Headers
  body?: string
}

export function buildHooks(hooks: Hooks): Required<Hooks> {
  return {
    import: (module: string) => {
      const err = 'Imports are not supported by the current runtime'
      invariant(hooks.import, new ImportError(err))
      return hooks.import(module)
    },
    modifier: modifier => hooks.modifier?.(modifier),
    call: hooks.call ?? (() => {}),
    request: hooks.request ?? requestHook,
    slice: hooks.slice ?? runSlice,
    extract: hooks.extract ?? (() => {}),
  }
}
