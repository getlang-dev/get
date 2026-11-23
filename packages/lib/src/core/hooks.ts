import type { TypeInfo } from '@getlang/ast'
import type { Inputs, MaybePromise } from '../index.js'

export type ImportHook = (module: string) => MaybePromise<string | undefined>

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

export type ModifierSpec = {
  modifier: Modifier
  useContext?: boolean
  returnType?: TypeInfo
}

export type ModifierHook = (
  modifier: string,
) => MaybePromise<ModifierSpec | undefined>

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
