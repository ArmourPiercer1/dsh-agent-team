/**
 * TeamAgentBinder contract surface (TaskDoc §11.5 P5-T1; DevPlan §18.1).
 *
 * This module defines the frozen CONTRACT of the P5-T1 binder skeleton:
 *
 * - the NARROW injected public Agent setup surface
 *   ({@link TeamAgentSetupSurface}) — mock-first in T1; the real DSH public
 *   seam binding lands in T5/T6 (ruling R28: "真实 DSH 公开面绑定属 T5/T6;
 *   T1 一律 mock-first");
 * - the three overlay SLOT contracts (persona / model / capability) — T1
 *   ships the identity (no-op) defaults only; T2 (persona), T3 (model) and
 *   T4 (capability) fill in the business logic. The binder installs the
 *   overlays; it never implements their semantics;
 * - the admission GUARD contract — the binder's decision point BEFORE work
 *   (fail-closed); T2's `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` FATAL gate
 *   lives in the persona slot's `apply` (before this admission decision);
 *   T1 leaves only the decision point and the error-code channel;
 * - the READ-ONLY TeamDomain handle — the binder never owns or writes the
 *   durable truth (DevPlan §18.1: "binder 负责安装 overlay，不拥有
 *   TeamDomain truth"; invariant 41: TeamDomain is the SOLE control-plane
 *   authority).
 *
 * What the binder does NOT define here (and must never grow):
 *
 * - no Team SessionEvent vocabulary of any kind (vNext has no Team
 *   SessionEvents; the recorded events are the public Agent
 *   setup/session events, `agent-setup/*`, see
 *   {@link AGENT_SETUP_EVENT_NAMES});
 * - no TeamDomain record production (the binder reads, it does not write);
 * - no legacy `packages/team` vocabulary (global forbidden block).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/binder/types
 */
import type { MemberInstanceRecordDto, SessionBindingDto, TeamSessionRecordDto } from '../../../contracts/src/index.js';
/**
 * The three overlay slots the binder installs on a team agent (DevPlan
 * §18.1: persona / Team prompt-policy surface → `persona`; model overlay →
 * `model`; Team tools / resolved guard / skills-MCP adapter / context
 * policy → `capability`).
 */
export type OverlaySlotName = 'persona' | 'model' | 'capability';
/**
 * The binder-owned fixed installation order of the overlay slots (the
 * binder owns the orchestration order — ruling R28). The order is frozen
 * for the P5-T2/T3/T4 slot implementations: persona first (its FATAL
 * conflict check must run before any later slot and before the admission
 * decision, DevPlan §18.3), then model, then capability.
 */
export declare const OVERLAY_SLOT_ORDER: readonly OverlaySlotName[];
/**
 * The closed vNext event vocabulary the binder records through the
 * surface (allowed dependency: "public Agent setup/session events" —
 * TaskDoc §11.5 P5-T1). These are public agent-setup events, NOT Team
 * SessionEvents: the names deliberately live in the `agent-setup/*`
 * namespace and contain none of the legacy `team/*` event strings.
 */
export declare const AGENT_SETUP_EVENT_NAMES: {
    /** One per overlay slot, emitted after that slot is installed (fresh path). */
    readonly overlayInstalled: "agent-setup/overlay-installed";
    /** One per cold rehydrate, emitted after the scope is restored onto the residency. */
    readonly scopeRestored: "agent-setup/scope-restored";
    /** One per bind, emitted after the admission decision (detail = admission code). */
    readonly admissionDecided: "agent-setup/admission-decided";
};
/** One recorded public Agent setup/session event (lossless-JSON value). */
export interface AgentSetupEventRecord {
    /** The closed event name (one of {@link AGENT_SETUP_EVENT_NAMES} values). */
    readonly name: string;
    /** A compact stable detail token (slot name, session kind, or admission code). */
    readonly detail?: string;
}
/**
 * The restored scope handed to the surface on the COLD path (DevPlan
 * §18.5: Agent residency is ephemeral; TeamDomain is durable — a cold
 * rehydrate re-attaches the restored scope to a (re)created residency
 * WITHOUT re-running fresh-time side effects).
 */
