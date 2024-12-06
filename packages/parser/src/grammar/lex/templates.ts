import { identifier, ws } from './shared.js'

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
  const interpSymbols = interpParams ? ['$:'] : ['$']
  let interpTmplPush: string | undefined
  if (interpTemplate) {
    interpTmplPush = interpParams ? 'interpTmplParams' : 'interpTmpl'
  }

  return {
    term: {
      defaultType: 'literal',
      match: new RegExp(`(?=${term.source})`),
      lineBreaks: true,
      ...(next ? { next } : { pop: 1 }),
    },
    interpexpr: {
      match: '${',
      push: 'interpExpr',
    },
    ...(interpTmplPush
      ? {
          interptmpl: {
            match: '$[',
            push: interpTmplPush,
          },
        }
      : {}),
    interpvar: {
      match: new RegExp(`[${interpSymbols.join('')}]\\w+`),
      value: (text: string) => text.slice(1),
    },
    literal: {
      match: until(
        new RegExp(`[${interpSymbols.join('')}]\\w|\\$|${term.source}`),
      ),
      value: (text: string) => text.replace(/\\(.)/g, '$1').replace(/\s/g, ' '),
      lineBreaks: true,
    },
  }
}

// limited support for now, eventually to support expressions such as:
//    ${a + b}
export const interpExpr = {
  ws,
  identifier,
  rbrace: {
    match: '}',
    pop: 1,
  },
}

export const interpTmpl = {
  rbrack: {
    match: ']',
    pop: 1,
  },
  ...templateUntil(/]/),
}

export const interpTmplParams = {
  rbrack: {
    match: ']',
    pop: 1,
  },
  ...templateUntil(/]/, { interpParams: true }),
}
