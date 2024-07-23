declare module 'acorn-globals' {
  import type { Program } from 'acorn'
  type Ref = { name: string }
  function detect(source: Program): Ref[]
  export = detect
}
