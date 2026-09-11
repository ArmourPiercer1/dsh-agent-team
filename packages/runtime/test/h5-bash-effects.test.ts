/**
 * h5-bash-effects.test.ts — H5 (alpha.2 hardening follow-up, P1-B): the
 * bash execution-effect fingerprint.
 *
 * WHAT THIS FILE PROVES (the SECURE property):
 *
 * The pinned-upstream `BashToolArgs` (tool-bash `src/index.ts` L44–52 @
 * a66e470204) carries four security-relevant fields BEYOND the command
 * that change the execution effect of `bash -c X`:
 *
 *   - `workdir`            WHERE the shell runs (resolveWorkdir L143–155:
 *                          omitted ⇒ session cwd; relative ⇒ session-
 *                          cwd-relative; absolute ⇒ as-is);
 *   - `run_in_background`  detached job (`jobs.start`, L348–378) vs
 *                          foreground `ctx.shell.run`;
 *   - `timeoutMs`          the explicit per-call timeout (upstream
 *                          validateBashArgs L54–67: present ⇒ finite
 *                          number > 0);
 *   - `sandbox_permissions` the requested sandbox mode (escalation,
 *                          L258–268 advertised only with a sandboxing
 *                          executor; L332–338 approval before execution).
 *
 * On the command-only projection (pre-fix), a durable approval for
 * `bash -c X in /A` authorizes `bash -c X in /B`, a background start, a
 * different timeout, and a sandbox escalation — the fingerprint does not
 * distinguish them. The upstream argument materialization (core/tools
 * `src/index.ts` L1402–1407) is lossless-JSON-only, and the `tools/
 * pre-execute` waterfall (L1466–1469) runs BEFORE any parameter-schema
 * validation (the tool's own `validateBashArgs` runs INSIDE `execute`,
 * L330 — reached only at L1540 via dispatchToolBody L1523–1540):
 * malformed effect-field types DO reach the Team listener, so the
 * fail-closed extraction below (H5-B8) is reachability-required, not
 * defense-in-depth.
 *
 * The post-fix projection (the parent ruling — see
 * `dev/agent-workflow/evidence/alpha2-hardening-followup/h5-bash-effect/
 * projection-ruling.md`):
 *
 *   { tool: 'bash', commandHash, workdir, runInBackground, timeoutMs,
 *     sandboxPermissions }
 *
 *   - `commandHash`          UNCHANGED (raw command, no normalization);
 *   - `workdir`              the CANONICAL KEY from the existing
 *                            `resolveTarget` seam over `args.workdir ??
 *                            '.'` (omitted / empty ⇒ the session cwd
 *                            itself — the seam's lazy cwd basis IS the
 *                            session cwd, and the backend's realpath
 *                            identity makes omitted ≡ explicit-
 *                            session-cwd and binds symlinked workdirs to
 *                            their real identity); the RESOURCE stays
 *                            `{ kind: 'tool', key: 'bash' }`;
 *   - `runInBackground`      `args.run_in_background ?? false`;
 *   - `timeoutMs`            `args.timeoutMs ?? null` — EXPLICIT only;
 *   - `sandboxPermissions`   `args.sandbox_permissions ?? null` — the
 *                            requested mode string only (upstream is the
 *                            mode-legality authority at execution).
 *
 * `description` / `justification` are EXCLUDED (display/explanation
 * metadata — upstream's validation domain). Four new closed fail-closed
 * reasons: `bash-workdir-not-a-string`, `bash-run-in-background-not-
 * boolean`, `bash-timeout-ms-invalid`, `bash-sandbox-permissions-not-a-
 * string` (each malformed shape fails closed BEFORE the resolver call —
 * zero backend round-trips; resolution failures keep the EXISTING closed
 * reasons `resolver-threw` / `resolver-result-malformed` /
 * `resolver-key-empty`).
 *
 * Probe table (names are greppable; RED = MUST fail on the pre-fix
 * command-only projection):
 *
 *   H5-B1  (RED)   same command, workdir `/A` vs `/B` ⇒ fingerprints
 *                  DIFFER (pre-fix: identical — the workdir is invisible
 *                  to the fingerprint).
 *   H5-B2  (GREEN guard — documented) workdir omitted vs explicit `/A`
 *                  (same effective cwd) ⇒ fingerprints SAME. The
 *                  fingerprint half is GREEN on BOTH trees (trivially
 *                  pre-fix — the probe's value is post-fix, where the
 *                  workdir key enters the projection); the KEY half
 *                  (both operations resolve through the seam to KEY_A —
 *                  omitted as `.`, explicit as `/A`) is RED pre-fix
 *                  (the resolver is never called for bash) and pins the
 *                  effective-canonical ruling post-fix.
 *   H5-B3  (RED)   run_in_background omitted/false vs true ⇒ DIFFER.
 *   H5-B4  (RED)   timeoutMs omitted vs 10000 ⇒ DIFFER; 10000 vs 20000
 *                  ⇒ DIFFER.
 *   H5-B5  (RED)   sandbox_permissions absent vs 'workspace-write' ⇒
 *                  DIFFER; 'workspace-write' vs 'danger-full-access' ⇒
 *                  DIFFER (the two modes of the pinned upstream dsh-
 *                  sandbox `ESCALATION_TARGETS`).
 *   H5-B6  (GREEN guard) description A vs B ⇒ SAME; justification A vs B
 *                  (same sandbox_permissions) ⇒ SAME (excluded fields —
 *                  asserted post-fix too).
 *   H5-B7  (GREEN guard) `echo x` vs `echo  x` (raw differs) ⇒ DIFFER
 *                  (H2 raw-command binding).
 *   H5-B8  (RED)   malformed effect fields ⇒ fail-closed DENY, ZERO
 *                  durable request, ZERO body, an `onObserve`
 *                  canonicalization row with the closed reason —
 *                  (a) workdir: 42; (b) run_in_background: 'yes';
 *                  (c) timeoutMs: -1; (d) timeoutMs: '10000';
 *                  (e) timeoutMs: Infinity; (f) sandbox_permissions: 42.
 *                  Pre-fix the fields are silently ignored and the call
 *                  proceeds to the ask lane — a request is minted (the
 *                  deny-reason / zero-request / observe-row assertions
 *                  are the REDs; the probe settles every such request
 *                  deny so no never-resolving await survives).
 *   H5-C1  (GREEN guard — documented) same authority args + NEW callId
 *                  (new correlation) ⇒ SAME fingerprint, NEW request.
 *                  The same-fingerprint / new-request halves are GREEN
 *                  on both trees; the workdir-key-in-fingerprint half
 *                  (the request's fingerprint equals the `/A`-workdir
 *                  canonical fingerprint and DIFFERS from the `/B` one)
 *                  is RED pre-fix and pins the projection content
 *                  post-fix.
 *   H5-C2  (GREEN guard — documented) an approval minted for fingerprint
 *                  F (workdir /A) is NOT consumed by a different-
 *                  fingerprint operation (same command, workdir /B,
 *                  same correlation): post-fix the operation raises a
 *                  NEW request under the new fingerprint and executes
 *                  only under its own approval (scope exactness under
 *                  the new projection); pre-fix the same correlation +
 *                  same fingerprint returns the CONSUMED /A approval
 *                  idempotently and the operation is blocked
 *                  (allow-consumed) with NO new request — the new-
 *                  request / different-fingerprint / execution halves
 *                  are RED pre-fix (documented), the "the /A approval is
 *                  not consumed by the /B operation" half is GREEN on
 *                  both trees.
 *   H5-S1  (RED)   the request `summary` for a bash call with workdir
 *                  `sub`, run_in_background: true, timeoutMs: 5000
 *                  matches the exact expected string
 *                  `bash [cwd=/A/sub] [background] [timeout=5000ms]
 *                  echo hello world` (pre-fix: `bash echo hello world`
 *                  — the tokens are absent ⇒ RED). The preview-cap
 *                  NON-authority leg is a GREEN guard: two long
 *                  commands sharing the 120-char prefix but differing
 *                  after it produce IDENTICAL summaries (the bounded
 *                  preview) but DIFFERENT fingerprints (the commandHash
 *                  binds the raw command — the preview is never the
 *                  authority).
 *
 * ENVIRONMENT: the a5a-style env — a fake agent ctx (the double whose
 * `on` records the listener and whose `tools.guard` records the end-cap
 * guard — the install requires the seam, H1), the REAL A4 control
 * service over a fresh P6-T4 durable world, and the H5 FAKE RESOLVER:
 * a deterministic model of the session-cwd-`/A` backend —
 * `'.' → KEY_A`, `'/A' → KEY_A`, `'sub' → KEY_A_SUB`, `'/B' → KEY_B`
 * (stable `file:///` keys, no real fs; the fake records the full call
 * sequence for H5-B2). The direct-fingerprint probes (H5-B1…B7) run
 * `canonicalizeOperation` over fresh instances of the same fake — the
 * module is seam-injected, so no env is needed.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim): every async
 * scenario runs at MODULE level (top-level await) and captures its
 * results; the `it` bodies are pure synchronous assertions. Shim
 * matchers used: toBe / toEqual (+.not) only. No never-resolving await
 * is left anywhere: every request the probe can cause (pre-fix or
 * post-fix) is settled by the probe itself before its paused listener
 * is awaited — the waits are bounded polls.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does. (This new scannable file moves
 * the p4t6 pin 669 → 670 — see the DEC-1 comment chain in
 * `packages/testkit/test/p4t6-session-event-scan.test.ts`.)
 *
 * @module @dsh-agent-team/runtime/test/h5-bash-effects
 */
