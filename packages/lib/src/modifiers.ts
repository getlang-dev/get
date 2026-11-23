import type { ScalarType } from '@getlang/ast'
import { Type } from '@getlang/ast'
import type { Modifier, ModifierSpec } from '@getlang/lib'
import { invariant, NullSelection } from './core/errors'
import * as cookies from './values/cookies.js'
import * as html from './values/html.js'
import * as js from './values/js.js'
import * as json from './values/json.js'

const link: ModifierSpec = {
  modifier(context, options) {
    const { base } = options
    invariant(typeof base === 'string', '@link requires base url')

    let url = context
    if (options._raw instanceof html.Element) {
      const attr = html.selectXpath(
        options._raw,
        'self::a/@href | self::img/@src',
        false,
      )
      if (!(attr instanceof NullSelection)) {
        url = html.materialize(attr as any)
      }
    }
    invariant(typeof url === 'string', '@link context must be string')

    return new URL(url, base).toString()
  },
  useContext: true,
}

const parser = (modifier: Modifier, type: ScalarType['type']) => ({
  modifier,
  useContext: true,
  returnType: { type },
})

export const systemModifiers: Record<string, ModifierSpec> = {
  link,
  html: parser(html.parse, Type.Html),
  js: parser(js.parse, Type.Js),
  json: parser(json.parse, Type.Value),
  cookies: parser(cookies.parse, Type.Cookies),

  // replaced with plain selector on desugar
  headers: { modifier: () => {}, returnType: { type: Type.Headers } },
}
