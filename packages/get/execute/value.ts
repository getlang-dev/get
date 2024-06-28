import type { AnyHtmlNode } from 'domhandler'
import type { AnyNode as AnyJsNode } from 'acorn'
import type { CookieMap } from 'set-cookie-parser'

export class Value {
  constructor(
    public raw: any,
    public base: string | null,
  ) {}
}

export class StringValue extends Value {
  constructor(
    public override raw: string,
    base: string | null,
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

export class UndefinedValue extends Value {
  public override raw: undefined = undefined
  constructor(public selector: string) {
    super(undefined, null)
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
