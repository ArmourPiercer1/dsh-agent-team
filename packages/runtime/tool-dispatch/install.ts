/**
 * Alpha.5 PR1 (plan §4) — the ASSEMBLY INSTALL of the closed-world Guard and
 * the Stable Scoped Dispatcher on one Team Agent's public seams.
 *
 * WHY THIS FILE EXISTS (design §4.1 PREPARING, verbatim order):
 *
 *     1. install the closed-world Guard            (`tools.guard`, monotonic)
 *     2. mask the inherited names to be taken over (`tools.restrict`)
 *     3. register the STABLE Dispatcher Definition (`tools.register`)
 *     4. validate presets / MCP / scope / output / Provider capabilities
 *     5. PUBLISH (PREPARING → ACTIVE)
 *
 * Any failure before (5) means the Agent is NOT published — the AgentSetup
 * contract already rolls an unpublished agent back, and the Guard installed
 * in (1) refuses everything while the state is not ACTIVE, so a half-built
 * assembly is never a runnable Agent.
 *
 * THE ORDER IS THE SECURITY PROPERTY, and the disposer preserves it in
 * reverse-minus-the-Guard (NEG-1, the PoC's `L3-hazard` leg): the host's
 * teardown habit is "lift the restriction, then drop the listener", and that
 * order lets the ToolRuntime's late dispatch re-resolution fall back to the
 * NATIVE BODY (the PoC measured it: 原体 ran once). Here the composite
 * disposer therefore:
 *
 *     beginDrain()            → new calls refused, in-flight cancellation
 *     (no restrict lift)      → the mask STAYS for the whole drain
 *     wait for the self-count → only then tombstone()
 *     tombstone()             → late callbacks keep meeting the same refusal
 *     release()               → refuses while a self-counted lease is open
 *     only at RELEASED        → the mask may lift, and the Guard goes last
 *
 * The Guard is the LAST thing removed and the FIRST thing installed. A host
 * that never lets the count reach zero keeps the mask and the Guard forever
 * — a leaked mask is a resource problem; a lifted mask is a safety problem.
 *
 * FAIL-CLOSED SERVICES (plan §4 "缺少必需 Service 时不接受 Cordis Fiber 静默
 * PENDING 当作已完成装配"): {@link requireService} turns "the service is
 * absent / malformed" into a typed assembly failure rather than a fiber that
 * merely sits PENDING (NEG-8 in the PoC: a missing service surfaces as
 * PENDING with an EMPTY tool surface, which looks like a successful mount
 * from outside).
 *
 * What it touches upstream, all PUBLIC: `agentCtx.tools.guard`,
 * `agentCtx.tools.schemas(scope)`, `agentCtx.on('tools/change')` (diagnostics
 * only — see {@link ScopedDispatcher.revalidateSurface}), and the
 * {@link MaskPort} the caller already owns (`applyBuiltInToolDeny`). It never
 * reaches into a registry, never imports a private module, never mutates the
 * global layer.
 *
 * @module @dsh-agent-team/runtime/tool-dispatch/install
 */

import type { GovernanceError, GovernanceResult, ToolBinding } from '../../domain/tool-governance/src/index.js'
import { untestedAssurance, type GuardExecView } from './closed-world-guard.js'
import {
  createScopedDispatcher,
  type DispatcherObservation,
  type ScopedDispatcher,
  type ScopedDispatcherOptions,
} from './scoped-dispatcher.js'

/** The public `ToolGuard` shape (structural; the host owns the real type). */
export type GuardFn = (exec: GuardExecView) => string | undefined

/** The agent-scoped public seams this install needs (structural). */
export interface ScopedGuardAgentCtx {
  readonly tools: {
    readonly guard?: (guard: GuardFn) => () => void
    readonly schemas?: (scope?: unknown) => readonly unknown[]
  }
  readonly on?: (event: string, listener: (...args: never[]) => unknown) => () => void
}

/** The mask the assembly owns (design §4.1 step 2), handed over for the drain. */
export interface MaskPort {
  /** Lift the inherited-name restriction. Called ONLY at RELEASED. */
  readonly lift: () => void
  readonly names?: readonly string[]
}

