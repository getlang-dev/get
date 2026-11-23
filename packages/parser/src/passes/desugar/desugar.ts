import type { Program } from '@getlang/ast'
import type { MaybePromise } from '@getlang/lib'
import { resolveContext } from './context.js'
import { dropDrills } from './dropdrill.js'
import { settleLinks } from './links.js'
import { RequestParsers } from './reqparse.js'
import { insertSliceDeps } from './slicedeps.js'
import { addUrlInputs } from './urlinputs.js'

type Spec = { modifier: string } | { module: string }
type UsesContext = (spec: Spec) => MaybePromise<boolean>

type DesugarOptions = {
  usesContext?: UsesContext
}

export type DesugarPass = (
  ast: Program,
  parsers: RequestParsers,
  options: Required<DesugarOptions>,
) => MaybePromise<Program>

const visitors = [
  addUrlInputs,
  resolveContext,
  settleLinks,
  insertSliceDeps,
  dropDrills,
]

export async function desugar(
  ast: Program,
  options: DesugarOptions = {},
): Promise<Program> {
  const parsers = new RequestParsers()
  const { usesContext = () => false } = options
  let program = ast
  for (const pass of visitors) {
    program = await pass(program, parsers, { usesContext })
  }
  return program
}
