import { invariant } from '@getlang/lib'
import { QuerySyntaxError } from '@getlang/lib/errors'
import { until } from './shared.js'

function literal(delim: RegExp) {
  return {
    match: until(delim, {
      prefix: delim,
      inclusive: true,
    }),
    value(text: string) {
      const inner = text.slice(1, -1)
      return inner
    },
  }
}

export function slice(delim: RegExp) {
  const tok = literal(delim)
  return {
    defaultType: 'slice',
    ...tok,
    lineBreaks: true,
    value(text: string) {
      const src = text.slice(1, -1).replace(/\\`/g, '`')
      let lines = src.split('\n')
      const firstIdx = lines.findIndex(x => x.trim().length)
      invariant(
        firstIdx !== -1,
        new QuerySyntaxError('Slice must contain source'),
      )
      lines = lines.slice(firstIdx)
      const indent = lines[0]?.match(/^\s*/)?.[0].length || 0
      if (indent) {
        lines = lines.map(x => x.replace(new RegExp(`^\\s{0,${indent}}`), ''))
      }
      return lines.join('\n').trim()
    },
  }
}

export const literals: moo.Rules = {}
