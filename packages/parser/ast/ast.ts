import type { Token as MooToken } from 'moo'
import type { TypeInfo } from './typeinfo.js'
import { Type } from './typeinfo.js'

export type Token = Omit<MooToken, 'toString'>

export enum NodeKind {
  Program = 'Program',
  ExtractStmt = 'ExtractStmt',
  AssignmentStmt = 'AssignmentStmt',
  DeclImportStmt = 'DeclImportStmt',
  DeclInputsStmt = 'DeclInputsStmt',
  InputDeclStmt = 'InputDeclStmt',
  RequestStmt = 'RequestStmt',
  RequestExpr = 'RequestExpr',
  TemplateExpr = 'TemplateExpr',
  IdentifierExpr = 'IdentifierExpr',
  SelectorExpr = 'SelectorExpr',
  ModifierExpr = 'ModifierExpr',
  SubqueryExpr = 'SubqueryExpr',
  ModuleCallExpr = 'ModuleCallExpr',
  ObjectLiteralExpr = 'ObjectLiteralExpr',
  SliceExpr = 'SliceExpr',
}

type ObjectEntry = {
  key: Expr
  value: Expr
  optional: boolean
}

export type Program = {
  kind: NodeKind.Program
  body: Stmt[]
}

type ExtractStmt = {
  kind: NodeKind.ExtractStmt
  value: Expr
}

type AssignmentStmt = {
  kind: NodeKind.AssignmentStmt
  name: Token
  value: Expr
  optional: boolean
}

type DeclImportStmt = {
  kind: NodeKind.DeclImportStmt
  id: Token
}

export type DeclInputsStmt = {
  kind: NodeKind.DeclInputsStmt
  inputs: InputDeclStmt[]
}

type InputDeclStmt = {
  kind: NodeKind.InputDeclStmt
  id: Token
  optional: boolean
  defaultValue?: SliceExpr
}

type RequestStmt = {
  kind: NodeKind.RequestStmt
  request: RequestExpr
}

type RequestBlocks = {
  query?: ObjectLiteralExpr
  cookies?: ObjectLiteralExpr
  json?: ObjectLiteralExpr
  form?: ObjectLiteralExpr
}

export type RequestExpr = {
  kind: NodeKind.RequestExpr
  method: Token
  url: Expr
  headers: ObjectLiteralExpr
  blocks: RequestBlocks
  body?: Expr
  typeInfo: TypeInfo
}

export type TemplateExpr = {
  kind: NodeKind.TemplateExpr
  elements: (Expr | Token)[]
  typeInfo: TypeInfo
}

type IdentifierExpr = {
  kind: NodeKind.IdentifierExpr
  value: Token
  isUrlComponent: boolean
  typeInfo: TypeInfo
}

type SelectorExpr = {
  kind: NodeKind.SelectorExpr
  selector: TemplateExpr
  expand: boolean
  context?: Expr
  typeInfo: TypeInfo
}

type ModifierExpr = {
  kind: NodeKind.ModifierExpr
  value: Token
  options: ObjectLiteralExpr
  context?: Expr
  typeInfo: TypeInfo
}

type SubqueryExpr = {
  kind: NodeKind.SubqueryExpr
  body: Stmt[]
  context?: Expr
  typeInfo: TypeInfo
}

type ModuleCallExpr = {
  kind: NodeKind.ModuleCallExpr
  name: Token
  inputs: Expr
  context?: Expr
  typeInfo: TypeInfo
}

type ObjectLiteralExpr = {
  kind: NodeKind.ObjectLiteralExpr
  entries: ObjectEntry[]
  context?: Expr
  typeInfo: TypeInfo
}

type SliceExpr = {
  kind: NodeKind.SliceExpr
  slice: Token
  context?: Expr
  typeInfo: TypeInfo
}

export type Stmt =
  | Program
  | ExtractStmt
  | AssignmentStmt
  | DeclImportStmt
  | DeclInputsStmt
  | InputDeclStmt
  | RequestStmt

