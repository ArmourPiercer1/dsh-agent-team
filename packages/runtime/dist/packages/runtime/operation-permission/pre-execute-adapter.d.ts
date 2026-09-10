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
 *   is the public `ctx.fs.resolve` seam, and only through the injected
 *   {@link import('./types.js').PathTargetResolver} closure (the A6 glue
 *   builds it over `ctx.fs.resolve(path, { cwd: sessionCwd })` with the
 *   agent's per-session workspace cwd — the upstream file tools' own
 *   resolution convention, `exec.agent.session.header.cwd`). This module
 *   never imports an upstream `@deepseek-ai/*` package; the agent ctx and
 *   the exec payload are typed by MINIMAL structural mirrors of the
 *   upstream surface (the glue is plain `.mjs` and passes the real cordis
 *   `Context`, whose `ctx.on` registration is an effect that returns the
 *   disposer — this factory returns that disposer verbatim).
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
 * Diagnostics: when `onObserve` is provided, small structured rows are
 *   emitted at five pipeline points (canonicalized operation, resolved
 *   decision + provenance, request created, decision arrived, guard
 *   verdict) — no file contents, no full argument payloads. An
 *   `onObserve` that throws never affects the decision (diagnostics are
 *   not authority).
 *
 * @module @dsh-agent-team/runtime/operation-permission/pre-execute-adapter
 */
import type { PathTargetResolver } from './types.js';
import type { ControlService, ControlWaitSignal } from '../control/index.js';
import type { ActionCaller } from '../admission/index.js';
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js';
/**
 * The pre-dispatch decision this listener can produce (a structural
 * mirror of the upstream `PreToolDecision`). The listener never produces
 * the `ask` variant (it resolves asks internally — see the module docs).
 */
export type PreToolDecisionLike = {
    readonly kind: 'allow';
} | {
    readonly kind: 'deny';
    readonly reason: string;
} | {
    readonly kind: 'ask';
    readonly reason?: string;
};
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
    readonly callId: string;
    /** The tool name (`exec.name`). */
    readonly name: string;
    /** The losslessly-parsed, deep-frozen tool arguments (`exec.arguments`). */
    readonly arguments: unknown;
    /** The caller's cancellation signal for this invocation. */
    readonly signal: ControlWaitSignal;
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
    on(event: string, listener: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>): () => void;
}
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
    readonly policy: TemplatePermissionPolicy;
    /**
     * The injected path-resolution seam (A2): the A6 glue's closure over
     * the upstream public `ctx.fs.resolve(path, { cwd: sessionCwd })`,
     * bound to THIS agent's session workspace cwd and unbranding the
     * `FsTarget.targetKey`. Used for BOTH operations and rules (R1/R2 —
     * the same cwd basis).
     */
    readonly resolveTarget: PathTargetResolver;
    /** The durable control plane service (A4 — fully constructed). */
    readonly controlService: ControlService;
    /** The team root session id (the TeamSession, invariant 9). */
    readonly rootSessionId: string;
    /**
     * This agent's durable identity as an action caller:
     * `{ kind: 'instance', instanceId }` for both the leader (its leader
     * instance id) and members (their instance id).
     */
    readonly caller: ActionCaller;
    /**
     * The calling agent's instance id — the operation's target instance
     * (same as `caller.instanceId` for both leader and member installs).
     */
    readonly targetInstanceId: string;
    /**
     * The routing bit (plan §9.5): `true` for the leader install (ask →
     * `user-approval`, human-only resolver closure), `false` for members
     * (ask → `leader-approval`, leader-or-human resolver closure).
     */
    readonly isLeader: boolean;
    /**
     * The optional diagnostics hook (the A6 glue wires it to its
     * observation surface). Small structured rows only (no file contents,
     * no full argument payloads); a throwing hook never affects the
     * decision.
     */
    readonly onObserve?: (observation: Record<string, unknown>) => void;
}
/**
 * Install the parameter-permission pre-execute listener on one agent ctx
 * (plan §10.1: installed only for agents whose bound template declares
 * `permissions` — the install decision itself is the A6 glue's; once
 * installed, this listener covers exactly that agent's calls).
 *
 * @param agentCtx - the agent-scoped registration surface (the upstream
 *   cordis agent `Context`).
 * @param params - the frozen install parameters (policy, resolver,
 *   control service, identities, routing, optional diagnostics).
 * @returns the disposer (the `ctx.on` return) — the A6 glue stores it in
 *   the agent lifecycle's disposer list so close/dispose removes the
 *   listener and cold resume re-installs (plan §11.3).
 */
export declare function installParameterPermissionListener(agentCtx: AgentPreExecuteCtx, params: InstallParameterPermissionListenerParams): () => void;
//# sourceMappingURL=pre-execute-adapter.d.ts.map