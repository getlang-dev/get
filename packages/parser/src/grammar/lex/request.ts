import { templateUntil } from './templates.js'

const requestBlockNames = ['query', 'cookies', 'json', 'form']

const req = {
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
    push: 'reqbody',
  },
  start_of_line_incl_ws: {
    defaultType: 'ws',
    match: /^\s*(?=.)/,
    push: 'reqkey',
  },
  colon: ':',
  ws: {
    match: ' ',
    push: 'reqval',
  },
}

export const requestStates = {
  req,
  requrl: templateUntil(/\n/, { interpParams: true, next: 'req' }),
  reqkey: templateUntil(/:/),
  reqval: templateUntil(/\n/),
  reqbody: templateUntil(/\n[^\S\r\n]*\[\/body\]/),
}
