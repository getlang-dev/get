import { invariant } from '@getlang/lib'

export type Stage<Result = unknown> = () => Promise<Result>
export type Factory = (...args: any[]) => Node
export type Node = { [name: string]: Stage | Factory | Node }
export type Artifacts = {
  [name: string]: Artifacts | { value: unknown } | { error: unknown }
}
type RecordArtifact = (entry: Artifacts[string]) => void
type CachedCall = { value: Node } | { error: unknown }
const tree = (): Artifacts => Object.create(null)

type FactoryOptions<Args extends any[] = any[]> = Partial<{
  keyBy: (...args: Args) => string
}>
const factories = new WeakMap<Factory, Required<FactoryOptions>>()
function keyFromArg(key: unknown) {
  invariant(typeof key === 'string', 'Factory keys must be strings')
  return key as string
}
export function factory<F extends Factory>(
  fn: F,
  options: FactoryOptions<Parameters<F>> = {},
): F {
  const { keyBy = keyFromArg } = options
  factories.set(fn, { keyBy })
  return fn
}

export function memodag<T extends Node>(dag: T) {
  function wrapNode<T extends Node>(
    node: T,
  ): { graph: T; artifacts: Artifacts } {
    const artifacts = tree()
    const receiver: Node = { ...node }
    for (const [key, value] of Object.entries(node)) {
      if (factories.has(value as any)) {
        const calls = tree()
        artifacts[key] = calls
        receiver[key] = wrapFactory(value as Factory, calls)
      } else if (typeof value === 'function') {
        artifacts[key] = tree()
        receiver[key] = wrapStage(value as Stage, entry => {
          artifacts[key] = entry
        })
      } else {
        const child = wrapNode(value)
        receiver[key] = child.graph
        artifacts[key] = child.artifacts
      }
    }
    return { graph: receiver as T, artifacts }
  }

  function wrapStage(fn: Stage, record: RecordArtifact): Stage {
    let task: Promise<unknown> | undefined
    return function (this: unknown) {
      if (!task) {
        try {
          task = Promise.resolve(fn.call(this)).then(
            value => {
              record({ value })
              return value
            },
            error => {
              record({ error })
              throw error
            },
          )
        } catch (error) {
          record({ error })
          task = Promise.reject(error)
        }
      }
      return task
    }
  }

  function wrapFactory(fn: Factory, artifacts: Artifacts): Factory {
    const options = factories.get(fn)!
    const calls = new Map<string, CachedCall>()
    return function (this: unknown, ...args: any[]) {
      const key = options.keyBy(...args)
      invariant(typeof key === 'string', 'Factory keys must be strings')
      if (!calls.has(key)) {
        try {
          const child = wrapNode(fn.apply(this, args))
          artifacts[key] = child.artifacts
          calls.set(key, { value: child.graph })
        } catch (error) {
          artifacts[key] = { error }
          calls.set(key, { error })
        }
      }
      const cached = calls.get(key)!
      if ('error' in cached) {
        throw cached.error
      }
      return cached.value
    }
  }

  return wrapNode(dag)
}