import { describe, expect, it } from 'vitest'
import { createControlService } from '../control/index.js'
import type {
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import {
  canonicalizeOperation,
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

// ---------------------------------------------------------------------------
// The opaque canonical keys of the H5 topology. The fake models ONE
// backend whose session cwd is `/A`: `'.'` and `'/A'` are the SAME
// identity (the effective-canonical ruling — plan B2); `'sub'` is a
// distinct subdirectory identity; `'/B'` is a different directory.
// ---------------------------------------------------------------------------

/** The identity of the session cwd `/A` (omitted workdir ≡ explicit `/A`). */
const KEY_A = 'file:///A'
/** The identity of `/A/sub` (a relative workdir spelling). */
const KEY_A_SUB = 'file:///A/sub'
/** The identity of the different directory `/B`. */
const KEY_B = 'file:///B'

/** A real-timer sleep (bounded waits only — no never-resolving await). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// The H5 fake resolver (the a5a-style deterministic double, specialized
// to the session-cwd-`/A` model the brief mandates): a fixed table of
// workdir spellings → stable keys + displays, with the full call
// sequence (paths + returned keys, in order) recorded for H5-B2. A
// spelling outside the table resolves by the default local rule
// (`file:///<normalized>`) — it never throws (this probe set only
// exercises the table + the default).
// ---------------------------------------------------------------------------

interface H5FakeResolver {
  readonly resolver: (path: string) => Promise<{ readonly key: string; readonly display: string }>
  /** Every path passed to the resolver, in order (the raw spelling). */
  readonly calls: string[]
  /** Every key the resolver returned, in order (parallel to `calls`). */
  readonly keys: string[]
}

const H5_TABLE: ReadonlyMap<string, { readonly key: string; readonly display: string }> = new Map([
  ['.', { key: KEY_A, display: '/A' }],
  ['/A', { key: KEY_A, display: '/A' }],
  ['sub', { key: KEY_A_SUB, display: '/A/sub' }],
  ['/B', { key: KEY_B, display: '/B' }],
])

function makeH5Resolver(): H5FakeResolver {
  const calls: string[] = []
  const keys: string[] = []
  const resolver = async (path: string): Promise<{ readonly key: string; readonly display: string }> => {
    calls.push(path)
    const hit = H5_TABLE.get(path)
    const key = hit !== undefined ? hit.key : `file:///${path.replace(/\\/g, '/')}`
    const display = hit !== undefined ? hit.display : path
    keys.push(key)
    return { key, display }
  }
  return { resolver, calls, keys }
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
    if (listener === undefined) throw new Error('h5 fake ctx: no listener registered')
    return listener(exec, next)
  }
  return { on, tools: { guard }, trigger }
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
  readonly resolver: H5FakeResolver
  readonly observations: Record<string, unknown>[]
}

