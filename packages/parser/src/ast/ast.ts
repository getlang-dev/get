import type { Token as MooToken } from 'moo'
import type { TypeInfo } from './typeinfo.js'
import { Type } from './typeinfo.js'

export type Token = Omit<MooToken, 'toString'>
export function isToken(value: unknown): value is Token {
  return !!value && typeof value === 'object' && 'offset' in value
}

export type Program = {
  kind: 'Program'
  body: Stmt[]
}

type ExtractStmt = {
  kind: 'ExtractStmt'
  value: Expr
}

type AssignmentStmt = {
  kind: 'AssignmentStmt'
  name: Token
  value: Expr
  optional: boolean
}

export type DeclInputsStmt = {
  kind: 'DeclInputsStmt'
  inputs: InputDeclStmt[]
}

export type InputDeclStmt = {
  kind: 'InputDeclStmt'
  id: Token
  optional: boolean
  defaultValue?: SliceExpr
}

type RequestStmt = {
  kind: 'RequestStmt'
  request: RequestExpr
}

export type RequestExpr = {
  kind: 'RequestExpr'
  method: Token
  url: Expr
  headers: RequestBlockExpr
  blocks: RequestBlockExpr[]
  body: Expr
  typeInfo: TypeInfo
}

type RequestBlockExpr = {
  kind: 'RequestBlockExpr'
  name: Token
  entries: RequestEntryExpr[]
  typeInfo: TypeInfo
}

type RequestEntryExpr = {
  kind: 'RequestEntryExpr'
  key: Expr
  value: Expr
  typeInfo: TypeInfo
}

export type TemplateExpr = {
  kind: 'TemplateExpr'
  elements: (Expr | Token)[]
  typeInfo: TypeInfo
}

type IdentifierExpr = {
  kind: 'IdentifierExpr'
  id: Token
  isUrlComponent: boolean
  typeInfo: TypeInfo
}

type DrillIdentifierExpr = {
  kind: 'DrillIdentifierExpr'
  id: Token
  expand: boolean
  typeInfo: TypeInfo
}

type SelectorExpr = {
  kind: 'SelectorExpr'
  selector: Expr
  expand: boolean
  typeInfo: TypeInfo
}

export type ModifierExpr = {
  kind: 'ModifierExpr'
  modifier: Token
  args: ObjectLiteralExpr
  typeInfo: TypeInfo
}

export type ModuleExpr = {
  kind: 'ModuleExpr'
  module: Token
  call: boolean
  args: ObjectLiteralExpr
  typeInfo: TypeInfo
}

type SubqueryExpr = {
  kind: 'SubqueryExpr'
  body: Stmt[]
  typeInfo: TypeInfo
}

type DrillExpr = {
  kind: 'DrillExpr'
  body: DrillBitExpr[]
  typeInfo: TypeInfo
}

type DrillBitExpr = {
  kind: 'DrillBitExpr'
  bit: Expr
  typeInfo: TypeInfo
}

type ObjectEntryExpr = {
  kind: 'ObjectEntryExpr'
  key: Expr
  value: Expr
  optional: boolean
  typeInfo: TypeInfo
}

type ObjectLiteralExpr = {
  kind: 'ObjectLiteralExpr'
  entries: ObjectEntryExpr[]
  typeInfo: TypeInfo
}

type SliceExpr = {
  kind: 'SliceExpr'
  slice: Token
  typeInfo: TypeInfo
}

export type Stmt =
  | Program
  | ExtractStmt
  | AssignmentStmt
  | DeclInputsStmt
  | InputDeclStmt
  | RequestStmt

export type Expr =
  | RequestExpr
  | RequestBlockExpr
  | RequestEntryExpr
  | TemplateExpr
  | IdentifierExpr
  | DrillIdentifierExpr
  | SelectorExpr
  | ModifierExpr
  | ModuleExpr
  | SubqueryExpr
  | ObjectEntryExpr
  | ObjectLiteralExpr
  | SliceExpr
  | DrillExpr
  | DrillBitExpr

export type Node = Stmt | Expr

const program = (body: Stmt[]): Program => ({
  kind: 'Program',
  body,
})

const assignmentStmt = (
  name: Token,
  value: Expr,
  optional: boolean,
): AssignmentStmt => ({
  kind: 'AssignmentStmt',
  name,
  optional,
  value,
})

