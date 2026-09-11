/**
 * A5 (alpha.2, plan §10) — the `tools/pre-execute` enforcement adapter.
 *
 * The agent-scoped listener that enforces the bound template's static
 * parameter-aware permission policy SYNCHRONOUSLY through the durable
 * Control plane (plan §10.1/§10.2 — the FROZEN pipeline):
 *
 * ```
 * tools/pre-execute(exec)
 *     ↓
 * classifyPermissionTool(exec.name)          (A2)
 *     ├ unsupported → await next()            (pass-through: zero control
 *     │                                rows, zero interference, the
 *     │                                resolver is NOT called)
 *     └ file / tool-level
 *         ↓
 *     canonicalizeOperation(...)              (A2 — fail closed on any
 *     ↓                                OperationPermissionError: deny,
 *                                       never next())
 *     resolveOperationPermission(...)         (A3 — pure static decision)
 *     ├ allow → await next()
 *     ├ deny  → return { kind: 'deny' }       (provenance in the reason)
 *     └ ask
 *         ↓
 *     requestControl(...)                     (A4 — durable row; kind =
 *         ↓                                isLeader ? 'user-approval'
 *                                             : 'leader-approval')
 *     awaitControlDecision(..., signal)       (A4 — the synchronous wait
 *         ↓                                bridge; abort → typed
 *                                             CONTROL_WAIT_ABORTED)
 *     ├ decision deny/stale-denied → return { kind: 'deny' }
 *     └ decision allow
 *         ↓
 *     guardOperation(exact scope + fingerprint)  (A4 — check-and-reserve
 *         ↓                                exactly once)
 *     ├ allowed → await next()
 *     └ blocked → return { kind: 'deny' }     (no-request here is a
 *                                             consistency anomaly — fail
 *                                             closed, never proceed)
 *
 * The listener is NOT the whole gate. The install ALSO registers a
 * MONOTONIC END-CAP GUARD on the SAME agent ctx through the public
 * `tools.guard` seam (H1 — the P0 fix; see R6):
 *
 * ```
 * [extensible tools/pre-execute waterfall — ANY listener in the chain
 *  may short-circuit it without reaching the Team listener]
 *     ↓  (one exec object flows waterfall → guard stage, upstream
 *        prepareExecution: the SAME object both stages see)
 * end-cap guard (this install, agent-scoped, monotonic — a guard has
 *     no allow result; listener ordering cannot turn a denial back
 *     into permission)
 *     ├ unsupported tool name            → abstain (undefined)
 *     ├ exec object marked by THIS install (static allow / resolved
 *     │  ask-allow — marked on the exec OBJECT, never on the token:
 *     │  the token is a symbol, not WeakSet-able)
 *     │                                → abstain (undefined)
 *     └ supported + UNMARKED (a hostile waterfall listener settled the
 *        decision without reaching the frozen pipeline)
 *                                   → DENY (the stable
 *                                     END_CAP_DENIAL_REASON)
 * ```
 *
 * What this module IS (and deliberately is NOT):
 *
 * - It IS the ONLY place the three frozen A2/A3/A4 APIs are composed into
 *   one pre-execute gate: it re-implements none of their logic (no
 *   canonicalization, no matching, no control-plane state — it calls the
 *   frozen APIs and maps their typed outcomes onto PreToolDecisions);
 * - it NEVER returns `{ kind: 'ask' }: the upstream pipeline routes a
 *   final 'ask' gate to the native approval service, which the Team
 *   permission plane does not use — the listener RESOLVES the ask
 *   internally (request → wait → guard) and returns allow/deny itself
 *   (plan §10.2; a returned 'ask' would be a second, parallel approval
 *   path);
 * - it is FAIL CLOSED (plan §7.5/§10.3): every non-allow outcome returns
 *   before `next()` is awaited, so the tool body is NEVER invoked
 *   (zero-effect invariant): unsupported pass-through, static deny,
 *   canonicalization failure, request failure, wait abort, wait closed,
 *   durable deny/stale-denied, guard block — all deny;
 * - it is AGENT-SCOPED: `installParameterPermissionListener` registers
 *   ONE listener on the ONE agent ctx it is given (the A6 glue installs
 *   it per agent lifecycle — fresh root / fresh member / cold resume —
 *   and drains the returned disposer on close, plan §11.2/§11.3);
 *   the module holds NO module-level mutable state (each install owns its
 *   own rule-canonicalization cache in a closure);
 * - it is SEAM-INJECTED: the only upstream surface it touches at runtime
 *   is the public `fs.resolve` seam, and only through the injected
 *   {@link import('./types.js').PathTargetResolver} closure (the A6 glue
 *   builds it over the `fsBackend` deps accessor — the host row's LAZY
 *   strict `ctx.get('fs')` global-store read, V1-1: the property proxy
 *   `agentCtx.fs` is topology-sensitive (the Cordis reflect walk) and can
 *   never resolve on the agent scope — with the agent's per-session
 *   workspace cwd, `exec.agent.session.header.cwd`, the upstream file
 *   tools' own resolution convention). This module
 *   never imports an upstream `@deepseek-ai/*` package; the agent ctx and
 *   the exec payload are typed by MINIMAL structural mirrors of the
 *   upstream surface (the glue is plain `.mjs` and passes the real cordis
 *   `Context`, whose `ctx.on` registration and `ctx.tools.guard`
 *   registration are both effects that return disposers — this factory
 *   returns ONE composite disposer: the listener is removed FIRST and
 *   the end-cap guard LAST, so the pair is torn down as a unit and the
 *   guard never outlives its listener).
 *
 * Design rulings (documented per the A5 brief; the report cites them):
 *
 * R1 — SIGNAL THREADING: the resolver type takes `(path)` only, so the
 *   per-call `exec.signal` is NOT threaded into the path resolution. The
 *   glue's closure captures the session cwd at INSTALL time; a per-call
 *   abort during a resolution is a documented residual (an aborted call
 *   can finish a fast identity read before the abort is observed —
 *   resolution is a cheap identity lookup with no side effects, and the
 *   zero-effect invariant is unaffected: a deny still denies, and an
 *   allow on an already-aborted call is aborted by the pipeline's own
 *   pre-dispatch cancellation checks).
 *
 * R2 — RULE CANONICALIZATION: the policy's `exact` rules are canonicalized
 *   LAZILY (per decision, once per distinct rule path, cached for the
 *   scope's lifetime in an install-owned `Map`): the install is
 *   synchronous (it returns the `ctx.on` disposer) and an install-time
 *   async canonicalization would either delay the listener's activation
 *   or require a fail-closed "rules not ready" window. Only SUCCESSFUL
 *   resolutions are cached; a failed rule resolution is NOT cached (it is
 *   retried on the next decision) and the rule is treated as
 *   NON-MATCHING for that decision. That is fail-closed end-to-end: a
 *   rule whose path the backend cannot resolve can only address a path
 *   that is equally unresolvable for an OPERATION, and such an operation
 *   fails ITS OWN canonicalization (the pipeline step before any rule is
 *   consulted) before it could be authorized — while a rule addressing a
 *   different, resolvable path has a different opaque key and cannot
 *   match the operation. Exact rules whose `tool` differs from the
 *   operation's tool (and every `bash` exact rule — inert by
 *   construction, A3) are never canonicalized at all (they can never
 *   match, so the resolver is never called for them). Rules are thus
 *   canonicalized against the SAME cwd basis as operations: the SAME
 *   injected resolver closure, bound to the SAME session cwd at install.
 *
 * R3 — PRE-ABORTED SIGNAL: checked cheaply at the TOP of the ask branch
 *   (after the static decision is known to be 'ask', before
 *   `requestControl`): an already-aborted call is DENIED WITHOUT CREATING
 *   A REQUEST ROW (the documented preferred choice — no orphan pending
 *   request for a call that will never execute). Static allow/deny are
 *   unaffected by a pre-aborted signal: they never wait, and the
 *   pipeline's own pre-dispatch cancellation checks guarantee the tool
 *   body still never runs. An abort BETWEEN `requestControl` and the
 *   wait (or mid-wait) settles typed `CONTROL_WAIT_ABORTED` from the
 *   wait bridge → deny; in that window the durable request row stays
 *   pending (acceptable alpha.2 behavior — cancellation never decides;
 *   a later resolve is unaffected).
 *
 * R4 — WAIT POLL HINT: the A5 brief's optional `waitPollIntervalMsHint`
 *   parameter is DROPPED: A4 already injects the poll cadence at
 *   service-construction time (`ControlServiceOptions.waitPollIntervalMs`),
 *   and the adapter receives the service fully constructed — the hint
 *   would have been a redundant public tunable on a closed seam. Tests
 *   construct their service with `waitPollIntervalMs: 10` directly.
 *
 * R5 — GUARD VERDICT MAPPING: the last-mile guard's `no-request` verdict
 *   FAILS CLOSED here (deny with a diagnostic reason): in this pipeline
 *   the adapter just created the request for the exact scope it is
 *   guarding, so a `no-request` verdict is a consistency anomaly, never
 *   an open autonomy path. This deliberately does NOT reuse the
 *   team-tools SD-GUARD "no-request → proceeds" mapping
 *   (`packages/tools/src/guard.ts` — the `team_request_control` tool
 *   hosts both controlled and uncontrolled operations, where no-request
 *   is the ordinary leader-autonomy fall-through; a different consumer).
 *
 * R6 — MONOTONIC END-CAP (H1 — the P0 fix): the upstream
 *   `tools/pre-execute` gate is an EXTENSIBLE waterfall — ANY listener
 *   in the chain (any plugin / preset / hook) may return a decision
 *   WITHOUT calling `next()`, short-circuiting the rest of the chain
 *   (the cordis waterfall semantics: the first returning listener
 *   settles the decision; a `prepend`-registered listener runs
 *   outermost and first). A hostile
 *   `ctx.on('tools/pre-execute', () => allow, { prepend: true })` on
 *   the agent ctx therefore settles the pre-dispatch decision BEFORE
 *   this listener ever runs — the whole frozen pipeline (static deny,
 *   canonicalization, the durable control plane) is bypassed and the
 *   tool body executes without any Team permission (the P0). The fix
 *   is the monotonic END-CAP GUARD registered on the SAME agent ctx
 *   through the public `tools.guard` seam (upstream `ToolGuard` — "a
 *   monotonic guard after the extensible tools/pre-execute waterfall;
 *   guards have no allow result, listener ordering cannot turn a
 *   denial back into permission"; the guard stage runs AFTER the
 *   waterfall and denies by returning a reason string, which the
 *   pipeline materializes as an `Error: <reason>` result BEFORE the
 *   body dispatches). Authorization is an INSTALL-SCOPED `WeakSet` over
 *   the exec OBJECT: the listener marks the exec exactly at the two
 *   final-allow points (static allow; resolved ask-allow) and NEVER on
 *   any deny/abort/failure path; the same exec object flows the
 *   waterfall and the guard stage (upstream `prepareExecution` holds
 *   one exec per execution), so object identity IS the identity.
 *   Marking the exec object (not the token) is forced: the upstream
 *   `ToolExecutionToken` is a symbol (not WeakSet-able). Consequences,
 *   all pinned by the h1a suite: (a) a supported permission tool whose
 *   exec is UNMARKED at the guard stage is DENIED with the stable
 *   {@link END_CAP_DENIAL_REASON} — zero control rows, body never runs;
 *   (b) a NESTED dispatch (a composite body calling `ctx.tools.execute`
 *   with `parent: exec.token`) creates a FRESH exec object — unmarked —
 *   so the nested call of a permission tool is end-cap denied in its
 *   own right (the nested dispatch is the upstream's own escape hatch,
 *   not a Team authorization path); (c) UNSUPPORTED tool names abstain
 *   (the guard never over-denies beyond the six permission tools);
 *   (d) the guard is AGENT-SCOPED (an upstream agent-ctx guard applies
 *   only to that agent) and INSTALL-SCOPED (fresh WeakSet per install)
 *   — two installs on two agents are independent; (e) the install is
 *   FAIL-CLOSED: an agent ctx WITHOUT the `tools.guard` seam rejects
 *   the install with the typed
 *   {@link PermissionGuardUnavailableError}
 *   (`alpha2-permission-guard-unavailable`) BEFORE any registration —
 *   zero partial state; a permissions agent never runs unguarded.
 *
 * Diagnostics: when `onObserve` is provided, small structured rows are
 *   emitted at the pipeline points (canonicalized operation, resolved
 *   decision + provenance, request created, decision arrived, guard
 *   verdict, and — R6 — the end-cap guard's denial, stage
 *   `end-cap-denial` with the tool name and the stable reason) — no
 *   file contents, no full argument payloads. An `onObserve` that
 *   throws never affects the decision (diagnostics are not authority).
 *
 * @module @dsh-agent-team/runtime/operation-permission/pre-execute-adapter
 */

