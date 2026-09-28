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
//# sourceMappingURL=types.js.map