/** The `tools/change` diagnostics the install reports (never a permission). */
export interface SurfaceRevalidation {
  readonly added: readonly string[]
  readonly removed: readonly string[]
  /** The names that appeared after assembly and are therefore DENIED. */
  readonly denied: readonly string[]
}

/** The handle the assembly holds until the Agent is released. */
export interface ScopedGuardHandle {
  readonly dispatcher: ScopedDispatcher
  /** PREPARING until {@link publish}: everything is refused before it. */
  readonly publish: () => GovernanceResult<void>
  /** Bind the names THIS assembly registered in its own layer. */
  readonly bindOwnTools: (names: readonly string[]) => GovernanceResult<void>
  /** Bind the names an MCP reconcile provably introduced. */
  readonly bindMcpTools: (names: readonly string[]) => GovernanceResult<void>
  /** Re-read the surface after a `tools/change` event (diagnostics only). */
  readonly revalidate: () => SurfaceRevalidation
  /** The ordered teardown: refuse → drain (mask KEPT) → tombstone → release. */
  readonly disposeOrdered: () => GovernanceResult<void>
  /** Read the current agent-scoped surface names (fails closed typed). */
  readonly surfaceNames: () => GovernanceResult<readonly string[]>
  readonly observations: () => readonly Record<string, unknown>[]
}

/**
 * Map one host `ToolExecution` (the pinned `ToolGuard` parameter) to the
 * host-neutral {@link GuardExecView}. The identity facts the Guard verifies
 * are exactly what the public execution object exposes: the calling `Agent`
 * (the registry's own scope routing key) through its Agent id, else its
 * durable session header id. A tool name is never an identity, and an exec
 * with NO identity is not an anonymous pass (NEG-2: a Team-origin dispatch
 * that lost its Agent is refused, not laundered into the global lane).
 */
export function hostExecToView(exec: unknown): GuardExecView {
  const raw = exec as { name?: unknown; agent?: { id?: unknown; session?: { header?: { id?: unknown } } } } | null
  const name = typeof raw?.name === 'string' ? raw.name : String(raw?.name ?? '')
  const agentId = typeof raw?.agent?.id === 'string' ? raw.agent.id : undefined
  const headerId = typeof raw?.agent?.session?.header?.id === 'string' ? raw.agent.session.header.id : undefined
  const identity = agentId ?? headerId
  return identity === undefined ? { name } : { name, agentIdentity: identity }
}

/** Inputs of {@link installScopedToolGuard}. */
export interface InstallScopedGuardInput extends ScopedDispatcherOptions {
  readonly agentCtx: ScopedGuardAgentCtx
  /** The canonical runtime Agent — the scope key `tools.schemas` takes. */
  readonly runtimeAgent: unknown
  /**
   * The inherited names this assembly masks (design §4.1 step 2). The Guard
   * itself does not mask — the caller's `applyBuiltInToolDeny` does — but the
   * install records them, because "the mask outlives the Dispatcher" is a
   * fact the ordered teardown has to be able to state.
   */
  readonly maskedNames?: readonly string[]
  /**
   * The restriction this assembly installed (design §4.1 step 2). The Handle
   * owns its lifetime: an armed Guard means the mask is NEVER lifted by the
   * ordinary disposer drain, because "lift the restriction, then drop the
   * adapter" is precisely the NEG-1 hazard order. The lift happens ONLY at
   * RELEASED, inside {@link ScopedGuardHandle.disposeOrdered}.
   */
  readonly maskPort?: MaskPort
}

const fail = (code: GovernanceError['code'], message: string): GovernanceResult<never> => ({
  ok: false,
  error: { code, message },
})

/**
 * The required-Service check that replaces the silent `PENDING` (plan §4).
 * A Cordis fiber whose service is absent does not throw at mount: it sits
 * PENDING and the tool surface simply comes back EMPTY (PoC NEG-8), so the
 * assembly must ask for each dependency explicitly and fail loudly.
 */
