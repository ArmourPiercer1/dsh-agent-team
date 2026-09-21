/**
 * Strict-read + Core-spill — the Team artifact-read authority (D5/D6).
 *
 * One authority per production root (implementation guide §4), sharing
 * the open TeamDomain with the existing runtime services. It owns:
 *
 * - ISSUANCE: fresh `resolve` + `stat` of the just-written artifact,
 *   the two domain-separated digests, the DURABLE fact put (which must
 *   complete before the runtime install — a factless runtime grant is
 *   the forbidden state), and the registry install.
 * - USE: the read-time check (architecture §12): candidate lookup by
 *   composite identity + fresh targetKey digest → EXACT locator match
 *   → durable lifecycle eligibility → FRESH stat (missing / non-regular
 *   → inactive) → version digest equality.
 * - RECOVERY: the cold-restart rebuild from the durable facts (clear +
 *   replay; no stale-fact deletion — stale candidates are inert).
 *
 * Failure semantics (ADR §5): for a MANAGED Team session, any failure
 * of the record path THROWS — the spill wrapper rejects `saveText`, the
 * upstream consumer falls back to its best-effort inline result, and the
 * orphaned file (if any) is left to the DSH cleanup sweep. A
 * non-managed (non-Team) session never records and never throws: its
 * spill path stays upstream-equivalent.
 *
 * The authority receives every capability through ports (implementation
 * guide §2.5 — no plugin globals): fs identity ONLY through the DSH fs
 * seam (never parsed), session identity through the durable bindings,
 * and the fact family through the shared TeamLedger.
 *
 * @module @dsh-agent-team/runtime/artifact-read/authority
 */
import { PendingShellGrantTable } from './pending.js';
import { ArtifactGrantRegistry } from './registry.js';
import type { ArtifactFsTarget, ArtifactIdentityPort, ArtifactLedgerPort, ArtifactReadGrant, ArtifactSource, GrantVerdict, SpillStoreSource } from './types.js';
/** The ports the authority needs (implementation guide §2.5). */
export interface TeamArtifactAuthorityPorts {
    /** The DSH fs seam (resolve + stat; the only path to fs identity). */
    readonly fs: import('./types.js').ArtifactFsPort;
    /** The durable session → instance identity + lifecycle. */
    readonly identity: ArtifactIdentityPort;
    /** The durable `artifact-read-granted` fact family (TeamLedger). */
    readonly ledger: ArtifactLedgerPort;
}
/** The stable error of a record-path failure (the wrapper rejects saveText on it). */
export declare class ArtifactRecordError extends Error {
    readonly code: 'ARTIFACT_RECORD_FAILED';
    constructor(message: string);
}
/** The outcome of a record call. */
export type ArtifactRecordOutcome = {
    readonly recorded: true;
    readonly grant: ArtifactReadGrant;
} | {
    readonly recorded: false;
    readonly reason: 'unmanaged-session';
};
/** The input of {@link TeamArtifactAuthority.recordSpillStoreArtifact}. */
export interface RecordSpillStoreArtifactArgs {
    /** The DSH session that produced the spill (`SaveTextSpill.owner.sessionId`). */
    readonly sessionId: string;
    /** The structured spill source (verbatim from the DSH value). */
    readonly source: SpillStoreSource;
    /** The model-visible locator the SpillRef will carry. */
    readonly locator: string;
}
/** The input of {@link TeamArtifactAuthority.recordShellArtifact}. */
export interface RecordShellArtifactArgs {
    /** The TeamSession (from the agent's durable setup context). */
    readonly rootSessionId: string;
    /** The producing instance (from the agent's durable setup context). */
    readonly instanceId: string;
    /** The structured shell source (foreground or background). */
    readonly source: Extract<ArtifactSource, {
        kind: 'shell-foreground' | 'shell-background';
    }>;
    /** The model-visible spill path from the structured result. */
    readonly locator: string;
}
/** The input of {@link TeamArtifactAuthority.authorizeRead}. */
export interface AuthorizeReadArgs {
    /** The TeamSession of the reading agent (durable setup context). */
    readonly rootSessionId: string;
    /** The reading instance (durable setup context). */
    readonly instanceId: string;
    /** The EXACT raw path the model requested (`read`'s `file_path`). */
    readonly locator: string;
    /** The freshly resolved fs target (the permission canonicalization's own resolve). */
    readonly target: ArtifactFsTarget;
}
/**
 * The fault context of a failed shell-grant record (the observer's
 * diagnostics hook; the same fields the pre-fix observer reported).
 */
export interface ShellRecordFaultContext {
    readonly toolName: string;
    readonly callId: string;
    readonly stream: string;
}
/**
 * The artifact-read authority of one production root.
 */
