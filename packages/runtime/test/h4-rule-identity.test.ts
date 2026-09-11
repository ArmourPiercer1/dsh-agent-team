/**
 * h4-rule-identity.test.ts — H4 (alpha.2 hardening follow-up, P1-A): the
 * stale exact-rule canonical identity of the pre-execute adapter.
 *
 * WHAT THIS FILE PROVES (the SECURE property):
 *
 * The A5 pre-execute adapter canonicalizes the policy's SAME-TOOL `exact`
 * rules and the incoming OPERATION through the SAME injected
 * `PathTargetResolver` seam (the A6 glue's closure over the upstream
 * public `ctx.fs.resolve` seam, bound lazily to the agent's live session
 * cwd). The operation is canonicalized FRESH on every decision
 * (`canonicalizeOperation` has no cache); the rules MUST be too: when the
 * filesystem identity of a rule path changes between decisions (a
 * symlink/junction retarget — the upstream local backend's `targetKey` is
 * the realpath of the existing target), a rule that was canonicalized at
 * T0 carries a T0 identity while the operation of T1 carries a T1
 * identity:
 *
 *   - a static DENY whose rule identity is stale silently STOPS MATCHING
 *     (the decision downgrades to the default — an escalation: an
 *     approval can then authorize what the policy statically forbade);
 *   - a static ALLOW whose rule identity is stale keeps AUTHORIZING the
 *     resource the rule path no longer denotes (stale authority: a read
 *     of the ORIGINAL target executes under an allow that now addresses
 *     a different file).
 *
 * The fix (the parent ruling) DELETES the install-lifetime
 * `ruleKeyCache` entirely: every permission decision fresh-resolves all
 * same-tool exact rules through the same resolver seam and the same
 * session-cwd basis as the operation. No invalidation, no TTL, no
 * watcher. These probes are the RED→GREEN evidence for that ruling:
 * H4-A1 and H4-A2 FAIL on the cached (pre-fix) tree and pass once the
 * cache is gone; H4-A3 and H4-DB pass on BOTH trees (regression guards).
 *
 * Probe table (names are greppable):
 *
 *   H4-A1  DENY retarget (MUST be RED pre-fix): policy
 *          `default: ask`, `deny: [read exact alias.txt]`. T0: the fake
 *          backend maps alias.txt → KEY_A; a read of alias.txt is
 *          statically DENIED (the deny rule matches), zero requests,
 *          zero body. Topology mutation: alias.txt → KEY_B (the
 *          retarget). T1: the SAME read of alias.txt again (fresh
 *          callId) — the rule must fresh-resolve to KEY_B and STILL
 *          deny. Pre-fix the rule key is pinned at KEY_A while the
 *          operation canonicalizes fresh to KEY_B ⇒ no match ⇒ the
 *          decision downgrades to the default ASK and a durable control
 *          request is raised (the probe settles that request with deny
 *          so the runner cannot hang — its very existence is the RED).
 *   H4-A2  ALLOW retarget, stale authority (MUST be RED pre-fix): policy
 *          `default: deny`, `allow: [read exact alias.txt]`. T0: the
 *          fake maps alias.txt → KEY_A and orig.txt → KEY_A (the alias
 *          denoted orig.txt — one shared identity); a read of alias.txt
 *          is ALLOWED (executes via next(), zero requests). Topology
 *          mutation: alias.txt → KEY_B (orig.txt is CONSTANT at KEY_A).
 *          T1: a read of orig.txt must be DENIED by the default (the
 *          allow rule now canonicalizes to KEY_B and no longer matches
 *          KEY_A). Pre-fix the allow rule is pinned at KEY_A ⇒ matches
 *          ⇒ stale ALLOW (the RED).
 *   H4-A3  transient rule-resolution failure (GREEN pre-fix; regression
 *          guard for the P1-3 H2 fail-closed flip): policy
 *          `default: deny`, `deny: [read exact alias.txt]`. Phase 1: the
 *          backend FAILS (the fake has no mapping for alias.txt — it
 *          throws) ⇒ the same-tool exact DENY rule fails to
 *          canonicalize ⇒ the operation is DENIED BEFORE the A3
 *          resolver (the stable `a static deny rule could not be
 *          canonicalized (…)` reason + an `onObserve` row, stage
 *          `deny-canonicalization-failure`), zero requests. Phase 2: the
 *          backend SUCCEEDS (alias.txt → KEY_A) and the operation reads
 *          alias.txt ⇒ static DENY by the now-resolving rule — proof
 *          the failed resolution is NOT remembered (fresh re-resolution;
 *          there is no cache — success or failure).
 *   H4-DB  operation/rule same-basis agreement (GREEN pre-fix; drift
 *          guard): a STABLE mapping (alias.txt → KEY_A, never mutated);
 *          the same resource is decided twice (fresh callIds). The fake
 *          records the full call sequence: the operation and the exact
 *          rule resolve through the ONE injected closure and return
 *          IDENTICAL keys on every decision (the first decision shows
 *          exactly two resolver calls — the operation, then the rule —
 *          both alias.txt, both KEY_A; every recorded key across both
 *          decisions is KEY_A). Guards against reintroduced drift
 *          between the two resolution paths (a second seam, a different
 *          cwd basis, a divergent normalization).
 *
 * The mutable fake backend is a `Map<normalizedPath, key>` the test
 * mutates BETWEEN phases (that mutation IS the topology change — the
 * upstream `resolveLocalTarget` returns `targetKey = realpath(
 * displayPath)`, so retargeting a symlink/junction changes the returned
 * identity exactly like the map change). A missing mapping = a backend
 * resolution failure (the resolver rejects, the same way the upstream
 * seam rejects an unresolvable path). The key scheme mirrors a5a's
 * `file:///` + normalized path (opaque — never parsed downstream).
 *
 * Everything else follows the a5a style: a REAL A4 control service over
 * a durable P6-T4 world, a fake agent ctx (the `on`/`tools.guard`
 * double — the install requires the guard seam, H1), one adapter
 * install per probe world, and the a5a-style exec/next fixtures.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see the a5a header):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous
 * assertions. Shim matchers used: toBe / toEqual (+.not) only. No
 * never-resolving await is left anywhere (the H4-A1/H4-A2 phase-2
 * decision is always settled: a request the pre-fix tree raises is
 * resolved deny by the probe itself before the decision is awaited —
 * the known plain-node runner hang is a never-resolving module-scope
 * await, and every await here is bounded).
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does.
 *
 * @module @dsh-agent-team/runtime/test/h4-rule-identity
 */
