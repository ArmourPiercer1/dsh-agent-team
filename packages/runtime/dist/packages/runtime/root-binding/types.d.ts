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
import type { AdmissionGuard, OverlaySlot, OverlaySlotName, TeamAgentBindResult, TeamAgentSetupSurface, TeamDomainReadHandle } from '../agent-setup/binder/index.js';
import type { BlueprintSnapshotRef, LeaderInstanceRecordDto, LeaderInstanceRecordInput, MemberInstanceRecordDto, MemberInstanceRecordInput, RootSessionId, SessionBindingDto, TeamSessionRecordDto, TeamSessionRecordInput } from '../../contracts/src/index.js';
import type { BlueprintCatalog } from '../../domain/blueprint/src/index.js';
/**
 * The durable TeamDomain WRITE surface — the fresh-root path's only
 * writer (invariant 41). The real adapter is
 * {@link createTeamDomainWritePort} (`./write-port.js`) over the P4
 * `TeamDomain` repositories; unit tests may inject a fake.
 *
 * Failure of any method aborts the fresh-root binding fail-closed:
 * the error propagates to the caller, the binder is NOT run, and the
 * durable state remains at whatever the writes committed (the write
 * ORDERING of the fresh path — record, then binding, then the leader
 * mint — makes a crash between any of them recoverable by a re-run;
 * see {@link bindFreshTeamRoot}).
 */
export interface TeamDomainWritePort {
    /**
     * Durably put the TeamSession record, keyed by root session id.
     * @param input - the contracts v1 input (branded ids; schemaVersion is
     *   stamped by the repository).
     * @returns the frozen stamped record.
     */
    putTeamSession(input: TeamSessionRecordInput): Promise<TeamSessionRecordDto>;
    /**
     * Durably put the session-kind binding row, keyed by session id.
     * @param binding - the contracts v1 binding DTO (fresh root: the
     *   `team-root` row).
     * @returns the frozen stored row.
     */
    putSessionBinding(binding: SessionBindingDto): Promise<SessionBindingDto>;
    /**
     * Durably put a MemberInstance record, keyed by the member identity
     * `(rootSessionId, instanceId)`. Fresh-root path only (P8-S2): the
     * durable LeaderInstance mint (Architecture §9.2, invariants 14/15).
     * @param input - the contracts input; the union admits the v1 member
     *   input and the v2 leader input (the contracts factory branches on
     *   the shape and mints the matching record — never a default).
     * @returns the frozen stamped record: the v2 leader record for a
     *   structurally leader input (no `childSessionId`/`lifecycle` keys),
     *   the v1 record otherwise (the documented contracts type-lie: the
     *   declared return covers both shapes).
     */
    putMemberInstance(input: MemberInstanceRecordInput | LeaderInstanceRecordInput): Promise<MemberInstanceRecordDto | LeaderInstanceRecordDto>;
}
/**
 * Every injected handle of the root binding. The module owns NO state
 * beyond this injection: the binder instance is created per call.
 */
export interface RootBindingPorts {
    /**
     * The binder's read-only TeamDomain handle (invariant 41 authority,
     * read side). The same handle must observe the writes of
     * {@link RootBindingPorts.writes} (true for one open TeamDomain).
     */
    readonly teamDomain: TeamDomainReadHandle;
    /** The durable write surface (fresh-root path only). */
    readonly writes: TeamDomainWritePort;
    /**
     * The Blueprint catalog the fresh path resolves the bound snapshot
     * against for the durable LeaderInstance mint (P8-S2, invariant 14).
     * Absent = the fresh path fails closed with
     * `ROOT_BINDING_LEADER_MINT_FAILED` when the leader row must be minted
     * (an idempotent re-run with the row already present never touches
     * the catalog — the mint is skipped).
     */
    readonly blueprintCatalog?: BlueprintCatalog;
    /**
     * The agent-setup surface — the only contact point to the agent
     * runtime (ruling R28 mock-first; the real DSH public seam in the
     * harness).
     */
    readonly surface: TeamAgentSetupSurface;
    /**
     * Overlay slot overrides; absent keys keep the binder's identity
     * defaults. The harness injects the real T2 (persona) / T3 (model) /
     * T4 (capability) slots here.
     */
    readonly slots?: Partial<Record<OverlaySlotName, OverlaySlot>>;
    /** The admission guard; absent = the binder's admitting default. */
    readonly admissionGuard?: AdmissionGuard;
    /**
     * Clock for the TeamSession `createdAt` stamp (UTC ISO-8601). Injected
     * for deterministic tests; default = system clock.
     */
    readonly now?: () => string;
}
/**
 * The fresh-root request: "make this root session the root of a Team".
 * The session must carry no binding or a consistent `team-root` binding
 * (an idempotent re-run) — any other kind is a fail-closed conflict.
 */
export interface FreshRootBindingInput {
    /** The root DSH session id (= the TeamSessionId, invariant 9). */
    readonly rootSessionId: RootSessionId;
    /** The immutable Blueprint snapshot binding (invariant 10). */
    readonly blueprint: BlueprintSnapshotRef;
    /** Team default workspace (optional; inherited by members, §21.2). */
    readonly defaultWorkspace?: string;
    /**
     * Record generation. The fresh-create path is a GENERATION-1 creation
     * path: a re-run must carry the same generation as the stored record
     * (a higher or lower generation is a conflict, not an update —
     * generation updates are a later task's surface).
     */
    readonly generation?: number;
}
/**
 * The cold-root request: "restore the Team root here, if one exists".
 * No identity fields — the durable record is the source of truth.
 */
export interface ColdRootBindingInput {
    /** The root DSH session id. */
    readonly rootSessionId: RootSessionId;
}
/**
 * The durable TeamDomain state of the bound root, observed after the
 * operation (read through the same read handle the binder uses).
 */
export interface RootBindingDurableState {
    /** The durable TeamSession record. */
    readonly teamSession: TeamSessionRecordDto;
    /** The durable `team-root` session binding row. */
    readonly binding: SessionBindingDto;
    /**
     * The durable row at the leader identity (`inst-leader`) observed
     * after the operation (P8-S2). A fresh mint is the honest v2
     * LeaderInstance record (no `childSessionId`/`lifecycle` keys); a
     * pre-existing legacy v1 hack row is reported as stored (the freeze
     * rule never converts stored rows). ABSENT when no row exists at the
     * leader identity (e.g. the cold path over a world that never minted).
     */
    readonly leaderRow?: MemberInstanceRecordDto | LeaderInstanceRecordDto;
    /**
     * `true` when THIS operation performed the durable writes (fresh
     * create); `false` for an idempotent re-run and for the cold path
     * (read-only by construction).
     */
    readonly wrote: boolean;
}
/**
 * The root-binding result: the durable state (absent for the ordinary
 * no-op) plus the binder's agent-setup result.
 */
export interface RootBindingResult {
    /** The bind path that was executed. */
    readonly path: 'fresh-root' | 'cold-root';
    /**
     * The durable state of the bound root; ABSENT when the session is
     * ordinary (or unbound) and the bind no-ops (the "ordinary root"
     * must-test: zero records, zero effects).
     */
    readonly durable?: RootBindingDurableState;
    /** The binder's result for the agent-setup step. */
    readonly bind: TeamAgentBindResult;
}
//# sourceMappingURL=types.d.ts.map