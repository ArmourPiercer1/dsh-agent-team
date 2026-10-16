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
 * So this double owns a global layer and one OWN layer PER AGENT SCOPE, resolves
 * exactly the way `view()` does, and drives one call through the measured stage
 * order with the Body resolved at the innermost step. A scripted `swap` is a
 * LEGAL re-registration (a same-scope `register` of the same name) applied at one
 * of the three points where the real Host can interleave one — and, like the real
 * registry, every registration change emits `tools/change` SYNCHRONOUSLY
 * (`index.ts:835` `() => { this.ctx.emit('tools/change') }`), which is what makes
 * the abort race in the B3 tests a measured race rather than a scripted one.
 *
 * THE SIGNAL HALF (B3 = "cancel the related un-executed calls"). The pinned
 * `dispatchToolBody` is the only place the Host refuses a Body on a signal, and
 * its shape is reproduced here line for line, because the difference between
 * "cancelled" and "terminated" is decided by it:
 *
 *   1568  const wrapperSignal = exec.signal        // what a WRAPPER installed
 *   1569  const fused = fuseToolSignals(state.callerSignal, wrapperSignal)
 *   1572  if (isAborted(fused)) return toolAbortedBeforeDispatchResult()
 *   1573  exec.signal = signal                     // caller signal re-fused
 *   1578  const tool = this.resolveExecution(…)    // ← the Body's Definition
 *   1580  state.bodyInvoked = true
 *   1581  const returned = await tool.execute(…)
 *   1583  return isAborted(signal) ? toolAbortedResult(result) : result
 *
 * So: an aborted signal is checked BEFORE `resolveExecution` — a Body that was
 * never resolved can never run, and the Host says so with its OWN distinct shape
 * (`ABORTED_BEFORE_DISPATCH`, `bodyInvoked` still false), while a signal raised
 * after the Body started yields `ABORTED` with the Body's own result preserved
 * (`:1550-1556`, `:1958-1982`). The caller's signal is kept SEPARATE from
 * `exec.signal` here exactly as the registry keeps it in `state.callerSignal`:
 * a wrapper replacement cannot detach it (contract, `index.ts:155-159`).
 *
 * @module test/a5p1r-scoped-registry-double
 */
import type { ScopedGuardAgentCtx } from '../tool-dispatch/index.js'

interface FakeDefinition {
  readonly name: string
  /** The pinned call site is `tool.execute(exec.arguments, exec)` (`:1581`). */
  readonly execute: (args: unknown, exec: unknown) => Promise<unknown>
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
  /**
   * The Agent scope a single-scope test means, so `registerOwn(name, identity)`
   * without a scope lands where the test's own assembly looks. Default `s-m1`.
   */
  readonly defaultScope?: string
  /** Extra Agent scopes that exist BEFORE assembly (the cross-Agent isolation arm). */
  readonly otherScopes?: readonly string[]
}

export interface RunCallInput {
  readonly callId: string
  readonly name: string
  /** `null` = an execution with no Agent identity at all. */
  readonly agentIdentity?: string | null
  readonly swap?: {
    readonly stage: SwapStage
    readonly name: string
    readonly identity: string
    /** Which Agent scope performs the legal re-registration (default: this one). */
    readonly scope?: string
  }
  /** The CALLER's cancellation, held by the registry outside `exec.signal` (`state.callerSignal`). */
  readonly callerSignal?: AbortSignal
  /** Raise the caller's cancellation at this point, before the Host reaches the Body. */
  readonly cancelCallerAt?: SwapStage | 'guard' | 'inside-body'
  /** How to raise it. The controller belongs to the CALLER, not to the double. */
  readonly raiseCaller?: () => void
  /**
   * Something legal happens WHILE THE BODY IS RUNNING — the only way to measure
   * the difference between a call that was cancelled before its Body and one that
   * was merely terminated after its side effect. The registry checks the fused
   * signal again AFTER `execute()` returns (`:1583`), so what this returns and
   * what the caller sees are different objects, and the lane must not conflate
   * them.
   */
  readonly whileBodyRuns?: () => void | Promise<void>
  /**
   * A `tools/post-execute` policy that REWRITES the outcome. That edge really is
   * a waterfall whose value is the decision (`:176`), so a later listener can
   * replace what `tools/result` finally carries — including replacing it with
   * something that no longer states which failure it was.
   */
  readonly postExecuteReplaces?: unknown
  /** A deterministic fence parked inside the `tools/pre-execute` waterfall. */
  readonly parkInPreExecute?: { readonly signal: { readonly arrived: () => void }; readonly gate: Promise<void> }
}

