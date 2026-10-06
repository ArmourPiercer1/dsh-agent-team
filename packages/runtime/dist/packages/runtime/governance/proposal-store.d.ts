/**
 * A4-PR0 — the durable governance proposal substrate (plan Task 0 / A4-PR0;
 * ADR A5-13, A4-2, A4-3, A4-5, A4-6, A4-7; spec §8.4, §24.5, §25.2).
 *
 * WHAT THIS MODULE IS. A record of "someone proposes that this Member's
 * permission overlay move to this effect, from THIS overlay position, and this
 * is the authority that has to agree". It is a durable FACT and nothing else:
 * it approves nothing, authorizes nothing, ranks nothing and mutates nothing.
 * The durable permission chain is still written only by the permission
 * mutation path (ADR §1); this module's output is an input to the decision
 * that eventually reaches it, which is why it holds no overlay reference at
 * all (ADR A4-3).
 *
 * NO PRODUCT SURFACE (ADR A4-6). Nothing in `src/plugin/**` imports this file,
 * it is not re-exported from `governance/index.ts`, and the governance service
 * factory gains no method — the fact type is registered in the two category
 * maps because an UNREGISTERED type makes every projection read of that Team throw forever (the PR0a defect), not because any product path writes one yet.
 *
 * WHY THE PORTS ARE STRUCTURAL (ADR A4-6). The lane may not import a ledger
 * repository TYPE from storage: storage's `LedgerRepository` is a class over a
 * storage seam, and depending on it here would make the substrate untestable
 * outside a storage domain and would put the proposal lane on the storage
 * import list that `a3p3-governance-lane-hygiene.test.ts` exists to keep small.
 * So the writer and reader ports below declare the ROW and the two or three
 * MEMBERS this module actually touches. The adapter is named, not hidden:
 * `packages/storage/repositories/ledger.ts`'s `LedgerRepository` satisfies
 * both ports as it stands — `allocateSequence()`, `put()` and `list()` are
 * already exactly these members over a structurally compatible row, and
 * `a4pr0-proposal-store.test.ts` passes the real repository object with no
 * shim, which is what makes "structural" a checked property rather than a
 * claim. (`src/plugin/root.ts` wires the production ledger the same way for
 * the override store, at `:2481`.)
 *
 * THE THREE GENERATIONS, AND WHICH ONE THIS RECORD CARRIES (ADR A4-2/A4-3).
 * `baseGeneration` is the OVERLAY SNAPSHOT generation — the head of the chain
 * the proposal was written against — and `baseSnapshotId` is that snapshot's
 * derived identity beside it. It is NOT `team_sessions.generation` (the
 * per-team stamp every ledger fact advances, so it would be stale before the
 * record was read back) and NOT the override slot winner (a different plane).
 * The pair is the proposal's claim about the world, so the pair must agree
 * with itself: `null` stands only with `0` (spec §24.5's empty overlay
 * history), and a non-null id must be the derived identity of that generation
 * for that member. A pair that disagrees is CORRUPT, not stale — staleness is
 * a comparison against the CURRENT head, which this module cannot perform
 * because it holds no overlay; the revalidation that turns a stale pair into
 * `mutation-stale` is PR5's, inside the mutation path that owns the overlay
 * (ADR A4-3, spec §24.5).
 *
 * APPEND-ONLY STANDING. A row's `status` is `'pending'`, always, and the
 * STORE stamps it — a caller cannot append a row claiming a different
 * standing. Nothing ever rewrites a row, so a proposal's standing changes only
 * through a NEWER fact (ADR A3-6, spec §26.4), and the answer to it is a
 * Control decision with its own vocabulary (`allow | deny | stale-denied`,
 * spec §11.3). A richer status vocabulary here would duplicate one of those
 * two laws, which is why the set is closed at one value at PR0 and widening it
 * is a plan-level change (ADR A5-13, A3-14 on dead names).
 *
 * @module @dsh-agent-team/runtime/governance/proposal-store
 */
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js';
import { GOVERNANCE_PROPOSAL_ERROR_CODES } from './proposal-codes.js';
/**
 * The fact type this lane writes. It lives in THIS lane because the writer
 * lives here; the two category maps (`src/plugin/projection-source.ts` and the
 * client's `model/ledger-adapter.ts`, ADR A5-22) name the same string, and
 * `a4pr0a-fact-type-closed-set.test.ts` C1 fails if this one ever drifts from
 * the map. The name carries `FACT_TYPE` on purpose: the guard's constant
 * registry harvests constants named `*_FACT_TYPE*`, and a name outside that
 * convention would make the guard blind to this writer.
 */
