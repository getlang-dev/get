import { patterns, until } from './shared.js'

type TemplateUntilOptions = {
  interpTemplate?: boolean
  interpParams?: boolean
  next?: string
}

export const templateUntil = (
  term: RegExp,
  opts: TemplateUntilOptions = {},
) => {
  const { interpTemplate = true, interpParams = false, next } = opts
  const interpSymbols = ['$']
  if (interpParams) {
    interpSymbols.push(':')
  }

  return {
    term: {
      defaultType: 'str',
      match: new RegExp(`(?=${term.source})`),
      lineBreaks: true,
      ...(next ? { next } : { pop: 1 }),
    },
    interpexpr: {
      match: '${',
      push: 'interpExpr',
    },
    ...(interpTemplate
      ? {
          interptmpl: {
            match: '$[',
            push: interpParams ? 'interpTmplParams' : 'interpTmpl',
          },
        }
      : {}),
    interpvar: {
      match: new RegExp(
        `[${interpSymbols.join('')}]${patterns.identifier.source}`,
      ),
      value: (text: string) => text.slice(1),
    },
    str: {
      match: until(new RegExp(`[${interpSymbols.join('')}]|${term.source}`)),
      value: (text: string) => text.replace(/\\(.)/g, '$1').replace(/\s/g, ' '),
      lineBreaks: true,
    },
  }
}

// limited support for now, eventually to support expressions such as:
//    ${a + b}
const interpExpr = {
  ws: patterns.ws,
  identifier: patterns.identifier,
  rbrace: {
    match: '}',
    pop: 1,
  },
}

const interpTmpl = {
  rbrack: {
    match: ']',
    pop: 1,
  },
  ...templateUntil(/]/),
}

const interpTmplParams = {
  rbrack: {
    match: ']',
    pop: 1,
  },
  ...templateUntil(/]/, { interpParams: true }),
}

const str_s = {
  squot: {
    match: `'`,
    pop: 1,
  },
  ...templateUntil(/'/),
}

const str_d = {
  dquot: {
    match: '"',
    pop: 1,
  },
  ...templateUntil(/"/),
}

export const templateStates = {
  interpExpr,
  interpTmpl,
  interpTmplParams,
  str_s,
  str_d,
}