export interface RunCallResult {
  readonly text: string
  /** Identities of the Bodies that actually ran, in order. */
  readonly bodies: readonly string[]
  readonly threw?: string
  readonly log: readonly string[]
  /**
   * The Host's own two cancellation shapes, reported as it reports them:
   * `ABORTED_BEFORE_DISPATCH` (nothing was resolved or invoked) / `ABORTED` (the
   * Body started; its own result is preserved) / undefined (an ordinary result).
   */
  readonly code?: string
  /** Whether the Host had set `bodyInvoked` (`:1580`) — the cancel/terminate line. */
  readonly bodyInvoked?: boolean
}

export interface ScopedRegistryDouble {
  readonly ctx: ScopedGuardAgentCtx
  /** A SECOND Agent's own ctx: its listeners see only its own calls. */
  readonly ctxFor: (scope: string) => ScopedGuardAgentCtx
  readonly guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[]
  readonly listeners: Map<string, ((...args: never[]) => unknown)[]>
  /** Register into an Agent's OWN layer — the sanctioned per-agent variant. */
  readonly registerOwn: (name: string, identity: string, scope?: string) => () => void
  /** Register into the GLOBAL layer — what a Host row contributes to everyone. */
  readonly registerGlobal: (name: string, identity: string) => () => void
  /** Drop one name from one Agent's own layer (an MCP teardown of its own row). */
  readonly unregisterOwn: (name: string, scope?: string) => void
  /** The whole-generation dispose+register batch MCP `syncTools` performs. */
  readonly mcpResync: (scope: string | undefined, next: readonly { name: string; identity: string }[]) => void
  readonly runCall: (input: RunCallInput) => Promise<RunCallResult>
  /** The names one Agent's OWN layer carries (evidence helper). */
  readonly layerOf: (scope?: string) => readonly string[]
  /** Identity the AGENT scope resolves right now (evidence helper). */
  readonly agentResolution: (name: string, scope?: string) => string
  /** Identity the GLOBAL view resolves right now (evidence helper). */
  readonly globalResolution: (name: string) => string
}

