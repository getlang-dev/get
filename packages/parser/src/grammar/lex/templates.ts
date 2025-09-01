import { patterns } from './shared.js'

type UntilOptions = {
  prefix?: RegExp
  inclusive?: boolean
}

// creates a new regex that consumes characters until the
// `term` regex has been reached. the regex is multiline
export const until = (term: RegExp, opts: UntilOptions = {}) => {
  const prefix = opts.prefix ? opts.prefix.source : ''
  const finalGroup = opts.inclusive ? '?:' : '?='
  return new RegExp(
    `${prefix}[^]*?[^\\\\](${finalGroup}${term.source}|(?![^]))`,
  )
}

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

const stringS = {
  squot: {
    match: `'`,
    pop: 1,
  },
  ...templateUntil(/'/),
}

const stringD = {
  dquot: {
    match: '"',
    pop: 1,
  },
  ...templateUntil(/"/),
}

export const templateStates = {
  template: templateUntil(/\n|->|=>/, { interpTemplate: false }),
  interpExpr,
  interpTmpl,
  interpTmplParams,
  stringS,
  stringD,
}
