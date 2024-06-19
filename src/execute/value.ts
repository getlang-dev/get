import type { AnyHtmlNode } from 'domhandler'
import type { AnyNode as AnyJsNode } from 'acorn'
import type { CookieMap } from 'set-cookie-parser'

export class Value {
  constructor(
    public raw: any,
    public base: string | null
  ) {}

  get hasUndefined(): boolean {
    return this instanceof String && this._hasUndefined
  }
}

export class String extends Value {
  constructor(
    public override raw: string,
    base: string | null,
    public _hasUndefined = false
  ) {
    super(raw, base)
  }
}

export class Html extends Value {
  constructor(
    public override raw: AnyHtmlNode,
    base: string | null
  ) {
    super(raw, base)
  }
}

export class Js extends Value {
  constructor(
    public override raw: AnyJsNode,
    base: string | null
  ) {
    super(raw, base)
  }
}

export class Headers extends Value {
  constructor(
    public override raw: globalThis.Headers,
    base: string | null
  ) {
    super(raw, base)
  }
}

export class CookieSet extends Value {
  constructor(
    public override raw: CookieMap,
    base: string | null
  ) {
    super(raw, base)
  }
}

export class Null extends Value {
  public override raw: null = null
  constructor(public selector: string) {
    super(null, null)
  }
}

export class List<T extends Value> extends Value {
  constructor(
    public override raw: T[],
    base: string | null
  ) {
    super(raw, base)
  }
}
