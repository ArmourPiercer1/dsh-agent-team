/**
 * `a5p5-tools` Phase 2 — SPILL semantics: the controlled-path life of large
 * tool output inside the World (task slice ①; plan §8 "Spill 可正确归属且被
 * 读取时复核权限"; S0 D-4: the Adapter self-manages spill — the native
 * post-execute identity path of S-09 is deliberately NOT relied on).
 *
 * THE FOUR LAWS (each pinned by `test/a5p5-spill.test.ts`):
 *
 *  1. WORLD-BOUND CONTROLLED PATH. Every byte lands under a `rootDir` that is
 *     a STRICT descendant of the injected `worldRoot` (segment-law, `..`
 *     refused BEFORE any collapse — the same pre-collapse refusal as
 *     `args.ts`). A forged spillId (separators, `..`, absolutes, NUL, blank,
 *     over-length) is a typed refusal with ZERO port calls: refuse before
 *     touch, never "write then filter".
 *  2. LEASE-SHAPED LIFECYCLE (INTERFACES-v1.md C-GW): the closed states are
 *     ACTIVE → DRAINING → CLOSED; the ACTIVE→DRAINING edge is the ONE settled
 *     edge, and from DRAINING on every NEW write is typed-refused (the bytes
 *     already settled stay exactly as they were).
 *  3. RESIDUE NEVER VANISHES SILENTLY. Enumeration reads the DISK, not
 *     memory: residue of a cancelled or torn-down call is listed by a FRESH
 *     store handle with attribution and settlement class intact — and an
 *     ORPHAN file (no meta at all) is still enumerated, as unattributed.
 *     Cleanup is the explicit, listed alternative; after it a read is a
 *     typed `spill-missing` refusal, never silence (C-FS: hidden-read 永不
 *     静默 — the typed error classes here are exactly the C-FS triad
 *     denied/hidden/undetermined).
 *  4. READ RE-CHECKS AUTHORIZATION (S0 D-4). `readSpill` asks the INJECTED
 *     authorizer before any payload I/O; the lane decides nothing itself — it
 *     consumes a verdict, mirroring the C-ADM read-time law with no second
 *     authorization fact.
 *
 * The cancellation/settlement event vocabulary is the C-BIND v1.1 pin — the
 * six PR1r event names VERBATIM AS EMITTED by the merged dispatcher
 * (v1.1 勘正, integration wiring round): the master@452a04c0 emission face
 * carries the `dispatcher-call-` prefix on ALL SIX names
 * (`tool-dispatch/install.ts:651,662,673,686,763`); the mixed full/short
 * transcription in the pre-erratum INTERFACES line is superseded. Normal
 * completion is the one non-cancelled settlement. The delivery semantics of
 * these names ride the dispatcher's own channel — this lane only validates
 * the NAME at a settlement it was given; nothing here makes any statement
 * about that channel's delivery behaviour (PENDING-GATES G-g OPEN).
 *
 * Purity: no `node:*`, no I/O, no clock — all disk contact goes through the
 * injected `SpillFsPort`; the tests provide the `node:fs` adapter.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/spill
 */
/** C-GW lease-shape states, in transition order. */
export declare const SPILL_LEASE_STATES: readonly ["active", "draining", "closed"];
export type SpillLeaseState = (typeof SPILL_LEASE_STATES)[number];
/**
 * The C-BIND v1.1 PR1r cancellation event names — VERBATIM as the merged
 * dispatcher emits them (v1.1 勘正: all six carry the `dispatcher-call-`
 * prefix at master@452a04c0; closed set).
 */
