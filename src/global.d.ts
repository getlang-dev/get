type Ref = {
  name: string
  nodes: any[]
}

declare module 'acorn-globals' {
  function detect(source: any): Ref[]
  export = detect
}