/**
 * Build one probe world: a fresh P6-T4 durable world, the REAL control
 * service over it (waitPollIntervalMs: 10 — the A4-injected fast poll
 * cadence), and ONE adapter install on a fresh fake ctx (member — the
 * ask lane routes to leader-approval). The bash policy is `default:
 * 'ask'` with no rules — every well-formed bash call asks (the H5 probe
 * set is about the fingerprint / summary / fail-closed behavior of the
 * ask lane, not about static matching).
 */
async function createEnv(basename: string): Promise<Env> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const resolver = makeH5Resolver()
  const observations: Record<string, unknown>[] = []
  const policy: TemplatePermissionPolicy = {
    default: 'ask',
    allow: [],
    ask: [],
    deny: [],
  }
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
 * Bounded wait for a durable request matching a predicate: `undefined`
 * when none appears within the bound (the post-fix fail-closed path —
 * no request is ever created). The bound keeps the GREEN run fast and
 * the RED run bounded: whenever a request DOES appear (the pre-fix ask
 * downgrade), the probe settles it before the paused decision is
 * awaited, so no never-resolving await survives.
 */
async function waitForRequestOrUndefined(
  service: ControlService,
  match: (request: ControlRequestRecord) => boolean,
  attempts = 60,
): Promise<ControlRequestRecord | undefined> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const state = await service.listControlState(P6T4_ROOT)
    const found = state.requests.find(match)
    if (found !== undefined) return found
    await sleep(5)
  }
  return undefined
}

/** The deny reason text of a decision (undefined for an allow). */
const denyReason = (
  decision: PreToolDecisionLike,
): string | undefined =>
  decision.kind === 'deny' ? decision.reason : undefined

/** The `canonicalization-failed` observations for one callId. */
const canonicalizationFailures = (
  observations: readonly Record<string, unknown>[],
  callId: string,
): readonly Record<string, unknown>[] =>
  observations.filter(
    (o) => o['stage'] === 'canonicalization-failed' && o['callId'] === callId,
  )

// ===========================================================================
// Direct-fingerprint probes (H5-B1…B7) — canonicalizeOperation over
// fresh H5 fake resolvers (the module is seam-injected; no env needed).
// ===========================================================================

