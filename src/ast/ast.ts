import type { Token as MooToken } from 'moo'

type Token = Omit<MooToken, 'toString'>

enum NodeKind {
  Program = 'Program',
  ExtractStmt = 'ExtractStmt',
  AssignmentStmt = 'AssignmentStmt',
  DeclImportStmt = 'DeclImportStmt',
  DeclInputsStmt = 'DeclInputsStmt',
  InputDeclStmt = 'InputDeclStmt',
  RequestStmt = 'RequestStmt',
  TemplateExpr = 'TemplateExpr',
  LiteralExpr = 'LiteralExpr',
  IdentifierExpr = 'IdentifierExpr',
  ModifierExpr = 'ModifierExpr',
  FunctionExpr = 'FunctionExpr',
  ModuleCallExpr = 'ModuleCallExpr',
  ObjectLiteralExpr = 'ObjectLiteralExpr',
  DrillExpr = 'DrillExpr',
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
  method: Token
  url: Expr
  headers: RequestEntry[]
  blocks: RequestBlocks
  body?: Expr
}

type LiteralExpr = {
  kind: NodeKind.LiteralExpr
  value: Token
}

// single-element expressions are reduced to their base during parsing
type TemplateExpr = {
  kind: NodeKind.TemplateExpr
  elements: Expr[]
}

type IdentifierExpr = {
  kind: NodeKind.IdentifierExpr
  value: Token
  isUrlComponent: boolean
}

type ModifierExpr = {
  kind: NodeKind.ModifierExpr
  value: Token
}

type FunctionExpr = {
  kind: NodeKind.FunctionExpr
  body: Stmt[]
}

type ModuleCallExpr = {
  kind: NodeKind.ModuleCallExpr
  name: Token
  args: Expr
}

type ObjectLiteralExpr = {
  kind: NodeKind.ObjectLiteralExpr
  entries: ObjectEntry[]
}

type DrillExpr = {
  kind: NodeKind.DrillExpr
  target: Expr | 'context'
  bit: Expr
  expand: boolean
}

type SliceExpr = {
  kind: NodeKind.SliceExpr
  slice: Token
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
  | TemplateExpr
  | LiteralExpr
  | IdentifierExpr
  | ModifierExpr
  | FunctionExpr
  | ModuleCallExpr
  | ObjectLiteralExpr
  | DrillExpr
  | SliceExpr

type Node = Stmt | Expr

const program = (body: Stmt[]): Program => ({
  kind: NodeKind.Program,
  body,
})

const assignmentStmt = (
  name: Token,
  value: Expr,
  optional: boolean
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
  defaultValue?: Expr
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

const requestStmt = (
  method: Token,
  url: Expr,
  headers: RequestEntry[],
  blocks: RequestBlocks,
  body: Expr
): RequestStmt => ({
  kind: NodeKind.RequestStmt,
  method,
  url,
  headers,
  blocks,
  body,
})

const drillExpr = (
  target: Expr | 'context',
  bit: Expr,
  expand: boolean
): DrillExpr => ({
  kind: NodeKind.DrillExpr,
  target,
  bit,
  expand,
})

const functionExpr = (body: Stmt[]): FunctionExpr => ({
  kind: NodeKind.FunctionExpr,
  body,
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

const modifierExpr = (value: Token): ModifierExpr => ({
  kind: NodeKind.ModifierExpr,
  value,
})

const objectLiteralExpr = (entries: ObjectEntry[]): ObjectLiteralExpr => ({
  kind: NodeKind.ObjectLiteralExpr,
  entries,
})

const moduleCallExpr = (
  name: Token,
  args: Expr = objectLiteralExpr([])
): ModuleCallExpr => ({
  kind: NodeKind.ModuleCallExpr,
  name,
  args,
})

const sliceExpr = (slice: Token): SliceExpr => ({
  kind: NodeKind.SliceExpr,
  slice,
})

const templateExpr = (elements: Expr[]): TemplateExpr => ({
  kind: NodeKind.TemplateExpr,
  elements,
})

const t = {
  program,

  // STATEMENTS
  assignmentStmt,
  declImportStmt,
  declInputsStmt,
  inputDeclStmt,
  extractStmt,
  requestStmt,

  // EXPRESSIONS
  drillExpr,
  functionExpr,
  identifierExpr,
  literalExpr,
  modifierExpr,
  moduleCallExpr,
  objectLiteralExpr,
  sliceExpr,
  templateExpr,
}

export type { Token, Program, DeclInputsStmt, Node, Stmt, Expr }
export { NodeKind, t }