export declare const GOVERNANCE_PROPOSAL_FACT_TYPE = "governance-proposal-recorded";
/**
 * The `schemaVersion` of the ledger ROW this writer builds, MIRRORED rather
 * than imported. `LedgerRepository.put` re-validates it against storage's
 * `TEAM_DOMAIN_SCHEMA_VERSION`, and `a4pr0-proposal-store.test.ts` pins the
 * mirror against that constant — the same discipline as the permission
 * kernel's mirrored rule-set bound, so the lane keeps no runtime edge to a
 * storage repository module.
 */
export declare const GOVERNANCE_PROPOSAL_LEDGER_SCHEMA_VERSION = 2;
/**
 * The authority POSITIONS the `requiredAuthority` field may carry: the four
 * positions ADR A5-1's ladder names (ADR execution-round correction X2).
 *
 * PR0 declares this structurally because the ladder does not exist yet:
 * `RuntimeAuthority` with its `authorityRank()` / `isHigherAuthority()` /
 * ceiling evaluator is PR2's product, and there is nothing on the tree to
 * import today. TWO NAMED OBLIGATIONS follow, and they are PR2's, not
 * suggestions:
 *
 *  1. PR2's `RuntimeAuthority` must be DEFINITIONALLY identical to this union
 *     — assignable in both directions with no cast anywhere. Declaring a
 *     second, divergent ladder type is a plan change.
 *  2. PR2 must either import this union or alias its own name to it, so the
 *     durable vocabulary and the runtime vocabulary stay one set.
 *
 * PR0 PERSISTS the position and INTERPRETS it not at all: no rank, no
 * comparison, no ceiling, no "is this authority enough" helper lives in this
 * file or in PR0. A comparator here would mean PR2's authority algebra ships
 * with no RED of its own to prove it was written before the code it protects.
 */
export declare const PROPOSAL_AUTHORITY_POSITIONS: readonly ["member", "leader", "human-user", "human-admin"];
/** One authority position a proposal may name as its required authority. */
export type ProposalAuthorityPosition = (typeof PROPOSAL_AUTHORITY_POSITIONS)[number];
/**
 * The append-time standing of a proposal row. One value, on purpose: a row is
 * never rewritten, so the standing of a proposal changes only through a newer
 * fact (ADR A3-6, spec §26.4) and the ANSWER to it is a Control decision with
 * its own closed vocabulary (spec §11.3). Any second value here would be a
 * name nothing can ever write (ADR A3-14) or a duplicate of one of those two
 * laws; widening the set is a plan-level change (ADR A5-13).
 */
export declare const GOVERNANCE_PROPOSAL_STATUSES: readonly ["pending"];
/** One proposal standing. */
export type GovernanceProposalStatus = (typeof GOVERNANCE_PROPOSAL_STATUSES)[number];
/**
 * The `authorityEnvelopeAst` field: the A3-9 SHARED AST in its Blueprint/config
 * shape — `{ kind, path }` for `exact`/`subtree`, `{ kind, fingerprint }` for
 * `fingerprint` (ADR execution-round correction X3).
 *
 * The config shape wins because the AST is bound into the Blueprint
 * `contentHash` (ADR A3-9): a second spelling would silently rewrite every
 * existing hash (ADR A2-11). The RUNTIME matcher shape (`{ kind, resource }`)
 * stays what the overlay chain stores, and the mapping between the two is the
 * boundary adapter A3-9 assigns to PR1/PR2 and performs only through the
 * injected containment seam — it is NOT done here, and nothing in PR0
 * interprets the node: no validator, no containment, no class/matcher pairing
 * (a record carries no operation class, so PR0 could not pair it honestly).
 *
 * ONE NODE PER ROW, GROUPED BY `caseFingerprint`: a proposal that addresses
 * two envelope rules is two rows of one case (spec §8.4 lists the fingerprint
 * INPUTS of a case; it does not describe the row set).
 */
