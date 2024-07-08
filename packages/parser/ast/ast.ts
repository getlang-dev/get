import type { Token as MooToken } from 'moo'
import type { TypeInfo } from './typeinfo'

type Token = Omit<MooToken, 'toString'>

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
  LiteralExpr = 'LiteralExpr',
  IdentifierExpr = 'IdentifierExpr',
  SelectorExpr = 'SelectorExpr',
  ModifierExpr = 'ModifierExpr',
  FunctionExpr = 'FunctionExpr',
  ModuleCallExpr = 'ModuleCallExpr',
  ObjectLiteralExpr = 'ObjectLiteralExpr',
  SliceExpr = 'SliceExpr',
}

type RequestEntry = {
  key: Expr
  value: Expr
}

type RequestBlocks = {
  query?: RequestEntry[]
  cookies?: RequestEntry[]
  json?: RequestEntry[]
  form?: RequestEntry[]
}

type ObjectEntry = {
  key: Expr
  value: Expr
  optional: boolean
}

type Program = {
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

type DeclInputsStmt = {
  kind: NodeKind.DeclInputsStmt
  inputs: InputDeclStmt[]
}

type InputDeclStmt = {
  kind: NodeKind.InputDeclStmt
  id: Token
  optional: boolean
  defaultValue?: Expr
}

type RequestStmt = {
  kind: NodeKind.RequestStmt
  request: Expr
}

type RequestExpr = {
  kind: NodeKind.RequestExpr
  method: Token
  url: Expr
  headers: RequestEntry[]
  blocks: RequestBlocks
  body?: Expr
  typeInfo?: TypeInfo
}

type LiteralExpr = {
  kind: NodeKind.LiteralExpr
  value: Token
  typeInfo?: TypeInfo
}

// single-element expressions are reduced to their base during parsing
type TemplateExpr = {
  kind: NodeKind.TemplateExpr
  elements: Expr[]
  typeInfo?: TypeInfo
}

type IdentifierExpr = {
  kind: NodeKind.IdentifierExpr
  value: Token
  isUrlComponent: boolean
  typeInfo?: TypeInfo
}

type SelectorExpr = {
  kind: NodeKind.SelectorExpr
  selector: Expr
  expand: boolean
  context?: Expr
  typeInfo?: TypeInfo
}

type ModifierExpr = {
  kind: NodeKind.ModifierExpr
  value: Token
  context?: Expr
  typeInfo?: TypeInfo
}

type FunctionExpr = {
  kind: NodeKind.FunctionExpr
  body: Stmt[]
  context?: Expr
  typeInfo?: TypeInfo
}

type ModuleCallExpr = {
  kind: NodeKind.ModuleCallExpr
  name: Token
  args: Expr
  context?: Expr
  typeInfo?: TypeInfo
}

type ObjectLiteralExpr = {
  kind: NodeKind.ObjectLiteralExpr
  entries: ObjectEntry[]
  context?: Expr
  typeInfo?: TypeInfo
}

type SliceExpr = {
  kind: NodeKind.SliceExpr
  slice: Token
  context?: Expr
  typeInfo?: TypeInfo
}

type Stmt =
  | Program
  | ExtractStmt
  | AssignmentStmt
  | DeclImportStmt
  | DeclInputsStmt
  | InputDeclStmt
  | RequestStmt

type Expr =
  | RequestExpr
  | TemplateExpr
  | LiteralExpr
  | IdentifierExpr
  | SelectorExpr
  | ModifierExpr
  | FunctionExpr
  | ModuleCallExpr
  | ObjectLiteralExpr
  | SliceExpr

type Node = Stmt | Expr

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
  value,
  optional,
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
  defaultValue?: Expr,
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
  headers: RequestEntry[],
  blocks: RequestBlocks,
  body: Expr,
): RequestExpr => ({
  kind: NodeKind.RequestExpr,
  method,
  url,
  headers,
  blocks,
  body,
})

const functionExpr = (body: Stmt[], context?: Expr): FunctionExpr => ({
  kind: NodeKind.FunctionExpr,
  body,
  context,
})

const identifierExpr = (value: Token): IdentifierExpr => ({
  kind: NodeKind.IdentifierExpr,
  value,
  isUrlComponent: value.text.startsWith(':'),
})

const literalExpr = (value: Token): LiteralExpr => ({
  kind: NodeKind.LiteralExpr,
  value,
})

const selectorExpr = (
  selector: Expr,
  expand: boolean,
  context?: Expr,
): SelectorExpr => ({
  kind: NodeKind.SelectorExpr,
  selector,
  expand,
  context,
})

const modifierExpr = (value: Token, context?: Expr): ModifierExpr => ({
  kind: NodeKind.ModifierExpr,
  value,
  context,
})

const objectLiteralExpr = (
  entries: ObjectEntry[],
  context?: Expr,
): ObjectLiteralExpr => ({
  kind: NodeKind.ObjectLiteralExpr,
  entries,
  context,
})

const moduleCallExpr = (
  name: Token,
  args: Expr = objectLiteralExpr([]),
  context?: Expr,
): ModuleCallExpr => ({
  kind: NodeKind.ModuleCallExpr,
  name,
  args,
  context,
})

const sliceExpr = (slice: Token, context?: Expr): SliceExpr => ({
  kind: NodeKind.SliceExpr,
  slice,
  context,
})

const templateExpr = (elements: Expr[]): TemplateExpr => ({
  kind: NodeKind.TemplateExpr,
  elements,
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
  functionExpr,
  identifierExpr,
  literalExpr,
  selectorExpr,
  modifierExpr,
  moduleCallExpr,
  objectLiteralExpr,
  sliceExpr,
  templateExpr,
}

export type { Token, Program, DeclInputsStmt, Node, Stmt, Expr, RequestExpr }
