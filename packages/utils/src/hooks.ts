import type { Inputs } from './index.js'
import type { MaybePromise } from './wait.js'

export type ImportHook = (module: string) => MaybePromise<string>

export type CallHook = (module: string, inputs: Inputs) => MaybePromise<any>

export type RequestHook = (
  url: string,
  opts: RequestInit,
) => MaybePromise<Response>

export type SliceHook = (
  slice: string,
  context?: unknown,
  raw?: unknown,
) => MaybePromise<unknown>

export type ExtractHook = (
  module: string,
  inputs: Inputs,
  value: any,
) => MaybePromise<any>

export type Hooks = {
  import: ImportHook
  request: RequestHook
  slice: SliceHook
  call: CallHook
  extract: ExtractHook
}

export type UserHooks = Partial<Hooks>

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
