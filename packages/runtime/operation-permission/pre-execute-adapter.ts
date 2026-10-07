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
 *     ┌ artifact-grant lane (strict-read + core-spill, guide §9) —
 *     │ read tool + injected port + (ask OR default-deny) decision:
 *     │ valid grant → checkExternalOperation(live) (the SAME external
 *     │ hard ceiling as the static-allow path; fail closed)
 *     │   ├ allowed → mark + await next()   (ALLOW WITHOUT a control
 *     │   └ denied  → return { kind: 'deny' })
 *     │ an explicit rule DENY and a static ALLOW never consult it —
 *     │ a grant is a floor, never a ceiling override; a port fault
 *     │ fails closed (no grant, unchanged pipeline)
 *     └
 *     ├ allow
 *     │   ├ LEADER exec-class (bash/pwsh) WITHOUT the matching exec token
 *     │   │   in execEnvelopeOps (the mutation-envelope DUAL GATE —
 *     │   │   exec-autonomy-contract, user ruling 2026-09-18; fail
 *     │   │   closed: absent option = no exec authorization)
 *     │   │   → fall through to the ask path below (kind
 *     │   │     'user-approval'; zero effect until the human approves)
 *     │   └ otherwise → checkExternalOperation(live)  (A2C-4 — the
 *     │       │     external hard last-mile recheck; fail closed)
 *     │       │   ├ allowed → await next()
 *     │       │   └ denied  → return { kind: 'deny' } (zero effect: NOT marked)
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
 *         ↓                                exactly once; the live
 *                                             external hard recheck A2C-4
 *                                             runs INSIDE the guard,
 *                                             before the consumption
 *                                             write — a tightened cell
 *                                             blocks WITHOUT consuming)
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
 *   the static-path external recheck deny (A2C-4 — the exec is never
 *   marked, the end-cap stays armed), canonicalization failure, request
 *   failure, wait abort, wait closed, durable deny/stale-denied, guard
 *   block (including the guard's external-policy block — zero allow
 *   consumption) — all deny;
 * - it is AGENT-SCOPED: `installParameterPermissionListener` registers
 *   ONE listener on the ONE agent ctx it is given (the A6 glue installs
 *   it per agent lifecycle — fresh root / fresh member / cold resume —
 *   and drains the returned disposer on close, plan §11.2/§11.3);
 *   the module holds NO module-level mutable state AT ALL (H4 — the
 *   P1-A fix: the install owns no rule-canonicalization cache either —
 *   every decision fresh-resolves the rules through the same live
 *   resolver / session-cwd basis as the operation, so cold resume is
 *   trivially consistent: nothing is stored, so nothing stale survives
 *   a restart);
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
 *   glue's closure reads the session cwd LAZILY at resolve time (FACT
 *   3b — the live session header, never captured at install); a per-call
 *   abort during a resolution is a documented residual (an aborted call
 *   can finish a fast identity read before the abort is observed —
 *   resolution is a cheap identity lookup with no side effects, and the
 *   zero-effect invariant is unaffected: a deny still denies, and an
 *   allow on an already-aborted call is aborted by the pipeline's own
 *   pre-dispatch cancellation checks).
 *
 * R2 — RULE CANONICALIZATION: the policy's `exact` rules are canonicalized
 *   FRESH on every permission decision (H4 — the P1-A fix: there is NO
 *   cache — install-lifetime or otherwise — and no invalidation, no TTL,
 *   no watcher): the same-tool exact rules are canonicalized FRESH for
 *   each permission decision, against the same live resolver / session-
 *   cwd basis as the operation, so the rule and the operation of one
 *   decision always carry identities from the same point in time. Why
 *   fresh: the operation is canonicalized fresh on every decision (plan
 *   §10.2 — A2 has no cache), and a rule key pinned at an EARLIER
 *   decision goes stale the moment the filesystem identity of the rule
 *   path changes (a symlink/junction retarget moves the upstream
 *   targetKey) — a stale DENY stops matching (an escalation: the
 *   decision downgrades to the default, where an approval can then
 *   authorize what the policy statically forbade) and a stale ALLOW
 *   keeps authorizing a resource the rule path no longer denotes. The
 *   cost is one resolver call per same-tool exact rule per decision —
 *   the same lazy fs seam the operation already uses. The install is
 *   synchronous (it returns the `ctx.on` disposer) and an install-time
 *   async canonicalization would either delay the listener's activation
 *   or require a fail-closed "rules not ready" window. A FAILED rule
 *   resolution is never remembered (there is no cache — success or
 *   failure — so the next decision retries it) and the rule is treated
 *   as NON-MATCHING for that decision. That is fail-closed end-to-end: a
 *   rule whose path the backend cannot resolve can only address a path
 *   that is equally unresolvable for an OPERATION, and such an operation
 *   fails ITS OWN canonicalization (the pipeline step before any rule is
 *   consulted) before it could be authorized — while a rule addressing a
 *   different, resolvable path has a different opaque key and cannot
 *   match the operation. Exact rules whose `tool` differs from the
 *   operation's tool (and every shell-class exact rule — `bash` /
 *   `pwsh`, inert by construction, A3) are never canonicalized at all
 *   (they can never match, so the resolver is never called for them). Rules are thus
 *   canonicalized against the SAME cwd basis as operations: the SAME
 *   injected resolver closure, which reads the agent's live session cwd
 *   LAZILY at resolve time (FACT 3b — never captured at install). The
 *   resolver result is validated BEFORE use (H4): a non-plain result, a
 *   non-string key, an empty key, or the glue's
 *   `String(target.targetKey)` sentinel — a missing upstream targetKey
 *   surfaces as the string 'undefined', which is NOT a key — is a
 *   failure, never a key (a silent 'undefined' key could match a rule
 *   whose targetKey was literally that string — authority minted from a
 *   seam violation).
 *   P1-3 (H2, option A) — LANE ASYMMETRY on rule canonicalization
 *   failure: the "both resolve or both fail" argument above does not
 *   hold in general — the operation and the rule are SEPARATE
 *   resolver calls at different times over a mutable filesystem (a
 *   transient IO error, a mount/symlink change, or a session-cwd
 *   rewrite between the rule's resolution and the operation's can
 *   make one resolve and the other fail, or vice versa). The
 *   per-lane consequences of a FAILED rule are therefore NOT
 *   symmetric: a failed ALLOW rule = no positive grant (the operation
 *   is never elevated — at worst it is asked about); a failed ASK
 *   rule = falls to the default, which is ask (the same outcome) or
 *   deny (more restrictive) — not an escalation; a failed DENY rule
 *   = the static deny downgrades to ask/default and an approval may
 *   then authorize what the policy statically forbade — an
 *   escalation. Only the deny lane needs the fail-closed flip, and
 *   ONLY it gets it: a same-tool exact DENY rule that fails to
 *   canonicalize is reported by `canonicalLane` (per-lane
 *   `failedExact` — the raw trimmed paths) through
 *   `canonicalRulesFor.denyCanonicalizationFailure`, and the
 *   pipeline DENIES the operation BEFORE the A3 resolver is called
 *   (a stable reason naming the failed path(s) + an `onObserve` row,
 *   stage `deny-canonicalization-failure`). The allow/ask lanes KEEP
 *   the non-match-on-failure semantics above (rule skipped, never
 *   remembered — there is no cache (H4) — retried on the next decision).
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
 *   (the guard never over-denies beyond the seven permission tools —
 *   the A1 tools + the A2C-1 shell class `bash`/`pwsh`);
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
 *   `end-cap-denial` with the tool name and the stable reason,
 *   and — P1-3 — the deny-rule canonicalization failure, stage
 *   `deny-canonicalization-failure` with the tool and the failed
 *   path(s)) — no
 *   file contents, no full argument payloads. An `onObserve` that
 *   throws never affects the decision (diagnostics are not authority).
 *
 * @module @dsh-agent-team/runtime/operation-permission/pre-execute-adapter
 */

