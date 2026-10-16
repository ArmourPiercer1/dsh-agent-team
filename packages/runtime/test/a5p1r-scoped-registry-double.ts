/**
 * a5p1r-scoped-registry-double.ts — the PR1-residual round's registry double.
 *
 * WHY A SECOND DOUBLE. `a5p1-guard-install.test.ts` models the pinned Host's
 * SEAMS (which listener fires in which shape). The residual round's two findings
 * turn on facts that double does not carry, and it must not be retro-fitted to
 * them at the cost of the 23 tests already resting on it:
 *
 *  1. `tools.get(name)` WITH NO SCOPE is a real, public read — the GLOBAL layer's
 *     Definition — not an unavailable call (PR1's double answers `undefined`
 *     there, which is one reason the pre-assembly shadow case stayed invisible);
 *  2. the stage order is pre-execute → **guard** → execute → Body, with the
 *     Body's Definition resolved INSIDE the innermost step, after every listener
 *     this lane can reach.
 *
 * Both are read off the pinned source, `packages/core/tools/src/index.ts` at
 * `639ed01539` (the order is re-measured on the real registry by
 * `tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs`):
 *
 *   view(scope)            — inherited = the global layer, then each ancestor
 *                            layer ("a nearer scope's same-name entry shadows a
 *                            farther one, and the global layer is the farthest"),
 *                            restrictions applied to the INHERITED surface only;
 *                            then `own` LAST, "shadowing an inherited name and
 *                            outside the filter above".
 *   get(name, scope?)      — `view(scope).visible.get(name)`; "omitted = the
 *                            global view".
 *   prepareExecution       — `await ctx.waterfall(carrier, 'tools/pre-execute', …)`
 *                            and only then `this.guardReason(exec)`.
 *   dispatchScheduledExecution — `await ctx.waterfall(carrier, 'tools/execute', …)`.
 *   dispatchToolBody       — `this.resolveExecution(exec.name, exec.agent, …)`
 *                            immediately before `tool.execute(…)` — the LATE
 *                            resolution the R-b window is made of.
 *
 * So this double owns a global layer and an own layer, resolves exactly the way
 * `view()` does, and drives one call through the measured stage order with the
 * Body resolved at the innermost step. A scripted `swap` is a LEGAL
 * re-registration (a same-scope `register` of the same name) applied at one of
 * the three points where the real Host can interleave one.
 *
 * @module test/a5p1r-scoped-registry-double
 */
import type { ScopedGuardAgentCtx } from '../tool-dispatch/index.js'

interface FakeDefinition {
  readonly name: string
  readonly execute: () => Promise<unknown>
  /** Evidence only: which Body this row's `execute` is. */
  readonly identity: string
}

/**
 * Where a scripted re-registration lands, relative to the lane's own checks:
 *  - `pre-execute`          before the Guard stage (F2's own territory);
 *  - `execute-before-ours`  after the Guard stage, before the assembly's door;
 *  - `execute-after-ours`   after every listener the assembly registered — the
 *                           point no public seam can observe (the seam record).
 */
export type SwapStage = 'pre-execute' | 'execute-before-ours' | 'execute-after-ours'

export interface ScopedRegistryOptions {
  /** The GLOBAL layer at assembly time: what `tools.schemas()` with no scope lists. */
  readonly globalNames?: readonly string[]
  /** Identities the GLOBAL layer carries (default `NATIVE.<name>`). */
  readonly globalIdentity?: (name: string) => string
  /** Names this Agent's OWN layer contributes before assembly (the shadow case). */
  readonly ownNames?: readonly string[]
  /** Make `tools.get(name)` with no scope throw, as a Host without it would. */
  readonly globalGetThrows?: boolean
  /** Hide the global read entirely (a ctx whose global view is unreadable). */
  readonly withoutGlobalGet?: boolean
}

export interface RunCallInput {
  readonly callId: string
  readonly name: string
  /** `null` = an execution with no Agent identity at all. */
  readonly agentIdentity?: string | null
  readonly swap?: { readonly stage: SwapStage; readonly name: string; readonly identity: string }
  /** A deterministic fence parked inside the `tools/pre-execute` waterfall. */
  readonly parkInPreExecute?: { readonly signal: { readonly arrived: () => void }; readonly gate: Promise<void> }
}