export declare const SETTLEMENT_EVENTS: readonly ["dispatcher-call-cancelled-before-body", "dispatcher-call-terminated-after-body-start", "dispatcher-call-completed-after-abort", "dispatcher-call-outcome-unreadable", "dispatcher-call-cancelled-by-others", "dispatcher-call-executed-unvalidated"];
export type SettlementEvent = (typeof SETTLEMENT_EVENTS)[number];
/** How a settled edge happened: normal completion, or a cancellation class. */
export type LeaseSettlement = {
    readonly kind: 'completed';
} | {
    readonly kind: 'cancelled';
    readonly event: SettlementEvent;
};
/** The C-FS typed-error triad (denied/hidden/undetermined) — closed set. */
export declare const SPILL_ERROR_CLASSES: readonly ["denied", "hidden", "undetermined"];
export type SpillErrorClass = (typeof SPILL_ERROR_CLASSES)[number];
/** The closed refusal vocabulary of this module. */
export declare const SPILL_REFUSAL_CODES: readonly ["spill-root-outside-world", "spill-id-invalid", "spill-id-in-use", "spill-write-after-drain", "spill-write-after-close", "spill-settled-twice", "spill-settlement-event-unknown", "spill-close-without-settle", "spill-finalize-before-settle", "spill-finalized-twice", "spill-read-denied", "spill-missing"];
export type SpillRefusalCode = (typeof SPILL_REFUSAL_CODES)[number];
export interface SpillRefusal {
    readonly code: SpillRefusalCode;
    readonly class: SpillErrorClass;
    readonly detail: string;
}
export type OpenStoreResult = {
    readonly ok: true;
    readonly store: SpillStore;
} | {
    readonly ok: false;
    readonly refusal: SpillRefusal;
};
export type OpenSinkResult = {
    readonly ok: true;
    readonly sink: SpillSink;
} | {
    readonly ok: false;
    readonly refusal: SpillRefusal;
};
export type WriteResult = {
    readonly ok: true;
    readonly bytes: number;
} | {
    readonly ok: false;
    readonly refusal: SpillRefusal;
};
export type LeaseMoveResult = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly refusal: SpillRefusal;
};
export type ReadSpillResult = {
    readonly ok: true;
    readonly text: string;
    readonly attribution: SpillAttribution | null;
} | {
    readonly ok: false;
    readonly refusal: SpillRefusal;
};
/** The file-system port the store is allowed to touch — nothing else. */
export interface SpillFsPort {
    ensureDir(path: string): void;
    writeFile(path: string, text: string): void;
    appendFile(path: string, text: string): void;
    readText(path: string): string;
    sizeBytes(path: string): number;
    list(dir: string): readonly string[];
    remove(path: string): void;
    exists(path: string): boolean;
}
/** Who a spill belongs to (S0 D-4 归属): the call, not the model's words. */
export interface SpillAttribution {
    readonly realmId: string;
    readonly tool: string;
    readonly callId: string;
}
export interface SpillSink {
    readonly spillId: string;
    /** Characters accepted so far (the bytes law is the port's at read-back). */
    bytes(): number;
    write(chunk: string): WriteResult;
    /** Record the settled-edge fact on the residue meta; requires a settled lease. */
    finalize(settlement: LeaseSettlement): LeaseMoveResult;
}
export interface SpillLease {
    state(): SpillLeaseState;
    settle(settlement: LeaseSettlement): LeaseMoveResult;
    close(): LeaseMoveResult;
}
export interface SpillResidueEntry {
    readonly spillId: string;
    readonly bytes: number;
    readonly attribution: SpillAttribution | null;
    readonly settlement: LeaseSettlement | null;
}
export type ReadAuthorizer = (attribution: SpillAttribution | null) => {
    allow: true;
} | {
    allow: false;
    detail: string;
};
export declare function createSpillLease(): SpillLease;
export interface SpillStore {
    openSink(args: {
        spillId: string;
        lease: SpillLease;
        attribution: SpillAttribution;
    }): OpenSinkResult;
    listResidue(): readonly SpillResidueEntry[];
    cleanupResidue(): {
        readonly removed: readonly string[];
    };
    readSpill(spillId: string, authorize: ReadAuthorizer): ReadSpillResult;
}
export declare function openSpillStore(deps: {
    worldRoot: string;
    rootDir: string;
    fs: SpillFsPort;
}): OpenStoreResult;
//# sourceMappingURL=spill.d.ts.map