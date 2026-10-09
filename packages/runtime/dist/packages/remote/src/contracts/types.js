/**
 * Typed output value mirrors of the Remote contract v1.
 *
 * These are the `data` shapes the dispatcher wraps in the success result.
 * They mirror — at the value level (deviation D-1) — the durable DTOs and
 * service results the backing ports return (design note §3 table, "Output
 * value (data)"). Deep validation is deliberately NOT repeated here (D-4):
 * the backing services own their invariants; the remote layer (a) checks
 * the top-level shape of the whole-projection DTO, (b) normalizes closed
 * wire fields (e.g. ledger `operationId` → `string | null`), and (c)
 * lossless-JSON-checks every value before the reply is built.
 *
 * `RemoteSafeRecord` marks "a lossless-JSON-checked value whose deep shape
 * is owned by the backing service".
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/contracts/types
 */
// ---------------------------------------------------------------------------
// Provenance helpers (shared by the handler modules)
// ---------------------------------------------------------------------------
/** The top-level fields of the P8-T1 whole-projection DTO (mirror). */
export const REMOTE_PROJECTION_FIELDS = [
    'blueprint',
    'generation',
    'generatedAt',
    'ledger',
    'members',
    'root',
    'schemaVersion',
    'teamSessionId',
    'templates',
];
/**
 * The top-level fields of the contract-v6 whole-projection value: the nine
 * frozen v1 fields plus the two additive v6 freshness fields
 * (`durableGeneration`, `liveToken`).
 */
export const REMOTE_PROJECTION_FIELDS_V6 = [
    ...REMOTE_PROJECTION_FIELDS,
    'durableGeneration',
    'liveToken',
];
/** The top-level fields of the storage `LedgerEntry` (mirror). */
export const REMOTE_LEDGER_ENTRY_FIELDS = [
    'createdAt',
    'factType',
    'operationId',
    'payload',
    'rootSessionId',
    'schemaVersion',
    'sequence',
];
// ---------------------------------------------------------------------------
// A4-PR6 §6.B — contract v8 wire DTOs (the closed intervention-plane shapes)
// ---------------------------------------------------------------------------
/**
 * The closed authority-ladder position cell (mirror of the runtime
 * `PROPOSAL_AUTHORITY_POSITIONS`; the ordering law is NOT mirrored — the
 * wire carries a position NAME, never a rank, and every comparison is
 * server-side).
 */
export const REMOTE_INTERVENTION_AUTHORITY_POSITIONS = [
    'member',
    'leader',
    'human-user',
    'human-admin',
];
/** The frozen top-level field set of a wire item (closed value — the
 *  handler validates every port item against it, presence AND absence). */
export const REMOTE_INTERVENTION_ITEM_FIELDS = [
    'interventionId',
    'kind',
    'responseBehavior',
    'blockScope',
    'source',
    'status',
    'legalActions',
    'derivationReasons',
    'createdAt',
    'requiredAuthority',
    'currentReviewAuthority',
    'fingerprint',
    'updatedAt',
    'lastObservedAt',
    'observationCount',
];
/** The closed `source` field set (null cells typed, never absent). */
export const REMOTE_INTERVENTION_SOURCE_FIELDS = [
    'kind',
    'id',
    'requestId',
    'legOrdinal',
    'carrierKind',
];
/**
 * The `intervention.act` wire outcome (v8). CLOSED set — the response
 * carries NOTHING else: no authority, no legal actions, no decision
 * record (the next `intervention.list`/`get` re-derives the full state;
 * the act response is a receipt, not a projection).
 */
export const REMOTE_INTERVENTION_ACT_OUTCOMES = [
    'decided',
    'escalated',
    'acknowledged',
    'already-acknowledged',
];
/** The closed field set of the administration wire value. */
export const REMOTE_PERMISSION_ADMINISTRATION_FIELDS = [
    'teamSessionId',
    'memberInstanceId',
    'generation',
    'source',
    'effective',
    'diagnostics',
];
// ---------------------------------------------------------------------------
// A4-PR7 W1 — contract v9: the corrupt-leg visibility read
// ---------------------------------------------------------------------------
/**
 * The closed cap of the wire `legs` list (v9). The corruptCount stays
 * EXACT (never capped — the human must see the true size of the ledger
 * fault); `legs` carries at most this many rows in ascending sequence
 * order with `truncated` disclosed when fewer than `corruptCount` ride.
 * The cap keeps a pathological ledger from minting an unbounded wire.
 */
export const REMOTE_CORRUPT_CONTROL_LEGS_CAP = 20;
/** The closed field set of one corrupt leg (optional cells: echo-only). */
export const REMOTE_CORRUPT_CONTROL_LEG_FIELDS = [
    'sequence',
    'disclosesMember',
    'requestId',
    'approvalCaseId',
];
/** The closed field set of the corrupt-legs wire value. */
export const REMOTE_CORRUPT_CONTROL_LEGS_FIELDS = [
    'teamSessionId',
    'corruptCount',
    'truncated',
    'legs',
];
//# sourceMappingURL=types.js.map