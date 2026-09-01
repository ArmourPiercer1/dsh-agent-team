/**
 * P8-S4A — the SINGLE compatibility admission authority.
 *
 * Every NEW WORK admission entry point (follow-up, delegate-continue,
 * delegate-create, explicit-create) consults ONE authority of this module
 * at admission. The authority owns, in one exact chain:
 *
 *   1. READ current environment facts (a fresh facts-port read — never a
 *      cached value; a failing read is a chain failure, not an admission);
 *   2. FINGERPRINT the bound blueprint's requirements against those facts
 *      (the P3 engine's `computeEnvironmentFingerprint` — the same value
 *      the probe binds its durable state to);
 *   3. ENSURE FRESHNESS of the durable compatibility generation: a MISSING
 *      or STALE row (fingerprint mismatch against the live environment) is
 *      NEVER trusted — it is re-probed inline under the frozen trigger
 *      `STALE_GENERATION_BEFORE_NEW_WORK` (DevPlan §20.1 trigger 5, which
 *      also covers the first-ever evaluation); a failed re-probe is a chain
 *      failure (fail-closed: new work is never admitted on an
 *      unverifiable generation);
 *   4. read the (now fresh) DURABLE state;
 *   5. VALIDATE ACKS: re-derive the engine result against the fresh facts
 *      carrying the durable acknowledgements plus any request-carried
 *      acknowledgements — the engine re-classifies every ack VALID / STALE
 *      / MISSING against the CURRENT mismatch + environment fingerprint
 *      pair (Architecture §27.3); a request-carried ack is a transient
 *      pass-through for this attempt ONLY (it is never persisted — durable
 *      acknowledgements are written exclusively by `acknowledge`);
 *   6. return EXACTLY ONE admission result per attempt:
 *      - `admit`  — OPEN or DEGRADED_ACKNOWLEDGED (all warnings validly
 *        acknowledged);
 *      - `block`  — BLOCKED_WARNING (an unacknowledged/stale warning) or
 *        BLOCKED_FATAL (FATAL is never ack-able, §27.2), with the
 *        blocking requirement summaries;
 *      - `reprobe` — the chain itself could not produce a verdict
 *        (facts-unavailable / reprobe-failed / no-state-after-reprobe /
 *        state-mismatch); the consumer MUST fail closed.
 *
 * This is the P8-S4A convergence of the two former authorities (the P6-T2
 * gate's "trust the durable row / else live-evaluate" check and the
 * ActivationProvider's step-6 live re-evaluation): both are replaced by a
 * consult of this authority, so all entry points agree on one result for
 * one state (G8 audit Issue B, closure plan §17).
 *
 * The authority WRAPS one P7-T1 {@link CompatibilityProber} (same deps,
 * same generation line, same in-flight ledger): the inline freshness
 * re-probe is exactly the prober's frozen probe (fresh facts read, engine
 * evaluation carrying the durable acks, durable replace at generation + 1,
 * drift classification, `onProbe` observation). The settle path is
 * untouched by this module (§28.2: drift never cancels in-flight work).
 *
 * I/O only through the injected TeamDomain repositories and the
 * environment-facts port; no node: builtins, no upstream imports.
 * @module @dsh-agent-team/runtime/compatibility/authority
 */

import {
  computeEnvironmentFingerprint,
  evaluateCompatibility,
  parseRequirements,
} from '../../domain/compatibility/src/index.js'
import type {
  CompatibilityStatus,
  EnvironmentFact,
  Requirement,
  WarningAcknowledgement,
} from '../../domain/compatibility/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import { compatibilityRequirementsOf } from './blueprint.js'
import { createCompatibilityProber } from './probe.js'
import type {
  AcknowledgeInput,
  CompatibilityProber,
  CompatibilityVerdict,
  NewWorkDecision,
  ProbeOutcome,
  ProbeTrigger,
  SettleRecord,
} from './types.js'
import { PROBE_TRIGGERS } from './types.js'

/** The dependencies of one compatibility admission authority (all injected). */
export interface CompatibilityAuthorityOptions {
  /** The TeamDomain repositories (the durable `compatibility` store). */
  readonly repositories: TeamDomainRepositories
  /** The root session id the authority owns (one generation line per team). */
  readonly rootSessionId: string
  /** The bound blueprint (immutable durable snapshot). */
  readonly blueprint: TeamBlueprint
  /**
   * The environment-facts port: a FRESH read of the current probe verdicts
   * on every chain step (the authority never caches facts across attempts).
   */
  readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>
  /** The deterministic clock (ISO-8601); defaults to the prober default. */
  readonly now?: () => string
  /** Optional probe observation hook (test/UI channel, pass-through). */
  readonly onProbe?: (outcome: ProbeOutcome) => void
}