import { describe, expect, it } from 'vitest'
import { createControlService } from '../control/index.js'
import type {
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import {
  installParameterPermissionListener,
} from '../operation-permission/index.js'
import type {
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_ROOT,
  P6T4_NOW,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)

// ---------------------------------------------------------------------------
// The opaque canonical keys of the probe topology (the same scheme a5a
// uses: `file:///` + normalized path — opaque, never parsed downstream).
// ---------------------------------------------------------------------------

/** The identity alias.txt denoted at T0 (A1: before the retarget; A2: the
 * shared identity with orig.txt — the alias denoted orig.txt). */
const KEY_A = 'file:///alias-target-a'
/** The identity alias.txt denotes after the T1 retarget (A1/A2). */
const KEY_B = 'file:///alias-target-b'
/** A stable, unrelated resolvable path (H4-A3 phase 1 operation target). */
const KEY_OTHER = 'file:///other.txt'

/** A real-timer sleep (bounded waits only — no never-resolving await). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// The fake agent ctx (the a5a double: `on` records the listener and
// returns a tracked disposer; `tools.guard` records the end-cap guard —
// the install requires the seam, H1).
// ---------------------------------------------------------------------------

type PreExecuteListener = (
  exec: PreExecuteExec,
  next: () => Promise<PreToolDecisionLike>,
) => Promise<PreToolDecisionLike>

type GuardFn = (exec: { readonly name: string }) => string | undefined

interface FakeAgentCtx {
  readonly on: (event: string, listener: PreExecuteListener) => () => void
  readonly tools: {
    guard(guard: GuardFn): () => void
  }
  trigger: (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ) => Promise<PreToolDecisionLike>
}

function makeFakeAgentCtx(): FakeAgentCtx {
  const listeners: PreExecuteListener[] = []
  const on = (event: string, listener: PreExecuteListener): (() => void) => {
    void event
    listeners.push(listener)
    return (): void => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    }
  }
  const guard = (fn: GuardFn): (() => void) => {
    void fn
    return (): void => {}
  }
  const trigger = async (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ): Promise<PreToolDecisionLike> => {
    const listener = listeners[0]
    if (listener === undefined) throw new Error('h4 fake ctx: no listener registered')
    return listener(exec, next)
  }
  return { on, tools: { guard }, trigger }
}

// ---------------------------------------------------------------------------
// The MUTABLE fake resolver (the P1-A topology knob): a `Map` from
// normalized path to canonical key that the probe mutates BETWEEN phases
// (the mutation IS the symlink/junction retarget). A missing mapping =
// the backend cannot resolve the path (the resolver rejects, exactly as
// the upstream seam rejects an unresolvable path). The fake records the
// full call sequence (paths + returned keys, in order) for H4-DB.
// ---------------------------------------------------------------------------

interface MutableFakeResolver {
  readonly resolver: (path: string) => Promise<{ readonly key: string; readonly display: string }>
  /** Every path passed to the resolver, in order (the raw spelling). */
  readonly calls: string[]
  /** Every key the resolver returned, in order (parallel to `calls`). */
  readonly keys: string[]
  /** Point `path` (any spelling) at canonical `key` — the topology knob. */
  setTarget: (path: string, key: string) => void
  /** The default identity of `path` (the same `file:///` scheme as a5a). */
  keyOf: (path: string) => string
}