export interface RestoredScope {
    /** The bound session kind. */
    readonly kind: 'root' | 'member';
    /** The TeamSession id (= RootSessionId, Architecture invariant 9). */
    readonly rootSessionId: string;
    /** The member's stable instance id (member only; composite identity, invariant 18). */
    readonly instanceId?: string;
    /** The full overlay slot set the restored scope carries (fixed order). */
    readonly slots: readonly OverlaySlotName[];
}
/**
 * The NARROW injected public Agent setup surface (ruling R28: "一个最小
 * public surface 接口 … 由你按最小必要面设计，每个成员须记录理由").
 *
 * The binder is the ONLY caller of this surface; the surface is the ONLY
 * way the binder reaches the (mock-first in T1, real in T5/T6) external
 * Agent runtime. Each member carries its rationale:
 *
 * 1. `getInstalledSlots` — the idempotency observation: the binder must
 *    know whether the target's live residency already carries the full
 *    overlay set before deciding install vs no-op (DevPlan §18.1
 *    "且 idempotent"). Residency is EPHEMERAL (DevPlan §18.5), so this
 *    reads the live agent state, never the durable truth.
 * 2. `installOverlay` — the FRESH-time public Agent setup effect, once
 *    per slot. The real implementation (T5/T6) performs the public
 *    preset/model/capability setup; T1's mock records the call.
 * 3. `restoreScope` — the COLD-time scope restoration onto a
 *    (re)created residency: it re-attaches the restored scope (identity +
 *    full slot set) WITHOUT fresh-time side effects (no event minting, no
 *    identity re-minting; the events are emitted by the binder, and only
 *    once per session per record).
 * 4. `recordSessionEvent` — the public Agent setup/session event channel
 *    (TaskDoc §11.5 P5-T1 allowed dependency). The binder is the single
 *    emitter; the names come from the closed {@link AGENT_SETUP_EVENT_NAMES}
 *    vocabulary — never a legacy `team/*` event string.
 *
 * The surface must be idempotent-safe: `installOverlay` for an already
 * installed slot and `restoreScope` over an existing scope are no-ops
 * (the real DSH public setup seams are re-entrant).
 */
export interface TeamAgentSetupSurface {
    /**
     * The overlay slot names currently installed on the target's live agent
     * residency (empty when the residency is absent or unbound).
     * @param sessionId - the bound DSH session id.
     */
    getInstalledSlots(sessionId: string): readonly string[];
    /**
     * Install one overlay slot on the target's live agent residency
     * (fresh-time effect; idempotent per slot).
     * @param sessionId - the bound DSH session id.
     * @param slot - the overlay slot being installed.
     */
    installOverlay(sessionId: string, slot: OverlaySlotName): void;
    /**
     * Restore one restored scope onto the target's (re)created residency
     * (cold-time effect; re-entrant).
     * @param sessionId - the bound DSH session id.
     * @param scope - the restored scope (identity + full slot set).
     */
    restoreScope(sessionId: string, scope: RestoredScope): void;
    /**
     * Record one public Agent setup/session event for the target session.
     * @param sessionId - the bound DSH session id.
     * @param event - the event record (closed name + stable detail).
     */
    recordSessionEvent(sessionId: string, event: AgentSetupEventRecord): void;
}
/**
 * The stable team agent identity a bind establishes (derived from the
 * durable records, never minted by the binder):
 *
 * - root: `sessionId` IS the root session id (= TeamSessionId,
 *   invariant 9);
 * - member: `sessionId` is the member's durable child session id; the
 *   runtime identity is the composite `(rootSessionId, instanceId)`
 *   (invariant 18) — never a label, never a legacy `memberId`.
 */
export interface TeamAgentBindIdentity {
    /** The bound session kind. */
    readonly kind: 'root' | 'member';
    /** The bound DSH session id (root session id or member child session id). */
    readonly sessionId: string;
    /** The TeamSession id (= RootSessionId, invariant 9). */
    readonly rootSessionId: string;
    /** The member's stable instance id (member only, invariant 18). */
    readonly instanceId?: string;
}
/** The four bind paths of the single binder class (DevPlan §18.1). */
export type TeamAgentBindPath = 'fresh-root' | 'fresh-member' | 'cold-root' | 'cold-member';
/**
 * The step context handed to overlay slots and the admission guard.
 * `record` is the durable truth the step acts on (READ-ONLY — the slot
 * implementations and guards must not mutate it, and the binder never
 * writes TeamDomain).
 */