/** One blocking requirement summary (plain JSON, closed shape). */
export interface BlockingRequirementSummary {
  /** The requirement id of the blocking outcome. */
  readonly requirementId: string
  /** The requirement outcome (`WARNING` or `FATAL` for blocking rows). */
  readonly outcome: string
  /** The engine reason code of the outcome. */
  readonly reasonCode: string
  /** The engine's deterministic explanation (no timestamps). */
  readonly detail: string
  /**
   * The acknowledgement applicability for this requirement: `ABSENT` when
   * no acknowledgement targets it, otherwise the engine's re-classification
   * (`VALID` / `STALE` / `MISSING`) against the current fingerprint pair.
   */
  readonly acknowledgementStatus: string
}

/** The `admit` result: the fresh durable state admits NEW WORK. */
export interface CompatibilityAdmit {
  readonly decision: 'admit'
  /** The logical admission state (OPEN or DEGRADED_ACKNOWLEDGED). */
  readonly status: CompatibilityStatus
  /** The environment fingerprint of the fresh durable state. */
  readonly fingerprint: string
  /** The compatibility generation the admission was made under. */
  readonly generation: number
  /** Whether THIS attempt re-probed to ensure freshness. */
  readonly reprobed: boolean
}

/** The `block` result: the fresh durable state blocks NEW WORK. */
export interface CompatibilityBlock {
  readonly decision: 'block'
  /** The logical admission state (BLOCKED_WARNING or BLOCKED_FATAL). */
  readonly status: CompatibilityStatus
  /** The environment fingerprint of the fresh durable state. */
  readonly fingerprint: string
  /** The compatibility generation the decision was made under. */
  readonly generation: number
  /** Whether THIS attempt re-probed to ensure freshness. */
  readonly reprobed: boolean
  /** The blocking requirement summaries (every unacked warning + every FATAL). */
  readonly blockingRequirements: readonly BlockingRequirementSummary[]
}

/** The closed re-probe failure reasons (the chain could not produce a verdict). */
export const REPROBE_REASONS = {
  /** The environment-facts port failed (the original fault is carried). */
  FACTS_UNAVAILABLE: 'facts-unavailable',
  /** The inline freshness re-probe failed (the original fault is carried). */
  REPROBE_FAILED: 'reprobe-failed',
  /** The re-probe completed but left no durable state (state anomaly). */
  NO_STATE_AFTER_REPROBE: 'no-state-after-reprobe',
  /** The fresh durable state contradicts the engine re-derivation. */
  STATE_MISMATCH: 'state-mismatch',
} as const

/** One re-probe failure reason. */
export type ReprobeReason = (typeof REPROBE_REASONS)[keyof typeof REPROBE_REASONS]

/** The `reprobe` result: the chain failed — the consumer MUST fail closed. */
export interface CompatibilityReprobe {
  readonly decision: 'reprobe'
  /** Why the chain could not complete (closed vocabulary). */
  readonly reprobeReason: ReprobeReason
  /** The live environment fingerprint when it was computed. */
  readonly fingerprint?: string
  /** The original downstream fault (facts-unavailable / reprobe-failed). */
  readonly cause?: Error
}

/** The EXACT ONE admission result of one attempt (closed union). */
export type CompatibilityAdmissionDecision =
  | CompatibilityAdmit
  | CompatibilityBlock
  | CompatibilityReprobe

/** The options of one admission attempt. */
export interface CompatibilityAuthorityAdmitOptions {
  /**
   * Request-carried WARNING acknowledgements (transient pass-through:
   * classified against the CURRENT fingerprint pair for THIS attempt only;
   * never persisted — durable acks are written by `acknowledge`).
   */
  readonly acknowledgements?: readonly WarningAcknowledgement[]
}

/** The single compatibility admission authority for one TeamSession. */
export interface CompatibilityAuthority {
  /** The root session id the authority owns. */
  readonly rootSessionId: string
  /**
   * The exact admission chain (facts → fingerprint → freshness → durable
   * state → ACK validity → one result). See the module docs.
   */
  admit(options?: CompatibilityAuthorityAdmitOptions): Promise<CompatibilityAdmissionDecision>
  /** Run one explicit re-probe under a frozen trigger (durable replace). */
  reprobe(trigger: ProbeTrigger): Promise<ProbeOutcome>
  /** Read the current durable compatibility state (or `undefined`). */
  current(): Promise<CompatibilityStateRecord | undefined>
  /** Acknowledge one WARNING (durable, bound to the current generation). */
  acknowledge(input: AcknowledgeInput): Promise<CompatibilityVerdict>
  /** Register one admitted in-flight work (§28.2 in-flight ledger). */
  admitNewWork(workKey: string): Promise<NewWorkDecision>
  /** Settle one admitted in-flight work (never consults the state, §28.2). */
  settleWork(workId: string): Promise<SettleRecord>
  /** The underlying P7-T1 prober (the shared generation line + ledger). */
  readonly prober: CompatibilityProber
}

