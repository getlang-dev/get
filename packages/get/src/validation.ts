import type { Program } from '@getlang/parser/ast'
import type { TransformVisitor } from '@getlang/parser/visitor'
import { visit } from '@getlang/parser/visitor'
import { invariant, NullSelection } from '@getlang/utils'
import { NullSelectionError, UnknownInputsError } from '@getlang/utils/errors'

export function collectInputs(program: Program): Set<string> {
  const declared = new Set<string>()
  visit(program, {
    InputDeclStmt(node) {
      declared.add(node.id.value)
      return node
    },
  } satisfies TransformVisitor)
  return declared
}

export function validate(program: Program, inputs: Record<string, unknown>) {
  const declared = collectInputs(program)
  const provided = new Set(Object.keys(inputs))
  const unknown = provided.difference(declared)
  invariant(unknown.size === 0, new UnknownInputsError([...unknown]))
}

export function assert(value: any) {
  if (value instanceof NullSelection) {
    throw new NullSelectionError(value.selector)
  }
  return value
}
