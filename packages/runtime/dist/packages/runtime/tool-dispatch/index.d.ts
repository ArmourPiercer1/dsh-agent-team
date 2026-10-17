/**
 * `@dsh-agent-team/runtime/tool-dispatch` — the Alpha.5 PR1 lane: the
 * closed-world monotonic Guard, the Stable Scoped Dispatcher with the
 * design §4.1 assembly machine, and their install on one Team Agent's public
 * seams (implementation plan §4; design §4.1/§4.2).
 *
 * WHAT PR1 DECIDES (plan §4, design §0 "Coverage" row):
 *
 *  - the Setup Coverage Gate is a DIAGNOSTIC, and this lane is the gate.
 *    A coverage snapshot is taken once; a ToolDefinition can appear at any
 *    later moment (an own-layer `tools.register`, an MCP hot mount, another
 *    same-scope plugin), and `tools.restrict` by the host's own contract
 *    "never [affects] what its OWN layer registers". Only a per-call,
 *    monotonic, closed-world verdict covers that surface;
 *  - the shape of a Team Agent is STABLE. A Binding change flips an immutable
 *    revision; the name is never unloaded to let the native body return
 *    (NEG-1 measured exactly that: the late re-resolution ran the native body
 *    once when the mask was lifted before the in-flight call settled);
 *  - teardown is ordered and self-counted: refuse new calls → keep the mask →
 *    cancel/drain → tombstone → release ONLY at a self-counted zero, never
 *    because a Cordis dispose returned;
 *  - non-Team Host sessions are untouched: every registration here is
 *    agent-scoped, and an execution with no Agent identity reaching a Team
 *    scope is refused rather than laundered into the global lane (NEG-2).
 *
 * REUSES the PR0 frozen lane (`domain/tool-governance`: the §5 error
 * vocabulary, `ToolBinding` and the transition table) — this lane adds
 * runtime decisions, not a second algebra. It is consumed by exactly one
 * production caller, the Team trusted assembly point
 * (`src/plugin/live/agent-bindings.mjs`), which is the allow-listed consumer
 * row in `scripts/audit-a5-tool-governance-imports.mjs`.
 *
 * @module @dsh-agent-team/runtime/tool-dispatch
 */
export { createPendingCallLedger, type PendingCall, type PendingCallLedger, type CancelledCall, } from './pending-calls.js';
export { GOVERNED_UNVERIFIED_REASONS, GUARD_DENIAL_REASONS, GUARD_ERROR_CODES, GOVERNED_ORIGINS, createGovernedSurface, guardDecision, guardDenialMessage, ASSURANCE_REALM_TRUSTED_ASSEMBLY, untestedAssurance, } from './closed-world-guard.js';
export type { GovernedEntry, GovernedOrigin, GovernedUnverifiedReason, InheritedSurfaceBinding, GovernedSurface, GovernedSurfaceOptions, GuardDecisionInput, GuardDenialReason, GuardExecView, GuardScopeIdentity, GuardVerdict, } from './closed-world-guard.js';
export { createScopedDispatcher } from './scoped-dispatcher.js';
export type { CallToken, DispatcherObservation, ScopedDispatcher, ScopedDispatcherOptions, } from './scoped-dispatcher.js';
export { hostExecToView, installScopedToolGuard, requireService, definitionIdentityOf } from './install.js';
export type { BindingFeed, BindingFeedEntry, GuardFn, InstallScopedGuardInput, ScopedGuardAgentCtx, ScopedGuardHandle, SurfaceRevalidation, } from './install.js';
//# sourceMappingURL=index.d.ts.map