export interface RunCallResult {
  readonly text: string
  /** Identities of the Bodies that actually ran, in order. */
  readonly bodies: readonly string[]
  readonly threw?: string
  readonly log: readonly string[]
}

export interface ScopedRegistryDouble {
  readonly ctx: ScopedGuardAgentCtx
  readonly guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[]
  readonly listeners: Map<string, ((...args: never[]) => unknown)[]>
  /** Register into the Agent's OWN layer — the sanctioned per-agent variant. */
  readonly registerOwn: (name: string, identity: string) => () => void
  /** Register into the GLOBAL layer — what a Host row contributes to everyone. */
  readonly registerGlobal: (name: string, identity: string) => () => void
  readonly runCall: (input: RunCallInput) => Promise<RunCallResult>
  /** Identity the AGENT scope resolves right now (evidence helper). */
  readonly agentResolution: (name: string) => string
  /** Identity the GLOBAL view resolves right now (evidence helper). */
  readonly globalResolution: (name: string) => string
}

export function scopedRegistryDouble(options: ScopedRegistryOptions = {}): ScopedRegistryDouble {
  const globalIdentity = options.globalIdentity ?? ((name: string) => `NATIVE.${name}`)
  const globalLayer = new Map<string, FakeDefinition>()
  const ownLayer = new Map<string, FakeDefinition>()
  const ran: string[] = []
  const log: string[] = []

  const definition = (name: string, identity: string): FakeDefinition => ({
    name,
    identity,
    execute: async () => {
      ran.push(identity)
      log.push(`body:${identity}`)
      return `ran:${name}@${identity}`
    },
  })
  for (const name of options.globalNames ?? []) globalLayer.set(name, definition(name, globalIdentity(name)))
  for (const name of options.ownNames ?? []) ownLayer.set(name, definition(name, `OWN.${name}`))

  const guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[] = []
  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()

  /** `view(scope)` of THIS agent: inherited global surface, own layer last. */
  const agentVisible = (): Map<string, FakeDefinition> => {
    const visible = new Map<string, FakeDefinition>(globalLayer)
    for (const [name, def] of ownLayer) visible.set(name, def)
    return visible
  }

  const tools = {
    guard: (guard: (exec: { name: string; agent?: unknown }) => string | undefined) => {
      guards.push(guard)
      return () => {
        const at = guards.indexOf(guard)
        if (at >= 0) guards.splice(at, 1)
      }
    },
    schemas: (scope?: unknown) => {
      if (scope === undefined) return [...globalLayer.keys()].map((name) => ({ name }))
      return [...agentVisible().keys()].map((name) => ({ name }))
    },
    get: (name: string, scope?: unknown) => {
      if (scope === undefined) {
        if (options.withoutGlobalGet === true) return undefined
        if (options.globalGetThrows === true) throw new Error('fixture: the global tool view is not readable on this Host')
        return globalLayer.get(name)
      }
      if (ownLayer.has(name)) return ownLayer.get(name)
      return globalLayer.get(name)
    },
  }

  const ctx = {
    tools,
    on: (event: string, listener: (...args: never[]) => unknown) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      return () => {
        const at = list.indexOf(listener)
        if (at >= 0) list.splice(at, 1)
      }
    },
  } as unknown as ScopedGuardAgentCtx

  const drive = (event: string, inner: () => Promise<unknown>, args: unknown[]): Promise<unknown> => {
    const list = [...(listeners.get(event) ?? [])]
    let index = 0
    const next = async (): Promise<unknown> => {
      const listener = list[index]
      index += 1
      if (listener === undefined) return await inner()
      return await (listener as unknown as (...a: unknown[]) => Promise<unknown>)(...args, next)
    }
    return next()
  }

  const reRegister = (name: string, identity: string): void => {
    // The ordinary path a plugin takes: the old registration is replaced by a
    // new Definition under the same name in the same scope.
    ownLayer.set(name, definition(name, identity))
    log.push(`legal-re-register:${identity}`)
  }

  const fire = async (event: string, exec: unknown, result: unknown): Promise<void> => {
    for (const listener of [...(listeners.get(event) ?? [])]) {
      await (listener as unknown as (...a: unknown[]) => unknown)(exec, result)
    }
  }

  const runCall = async (input: RunCallInput): Promise<RunCallResult> => {
    ran.length = 0
    log.length = 0
    const identity = input.agentIdentity === undefined ? 'agent-m1' : input.agentIdentity
    const exec = {
      callId: input.callId,
      name: input.name,
      ...(identity === null ? {} : { agent: { id: identity } }),
    }
    const swap = input.swap
    const applySwap = (stage: SwapStage): void => {
      if (swap !== undefined && swap.stage === stage) reRegister(swap.name, swap.identity)
    }
    /** The registry's innermost step: resolve, then call. Nothing in between. */
    const dispatchToolBody = async (): Promise<unknown> => {
      const def = ownLayer.get(input.name) ?? globalLayer.get(input.name)
      if (def === undefined) throw new Error(`unknown tool "${input.name}"`)
      log.push(`resolve:${def.identity}`)
      return await def.execute()
    }

    let result: unknown
    try {
      // 1 — `tools/pre-execute` waterfall (optional deterministic fence inside).
      await drive(
        'tools/pre-execute',
        async () => {
          if (input.parkInPreExecute !== undefined) {
            log.push('park:pre-execute')
            input.parkInPreExecute.signal.arrived()
            await input.parkInPreExecute.gate
            log.push('resume:pre-execute')
          }
          applySwap('pre-execute')
          return { kind: 'allow' as const }
        },
        [exec],
      )
      // 2 — the Guard stage, which the pinned registry reaches only AFTER
      // pre-execute, and which the assembly's Dispatcher answers per call.
      log.push('guard-stage')
      const denial = guards.reduce<string | undefined>(
        (acc, guardFn) => (acc !== undefined ? acc : guardFn(exec as { name: string; agent?: unknown })),
        undefined,
      )
      if (denial !== undefined) {
        const refused = { isError: true, text: denial }
        await drive('tools/post-execute', async () => refused, [exec, refused])
        await fire('tools/result', exec, refused)
        return { text: `Error: ${denial}`, bodies: [...ran], threw: denial, log: [...log] }
      }
      // 3 — `tools/execute` waterfall: a swap scripted `execute-before-ours`
      // lands before the waterfall (a plugin that mounted ahead of the Team row
      // would be the first listener; the point is that the assembly's door has
      // not read yet), and `execute-after-ours` after every listener.
      applySwap('execute-before-ours')
      result = await drive(
        'tools/execute',
        async () => {
          applySwap('execute-after-ours')
          return await dispatchToolBody()
        },
        [exec],
      )
    } catch (error) {
      result = { isError: true, text: String((error as Error)?.message ?? error) }
      await drive('tools/post-execute', async () => result, [exec, result])
      await fire('tools/result', exec, result)
      return {
        text: String((result as { text?: string }).text),
        bodies: [...ran],
        threw: String((error as Error)?.message ?? error),
        log: [...log],
      }
    }
    // 4 — the result edges, both AFTER the Body returned (measured).
    await drive('tools/post-execute', async () => result, [exec, result])
    await fire('tools/result', exec, result)
    return {
      text: String((result as { text?: string })?.text ?? JSON.stringify(result ?? null)),
      bodies: [...ran],
      log: [...log],
    }
  }

  const registerOwn = (name: string, identity: string): (() => void) => {
    ownLayer.set(name, definition(name, identity))
    return () => {
      if (ownLayer.get(name)?.identity === identity) ownLayer.delete(name)
    }
  }
  const registerGlobal = (name: string, identity: string): (() => void) => {
    globalLayer.set(name, definition(name, identity))
    return () => {
      if (globalLayer.get(name)?.identity === identity) globalLayer.delete(name)
    }
  }

  return {
    ctx,
    guards,
    listeners,
    registerOwn,
    registerGlobal,
    runCall,
    agentResolution: (name) => (ownLayer.get(name) ?? globalLayer.get(name))?.identity ?? 'UNKNOWN',
    globalResolution: (name) => globalLayer.get(name)?.identity ?? 'UNKNOWN',
  }
}
