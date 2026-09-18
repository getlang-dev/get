// Generated from packages/parser/src/grammar/lexer.ts and getlang.ne.
// Monarch is line-oriented, so this mirrors the lexer states where that
// maps cleanly and uses pragmatic fallbacks for expression highlighting.

const identifier = /[a-zA-Z_]\w*/

export const getlangLanguageId = 'getlang'

export const getlangMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.getlang',

  brackets: [
    { open: '{', close: '}', token: 'delimiter.curly' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
  ],

  keywords: ['inputs', 'set', 'extract'],
  requestVerbs: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'],
  requestBlocks: ['query', 'cookies', 'json', 'form'],

  tokenizer: {
    root: [
      { include: '@whitespace' },
      [
        /\b(?:GET|PUT|POST|PATCH|DELETE)\b/,
        { token: 'keyword.control.http', next: '@requrl' },
      ],
      [/\b(?:inputs|set|extract)\b/, 'keyword'],
      [/\b(?:true|false)\b/, 'constant.language.boolean'],
      [/\d+(?:\.\d+)?\b/, 'number'],
      [/@[a-zA-Z_]\w*\)/, 'type.identifier'],
      [/@[a-zA-Z_]\w*/, 'predefined'],
      [/\$(?:[a-zA-Z_]\w*)?/, 'variable'],
      [/\?:|->|=>/, 'operator'],
      [/[=:@?,]/, 'operator'],
      [/[{}()]/, '@brackets'],
      [/'/, { token: 'string.quote', next: '@strSingle' }],
      [/"/, { token: 'string.quote', next: '@strDouble' }],
      [/`/, { token: 'string.quote', next: '@sliceBacktick' }],
      [/\|/, { token: 'string.quote', next: '@slicePipe' }],
      [identifier, 'identifier'],
    ],

    whitespace: [
      [/[ \t\r\f\v]+/, 'white'],
      [/--.*$/, 'comment'],
    ],

    requrl: [
      { include: '@templateWithParams' },
      [/$/, { token: '', next: '@req' }],
    ],

    req: [
      [/^\s*$/, { token: 'white', next: '@root' }],
      [/^\s*\[body\]\s*$/, { token: 'keyword.control.block', next: '@reqbody' }],
      [/^\s*\[(?:query|cookies|json|form)\]\s*$/, 'keyword.control.block'],
      { include: '@whitespace' },
      [/:/, 'operator'],
      { include: '@template' },
      [/[{}()]/, '@brackets'],
      [/$/, { token: '', next: '@req' }],
    ],

    reqbody: [
      [/^\s*\[\/body\]\s*$/, { token: 'keyword.control.block', next: '@req' }],
      { include: '@template' },
      [/$/, { token: 'string', next: '@reqbody' }],
    ],

    strSingle: [
      [/\\./, 'string.escape'],
      [/\$\{[^}]*\}/, 'variable'],
      [/\$\[[^\]]*\]/, 'variable'],
      [/\$[a-zA-Z_]\w*/, 'variable'],
      [/'/, { token: 'string.quote', next: '@root' }],
      [/[^\\$']+/, 'string'],
      [/\$/, 'string'],
    ],

    strDouble: [
      [/\\./, 'string.escape'],
      [/\$\{[^}]*\}/, 'variable'],
      [/\$\[[^\]]*\]/, 'variable'],
      [/\$[a-zA-Z_]\w*/, 'variable'],
      [/"/, { token: 'string.quote', next: '@root' }],
      [/[^\\$"]+/, 'string'],
      [/\$/, 'string'],
    ],

    sliceBacktick: [
      [/\\`/, 'string.escape'],
      [/\$\{[^}]*\}/, 'variable'],
      [/\$\[[^\]]*\]/, 'variable'],
      [/\$[a-zA-Z_]\w*/, 'variable'],
      [/`/, { token: 'string.quote', next: '@root' }],
      [/[^$`\\]+/, 'string'],
      [/[$\\]/, 'string'],
    ],

    slicePipe: [
      [/\$\{[^}]*\}/, 'variable'],
      [/\$\[[^\]]*\]/, 'variable'],
      [/\$[a-zA-Z_]\w*/, 'variable'],
      [/\|/, { token: 'string.quote', next: '@root' }],
      [/[^$|]+/, 'string'],
      [/[$]/, 'string'],
    ],

    template: [
      [/\$\{[^}]*\}/, 'variable'],
      [/\$\[[^\]]*\]/, 'variable'],
      [/\$[a-zA-Z_]\w*/, 'variable'],
      [ /:[a-zA-Z_]\w*/, 'variable.parameter' ],
      [/->|=>|\?:/, 'operator'],
      [/[^$:>|=?-]+/, 'string'],
      [/[$:>|=?-]/, 'string'],
    ],

    templateWithParams: [
      [/\$\{[^}]*\}/, 'variable'],
      [/\$\[[^\]]*\]/, 'variable'],
      [/\$[a-zA-Z_]\w*/, 'variable'],
      [/:[a-zA-Z_]\w*/, 'variable.parameter'],
      [/[^$:]+/, 'string'],
      [/[$:]/, 'string'],
    ],
  },
}

export default getlangMonarchLanguage