export type GovernanceProposalEnvelopeAst = {
    readonly kind: 'exact';
    readonly path: string;
} | {
    readonly kind: 'subtree';
    readonly path: string;
} | {
    readonly kind: 'fingerprint';
    readonly fingerprint: string;
};
/** The AST kinds the shared grammar admits (closed; iteration is the audit). */
export declare const PROPOSAL_ENVELOPE_AST_KINDS: readonly ["exact", "subtree", "fingerprint"];
/**
 * The durable `operationId` shape, MIRRORED and pinned (the same discipline as
 * {@link GOVERNANCE_PROPOSAL_LEDGER_SCHEMA_VERSION}): the owner is
 * `storage/schema/operation.ts:45`, which validates it in `parseLedgerEntry`
 * (`storage/schema/ledger.ts:189-195`) — i.e. AFTER a sequence has been
 * allocated. Without this check here, a caller's typo in an operation id would
 * burn a ledger sequence and surface a storage `TeamDomainError` where this
 * lane's contract promises a `MALFORMED_PROPOSAL` refusal with zero allocation.
 */
export declare const GOVERNANCE_PROPOSAL_OPERATION_ID_PATTERN: RegExp;
/**
 * What a caller asks the store to record: the eight fields of the frozen
 * record that are the CALLER's to choose.
 *
 * Two frozen fields are NOT here, and both are the store's to stamp:
 *  - `status` — always `'pending'` at append (see the note above: a caller
 *    that could choose it could append a row claiming an authority it has no
 *    proof of);
 *  - `recordedAt` — the store's clock, also written into the ledger row's
 *    `createdAt`, so the two can never disagree and no caller can record a
 *    proposal at a time of its choosing.
 */
export interface GovernanceProposalDraft {
    /** The Member whose overlay the proposal addresses. The name is
     *  `targetMemberInstanceId`, NOT `targetInstanceId`, on purpose: the four
     *  `FACT_ADDRESSING_KEYS` of the read port
     *  (`instanceId`/`targetInstanceId`/`recipientInstanceId`/
     *  `deliveredToInstanceId`) drive DISPOSED retained-history attribution, and
     *  a proposal is a statement about the TEAM's authority, not a fact that
     *  belongs to a disposed member's retained share (ADR A4-5 — the disclosed
     *  trade-off: a proposal row is never attributed to its target). */
    readonly targetMemberInstanceId: string;
    /** The OVERLAY SNAPSHOT generation this proposal was written against
     *  (ADR A4-2: this counter, not the session stamp, not the slot winner). */
    readonly baseGeneration: number;
    /** The derived identity of that snapshot, or `null` for an EMPTY overlay
     *  history — and then, and only then, with `baseGeneration: 0`
     *  (spec §24.5). The pair is authoritative together (ADR A4-3). */
    readonly baseSnapshotId: string | null;
    /** The effect the proposal asks the overlay to carry (the canonical overlay
     *  effect vocabulary, ADR A5-3). */
    readonly desiredEffect: PermissionOverlayEffect;
    /** The envelope node the proposal relies on, in the shared A3-9 shape. */
    readonly authorityEnvelopeAst: GovernanceProposalEnvelopeAst;
    /** The authority position that has to agree (persisted, not interpreted). */
    readonly requiredAuthority: ProposalAuthorityPosition;
    /** The approval-case identity this row belongs to (spec §8.4). Computed by
     *  the caller, NEVER here: §8.4 makes proposal-fingerprint computation the
     *  approval-plane's job, and A5-13 freezes this field as a record INPUT a
     *  later PR may extend but not retype — a digest helper in the substrate
     *  would quietly fix the input set that PR5 owns. */
    readonly caseFingerprint: string;
}
/** The durable record: the draft plus the two fields the store stamps. The
 *  field NAMES are frozen by ADR A5-13 (plan line 872 freezes names, not
 *  types); the payload of a `governance-proposal-recorded` row is exactly
 *  these nine keys, no more and no fewer. */
export interface GovernanceProposalRecord extends GovernanceProposalDraft {
    /** The append-time standing; `'pending'`, stamped by the store. */
    readonly status: GovernanceProposalStatus;
    /** When the store committed the row (the same stamp as the ledger row's
     *  `createdAt`). */
    readonly recordedAt: string;
}
/** The ledger row as this module sees it: the members it reads or writes, and
 *  nothing else. `payload` stays `unknown`-shaped ON PURPOSE — this module
 *  parses its own payload and never trusts another lane's. */
export interface GovernanceProposalLedgerRow {
    readonly schemaVersion: number;
    readonly sequence: number;
    readonly rootSessionId: string;
    readonly factType: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly createdAt: string;
    readonly operationId?: string;
}
/** The write half: allocate, then durably put. Two members because that is the
 *  production writer's shape (the sequence is allocated before the row exists,
 *  which is why validation must — and does — precede both). */
