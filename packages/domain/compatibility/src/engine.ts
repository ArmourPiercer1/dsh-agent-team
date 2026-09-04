/**
 * The compatibility engine (pure, deterministic, side-effect-free).
 *
 * Evaluates typed requirements against environment facts and produces the
 * stable typed {@link CompatibilityResult}. It classifies —it NEVER starts,
 * admits, or cancels any work (TaskDoc §11.4 P3-T5 acceptance: "不启动work").
 *
 * Classification semantics (Architecture §27.2, T5 rulings):
 *
 * - every required subject available => `PASS`
 * - some subject unavailable and the requirement is ordinary
 *   (tool / skill / mcpServer / modelRoute) => `WARNING`
 *   (ordinary capability mismatch, ack-able via "Continue Anyway")
 * - some subject unavailable and the requirement is structural
 *   (`teamStructure`, `persona`) => `FATAL`
 *   (structural Team contract cannot hold)
 * - `complete:true` unmet => `FATAL` **mandatory, no downgrade, no ack**
 *   (Architecture §13.5; for `persona` the engine reports the frozen
 *   contracts-v1 code `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`)
 *
 * Acknowledgements (Architecture §27.3) bind to the specific mismatch +
 * environment generation: a WARNING is satisfied only by an ack whose
 * requirementId, mismatch fingerprint, AND environment fingerprint all match
 * the re-derived values of this evaluation. Drift (any fingerprint change)
 * makes earlier results and their acks stale —see
 * {@link isCompatibilityResultValidForEnvironment}.
 *
 * Authority: Architecture §7.4, §13.5, §14.3 E, §19.1, §27, §28;
 * Development Plan §16.2 Compatibility, §20.1; TaskDoc §11.4 P3-T5.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/engine
 */

import { deepFreeze } from '../../../contracts/src/index.js'
import {
  parseRequirements,
} from './requirement.js'
import type { Requirement } from './requirement.js'
import type { RequirementInput } from './requirement.js'
import {
  parseEnvironmentFacts,
  computeEnvironmentFingerprint,
} from './environment-facts.js'
import type { EnvironmentFact } from './environment-facts.js'
import { parseWarningAcknowledgements } from './acknowledgement.js'
import type { WarningAcknowledgement } from './acknowledgement.js'
import { computeFingerprint, NO_PROBE_GENERATION } from './fingerprint.js'
import type {
  CompatibilityResult,
  CompatibilityResultCounts,
  CompatibilityStatus,
  CompatibilityReasonCode,
  RequirementOutcome,
  RequirementResult,
  WarningAcknowledgementRef,
} from './result.js'
import { COMPATIBILITY_STATUS, COMPATIBILITY_REASON_CODES, TEAM_CONTRACT_SCHEMA_VERSION } from './result.js'

/** The raw input of one compatibility evaluation (all three re-validated). */
export interface CompatibilityEvaluationInput {
  readonly requirements: readonly RequirementInput[]
  readonly environmentFacts: readonly EnvironmentFact[]
  readonly acknowledgements?: readonly WarningAcknowledgement[]
}

/**
 * Evaluate typed requirements against environment facts and produce the
 * stable typed compatibility result.
 *
 * Pure: the same input always yields a byte-identical canonical
 * serialization; inputs are never mutated; nothing is started, admitted, or
 * cancelled.
 *
 * @param input - requirements + environment facts (+ optional acks).
 * @returns the deep-frozen, canonical-JSON-serializable result.
 * @throws `MALFORMED_DTO` when any input value fails validation (including
 *   an unknown requirement type —fail loud, typed).
 */
