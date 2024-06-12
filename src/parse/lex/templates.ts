import { ws, identifier } from './shared'

type UntilOptions = {
  prefix?: RegExp
  inclusive?: boolean
}

// creates a new regex that consumes characters until the
// `term` regex has been reached. the regex is multiline
export const until = (term: RegExp, opts: UntilOptions = {}) => {
  const prefix = opts.prefix ? opts.prefix.source : ''
  const finalGroup = opts.inclusive ? '?:' : '?='
  return new RegExp(`${prefix}[^]*?[^\\\\](${finalGroup}${term.source})`)
}

export const templateUntil = (
  term: RegExp,
  interpSymbols = ['$'],
  next?: string
) => ({
  term: {
    defaultType: 'literal',
    match: new RegExp(`(?=\\s*(?:${term.source}))`),
    lineBreaks: true,
    ...(next ? { next } : { pop: 1 }),
  },
  interpexpr: {
    match: '${',
    push: 'interpExpr',
  },
  interpvar: {
    match: new RegExp(`[${interpSymbols.join('')}]\\w+`),
    value: (text: string) => text.slice(1),
  },
  literal: {
    match: until(
      new RegExp(`[${interpSymbols.join('')}]\\w|\\$|$|\\s*(?:${term.source})`)
    ),
    value: (text: string) => text.replace(/\s/g, ' ').replace(/\\(.)/g, '$1'),
    lineBreaks: true,
  },
})

// limited support for now, eventually to support expressions such as:
//    ${a + b}
export const interpExpr = {
  ws,
  identifier,
  rbrack: {
    match: '}',
    pop: 1,
  },
}