function makeMutableResolver(): MutableFakeResolver {
  const normalize = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
  const map = new Map<string, string>()
  const calls: string[] = []
  const keys: string[] = []
  const resolver = async (path: string): Promise<{ readonly key: string; readonly display: string }> => {
    calls.push(path)
    const key = map.get(normalize(path))
    if (key === undefined) {
      throw new Error(`fake backend: cannot resolve '${path}'`)
    }
    keys.push(key)
    return { key, display: path }
  }
  return {
    resolver,
    calls,
    keys,
    setTarget: (path: string, key: string): void => {
      map.set(normalize(path), key)
    },
    keyOf: (path: string): string => `file:///${normalize(path)}`,
  }
}

// ---------------------------------------------------------------------------
// The exec / next fixtures (the a5a shapes).
// ---------------------------------------------------------------------------

function makeExec(args: {
  readonly name: string
  readonly arguments?: unknown
  readonly callId: string
}): PreExecuteExec {
  return {
    callId: args.callId,
    name: args.name,
    arguments: args.arguments ?? {},
    signal: new AbortController().signal,
  }
}

function makeNext(): { readonly fn: () => Promise<PreToolDecisionLike>; calls: () => number } {
  let count = 0
  return {
    fn: async (): Promise<PreToolDecisionLike> => {
      count += 1
      return { kind: 'allow' }
    },
    calls: () => count,
  }
}

// ---------------------------------------------------------------------------
// The install environment (one P6-T4 durable world + one REAL control
// service + one adapter install on a fresh fake ctx, per probe leg).
// ---------------------------------------------------------------------------

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  readonly ctx: FakeAgentCtx
  readonly resolver: MutableFakeResolver
  readonly observations: Record<string, unknown>[]
}

/**
 * Build one probe world: a fresh P6-T4 durable world, the REAL control
 * service over it (waitPollIntervalMs: 10 — the A4-injected fast poll
 * cadence), and ONE adapter install on a fresh fake ctx (member — the
 * ask lane routes to leader-approval). The resolver is the MUTABLE fake
 * (no entries at install — the probe sets the T0 topology explicitly).
 */