const FP = await (async () => {
  const fp = async (args: Record<string, unknown>): Promise<string> => {
    const resolver = makeH5Resolver()
    return (await canonicalizeOperation({ name: 'bash', arguments: args, resolveTarget: resolver.resolver }))
      .fingerprint
  }

  // H5-B1 — workdir /A vs /B (RED pre-fix: identical command-only fps).
  const b1 = {
    workdirA: await fp({ command: 'ls -la', description: 'list', workdir: '/A' }),
    workdirB: await fp({ command: 'ls -la', description: 'list', workdir: '/B' }),
  }

  // H5-B2 — omitted vs explicit /A (same effective cwd). ONE resolver
  // instance so the call log is exactly these two resolutions: post-fix
  // the omitted call resolves '.' and the explicit one '/A' — both to
  // KEY_A (the effective-canonical ruling). Pre-fix the resolver is
  // NEVER called for bash (the key half is RED — documented).
  const b2Resolver = makeH5Resolver()
  const b2Omitted = await canonicalizeOperation({
    name: 'bash',
    arguments: { command: 'ls -la', description: 'list' },
    resolveTarget: b2Resolver.resolver,
  })
  const b2ExplicitA = await canonicalizeOperation({
    name: 'bash',
    arguments: { command: 'ls -la', description: 'list', workdir: '/A' },
    resolveTarget: b2Resolver.resolver,
  })
  const b2 = {
    omitted: b2Omitted,
    explicitA: b2ExplicitA,
    calls: [...b2Resolver.calls],
    keys: [...b2Resolver.keys],
  }

  // H5-B3 — run_in_background omitted/false vs true (RED pre-fix).
  const b3 = {
    omitted: await fp({ command: 'sleep 5', description: 'wait' }),
    explicitFalse: await fp({ command: 'sleep 5', description: 'wait', run_in_background: false }),
    explicitTrue: await fp({ command: 'sleep 5', description: 'wait', run_in_background: true }),
  }

  // H5-B4 — timeoutMs omitted vs 10000 vs 20000 (RED pre-fix).
  const b4 = {
    omitted: await fp({ command: 'make build', description: 'build' }),
    ten: await fp({ command: 'make build', description: 'build', timeoutMs: 10000 }),
    twenty: await fp({ command: 'make build', description: 'build', timeoutMs: 20000 }),
  }

  // H5-B5 — sandbox_permissions absent vs the two ESCALATION_TARGETS
  // modes of the pinned upstream dsh-sandbox (RED pre-fix).
  const b5 = {
    absent: await fp({ command: 'rm -rf out', description: 'clean' }),
    workspaceWrite: await fp({
      command: 'rm -rf out',
      description: 'clean',
      sandbox_permissions: 'workspace-write',
      justification: 'the out dir sits outside the read-only sandbox default',
    }),
    dangerFullAccess: await fp({
      command: 'rm -rf out',
      description: 'clean',
      sandbox_permissions: 'danger-full-access',
      justification: 'the out dir sits outside the read-only sandbox default',
    }),
  }

  // H5-B6 — description / justification EXCLUDED (GREEN guard).
  const b6 = {
    descA: await fp({ command: 'git status', description: 'show status' }),
    descB: await fp({ command: 'git status', description: 'totally different explanation' }),
    justA: await fp({
      command: 'git status',
      description: 'show status',
      sandbox_permissions: 'workspace-write',
      justification: 'reason A',
    }),
    justB: await fp({
      command: 'git status',
      description: 'show status',
      sandbox_permissions: 'workspace-write',
      justification: 'reason B (different)',
    }),
  }

  // H5-B7 — raw command binding (H2): `echo x` vs `echo  x` (GREEN guard).
  const b7 = {
    single: await fp({ command: 'echo x', description: 'x' }),
    double: await fp({ command: 'echo  x', description: 'x' }),
  }

  return { b1, b2, b3, b4, b5, b6, b7 }
})()

// ===========================================================================
// H5-B8 — malformed effect fields fail closed (RED pre-fix).
// ===========================================================================

const B8_CASES: ReadonlyArray<{
  readonly tag: string
  readonly reason: string
  readonly extra: Record<string, unknown>
}> = [
  { tag: 'a', reason: 'bash-workdir-not-a-string', extra: { workdir: 42 } },
  { tag: 'b', reason: 'bash-run-in-background-not-boolean', extra: { run_in_background: 'yes' } },
  { tag: 'c', reason: 'bash-timeout-ms-invalid', extra: { timeoutMs: -1 } },
  { tag: 'd', reason: 'bash-timeout-ms-invalid', extra: { timeoutMs: '10000' } },
  { tag: 'e', reason: 'bash-timeout-ms-invalid', extra: { timeoutMs: Infinity } },
  { tag: 'f', reason: 'bash-sandbox-permissions-not-a-string', extra: { sandbox_permissions: 42 } },
]