import {
  canonicalizeOperation,
  classifyPermissionTool,
} from './canonical-operation.js'
import type {
  CanonicalOperation,
  PathTargetResolver,
} from './types.js'
import {
  PRE_EXECUTE_INSTALL_ERROR_CODES,
  PermissionGuardUnavailableError,
  isOperationPermissionError,
} from './errors.js'
import {
  resolveOperationPermission,
} from './permission-resolver.js'
import type {
  CanonicalRule,
  CanonicalRules,
  PermissionDecision,
} from './permission-resolver.js'
import {
  CONTROL_ERROR_CODES,
  CONTROL_REQUEST_KINDS,
  isControlError,
} from '../control/index.js'
import type {
  ControlDecisionRecord,
  ControlService,
  ControlWaitSignal,
} from '../control/index.js'
import type { ActionCaller } from '../admission/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'

// ---------------------------------------------------------------------------
// The minimal structural mirrors of the upstream pre-execute surface
// (R-ruling: no upstream type imports — the glue is .mjs and passes the
// real cordis Context / ToolExecution, which satisfy these structurally).
// ---------------------------------------------------------------------------

/**
 * The pre-dispatch decision this listener can produce (a structural
 * mirror of the upstream `PreToolDecision`). The listener never produces
 * the `ask` variant (it resolves asks internally — see the module docs).
 */
