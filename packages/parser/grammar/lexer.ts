import moo from 'moo'
import { identifier, identifierExpr, popAll, ws } from './lex/shared.js'
import { slice, slice_block } from './lex/slice.js'
import { interpExpr, templateUntil } from './lex/templates.js'

const verbs = ['GET', 'PUT', 'POST', 'PATCH', 'DELETE']
const keywords = ['import', 'inputs', 'set']
const requestBlockNames = ['query', 'cookies', 'json', 'form']
const modifiers = ['html', 'json', 'js', 'cookies', 'link', 'headers']
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
  request_block_body_end: {
    match: /\n[^\S\r\n]*\[\/body\]/,
    lineBreaks: true,
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
    push: 'requestBody',
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
  requestUrl: templateUntil(/\n/, { interpSymbols: ['$:'], next: 'request' }),
  requestKey: templateUntil(/:/),
  requestValue: templateUntil(/\n/),
  requestBody: templateUntil(/\n[^\S\r\n]*\[\/body\]/),
  interpExpr,
})

export default lexer