async function createEnv(basename: string, policy: TemplatePermissionPolicy): Promise<Env> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const resolver = makeMutableResolver()
  const observations: Record<string, unknown>[] = []
  installParameterPermissionListener(ctx, {
    policy,
    resolveTarget: resolver.resolver,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    targetInstanceId: WORKER_ID,
    isLeader: false,
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
  return { world, service, ctx, resolver, observations }
}

/**
 * Bounded wait for a durable request by correlation: `undefined` when it
 * never appears (the post-fix static-decision path — no request is ever
 * created). The bound keeps the GREEN run fast and the RED run bounded:
 * whenever a request DOES appear (the pre-fix downgrade), the probe
 * resolves it before the paused decision is awaited, so no never-
 * resolving await survives (the known plain-node runner hang).
 */
async function waitForRequestOrUndefined(
  service: ControlService,
  correlation: string,
  attempts = 60,
): Promise<ControlRequestRecord | undefined> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const state = await service.listControlState(P6T4_ROOT)
    const found = state.requests.find((r) => r.correlation === correlation)
    if (found !== undefined) return found
    await sleep(5)
  }
  return undefined
}

/** True when a request with the correlation exists in the durable state. */
const reqCorrelation = (
  state: { readonly requests: readonly ControlRequestRecord[] },
  correlation: string,
): boolean => state.requests.some((r) => r.correlation === correlation)

/** The deny reason text of a decision (undefined for an allow). */
const denyReason = (
  decision: PreToolDecisionLike,
): string | undefined =>
  decision.kind === 'deny' ? decision.reason : undefined

// ===========================================================================
// H4-A1 — DENY retarget (MUST be RED pre-fix).
// ===========================================================================

const A1_POLICY: TemplatePermissionPolicy = {
  default: 'ask',
  allow: [],
  ask: [],
  deny: [{ tool: 'read', resource: { kind: 'exact', path: 'alias.txt' } }],
}

const A1 = await (async () => {
  const env = await createEnv('h4-a1', A1_POLICY)
  try {
    // T0 topology: alias.txt → KEY_A.
    env.resolver.setTarget('alias.txt', KEY_A)

    // H4-A1 phase 1 — a read of alias.txt: the operation and the deny
    // rule both canonicalize to KEY_A ⇒ static DENY (zero requests,
    // zero body).
    const next1 = makeNext()
    const d1 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'alias.txt' }, callId: 'h4-a1-p1' }),
      next1.fn,
    )
    const stateAfterP1 = await env.service.listControlState(P6T4_ROOT)

    // Topology mutation (the P1-A trigger): the symlink/junction behind
    // alias.txt is RETARGETED — its identity is now KEY_B. The mutation
    // of the map IS the filesystem change (the upstream targetKey is the
    // realpath of the existing target).
    env.resolver.setTarget('alias.txt', KEY_B)

    // H4-A1 phase 2 — the SAME read of alias.txt again (fresh callId).
    // Post-fix: the deny rule fresh-resolves to KEY_B ⇒ matches the
    // operation (KEY_B) ⇒ static DENY again, zero requests. Pre-fix:
    // the rule key is PINNED at KEY_A (the install-lifetime cache) while
    // the operation canonicalizes fresh to KEY_B ⇒ the deny rule no
    // longer matches ⇒ the decision DOWNGRADES to the default ask and a
    // durable control request is raised (the escalation P1-A closes).
    // The probe settles any such request (deny) so the paused listener
    // cannot leave a never-resolving await behind; the request's very
    // existence is the RED.
    const next2 = makeNext()
    const p2Promise = env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'alias.txt' }, callId: 'h4-a1-p2' }),
      next2.fn,
    )
    const p2Request = await waitForRequestOrUndefined(env.service, 'h4-a1-p2')
    if (p2Request !== undefined) {
      await env.service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: p2Request.requestId,
        decision: 'deny',
      })
    }
    const d2 = await p2Promise
    const state = await env.service.listControlState(P6T4_ROOT)

    return {
      d1,
      next1Calls: next1.calls(),
      stateAfterP1,
      d2,
      next2Calls: next2.calls(),
      state,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// H4-A2 — ALLOW retarget, stale authority (MUST be RED pre-fix).
// ===========================================================================

const A2_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'exact', path: 'alias.txt' } }],
  ask: [],
  deny: [],
}