export type PreToolDecisionLike =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly reason: string }
  | { readonly kind: 'ask'; readonly reason?: string }

/**
 * The minimal structural mirror of the upstream `ToolExecution` payload
 * — ONLY the fields this adapter reads: the logical call identity
 * (`callId` — the correlation token), the tool name, the losslessly
 * parsed deep-frozen arguments, and the caller cancellation signal
 * (structurally a `ControlWaitSignal` — a real `AbortSignal` satisfies
 * it). `exec.agent` is NOT read: the session cwd is captured by the
 * injected resolver closure at install (R1).
 */
export interface PreExecuteExec {
  /** The stable logical invocation id (the control request correlation). */
  readonly callId: string
  /** The tool name (`exec.name`). */
  readonly name: string
  /** The losslessly-parsed, deep-frozen tool arguments (`exec.arguments`). */
  readonly arguments: unknown
  /** The caller's cancellation signal for this invocation. */
  readonly signal: ControlWaitSignal
}

/**
 * The minimal structural mirror of the exec payload the monotonic guard
 * stage receives (R6 / H1): ONLY the field the end-cap guard reads —
 * the tool name. The upstream `ToolExecution` satisfies it
 * structurally, and the guard stage receives the SAME exec object the
 * waterfall received (upstream `prepareExecution` holds one exec per
 * execution and passes it to both stages — object identity is the
 * identity the authorization `WeakSet` keys on).
 */