interface B8Result {
  readonly tag: string
  readonly reason: string
  readonly decision: PreToolDecisionLike
  readonly nextCalls: number
  readonly requestsForCall: number
  readonly totalRequests: number
  readonly failures: readonly Record<string, unknown>[]
}

const B8 = await (async () => {
  const env = await createEnv('h5-b8')
  const results: B8Result[] = []
  try {
    for (const c of B8_CASES) {
      const callId = `h5-b8-${c.tag}`
      const next = makeNext()
      const pPromise = env.ctx.trigger(
        makeExec({
          name: 'bash',
          arguments: { command: 'echo hi', description: 'hi', ...c.extra },
          callId,
        }),
        next.fn,
      )
      // Pre-fix the malformed fields are silently ignored: the call
      // reaches the ask lane and a request is minted. Settle it (deny)
      // so the paused listener cannot leave a never-resolving await
      // behind; post-fix no request ever appears (fail-closed DENY
      // before the request step) and the bounded wait returns undefined.
      const request = await waitForRequestOrUndefined(
        env.service,
        (r) => r.correlation === callId,
      )
      if (request !== undefined) {
        await env.service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'deny',
        })
      }
      const decision = await pPromise
      const state = await env.service.listControlState(P6T4_ROOT)
      results.push({
        tag: c.tag,
        reason: c.reason,
        decision,
        nextCalls: next.calls(),
        requestsForCall: state.requests.filter((r) => r.correlation === callId).length,
        totalRequests: state.requests.length,
        failures: canonicalizationFailures(env.observations, callId),
      })
    }
    const state = await env.service.listControlState(P6T4_ROOT)
    return { results, totalRequests: state.requests.length }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// H5-C1 — same authority args + new callId ⇒ SAME fingerprint, NEW
// request (documented: the workdir-key-in-fingerprint half is RED
// pre-fix).
// ===========================================================================

const C1 = await (async () => {
  const env = await createEnv('h5-c1')
  try {
    const args = { command: 'ls -la', description: 'list', workdir: '/A' }
    const next1 = makeNext()
    const p1 = env.ctx.trigger(makeExec({ name: 'bash', arguments: args, callId: 'h5-c1-a' }), next1.fn)
    const r1 = await waitForRequestOrUndefined(env.service, (r) => r.correlation === 'h5-c1-a')
    if (r1 === undefined) throw new Error('h5-c1: request A never appeared')
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: r1.requestId,
      decision: 'allow',
    })
    const d1 = await p1

    const next2 = makeNext()
    const p2 = env.ctx.trigger(makeExec({ name: 'bash', arguments: args, callId: 'h5-c1-b' }), next2.fn)
    const r2 = await waitForRequestOrUndefined(env.service, (r) => r.correlation === 'h5-c1-b')
    if (r2 === undefined) throw new Error('h5-c1: request B never appeared')
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: r2.requestId,
      decision: 'allow',
    })
    const d2 = await p2

    // The direct canonical fingerprints of the two workdir spellings
    // (fresh resolvers — the same table): post-fix the request carries
    // the /A-workdir fingerprint and differs from the /B one; pre-fix
    // both collapse to the command-only fingerprint (RED half).
    const fpA = (
      await canonicalizeOperation({
        name: 'bash',
        arguments: { command: 'ls -la', description: 'list', workdir: '/A' },
        resolveTarget: makeH5Resolver().resolver,
      })
    ).fingerprint
    const fpB = (
      await canonicalizeOperation({
        name: 'bash',
        arguments: { command: 'ls -la', description: 'list', workdir: '/B' },
        resolveTarget: makeH5Resolver().resolver,
      })
    ).fingerprint

    return {
      d1,
      next1Calls: next1.calls(),
      r1: { requestId: r1.requestId, correlation: r1.correlation, fingerprint: r1.operationFingerprint },
      d2,
      next2Calls: next2.calls(),
      r2: { requestId: r2.requestId, correlation: r2.correlation, fingerprint: r2.operationFingerprint },
      fpA,
      fpB,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// H5-C2 — an approval minted for fingerprint F (workdir /A) is NOT
// consumed by a different-fingerprint operation (same command, workdir
// /B, same correlation) ⇒ new request (documented: the scope-exactness
// halves are RED pre-fix — the same correlation + same fingerprint
// returns the consumed /A approval idempotently and the operation is
// blocked allow-consumed with NO new request).
// ===========================================================================

const C2 = await (async () => {
  const env = await createEnv('h5-c2')
  try {
    // op1: command X in /A (callId c) — the approval minted for F_A.
    const next1 = makeNext()
    const p1 = env.ctx.trigger(
      makeExec({
        name: 'bash',
        arguments: { command: 'ls -la', description: 'list', workdir: '/A' },
        callId: 'h5-c2',
      }),
      next1.fn,
    )
    const r1 = await waitForRequestOrUndefined(env.service, (r) => r.correlation === 'h5-c2')
    if (r1 === undefined) throw new Error('h5-c2: request 1 never appeared')
    if (r1.operationFingerprint === undefined) {
      throw new Error('h5-c2: request 1 has no operationFingerprint')
    }
    const fA: string = r1.operationFingerprint
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: r1.requestId,
      decision: 'allow',
    })
    const d1 = await p1

    // op2: the SAME command in /B under the SAME correlation.
    // Post-fix: a DIFFERENT fingerprint ⇒ a NEW request (the A4 scope
    // key includes the fingerprint — the same correlation under a
    // different fingerprint is a different approval), and the operation
    // executes only under its OWN approval. Pre-fix: same correlation +
    // same (command-only) fingerprint ⇒ the EXISTING /A request is
    // returned idempotently (already allow, already consumed) ⇒ the
    // last-mile guard is blocked (allow-consumed) ⇒ DENY, zero new
    // requests.
    const next2 = makeNext()
    const p2 = env.ctx.trigger(
      makeExec({
        name: 'bash',
        arguments: { command: 'ls -la', description: 'list', workdir: '/B' },
        callId: 'h5-c2',
      }),
      next2.fn,
    )
    const r2 = await waitForRequestOrUndefined(
      env.service,
      (r) => r.correlation === 'h5-c2' && r.operationFingerprint !== fA,
    )
    if (r2 !== undefined) {
      await env.service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: r2.requestId,
        decision: 'allow',
      })
    }
    const d2 = await p2

    // The /A approval was consumed exactly once — by op1. A direct
    // guard consult of the /A scope is allow-consumed in BOTH trees:
    // op2 never executed under the /A approval (post-fix it guards the
    // /B fingerprint; pre-fix its consult is the blocked second one).
    const guardA = await env.service.guardOperation({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'parameter-permission',
      toolName: 'bash',
      correlation: 'h5-c2',
      operationFingerprint: fA,
    })

    const state = await env.service.listControlState(P6T4_ROOT)
    return {
      d1,
      next1Calls: next1.calls(),
      r1: { requestId: r1.requestId, fingerprint: r1.operationFingerprint },
      d2,
      next2Calls: next2.calls(),
      r2: r2 === undefined ? undefined : { requestId: r2.requestId, fingerprint: r2.operationFingerprint },
      guardAAllowed: guardA.allowed,
      guardAReason: guardA.allowed ? undefined : guardA.reason,
      requests: state.requests.map((r) => ({
        correlation: r.correlation,
        requestId: r.requestId,
        fingerprint: r.operationFingerprint,
      })),
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// H5-S1 — the bash summary tokens (RED pre-fix) + the preview-cap
// non-authority leg (GREEN guard).
// ===========================================================================

const S1 = await (async () => {
  const env = await createEnv('h5-s1')
  try {
    // S1 main: workdir `sub`, run_in_background: true, timeoutMs: 5000.
    const nextMain = makeNext()
    const pMain = env.ctx.trigger(
      makeExec({
        name: 'bash',
        arguments: {
          command: 'echo   hello   world',
          description: 'greet',
          workdir: 'sub',
          run_in_background: true,
          timeoutMs: 5000,
        },
        callId: 'h5-s1',
      }),
      nextMain.fn,
    )
    const rMain = await waitForRequestOrUndefined(env.service, (r) => r.correlation === 'h5-s1')
    if (rMain === undefined) throw new Error('h5-s1: main request never appeared')
    const mainSummary: string = rMain.summary ?? ''
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: rMain.requestId,
      decision: 'allow',
    })
    const dMain = await pMain

    // S1 cap: two long commands sharing the first 120 characters but
    // differing after the cap. The bounded preview (the summary) is
    // IDENTICAL for both; the fingerprints DIFFER (the commandHash
    // binds the raw command — the preview is never the authority).
    const shared = 'x'.repeat(120)
    const nextA = makeNext()
    const pA = env.ctx.trigger(
      makeExec({
        name: 'bash',
        arguments: { command: `${shared} AAAA`, description: 'long A' },
        callId: 'h5-s1-cap-a',
      }),
      nextA.fn,
    )
    const nextB = makeNext()
    const pB = env.ctx.trigger(
      makeExec({
        name: 'bash',
        arguments: { command: `${shared} BBBB`, description: 'long B' },
        callId: 'h5-s1-cap-b',
      }),
      nextB.fn,
    )
    const rA = await waitForRequestOrUndefined(
      env.service,
      (r) => r.correlation === 'h5-s1-cap-a',
    )
    const rB = await waitForRequestOrUndefined(
      env.service,
      (r) => r.correlation === 'h5-s1-cap-b',
    )
    if (rA === undefined || rB === undefined) {
      throw new Error('h5-s1: cap requests never appeared')
    }
    // Settle both (deny) — no execution needed for the non-authority
    // pin; the settled denies also bound the paused listeners.
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: rA.requestId,
      decision: 'deny',
    })
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: rB.requestId,
      decision: 'deny',
    })
    const dA = await pA
    const dB = await pB

    return {
      mainSummary,
      dMain,
      nextMainCalls: nextMain.calls(),
      capSummaryA: rA.summary ?? '',
      capSummaryB: rB.summary ?? '',
      capFingerprintA: rA.operationFingerprint,
      capFingerprintB: rB.operationFingerprint,
      dA,
      dB,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ===========================================================================
// Assertions (pure — the shim's `it` bodies).
// ===========================================================================

describe('H5-B1: workdir A vs B — the fingerprint binds WHERE the shell runs', () => {
  it('the same command with workdir /A vs /B ⇒ DIFFERENT fingerprints (RED pre-fix: the command-only projection is identical)', () => {
    expect(FP.b1.workdirA).not.toBe(FP.b1.workdirB)
  })
})

describe('H5-B2: omitted ≡ explicit session-cwd workdir (the effective-canonical ruling)', () => {
  it('workdir omitted vs explicit /A ⇒ SAME fingerprint (GREEN on both trees — trivially pre-fix; the ruling post-fix)', () => {
    expect(FP.b2.omitted.fingerprint).toBe(FP.b2.explicitA.fingerprint)
  })
  it('both operations resolve through the seam to KEY_A (RED pre-fix: the resolver is never called for bash; post-fix the omitted call resolves "." and the explicit call "/A", both to KEY_A)', () => {
    expect(FP.b2.calls).toEqual(['.', '/A'])
    expect(FP.b2.keys).toEqual([KEY_A, KEY_A])
  })
})

describe('H5-B3: run_in_background — detached job vs foreground', () => {
  it('omitted/false vs true ⇒ DIFFERENT fingerprints (RED pre-fix)', () => {
    expect(FP.b3.omitted).toBe(FP.b3.explicitFalse)
    expect(FP.b3.omitted).not.toBe(FP.b3.explicitTrue)
  })
})

describe('H5-B4: timeoutMs — the EXPLICIT value only', () => {
  it('omitted vs 10000 ⇒ DIFFERENT (RED pre-fix); 10000 vs 20000 ⇒ DIFFERENT (RED pre-fix)', () => {
    expect(FP.b4.omitted).not.toBe(FP.b4.ten)
    expect(FP.b4.ten).not.toBe(FP.b4.twenty)
  })
})

describe('H5-B5: sandbox_permissions — the requested mode binds', () => {
  it('absent vs workspace-write ⇒ DIFFERENT (RED pre-fix); workspace-write vs danger-full-access ⇒ DIFFERENT (RED pre-fix)', () => {
    expect(FP.b5.absent).not.toBe(FP.b5.workspaceWrite)
    expect(FP.b5.workspaceWrite).not.toBe(FP.b5.dangerFullAccess)
  })
})

describe('H5-B6: description / justification are EXCLUDED from the projection', () => {
  it('description A vs B ⇒ SAME fingerprint (GREEN guard)', () => {
    expect(FP.b6.descA).toBe(FP.b6.descB)
  })
  it('justification A vs B (same sandbox_permissions) ⇒ SAME fingerprint (GREEN guard)', () => {
    expect(FP.b6.justA).toBe(FP.b6.justB)
  })
})

describe('H5-B7: the raw command binding (H2) is unchanged', () => {
  it('echo x vs echo␣␣x (raw differs) ⇒ DIFFERENT fingerprints (GREEN guard)', () => {
    expect(FP.b7.single).not.toBe(FP.b7.double)
  })
})

describe('H5-B8: malformed effect fields fail closed (RED pre-fix: silently ignored, the ask lane mints a request)', () => {
  const assertLeg = (tag: string, reason: string): void => {
    const leg = B8.results.find((x) => x.tag === tag)
    expect(leg !== undefined).toBe(true)
    const r = leg as B8Result
    expect(r.decision['kind']).toBe('deny')
    const dr = denyReason(r.decision)
    expect(dr !== undefined && dr.includes(reason)).toBe(true)
    expect(r.nextCalls).toBe(0)
    expect(r.requestsForCall).toBe(0)
    const row = r.failures[0]
    expect(row !== undefined).toBe(true)
    expect(String((row as Record<string, unknown>)['reason'] ?? '').includes(reason)).toBe(true)
  }
  it('H5-B8(a) workdir: 42 ⇒ fail-closed DENY with the closed reason bash-workdir-not-a-string, ZERO durable request, ZERO body, the canonicalization-failed observation row', () => {
    assertLeg('a', 'bash-workdir-not-a-string')
  })
  it('H5-B8(b) run_in_background: "yes" ⇒ fail-closed DENY with the closed reason bash-run-in-background-not-boolean, ZERO durable request, ZERO body, the canonicalization-failed observation row', () => {
    assertLeg('b', 'bash-run-in-background-not-boolean')
  })
  it('H5-B8(c) timeoutMs: -1 ⇒ fail-closed DENY with the closed reason bash-timeout-ms-invalid, ZERO durable request, ZERO body, the canonicalization-failed observation row', () => {
    assertLeg('c', 'bash-timeout-ms-invalid')
  })
  it('H5-B8(d) timeoutMs: "10000" ⇒ fail-closed DENY with the closed reason bash-timeout-ms-invalid, ZERO durable request, ZERO body, the canonicalization-failed observation row', () => {
    assertLeg('d', 'bash-timeout-ms-invalid')
  })
  it('H5-B8(e) timeoutMs: Infinity ⇒ fail-closed DENY with the closed reason bash-timeout-ms-invalid, ZERO durable request, ZERO body, the canonicalization-failed observation row', () => {
    assertLeg('e', 'bash-timeout-ms-invalid')
  })
  it('H5-B8(f) sandbox_permissions: 42 ⇒ fail-closed DENY with the closed reason bash-sandbox-permissions-not-a-string, ZERO durable request, ZERO body, the canonicalization-failed observation row', () => {
    assertLeg('f', 'bash-sandbox-permissions-not-a-string')
  })
  it('ZERO requests in the whole B8 env post-fix (RED pre-fix: one request per leg — six total)', () => {
    expect(B8.totalRequests).toBe(0)
  })
})

describe('H5-C1: same authority args + new callId ⇒ SAME fingerprint, NEW request', () => {
  it('both calls execute under their own approvals (next once each)', () => {
    expect(C1.d1).toEqual({ kind: 'allow' })
    expect(C1.next1Calls).toBe(1)
    expect(C1.d2).toEqual({ kind: 'allow' })
    expect(C1.next2Calls).toBe(1)
  })
  it('the requests are DISTINCT (new correlation ⇒ new request) but carry the SAME fingerprint', () => {
    expect(C1.r1.requestId).not.toBe(C1.r2.requestId)
    expect(C1.r1.fingerprint).toBe(C1.r2.fingerprint)
  })
  it('the fingerprint carries the workdir key: it equals the /A-workdir canonical fingerprint and DIFFERS from the /B one (RED pre-fix: the command-only fingerprint is workdir-blind)', () => {
    expect(C1.r1.fingerprint).toBe(C1.fpA)
    expect(C1.r1.fingerprint).not.toBe(C1.fpB)
  })
})

describe('H5-C2: the /A approval is not consumed by the /B operation (scope exactness)', () => {
  it('op1 (workdir /A) executes exactly once under its approval', () => {
    expect(C2.d1).toEqual({ kind: 'allow' })
    expect(C2.next1Calls).toBe(1)
  })
  it('op2 (workdir /B, same correlation) raises a NEW request with a DIFFERENT fingerprint (RED pre-fix: the consumed /A request is returned idempotently — no new request)', () => {
    expect(C2.r2 !== undefined).toBe(true)
    const r2 = C2.r2 as { requestId: string; fingerprint: string }
    expect(r2.requestId).not.toBe(C2.r1.requestId)
    expect(r2.fingerprint).not.toBe(C2.r1.fingerprint)
    expect(C2.requests.length).toBe(2)
  })
  it('op2 executes only under its OWN approval (RED pre-fix: blocked allow-consumed, zero execution)', () => {
    expect(C2.d2).toEqual({ kind: 'allow' })
    expect(C2.next2Calls).toBe(1)
  })
  it('the /A approval was consumed exactly once (by op1): a direct guard consult of the /A scope is blocked (GREEN guard — op2 never executed under the /A approval)', () => {
    expect(C2.guardAAllowed).toBe(false)
    expect(C2.guardAReason).toBe('allow-consumed')
  })
})

describe('H5-S1: the bash summary carries the effect tokens (RED pre-fix) and the preview is never the authority', () => {
  it('the request summary for workdir sub + background + timeout 5000 is exactly `bash [cwd=/A/sub] [background] [timeout=5000ms] echo hello world` (RED pre-fix: the tokens are absent)', () => {
    expect(S1.mainSummary).toBe('bash [cwd=/A/sub] [background] [timeout=5000ms] echo hello world')
    expect(S1.dMain).toEqual({ kind: 'allow' })
    expect(S1.nextMainCalls).toBe(1)
  })
  it('120-char shared prefix + different tails ⇒ IDENTICAL summaries but DIFFERENT fingerprints (the preview is display-only; the commandHash is the authority — GREEN guard)', () => {
    expect(S1.capSummaryA).toBe(S1.capSummaryB)
    expect(S1.capSummaryA.endsWith('...')).toBe(true)
    expect(S1.capFingerprintA).not.toBe(S1.capFingerprintB)
    expect(S1.dA['kind']).toBe('deny')
    expect(S1.dB['kind']).toBe('deny')
  })
})
