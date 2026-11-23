import { describe, expect, mock, test } from 'bun:test'
import { factory, memodag } from '@getlang/get'
import { createRegistry } from '../packages/get/src/registry/index.ts'
import { execute } from './helpers.js'

describe('INBOX', () => {
  // Ordered by priority (1 = highest); enable each test when tackling its fix.
  // Priority 1: Prevents cache-key corruption and incorrect results across registrations.
  test.skip('a second factory registration should not overwrite the first keyBy', async () => {
    const child = (key: string) => ({ read: async () => key })
    const byKey = factory(child)
    const constant = factory(child, { keyBy: () => 'same' })
    const { graph } = memodag({ byKey, constant })

    expect(await graph.byKey('a').read()).toBe('a')
    expect(await graph.byKey('b').read()).toBe('b')
  })

  // Priority 2: Fixes a runtime API failure that TypeScript currently accepts.
  test.skip('an accepted unregistered factory should return the declared node', async () => {
    const { graph } = memodag({
      child: (key: string) => ({ read: async () => key }),
    })

    // TypeScript permits this call, but child() returns a Promise at runtime.
    expect(await graph.child('a').read()).toBe('a')
  })

  // Priority 3: Restores basic call-site context inference for macros.
  test.skip('macro selects HTML from a struct context', async () => {
    const result = await execute({
      Home: `
      set obj = { nested: "<p>hello</p>" -> @html }
      extract $obj -> @Pick -> p
    `,
      Pick: 'extract nested',
    })

    expect(result).toEqual('hello')
  })

  // Priority 4: Ensures inferred macro types stay isolated across call sites.
  test.skip('same macro selects fields with different types at different call sites', async () => {
    const result = await execute({
      Home: `
      set html = { nested: "<p>hello</p>" -> @html }
      set plain = { nested: "world" }
      extract {
        html: $html -> @Pick -> p
        plain: $plain -> @Pick
      }
    `,
      Pick: 'extract nested',
    })

    expect(result).toEqual({ html: 'hello', plain: 'world' })
  })

  // Priority 5: Preserves cached instance identity after concurrent root inference.
  test.skip('registry should reuse the same shared instance after concurrent root inference', async () => {
    const modules: Record<string, string> = {
      A: 'extract @Shared',
      B: 'extract @Shared',
      Shared: 'extract "hello"',
    }
    const registry = createRegistry({ import: name => modules[name] })
    const [a, b] = await Promise.all([
      registry.importInstance('A').types(),
      registry.importInstance('B').types(),
    ])

    expect(a.returnType).toEqual(b.returnType)
    expect(registry.importInstance('Shared')).toBe(
      registry.importInstance('Shared'),
    )
  })

  // Priority 6: Avoids duplicate stage execution through aliases of the same node.
  test.skip('a stage on a shared node should run only once', async () => {
    const shared = { read: mock(async () => 'result') }
    const { graph } = memodag({ left: shared, right: shared })

    await graph.left.read()
    await graph.right.read()
    expect(shared.read).toHaveBeenCalledTimes(1)
  })
})