export interface GuardExecLike {
  /** The tool name (`exec.name`). */
  readonly name: string
}

/**
 * The minimal structural mirror of the agent-scoped registration surface
 * (the upstream cordis `Context.on` for the agent-scoped
 * `tools/pre-execute` waterfall): registering a listener is an effect —
 * `on` returns the disposer that removes it (the A6 glue stores it in
 * the agent lifecycle's disposer list, plan §11.3).
 */
export interface AgentPreExecuteCtx {
  /**
   * Register one waterfall listener on the named agent-scoped event.
   * @param event - the event name (`'tools/pre-execute'`).
   * @param listener - the waterfall listener (receives the exec payload
   *   and the `next` continuation; returning without calling `next`
   *   vetoes the rest of the chain, so a deny never reaches `next`).
   * @returns the disposer removing the listener.
   */
  on(
    event: string,
    listener: (
      exec: PreExecuteExec,
      next: () => Promise<PreToolDecisionLike>,
    ) => Promise<PreToolDecisionLike>,
  ): () => void
  /**
   * The agent-scoped tool-registry surface (R6 / H1): `guard`
   * registers a MONOTONIC tool guard on this agent — it runs AFTER the
   * extensible `tools/pre-execute` waterfall (the end-cap stage; the
   * upstream `ToolGuard` has no allow result, and listener ordering
   * cannot turn its denial back into permission) and applies only to
   * this agent. The end-cap guard REQUIRES this seam: an install
   * against a ctx without it fails closed
   * (`alpha2-permission-guard-unavailable`) BEFORE any registration
   * (zero partial state).
   */
  readonly tools: {
    guard(guard: (exec: GuardExecLike) => string | undefined): () => void
  }
}

// ---------------------------------------------------------------------------
// The install parameters (the A6 glue's frozen input contract).
// ---------------------------------------------------------------------------

/**
 * One installation of the parameter-permission pre-execute listener on
 * one agent ctx (the A6 glue builds these per agent lifecycle from the
 * bound template, the session cwd, and the team's control service).
 */
export interface InstallParameterPermissionListenerParams {
  /**
   * The bound template's static permission policy (A1 — deep-frozen,
   * A1-normalized: lanes in declaration order, `exact.path` trimmed).
   * The A3 resolver reads only `default` from it; the lanes arrive as
   * canonical rules built by THIS adapter (R2).
   */
  readonly policy: TemplatePermissionPolicy
  /**
   * The injected path-resolution seam (A2): the A6 glue's closure over
   * the upstream public `ctx.fs.resolve(path, { cwd: sessionCwd })`,
   * bound to THIS agent's session workspace cwd and unbranding the
   * `FsTarget.targetKey`. Used for BOTH operations and rules (R1/R2 —
   * the same cwd basis).
   */
  readonly resolveTarget: PathTargetResolver
  /** The durable control plane service (A4 — fully constructed). */
  readonly controlService: ControlService
  /** The team root session id (the TeamSession, invariant 9). */
  readonly rootSessionId: string
  /**
   * This agent's durable identity as an action caller:
   * `{ kind: 'instance', instanceId }` for both the leader (its leader
   * instance id) and members (their instance id).
   */
  readonly caller: ActionCaller
  /**
   * The calling agent's instance id — the operation's target instance
   * (same as `caller.instanceId` for both leader and member installs).
   */
  readonly targetInstanceId: string
  /**
   * The routing bit (plan §9.5): `true` for the leader install (ask →
   * `user-approval`, human-only resolver closure), `false` for members
   * (ask → `leader-approval`, leader-or-human resolver closure).
   */
  readonly isLeader: boolean
  /**
   * The optional diagnostics hook (the A6 glue wires it to its
   * observation surface). Small structured rows only (no file contents,
   * no full argument payloads); a throwing hook never affects the
   * decision.
   */
  readonly onObserve?: (observation: Record<string, unknown>) => void
}