export function evaluateCompatibility(input: CompatibilityEvaluationInput): CompatibilityResult {
  const requirements = parseRequirements(input.requirements)
  const facts = parseEnvironmentFacts(input.environmentFacts)
  const acknowledgements = parseWarningAcknowledgements(input.acknowledgements ?? [])

  const environmentFingerprint = computeEnvironmentFingerprint(requirements, facts)

  // Index facts by (domain, subject) for O(1) probe lookup.
  const factByKey = new Map<string, EnvironmentFact>()
  for (const fact of facts) {
    factByKey.set(`${fact.domain}\u0000${fact.subject}`, fact)
  }

  const results: RequirementResult[] = []
  const consumedAcks = new Set<WarningAcknowledgement>()
  let passCount = 0
  let warningCount = 0
  let fatalCount = 0
  let unackedWarningCount = 0
  let staleAcknowledgementCount = 0

  for (const requirement of requirements) {
    // Per-subject probe state, sorted by subject for a stable mismatch identity.
    const probes = requirement.subjects
      .map((subject) => {
        const fact = factByKey.get(`${requirement.type}\u0000${subject}`)
        return {
          subject,
          available: fact === undefined ? false : fact.available,
          generation: fact === undefined ? NO_PROBE_GENERATION : fact.generation,
        }
      })
      .sort((a, b) => (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0))
    const unavailableSubjects = probes
      .filter((probe) => !probe.available)
      .map((probe) => probe.subject)

    if (unavailableSubjects.length === 0) {
      passCount += 1
      results.push(
        deepFreeze({
          requirementId: requirement.requirementId,
          type: requirement.type,
          complete: requirement.complete,
          outcome: 'PASS' as RequirementOutcome,
          reasonCode: COMPATIBILITY_REASON_CODES.SATISFIED,
          detail: `all ${requirement.subjects.length} required subject(s) available`,
          unavailableSubjects: [] as readonly string[],
          mismatchFingerprint: null,
          acknowledgement: null,
        }),
      )
      continue
    }

    const mismatchFingerprint = computeFingerprint({
      requirementId: requirement.requirementId,
      type: requirement.type,
      probes,
    })

    // Outcome + reason: complete:true dominates; then structural types; then
    // ordinary capability mismatch (Architecture §27.2, §13.5).
    let outcome: RequirementOutcome
    let reasonCode: CompatibilityReasonCode
    let detail: string
    if (requirement.complete) {
      outcome = 'FATAL'
      reasonCode =
        requirement.type === 'persona'
          ? COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT
          : COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET
      detail =
        requirement.type === 'persona'
          ? `complete:true persona requirement unmet: ${unavailableSubjects.join(', ')} (structural FATAL, not downgradeable)`
          : `complete:true requirement unmet: ${unavailableSubjects.join(', ')} (structural FATAL, not downgradeable)`
    } else if (requirement.type === 'teamStructure') {
      outcome = 'FATAL'
      reasonCode = COMPATIBILITY_REASON_CODES.STRUCTURAL_CAPABILITY_MISSING
      detail = `structural team capability missing: ${unavailableSubjects.join(', ')}`
    } else if (requirement.type === 'persona') {
      outcome = 'FATAL'
      reasonCode = COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE
      detail = `persona/runtime-context cannot be composed safely for: ${unavailableSubjects.join(', ')}`
    } else {
      outcome = 'WARNING'
      reasonCode = COMPATIBILITY_REASON_CODES.CAPABILITY_UNAVAILABLE
      detail = `ordinary capability unavailable: ${unavailableSubjects.join(', ')}`
    }

    let acknowledgement: WarningAcknowledgementRef | null = null
    if (outcome === 'WARNING') {
      warningCount += 1
      // Ack applicability precedence (§27.3, T5 ruling):
      //   1. VALID   - the ack binds to exactly this mismatch fingerprint in
      //                exactly this environment fingerprint.
      //   2. STALE   - the ack targets this requirement but binds to an
      //                environment that has since drifted; the environment
      //                generation binding is broken, so a fresh ack is
      //                required. Precedes MISSING: env drift is the
      //                actionable diagnosis.
      //   3. MISSING - no ack applies to this current mismatch.
      let validAck: WarningAcknowledgement | null = null
      let staleAck: WarningAcknowledgement | null = null
      for (const ack of acknowledgements) {
        if (consumedAcks.has(ack)) continue
        if (ack.requirementId !== requirement.requirementId) continue
        if (
          ack.environmentFingerprint === environmentFingerprint &&
          ack.mismatchFingerprint === mismatchFingerprint
        ) {
          validAck = ack
          break
        }
        if (staleAck === null && ack.environmentFingerprint !== environmentFingerprint) {
          staleAck = ack
        }
      }
      let state: WarningAcknowledgementRef
      if (validAck !== null) {
        consumedAcks.add(validAck)
        state = { status: 'VALID', acknowledgement: validAck }
      } else if (staleAck !== null) {
        consumedAcks.add(staleAck)
        state = { status: 'STALE', acknowledgement: staleAck }
      } else {
        state = { status: 'MISSING', acknowledgement: null }
      }
      if (state.status === 'STALE') staleAcknowledgementCount += 1
      if (state.status !== 'VALID') unackedWarningCount += 1
      acknowledgement = deepFreeze(state)
    } else {
      fatalCount += 1
      // FATAL is never ack-able (§27.2): acks targeting it are unapplied.
    }

    results.push(
      deepFreeze({
        requirementId: requirement.requirementId,
        type: requirement.type,
        complete: requirement.complete,
        outcome,
        reasonCode,
        detail,
        unavailableSubjects: deepFreeze([...unavailableSubjects] as string[]),
        mismatchFingerprint,
        acknowledgement,
      }),
    )
  }

  const status: CompatibilityStatus =
    fatalCount > 0
      ? COMPATIBILITY_STATUS.BLOCKED_FATAL
      : warningCount > 0
        ? unackedWarningCount === 0
          ? COMPATIBILITY_STATUS.DEGRADED_ACKNOWLEDGED
          : COMPATIBILITY_STATUS.BLOCKED_WARNING
        : COMPATIBILITY_STATUS.OPEN

  const counts: CompatibilityResultCounts = {
    pass: passCount,
    warning: warningCount,
    fatal: fatalCount,
    unackedWarning: unackedWarningCount,
    staleAcknowledgement: staleAcknowledgementCount,
  }

  const unappliedAcknowledgements = acknowledgements.filter((ack) => !consumedAcks.has(ack))

  return deepFreeze({
    schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
    environmentFingerprint,
    status,
    requirements: deepFreeze(results),
    counts,
    unappliedAcknowledgements: deepFreeze(unappliedAcknowledgements),
  })
}

/**
 * Drift check: is a previously stored compatibility result still valid for
 * the current (requirements, environment facts)?
 *
 * The result is bound to the fingerprint of the relevant environment facts
 * it was computed from (T5 ruling: "any drift (different fingerprint)
 * invalidates the previous result"; Architecture §14.3 E staleness/generation,
 * Development Plan §20.1 re-probe triggers). When the fingerprint differs — * availability flip, generation bump, new/removed relevant probe, or changed
 * requirements —the previous result and every ack bound to it are stale.
 *
 * @param result - the previous result.
 * @param requirements - the current requirements (raw; re-validated).
 * @param environmentFacts - the current environment facts (raw; re-validated).
 * @returns `true` iff the current relevant-facts fingerprint equals the
 *   fingerprint the result was bound to.
 */
export function isCompatibilityResultValidForEnvironment(
  result: CompatibilityResult,
  requirements: readonly Requirement[],
  environmentFacts: readonly EnvironmentFact[],
): boolean {
  return computeEnvironmentFingerprint(requirements, environmentFacts) === result.environmentFingerprint
}
