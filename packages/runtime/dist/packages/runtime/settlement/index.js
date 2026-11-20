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
export { ExecutionSettlementRefusal, SETTLEMENT_ENVELOPE_SCHEMA, SETTLEMENT_RECORD_SUFFIX, SETTLEMENT_REFUSAL_CODES, SETTLEMENT_SCHEMA, SETTLEMENT_STATES, SETTLEMENT_TEMP_SUFFIX, TERMINAL_SETTLEMENT_STATES, admissionDecision, admissionRequestIds, canonicalSettlementJson, createExecutionSettlementStore, settlementRecordPath, } from './execution-settlement.js';
/**
 * The UTE-1 `ExecutionSettlementWriter` contract adapter. Its header states the
 * read-compat boundary with `ControlService.recordExecutionResult` and the S2
 * non-claim; it imports no control code.
 */
export * from './writer-adapter.js';
//# sourceMappingURL=index.js.map