export type Expr =
  | RequestExpr
  | TemplateExpr
  | IdentifierExpr
  | SelectorExpr
  | ModifierExpr
  | SubqueryExpr
  | ModuleCallExpr
  | ObjectLiteralExpr
  | SliceExpr

export type CExpr = Extract<Expr, { context?: any }>
export type Node = Stmt | Expr

const program = (body: Stmt[]): Program => ({
  kind: NodeKind.Program,
  body,
})

const assignmentStmt = (
  name: Token,
  value: Expr,
  optional: boolean,
): AssignmentStmt => ({
  kind: NodeKind.AssignmentStmt,
  name,
  optional,
  value,
})

const declImportStmt = (id: Token): DeclImportStmt => ({
  kind: NodeKind.DeclImportStmt,
  id,
})

const declInputsStmt = (inputs: InputDeclStmt[]): DeclInputsStmt => ({
  kind: NodeKind.DeclInputsStmt,
  inputs,
})

const inputDeclStmt = (
  id: Token,
  optional: boolean,
  defaultValue?: SliceExpr,
): InputDeclStmt => ({
  kind: NodeKind.InputDeclStmt,
  id,
  optional,
  defaultValue,
})

const extractStmt = (value: Expr): ExtractStmt => ({
  kind: NodeKind.ExtractStmt,
  value,
})

const requestStmt = (request: RequestExpr): RequestStmt => ({
  kind: NodeKind.RequestStmt,
  request,
})

const requestExpr = (
  method: Token,
  url: Expr,
  headers: ObjectLiteralExpr,
  blocks: RequestBlocks,
  body: Expr,
): RequestExpr => ({
  kind: NodeKind.RequestExpr,
  method,
  url,
  headers,
  blocks,
  body,
  typeInfo: { type: Type.Value },
})

const subqueryExpr = (body: Stmt[], context?: Expr): SubqueryExpr => ({
  kind: NodeKind.SubqueryExpr,
  body,
  typeInfo: { type: Type.Value },
  context,
})

const identifierExpr = (value: Token): IdentifierExpr => ({
  kind: NodeKind.IdentifierExpr,
  value,
  isUrlComponent: value.text.startsWith(':'),
  typeInfo: { type: Type.Value },
})

const selectorExpr = (
  selector: TemplateExpr,
  expand: boolean,
  context?: Expr,
): SelectorExpr => ({
  kind: NodeKind.SelectorExpr,
  expand,
  selector,
  typeInfo: { type: Type.Value },
  context,
})

const modifierExpr = (
  value: Token,
  options: ObjectLiteralExpr = objectLiteralExpr([]),
  context?: Expr,
): ModifierExpr => ({
  kind: NodeKind.ModifierExpr,
  value,
  options,
  typeInfo: { type: Type.Value },
  context,
})

const objectLiteralExpr = (
  entries: ObjectEntry[],
  context?: Expr,
): ObjectLiteralExpr => ({
  kind: NodeKind.ObjectLiteralExpr,
  entries,
  typeInfo: { type: Type.Value },
  context,
})

const moduleCallExpr = (
  name: Token,
  inputs: Expr = objectLiteralExpr([]),
  context?: Expr,
): ModuleCallExpr => ({
  kind: NodeKind.ModuleCallExpr,
  name,
  inputs,
  typeInfo: { type: Type.Value },
  context,
})

const sliceExpr = (slice: Token, context?: Expr): SliceExpr => ({
  kind: NodeKind.SliceExpr,
  slice,
  typeInfo: { type: Type.Value },
  context,
})

const templateExpr = (elements: (Expr | Token)[]): TemplateExpr => ({
  kind: NodeKind.TemplateExpr,
  elements,
  typeInfo: { type: Type.Value },
})

export const t = {
  program,

  // STATEMENTS
  assignmentStmt,
  declImportStmt,
  declInputsStmt,
  inputDeclStmt,
  extractStmt,
  requestStmt,

  // EXPRESSIONS
  requestExpr,
  identifierExpr,
  templateExpr,

  // CONTEXTUAL EXPRESSIONS
  selectorExpr,
  modifierExpr,
  sliceExpr,
  objectLiteralExpr,
  subqueryExpr,
  moduleCallExpr,
}