/** The closed action name the adapter uses for its control scopes. */
const ACTION_NAME = 'parameter-permission'

/**
 * R6 / H1 — the STABLE end-cap denial reason (model-visible: the
 * pipeline materializes it as `Error: <this text>` before the body
 * dispatches). Emitted when a SUPPORTED permission tool's exec object
 * reached the guard stage UNMARKED — its pre-dispatch decision was
 * settled by the extensible `tools/pre-execute` chain without reaching
 * this install's frozen pipeline. The h1a suite pins this text
 * verbatim (the test mirrors the constant — a change must move both).
 */
export const END_CAP_DENIAL_REASON =
  'permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)'

/**
 * The bounded length of the tool-level (bash) command preview in the
 * control request summary (H2 P1-2).
 */
const BASH_COMMAND_PREVIEW_MAX = 120

/**
 * H2 P1-2 — the bounded NON-authority command preview of the tool-level
 * (bash) control request summary: the first 120 characters of the raw
 * command string, whitespace flattened to single spaces, `...` appended
 * when truncated.
 *
 * Display text ONLY (the durable `summary` field is "free text; NOT
 * authority data"): it NEVER enters the fingerprint, the control scope,
 * or any hash — the fingerprint carries the command HASH (A2), and the
 * preview is derived from the same raw string purely for human
 * readability (which shell payload is this request about?). The function
 * is total (never throws): malformed/absent arguments cannot reach it on
 * the frozen pipeline (canonicalization already failed closed), but the
 * defensive fallbacks keep it total for any caller.
 */
function commandPreview(rawArguments: unknown): string {
  if (typeof rawArguments !== 'object' || rawArguments === null || Array.isArray(rawArguments)) {
    return '(no arguments)'
  }
  const command = (rawArguments as Record<string, unknown>)['command']
  if (typeof command !== 'string') {
    return '(no command)'
  }
  const flattened = command.replace(/\s+/g, ' ').trim()
  if (flattened.length === 0) {
    return '(empty command)'
  }
  if (flattened.length > BASH_COMMAND_PREVIEW_MAX) {
    return flattened.slice(0, BASH_COMMAND_PREVIEW_MAX) + '...'
  }
  return flattened
}

// ---------------------------------------------------------------------------
// The install factory.
// ---------------------------------------------------------------------------

/**
 * Install the parameter-permission pre-execute listener on one agent ctx
 * (plan §10.1: installed only for agents whose bound template declares
 * `permissions` — the install decision itself is the A6 glue's; once
 * installed, this listener covers exactly that agent's calls).
 *
 * @param agentCtx - the agent-scoped registration surface (the upstream
 *   cordis agent `Context` — its `ctx.tools.guard` seam is REQUIRED; a
 *   ctx without it rejects the install, R6).
 * @param params - the frozen install parameters (policy, resolver,
 *   control service, identities, routing, optional diagnostics).
 * @throws {@link PermissionGuardUnavailableError} when the agent ctx
 *   lacks the `tools.guard` seam — thrown BEFORE any registration
 *   (zero partial state; R6).
 * @returns ONE composite disposer — the A6 glue stores it in the agent
 *   lifecycle's disposer list so close/dispose removes the listener and
 *   the end-cap guard (listener FIRST, guard LAST) and cold resume
 *   re-installs (plan §11.3).
 */