import {
  canonicalizeOperation,
  classifyPermissionTool,
} from './canonical-operation.js'
import {
  SHELL_PERMISSION_TOOL_VALUES,
} from './types.js'
import type {
  CanonicalOperation,
  PathTargetResolver,
} from './types.js'
import {
  PRE_EXECUTE_CAPABILITY_ERROR_CODES,
  PRE_EXECUTE_INSTALL_ERROR_CODES,
  capabilityDenialReason,
  PermissionGuardUnavailableError,
  isOperationPermissionError,
} from './errors.js'
import type { PreExecuteCapabilityErrorCode } from './errors.js'
import {
  resolveOperationPermission,
} from './permission-resolver.js'
import { recheckOperationApproval, routeOperationApproval } from './approval-routing.js'
import type { OperationApprovalFacts } from './approval-routing.js'
import type {
  CanonicalRule,
  CanonicalRules,
  PermissionDecision,
} from './permission-resolver.js'
import {
  CONTROL_ERROR_CODES,
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_GUARD_BLOCK_REASONS,
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
 * it). `exec.agent` is NOT read: the session cwd is read lazily at
 * resolve time by the injected resolver closure (R1, FACT 3b).
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
 * PR4 (pre-alpha3 permission lifecycle) — ONE answer of the caller-owned
 * DYNAMIC decision seam.
 *
 * `effect` is the EFFECTIVE effect of this round (the seam already folded
 * THIS decision's static lanes in — it never re-decides precedence inside
 * the adapter); `refused` is a TYPED refusal of the read plane (an ARCHIVED
 * or DISPOSED instance, an overlay the carrier grammar cannot decode, an
 * exec region the kernel could not answer): the adapter fails closed on it,
 * exactly like a canonicalization failure, and NEVER falls through to the
 * static answer.
 */
export type DynamicPermissionDecision =
  | {
      readonly effect: 'allow' | 'ask' | 'deny'
      /** Which merged plane answered (`'file'` / `'exec'`). */
      readonly plane: string
      /** The layer that answered (`'overlay' | 'template' | 'blueprint' | null`). */
      readonly winningLayer: string | null
      /** The overlay generation that answered (`null` = no overlay row yet). */
      readonly overlayGeneration: number | null
      /** A deterministic one-line explanation (observation only). */
      readonly explanation: string
      /**
       * PR4 round 3 (BLOCK-3) — the merged answer's OWN provenance class:
       * `'rule'` = an explicit rule answered (overlay OR a template/blueprint
       * lane rule); `'default'` = no rule matched and the layer DEFAULT
       * answered. The adapter routes the artifact-grant floor on THIS
       * (a merged DEFAULT deny keeps flowing the floor — the strict-read
       * core-spill use case survives the plane being wired; an EXPLICIT
       * deny never does — a grant is a floor, never a ceiling override).
       * Absent = a pre-round-3 producer: treated as `'rule'` (conservative
       * — byte-identical to the pre-fix posture where NO dynamic deny ever
       * reached the floor).
       */
      readonly source?: 'rule' | 'default'
    }
  | { readonly refused: true; readonly code: string; readonly reason: string }

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
   * reading THIS agent's session workspace cwd LAZILY at resolve time
   * (FACT 3b) and unbranding the `FsTarget.targetKey`. Used for BOTH
   * operations and rules (R1/R2 — the same cwd basis), FRESH on every
   * decision for both (H4 — no cache).
   */
  readonly resolveTarget: PathTargetResolver
  /**
   * A2C-7 (alpha.2 plan §9) — the containment authority seam: the
   * pinned upstream PUBLIC `FileSystem.contains(parent, child)` over
   * OPAQUE `FsTarget`s of the SAME provider (both handles produced by
   * `resolveTarget`'s live fs service — the glue passes the same
   * lazy `ctx.get('fs')` basis). The ONLY legal containment predicate
   * (plan §9.4: never `startsWith`, never targetKey parsing, never
   * consumer-side `node:path`). Optional — when absent, a `subtree`
   * rule's containment is UNDETERMINABLE (deny lane: fail-closed deny,
   * the rule cannot be dropped; allow/ask lanes: non-match — the P1-3
   * lane asymmetry). Pre-A2C-7 installers (no subtree rules in their
   * policies) are unaffected: the optionality is backward-compatible.
   * Synchronous (`boolean`, the pinned seam) or a thenable (a future
   * async backend) — both are awaited internally.
   */
  readonly containsTargets?: (parent: unknown, child: unknown) => boolean | Promise<boolean>
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
   * exec-autonomy-contract (user ruling 2026-09-18) — the DUAL GATE:
   * the exec-authorization tokens present in the LEADER's effective
   * mutation envelope (teamEnvelope ∩ the leader template's
   * `memberEnvelopes` entry, fail-closed — compute with
   * `leaderExecEnvelopeOps`).
   *
   * Leader install only: when the static policy resolves an exec-class
   * tool call (`bash` / `pwsh` — the shell class) to ALLOW, the matching
   * token must be present here for the allow to stand; a missing token —
   * or an absent option (the option is optional for signature
   * compatibility, but on a leader install its absence means NO exec
   * authorization) — DOWNGRADES the allow into the existing ask path
   * (`requestControl` kind `user-approval`, the human-only resolver
   * closure): zero effect until the human approves (the tool body never
   * runs, no exec is marked authorized).
   *
   * Member installs ignore this option: a member's exec call cannot be
   * ALLOW under the contract (the member allow lane rejects shell-class
   * rules at blueprint validation), so its ask path routes to
   * `leader-approval` (the leader decides; the human may stand in)
   * unchanged.
   */
