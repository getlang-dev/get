import type { TypeInfo } from './typeinfo.js'
import { Type } from './typeinfo.js'

export * from './ast.js'
export type { TypeInfo }
export { Type }

export function repr(ti: TypeInfo): string {
  switch (ti.type) {
    case Type.Maybe:
      return `maybe<${repr(ti.option)}>`
    case Type.List:
      return `${repr(ti.of)}[]`
    case Type.Struct: {
      const fields = Object.entries(ti.schema)
        .map(e => `${e[0]}: ${repr(e[1])};`)
        .join(' ')
      return `{ ${fields} }`
    }
    case Type.Context:
    case Type.Never:
      throw new Error('Unsupported key type')
    default:
      return ti.type
  }
}