export declare class TeamArtifactAuthority {
    private readonly ports;
    /** The runtime candidate projection (rebuilt from the ledger on cold start). */
    readonly registry: ArtifactGrantRegistry;
    /** The process-local pending shell-grant issuance table (PR #26 P1 —
     *  the pending grant barrier; module docs in ./pending.ts). A pending
     *  entry NEVER authorizes: it only synchronizes an immediate read with
     *  the in-flight record that mints the durable grant. */
    readonly pendingShellGrants: PendingShellGrantTable;
    constructor(ports: TeamArtifactAuthorityPorts);
    /**
     * Record a spill-store artifact (Phase C wrapper path).
     *
     * Non-managed sessions (no durable Team binding) return
     * `{ recorded: false }` without side effects — their spill path stays
     * upstream-equivalent. For a managed session, ANY failure throws
     * {@link ArtifactRecordError} (the wrapper rejects `saveText`; the
     * upstream consumer falls back to its best-effort inline result).
     *
     * Sequence (implementation guide §3): resolve → stat (regular file)
     * → digests → DURABLE put → runtime install. The grant is never
     * visible before its fact is durable.
     */
    recordSpillStoreArtifact(args: RecordSpillStoreArtifactArgs): Promise<ArtifactRecordOutcome>;
    /**
     * Record a shell artifact (Phase D foreground / Phase F background).
     *
     * The caller (the agent-scoped `tools/result` adapter) only records
     * for managed Team agents, and passes the composite identity from the
     * durable setup context. Unknown identities and ineligible lifecycles
     * throw (a managed agent in an unresolvable state fails closed — the
     * artifact is not grant-backed; the read stays denied as before).
     */
    recordShellArtifact(args: RecordShellArtifactArgs): Promise<ArtifactRecordOutcome>;
    /**
     * The PENDING-GRANT BARRIER entry (PR #26 P1, fix guide §1.2): the
     * `tools/result` observer calls THIS (synchronous, void) instead of
     * `recordShellArtifact`.
     *
     * Why: the DSH `tools/result` emitter does not await its observation
     * listeners (the pinned `notifyResult` runs
     * `void Promise.resolve(returned).catch(…)`), so the durable record is
     * in flight when the committed result reaches the model — and the
     * model's IMMEDIATE `read(spillPath)` must find the grant, not a gap.
     *
     * Ordering (the frozen barrier contract):
     * 1. the pending entry is registered SYNCHRONOUSLY, in the same call
     *    section as the record start (no await between them — no read can
     *    observe "record in flight, no pending");
     * 2. the record runs (resolve → stat → digests → durable put →
     *    registry install) exactly as before;
     * 3. the pending entry is removed in `finally` — success OR failure;
     * 4. a FAILED record reports through the guarded `onFault` hook (the
     *    observer's diagnostics) and settles to NO grant — the read stays
     *    denied as before (fail-closed, the committed tool result is
     *    untouched).
     *
     * The pending entry NEVER authorizes by itself:
     * {@link authorizeRead} awaits it ONLY to re-run the durable-grant
     * verification against whatever the record produced (fix guide §1.2 —
     * "pending 本身绝不能直接授权").
     *
     * @param args - the record input (the same as `recordShellArtifact`).
     * @param onFault - OPTIONAL guarded diagnostics hook for a failed
     *   record (the observer passes its `onFault` wrapper — a throwing
     *   hook never affects the observation).
     */
    beginShellArtifactRecord(args: RecordShellArtifactArgs, onFault?: (fault: unknown, context: ShellRecordFaultContext) => void): void;
    /**
     * The read-time grant check (architecture §12 + PR #26 P1 barrier).
     * PURE with respect to the permission pipeline: it only ever ADDS
     * authorization for the `read` tool; a `valid: false` verdict means
     * "no grant applies — proceed through the unchanged pipeline" (it
     * never denies by itself).
     *
     * Check order: candidate lookup (identity + fresh target digest) →
     * exact locator match → lifecycle eligibility → fresh stat (missing /
     * non-regular → inactive) → fresh version digest.
     *
     * The PENDING BARRIER (fix guide §1.2): when the durable check finds
     * NO candidate for this (identity, target) pair and EXACTLY the
     * pending issuance (same composite identity, SAME locator) is in
     * flight, the check AWAITs that pending and RE-RUNS the durable
     * verification. A failed (or foreign / wrong-locator) pending is
     * simply not awaited / settles to nothing — the ordinary pipeline
     * decides. A pending NEVER authorizes by itself.
     */
    authorizeRead(args: AuthorizeReadArgs): Promise<GrantVerdict>;
    /**
     * Cold-restart rebuild (implementation guide §3): clear the runtime
     * projection and replay the durable facts (defensively parsed; corrupt
     * rows are skipped and counted, never guessed). Stale facts (deleted
     * or replaced artifacts) are installed as INERT candidates — they
     * simply fail the fresh identity check at use.
     *
     * @returns the rebuild counts (diagnostics).
     */
    rebuildFromLedger(): Promise<{
        rebuilt: number;
        skipped: number;
    }>;
    /** Drop every runtime candidate (domain close). Durable facts remain.
     *  The pending table is the runtime projection's in-flight view too —
     *  it resets with the domain. A record that SETTLES after the close
     *  still lands its durable fact (the ledger is the source of truth)
     *  and may install into the closed domain's registry — dead state no
     *  consumer reads (the next setup builds a fresh authority and
     *  rebuilds from the ledger); the barrier's `finally` removal is a
     *  no-op on the cleared table. */
    dispose(): void;
    /**
     * The durable-grant verification (architecture §12) — the check-order
     * core that {@link authorizeRead} runs (and, after a pending barrier
     * wait, re-runs): candidate lookup (identity + fresh target digest) →
     * exact locator match → lifecycle eligibility → fresh stat (missing /
     * non-regular → inactive) → fresh version digest.
     */
    private verifyGrant;
    /**
     * Shared record core: fresh resolve + stat → digests → durable put →
     * runtime install. Throws {@link ArtifactRecordError} on any failure
     * (the caller's session is managed; ADR §5 fail-closed).
     */
    private recordArtifact;
    /** Resolve through the fs seam, mapping any failure to the record error. */
    private safeResolve;
    /** Stat through the fs seam (undefined = absent); a seam fault fails closed. */
    private safeStat;
    /** Fresh stat for the use path: a seam fault fails closed (no grant). */
    private freshStat;
}
//# sourceMappingURL=authority.d.ts.map