export function scopedRegistryDouble(options: ScopedRegistryOptions = {}): ScopedRegistryDouble {
  const globalIdentity = options.globalIdentity ?? ((name: string) => `NATIVE.${name}`)
  const defaultScope = options.defaultScope ?? 'agent-m1'
  const globalLayer = new Map<string, FakeDefinition>()
  /** One OWN layer per Agent scope: `view(scope)` is per-scope, and so is a shadow. */
  const ownLayers = new Map<string, Map<string, FakeDefinition>>()
  const ran: string[] = []
  const log: string[] = []

  const layerOf = (scope: string): Map<string, FakeDefinition> => {
    let layer = ownLayers.get(scope)
    if (layer === undefined) {
      layer = new Map<string, FakeDefinition>()
      ownLayers.set(scope, layer)
    }
    return layer
  }
  for (const scope of [defaultScope, ...(options.otherScopes ?? [])]) layerOf(scope)

  /**
   * Bodies record into the EXEC they were handed (`tool.execute(exec.arguments,
   * exec)`), not into a run-level array: concurrent calls sharing one evidence
   * array is how a matrix test ends up crediting one call with another's Body.
   */
  const definition = (name: string, identity: string): FakeDefinition => ({
    name,
    identity,
    execute: async (_args: unknown, exec: unknown) => {
      const sink = exec as { __bodies?: string[]; __log?: string[] } | undefined
      ;(sink?.__bodies ?? ran).push(identity)
      ;(sink?.__log ?? log).push(`body:${identity}`)
      return `ran:${name}@${identity}`
    },
  })
  for (const name of options.globalNames ?? []) globalLayer.set(name, definition(name, globalIdentity(name)))
  for (const name of options.ownNames ?? []) layerOf(defaultScope).set(name, definition(name, `OWN.${name}`))

  const guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[] = []
  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()

  /** Which OWN layer a scope argument names. `{ id }` is how the lane calls it. */
  const scopeKey = (scope: unknown): string =>
    typeof scope === 'string' ? scope : String((scope as { id?: unknown })?.id ?? defaultScope)

  /** `view(scope)` of one Agent: the inherited global surface, own layer last. */
  const agentVisible = (scope: string): Map<string, FakeDefinition> => {
    const visible = new Map<string, FakeDefinition>(globalLayer)
    for (const [name, def] of layerOf(scope)) visible.set(name, def)
    return visible
  }

  /**
   * `tools/change`, fired SYNCHRONOUSLY like the pinned registry does it
   * (`index.ts:835`). The event carries NO arguments and is NOT scope-filtered
   * (`:203-206` "an UNFILTERED registry-subject notification"), so a lane that
   * reacts to it must do its own (scope, name) filtering — which is precisely
   * what the isolation matrix measures.
   */
  const emitChange = (): void => {
    for (const listener of forScope('tools/change', defaultScope)) {
      try {
        ;(listener as unknown as () => unknown)()
      } catch {
        // A listener that throws is not the registry's problem; the real
        // emitter does not abort the registration either.
      }
    }
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
      return [...agentVisible(scopeKey(scope)).keys()].map((name) => ({ name }))
    },
    get: (name: string, scope?: unknown) => {
      if (scope === undefined) {
        if (options.withoutGlobalGet === true) return undefined
        if (options.globalGetThrows === true) throw new Error('fixture: the global tool view is not readable on this Host')
        return globalLayer.get(name)
      }
      const own = layerOf(scopeKey(scope))
      if (own.has(name)) return own.get(name)
      return globalLayer.get(name)
    },
  }

  /**
   * WHICH ctx subscribed is not decoration. The pinned registry dispatches the
   * tool-call events through the execution's own scope (`scopeTarget(this,
   * exec.agent)`, and the event declarations say "Scope-filtered dispatch …
   * keyed by `exec.agent`"), while `tools/change` is the one channel that is
   * deliberately NOT filtered. So a listener mounted by Agent A's ctx must not
   * run for Agent B's call — and the change notification must run for everyone.
   * A listener with no tag at all is a Host-carrier listener: it sees every call,
   * which is what a row mounted outside any Agent does.
   */
  const listenerScope = new Map<(...args: never[]) => unknown, string | undefined>()
  const ctxFor = (tag: string): ScopedGuardAgentCtx =>
    ({
      tools,
      on: (event: string, listener: (...args: never[]) => unknown) => {
        const list = listeners.get(event) ?? []
        list.push(listener)
        listeners.set(event, list)
        listenerScope.set(listener, tag)
        return () => {
          const at = list.indexOf(listener)
          if (at >= 0) list.splice(at, 1)
          listenerScope.delete(listener)
        }
      },
    }) as unknown as ScopedGuardAgentCtx
  const ctx = ctxFor(defaultScope)

  const forScope = (event: string, scope: string): ((...args: never[]) => unknown)[] =>
    [...(listeners.get(event) ?? [])].filter((listener) => {
      const tag = listenerScope.get(listener)
      // `tools/change` is the unfiltered channel: everyone subscribed sees it.
      return event === 'tools/change' || tag === undefined || tag === scope
    })

  const drive = (event: string, scope: string, inner: () => Promise<unknown>, args: unknown[]): Promise<unknown> => {
    const list = forScope(event, scope)
    let index = 0
    const next = async (): Promise<unknown> => {
      const listener = list[index]
      index += 1
      if (listener === undefined) return await inner()
      return await (listener as unknown as (...a: unknown[]) => Promise<unknown>)(...args, next)
    }
    return next()
  }

  /** The ordinary path a plugin takes: replace the Definition under the same name. */
  const reRegister = (name: string, identity: string, scope: string): void => {
    layerOf(scope).set(name, definition(name, identity))
    log.push(`legal-re-register:${identity}@${scope}`)
    emitChange()
  }

  const fire = async (event: string, scope: string, exec: unknown, result: unknown): Promise<void> => {
    for (const listener of forScope(event, scope)) {
      await (listener as unknown as (...a: unknown[]) => unknown)(exec, result)
    }
  }

  /** The Host's two cancellation shapes (`:1958-1982`), as the Host returns them. */
  // Exactly the two objects the Host builds at `:1958-1982`: the code lives at
  // `error.info.code`, which is also what reaches the durable session log.
  const abortedBeforeDispatch = (): unknown => ({
    isError: true,
    content: [{ type: 'text', text: 'Error: tool call aborted before dispatch' }],
    error: { message: 'tool call aborted before dispatch', info: { name: 'AbortError', code: 'ABORTED_BEFORE_DISPATCH' } },
  })
  const abortedAfterBody = (prior: unknown): unknown => ({
    isError: true,
    content: [{ type: 'text', text: 'Error: tool call aborted' }],
    value: (prior as { value?: unknown })?.value,
    error: { message: 'tool call aborted', info: { name: 'AbortError', code: 'ABORTED' } },
  })

  const outcomeCode = (result: unknown): string | undefined =>
    (result as { error?: { info?: { code?: unknown } } } | null | undefined)?.error?.info?.code === undefined
      ? (result as { code?: string } | null | undefined)?.code
      : String((result as { error: { info: { code: unknown } } }).error.info.code)

  const runCall = async (input: RunCallInput): Promise<RunCallResult> => {
    const bodies: string[] = []
    const callLog: string[] = []
    /** Log into THIS call's record; fall back to the shared one outside a call. */
    const note = (message: string): void => {
      callLog.push(message)
    }
    const identity = input.agentIdentity === undefined ? 'agent-m1' : input.agentIdentity
    const scope = scopeKey({ id: identity })
    const exec: Record<string, unknown> = {
      callId: input.callId,
      name: input.name,
      __bodies: bodies,
      __log: callLog,
      ...(identity === null ? {} : { agent: { id: identity } }),
      // What the wrapper chain may replace. The CALLER's signal lives outside it,
      // in the registry's own state — a wrapper cannot detach it.
      signal: new AbortController().signal,
    }
    const caller = input.callerSignal
    const swap = input.swap
    let bodyInvoked = false
    const raiseCaller = (stage: SwapStage | 'guard' | 'inside-body'): void => {
      if (input.cancelCallerAt !== stage) return
      note(`caller-cancel:raised:${stage}`)
      input.raiseCaller?.()
    }
    const applySwap = (stage: SwapStage): void => {
      if (swap !== undefined && swap.stage === stage) reRegister(swap.name, swap.identity, swap.scope ?? scope)
      raiseCaller(stage)
    }
    /** The registry's innermost step: fuse, check, resolve, call. Nothing in between. */
    const dispatchToolBody = async (): Promise<unknown> => {
      const wrapperSignal = exec.signal as AbortSignal | undefined
      const raised = (): boolean => wrapperSignal?.aborted === true || caller?.aborted === true
      if (raised()) {
        note('dispatch:aborted-before-dispatch')
        return abortedBeforeDispatch()
      }
      const def = layerOf(scope).get(input.name) ?? globalLayer.get(input.name)
      if (def === undefined) throw new Error(`unknown tool "${input.name}"`)
      note(`resolve:${def.identity}`)
      bodyInvoked = true
      raiseCaller('inside-body')
      await input.whileBodyRuns?.()
      // The pinned call site is `tool.execute(exec.arguments, exec)` (`:1581`).
      const prior = await def.execute(undefined, exec)
      return raised() ? abortedAfterBody({ value: prior }) : prior
    }

    let result: unknown
    try {
      // 1 — `tools/pre-execute` waterfall (optional deterministic fence inside).
      await drive(
        'tools/pre-execute',
        scope,
        async () => {
          if (input.parkInPreExecute !== undefined) {
            note('park:pre-execute')
            input.parkInPreExecute.signal.arrived()
            await input.parkInPreExecute.gate
            note('resume:pre-execute')
          }
          applySwap('pre-execute')
          return { kind: 'allow' as const }
        },
        [exec],
      )
      // 2 — the Guard stage, which the pinned registry reaches only AFTER
      // pre-execute, and which the assembly's Dispatcher answers per call.
      raiseCaller('guard')
      note('guard-stage')
      const denial = guards.reduce<string | undefined>(
        (acc, guardFn) => (acc !== undefined ? acc : guardFn(exec as { name: string; agent?: unknown })),
        undefined,
      )
      if (denial !== undefined) {
        const refused = { isError: true, text: denial }
        await drive('tools/post-execute', scope, async () => refused, [exec, refused])
        await fire('tools/result', scope, exec, refused)
        return { text: `Error: ${denial}`, bodies: [...bodies], threw: denial, log: [...callLog], bodyInvoked }
      }
      // 3 — `tools/execute` waterfall: a swap scripted `execute-before-ours`
      // lands before the waterfall (a plugin that mounted ahead of the Team row
      // would be the first listener; the point is that the assembly's door has
      // not read yet), and `execute-after-ours` after every listener.
      applySwap('execute-before-ours')
      result = await drive(
        'tools/execute',
        scope,
        async () => {
          applySwap('execute-after-ours')
          return await dispatchToolBody()
        },
        [exec],
      )
    } catch (error) {
      result = { isError: true, text: String((error as Error)?.message ?? error) }
      await drive('tools/post-execute', scope, async () => result, [exec, result])
      await fire('tools/result', scope, exec, result)
      return {
        text: String((result as { text?: string }).text),
        bodies: [...bodies],
        threw: String((error as Error)?.message ?? error),
        log: [...callLog],
        bodyInvoked,
      }
    }
    // 4 — the result edges, both AFTER the Body returned (measured).
    await drive('tools/post-execute', scope, async () => result, [exec, result])
    if (input.postExecuteReplaces !== undefined) result = input.postExecuteReplaces
    await fire('tools/result', scope, exec, result)
    return {
      text: String(
        (result as { text?: string })?.text
          ?? (result as { content?: { text?: string }[] })?.content?.[0]?.text
          ?? JSON.stringify(result ?? null),
      ),
      bodies: [...bodies],
      log: [...callLog],
      code: outcomeCode(result),
      bodyInvoked,
    }
  }

  const registerOwn = (name: string, identity: string, scope?: string): (() => void) => {
    const layer = layerOf(scope ?? defaultScope)
    layer.set(name, definition(name, identity))
    emitChange()
    return () => {
      if (layer.get(name)?.identity === identity) {
        layer.delete(name)
        emitChange()
      }
    }
  }
  const registerGlobal = (name: string, identity: string): (() => void) => {
    globalLayer.set(name, definition(name, identity))
    emitChange()
    return () => {
      if (globalLayer.get(name)?.identity === identity) {
        globalLayer.delete(name)
        emitChange()
      }
    }
  }
  /** Drop one name from one Agent's own layer — what an MCP teardown does to its own row. */
  const unregisterOwn = (name: string, scope?: string): void => {
    layerOf(scope ?? defaultScope).delete(name)
    emitChange()
  }
  /** The batch MCP `syncTools` performs: dispose the whole generation, then register the next. */
  const mcpResync = (scope: string | undefined, next: readonly { name: string; identity: string }[]): void => {
    const layer = layerOf(scope ?? defaultScope)
    for (const name of [...layer.keys()]) layer.delete(name)
    for (const row of next) layer.set(row.name, definition(row.name, row.identity))
    emitChange()
  }

  return {
    ctx,
    ctxFor,
    guards,
    listeners,
    registerOwn,
    registerGlobal,
    unregisterOwn,
    mcpResync,
    runCall,
    layerOf: (scope?: string) => [...layerOf(scope ?? defaultScope).keys()],
    agentResolution: (name, scope?) =>
      (layerOf(scope ?? defaultScope).get(name) ?? globalLayer.get(name))?.identity ?? 'UNKNOWN',
    globalResolution: (name) => globalLayer.get(name)?.identity ?? 'UNKNOWN',
  }
}
