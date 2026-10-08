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
  CompatibilityResult,
  CompatibilityStatus,
  EnvironmentFact,
  Requirement,
  WarningAcknowledgement,
} from '../../domain/compatibility/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import { compatibilityRequirementsOf } from './blueprint.js'
import { createCompatibilityProber, isLostStateRace } from './probe.js'
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

/**
 * The `evaluate` result: the SAME single-chain consultation as
 * {@link CompatibilityAuthority.admit} but WITHOUT the admit/block mapping —
 * it returns the RAW engine {@link CompatibilityResult} (the fresh
 * re-derivation of step 4/5) alongside the durable-state metadata the
 * recovery-model authority (plan §E.4) needs to project per-scope
 * verdicts. When the chain itself fails (facts-unavailable / reprobe-failed
 * / no-state / state-mismatch) the result carries the closed reprobe reason
 * and NO engine result — the consumer MUST fail closed, exactly as
 * `admit` maps the same condition to a `reprobe` decision.
 */
export interface CompatibilityEvaluation {
  /** Whether the chain produced a verdict (`true`) or failed (`false`). */
  readonly chainOk: boolean
  /** The reprobe failure reason when `chainOk` is `false` (closed vocabulary). */
  readonly reprobeReason?: ReprobeReason
  /** The live environment fingerprint when it was computed. */
  readonly fingerprint?: string
  /** The original downstream fault (facts-unavailable / reprobe-failed). */
  readonly cause?: Error
  /** The logical admission state of the fresh durable state (only when `chainOk`). */
  readonly status?: CompatibilityStatus
  /** The compatibility generation the evaluation was made under (only when `chainOk`). */
  readonly generation?: number
  /** Whether THIS attempt re-probed to ensure freshness (only when `chainOk`). */
  readonly reprobed?: boolean
  /** The RAW engine result of the step 4/5 re-derivation (only when `chainOk`). */
  readonly result?: CompatibilityResult
  /** The fresh environment facts the chain read (only when `chainOk`). */
  readonly facts?: readonly EnvironmentFact[]
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
  /**
   * The SAME single chain as {@link admit} without the admit/block mapping —
   * it returns the RAW engine result + the durable-state metadata (plan
   * §E.4: the recovery-model authority projects per-scope verdicts from it).
   * A chain failure is reported (not mapped to a decision) with the closed
   * reprobe reason; the consumer MUST fail closed.
   */
  evaluate(options?: CompatibilityAuthorityAdmitOptions): Promise<CompatibilityEvaluation>
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
 * @returns the authority. One per call, so NOTHING inside this object is shared
 *   across consultations — cross-instance consistency is therefore not assumed,
 *   it is ESTABLISHED at the seam by two mechanisms: the compatibility state
 *   transition is a generation-checked write whose comparison runs inside the
 *   domain's write chain (`CompatibilityRepository.replaceIfGeneration`), and a
 *   consultation whose probe loses that check CONVERGES on the winner's row when
 *   the row already carries the live fingerprint (step 3), and still fails
 *   closed when it does not. Until A4-PR7 `compat-atomic` this paragraph promised
 *   consistency from "the durable store + storage write chain" while the state
 *   replace was an unsynchronized `delete` + `put` — a promise the code did not
 *   keep, which is how a deterministic false refusal survived review.
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

  async function evaluate(
    admitOptions?: CompatibilityAuthorityAdmitOptions,
  ): Promise<CompatibilityEvaluation> {
    // 1. READ current environment facts (fresh; a failure is a chain
    //    failure — never an admission).
    let facts: readonly EnvironmentFact[]
    try {
      facts = await options.environmentFacts()
    } catch (error) {
      return {
        chainOk: false,
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
        // CONVERGENCE (A4-PR7 `compat-atomic`, the owner ruling on the p6t1
        // escalation): this chain's probe lost the conditioned write, which
        // means ANOTHER writer durably committed a state in the same instant.
        // If that row already carries the fingerprint this chain wanted, the
        // establishment it was waiting for HAS happened, and refusing here is
        // the false ACTIVATION_COMPATIBILITY_BLOCKED_FATAL that escalation
        // measured (one consultation refused per race, deterministically).
        // So the loser converges; a non-race fault, and a lost race whose row
        // is absent or carries a DIFFERENT fingerprint, still fail closed
        // exactly as before. `reprobed: true` below means "this consultation
        // established the generation, by winning or by converging on the
        // winner" — the two are told apart by the durable record (a converged
        // consultation fired no `onProbe` of its own and did not author the
        // row it reads), which is what the pins assert.
        const row = isLostStateRace(error)
          ? options.repositories.compatibility.get(rootSessionId)
          : undefined
        if (row === undefined || row.fingerprint !== liveFingerprint) {
          return {
            chainOk: false,
            reprobeReason: REPROBE_REASONS.REPROBE_FAILED,
            fingerprint: liveFingerprint,
            cause: error instanceof Error ? error : undefined,
          }
        }
        reprobed = true
      }
      state = options.repositories.compatibility.get(rootSessionId)
      if (state === undefined) {
        return {
          chainOk: false,
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
        chainOk: false,
        reprobeReason: REPROBE_REASONS.STATE_MISMATCH,
        fingerprint: liveFingerprint,
      }
    }
    // 6. The RAW evaluation (the admit/block mapping is the CONSUMER's job
    //    — `admit` maps it byte-identically to the pre-PR-E decision).
    return {
      chainOk: true,
      fingerprint: state.fingerprint,
      status: result.status,
      generation: state.generation,
      reprobed,
      result,
      facts,
    }
  }

  async function admit(
    admitOptions?: CompatibilityAuthorityAdmitOptions,
  ): Promise<CompatibilityAdmissionDecision> {
    const evaluation = await evaluate(admitOptions)
    if (!evaluation.chainOk) {
      return {
        decision: 'reprobe',
        reprobeReason: evaluation.reprobeReason as ReprobeReason,
        ...(evaluation.fingerprint !== undefined ? { fingerprint: evaluation.fingerprint } : {}),
        ...(evaluation.cause !== undefined ? { cause: evaluation.cause } : {}),
      }
    }
    const status = evaluation.status as CompatibilityStatus
    const fingerprint = evaluation.fingerprint as string
    const generation = evaluation.generation as number
    const reprobed = evaluation.reprobed as boolean
    const result = evaluation.result as CompatibilityResult
    if (status === 'OPEN' || status === 'DEGRADED_ACKNOWLEDGED') {
      return {
        decision: 'admit',
        status,
        fingerprint,
        generation,
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
      status,
      fingerprint,
      generation,
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
    evaluate,
    reprobe: (trigger) => prober.probe(trigger),
    current: () => prober.current(),
    acknowledge: (input) => prober.acknowledge(input),
    admitNewWork: (workKey) => prober.admitNewWork(workKey),
    settleWork: (workId) => prober.settleWork(workId),
    prober,
  }
}