export function installParameterPermissionListener(
  agentCtx: AgentPreExecuteCtx,
  params: InstallParameterPermissionListenerParams,
): () => void {
  // R6 / H1 — FAIL CLOSED AT INSTALL (checked BEFORE any registration —
  // zero partial state: if this throws, nothing was registered and
  // nothing needs disposing). The end-cap guard requires the agent
  // ctx's public `tools.guard` seam; a ctx without it (a broken host,
  // or an upstream without the monotonic guard stage) CANNOT be
  // installed — the waterfall listener alone is bypassable by a hostile
  // `tools/pre-execute` listener, and a permissions agent must never
  // run unguarded. The typed error mirrors the A6 glue's V1-1
  // `alpha2-permission-fs-unavailable` install failure.
  {
    // The mirror types `tools` as present (the real ctx always has it);
    // the runtime check below is the defense against a broken host.
    const guardSeam: unknown = (agentCtx as { tools?: { guard?: unknown } }).tools?.guard
    if (typeof guardSeam !== 'function') {
      throw new PermissionGuardUnavailableError(
        `the agent ctx is missing the tools.guard seam required by the monotonic end-cap guard ` +
        `(code: ${PRE_EXECUTE_INSTALL_ERROR_CODES.ALPHA2_PERMISSION_GUARD_UNAVAILABLE}) — ` +
        'refusing to install the parameter permission listener without it',
      )
    }
  }

  const {
    policy,
    resolveTarget,
    controlService,
    rootSessionId,
    caller,
    targetInstanceId,
    isLeader,
  } = params

  /** The request kind this install routes asks to (plan §9.5). */
  const requestKind = isLeader
    ? CONTROL_REQUEST_KINDS.USER_APPROVAL
    : CONTROL_REQUEST_KINDS.LEADER_APPROVAL

  /**
   * R2 — the install-owned rule-canonicalization cache (lazy; successful
   * resolutions only — a failed rule resolution is retried on the next
   * decision, never cached). Keyed by the raw (A1-trimmed) rule path.
   */
  const ruleKeyCache = new Map<string, string>()

  /**
   * R6 / H1 — the INSTALL-SCOPED authorization set: the exec OBJECTS
   * this install authorized (marked exactly at the two final-allow
   * points — static allow and resolved ask-allow — and NEVER on any
   * deny/abort/failure path). The end-cap guard abstains on members and
   * denies every supported exec object that is not one. Object identity
   * is the identity: upstream `prepareExecution` holds one exec per
   * execution and the SAME object flows waterfall → guard stage; a
   * nested dispatch creates a FRESH exec object (unmarked, in its own
   * right). A `WeakSet` (never a `Set`): the exec objects are pipeline
   * transients and must not be retained; the token is a symbol (not
   * WeakSet-able), which is why the marker lives on the object.
   */
  const authorizedExecutions = new WeakSet<object>()

  /**
   * Emit one small diagnostics row (never throws into the pipeline —
   * diagnostics are not authority).
   */
  const observe = (row: Record<string, unknown>): void => {
    if (params.onObserve === undefined) return
    try {
      params.onObserve(row)
    } catch {
      // a throwing observation hook must never fail a permission decision
    }
  }

  /**
   * R2 — the canonical key of one `exact` rule path (cached), or
   * `undefined` when the path cannot be canonicalized (the rule then
   * does not match THIS decision — see the module doc for the
   * fail-closed argument).
   */
  const canonicalRuleKey = async (path: string): Promise<string | undefined> => {
    const cached = ruleKeyCache.get(path)
    if (cached !== undefined) return cached
    try {
      const { key } = await resolveTarget(path)
      ruleKeyCache.set(path, key)
      return key
    } catch {
      return undefined
    }
  }

  /**
   * R2 — map one raw A1 lane to A3 `CanonicalRule[]`: `any` rules pass
   * through unchanged; `exact` rules are canonicalized against the SAME
   * resolver (and thus the SAME cwd basis) as operations — only for
   * rules that can match this operation (same tool; a `bash` exact rule
   * is inert by construction and is never canonicalized); an
   * unresolvable rule path yields no rule (R2 — the fail-closed
   * argument is in the module docs).
   */
  const canonicalLane = async (
    rules: TemplatePermissionPolicy['allow'],
    tool: string,
  ): Promise<CanonicalRule[]> => {
    const out: CanonicalRule[] = []
    for (const rule of rules) {
      if (rule.tool !== tool) continue // a different tool can never match
      if (rule.resource.kind === 'any') {
        out.push({ tool: rule.tool, resource: { kind: 'any' } })
        continue
      }
      if (tool === 'bash') continue // bash exact rules are inert (A3)
      const key = await canonicalRuleKey(rule.resource.path)
      if (key === undefined) continue // unresolvable rule path: no match (R2)
      out.push({ tool: rule.tool, resource: { kind: 'exact', key } })
    }
    return out
  }

  /**
   * R2 — the policy lanes as A3 `CanonicalRules` for one operation tool
   * (the three lanes mapped in parallel — lane membership and lane
   * order are preserved exactly, plan §6.4/§8.3).
   */
  const canonicalRulesFor = async (tool: string): Promise<CanonicalRules> => {
    const [allow, ask, deny] = await Promise.all([
      canonicalLane(policy.allow, tool),
      canonicalLane(policy.ask, tool),
      canonicalLane(policy.deny, tool),
    ])
    return { allow, ask, deny }
  }

  /**
   * The frozen pipeline (plan §10.2) for one pre-execute payload.
   * NEVER returns `ask`; NEVER awaits `next()` after a deny decision;
   * every unexpected failure fails closed to a deny.
   */
  const enforce = async (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ): Promise<PreToolDecisionLike> => {
    const callId = typeof exec.callId === 'string' ? exec.callId : String(exec.callId)
    const name = typeof exec.name === 'string' ? exec.name : String(exec.name)
    const signal = exec.signal

    // (1) classify — unsupported tools pass through WITHOUT entering the
    // parameter resolver (plan §7.5/§10.2): zero control rows, zero
    // interference, the resolver is never called.
    const toolClass = classifyPermissionTool(name)
    if (toolClass.kind === 'unsupported') {
      return await next()
    }

    // (2) canonicalize (A2 — fail closed: a canonicalization failure
    // denies BEFORE any rule is consulted and BEFORE next() is ever
    // awaited — plan §7.5/§10.3).
    let operation: CanonicalOperation
    try {
      operation = await canonicalizeOperation({
        name,
        arguments: exec.arguments,
        resolveTarget,
      })
    } catch (error: unknown) {
      const reason = isOperationPermissionError(error)
        ? `permission denied: ${error.message}`
        : `permission denied: canonicalization failed for tool "${name}" (unexpected canonicalizer failure: ${
            error instanceof Error ? error.message : String(error)
          })`
      observe({
        stage: 'canonicalization-failed',
        callId,
        tool: name,
        reason,
      })
      return { kind: 'deny', reason }
    }
    observe({
      stage: 'canonicalized',
      callId,
      tool: operation.tool,
      resourceKind: operation.resource.kind,
      resourceDisplay: operation.resource.display,
      fingerprint: operation.fingerprint,
    })

    // (3) resolve the static decision (A3 — pure, synchronous).
    let decision: PermissionDecision
    try {
      const canonicalRules = await canonicalRulesFor(operation.tool)
      decision = resolveOperationPermission(policy, operation, canonicalRules)
    } catch (error: unknown) {
      // A3 is pure and total over well-formed input; an unexpected throw
      // is a programming fault — fail closed (plan §10.3: deny).
      return {
        kind: 'deny',
        reason: `permission denied: the static permission resolution failed (unexpected resolver failure: ${
          error instanceof Error ? error.message : String(error)
        })`,
      }
    }
    observe({
      stage: 'decision',
      callId,
      decision: decision.decision,
      provenance: {
        source: decision.provenance.source,
        effect: decision.provenance.effect,
        ...(decision.provenance.lane !== undefined
          ? { lane: decision.provenance.lane }
          : {}),
        ...(decision.provenance.ruleIndex !== undefined
          ? { ruleIndex: decision.provenance.ruleIndex }
          : {}),
      },
    })

    if (decision.decision === 'allow') {
      // R6 / H1 — mark THIS exec object as authorized by this install
      // (the same object the pipeline then flows to the end-cap guard
      // stage). Marking happens ONLY on final-allow paths — never on
      // any deny/abort/failure path.
      authorizedExecutions.add(exec)
      return await next()
    }
    if (decision.decision === 'deny') {
      const provenance =
        decision.provenance.source === 'rule'
          ? `the template's ${decision.provenance.lane} rule ${decision.provenance.ruleIndex}`
          : `the template's default (${decision.provenance.effect})`
      return {
        kind: 'deny',
        reason: `permission denied by the static permission policy: ${provenance} denies ${operation.tool} on ${operation.resource.display}`,
      }
    }

    // (4) ask — resolved internally (the listener never returns 'ask').
    // R3 — a pre-aborted signal denies WITHOUT creating a request row.
    if (signal.aborted) {
      return {
        kind: 'deny',
        reason: 'the approval wait was cancelled (the call was already aborted)',
      }
    }

    // (4a) request the durable control row (A4). A typed rejection
    // (malformed, stale target, envelope) fails closed — never swallowed.
    let record
    try {
      record = await controlService.requestControl({
        rootSessionId,
        caller,
        kind: requestKind,
        targetInstanceId,
        actionName: ACTION_NAME,
        toolName: name,
        correlation: callId,
        operationFingerprint: operation.fingerprint,
        // H2 P1-2: the tool-level (bash) summary carries a bounded
        // NON-authority command preview (first 120 chars, whitespace
        // flattened, `...` when truncated) — display text only, never
        // part of the fingerprint/scope/hash (those carry the command
        // HASH from A2).
        summary:
          operation.resource.kind === 'tool'
            ? `${name} ${commandPreview(exec.arguments)}`
            : `${name} ${operation.resource.display}`,
      })
    } catch (error: unknown) {
      const reason = isControlError(error)
        ? `permission request failed: ${error.message}`
        : `permission request failed: ${
            error instanceof Error ? error.message : String(error)
          }`
      observe({ stage: 'request-failed', callId, reason })
      return { kind: 'deny', reason }
    }
    observe({
      stage: 'request-created',
      callId,
      requestId: record.requestId,
      kind: record.kind,
      correlation: callId,
    })

    // (4b) wait for the durable decision (A4 wait bridge — liveness only;
    // the durable rows are the authority).
    let decisionRecord: ControlDecisionRecord
    try {
      decisionRecord = await controlService.awaitControlDecision({
        rootSessionId,
        requestId: record.requestId,
        signal,
      })
    } catch (error: unknown) {
      if (isControlError(error) && error.code === CONTROL_ERROR_CODES.CONTROL_WAIT_ABORTED) {
        return { kind: 'deny', reason: 'the approval wait was cancelled' }
      }
      if (isControlError(error) && error.code === CONTROL_ERROR_CODES.CONTROL_WAIT_CLOSED) {
        return { kind: 'deny', reason: `permission denied: ${error.message}` }
      }
      return {
        kind: 'deny',
        reason: `permission denied: the approval wait failed (unexpected wait failure: ${
          error instanceof Error ? error.message : String(error)
        })`,
      }
    }
    observe({
      stage: 'decision-arrived',
      callId,
      requestId: record.requestId,
      decision: decisionRecord.decision,
      ...(decisionRecord.reason !== undefined
        ? { reason: decisionRecord.reason }
        : {}),
      decisionSequence: decisionRecord.decisionSequence,
    })

    // (4c) any non-allow durable decision denies (deny / stale-denied —
    // a stale-denied request is closed and can never become an allow).
    if (decisionRecord.decision !== 'allow') {
      return { kind: 'deny', reason: 'the approval was denied' }
    }

    // (4d) the last-mile guard (A4 — check-and-reserve exactly once over
    // the EXACT scope including the operation fingerprint).
    let verdict
    try {
      verdict = await controlService.guardOperation({
        rootSessionId,
        targetInstanceId,
        actionName: ACTION_NAME,
        toolName: name,
        correlation: callId,
        operationFingerprint: operation.fingerprint,
      })
    } catch (error: unknown) {
      return {
        kind: 'deny',
        reason: `permission denied: the last-mile guard failed (unexpected guard failure: ${
          error instanceof Error ? error.message : String(error)
        })`,
      }
    }
    const guardReason = verdict.allowed === false ? verdict.reason : undefined
    observe({
      stage: 'guard-verdict',
      callId,
      allowed: verdict.allowed,
      ...(guardReason !== undefined ? { reason: guardReason } : {}),
      ...(verdict.requestId !== undefined ? { requestId: verdict.requestId } : {}),
      ...(verdict.decisionSequence !== undefined
        ? { decisionSequence: verdict.decisionSequence }
        : {}),
    })

    if (!verdict.allowed) {
      // R5 — in THIS pipeline a no-request verdict is a consistency
      // anomaly (the adapter just created the request for the exact
      // scope it guards): fail closed with the diagnostic reason.
      const reason =
        verdict.reason === 'no-request'
          ? 'permission denied: the last-mile guard found no request (consistency anomaly — the request was just created)'
          : `permission denied: the last-mile guard blocked the operation (${verdict.reason})`
      return { kind: 'deny', reason }
    }
    // R6 / H1 — the resolved ask-allow is the second (and final)
    // authorization point; mark before next().
    authorizedExecutions.add(exec)
    return await next()
  }

  const listener = (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ): Promise<PreToolDecisionLike> => {
    // A listener that REJECTS surfaces as a tool error result through
    // the pipeline's own catch (prepareExecution) — but the pipeline
    // contract is a decision, so the adapter maps every failure to a
    // deny internally and only unexpected faults escape as a rejection
    // (they still fail closed: the pipeline materializes an error
    // result BEFORE dispatch, so the tool body never runs).
    return enforce(exec, next)
  }

  /**
   * R6 / H1 — the monotonic end-cap guard (see R6 for the full ruling).
   * Registered on the SAME agent ctx; runs AFTER the extensible
   * `tools/pre-execute` waterfall, on the SAME exec object. Synchronous
   * and NEVER throws (a guard fault must not break dispatch — and the
   * guard can only deny, so it can never over-allow):
   * - unsupported tool name → `undefined` (abstain — no over-deny
   *   beyond the six permission tools);
   * - an exec object marked by THIS install → `undefined` (authorized:
   *   static allow or resolved ask-allow);
   * - supported + unmarked → the stable denial reason (the hostile
   *   waterfall short-circuit case — the P0): the pipeline
   *   materializes `Error: <reason>` BEFORE the body dispatches, and
   *   zero control rows are created, resolved, or consumed (the
   *   frozen pipeline never ran). One diagnostics row (stage
   *   `end-cap-denial`) — `observe()` already swallows a throwing hook.
   */
  const endCapGuard = (exec: GuardExecLike): string | undefined => {
    const name = typeof exec.name === 'string' ? exec.name : String(exec.name)
    const toolClass = classifyPermissionTool(name)
    if (toolClass.kind === 'unsupported') return undefined // abstain
    if (authorizedExecutions.has(exec)) return undefined // authorized by THIS install
    observe({ stage: 'end-cap-denial', tool: name, reason: END_CAP_DENIAL_REASON })
    return END_CAP_DENIAL_REASON
  }

  // R6 / H1 — the composite disposer: listener FIRST, guard LAST. The
  // guard is the monotonic last line of defense; tearing the pair down
  // as a unit (and re-installing fresh on cold resume) keeps the
  // agent-scoped registrations symmetric — the A6 glue stores this
  // single disposer in the agent lifecycle's `toolDisposers` slot
  // (plan §11.3) and cold resume calls the install again.
  const disposeListener = agentCtx.on('tools/pre-execute', listener)
  const disposeGuard = agentCtx.tools.guard(endCapGuard)
  return () => {
    disposeListener()
    disposeGuard()
  }
}
