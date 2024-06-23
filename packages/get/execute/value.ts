import type { AnyHtmlNode } from 'domhandler'
import type { AnyNode as AnyJsNode } from 'acorn'
import type { CookieMap } from 'set-cookie-parser'

export class Value {
  constructor(
    public raw: any,
    public base: string | null,
  ) {}

  get hasUndefined(): boolean {
    return this instanceof StringValue && this._hasUndefined
  }
}

export class StringValue extends Value {
  constructor(
    public override raw: string,
    base: string | null,
    public _hasUndefined = false,
  ) {
    super(raw, base)
  }
}

export class HtmlValue extends Value {
  constructor(
    public override raw: AnyHtmlNode,
    base: string | null,
  ) {
    super(raw, base)
  }
}

export class JsValue extends Value {
  constructor(
    public override raw: AnyJsNode,
    base: string | null,
  ) {
    super(raw, base)
  }
}

export class HeadersValue extends Value {
  constructor(
    public override raw: Headers,
    base: string | null,
  ) {
    super(raw, base)
  }
}

export class CookieSetValue extends Value {
  constructor(
    public override raw: CookieMap,
    base: string | null,
  ) {
    super(raw, base)
  }
}

export class NullValue extends Value {
  public override raw: null = null
  constructor(public selector: string) {
    super(null, null)
  }
}

export class ListValue<T extends Value> extends Value {
  constructor(
    public override raw: T[],
    base: string | null,
  ) {
    super(raw, base)
  }
}