/**
 * PR4 (pre-alpha3 permission lifecycle) — the DYNAMIC decision seam,
 * consulted AFTER the static (template) decision of step (3) and BEFORE the
 * artifact-grant / approval lanes, so what it reports is what those lanes
 * see.
 *
 * ABSENT (every pre-PR4 installer, every factory world, every existing spec)
 * the pipeline stays byte-for-byte the frozen one: the seam is additive and
 * is never consulted when unwired.
 *
 * It is NOT a second authority (plan PR4 "no second authority"): the overlay
 * it reads is the one `GovernanceMutationService.mutatePermission` appends
 * (ADR §2 — the highest generation is the authority, history is audit-only),
 * the layer precedence is the merged PR2 assembler's (blueprint < template <
 * overlay, and within a layer deny > ask > allow), the lifecycle gate is
 * ADR §8 (ARCHIVED / DISPOSED never execute; a fresh instance has no rows to
 * inherit), and the exec (fingerprint) plane is the governance kernel's own
 * pure effective-answer algebra. The adapter contributes NO precedence of
 * its own: the seam returns the effective effect of the round and the
 * adapter routes it through the SAME allow / ask / deny lanes the static
 * decision uses (so the exec dual gate and the approval floor keep applying
 * on top of it).
 *
 * `staticRules` / `staticDefault` are THIS decision's freshly canonicalized
 * static lanes (the same values the frozen resolver just consumed, H4 —
 * never cached), so the seam's answer and the static answer are computed
 * from one set of canonical identities.
 */
  readonly resolveDynamicDecision?: (input: {
    readonly operation: CanonicalOperation
    /**
     * PR4 round 3 (INFO-3): THIS decision's freshly canonicalized rules
     * PASSED THROUGH VERBATIM. The pre-fix `?? { allow: [], ask: [], deny: []
     * }` fallback claimed DECLARED-NONE where the adapter merely had no
     * value — a state the decision lane deliberately keeps DISTINCT
     * (UNKNOWN must never arrive as declared-none). The adapter always
     * canonicalizes before reaching the seam today; the `undefined` member
     * exists so no future path can re-fabricate the empty claim.
     */
    readonly staticRules: CanonicalRules | undefined
    readonly staticDefault: 'ask' | 'deny'
  }) => Promise<DynamicPermissionDecision | undefined>
  readonly execEnvelopeOps?: readonly string[]
  /**
   * Strict-read + Core-spill (implementation guide §9) — the injected
   * artifact-grant authorization port: for `read` decisions only, it
   * consults the Team's durable artifact-read grants (the
   * `artifact-read-granted` fact family) and reports whether a VALID
   * grant authorizes this exact read (composite producing identity +
   * exact requested locator + fresh fs identity — the authority owns
   * the fresh resolve+stat re-verification; the adapter supplies the
   * decision's own fresh canonicalization inputs).
   *
   * The port is the ONLY grant seam: the adapter never sees grants,
   * the registry, or fs identity beyond the opaque values already in
   * this decision's canonicalization (H4: nothing cached).
   *
   * The decision order it participates in (architecture §12): an
   * explicit rule DENY never consults it (the ceiling); a static ALLOW
   * never consults it (the unchanged path already rechecks the external
   * hard policy); for `ask` and default-`deny` reads a valid grant
   * authorizes the read WITHOUT a control request — after the SAME
   * external-hard last-mile recheck as the static-allow path (external
   * hard + grant → DENY). A faulting port fails closed: the read
   * proceeds through the unchanged pipeline (no grant).
   *
   * Optional — installers without it keep today's pipeline exactly.
   */
  readonly authorizeArtifactRead?: (args: {
    /** The reading agent's instance id (this install's target instance). */
    readonly instanceId: string
    /** The EXACT raw path the model requested (`read`'s `file_path`). */
    readonly rawPath: string
    /** The decision's freshly canonicalized resource key (the opaque fs target key). */
    readonly canonicalResourceKey: string
    /** The decision's freshly resolved opaque fs target handle (this batch only). */
    readonly targetHandle: unknown
  }) => Promise<boolean>
  /**
   * A4-PR4 lane A (alpha.4 plan Task 4, spec §10.1/§7.2-§7.4, acceptance
   * §21.4) — the v3 AUTHORITY FACTS port for an operation ask: the plane
   * answers with the beneficiary's ladder position and its two authority
   * documents for this instance, and `routeOperationApproval` derives the
   * MINIMUM AUTHORITY the operation requires. The frozen
   * `isLeader ? 'user-approval' : 'leader-approval'` routing stays the
   * fallback: an installer without this port, or a plane that answers
   * `undefined` (the Team is not on the v3 authority documents), gets the
   * pre-existing pipeline byte-identically until PR7 retires it.
   *
   * The port supplies FACTS and decides nothing: it never names a reviewer,
   * a request kind, or an effect. Those are derived from the documents by
   * the one evaluator, so "who approves" cannot be re-decided at a call
   * site (the mapping `permission-plane.ts` was chosen to own, per the
   * consumer rows `a3p3-governance-lane-hygiene.test.ts` states).
   *
   * It is consulted ONLY on the ask path — after canonicalization and the
   * capability preflight, before any durable row exists. A throwing port
   * fails closed with ZERO durable rows: an unreadable authority document
   * is not an absent one, and the alternative is opening a case whose
   * reviewer was guessed.
   *
   * Optional — installers without it keep today's routing exactly.
   */
  readonly operationApprovalRouting?: (input: {
    /** The operation class as the authority documents name it. */
    readonly operationClass: string
    /** The freshly canonicalized resource key of THIS invocation. */
    readonly resourceKey: string
  }) => Promise<OperationApprovalFacts | undefined>
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
 * The bounded length of the tool-level (shell class — `bash` / `pwsh`)
 * command preview in the control request summary (H2 P1-2; A2C-1).
 */
const SHELL_COMMAND_PREVIEW_MAX = 120

/**
 * H2 P1-2 — the bounded NON-authority command preview of the tool-level
 * (shell class) control request summary: the first 120 characters of the
 * raw command string, whitespace flattened to single spaces, `...`
 * appended when truncated.
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
  if (flattened.length > SHELL_COMMAND_PREVIEW_MAX) {
    return flattened.slice(0, SHELL_COMMAND_PREVIEW_MAX) + '...'
  }
  return flattened
}

/**
 * H5 P1-B (A2C-1: the shell class) — the bounded NON-authority shell
 * effect tokens of the control request summary: `<tool> [cwd=<workdirDisplay>]
 * [background] [sandbox=<mode>] [timeout=<n>ms] <command preview>`. All
 * four bracketed tokens are conditional (only when present/non-default:
 * `cwd=` is ALWAYS shown for the shell class — the workdir is always
 * effective; `background` when `run_in_background` is true;
 * `sandbox=<mode>` when the requested mode is non-null; `timeout=<n>ms`
 * when the explicit timeout is non-null).
 *
 * Display text ONLY (the durable `summary` field is "free text; NOT
 * authority data"): the tokens NEVER enter the fingerprint, the control
 * scope, or any hash — the fingerprint carries the CANONICAL effect
 * values (the workdir KEY, the boolean, the explicit number, the
 * requested mode string — A2/H5). The `cwd=` value is the RESOLVED
 * display (the operation's presentation field — the opaque key is what
 * binds); the other three are re-read from the SAME deep-frozen argument
 * record the canonicalizer consumed (canonicalization already failed
 * closed on malformed shapes — `workdir` is a string, `run_in_background`
 * a boolean, `timeoutMs` a finite number > 0, `sandbox_permissions` a
 * string — so the re-read only mirrors well-formed values; the function
 * stays total: any unexpected shape contributes no token).
 */
