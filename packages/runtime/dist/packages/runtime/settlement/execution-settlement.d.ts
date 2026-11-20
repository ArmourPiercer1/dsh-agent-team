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
export type SettlementRefusalCode = 'DUPLICATE_SETTLEMENT' | 'SETTLEMENT_CONFLICT' | 'ILLEGAL_TRANSITION' | 'EFFECT_CLAIM_WITHOUT_OBSERVATION' | 'SETTLEMENT_CROSS_WIRED' | 'SETTLEMENT_ADMISSION_MISMATCH' | 'SETTLEMENT_ADMISSION_REFERENCE_INVALID' | 'SETTLEMENT_INPUT_INVALID' | 'SETTLEMENT_TIMESTAMP_REGRESSION' | 'UNCONFIRMED_WITHOUT_UNCERTAINTY' | 'STOP_EVIDENCE_MISSING' | 'ILLEGAL_STOP_TIMING' | 'SETTLEMENT_CORRUPT' | 'SETTLEMENT_WRITE_FAILED' | 'SETTLEMENT_NOT_FOUND' | 'SETTLEMENT_DIRECTORY_FSYNC_FAILED' | 'SETTLEMENT_WRITER_CONFLICT';
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
 * How the admission slot of a record was populated. It is NEVER a new decision:
 *
 * - `control-decision` (the default): an immutable reference to a decision the
 *   ControlService already made. `decision` is the recorded verdict, copied for
 *   coherence checks only.
 * - `control-request-reference`: the execution named one or more durable
 *   ControlRequest legs (`requestIds`), but this writer has no verdict to copy.
 *   The digest binds the reference list; no `decision` is claimed.
 * - `no-control-request`: the fact names no ControlRequest leg at all (a tool
 *   that never asks). The digest binds the subject execution; again no verdict.
 *
 * The two reference kinds exist so the Writer adapter can record a contract
 * `ExecutionFact` WITHOUT minting an allow/deny verdict it did not observe.
 * This module never creates, mutates or re-evaluates a decision.
 * `subjectExecutionId` is the execution the admission was issued FOR; it must
 * equal the settlement's ExecutionId or the write is `SETTLEMENT_CROSS_WIRED`.
 */
export type AdmissionKind = 'control-decision' | 'control-request-reference' | 'no-control-request';
export interface AdmissionReference {
    /** Absent = 'control-decision' (records written before this field existed). */
    readonly admissionKind?: AdmissionKind;
    readonly decisionId: string;
    readonly decisionDigest: string;
    /** Required for 'control-decision'; forbidden for the reference kinds. */
    readonly decision?: 'allow' | 'deny';
    readonly decisionKind: string;
    readonly subjectExecutionId: string;
    /** Required (non-empty) for 'control-request-reference'; absent otherwise. */
    readonly requestIds?: readonly string[];
    readonly decidedAt?: string;
}
/** How far the execution got. `DISPATCH_ENTERED` does not imply the body ran. */
export type DispatchPhase = 'not-started' | 'started' | 'quiesced' | 'termination-unconfirmed';
/** What the body did, independently of what the Host reported. */
export type BodyOutcome = 'not-started' | 'completed' | 'failed' | 'unknown';
/** What is actually known about physical effects. */
export type EffectEvidence = 'none-confirmed' | 'possible' | 'observed' | 'unknown';
/** Closed effect-kind vocabulary (S1 keeps it deliberately small). */
export type EffectKind = 'file-create' | 'file-delete' | 'file-content' | 'file-metadata' | 'process-spawn' | 'process-exit' | 'network-connect'
/** A fact-level declaration: the binding declared `observed` and the
 *  evidence id is the digest of the fact that declared it. Not a fabricated
 *  filesystem observation. */
 | 'binding-declared';
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
/**
 * The UTE-1 contract's `ExecutionFact` (see `docs/plans/memo/ute-g1-20261120/
 * CONTRACT.md` §3). Duplicated here as a structural type on purpose: this module
 * does not import the memo, and the Writer adapter must accept the shape
 * verbatim. `effectEvidence: 'observed'` is carried with a `binding-declared`
 * effect observation whose evidence id is the digest of the declaring fact.
 */
export type ContractDispatchState = 'not-started' | 'started' | 'quiesced' | 'termination-unconfirmed';
export type ContractBodyOutcome = 'completed' | 'failed' | 'unknown';
export type ContractEffectEvidence = 'none-confirmed' | 'possible' | 'observed' | 'unknown';
export interface ContractHostResult {
    readonly isError: boolean;
    readonly errorCode?: string;
}
export interface ContractRecovery {
    readonly reconciledFrom: string;
    readonly at: string;
    readonly detail: string;
}
export interface ContractExecutionFact {
    readonly executionId: string;
    readonly rootSessionId: string;
    readonly agentInstanceId: string;
    readonly hostCallId?: string;
    readonly parentExecutionId?: string;
    readonly controlRequestIds: readonly string[];
    readonly dispatch: ContractDispatchState;
    readonly bodyOutcome: ContractBodyOutcome;
    readonly effectEvidence: ContractEffectEvidence;
    readonly hostResult?: ContractHostResult;
    /** ISO-8601 UTC. */
    readonly recordedAt: string;
    readonly recovery?: ContractRecovery;
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
    /** Present when the Writer adapter created this record from a contract fact. */
    readonly contractFact?: ContractExecutionFact;
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
    /** Set by the Writer adapter; the store only freezes and cross-checks it. */
    readonly contractFact?: ContractExecutionFact;
}
/** Input to `enterRunning`. */
export interface EnterRunningInput {
    readonly executionId: string;
    readonly observation: ExecutionObservation;
    readonly at: string;
    /** When the record was opened from a contract fact, keep its snapshot current. */
    readonly contractFact?: ContractExecutionFact;
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
    /** The terminal contract fact this settlement publishes, when there is one. */
    readonly contractFact?: ContractExecutionFact;
}
/** One record reconciled by `recoverUnsettled`. */
export interface SettlementRecoveryResult {
    readonly executionId: string;
    readonly before: SettlementState;
    readonly after: SettlementState;
    readonly outcome: SettlementWriteResult['outcome'];
    readonly missingEvidence: readonly string[];
}
/**
 * Durability ports. Production calls the real implementation; a test may inject
 * a witness to observe the parent-directory fsync (and an injector that throws
 * exercises the named refusal).
 */
export interface SettlementDurability {
    readonly fsyncDirectory?: (dir: string) => void;
}
/** What the writer lock did when this store opened the root. */
export interface SettlementWriterLockInfo {
    readonly state: 'acquired' | 'reentrant' | 'reclaimed';
    readonly path: string;
    readonly pid: number;
    readonly bootId: string;
    readonly previousPid?: number;
    readonly previousBootId?: string;
}
/** Options for {@link createExecutionSettlementStore}. */
export interface ExecutionSettlementStoreOptions {
    /** Directory holding one `<executionId>.settlement.json` per execution. */
    readonly dir: string;
    readonly durability?: SettlementDurability;
}
/** The writer/reader surface. There is deliberately no decision method here. */
export interface ExecutionSettlementStore {
    readonly dir: string;
    readonly writerLock: SettlementWriterLockInfo;
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
/** The recorded verdict of an admission, or null for a reference-only admission. */
export declare function admissionDecision(admission: AdmissionReference): 'allow' | 'deny' | null;
/** The request ids an admission reference binds (empty for a decision). */
export declare function admissionRequestIds(admission: AdmissionReference): readonly string[];
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