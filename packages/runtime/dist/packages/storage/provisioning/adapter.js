/**
 * AgentFactoryAdapter — the NARROW public-surface adapter for the ONE
 * external effect of member provisioning (TaskDoc §11.5 P4-T4; ruling R20).
 *
 * The durable provisioning protocol (Development Plan §17.3 crash model,
 * Architecture §18) has exactly one step that reaches OUTSIDE the TeamDomain
 * sidecar: the creation of the member's durable child DSH Session (and the
 * Agent bound to it). Every other step — recording the child id, the
 * SessionBinding, the MemberInstance record, the ledger fact, and the
 * COMMITTED operation marker — is a durable TeamDomain write owned by this
 * package and its P4-T1/T2/T3 dependencies.
 *
 * The adapter is the seam between that one external effect and the durable
 * state machine. It is intentionally minimal:
 *
 * - `createChildSession(request)` is the ONLY method. It is the single
 *   external effect; surfacing more would let the runtime leak Team
 *   control-plane authority (Architecture §14: TeamDomain is the SOLE Team
 *   control-plane authority). The coordinator never needs to read, list,
 *   or destroy child sessions through this seam in P4 — those are runtime
 *   concerns of a later phase (P5).
 *
 * **Idempotency contract (why it is needed):** the crash model allows a
 * crash between the external effect completing and its durable record
 * landing (Development Plan §17.4 "after child create"). Recovery
 * re-drives the SAME operation, and a re-drive MUST NOT create a second
 * external child for the same member. Therefore the adapter MUST be
 * idempotent on the member identity `(rootSessionId, instanceId)`:
 * calling `createChildSession` again for the same member returns the SAME
 * `childSessionId` it returned before (it never mints a second child for
 * one member). This is what makes "effect success but lost durable record"
 * converge to ONE child instead of two (the fake in `fake-adapter.ts`
 * models this; a real binding in P5 must satisfy the same contract).
 *
 * **No runtime here:** this module is a pure type surface. It imports NO
 * host backend, NO live Agent, NO DSH runtime, and NO `node:` builtin. The
 * only implementation shipped in this task is the deterministic in-memory
 * `FakeAgentFactoryAdapter` (`fake-adapter.ts`); the real adapter binding is
 * a later phase (P5 runtime).
 *
 * @module @dsh-agent-team/storage/provisioning/adapter
 */
export {};
//# sourceMappingURL=adapter.js.map