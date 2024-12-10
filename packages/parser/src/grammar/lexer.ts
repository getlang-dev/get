import moo from 'moo'
import { requestStates } from './lex/request.js'
import { patterns } from './lex/shared.js'
import { slice, slice_block } from './lex/slice.js'
import { templateStates } from './lex/templates.js'

const verbs = ['GET', 'PUT', 'POST', 'PATCH', 'DELETE']
const keywords = ['inputs', 'set']

const keywordsObj = Object.fromEntries(keywords.map(k => [`kw_${k}`, k]))

const main = {
  ws: patterns.ws,
  nl: {
    match: /\n/,
    lineBreaks: true,
  },
  comment: /--.*/,
  kw_extract: {
    match: /extract(?=\s)/,
    push: 'expr',
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
  request_verb: {
    match: new RegExp(`(?:${verbs.join('|')}) `),
    push: 'requestUrl',
    value: (text: string) => text.trim(),
  },
  identifier: {
    match: patterns.identifier,
    type: moo.keywords(keywordsObj),
  },
  identifier_expr: {
    match: patterns.identifierExpr,
    value: (text: string) => text.slice(1),
  },
  symbols: /[{}(),?@]/,
}

const expr = {
  ws: patterns.ws,
  nl: {
    match: /\n/,
    lineBreaks: true,
  },
  drill_arrow: ['->', '=>'],
  link: {
    match: patterns.link,
    value: (text: string) => text.slice(1, -1),
  },
  symbols: {
    match: /[{(]/,
    pop: 1,
  },
  identifier_expr: {
    match: patterns.identifierExpr,
    value: (text: string) => text.slice(1),
    pop: 1,
  },
  slice_block,
  slice,
  call: {
    match: patterns.call,
    value: (text: string) => text.slice(1),
    pop: 1,
  },
  template: {
    defaultType: 'ws',
    match: /(?=.)/,
    next: 'template',
  },
}

const lexer: any = moo.states({
  $all: { err: moo.error },
  main,
  expr,
  ...templateStates,
  ...requestStates,
})

export default lexer
