import moo from 'moo'
import { ws, identifier, identifierExpr, popAll } from './lex/shared'
import { templateUntil, interpExpr } from './lex/templates'
import { slice, slice_block } from './lex/slice'

const verbs = ['GET', 'PUT', 'POST', 'PATCH', 'DELETE']
const keywords = ['import', 'inputs', 'set']
const requestBlockNames = ['query', 'cookies', 'json', 'form']
const modifiers = [
  'html',
  'json',
  'js',
  'cookies',
  'resolve',
  'headers',
  'cookies',
]
const keywordsObj = Object.fromEntries(keywords.map(k => [`kw_${k}`, k]))

const exprOpeners = {
  lbrack: '{',
  lparent: '(',
  identifier_expr: {
    match: identifierExpr,
    value: (text: string) => text.slice(1),
  },
  slice_block,
  slice,
  modifier: {
    match: modifiers.map(p => `@${p}`),
    value: (text: string) => text.slice(1),
  },
}

const main = {
  ws,
  comment: /--.*/,
  kw_extract: {
    match: /extract(?=\s)/,
    push: 'expr',
  },
  request_verb: {
    match: new RegExp(`(?:${verbs.join('|')}) `),
    push: 'requestUrl',
    value: (text: string) => text.trim(),
  },
  identifier: {
    match: identifier,
    type: moo.keywords(keywordsObj),
  },
  drill_arrow: {
    match: ['->', '=>'],
    push: 'expr',
  },
  colon: {
    match: ':',
    push: 'expr',
  },
  assignment: {
    match: '=',
    push: 'expr',
  },
  comma: ',',
  rbrack: '}',
  rparen: ')',
  optmark: '?',
  ...exprOpeners,
  nl: {
    match: /\n/,
    lineBreaks: true,
  },
}

const expr = {
  ws,
  nl: {
    match: /\n/,
    lineBreaks: true,
  },
  drill_arrow: ['->', '=>'],
  ...popAll(exprOpeners),
  template: {
    defaultType: 'ws',
    match: /(?=.)/,
    next: 'template',
  },
}

const request = {
  request_term: {
    defaultType: 'nl',
    match: /\n\s*$/,
    lineBreaks: true,
    pop: 1,
  },
  nl: {
    match: /\n/,
    lineBreaks: true,
  },
  request_block_name: {
    match: new RegExp(`^\\s*\\[(?:${requestBlockNames.join('|')})\\]`),
    value: (text: string) => text.trim().slice(1, -1),
  },
  request_block_body: {
    match: /^\s*\[body\]\n/,
    lineBreaks: true,
    push: 'requestValue',
  },
  start_of_line_incl_ws: {
    defaultType: 'ws',
    match: /^\s*(?=.)/,
    push: 'requestKey',
  },
  colon: ':',
  ws: {
    match: ' ',
    push: 'requestValue',
  },
}

const lexer: any = moo.states({
  $all: { err: moo.error },
  main,
  expr,
  template: templateUntil(/\n|->|=>/),
  request,
  requestUrl: templateUntil(/\n/, ['$:'], 'request'),
  requestKey: templateUntil(/:/),
  requestValue: templateUntil(/\n/),
  interpExpr,
})

export default lexer
export { identifier }