export function requireService<T>(
  value: T | undefined | null,
  what: string,
  predicate: (value: NonNullable<T>) => boolean = (v) => v !== undefined && v !== null,
): GovernanceResult<NonNullable<T>> {
  if (value === undefined || value === null || !predicate(value as NonNullable<T>)) {
    return fail('IO_POLICY_UNSUPPORTED', `assembly requires the public service "${what}" and it is absent or malformed (a silently PENDING fiber is not an assembled dependency)`)
  }
  return { ok: true, value: value as NonNullable<T> }
}

/** Read the agent-scoped surface through `tools.schemas(scope)` (fail closed). */
function readSurface(ctx: ScopedGuardAgentCtx, runtimeAgent: unknown): GovernanceResult<readonly string[]> {
  const schemas = requireService(ctx.tools.schemas, 'tools.schemas', (fn) => typeof fn === 'function')
  if (!schemas.ok) return schemas
  if (runtimeAgent === undefined || runtimeAgent === null) {
    return fail('TOOL_BINDING_UNVERIFIED', 'no runtime Agent identity: the agent-scoped tool surface is unreadable (the global surface is never a substitute)')
  }
  let raw: readonly unknown[]
  try {
    raw = schemas.value.call(ctx.tools, runtimeAgent)
  } catch (error) {
    return fail('TOOL_BINDING_UNVERIFIED', `tools.schemas(scope) threw: ${String((error as Error)?.message ?? error)}`)
  }
  if (!Array.isArray(raw)) return fail('TOOL_BINDING_UNVERIFIED', 'tools.schemas returned a non-array surface')
  const names: string[] = []
  for (const entry of raw) {
    const name = (entry as { name?: unknown })?.name
    if (typeof name !== 'string' || name.length === 0) {
      return fail('TOOL_BINDING_UNVERIFIED', 'tools.schemas returned a schema without a string name')
    }
    names.push(name)
  }
  return { ok: true, value: names.sort() }
}

/**
 * Install the Guard + Dispatcher on ONE Team Agent scope (design §4.1
 * PREPARING steps 1 and 3; the caller performs step 2 between them).
 *
 * The returned handle starts in PREPARING — the Guard is ALREADY armed and
 * already refusing while the caller finishes the assembly (mask, own-layer
 * registrations, MCP, capability validation). {@link
 * ScopedGuardHandle.publish} is the only door to ACTIVE.
 */
