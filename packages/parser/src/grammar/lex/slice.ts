import { invariant } from '@getlang/lib'
import { QuerySyntaxError } from '@getlang/lib/errors'
import { until } from './templates.js'

const getSliceValue = (text: string) => {
  const src = text.slice(1, -1).replace(/\\`/g, '`')
  let lines = src.split('\n')
  const firstIdx = lines.findIndex(x => x.trim().length)
  invariant(firstIdx !== -1, new QuerySyntaxError('Slice must contain source'))
  lines = lines.slice(firstIdx)
  const indent = lines[0]?.match(/^\s*/)?.[0].length || 0
  if (indent) {
    lines = lines.map(x => x.replace(new RegExp(`^\\s{0,${indent}}`), ''))
  }
  return lines.join('\n').trim()
}

export const slice_block = {
  defaultType: 'slice',
  match: until(/\|/, {
    prefix: /\|/,
    inclusive: true,
  }),
  lineBreaks: true,
  value: getSliceValue,
  pop: 1,
}

export const slice = {
  match: until(/`/, {
    prefix: /`/,
    inclusive: true,
  }),
  lineBreaks: true,
  value: getSliceValue,
  pop: 1,
}