const declInputsStmt = (inputs: InputDeclStmt[]): DeclInputsStmt => ({
  kind: 'DeclInputsStmt',
  inputs,
})

const inputDeclStmt = (
  id: Token,
  optional: boolean,
  defaultValue?: SliceExpr,
): InputDeclStmt => ({
  kind: 'InputDeclStmt',
  id,
  optional,
  defaultValue,
})

const extractStmt = (value: Expr): ExtractStmt => ({
  kind: 'ExtractStmt',
  value,
})

const requestStmt = (request: RequestExpr): RequestStmt => ({
  kind: 'RequestStmt',
  request,
})

const requestExpr = (
  method: Token,
  url: Expr,
  headers: RequestBlockExpr,
  blocks: RequestBlockExpr[],
  body: Expr,
): RequestExpr => ({
  kind: 'RequestExpr',
  typeInfo: { type: Type.Value },
  method,
  url,
  headers,
  blocks,
  body,
})

const requestBlockExpr = (
  name: Token,
  entries: RequestEntryExpr[],
): RequestBlockExpr => ({
  kind: 'RequestBlockExpr',
  typeInfo: { type: Type.Value },
  name,
  entries,
})

const requestEntryExpr = (key: Expr, value: Expr): RequestEntryExpr => ({
  kind: 'RequestEntryExpr',
  typeInfo: { type: Type.Value },
  key,
  value,
})

const subqueryExpr = (body: Stmt[]): SubqueryExpr => ({
  kind: 'SubqueryExpr',
  typeInfo: { type: Type.Value },
  body,
})

const drillExpr = (body: DrillBitExpr[]): DrillExpr => ({
  kind: 'DrillExpr',
  typeInfo: { type: Type.Value },
  body,
})

const drillBitExpr = (bit: Expr): DrillBitExpr => ({
  kind: 'DrillBitExpr',
  typeInfo: { type: Type.Value },
  bit,
})

const identifierExpr = (id: Token): IdentifierExpr => ({
  kind: 'IdentifierExpr',
  typeInfo: { type: Type.Value },
  id,
  isUrlComponent: id.text.startsWith(':'),
})

const drillIdentifierExpr = (
  id: Token,
  expand: boolean,
): DrillIdentifierExpr => ({
  kind: 'DrillIdentifierExpr',
  typeInfo: { type: Type.Value },
  id,
  expand,
})

const selectorExpr = (selector: Expr, expand: boolean): SelectorExpr => ({
  kind: 'SelectorExpr',
  typeInfo: { type: Type.Value },
  expand,
  selector,
})

const modifierExpr = (
  modifier: Token,
  inputs: ObjectLiteralExpr = objectLiteralExpr([]),
): ModifierExpr => ({
  kind: 'ModifierExpr',
  typeInfo: { type: Type.Value },
  modifier,
  args: inputs,
})

const moduleExpr = (
  module: Token,
  inputs: ObjectLiteralExpr = objectLiteralExpr([]),
): ModuleExpr => ({
  kind: 'ModuleExpr',
  typeInfo: { type: Type.Value },
  module,
  call: false,
  args: inputs,
})

const objectEntryExpr = (
  key: Expr,
  value: Expr,
  optional = false,
): ObjectEntryExpr => ({
  kind: 'ObjectEntryExpr',
  typeInfo: { type: Type.Value },
  key,
  optional,
  value,
})

const objectLiteralExpr = (entries: ObjectEntryExpr[]): ObjectLiteralExpr => ({
  kind: 'ObjectLiteralExpr',
  typeInfo: { type: Type.Value },
  entries,
})

const sliceExpr = (slice: Token): SliceExpr => ({
  kind: 'SliceExpr',
  typeInfo: { type: Type.Value },
  slice,
})

const templateExpr = (elements: (Expr | Token)[]): TemplateExpr => ({
  kind: 'TemplateExpr',
  typeInfo: { type: Type.Value },
  elements,
})

export const t = {
  program,
  assignmentStmt,
  declInputsStmt,
  inputDeclStmt,
  extractStmt,
  requestStmt,
  requestExpr,
  requestBlockExpr,
  requestEntryExpr,
  templateExpr,
  identifierExpr,
  drillIdentifierExpr,
  selectorExpr,
  modifierExpr,
  moduleExpr,
  sliceExpr,
  objectEntryExpr,
  objectLiteralExpr,
  subqueryExpr,
  drillExpr,
  drillBitExpr,
}