function shellEffectTokens(operation: CanonicalOperation, rawArguments: unknown): string {
  const parts: string[] = []
  if (operation.workdirDisplay !== undefined) {
    parts.push(`cwd=${operation.workdirDisplay}`)
  }
  if (typeof rawArguments === 'object' && rawArguments !== null && !Array.isArray(rawArguments)) {
    const args = rawArguments as Record<string, unknown>
    if (args['run_in_background'] === true) {
      parts.push('background')
    }
    const sandbox = args['sandbox_permissions']
    if (typeof sandbox === 'string') {
      parts.push(`sandbox=${sandbox}`)
    }
    const timeout = args['timeoutMs']
    if (typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0) {
      parts.push(`timeout=${timeout}ms`)
    }
  }
  if (parts.length === 0) {
    return ''
  }
  return parts.map((part) => `[${part}]`).join(' ')
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
    execEnvelopeOps,
    authorizeArtifactRead,
    operationApprovalRouting,
  } = params

  /** The request kind this install routes asks to (plan §9.5). */
  const requestKind = isLeader
    ? CONTROL_REQUEST_KINDS.USER_APPROVAL
    : CONTROL_REQUEST_KINDS.LEADER_APPROVAL

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
   * A2C-7 (plan §9) — the per-decision resolution batch: wraps the
   * injected resolver so every resolution ALSO registers its OPAQUE
   * handle (the upstream `FsTarget` of the SAME live provider) under
   * the validated key in THIS decision's map (created in `enforce`,
   * dropped at decision end — there is NO cache, install-lifetime or
   * otherwise, H4). The result passes through UNMODIFIED (the handle is
   * an additive runtime-only field the A2 canonicalizer ignores — it
   * destructures only `key`/`display`), and a malformed result
   * (non-plain / empty / `'undefined'`-sentinel key, or a missing
   * handle) registers nothing — the containment for that key is then
   * undeterminable, per lane (the P1-3 asymmetry below).
   */
  const resolveTracked = async (
    path: string,
    targetHandles: Map<string, unknown>,
  ): Promise<{ key: string; display: string; handle?: unknown }> => {
    const result = await resolveTarget(path)
    if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
      const { key, handle } = result as { key?: unknown; handle?: unknown }
      if (typeof key === 'string' && key !== '' && key !== 'undefined' && handle !== undefined) {
        targetHandles.set(key, handle)
      }
    }
    return result
  }

  /**
   * R2 — the canonical key of one `exact`/`subtree` rule path, resolved
   * FRESH on EVERY call (H4 — the P1-A fix: there is NO cache,
   * install-lifetime or otherwise, and nothing is remembered — a failed
   * resolution is retried on the next decision exactly like a successful
   * one), or `undefined` when the path cannot be canonicalized (the rule
   * then does not match THIS decision for the allow/ask lanes — see the
   * module doc for the fail-closed argument; a DENY-lane failure is
   * reported by `canonicalLane` — P1-3). Fresh-per-decision keeps the
   * rule on the SAME live identity the operation of this decision
   * carries (same resolver seam, same lazy session-cwd basis): a
   * symlink/junction retarget between decisions moves BOTH keys, so
   * the match follows the filesystem, never a stale snapshot.
   * (A2C-7: the resolution also registers the rule root's opaque
   * handle in the decision batch — the `subtree` branch below needs
   * the root target to call the containment seam.)
   */
  const canonicalRuleKey = async (
    path: string,
    targetHandles: Map<string, unknown>,
  ): Promise<string | undefined> => {
    let result: unknown
    try {
      result = await resolveTracked(path, targetHandles)
    } catch {
      return undefined
    }
    // Result-shape validation BEFORE use (the same fail-closed checks
    // canonicalizeOperation/resolveResource applies on the operation
    // path, plan §7.5): a non-plain result, a non-string key, or an
    // empty key is a malformed seam result — never a key. The glue
    // wraps the upstream targetKey with String(...), so a missing
    // targetKey surfaces as the string 'undefined' — pinned as a
    // failure here too (a silent 'undefined' key could match a rule
    // whose targetKey was literally that string: authority minted from
    // a seam violation).
    if (typeof result !== 'object' || result === null || Array.isArray(result)) {
      return undefined
    }
    const { key } = result as { key?: unknown }
    if (typeof key !== 'string' || key === '' || key === 'undefined') {
      return undefined
    }
    return key
  }

  /**
   * A2C-7 (plan §9) — one failed rule canonicalization in the DENY lane
   * (the P1-3 reporting unit): the raw trimmed path (A1 already trims
   * rule paths), the rule kind, and the machine-readable cause
   * (`root-not-canonicalizable` = the root path could not be resolved
   * / the seam result was malformed; `containment-undeterminable` =
   * the root resolved but the containment verdict could not be
   * established — no opaque handle on either side, no
   * `containsTargets` seam, or the seam itself faulted). The
   * allow/ask lanes report NOTHING (they keep the non-match-on-failure
   * semantics — a failed rule is simply a non-match, never a deny).
   */
  interface RuleCanonicalizationFailure {
    readonly path: string
    readonly kind: 'exact' | 'subtree'
    readonly cause: 'root-not-canonicalizable' | 'containment-undeterminable'
  }

  /**
   * R2 — map one raw A1 lane to A3 `CanonicalRule[]`: `any` rules pass
   * through unchanged; `exact` rules are canonicalized against the SAME
   * resolver (and thus the SAME cwd basis) as operations — only for
   * rules that can match this operation (same tool; a `bash` exact rule
   * is inert by construction and is never canonicalized); an
   * unresolvable rule path yields no rule (R2 — the fail-closed
   * argument is in the module docs). A2C-7 (plan §9): `subtree` rules
   * are canonicalized the same way (the root path FRESH on every
   * decision — H4, no install-time freeze: a retargeted alias follows
   * its new target on the next decision), and their match is the
   * OPERATION-RELATIVE containment boolean from the ONLY legal
   * authority — the pinned public `FileSystem.contains(rootTarget,
   * operationTarget)` over the per-decision handles of the SAME
   * provider (never `startsWith` / never key parsing, plan §9.4); an
   * undeterminable containment yields no match (allow/ask) or a
   * reported failure (deny — the rule cannot be dropped, fail-closed).
   * P1-3 (H2, option A): for the DENY lane, the failed same-tool rule
   * paths are ALSO reported via the result's `failures` (the raw
   * trimmed paths + cause); the allow/ask lanes report nothing (they
   * keep the non-match-on-failure semantics).
   */
  const canonicalLane = async (
    laneName: 'allow' | 'ask' | 'deny',
    rules: TemplatePermissionPolicy['allow'],
    tool: string,
    operation: CanonicalOperation,
    targetHandles: Map<string, unknown>,
    containsTargets: ((parent: unknown, child: unknown) => boolean | Promise<boolean>) | undefined,
  ): Promise<{ rules: CanonicalRule[]; failures?: readonly RuleCanonicalizationFailure[] }> => {
    const out: CanonicalRule[] = []
    let failures: RuleCanonicalizationFailure[] | undefined
    const reportFailure = (failure: RuleCanonicalizationFailure): void => {
      failures = failures === undefined ? [failure] : [...failures, failure]
    }
    for (const rule of rules) {
      if (rule.tool !== tool) continue // a different tool can never match
      if (rule.resource.kind === 'any') {
        out.push({ tool: rule.tool, resource: { kind: 'any' } })
        continue
      }
      // A2C-1 — shell-class exact rules (`bash` / `pwsh`) are inert by
      // construction (the tool-level resource key can never equal a file
      // key — A3) and are never canonicalized (the matcher's structural
      // defense in depth; the A1 schema additionally rejects an exact
      // shell-class resource in every lane, so a legal policy cannot
      // carry one). A2C-7 — the shell class likewise carries no
      // `subtree` rule (the schema rejects it in every lane — the
      // branch below is unreachable for a legal policy; the skip is the
      // matcher's structural defense in depth, same as for exact).
      if ((SHELL_PERMISSION_TOOL_VALUES as readonly string[]).includes(tool)) continue
      const key = await canonicalRuleKey(rule.resource.path, targetHandles)
      if (key === undefined) {
        // R2 — unresolvable rule path: no match (the rule is skipped; the
        // failure is never remembered — there is no cache (H4) — so the
        // NEXT decision retries the resolution).
        // P1-3 (H2, option A) — the deny lane FLIPS: a same-tool DENY
        // rule that failed to canonicalize is reported (the raw trimmed
        // path — A1 normalization already trimmed it) instead of being
        // silently dropped: a failed static deny must never downgrade to
        // ask/default. The allow/ask lanes keep the non-match-on-failure
        // semantics (the R2 module doc states the lane asymmetry).
        if (laneName === 'deny') {
          reportFailure({ path: rule.resource.path, kind: 'exact', cause: 'root-not-canonicalizable' })
        }
        continue
      }
      if (rule.resource.kind === 'subtree') {
        // A2C-7 (plan §9.4/§9.5) — the containment verdict comes ONLY
        // from the public `FileSystem.contains` seam (same provider —
        // both handles came from this decision's resolution batch).
        // `rootKey` is provenance only: it is never compared against
        // the operation key and can never infer containment.
        const rootHandle = targetHandles.get(key)
        const operationHandle =
          operation.resource.kind === 'file' ? targetHandles.get(operation.resource.key) : undefined
        if (rootHandle === undefined || operationHandle === undefined || containsTargets === undefined) {
          // Containment UNDETERMINABLE (no opaque handle on either side
          // — the pre-A2C-7 seam shape — or no containment seam at all).
          // Lane asymmetry (plan §9.8, the P1-3 pin): the DENY lane
          // fails CLOSED (the rule cannot be dropped — a failed static
          // deny must never downgrade); the allow/ask lanes keep
          // non-match-on-failure (no positive grant minted from a
          // failure — the outcome falls to the priority/default).
          if (laneName === 'deny') {
            reportFailure({ path: rule.resource.path, kind: 'subtree', cause: 'containment-undeterminable' })
          }
          continue
        }
        let containsOperation: boolean
        try {
          // The pinned seam is synchronous; a thenable (a future async
          // backend) is awaited — both are accepted by the contract.
          const verdict = await Promise.resolve(containsTargets(rootHandle, operationHandle))
          containsOperation = verdict === true
        } catch {
          // The seam itself faulted — containment undeterminable: the
          // same lane asymmetry as the missing-handle case above.
          if (laneName === 'deny') {
            reportFailure({ path: rule.resource.path, kind: 'subtree', cause: 'containment-undeterminable' })
          }
          continue
        }
        out.push({ tool: rule.tool, resource: { kind: 'subtree', rootKey: key, containsOperation } })
        continue
      }
      out.push({ tool: rule.tool, resource: { kind: 'exact', key } })
    }
    return { rules: out, ...(failures !== undefined ? { failures } : {}) }
  }

  /**
   * R2 — the policy lanes as A3 `CanonicalRules` for one operation tool
   * (the three lanes mapped in parallel — lane membership and lane
   * order are preserved exactly, plan §6.4/§8.3). P1-3 (H2, option A):
   * the result also carries `denyCanonicalizationFailure` (the raw
   * trimmed paths of the same-tool DENY rules that failed to
   * canonicalize — exact AND, A2C-7, subtree) — set from the deny lane
   * only; enforce denies BEFORE the A3 resolver is called when it is
   * present. A2C-7: `denyCanonicalizationCauses` carries the per-path
   * failure causes (the additive observe provenance — the frozen reason
   * text is unchanged).
   */
  const canonicalRulesFor = async (
    tool: string,
    operation: CanonicalOperation,
    targetHandles: Map<string, unknown>,
    containsTargets: ((parent: unknown, child: unknown) => boolean | Promise<boolean>) | undefined,
  ): Promise<{
    rules: CanonicalRules
    denyCanonicalizationFailure?: readonly string[]
    denyCanonicalizationCauses?: readonly RuleCanonicalizationFailure[]
  }> => {
    const [allow, ask, deny] = await Promise.all([
      canonicalLane('allow', policy.allow, tool, operation, targetHandles, containsTargets),
      canonicalLane('ask', policy.ask, tool, operation, targetHandles, containsTargets),
      canonicalLane('deny', policy.deny, tool, operation, targetHandles, containsTargets),
    ])
    // P1-3 (H2, option A): surface the DENY lane's canonicalization
    // failures (the raw trimmed paths of same-tool deny rules that
    // failed to canonicalize) so enforce can deny BEFORE the A3 resolver
    // is called. The allow/ask lanes report no such flag (their failures
    // keep the non-match-on-failure semantics).
    const denyFailures = deny.failures
    return {
      rules: { allow: allow.rules, ask: ask.rules, deny: deny.rules },
      ...(denyFailures !== undefined
        ? {
            denyCanonicalizationFailure: denyFailures.map((failure) => failure.path),
            denyCanonicalizationCauses: denyFailures,
          }
        : {}),
    }
  }

  /**
   * A4-PR4 lane B (spec §12.1/§13) — the ONE capability/environment probe
   * of this pipeline, called first as the preflight and again at each
   * last-mile recheck point. It wraps the shared read-only
   * `ControlService.checkExternalOperation` (the same hard-cell evaluator
   * the resolve-time probe and the guard use — this module never
   * re-implements a second host policy) and translates its verdict into
   * the typed family that separates "the host cannot run this" from "the
   * Team did not authorize this":
   *
   * - `allowed: true` — the host imposes no restriction on this cell;
   * - `EXTERNAL_RUNTIME_RESTRICTION` — the host stated a refusal (a hard
   *   deny cell, an allow-list that does not name the tool, or the shared
   *   check's own fail-closed reading of faulted/malformed external
   *   facts);
   * - `HOST_ENVIRONMENT_UNAVAILABLE` — the check itself threw, so not even
   *   a refusal is known. Fail-closed like every other outcome here.
   *
   * NEVER throws, NEVER writes a durable row, NEVER decides a Team
   * question: it answers only "can this runtime execute this tool right
   * now", and a caller that denies on its account denies WITHOUT opening
   * an approval case.
   */
  const preflightRuntimeCapability = async (
    toolName: string,
  ): Promise<
    | { readonly allowed: true }
    | { readonly allowed: false; readonly code: PreExecuteCapabilityErrorCode; readonly detail: string }
  > => {
    let verdict
    try {
      verdict = await controlService.checkExternalOperation({
        capabilityDomain: 'tools',
        toolName,
      })
    } catch (error: unknown) {
      return {
        allowed: false,
        code: PRE_EXECUTE_CAPABILITY_ERROR_CODES.HOST_ENVIRONMENT_UNAVAILABLE,
        detail:
          `the runtime capability check itself failed (unexpected check failure: ${
            error instanceof Error ? error.message : String(error)
          }) — no verdict about the host is available (fail-closed)`,
      }
    }
    if (verdict.allowed === false) {
      return {
        allowed: false,
        code: PRE_EXECUTE_CAPABILITY_ERROR_CODES.EXTERNAL_RUNTIME_RESTRICTION,
        detail: `the host runtime does not allow ${toolName} (${verdict.reason})`,
      }
    }
    return { allowed: true }
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
    // A2C-7 (plan §9) — the per-decision opaque-handle batch: the
    // tracked resolver wrapper registers every resolved key → opaque
    // FsTarget handle for THIS decision only (dropped at decision end —
    // there is NO cache, install-lifetime or otherwise — H4: the next
    // decision starts a fresh batch, so a retargeted alias follows its
    // new target). The A2 canonicalizer sees the same results (the
    // handle is an additive runtime-only field it ignores).
    const targetHandles = new Map<string, unknown>()
    let operation: CanonicalOperation
    try {
      operation = await canonicalizeOperation({
        name,
        arguments: exec.arguments,
        resolveTarget: (path: string) => resolveTracked(path, targetHandles),
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

    // (2b) A4-PR4 lane B (spec §12.1 — the execution order puts the
    // environment BEFORE the permission resolve): the CAPABILITY /
    // ENVIRONMENT PREFLIGHT. The host's live external hard policy is a
    // fact about what this runtime can execute at all; it is not a Team
    // decision, so it is asked BEFORE any Team question is answered and
    // BEFORE any durable approval case is opened. A refusal here writes
    // NOTHING durable (no request, no decision, no abandonment) and never
    // awaits `next()`: an approval case for an operation the host forbids
    // would ask a human to authorize the impossible, and the caller would
    // be told — in the permission vocabulary — that someone refused.
    // The check is the SAME shared read-only `checkExternalOperation`
    // the last-mile rechecks use (one hard-cell evaluator, invariant 34);
    // it is ADDITIVE: the last-mile rechecks below are retained, so a
    // policy that tightens after this point still blocks execution.
    const preflight = await preflightRuntimeCapability(name)
    if (preflight.allowed === false) {
      observe({
        stage: 'capability-preflight-denied',
        callId,
        tool: name,
        code: preflight.code,
        detail: preflight.detail,
      })
      return { kind: 'deny', reason: capabilityDenialReason(preflight.code, preflight.detail) }
    }

    // (3) resolve the static decision (A3 — pure, synchronous).
    // P1-3 (H2, option A) — BEFORE the A3 resolver is called: a
    // same-tool exact DENY rule that failed to canonicalize DENIES the
    // operation (fail-closed): a failed static deny must never downgrade
    // to ask/default — an approval could then authorize what the policy
    // statically forbade. (A failed ALLOW rule = no positive grant; a
    // failed ASK rule falls to the default, which is ask (the same
    // outcome) or deny (more restrictive) — neither is an escalation;
    // only the deny lane flips. The R2 module doc states the asymmetry.)
    let decision: PermissionDecision
    let canonicalRules: CanonicalRules | undefined
    try {
      const { rules, denyCanonicalizationFailure, denyCanonicalizationCauses } =
        await canonicalRulesFor(operation.tool, operation, targetHandles, params.containsTargets)
      canonicalRules = rules
      if (denyCanonicalizationFailure !== undefined) {
        // The frozen P1-3 reason text (h4/a5a pin the prefix via
        // .includes — it survives A2C-7 verbatim; the subtree paths ride
        // the same text; the per-path causes are additive on the
        // observe row only).
        const reason =
          `permission denied: a static deny rule could not be canonicalized ` +
          `(${denyCanonicalizationFailure.join(', ')}) — the rule cannot be dropped (fail-closed)`
        observe({
          stage: 'deny-canonicalization-failure',
          callId,
          tool: operation.tool,
          paths: [...denyCanonicalizationFailure],
          ...(denyCanonicalizationCauses !== undefined
            ? {
                // A2C-7 — the additive per-path provenance (the frozen
                // `paths` field above is unchanged).
                causes: denyCanonicalizationCauses.map((failure) => ({
                  path: failure.path,
                  kind: failure.kind,
                  cause: failure.cause,
                })),
              }
            : {}),
        })
        return { kind: 'deny', reason }
      }
      decision = resolveOperationPermission(policy, operation, rules)
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

    // (3a') PR4 — the DYNAMIC layer (the instance's durable overlay
    // authority + the ADR §8 lifecycle gate). UNWIRED = the frozen pipeline
    // continues here unchanged (no extra row, no extra await, no behavior
    // change). WIRED, three outcomes:
    //   - `undefined`  — the seam has nothing to say about this instance
    //                    (no overlay lane configured for it): the static
    //                    decision stands, exactly as before PR4;
    //   - `refused`    — the read plane REFUSED (archived / disposed /
    //                    undecodable overlay / unanswerable exec region):
    //                    fail closed with the typed reason. Falling back to
    //                    the static answer would let an archived instance
    //                    execute what its template allows, which is exactly
    //                    what ADR §8 forbids;
    //   - an `effect`  — the EFFECTIVE effect of this round (static layers
    //                    already folded in by the merged assembler / kernel
    //                    algebra), which then flows through the SAME allow /
    //                    ask / deny lanes below — so the exec dual gate, the
    //                    approval floor and the artifact-grant floor keep
    //                    their frozen positions on top of it. Round 3:
    //                    literally true for EVERY effect — a merged DENY no
    //                    longer short-circuits above; it routes at the
    //                    single deny site (with the floor's frozen say on
    //                    DEFAULT denies), which is what makes
    //                    ask-over-static-deny reach approval and lets the
    //                    core-spill floor survive the plane being wired.
    let dynamicEffect: 'allow' | 'ask' | 'deny' | undefined
    let dynamicSource: 'rule' | 'default' | undefined
    let dynamicDenyExplanation: string | undefined
    if (params.resolveDynamicDecision !== undefined) {
      let dynamic: DynamicPermissionDecision | undefined
      try {
        dynamic = await params.resolveDynamicDecision({
          operation,
          // The canonical lanes of THIS decision VERBATIM (the same values
          // the frozen resolver just consumed). Round 3 (INFO-3): NO
          // fabricated declared-none — an absent value stays absent (UNKNOWN),
          // which is the decision lane's own typed-refusal input, never a
          // silently empty rule set.
          staticRules: canonicalRules,
          staticDefault: policy.default,
        })
      } catch (error: unknown) {
        observe({
          stage: 'dynamic-decision-failed',
          callId,
          tool: operation.tool,
          reason: error instanceof Error ? error.message : String(error),
        })
        return {
          kind: 'deny',
          reason: `permission denied: the dynamic permission decision failed (unexpected read-plane failure: ${
            error instanceof Error ? error.message : String(error)
          })`,
        }
      }
      if (dynamic !== undefined && 'refused' in dynamic) {
        observe({
          stage: 'dynamic-decision-refused',
          callId,
          tool: operation.tool,
          code: dynamic.code,
          reason: dynamic.reason,
        })
        return { kind: 'deny', reason: `permission denied: ${dynamic.code} — ${dynamic.reason}` }
      }
      if (dynamic !== undefined) {
        dynamicEffect = dynamic.effect
        dynamicSource = dynamic.source ?? 'rule'
        dynamicDenyExplanation = dynamic.effect === 'deny' ? dynamic.explanation : undefined
        observe({
          stage: 'dynamic-decision',
          callId,
          tool: operation.tool,
          plane: dynamic.plane,
          decision: dynamic.effect,
          winningLayer: dynamic.winningLayer,
          overlayGeneration: dynamic.overlayGeneration,
          source: dynamicSource,
          staticDecision: decision.decision,
          explanation: dynamic.explanation,
        })
        // PR4 round 3 (BLOCK-2 + BLOCK-3): NO early return on a dynamic
        // deny. EVERY answer — allow, ask, deny — flows the SAME routing
        // below, so the merged effective effect (never the stale static
        // decision) decides: a merged ASK enters approval (the pre-fix
        // build denied outright: the approval bypass), a merged DEFAULT
        // deny still reaches the artifact-grant floor (the pre-fix early
        // return stranded it), and a merged RULE deny still blocks WITHOUT
        // consulting the floor (the ceiling stays a ceiling).
      }
    }
    // The SINGLE routing value of the rest of the pipeline: the dynamic
    // answer when the seam had one (overlay > template — the merged
    // assembler computed that precedence, the adapter did not), the static
    // decision otherwise. `effectiveSource` carries the SAME merged
    // provenance (never the static provenance re-read after a dynamic
    // answer overrode it — the pre-fix bug class).
    const effectiveEffect: 'allow' | 'ask' | 'deny' = dynamicEffect ?? decision.decision
    const effectiveSource: 'rule' | 'default' =
      dynamicSource ?? (decision.provenance.source === 'default' ? 'default' : 'rule')

    // (3b) Strict-read + Core-spill (implementation guide §9,
    // architecture §12) — the ARTIFACT-GRANT lane of the read decision.
    //
    // Eligibility (the frozen decision order — a grant is a floor,
    // never a ceiling override):
    // - an explicit rule DENY never reaches here (it settles as a deny
    //   below — explicit deny + grant → DENY, guide §9 critical case);
    // - a static ALLOW never reaches here (the unchanged allow path
    //   already carries the external-hard last-mile recheck);
    // - `ask` (explicit-ask rule OR default-ask) and default-`deny`
    //   reads consult the port: a valid grant authorizes the read
    //   WITHOUT a control request (explicit ask + grant → ALLOW, no
    //   request; default deny + grant → ALLOW — the strict-read core
    //   use case: the producer reads back its own out-of-workspace
    //   spill artifact).
    //
    // The port receives ONLY this decision's own fresh canonicalization
    // inputs (the exact raw path, the freshly resolved resource key +
    // opaque handle) — the authority re-verifies the fs identity FRESH
    // behind the port (H4: no cache anywhere on this path). A port
    // fault, a missing raw path, or a missing handle fails closed: the
    // read proceeds through the unchanged pipeline (no grant).
    //
    // A valid grant is authorized only AFTER the SAME external-hard
    // last-mile recheck the static-allow path carries (external hard +
    // grant → DENY — invariant 34: no Team decision bypasses the
    // external hard policy); marking + next() follow the frozen
    // allow-path convention (mark only on final-allow paths).
    if (name === 'read' && authorizeArtifactRead !== undefined) {
      // Round 3: the eligibility reads the MERGED answer's own provenance
      // (`effectiveSource` — identical to the static provenance whenever no
      // seam answered, the merged plane's source whenever it did).
      const grantLaneEligible =
        effectiveEffect === 'ask' || (effectiveEffect === 'deny' && effectiveSource === 'default')
      if (grantLaneEligible && operation.resource.kind === 'file') {
        const rawArguments =
          typeof exec.arguments === 'object' && exec.arguments !== null && !Array.isArray(exec.arguments)
            ? (exec.arguments as Record<string, unknown>)
            : undefined
        const rawPath = rawArguments !== undefined ? rawArguments['file_path'] : undefined
        const targetHandle = targetHandles.get(operation.resource.key)
        if (typeof rawPath === 'string' && rawPath.length > 0 && targetHandle !== undefined) {
          let grantValid = false
          try {
            grantValid = await authorizeArtifactRead({
              instanceId: targetInstanceId,
              rawPath,
              canonicalResourceKey: operation.resource.key,
              targetHandle,
            })
          } catch {
            // A faulting port fails closed (no grant — the unchanged
            // pipeline decides below).
            grantValid = false
          }
          observe({ stage: 'artifact-grant-check', callId, tool: name, valid: grantValid })
          if (grantValid) {
            // A4-PR4 lane B: the SAME capability seam as the preflight,
            // re-run at this last-mile point. The refusal is a host fact,
            // so it reads as one even though a valid artifact grant was
            // in hand (a grant is a floor, never a ceiling override — and
            // no Team authority can authorize what the host refuses).
            const recheck = await preflightRuntimeCapability(name)
            if (recheck.allowed === false) {
              observe({
                stage: 'external-recheck-denied',
                callId,
                tool: name,
                via: 'artifact-grant',
                code: recheck.code,
              })
              return {
                kind: 'deny',
                reason: capabilityDenialReason(recheck.code, recheck.detail),
              }
            }
            // R6 / H1 — mark THIS exec object (the same object the
            // pipeline flows to the end-cap guard stage) and dispatch.
            authorizedExecutions.add(exec)
            return await next()
          }
        }
      }
    }

    if (effectiveEffect === 'allow') {
      // exec-autonomy-contract (user ruling 2026-09-18) — the DUAL
      // GATE: a LEADER exec-class ALLOW (bash / pwsh — the shell class;
      // the leader allow-lane whole-tool rule is the ONLY contract path
      // to an exec ALLOW) stands ONLY when the leader's effective
      // mutation envelope carries the matching exec token
      // (`params.execEnvelopeOps` — an absent option or a missing token
      // means NO exec authorization: fail-closed). A gated allow is
      // NOT settled here: the flow continues to the ask path (4) below,
      // where the durable control row is created with this install's
      // request kind — `user-approval` for the leader install (the
      // human-only resolver closure) — and the exec is marked
      // authorized only on approval. Zero effect until then (no
      // external recheck, no marking, next() never awaited). Members
      // never reach this gate (isLeader=false): their exec ask already
      // routes to `leader-approval` (the leader decides; the human may
      // stand in).
      const execClassTool = (SHELL_PERMISSION_TOOL_VALUES as readonly string[]).includes(name)
      const execTokenPresent =
        execEnvelopeOps !== undefined && (execEnvelopeOps as readonly string[]).includes(name)
      if (isLeader && execClassTool && !execTokenPresent) {
        observe({
          stage: 'exec-envelope-downgrade',
          callId,
          tool: name,
          staticSource: decision.provenance.source,
          ...(decision.provenance.lane !== undefined
            ? { staticLane: decision.provenance.lane }
            : {}),
          ...(decision.provenance.ruleIndex !== undefined
            ? { staticRuleIndex: decision.provenance.ruleIndex }
            : {}),
        })
        // No return: the gated allow is settled by the ask path below.
      } else {
        // A2C-4 (alpha.2 plan §6.3) — the live external hard LAST-MILE
        // recheck of the static-allow path: the static decision resolved
        // against the TEAM policy only; before the exec object is marked
        // authorized (and the tool body dispatched) the operation must
        // pass the CURRENT external hard policy through the shared
        // read-only ControlService check (the same hard-cell semantics
        // the resolve-time probe uses — invariant 34: no Team decision,
        // human included, bypasses it). This static path carries no
        // control request, and A4-PR4 moved a first probe EARLIER (the
        // preflight) WITHOUT removing this one: the window between the
        // permission answer and the dispatch is exactly what a tightened
        // cell must still catch. A deny here is zero-effect: the exec is
        // NOT marked (the monotonic end-cap stays armed against it),
        // next() is never awaited (the tool body never runs), and no
        // durable control row is written or consumed. A failing check
        // fails closed (plan §10.3) and — lane B — reads as the host fact
        // it is, not as a permission denial.
        const recheck = await preflightRuntimeCapability(name)
        if (recheck.allowed === false) {
          observe({ stage: 'external-recheck-denied', callId, tool: name, code: recheck.code })
          return {
            kind: 'deny',
            reason: capabilityDenialReason(recheck.code, recheck.detail),
          }
        }
        // R6 / H1 — mark THIS exec object as authorized by this install
        // (the same object the pipeline then flows to the end-cap guard
        // stage). Marking happens ONLY on final-allow paths — never on
        // any deny/abort/failure path.
        authorizedExecutions.add(exec)
        return await next()
      }
    }
    if (effectiveEffect === 'deny') {
      // Round 3 (BLOCK-2): route on the MERGED effect, never the stale
      // static decision. A deny that ANSWERED (dynamic or static) settles
      // here — after the floor above has had its frozen say on DEFAULT
      // denies only; an explicit rule deny (any plane) never got floor
      // eligibility and blocks now.
      if (dynamicDenyExplanation !== undefined) {
        return { kind: 'deny', reason: `permission denied: ${dynamicDenyExplanation}` }
      }
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

    // (4a-pre) A4-PR4 lane A (spec §10.1, acceptance §21.4) — MINIMUM
    // AUTHORITY ROUTING. The frozen routing below asks "who is holding the
    // keyboard"; this asks "which rung must sign", and only the second is an
    // authority answer. Absent port, or a plane that answers `undefined`,
    // means the Team is not on the v3 authority documents and the frozen
    // routing stands byte-identically (spec §10.1: the legacy path remains
    // until PR7) — zero extra rows, zero extra awaits, same request kind.
    const requestSummary =
      operation.resource.kind === 'tool'
        ? [name, shellEffectTokens(operation, exec.arguments), commandPreview(exec.arguments)]
            .filter((part) => part.length > 0)
            .join(' ')
        : `${name} ${operation.resource.display}`
    let approvalFacts: OperationApprovalFacts | undefined
    try {
      approvalFacts =
        operationApprovalRouting === undefined
          ? undefined
          : await operationApprovalRouting({
              operationClass: operation.tool,
              resourceKey: operation.resource.key,
            })
    } catch (error: unknown) {
      // An unreadable authority plane is not an empty one. Fail closed with
      // ZERO durable rows: minting a case here would ask a guessed rung to
      // sign (ADR A1-7), and a fallback to the caller-role routing would let
      // a document fault widen what the documents narrow.
      observe({ stage: 'authority-facts-failed', callId, tool: name })
      return {
        kind: 'deny',
        reason:
          `permission denied: the approval authority facts could not be read for ${name} on ` +
          `${operation.resource.display} (unexpected authority-facts failure: ${
            error instanceof Error ? error.message : String(error)
          }) — no approval case was created (fail-closed)`,
      }
    }
    const approvalRouting = routeOperationApproval({
      operationClass: operation.tool,
      resourceKey: operation.resource.key,
      // WHO IS ACTING, from this install's own identity (the ladder rung of
      // the acting surface, not of the beneficiary): spec §7.3's `direct`
      // arm is unreachable without it.
      initiatorAuthority: isLeader ? 'leader' : 'member',
      facts: approvalFacts,
    })
    if (approvalRouting.kind === 'authority-undetermined') {
      observe({
        stage: 'approval-routing-undetermined',
        callId,
        tool: name,
        reason: approvalRouting.reason,
      })
      return {
        kind: 'deny',
        reason:
          `permission denied: no approval authority could be determined for ${name} on ` +
          `${operation.resource.display} (${approvalRouting.reason}: ${approvalRouting.detail}) ` +
          '— no approval case was created (fail-closed)',
      }
    }
    if (approvalRouting.kind === 'direct') {
      // Spec §7.3's `direct` arm: the acting rung ALREADY holds the rung the
      // operation requires over its own beneficiary, so no case exists to
      // open — a case would put a signature requirement on the rung that
      // already has the authority, which §21.4 refuses ("no self/same-level
      // allow"). The capability recheck is STILL performed: `direct` is an
      // answer about authority, never about the host.
      const recheck = await preflightRuntimeCapability(name)
      if (recheck.allowed === false) {
        observe({
          stage: 'external-recheck-denied',
          callId,
          tool: name,
          via: 'approval-direct',
          code: recheck.code,
        })
        return {
          kind: 'deny',
          reason: capabilityDenialReason(recheck.code, recheck.detail),
        }
      }
      observe({
        stage: 'approval-direct',
        callId,
        tool: name,
        requiredAuthority: approvalRouting.requiredAuthority,
        consideredRoles: [...approvalRouting.evidence.consideredRoles],
      })
      authorizedExecutions.add(exec)
      return await next()
    }

    // (4a) request the durable control row (A4). A typed rejection
    // (malformed, stale target, envelope) fails closed — never swallowed.
    // A4-PR4: on the v3 arm this row is a CASE LEG (spec §11.2) — the case
    // identity is frozen at creation with the rung the routing derived, and
    // the legacy request kind rides as the carrier. On the pre-v3 arm it is
    // the pre-existing `requestControl` call, unchanged.
    let record
    try {
      if (approvalRouting.kind === 'approval-required') {
        const legOutcome = await controlService.requestApprovalLeg({
          rootSessionId,
          caller,
          kind: approvalRouting.carrierKind,
          reviewAuthority: approvalRouting.requiredAuthority,
          requiredAuthorityAtCreation: approvalRouting.requiredAuthority,
          identity: {
            subject: { kind: 'instance', instanceId: targetInstanceId },
            beneficiaryAuthority: approvalRouting.beneficiaryAuthority,
            requestedEffect: 'allow',
            operationFingerprint: operation.fingerprint,
            correlation: callId,
          },
          actionName: ACTION_NAME,
          toolName: name,
          summary: requestSummary,
          executionCoupling: CONTROL_EXECUTION_COUPLINGS.GUARDED,
        })
        if (legOutcome.kind !== 'leg') {
          // The case was BORN terminal (ADR A1-12: `human-admin` has no
          // resolver in Alpha.4, so no leg can be reviewed). The durable
          // footprint is a leg plus its terminal deny, written in one
          // transaction; the case never appears pending anywhere, and this
          // invocation settles NOW — no wait, no decision to await.
          observe({
            stage: 'terminal-outcome',
            callId,
            outcome: 'authority-unavailable',
            approvalCaseId: legOutcome.approvalCaseId,
            caseOutcome: legOutcome.kind,
            requiredAuthority: legOutcome.requiredAuthority,
          })
          return {
            kind: 'deny',
            reason:
              `permission denied: the approval case for ${name} on ${operation.resource.display} ` +
              `requires '${legOutcome.requiredAuthority}', which has no resolver in this release ` +
              `(${legOutcome.kind}: ${legOutcome.detail}) — the case closed at creation`,
          }
        }
        record = legOutcome.leg
      } else {
        record = await controlService.requestControl({
          rootSessionId,
          caller,
          kind: requestKind,
          targetInstanceId,
          actionName: ACTION_NAME,
          toolName: name,
          correlation: callId,
          operationFingerprint: operation.fingerprint,
          // H2 P1-2 + H5 P1-B (A2C-1: the shell class): the tool-level
          // (bash/pwsh) summary carries the bounded NON-authority effect
          // tokens (`[cwd=<resolved display>]` always — the workdir is
          // always effective; `[background]`; `[sandbox=<mode>]`;
          // `[timeout=<n>ms]`) and the bounded command preview (first 120
          // chars, whitespace flattened, `...` when truncated) — display
          // text only, never part of the fingerprint/scope/hash (those
          // carry the canonical effect values + the command HASH from
          // A2/H5).
          summary: requestSummary,
        })
      }
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
      observe({
        stage: 'terminal-outcome',
        callId,
        outcome: 'denied',
        decision: decisionRecord.decision,
      })
      return { kind: 'deny', reason: 'the approval was denied' }
    }

    // (4c') A4-PR4 lane C (spec §12.1's execution order; ADR A1-14: an
    // approval is NOT a standing grant) — the fresh authority recheck. The
    // authority plane is read AGAIN and the required rung re-derived; if the
    // rung that must sign has RISEN above the rung that signed, this
    // invocation is covered by an approval the Team's documents no longer
    // consider sufficient. It terminates BEFORE the guard, which is what
    // keeps the one-shot unspent: the durable allow stays exactly as the
    // human wrote it (no rewritten decision row, no abandonment, no second
    // decision), and the terminal state is recorded as a derived observation
    // rather than as a new durable verdict.
    //
    // SCOPE DISCLOSURE: this is the adapter-side recheck. The same duty on the
    // OTHER side of the seam — a recheck INSIDE `guardOperation`, immediately
    // before the consumption write — needs an authority-facts port on
    // `ControlServiceOptions` plus a `CONTROL_GUARD_BLOCK_REASONS` member to
    // name it, both declared in `packages/runtime/control/types.ts`, which is
    // outside this task's granted files. That half of A1-14 is therefore
    // UNENFORCED at the consumption write in this PR and is reported as a
    // file-scope blocker, not claimed.
    if (operationApprovalRouting !== undefined && record.reviewAuthority !== undefined) {
      const reviewAuthority = record.reviewAuthority
      let freshFacts: OperationApprovalFacts | undefined
      try {
        freshFacts = await operationApprovalRouting({
          operationClass: operation.tool,
          resourceKey: operation.resource.key,
        })
      } catch (error: unknown) {
        observe({
          stage: 'terminal-outcome',
          callId,
          outcome: 'authority-undetermined',
          via: 'fresh-recheck-fault',
        })
        return {
          kind: 'deny',
          reason:
            `permission denied: the approval authority for ${name} could not be re-checked at ` +
            `execution (unexpected authority-facts failure: ${
              error instanceof Error ? error.message : String(error)
            }) — the approved invocation did not execute and the one-shot allow was not consumed`,
        }
      }
      const fresh = routeOperationApproval({
        operationClass: operation.tool,
        resourceKey: operation.resource.key,
        initiatorAuthority: isLeader ? 'leader' : 'member',
        facts: freshFacts,
      })
      const recheck = recheckOperationApproval({ reviewAuthority, fresh })
      if (recheck.kind === 'stale') {
        observe({
          stage: 'terminal-outcome',
          callId,
          outcome: 'stale',
          reviewAuthority,
          requiredNow: recheck.requiredNow,
        })
        return {
          kind: 'deny',
          reason:
            `permission denied: the approval authority for ${name} on ${operation.resource.display} ` +
            `rose to '${recheck.requiredNow}' after the approval was given at ` +
            `'${reviewAuthority}' — the approved invocation did not execute and the one-shot allow ` +
            'was not consumed',
        }
      }
      if (recheck.kind === 'undetermined') {
        observe({
          stage: 'terminal-outcome',
          callId,
          outcome: 'authority-undetermined',
          reason: recheck.reason,
        })
        return {
          kind: 'deny',
          reason:
            `permission denied: the approval authority for ${name} on ${operation.resource.display} ` +
            `could not be re-established at execution (${recheck.reason}: ${recheck.detail}) — the ` +
            'approved invocation did not execute and the one-shot allow was not consumed',
        }
      }
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
      // A4-PR4 lane C (spec §12.2/§13) — the guard's `external-policy`
      // verdict is the SAME host fact the preflight answers, discovered
      // later: the capability disappeared between the human's allow and
      // the last-mile guard. The invocation terminates (single-shot) and
      // the outcome is named for what actually stopped it — an execution
      // capability loss, not a withdrawn permission. The durable allow is
      // untouched by this: the guard did NOT consume it (zero-consumption
      // on an external refusal, invariant 34) and no row is rewritten.
      if (verdict.reason === CONTROL_GUARD_BLOCK_REASONS.EXTERNAL_POLICY) {
        observe({
          stage: 'terminal-outcome',
          callId,
          // The frozen terminal-operation-outcome vocabulary
          // (`intervention/derivation.ts`, A4-PR3). Spelled as a literal
          // because ADR A1-17 forbids an executing path from importing the
          // projection lane; the test pins membership in the frozen set, so
          // the mirror cannot drift silently.
          outcome: 'execution-unavailable',
          via: 'guard-external-policy',
        })
        return {
          kind: 'deny',
          reason: capabilityDenialReason(
            PRE_EXECUTE_CAPABILITY_ERROR_CODES.EXTERNAL_RUNTIME_RESTRICTION,
            `the host runtime stopped allowing ${name} between the approval and the last-mile ` +
              `guard (${verdict.reason}) — the invocation terminates; the one-shot allow was not consumed`,
          ),
        }
      }
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
    const executed = await next()
    // The terminal outcome is recorded AFTER the body ran, and it claims only
    // what is known: the guard consumed the one-shot either way, so a tool
    // body that itself refused is recorded as `execution-unavailable`
    // (did-not-execute, cause named by `via`) and never as a success.
    observe({
      stage: 'terminal-outcome',
      callId,
      outcome: executed.kind === 'deny' ? 'execution-unavailable' : 'execution-succeeded',
      ...(executed.kind === 'deny' ? { via: 'tool-body-denied' } : {}),
      requestId: record.requestId,
    })
    return executed
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
   *   beyond the seven permission tools, A2C-1);
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
