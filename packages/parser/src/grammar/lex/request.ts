import { templateUntil } from './templates.js'

const requestBlockNames = ['query', 'cookies', 'json', 'form']

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

export const requestStates = {
  request,
  requestUrl: templateUntil(/\n/, { interpParams: true, next: 'request' }),
  requestKey: templateUntil(/:/),
  requestValue: templateUntil(/\n/),
  requestBody: templateUntil(/\n[^\S\r\n]*\[\/body\]/),
}
