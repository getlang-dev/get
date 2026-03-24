import type { Rules } from 'moo'
import moo from 'moo'
import { slice } from './lex/literals.js'
import { requestStates } from './lex/request.js'
import { patterns, ws } from './lex/shared.js'
import { templateStates, templateUntil } from './lex/templates.js'

const main: Rules = {
  ...ws,
  symbol: /[,?@]/,
  lsymbol: {
    match: /[{(]/,
    push: 'main',
  },
  rsymbol: {
    match: /[})]/,
    pop: 1,
  },
  request_verb: {
    match: /(?:GET|PUT|POST|PATCH|DELETE)\b/,
    push: 'requrl',
    value: (text: string) => text.trim(),
  },
  expr: {
    match: /(?:extract\b|=|:)/,
    next: 'expr',
    type: moo.keywords({
      kw_extract: 'extract',
      assignment: '=',
      colon: ':',
    }),
  },
  identifier: {
    match: patterns.identifier,
    type: moo.keywords({
      kw_inputs: 'inputs',
      kw_set: 'set',
    }),
  },
  identifier_expr: {
    match: patterns.identifierExpr,
    value: (text: string) => text.slice(1),
  },
}

const expr: Rules = {
  ...ws,
  lsymbol: {
    defaultType: 'ws',
    match: /(?=[{('"])/,
    next: 'chain',
  },
  drill_arrow: ['->', '=>', '?:'],
  slice_block: {
    ...slice(/\|/),
    next: 'chain',
  },
  slice: {
    ...slice(/`/),
    next: 'chain',
  },
  num: {
    match: /\d+(?:\.\d+)?/,
    next: 'chain',
  },
  bool: {
    match: ['true', 'false'],
    next: 'chain',
  },
  identifier_expr: {
    match: patterns.identifierExpr,
    value: (text: string) => text.slice(1),
    next: 'chain',
  },
  link: {
    match: patterns.link,
    value: (text: string) => text.slice(1, -1),
  },
  call: {
    match: patterns.call,
    value: (text: string) => text.slice(1),
    next: 'chain',
  },
  template: {
    defaultType: 'ws',
    match: /(?=.)/,
    next: 'template',
  },
}

const chain: Rules = {
  ...ws,
  drill_arrow: {
    match: ['->', '=>'],
    next: 'expr',
  },
  fallback: {
    match: '?:',
    next: 'expr',
  },
  test: {
    match: '?',
    next: 'expr',
  },
  lsymbol: {
    match: /[{(]/,
    push: 'main',
  },
  squot: {
    match: `'`,
    push: 'str_s',
  },
  dquot: {
    match: '"',
    push: 'str_d',
  },
  complete: {
    defaultType: 'ws',
    match: /(?=.)/,
    next: 'main',
  },
}

const template = templateUntil(/\n|->|=>|\?:/, {
  interpTemplate: false,
  next: 'chain',
})

export const lexer = moo.states({
  $all: { err: moo.error },
  main,
  expr,
  template,
  chain,
  ...templateStates,
  ...requestStates,
})
