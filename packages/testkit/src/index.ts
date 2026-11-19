/**
 * @dsh-agent-team/testkit — shared test infrastructure.
 *
 * Responsibility (TaskDoc §11 package boundary): fixtures and helpers the
 * other packages' tests share — fault-injection / restart fixtures, golden
 * fixtures, shared assertions. Testkit is consumed by tests only; no
 * production package may depend on it.
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker only; the real fixtures land in the P4-T5 testkit work.
 * @module @dsh-agent-team/testkit
 */

/**
 * Stable identity marker of the testkit package.
 *
 * Placeholder until the P4-T5 testkit work replaces it; its value is
 * asserted by the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'testkit'

// TINF M2 (2026-11-14): deterministic model input, independent effect
// observation, and the contract oracle that grades one against the other.
// These are test-only instruments; no production package may depend on them.
export {
  AGENT_SCRIPT_SCHEMA,
  ScriptedModelAdapter,
  ScriptedModelError,
  assertComplete,
  createScriptedModel,
  validateAgentScript,
} from './scripted-model.js'
export type {
  AgentScript,
  AgentScriptRequestExpectation,
  AgentScriptResponse,
  AgentScriptTurn,
  ScriptedModelErrorCode,
} from './scripted-model.js'

// M7-A (2026-11-15): the same script at the real host's model WIRE boundary
// (one in-process adapter cannot reach a `dsh web` child), plus the shared
// schema/matching law both transports use. Dependency-free on purpose: the
// real-host harness imports these modules under plain `node`.
export { matchAgentScriptRequest } from './agent-script.js'
export type { AgentScriptRequestFacts } from './agent-script.js'
export { createWireScriptDriver, wireSerializedMessages, wireToolNames } from './wire-script.js'
export type { WireModelRequest, WireScriptConsumption, WireScriptDriver, WireScriptReply } from './wire-script.js'

export {
  FS_OBSERVABLE_EFFECTS,
  FS_UNOBSERVABLE_EFFECTS,
  areSealedWitnessObservations,
  createBlindWitness,
  createFsWitness,
  isSealedWitnessObservation,
} from './effect-witness.js'
export type { EffectDomain, EffectKind, EffectWitness, WitnessObservation } from './effect-witness.js'

export { CONTRACT_SCHEMA, judgeContract } from './contract-oracle.js'
export type { OracleInput, OracleJudgement, OracleReasonCode, OracleVerdict, TraceEvent } from './contract-oracle.js'
