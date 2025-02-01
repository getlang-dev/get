import type { MaybePromise } from './wait.js'

export type ImportHook = (module: string) => MaybePromise<string>

export type CallHook = (
  module: string,
  inputs: Record<string, unknown>,
  raster: Record<string, unknown>,
  execute: () => Promise<any>,
) => Promise<any>

export type RequestHook = (url: string, opts: RequestInit) => Promise<Response>

export type SliceHook = (
  slice: string,
  context?: unknown,
  raw?: unknown,
) => MaybePromise<unknown>

export type Hooks = {
  import: ImportHook
  request: RequestHook
  slice: SliceHook
  call: CallHook
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