export interface GovernanceProposalLedgerWriterPort {
    allocateSequence(): Promise<number>;
    put(row: GovernanceProposalLedgerRow): Promise<unknown>;
}
/** The read half: the whole ledger, in sequence order. Deliberately NOT a
 *  filtered query — the row-level filter (root + fact type) is this module's
 *  job, and the durable read's failure is allowed to propagate (ADR A4-7's
 *  second leg). */
export interface GovernanceProposalLedgerReaderPort {
    list(): readonly GovernanceProposalLedgerRow[];
}
/** Everything the store needs (the whole interface — no optional port, so
 *  there is no dormant half of this capability to mistake for a working one). */
export interface GovernanceProposalStoreDeps {
    readonly ledger: GovernanceProposalLedgerWriterPort & GovernanceProposalLedgerReaderPort;
    /** The store's clock (ISO-8601). No caller-supplied durable stamp exists. */
    readonly now: () => string;
}
/** One sound proposal row. */
export interface ProposalReadRecord {
    readonly kind: 'record';
    /** The ledger sequence the row lives at (the ordering is the supersession
     *  law: a newer sequence for the same `caseFingerprint` supersedes). */
    readonly sequence: number;
    readonly teamSessionId: string;
    readonly operationId?: string;
    readonly proposal: GovernanceProposalRecord;
}
/** One row of THIS fact type that is not a proposal record. Typed, located,
 *  and the row stays in the list — reporting corruption must never hide it. */
export interface ProposalReadCorrupt {
    readonly kind: 'corrupt-record';
    readonly code: typeof GOVERNANCE_PROPOSAL_ERROR_CODES.CORRUPT_RECORD;
    readonly sequence: number;
    /** The row's fact type (so a reader can tell which lane's row this is). */
    readonly factType: string;
    /** Where the bad value lives, e.g. `payload.baseSnapshotId` or
     *  `payload.authorityEnvelopeAst.kind`. */
    readonly path: string;
    /** The record field at fault (the AST sub-path names its parent field). */
    readonly field: string;
    /** The machine-readable reason, stable across versions. */
    readonly problem: string;
    readonly message: string;
}
/** What reading one proposal row yields. An ABSENCE of outcomes means
 *  "no proposals", never "something was wrong": unreadable rows appear here as
 *  `corrupt-record`, and a ledger that cannot be read at all throws (see
 *  {@link GovernanceProposalStore.listProposals}). */
export type GovernanceProposalReadOutcome = ProposalReadRecord | ProposalReadCorrupt;
/** One proposal's durable position, as appended. */
export interface GovernanceProposalAppended {
    readonly sequence: number;
    readonly record: GovernanceProposalRecord;
}
/** What a caller may ask the store to append: the draft, the Team it belongs
 *  to, and (optionally, key-omitted) the operation that produced it. */
export interface GovernanceProposalAppendArgs {
    readonly teamSessionId: string;
    readonly proposal: GovernanceProposalDraft;
    readonly operationId?: string;
}
/** The durable proposal record store. */
export interface GovernanceProposalStore {
    /**
     * Durably append one proposal row.
     *
     * Validation happens BEFORE `allocateSequence`, so a refusal leaves nothing
     * behind: no row, no hole in the sequence counter, no session-stamp advance.
     * @throws GovernanceProposalError (`MALFORMED_PROPOSAL`) for a record this
     *   row cannot honestly carry.
     */
    appendProposal(args: GovernanceProposalAppendArgs): Promise<GovernanceProposalAppended>;
    /**
     * Read this Team's proposal rows in ledger order, sound and corrupt alike.
     *
     * Entry-level unreadability is NOT caught: `list()` deserializes every row,
     * so a corrupt ENTRY throws through this method (ADR A4-7's second leg).
     * Returning `[]` there would claim "this Team has no proposals" about a
     * ledger that could not be read at all (spec §25.2 — proposal reads never go
     * through a lenient parser).
     */
    listProposals(query: {
        readonly teamSessionId: string;
    }): readonly GovernanceProposalReadOutcome[];
}
/**
 * Build one proposal store over one durable ledger.
 *
 * @param deps - the ledger ports and the store's clock (see
 *   {@link GovernanceProposalStoreDeps}).
 * @returns the store surface ({@link GovernanceProposalStore}).
 */
export declare function createGovernanceProposalStore(deps: GovernanceProposalStoreDeps): GovernanceProposalStore;
//# sourceMappingURL=proposal-store.d.ts.map