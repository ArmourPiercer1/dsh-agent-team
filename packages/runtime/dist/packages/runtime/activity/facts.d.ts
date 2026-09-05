/**
 * P6-T5 — the deterministic fact machinery: op ↔ factType mapping, the
 * durable-entry builder (writer side) and the strict parser (reader side).
 *
 * Both directions are PURE and DETERMINISTIC: the same durable entry
 * always parses to the same `ActivityFactRow` (or `undefined` when the
 * entry is not a well-formed activity fact — foreign fact types and
 * malformed payloads are skipped, never guessed), and the builder always
 * emits the closed payload shape. No timestamps are generated here: the
 * `createdAt` display label is supplied by the caller (the ledger's
 * injected clock) — ordering identity stays with the TeamLedger sequence
 * (invariant 44).
 */
import type { ProgressValue } from '../admission/index.js';
import type { LedgerEntry } from '../../storage/schema/index.js';
import type { RootSessionId } from '../../contracts/src/index.js';
import type { ActivityFactRow, ActivityFactType, ActivityOp } from './types.js';
/** The closed op → factType mapping. */
export declare const OP_TO_FACT_TYPE: Record<ActivityOp, ActivityFactType>;
/** The closed factType → op mapping. */
export declare const FACT_TYPE_TO_OP: Record<ActivityFactType, ActivityOp>;
/** Type guard: `factType` is one of the closed activity fact types. */
export declare function isActivityFactType(factType: string): factType is ActivityFactType;
/**
 * Parse ONE durable ledger entry into an activity row (or `undefined`
 * when the entry is not a well-formed activity fact).
 *
 * The parse is fail-safe: every field is re-validated against the SAME
 * bounds the writer enforced, so a corrupted or foreign row can never
 * poison a projection — it is simply skipped. The `op` MUST agree with
 * the factType (a mismatch is a corrupted fact, not a variant).
 *
 * @param entry - the durable ledger entry.
 * @returns the parsed row, or `undefined` for non-activity/corrupt rows.
 */
export declare function parseActivityFact(entry: LedgerEntry): ActivityFactRow | undefined;
/** The closed builder input (every field already writer-validated). */
export interface ActivityFactBuildInput {
    readonly rootSessionId: RootSessionId;
    readonly globalSequence: number;
    readonly op: ActivityOp;
    readonly instanceId: string;
    readonly subject: string;
    readonly sequence: number;
    readonly progress: ProgressValue;
    readonly summary?: string;
    readonly lastAction?: string;
    readonly correlation?: string;
    readonly note?: string;
    readonly closeNote?: string;
    readonly requestToken: string;
    readonly reportedByInstanceId: string;
    readonly createdAt: string;
}
/**
 * Build the durable ledger entry for one activity fact (closed payload
 * shape — lossless JSON).
 *
 * @param input - the validated build input.
 * @returns the entry ready for `LedgerRepository.put`.
 */
export declare function buildActivityEntry(input: ActivityFactBuildInput): LedgerEntry;
//# sourceMappingURL=facts.d.ts.map