export interface TeamAgentStepContext {
    /** The resolved stable team agent identity. */
    readonly target: TeamAgentBindIdentity;
    /** The durable record the step acts on (TeamSession or MemberInstance). */
    readonly record: TeamSessionRecordDto | MemberInstanceRecordDto;
    /** The bind path driving this step. */
    readonly path: TeamAgentBindPath;
}
/**
 * One overlay slot (DevPlan §18.1 unified responsibility, split into the
 * three T2/T3/T4-owned slots).
 *
 * T1 ships the identity (no-op) default implementations only; T2 (persona
 * — including the `complete:true` FATAL-before-work conflict check,
 * DevPlan §18.3), T3 (model — public ModelSelection, DevPlan §18.4) and
 * T4 (capability — tools/permissions/skills/MCP/context policy, G2 seam
 * capability only) replace the respective slot.
 *
 * Slot contract (frozen for T2/T3/T4):
 *
 * - `apply` performs PUBLIC Agent setup effects only (through the public
 *   DSH seams the slot implementation is given at construction); it never
 *   writes TeamDomain and never emits session events directly (the binder
 *   is the single event emitter);
 * - `apply` MUST be idempotent: a re-drive after a partial bind (a crash
 *   or a slot failure between the previous slot's install and this slot's
 *   success) re-runs `apply` on an already-partially-installed residency
 *   and must converge to the same installed state;
 * - a THROWN `apply` fails the whole bind fail-closed before work
 *   (BINDER_OVERLAY_FAILED): no later slot runs, no admission decision
 *   runs, and the target is not registered as bound.
 */
export interface OverlaySlot {
    /** The slot this implementation fills (must match its key in the options). */
    readonly name: OverlaySlotName;
    /**
     * Apply this slot's overlay to the target's agent residency.
     * @param context - the step context (identity + durable record + path).
     */
    apply(context: TeamAgentStepContext): void;
}
/** The admission decision (the work gate, evaluated before work). */
export type AdmissionDecision = {
    readonly status: 'admitted';
} | {
    readonly status: 'rejected';
    /** The guard's closed rejection code (passed through unchanged). */
    readonly code: string;
    /** A compact stable rejection detail (optional). */
    readonly detail?: string;
};
/**
 * The admission guard — the binder's decision point BEFORE work (ruling
 * R28: "admission 决策点（admission 前 fail-closed）").
 *
 * Fail-closed semantics (frozen): a guard that THROWS is treated as a
 * rejection with the binder-level code `ADMISSION_GUARD_ERROR` (a guard
 * fault NEVER admits); a `rejected` decision is surfaced through the
 * result's `admitted: false` + `admissionCode` channel — the overlay
 * install completes (the agent is set up) but the work gate stays closed,
 * and the caller (T5/T6) must gate any Team work on `admitted === true`.
 *
 * T1 ships a default guard that admits (`ADMISSION_OPEN`): the durable
 * admission state is not yet a contracts v1 DTO field (it lands with a
 * later task, contracts CHANGELOG freeze rule), so the T1 skeleton has no
 * admission policy to evaluate. T5 supplies the real guard.
 */
