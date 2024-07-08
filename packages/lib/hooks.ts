import type { MaybePromise } from './utils'

export type ImportHook = (module: string) => MaybePromise<string>
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
}

type RequestInit = {
  method?: string
  headers?: Headers
  body?: string
}

type Response = {
  status: number
  headers: Headers
  body?: string
}
