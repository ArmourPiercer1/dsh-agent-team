/** Schema tag of the persisted settlement record. */
export declare const SETTLEMENT_SCHEMA: "execution-settlement/1";
/** Schema tag of the checksummed on-disk envelope. */
export declare const SETTLEMENT_ENVELOPE_SCHEMA: "execution-settlement-envelope/1";
/** Filename suffix of one canonical settlement record. */
export declare const SETTLEMENT_RECORD_SUFFIX: ".settlement.json";
/** Filename suffix of an in-progress (never readable) write. */
export declare const SETTLEMENT_TEMP_SUFFIX: ".tmp";
/** The closed state vocabulary. */
export type SettlementState = 'ADMITTED' | 'RUNNING' | 'COMPLETED' | 'REFUSED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';
/** Every state, in state-machine order. */
export declare const SETTLEMENT_STATES: readonly SettlementState[];
/** The states from which no transition exists. */
export declare const TERMINAL_SETTLEMENT_STATES: readonly SettlementState[];
/** The closed set of named refusals this module can produce. */
export type SettlementRefusalCode = 'DUPLICATE_SETTLEMENT' | 'SETTLEMENT_CONFLICT' | 'ILLEGAL_TRANSITION' | 'EFFECT_CLAIM_WITHOUT_OBSERVATION' | 'SETTLEMENT_CROSS_WIRED' | 'SETTLEMENT_ADMISSION_MISMATCH' | 'SETTLEMENT_ADMISSION_REFERENCE_INVALID' | 'SETTLEMENT_INPUT_INVALID' | 'SETTLEMENT_TIMESTAMP_REGRESSION' | 'UNCONFIRMED_WITHOUT_UNCERTAINTY' | 'STOP_EVIDENCE_MISSING' | 'ILLEGAL_STOP_TIMING' | 'SETTLEMENT_CORRUPT' | 'SETTLEMENT_WRITE_FAILED' | 'SETTLEMENT_NOT_FOUND';
/** Every refusal code, so a caller/test can enumerate the closed vocabulary. */
export declare const SETTLEMENT_REFUSAL_CODES: readonly SettlementRefusalCode[];
/**
 * The ONE error type this module throws. `code` is always one of
 * {@link SETTLEMENT_REFUSAL_CODES}; `details` is structured, never prose-only.
 */
export declare class ExecutionSettlementRefusal extends Error {
    readonly code: SettlementRefusalCode;
    readonly details: Readonly<Record<string, unknown>>;
    constructor(code: SettlementRefusalCode, detail: string, details?: Record<string, unknown>);
}
/** Identity of one physical execution attempt. */
export interface SettlementIdentity {
    readonly executionId: string;
    readonly toolName: string;
    readonly actorId: string;
    readonly worldId: string;
}
/**
 * An IMMUTABLE reference to a decision the ControlService already made.
 *
 * `decisionId` + `decisionDigest` are the reference; `decision` is the recorded
 * verdict copied for coherence checks only. This module never creates, mutates
 * or re-evaluates one. `subjectExecutionId` is the execution the decision was
 * issued FOR; it must equal the settlement's ExecutionId or the write is
 * `SETTLEMENT_CROSS_WIRED`.
 */