export interface AdmissionGuard {
    /**
     * Decide whether the bound target may start Team work.
     * @param context - the step context (identity + durable record + path).
     * @returns the admission decision; throwing is a fail-closed rejection.
     */
    decide(context: TeamAgentStepContext): AdmissionDecision;
}
/**
 * The READ-ONLY TeamDomain handle (ruling R28: "binder 只持注入的只读
 * handle"; DevPlan §18.1: "binder 负责安装 overlay，不拥有 TeamDomain
 * truth"). Every member's rationale:
 *
 * 1. `getTeamSession` — the cold ROOT rehydrate reconstructs the scope
 *    from the durable TeamSession record (Architecture §14.3 A); the root
 *    bind target identity = the root session id (invariant 9).
 * 2. `getMemberInstance` — the cold MEMBER rehydrate reconstructs the
 *    composite identity and the durable child session (invariant 18/23)
 *    from the MemberInstance record (Architecture §14.3 B); the residency
 *    precheck reads `lifecycle` (terminal DISPOSED rejects, DevPlan §18.5
 *    "runtime residency can be dropped without deleting Member" — the
 *    reverse, a deleted Member, can never be bound).
 * 3. `getSessionBinding` — the session-kind resolution
 *    (`ordinary | team-root | team-member`, Architecture §14.3 C): the
 *    ordinary-session no-op decision (TaskDoc §11.5 P5-T1 must-test "
 *    ordinary agent no-op") and the member binding →
 *    `(rootSessionId, instanceId)` recovery (invariant 18).
 *
 * The handle has NO write methods by construction: any design that needs
 * a write belongs to TeamDomain's owning tasks, never to the binder.
 */
export interface TeamDomainReadHandle {
    /**
     * The durable TeamSession record for one root session id.
     * @param rootSessionId - the root DSH session id (= TeamSessionId).
     * @returns the record, or `undefined` when the session is not a team.
     */
    getTeamSession(rootSessionId: string): TeamSessionRecordDto | undefined;
    /**
     * The durable MemberInstance record for one member identity.
     * @param rootSessionId - the TeamSession (root) session id.
     * @param instanceId - the member's stable instance id.
     * @returns the record, or `undefined` when absent.
     */
    getMemberInstance(rootSessionId: string, instanceId: string): MemberInstanceRecordDto | undefined;
    /**
     * The durable session-kind binding for one DSH session id.
     * @param sessionId - any DSH session id.
     * @returns the binding row, or `undefined` when the session is unbound
     *   (an unbound session is treated as `ordinary`).
     */
    getSessionBinding(sessionId: string): SessionBindingDto | undefined;
}
/**
 * The result of one bind call (lossless-JSON value; no live references).
 */
export interface TeamAgentBindResult {
    /** The bind path this call requested. */
    readonly requested: TeamAgentBindPath;
    /** `false` only for the ordinary-session no-op. */
    readonly bound: boolean;
    /**
     * `true` when this call installed (fresh) or restored (cold) the overlay
     * on the live residency; `false` for both no-op kinds.
     */
    readonly installed: boolean;
    /** The no-op reason (absent when `installed` is `true`). */
    readonly noopReason?: 'ordinary' | 'already-bound';
    /** The stable team agent identity (absent for the ordinary no-op). */
    readonly identity?: TeamAgentBindIdentity;
    /**
     * The admission state this call established or confirmed (absent for
     * the ordinary no-op). The caller gates any Team work on this flag.
     */
    readonly admitted?: boolean;
    /**
     * The closed admission code channel: `ADMISSION_OPEN` when admitted,
     * the guard's rejection code when rejected, or
     * `ADMISSION_GUARD_ERROR` when the guard faulted (fail-closed).
     */
    readonly admissionCode?: string;
    /** The event records THIS call emitted (empty for no-ops). */
    readonly emittedEvents: readonly AgentSetupEventRecord[];
}
/**
 * The constructor options of {@link TeamAgentBinder}.
 */
export interface TeamAgentBinderOptions {
    /** The injected public Agent setup surface (mock-first in T1). */
    readonly surface: TeamAgentSetupSurface;
    /** The injected READ-ONLY TeamDomain handle. */
    readonly teamDomain: TeamDomainReadHandle;
    /**
     * Optional slot overrides keyed by slot name; every key must be one of
     * {@link OVERLAY_SLOT_ORDER} and each slot's `name` must equal its key.
     * Absent slots fall back to the identity (no-op) defaults (T1 contract).
     */
    readonly slots?: Partial<Record<OverlaySlotName, OverlaySlot>>;
    /** Optional admission guard; absent = the default admitting guard (T1). */
    readonly admissionGuard?: AdmissionGuard;
}
//# sourceMappingURL=types.d.ts.map