export function installScopedToolGuard(input: InstallScopedGuardInput): GovernanceResult<ScopedGuardHandle> {
  const observations: DispatcherObservation[] = []
  const observe = (row: DispatcherObservation): void => {
    if (observations.length < 2000) observations.push(row)
    input.onObserve?.(row)
  }

  const guardSeam = requireService(
    input.agentCtx.tools.guard,
    'tools.guard',
    (fn) => typeof fn === 'function',
  )
  if (!guardSeam.ok) {
    observe({ event: 'guard-install-refused', code: guardSeam.error.code })
    return guardSeam
  }

  const dispatcher = createScopedDispatcher({
    agentScopeKey: input.agentScopeKey,
    trustedIdentities: input.trustedIdentities,
    ...(input.policyGeneration === undefined ? {} : { policyGeneration: input.policyGeneration }),
    ...(input.authorityGeneration === undefined ? {} : { authorityGeneration: input.authorityGeneration }),
    ...(input.nativeProviderId === undefined ? {} : { nativeProviderId: input.nativeProviderId }),
    onObserve: observe,
  })

  const begin = dispatcher.beginAssembly()
  if (!begin.ok) return begin

  // STEP 1 — the Guard goes in FIRST, before any mask and before any
  // own-layer registration. Its disposer is captured, never discarded.
  let guardDispose: (() => void) | undefined
  try {
    guardDispose = guardSeam.value.call(input.agentCtx.tools, (exec: unknown) => dispatcher.guard(hostExecToView(exec)))
  } catch (error) {
    dispatcher.failAssembly(`tools.guard threw: ${String((error as Error)?.message ?? error)}`)
    return fail('TOOL_BINDING_UNVERIFIED', `the tools.guard seam rejected the closed-world Guard: ${String((error as Error)?.message ?? error)}`)
  }
  observe({ event: 'guard-installed', scope: input.agentScopeKey, maskedNames: input.maskedNames ?? [] })

  // Everything this install registers beyond the Guard (the diagnostics
  // listener and the in-flight counter). They go with the Guard, at the end.
  const extraDisposers: (() => void)[] = []

  // `tools/change` — DIAGNOSTICS ONLY. The host fires it for every register /
  // unregister / restriction change (and a scoped listener sees changes
  // beyond its own scope), so it is the right place to re-read and re-report
  // the surface; it is the wrong place to decide anything, because a
  // registration event arrives AFTER the name is already dispatchable
  // (design §4.1: tools/change 用于无权限的重新校验/诊断，不代替执行时检查).
  let lastSurface: readonly string[] = []
  const revalidate = (): SurfaceRevalidation => {
    const current = readSurface(input.agentCtx, input.runtimeAgent)
    if (!current.ok) {
      observe({ event: 'surface-revalidate-unavailable', detail: current.error.message })
      return { added: [], removed: [], denied: [] }
    }
    const diff = dispatcher.revalidateSurface(current.value)
    lastSurface = current.value
    return { added: diff.added, removed: diff.removed, denied: diff.added }
  }
  if (typeof input.agentCtx.on === 'function') {
    try {
      extraDisposers.push(input.agentCtx.on('tools/change', () => {
        const result = revalidate()
        if (result.denied.length > 0) {
          observe({ event: 'tools-change-unbound-names', denied: result.denied, note: 'tools/change is a diagnostic; these names are refused at dispatch by the Guard' })
        }
      }))
    } catch (error) {
      // A missing `tools/change` listener costs diagnostics, never safety:
      // the Guard's verdict does not read this channel.
      observe({ event: 'tools-change-listener-unavailable', detail: String((error as Error)?.message ?? error) })
    }
  }

  /**
   * Register a listener under a STABLE FUNCTION NAME. Three lanes now sit on
   * the same waterfalls (the alpha.2 permission adapter, the alpha.5 Guard),
   * and a reviewer inspecting a live ctx — or a test that must count one lane
   * without blind-bumping the other's pin — needs a name, not an anonymous
   * arrow. The wrapper costs nothing and changes no behaviour.
   */
  const named = (name: string, fn: (...args: never[]) => unknown): ((...args: never[]) => unknown) =>
    Object.defineProperty(fn, 'name', { value: name, configurable: true })

  // THREE EDGES, doing two different jobs — and the split is FORCED by a
  // measured host fact, not by taste.
  //
  // MEASURED on the pinned 0.2.0-rc.2 registry (re-measured by this PR's
  // `tests/kits/a5-pr1-guard-dispatch/a5p1-order-hazard.mjs`): NEITHER
  // waterfall's `next()` resolves after the Body RETURNS —
  // `tools/pre-execute`'s `next()` resolves before the Body is entered, and
  // `tools/execute`'s resolves after the Body is entered but while it is still
  // running. An around-`next()` counter would therefore call a live Body idle
  // and lift the mask on it, which is the NEG-1 hazard in a new costume.
  //
  // So the SELF-COUNT is taken at the OUTERMOST edge and released at the edge
  // that only exists once a result exists:
  //
  //     begin ── `tools/pre-execute`   (the first door EVERY call passes)
  //     end   ── `tools/post-execute`  (fires for every call that got a door)
  //
  // The pair is balanced by measurement, not by hope: a Guard denial skips
  // `tools/execute` but still fires `tools/post-execute`, and this Guard ends
  // the lease itself whenever IT turns a call away (a call it refused
  // provably never runs a Body). What is left is the honest limit of the
  // public seams: `post-execute` fires when a RESULT exists, which on this
  // host is not provably after the Body returns. So the count means "no call
  // stands between its outer door and its result event" — a strictly weaker
  // claim than "no Body is running", and the PR records it as such. Every
  // unresolved lease fails CLOSED: the drain refuses with
  // `EXECUTION_TERMINATION_UNCONFIRMED` and the mask and Guard stay armed,
  // which is why the weaker claim is safe and a false zero would not be.
  //
  // Why the lease must start at the OUTERMOST door: the NEG-1 window is a call
  // parked at `pre-execute` while the teardown runs. Leased there, the drain
  // sees it and cannot reach RELEASED — so the mask is still down and the
  // Guard is still armed when the call resumes, and it meets a refusal instead
  // of a re-resolved native Definition.
  if (typeof input.agentCtx.on === 'function') {
    const onEvent = input.agentCtx.on as unknown as (
      event: string,
      listener: (...args: never[]) => unknown,
    ) => () => void
    const refuse = (edge: string, exec: unknown): never => {
      const view = exec as { name?: unknown }
      throw new Error(
        `team tool guard: "${String(view?.name)}" reached the ${edge} stage while this Agent's Tool Dispatcher is ${dispatcher.state()} (not ACTIVE); the body is not reachable`,
      )
    }
    const callIdOf = (exec: unknown): string => {
      const view = exec as { callId?: unknown; name?: unknown }
      return typeof view?.callId === 'string' && view.callId.length > 0 ? view.callId : `anonymous:${String(view?.name)}`
    }
    try {
      // The outer door: refuse while not ACTIVE, otherwise take the lease.
      extraDisposers.push(
        onEvent('tools/pre-execute', named('a5p1GuardPreExecuteGate', ((exec: unknown, next: () => Promise<unknown>) => {
          if (!dispatcher.active()) {
            dispatcher.endCallById(callIdOf(exec))
            refuse('pre-execute', exec)
          }
          const begun = dispatcher.beginCall(callIdOf(exec), String((exec as { name?: unknown })?.name))
          if (!begun.ok) throw new Error(begun.error.message)
          return next()
          }) as (...args: never[]) => unknown),
        ),
      )
    } catch (error) {
      // Without the outer door a parked call could resume into a re-resolved
      // Definition — the NEG-1 hazard itself.
      observe({ event: 'pre-execute-gate-unavailable', fatal: true, detail: String((error as Error)?.message ?? error) })
    }
    try {
      // The result edge: this is where a lease legitimately ends — it is the
      // first public moment at which the Body has returned.
      extraDisposers.push(
        onEvent(
          'tools/post-execute',
          named('a5p1GuardResultEdge', ((exec: unknown, _result: unknown, next: () => Promise<unknown>) => {
            dispatcher.endCallById(callIdOf(exec))
            return next()
          }) as (...args: never[]) => unknown),
        ),
      )
    } catch (error) {
      // No result edge means no lease can ever end, so the drain will refuse
      // and the mask/Guard stay armed. Loud, fail closed, never a false zero.
      observe({ event: 'result-edge-unavailable', fatal: true, detail: String((error as Error)?.message ?? error) })
    }
    try {
      extraDisposers.push(
        onEvent(
          'tools/execute',
          named('a5p1GuardDispatchGate', ((exec: unknown, next: () => Promise<unknown>) => {
          if (!dispatcher.active()) {
            // This call is turned away before its Body: its lease (taken at
            // the outer door) ends here, by us, because we know it will never
            // run. `post-execute` also ends leases, and ending twice is a
            // no-op by construction.
            dispatcher.endCallById(callIdOf(exec))
            refuse('execute', exec)
          }
          return next()
          }) as (...args: never[]) => unknown),
        ),
      )
    } catch (error) {
      // Without the counter the drain cannot prove zero in-flight, so
      // `release()` will refuse and the mask/Guard stay armed — fail closed,
      // never a false "released".
      observe({ event: 'inflight-counter-unavailable', detail: String((error as Error)?.message ?? error) })
    }
  }

  const bindAll = (names: readonly string[], origin: 'team-own' | 'team-mcp'): GovernanceResult<void> => {
    for (const name of names) {
      const binding: ToolBinding = {
        bindingId: `${origin}:${input.agentScopeKey}:${name}`,
        agentScopeKey: input.agentScopeKey,
        toolName: name,
        definitionIdentity: `${origin}:${name}`,
        providerId: origin === 'team-mcp' ? 'mcp' : 'dsh-agent-team',
        implementationOrigin: 'team-trusted-extension',
        executionBoundary: 'trusted-host',
        assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
        policyGeneration: dispatcher.policyGeneration(),
        authorityGeneration: dispatcher.authorityGeneration(),
        revision: 1,
        status: 'ACTIVE',
      }
      const outcome = dispatcher.bind({ name, origin, binding, verified: true })
      if (!outcome.ok) return outcome
    }
    return { ok: true, value: undefined }
  }

  // Whether this Agent's mask + Guard have already been taken down. The
  // teardown is idempotent on the STATE (it may be called again after a
  // refusal) but the resource release happens exactly once.
  let tornDown = false

  const handle: ScopedGuardHandle = {
    dispatcher,
    publish: () => {
      // Step 4/5: the surface must be readable and fully governed at the
      // moment of publishing; anything unbound after this point is a runtime
      // denial, not a publish-time exception.
      const surface = readSurface(input.agentCtx, input.runtimeAgent)
      if (!surface.ok) {
        dispatcher.failAssembly(surface.error.message)
        return surface
      }
      lastSurface = surface.value
      dispatcher.bindInheritedSurface(surface.value)
      const outcome = dispatcher.publish()
      if (outcome.ok) {
        observe({ event: 'agent-published', scope: input.agentScopeKey, surface: surface.value.length, masked: input.maskedNames?.length ?? 0 })
      }
      return outcome
    },
    bindOwnTools: (names) => bindAll(names, 'team-own'),
    bindMcpTools: (names) => bindAll(names, 'team-mcp'),
    revalidate,
    disposeOrdered: () => {
      // NEG-1: refuse first, drain with the mask KEPT, tombstone, and only
      // release on the Dispatcher's OWN zero count.
      const drain = dispatcher.beginDrain()
      if (!drain.ok && dispatcher.state() !== 'DRAINING' && dispatcher.state() !== 'TOMBSTONED' && dispatcher.state() !== 'RELEASED') {
        observe({ event: 'dispose-drain-refused', detail: drain.error.message, state: dispatcher.state() })
      }
      if (dispatcher.state() === 'DRAINING') {
        const tomb = dispatcher.tombstone()
        if (!tomb.ok) return tomb
      }
      if (dispatcher.state() === 'TOMBSTONED') {
        const release = dispatcher.release()
        if (!release.ok) return release
      }
      if (dispatcher.state() === 'RELEASED' || dispatcher.state() === 'UNBOUND') {
        if (tornDown) {
          // A second close is a no-op. Re-running it would lift a mask that is
          // already gone and report a lift that never happened, and a false
          // "lifted again" is exactly the kind of evidence this lane refuses
          // to hand out.
          observe({ event: 'dispose-noop', scope: input.agentScopeKey, state: dispatcher.state() })
          return { ok: true, value: undefined }
        }
        tornDown = true
        // RELEASED (or never ACTIVE at all): now, and only now, the mask and
        // the Guard go — mask FIRST, Guard LAST (the reverse of install). The
        // lift happens AT MOST ONCE per Agent.
        if (input.maskPort !== undefined) {
          try {
            input.maskPort.lift()
            observe({ event: 'mask-lifted', scope: input.agentScopeKey, at: dispatcher.state() })
          } catch (error) {
            observe({ event: 'mask-lift-failed', detail: String((error as Error)?.message ?? error) })
          }
        }
        if (typeof guardDispose === 'function') {
          try {
            guardDispose()
          } catch {
            /* an already-disposed scope is not a safety change */
          }
        }
        for (const off of extraDisposers.splice(0)) {
          try {
            off()
          } catch {
            /* already-off listeners are not a safety change */
          }
        }
        observe({ event: 'guard-released', scope: input.agentScopeKey, state: dispatcher.state() })
        return { ok: true, value: undefined }
      }
      return {
        ok: false,
        error: {
          code: 'EXECUTION_TERMINATION_UNCONFIRMED',
          message: `dispose stopped at ${dispatcher.state()}: the mask and the Guard stay armed`,
          sideEffectUnknown: true,
        },
      }
    },
    surfaceNames: () => readSurface(input.agentCtx, input.runtimeAgent),
    observations: () => [...observations],
  }
  return { ok: true, value: handle }
}