export interface AdmissionReference {
    readonly decisionId: string;
    readonly decisionDigest: string;
    readonly decision: 'allow' | 'deny';
    readonly decisionKind: string;
    readonly subjectExecutionId: string;
    readonly decidedAt?: string;
}
/** How far the execution got. `DISPATCH_ENTERED` does not imply the body ran. */
export type DispatchPhase = 'not-started' | 'started' | 'quiesced' | 'termination-unconfirmed';
/** What the body did, independently of what the Host reported. */
export type BodyOutcome = 'not-started' | 'completed' | 'failed' | 'unknown';
/** What is actually known about physical effects. */
export type EffectEvidence = 'none-confirmed' | 'possible' | 'observed' | 'unknown';
/** Closed effect-kind vocabulary (S1 keeps it deliberately small). */
export type EffectKind = 'file-create' | 'file-delete' | 'file-content' | 'file-metadata' | 'process-spawn' | 'process-exit' | 'network-connect';
/** One observed effect, always tied to the instrument that saw it. */
export interface EffectObservation {
    readonly kind: EffectKind;
    readonly target: string;
    readonly evidenceId: string;
}
/** The three independent axes plus the observed effect list. */
export interface ExecutionObservation {
    readonly executionId: string;
    readonly dispatch: DispatchPhase;
    readonly bodyOutcome: BodyOutcome;
    readonly effectEvidence: EffectEvidence;
    readonly observedEffects: readonly EffectObservation[];
}
/** When a Stop arrived relative to the effect. */
export type StopPhase = 'pre-dispatch' | 'in-flight' | 'post-completion';
/** One recorded Stop event (additive; never rewrites an outcome). */
export interface StopRecord {
    readonly stopId: string;
    readonly at: string;
    readonly phase: StopPhase;
}
/** One entry of the monotonic transition log. */
export interface SettlementTransition {
    readonly seq: number;
    readonly from: SettlementState | null;
    readonly to: SettlementState;
    readonly at: string;
    readonly reason: string | null;
    readonly missingEvidence: readonly string[];
    /** sha256 of the canonical request facts that produced this transition. */
    readonly factsDigest: string;
}
/** The canonical record. The file on disk is exactly this payload. */
export interface ExecutionSettlementRecord {
    readonly schema: typeof SETTLEMENT_SCHEMA;
    readonly identity: SettlementIdentity;
    readonly admission: AdmissionReference;
    readonly state: SettlementState;
    readonly observation: ExecutionObservation;
    readonly transitions: readonly SettlementTransition[];
    readonly stops: readonly StopRecord[];
    readonly terminalReason: string | null;
    readonly missingEvidence: readonly string[];
    readonly createdAt: string;
    readonly updatedAt: string;
}
/** What a successful (or idempotent) write did. */
export interface SettlementWriteResult {
    readonly record: ExecutionSettlementRecord;
    readonly outcome: 'created' | 'transitioned' | 'recorded' | 'duplicate';
    /** `DUPLICATE_SETTLEMENT` exactly when `outcome === 'duplicate'`. */
    readonly code: 'DUPLICATE_SETTLEMENT' | null;
}
/** Input to `recordAdmission`. */
export interface RecordAdmissionInput {
    readonly identity: SettlementIdentity;
    readonly admission: AdmissionReference;
    readonly at: string;
    readonly reason?: string;
}
/** Input to `enterRunning`. */
export interface EnterRunningInput {
    readonly executionId: string;
    readonly observation: ExecutionObservation;
    readonly at: string;
}
/** Input to `recordStop`. */
export interface RecordStopInput {
    readonly executionId: string;
    readonly stopId: string;
    readonly at: string;
    readonly phase: StopPhase;
}
/** Input to `settle`. */
export interface SettleInput {
    readonly executionId: string;
    readonly state: SettlementState;
    readonly observation: ExecutionObservation;
    readonly at: string;
    readonly reason: string;
    readonly missingEvidence?: readonly string[];
}
/** One record reconciled by `recoverUnsettled`. */
export interface SettlementRecoveryResult {
    readonly executionId: string;
    readonly before: SettlementState;
    readonly after: SettlementState;
    readonly outcome: SettlementWriteResult['outcome'];
    readonly missingEvidence: readonly string[];
}
/** Options for {@link createExecutionSettlementStore}. */
export interface ExecutionSettlementStoreOptions {
    /** Directory holding one `<executionId>.settlement.json` per execution. */
    readonly dir: string;
}
/** The writer/reader surface. There is deliberately no decision method here. */
export interface ExecutionSettlementStore {
    readonly dir: string;
    recordAdmission(input: RecordAdmissionInput): SettlementWriteResult;
    enterRunning(input: EnterRunningInput): SettlementWriteResult;
    recordStop(input: RecordStopInput): SettlementWriteResult;
    settle(input: SettleInput): SettlementWriteResult;
    recoverUnsettled(at: string): readonly SettlementRecoveryResult[];
    read(executionId: string): ExecutionSettlementRecord | null;
    list(): readonly ExecutionSettlementRecord[];
}
/**
 * Deterministic JSON: object keys sorted, `undefined` rendered as `null` (the
 * persisted records never rely on key order). Used for the envelope checksum and
 * for the per-transition facts digest.
 */
export declare function canonicalSettlementJson(value: unknown): string;
/** The canonical file path of one execution's settlement record. */
export declare function settlementRecordPath(dir: string, executionId: string): string;
/**
 * Open (or create) the settlement store rooted at `options.dir`.
 *
 * INVARIANT (repeated here because it is the reason the constructor takes only a
 * directory): there is no option that injects a policy, resolver, grant table or
 * ControlService. The store cannot make an admission decision, because it has
 * nothing to make one with.
 */
export declare function createExecutionSettlementStore(options: ExecutionSettlementStoreOptions): ExecutionSettlementStore;
//# sourceMappingURL=execution-settlement.d.ts.map