/**
 * Create one compatibility admission authority over one TeamSession's
 * compatibility generation line.
 *
 * @param options - the injected repositories / blueprint / facts port.
 * @returns the authority (one per call; entry points build one per
 *   consultation and rely on the durable store + storage write chain for
 *   cross-instance consistency).
 */
export function createCompatibilityAuthority(
  options: CompatibilityAuthorityOptions,
): CompatibilityAuthority {
  const rootSessionId = options.rootSessionId
  const requirements = (): readonly Requirement[] =>
    parseRequirements(compatibilityRequirementsOf(options.blueprint))

  const prober = createCompatibilityProber({
    repositories: options.repositories,
    rootSessionId,
    blueprint: options.blueprint,
    environmentFacts: options.environmentFacts,
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.onProbe !== undefined ? { onProbe: options.onProbe } : {}),
  })

  async function admit(
    admitOptions?: CompatibilityAuthorityAdmitOptions,
  ): Promise<CompatibilityAdmissionDecision> {
    // 1. READ current environment facts (fresh; a failure is a chain
    //    failure — never an admission).
    let facts: readonly EnvironmentFact[]
    try {
      facts = await options.environmentFacts()
    } catch (error) {
      return {
        decision: 'reprobe',
        reprobeReason: REPROBE_REASONS.FACTS_UNAVAILABLE,
        cause: error instanceof Error ? error : undefined,
      }
    }
    // 2. FINGERPRINT (the same value the probe binds its state to).
    const liveFingerprint = computeEnvironmentFingerprint(requirements(), facts)
    // 3. ENSURE FRESHNESS: a missing or stale durable generation is never
    //    trusted — re-probe inline (the frozen trigger 5, which also covers
    //    the first-ever evaluation).
    let state = options.repositories.compatibility.get(rootSessionId)
    let reprobed = false
    if (state === undefined || state.fingerprint !== liveFingerprint) {
      try {
        await prober.probe(PROBE_TRIGGERS.STALE_GENERATION_BEFORE_NEW_WORK)
        reprobed = true
      } catch (error) {
        return {
          decision: 'reprobe',
          reprobeReason: REPROBE_REASONS.REPROBE_FAILED,
          fingerprint: liveFingerprint,
          cause: error instanceof Error ? error : undefined,
        }
      }
      state = options.repositories.compatibility.get(rootSessionId)
      if (state === undefined) {
        return {
          decision: 'reprobe',
          reprobeReason: REPROBE_REASONS.NO_STATE_AFTER_REPROBE,
          fingerprint: liveFingerprint,
        }
      }
    }
    // 4/5. DURABLE state + ACK validity: re-derive the engine result
    //    against the fresh facts carrying the durable acks plus any
    //    request-carried acks (transient; the durable record is unchanged).
    const requestAcks = admitOptions?.acknowledgements ?? []
    const result = evaluateCompatibility({
      requirements: requirements(),
      environmentFacts: facts,
      acknowledgements:
        requestAcks.length > 0
          ? [...state.acknowledgements, ...requestAcks]
          : [...state.acknowledgements],
    })
    // Defensive consistency: with no request-carried acks the
    // re-derivation MUST match the fresh recorded state (deterministic
    // engine, identical inputs); a divergence is a state anomaly — fail
    // closed on a re-probe verdict, never admit on the mismatch.
    if (requestAcks.length === 0 && result.status !== state.status) {
      return {
        decision: 'reprobe',
        reprobeReason: REPROBE_REASONS.STATE_MISMATCH,
        fingerprint: liveFingerprint,
      }
    }
    // 6. EXACTLY ONE result per attempt.
    if (result.status === 'OPEN' || result.status === 'DEGRADED_ACKNOWLEDGED') {
      return {
        decision: 'admit',
        status: result.status,
        fingerprint: state.fingerprint,
        generation: state.generation,
        reprobed,
      }
    }
    const blocking = result.requirements.filter(
      (requirement) =>
        requirement.outcome === 'FATAL' ||
        (requirement.outcome === 'WARNING' &&
          (requirement.acknowledgement === null || requirement.acknowledgement.status !== 'VALID')),
    )
    return {
      decision: 'block',
      status: result.status,
      fingerprint: state.fingerprint,
      generation: state.generation,
      reprobed,
      blockingRequirements: blocking.map((requirement) => ({
        requirementId: requirement.requirementId,
        outcome: requirement.outcome,
        reasonCode: requirement.reasonCode,
        detail: requirement.detail,
        acknowledgementStatus:
          requirement.acknowledgement === null
            ? 'ABSENT'
            : requirement.acknowledgement.status,
      })),
    }
  }

  return {
    rootSessionId,
    admit,
    reprobe: (trigger) => prober.probe(trigger),
    current: () => prober.current(),
    acknowledge: (input) => prober.acknowledge(input),
    admitNewWork: (workKey) => prober.admitNewWork(workKey),
    settleWork: (workId) => prober.settleWork(workId),
    prober,
  }
}
