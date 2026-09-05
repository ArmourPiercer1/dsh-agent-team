/**
 * RootBinding — the productized root binding (P5-T5; TaskDoc §11.5
 * I-1 real binding; ruling R32 owned surface `packages/runtime/root-binding/**`).
 *
 * This module is the ROOT_COLD_BINDING productization of the P2-T2
 * characterization: it orchestrates the durable TeamDomain writes (the
 * fresh-root path ONLY) around the P5-T1 `TeamAgentBinder`, so that a
 * root DSH session becomes — or comes back as — the root of a Team with
 * its full overlay scope, through public seams only.
 *
 * Frozen object-model facts honored here (invariant numbers refer to the
 * frozen Architecture document §42):
 *
 * - Invariant 41 — the TeamDomain sidecar is the SOLE durable
 *   control-plane authority. Every durable write of this module goes
 *   through the injected {@link TeamDomainWritePort}; the binder
 *   (P5-T1) only ever reads.
 * - Invariant 42 — vNext has NO Team SessionEvents. This module emits no
 *   SessionEvents; its observability channel is the binder's
 *   `agent-setup/*` event RECORDS routed through the injected
 *   `TeamAgentSetupSurface` (the T1 event emitter).
 * - Invariant 9 — the TeamSessionId IS the root session id; the module
 *   therefore addresses everything by `rootSessionId`.
 * - Invariant 10 — one immutable Blueprint snapshot per TeamSession; a
 *   re-run of the fresh-create path with a different immutable identity
 *   is a conflict, never a re-bind.
 * - Invariant 8 — one Root Session owns 0/1 TeamSession; enforced here
 *   by the binding-kind resolution before any effect.
 * - DevPlan §18.5 — MemberInstance/Session are durable, Agent residency
 *   is ephemeral: the fresh path durably commits BEFORE the ephemeral
 *   agent-setup step, so a crash between the two leaves a valid COLD
 *   root (the cold path is the recovery); the cold path restores the
 *   scope WITHOUT fresh-time side effects (no slot `apply`, no
 *   `installOverlay`).
 *
 * The two entry points map 1:1 onto the binder's two root paths:
 *
 * - {@link bindFreshTeamRoot} (`./fresh-root.js`) — the first-time
 *   binding of a root session: persist the TeamSession record, the
 *   `team-root` session binding, and the durable LeaderInstance mint
 *   (P8-S2, Architecture §9.2: the fresh root yields the honest v2
 *   leader row; idempotent re-runs skip every write), then run the
 *   binder's fresh-root path (all three overlay slots installed + the
 *   admission decision).
 * - {@link rehydrateColdTeamRoot} (`./cold-root.js`) — the process-
 *   restart path: restore the root scope from the durable TeamDomain
 *   onto the (re)created agent residency; an ordinary session is a
 *   zero-record, zero-effect no-op (`durable` absent,
 *   `bind.noopReason === 'ordinary'`).
 *
 * Pure module: no I/O, no host imports, no `node:` builtins. All handles
 * are injected (mock-first unit tests; the real-instance harness binds
 * the DSH public seams through the same interfaces).
 *
 * @module @dsh-agent-team/runtime/root-binding/types
 */
export {};
//# sourceMappingURL=types.js.map