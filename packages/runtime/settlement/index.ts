/**
 * Public entry point for the Execution Settlement S1 module.
 *
 * NOT WIRED INTO ANY PRODUCTION PATH. Nothing imports this module today; it is
 * exported (`@dsh-agent-team/runtime/settlement`) so an adapter can be added as
 * a separate, reviewed change. The module itself records facts and never makes
 * an approval/Grant/Stop decision — see `execution-settlement.ts`.
 *
 * @module @dsh-agent-team/runtime/settlement
 */
export {
  ExecutionSettlementRefusal,
  SETTLEMENT_ENVELOPE_SCHEMA,
  SETTLEMENT_RECORD_SUFFIX,
  SETTLEMENT_REFUSAL_CODES,
  SETTLEMENT_SCHEMA,
  SETTLEMENT_STATES,
  SETTLEMENT_TEMP_SUFFIX,
  TERMINAL_SETTLEMENT_STATES,
  admissionDecision,
  admissionRequestIds,
  canonicalSettlementJson,
  createExecutionSettlementStore,
  settlementRecordPath,
} from './execution-settlement.js'
export type {
  AdmissionKind,
  AdmissionReference,
  BodyOutcome,
  DispatchPhase,
  EffectEvidence,
  EffectKind,
  EffectObservation,
  ContractBodyOutcome,
  ContractDispatchState,
  ContractEffectEvidence,
  ContractExecutionFact,
  ContractHostResult,
  ContractRecovery,
  EnterRunningInput,
  ExecutionObservation,
  ExecutionSettlementRecord,
  ExecutionSettlementStore,
  ExecutionSettlementStoreOptions,
  RecordAdmissionInput,
  RecordRecheckDecisionInput,
  RecordStopInput,
  RecheckDecisionReference,
  SettleInput,
  SettlementIdentity,
  SettlementRecoveryResult,
  SettlementDurability,
  SettlementRefusalCode,
  SettlementState,
  SettlementTransition,
  SettlementWriteResult,
  SettlementWriterLockInfo,
  StopPhase,
  StopRecord,
} from './execution-settlement.js'
/**
 * The UTE-1 `ExecutionSettlementWriter` contract adapter. Its header states the
 * read-compat boundary with `ControlService.recordExecutionResult` and the S2
 * non-claim; it imports no control code.
 */
export * from './writer-adapter.js'
/**
 * UTE-3 S1 dispatch wiring: the tool-definition wrapper that records a durable
 * admission BEFORE the body runs and settles the real observed outcome. It is
 * NOT mounted or imported by any production path; a caller constructs it with
 * an explicit store (see `dispatch-settlement.ts`).
 */
export * from './dispatch-settlement.js'