const A2 = await (async () => {
  const env = await createEnv('h4-a2', A2_POLICY)
  try {
    // T0 topology: alias.txt and orig.txt denote ONE resource (KEY_A) —
    // the alias is a link to orig.txt (the same realpath identity).
    env.resolver.setTarget('alias.txt', KEY_A)
    env.resolver.setTarget('orig.txt', KEY_A)

    // H4-A2 phase 1 — a read of alias.txt: the allow rule and the
    // operation both canonicalize to KEY_A ⇒ static ALLOW (executes via
    // next(), zero requests).
    const next1 = makeNext()
    const d1 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'alias.txt' }, callId: 'h4-a2-p1' }),
      next1.fn,
    )
    const state1 = await env.service.listControlState(P6T4_ROOT)

    // Topology mutation: alias.txt is RETARGETED to KEY_B (a different
    // file). orig.txt is CONSTANT (KEY_A — the resource the alias
    // denoted before the retarget).
    env.resolver.setTarget('alias.txt', KEY_B)

    // H4-A2 phase 2 — a read of orig.txt (fresh callId). Post-fix: the
    // allow rule fresh-resolves to KEY_B while the operation
    // canonicalizes to KEY_A ⇒ no match ⇒ the DEFAULT deny decides.
    // Pre-fix: the allow rule is PINNED at KEY_A (the install-lifetime
    // cache) ⇒ it still matches KEY_A ⇒ a STALE ALLOW executes a read
    // of the resource the rule path no longer denotes (the RED).
    const next2 = makeNext()
    const d2 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'orig.txt' }, callId: 'h4-a2-p2' }),
      next2.fn,
    )
    const state2 = await env.service.listControlState(P6T4_ROOT)

    return {
      d1,
      next1Calls: next1.calls(),
      state1,
      d2,
      next2Calls: next2.calls(),
      state2,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// H4-A3 — transient rule-resolution failure (GREEN pre-fix; the P1-3
// fail-closed flip + the no-remembered-failure regression guard).
// ===========================================================================

const A3_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [],
  deny: [{ tool: 'read', resource: { kind: 'exact', path: 'alias.txt' } }],
}

const A3 = await (async () => {
  const env = await createEnv('h4-a3', A3_POLICY)
  try {
    // Phase 1 topology: ONLY other.txt is resolvable — alias.txt has NO
    // mapping, so the backend FAILS (rejects) for it. The operation
    // targets the resolvable path; the SAME-TOOL exact DENY rule is the
    // one that cannot be canonicalized.
    env.resolver.setTarget('other.txt', KEY_OTHER)

    // H4-A3 phase 1 — P1-3 (H2) fail-closed: a same-tool exact DENY
    // rule that fails to canonicalize DENIES the operation BEFORE the
    // A3 resolver is called (the stable reason names the failed path;
    // an `onObserve` row, stage deny-canonicalization-failure); zero
    // requests, zero body.
    const next1 = makeNext()
    const d1 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'other.txt' }, callId: 'h4-a3-p1' }),
      next1.fn,
    )
    const state1 = await env.service.listControlState(P6T4_ROOT)
    const observations1 = [...env.observations]

    // Phase 2 topology: the backend SUCCEEDS for alias.txt (the
    // transient failure is over).
    env.resolver.setTarget('alias.txt', KEY_A)

    // H4-A3 phase 2 — the operation now reads alias.txt (fresh callId):
    // the rule FRESH re-resolves (the failed resolution is not
    // remembered — there is no cache, success or failure) ⇒ the rule
    // (KEY_A) matches the operation (KEY_A) ⇒ static DENY by the
    // now-resolving rule.
    const next2 = makeNext()
    const d2 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'alias.txt' }, callId: 'h4-a3-p2' }),
      next2.fn,
    )
    const state2 = await env.service.listControlState(P6T4_ROOT)

    return {
      d1,
      next1Calls: next1.calls(),
      state1,
      observations1,
      d2,
      next2Calls: next2.calls(),
      state2,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// H4-DB — operation/rule same-basis agreement (GREEN pre-fix; the drift
// guard): a STABLE mapping, the same resource decided twice; the fake's
// recorded call sequence proves both resolution paths go through the
// ONE injected closure and return identical keys on every decision.
// ===========================================================================

const DB_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'exact', path: 'alias.txt' } }],
  ask: [],
  deny: [],
}

