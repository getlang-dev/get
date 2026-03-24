const id = /[a-zA-Z_]\w*/

export const patterns = {
  ws: /[ \t\r\f\v]+/,
  identifier: id,
  identifierExpr: new RegExp(`\\$(?:${id.source})?`),
  link: new RegExp(`\\@${id.source}\\)`),
  call: new RegExp(`\\@${id.source}`),
}

export const ws = {
  ws: patterns.ws,
  nl: {
    match: /\n/,
    lineBreaks: true,
  },
  comment: /--.*/,
}

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