const DB = await (async () => {
  const env = await createEnv('h4-db', DB_POLICY)
  try {
    // Stable topology: alias.txt → KEY_A, never mutated.
    env.resolver.setTarget('alias.txt', KEY_A)

    // Decision 1 — the first call on a FRESH install: the pipeline
    // canonicalizes the OPERATION (step 2) and then the SAME-TOOL exact
    // rule of the allow lane (step 3) — exactly two resolver calls,
    // both alias.txt, both through the one injected closure.
    const next1 = makeNext()
    const d1 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'alias.txt' }, callId: 'h4-db-1' }),
      next1.fn,
    )
    const callsAfterD1 = [...env.resolver.calls]
    const keysAfterD1 = [...env.resolver.keys]

    // Decision 2 — the SAME resource again (fresh callId): whatever the
    // rule-resolution cadence (fresh per decision post-fix; the pre-fix
    // cache may skip the second rule call), the OPERATION resolves
    // again and every key returned — by the operation OR the rule — is
    // the identical KEY_A (no drift between the two paths).
    const next2 = makeNext()
    const d2 = await env.ctx.trigger(
      makeExec({ name: 'read', arguments: { file_path: 'alias.txt' }, callId: 'h4-db-2' }),
      next2.fn,
    )
    const callsAll = [...env.resolver.calls]
    const keysAll = [...env.resolver.keys]
    const state = await env.service.listControlState(P6T4_ROOT)

    return {
      d1,
      next1Calls: next1.calls(),
      callsAfterD1,
      keysAfterD1,
      d2,
      next2Calls: next2.calls(),
      newCallsForD2: callsAll.length - callsAfterD1.length,
      allKeysA: keysAll.every((k) => k === KEY_A),
      allAliasCalls: callsAll.every((c) => c === 'alias.txt'),
      state,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// Assertions (pure synchronous — the shim's `it` bodies).
// ===========================================================================

describe('H4-A1: DENY retarget — a stale exact DENY must not stop matching (P1-A)', () => {
  it('phase 1 (T0): static DENY — the deny rule and the operation share the identity; zero execution, zero control rows', () => {
    expect(A1.d1.kind).toBe('deny')
    const r1 = denyReason(A1.d1)
    expect(r1 !== undefined && r1.includes('deny rule 0')).toBe(true)
    expect(r1 !== undefined && r1.includes('alias.txt')).toBe(true)
    expect(A1.next1Calls).toBe(0)
    expect(A1.stateAfterP1.requests.length).toBe(0)
    expect(A1.stateAfterP1.decisions.length).toBe(0)
  })
  it('phase 2 (after the retarget): static DENY again — the rule fresh-resolves to the NEW identity; ZERO requests (RED pre-fix: the pinned key misses, the decision downgrades to ask and a request is raised)', () => {
    expect(A1.d2.kind).toBe('deny')
    const r2 = denyReason(A1.d2)
    expect(r2 !== undefined && r2.includes('deny rule 0')).toBe(true)
    expect(r2 !== undefined && r2.includes('alias.txt')).toBe(true)
    expect(A1.next2Calls).toBe(0)
    expect(A1.state.requests.length).toBe(0)
    expect(reqCorrelation(A1.state, 'h4-a1-p2')).toBe(false)
  })
})

describe('H4-A2: ALLOW retarget — stale authority must not outlive the retarget (P1-A)', () => {
  it('phase 1 (T0): ALLOW — the allow rule and the operation share the identity; executes via next, zero control rows', () => {
    expect(A2.d1).toEqual({ kind: 'allow' })
    expect(A2.next1Calls).toBe(1)
    expect(A2.state1.requests.length).toBe(0)
    expect(A2.state1.decisions.length).toBe(0)
  })
  it('phase 2 (after the retarget): reading the ORIGINAL target is DENIED by the default — the allow rule now resolves to the NEW identity (RED pre-fix: the pinned key still matches → stale ALLOW executes)', () => {
    expect(A2.d2.kind).toBe('deny')
    const r2 = denyReason(A2.d2)
    expect(r2 !== undefined && r2.includes('default')).toBe(true)
    expect(A2.next2Calls).toBe(0)
    expect(reqCorrelation(A2.state2, 'h4-a2-p2')).toBe(false)
    expect(A2.state2.requests.length).toBe(0)
  })
})

describe('H4-A3: transient rule-resolution failure — fail-closed DENY, then FRESH retry (P1-3 preserved; GREEN pre-fix)', () => {
  it('phase 1 (the rule path unresolvable): the P1-3 fail-closed DENY before the A3 resolver — the stable reason names the failed path; zero execution, zero control rows', () => {
    expect(A3.d1.kind).toBe('deny')
    const r1 = denyReason(A3.d1)
    expect(r1 !== undefined && r1.includes('a static deny rule could not be canonicalized')).toBe(true)
    expect(r1 !== undefined && r1.includes('alias.txt')).toBe(true)
    expect(A3.next1Calls).toBe(0)
    expect(A3.state1.requests.length).toBe(0)
  })
  it('phase 1: an onObserve row was emitted (stage deny-canonicalization-failure, tool + the failed paths)', () => {
    const rows = A3.observations1.filter(
      (o) => o['stage'] === 'deny-canonicalization-failure',
    )
    expect(rows.length).toBe(1)
    expect(rows[0]?.['callId']).toBe('h4-a3-p1')
    expect(rows[0]?.['tool']).toBe('read')
    expect(rows[0]?.['paths']).toEqual(['alias.txt'])
  })
  it('phase 2 (the backend recovers): the rule FRESH re-resolves (the failure is not remembered — no cache) ⇒ static DENY by the now-matching rule, zero requests', () => {
    expect(A3.d2.kind).toBe('deny')
    const r2 = denyReason(A3.d2)
    expect(r2 !== undefined && r2.includes('deny rule 0')).toBe(true)
    expect(A3.next2Calls).toBe(0)
    expect(A3.state2.requests.length).toBe(0)
  })
})

describe('H4-DB: operation/rule same-basis agreement — one injected closure, identical keys on every decision (drift guard)', () => {
  it('decision 1: exactly two resolver calls (the operation, then the exact rule) — both alias.txt, both KEY_A; the decision is ALLOW (executes, zero requests)', () => {
    expect(DB.d1).toEqual({ kind: 'allow' })
    expect(DB.next1Calls).toBe(1)
    expect(DB.callsAfterD1.length).toBe(2)
    expect(DB.callsAfterD1[0]).toBe('alias.txt')
    expect(DB.callsAfterD1[1]).toBe('alias.txt')
    expect(DB.keysAfterD1[0]).toBe(KEY_A)
    expect(DB.keysAfterD1[1]).toBe(KEY_A)
  })
  it('decision 2 (fresh callId): identical keys on EVERY decision — every recorded key (operation or rule) is KEY_A and every call is alias.txt (no drift between the two resolution paths)', () => {
    expect(DB.d2).toEqual({ kind: 'allow' })
    expect(DB.next2Calls).toBe(1)
    expect(DB.newCallsForD2 >= 1).toBe(true)
    expect(DB.allKeysA).toBe(true)
    expect(DB.allAliasCalls).toBe(true)
  })
  it('zero control rows for either decision (static allow)', () => {
    expect(DB.state.requests.length).toBe(0)
    expect(DB.state.decisions.length).toBe(0)
  })
})
