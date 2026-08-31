/**
 * P7-T1 — probe generation + warning ACK fingerprint (the core of the
 * runtime compatibility module).
 *
 * One {@link CompatibilityProber} owns one TeamSession's compatibility
 * generation line (the durable `compatibility` store row of the
 * TeamDomain, keyed by the root session id):
 *
 * - **probe generation** (Development Plan §20.1): every one of the five
 *   re-probe triggers runs a fresh probe — a fresh environment-facts
 *   read, an engine evaluation carrying the durable acknowledgements,
 *   and a durable state replace at generation + 1 bound to the new
 *   environment fingerprint. A probe never starts, admits, or cancels
 *   any work; it only classifies and records (Architecture §27.2/§28,
 *   the P3 engine contract).
 * - **warning ACK fingerprint** (Architecture §27.3): an
 *   acknowledgement is bound to the CURRENT mismatch fingerprint AND
 *   the CURRENT environment fingerprint of the evaluation it
 *   acknowledges — never a permanent "ignore all warnings" flag. The
 *   engine re-derives both fingerprints on every evaluation and
 *   re-classifies each durable ack VALID / STALE / MISSING; a drift
 *   therefore makes the old ack stale and the warning re-blocks
 *   (the §41.7 invalidation).
 * - **drift → new work admission** (DevPlan §20.1 "新 warning：block
 *   NEW work"; Architecture §28.1/§28.2/§41.7): the new-work gate
 *   re-checks freshness first (a stale/absent generation forces a
 *   `STALE_GENERATION_BEFORE_NEW_WORK` re-probe), then blocks NEW work
 *   on BLOCKED_WARNING / BLOCKED_FATAL. In-flight work admitted before
 *   the drift is tracked per prober and its settle path NEVER
 *   consults the current compatibility state (§28.2: compatibility
 *   drift 不自动取消正在执行的 model/tool operation).
 *
 * Durable-write discipline: the `compatibility` repository has no
 * upsert (a different state at the same key is RECORD_DUPLICATE), so a
 * state replace is a delete + put serialized behind the prober's
 * promise-chain lock (the P6-T1 provider pattern). The documented crash
 * window (delete landed, put lost) leaves the row ABSENT — the
 * new-work gate then treats the generation as stale and re-probes: the
 * fail-safe direction (a missing state can never be a stale GREEN).
 *
 * In-flight boundary (documented): the in-flight work ledger is in
 * memory per prober instance (process lifetime). Durable crash-window
 * reconciliation of in-flight work belongs to the P4 operation journal;
 * this module encodes only the §28.2 settle semantics.
 *
 * I/O only through the injected TeamDomain repositories and the
 * environment-facts port; no node: builtins, no upstream imports.
 * @module @dsh-agent-team/runtime/compatibility/probe
 */

import {
  computeEnvironmentFingerprint,
  evaluateCompatibility,
  parseRequirements,
} from '../../domain/compatibility/src/index.js'
import type {
  CompatibilityResult,
  EnvironmentFact,
  Requirement,
  WarningAcknowledgement,
} from '../../domain/compatibility/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { parseRootSessionId } from '../../contracts/src/index.js'
import type { RemoteSafeRecord } from '../../contracts/src/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/index.js'
import type { CompatibilityStateRecord } from '../../storage/schema/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import { compatibilityRequirementsOf } from './blueprint.js'
import { classifyDrift } from './drift.js'
import { COMPATIBILITY_ERROR_CODES, CompatibilityError } from './errors.js'
import type {
  AcknowledgeInput,
  AdmittedWork,
  CompatibilityProber,
  CompatibilityVerdict,
  DriftObservation,
  NewWorkDecision,
  ProbeOutcome,
  ProbeTrigger,
  SettleRecord,
} from './types.js'
import { PROBE_TRIGGERS } from './types.js'

/** The dependencies of one compatibility prober (all injected). */
export interface CompatibilityProberDeps {
  /** The TeamDomain repositories (the durable `compatibility` store). */
  readonly repositories: TeamDomainRepositories
  /** The root session id the prober owns (one generation line per team). */
  readonly rootSessionId: string
  /** The bound blueprint (immutable durable snapshot). */
  readonly blueprint: TeamBlueprint
  /**
   * The environment-facts port: a FRESH read of the current probe
   * verdicts (availability + generation per capability). The prober
   * never caches facts across probes.
   */
  readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>
  /** The clock port (default: `new Date().toISOString()`). */
  readonly now?: () => string
  /** Optional probe observer (provenance channel; never fails a probe). */
  readonly onProbe?: (outcome: ProbeOutcome, drift: DriftObservation) => void
}

/** One in-flight work entry (internal state). */
interface InFlightEntry extends AdmittedWork {
  settled: boolean
}

/**
 * The plain-JSON lossless mapping of the engine result into the durable
 * record's `outcomes` field (Architecture §14.3 E: the current
 * compatibility facts are durable; storage validates the closed shape,
 * the semantics stay engine-owned). Built field-by-field (no spread of
 * frozen engine values) so the result is a plain mutable JSON record.
 */
function outcomesOf(result: CompatibilityResult): RemoteSafeRecord {
  const rows: RemoteSafeRecord[] = result.requirements.map((requirement) => {
    const ackRef = requirement.acknowledgement
    const bound = ackRef !== null ? ackRef.acknowledgement : null
    const row: RemoteSafeRecord = {
      requirementId: requirement.requirementId,
      type: requirement.type,
      complete: requirement.complete,
      outcome: requirement.outcome,
      reasonCode: requirement.reasonCode,
      detail: requirement.detail,
      unavailableSubjects: [...requirement.unavailableSubjects],
      mismatchFingerprint: requirement.mismatchFingerprint,
      acknowledgement:
        ackRef === null
          ? null
          : {
              status: ackRef.status,
              acknowledgement:
                bound === null
                  ? null
                  : {
                      requirementId: bound.requirementId,
                      mismatchFingerprint: bound.mismatchFingerprint,
                      environmentFingerprint: bound.environmentFingerprint,
                      acknowledgedBy: bound.acknowledgedBy,
                      acknowledgedAt: bound.acknowledgedAt,
                      ...(bound.note !== undefined ? { note: bound.note } : {}),
                    },
            },
    }
    return row
  })
  return {
    counts: {
      pass: result.counts.pass,
      warning: result.counts.warning,
      fatal: result.counts.fatal,
      unackedWarning: result.counts.unackedWarning,
      staleAcknowledgement: result.counts.staleAcknowledgement,
    },
    requirements: rows,
  }
}

/**
 * Extract the blocking requirement ids (WARNING or FATAL outcomes) from
 * a durable record's `outcomes` (defensive read: the record is
 * lossless-JSON; a malformed shape yields no ids, never a throw).
 */
function blockingRequirementIdsOf(record: CompatibilityStateRecord): string[] {
  const raw = record.outcomes['requirements']
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const requirement = item as Record<string, unknown>
    const id = requirement['requirementId']
    const outcome = requirement['outcome']
    if (typeof id === 'string' && (outcome === 'WARNING' || outcome === 'FATAL')) ids.push(id)
  }
  return ids
}

/**
 * Create one per-TeamSession compatibility prober (the P7-T1 public
 * constructor).
 *
 * @param deps - the injected dependencies (see {@link CompatibilityProberDeps}).
 * @returns the prober (implements {@link CompatibilityProber}).
 */
export function createCompatibilityProber(deps: CompatibilityProberDeps): CompatibilityProber {
  const now = deps.now ?? (() => new Date().toISOString())
  const repositories = deps.repositories
  const rootSessionId = deps.rootSessionId
  // The branded root session id (fail fast at construction; the durable
  // record's field is the contracts-branded identity, exactly as the
  // repositories validate it).
  const rootId = parseRootSessionId(rootSessionId)

  // The typed requirements of the bound blueprint (memoized: the
  // blueprint snapshot is immutable; a single derivation keeps the
  // fingerprint inputs stable across probes).
  let requirementsCache: readonly Requirement[] | undefined
  function requirements(): readonly Requirement[] {
    if (requirementsCache === undefined) {
      requirementsCache = parseRequirements(compatibilityRequirementsOf(deps.blueprint))
    }
    return requirementsCache
  }

  // The promise-chain lock: one durable writer per prober (the P6-T1
  // provider pattern).
  let lock: Promise<void> = Promise.resolve()
  function withLock<T>(work: () => Promise<T>): Promise<T> {
    const next = lock.then(work, work)
    // Keep the chain alive even when `work` rejects.
    lock = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  // The in-flight work ledger (§28.2): per prober instance, in memory.
  const inFlight = new Map<string, InFlightEntry>()
  let workCounter = 0

  /** Evaluate one fresh facts read against the durable acks (pure). */
  async function evaluateFresh(acks: readonly WarningAcknowledgement[]): Promise<CompatibilityResult> {
    const facts = await deps.environmentFacts()
    return evaluateCompatibility({
      requirements: requirements(),
      environmentFacts: facts,
      acknowledgements: acks,
    })
  }

  /**
   * Durably replace the compatibility state (delete + put: the
   * repository has no upsert; see the module docs for the crash window).
   *
   * S1-A hook B: the compatibility state is durable team state that
   * never passes through a ledger fact, so this replaceState is the
   * state's own stamp choke point. The generation advance happens only
   * AFTER the put is durable (a failed put rejects before any advance;
   * the delete alone never advances), serialized on the same
   * `team_domain` write chain — the same state-durable-before-stamp
   * order and v1 lag model as hook A. Warning-ACK writes take the same
   * replaceState path and are covered here.
   */
  async function replaceState(record: CompatibilityStateRecord): Promise<void> {
    await repositories.compatibility.delete(rootSessionId)
    await repositories.compatibility.put(record)
    await repositories.teamSessions.advanceGeneration(rootSessionId)
  }

  function verdictOf(result: CompatibilityResult, recordedAt: string, generation: number): CompatibilityVerdict {
    return {
      recordedAt,
      generation,
      environmentFingerprint: result.environmentFingerprint,
      status: result.status,
      pass: result.counts.pass,
      warning: result.counts.warning,
      fatal: result.counts.fatal,
      unackedWarning: result.counts.unackedWarning,
    }
  }

  async function probe(trigger: ProbeTrigger): Promise<ProbeOutcome> {
    return withLock(async () => {
      const previous = await repositories.compatibility.get(rootSessionId)
      const result = await evaluateFresh(previous !== undefined ? previous.acknowledgements : [])
      const recordedAt = now()
      const generation = (previous !== undefined ? previous.generation : 0) + 1
      const record: CompatibilityStateRecord = {
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        rootSessionId: rootId,
        status: result.status,
        fingerprint: result.environmentFingerprint,
        generation,
        outcomes: outcomesOf(result),
        acknowledgements: previous !== undefined ? [...previous.acknowledgements] : [],
        computedAt: recordedAt,
      }
      await replaceState(record)
      const verdict = verdictOf(result, recordedAt, generation)
      const outcome: ProbeOutcome = { ...verdict, trigger }
      const drift = classifyDrift(previous, verdict)
      const observer = deps.onProbe
      if (observer !== undefined) {
        try {
          observer(outcome, drift)
        } catch {
          // The observer is a provenance channel; a fault never fails
          // the probe (the durable state is authoritative).
        }
      }
      return outcome
    })
  }

  async function acknowledge(input: AcknowledgeInput): Promise<CompatibilityVerdict> {
    return withLock(async () => {
      const previous = await repositories.compatibility.get(rootSessionId)
      const previousAcks = previous !== undefined ? previous.acknowledgements : []
      // ONE facts read: the ack must bind to the exact mismatch +
      // environment fingerprint pair of THIS evaluation (§27.3) — the
      // re-evaluation below reuses the same facts so the bound pair cannot
      // drift between the two classifications.
      const facts = await deps.environmentFacts()
      const result = evaluateCompatibility({
        requirements: requirements(),
        environmentFacts: facts,
        acknowledgements: previousAcks,
      })
      const target = result.requirements.find((requirement) => requirement.requirementId === input.requirementId)
      if (target === undefined) {
        throw new CompatibilityError(
          COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING,
          `compatibility: no requirement '${input.requirementId}' in the bound blueprint's evaluation (nothing to acknowledge)`,
          { rootSessionId, requirementId: input.requirementId, outcome: 'ABSENT' },
        )
      }
      if (target.outcome === 'FATAL') {
        throw new CompatibilityError(
          COMPATIBILITY_ERROR_CODES.FATAL_NOT_ACKNOWLEDGABLE,
          `compatibility: FATAL requirement '${target.requirementId}' is not ack-able (Architecture §27.2: FATAL 不允许 Continue Anyway)`,
          {
            rootSessionId,
            requirementId: target.requirementId,
            reasonCode: target.reasonCode,
            detail: target.detail,
          },
        )
      }
      if (target.outcome === 'PASS' || target.mismatchFingerprint === null) {
        throw new CompatibilityError(
          COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING,
          `compatibility: requirement '${target.requirementId}' is PASS in the current evaluation — there is no mismatch to bind an acknowledgement to (Architecture §27.3)`,
          { rootSessionId, requirementId: target.requirementId, outcome: 'PASS' },
        )
      }
      // The ack binds to the CURRENT mismatch + environment generation
      // (§27.3): exactly this fingerprint pair, never a global flag.
      const ack: WarningAcknowledgement = {
        requirementId: target.requirementId,
        mismatchFingerprint: target.mismatchFingerprint,
        environmentFingerprint: result.environmentFingerprint,
        acknowledgedBy: input.acknowledgedBy,
        acknowledgedAt: now(),
        ...(input.note !== undefined ? { note: input.note } : {}),
      }
      const reResult = evaluateCompatibility({
        requirements: requirements(),
        environmentFacts: facts,
        acknowledgements: [...previousAcks, ack],
      })
      const recordedAt = now()
      const generation = (previous !== undefined ? previous.generation : 0) + 1
      const record: CompatibilityStateRecord = {
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        rootSessionId: rootId,
        status: reResult.status,
        fingerprint: reResult.environmentFingerprint,
        generation,
        outcomes: outcomesOf(reResult),
        acknowledgements: [...previousAcks, ack],
        computedAt: recordedAt,
      }
      await replaceState(record)
      return verdictOf(reResult, recordedAt, generation)
    })
  }

  /**
   * The freshness gate (DevPlan §20.1 trigger 5): a missing or stale
   * durable generation forces a re-probe BEFORE any admission decision.
   * "Stale" = the live environment fingerprint (a fresh facts read)
   * differs from the durable fingerprint — this also covers the
   * "relevant capability generation change" trigger, because the
   * generation is part of the probe record and therefore of the
   * fingerprint.
   */
  async function ensureFreshGeneration(): Promise<CompatibilityStateRecord> {
    const liveFacts = await deps.environmentFacts()
    const liveFingerprint = computeEnvironmentFingerprint(requirements(), liveFacts)
    const state = await repositories.compatibility.get(rootSessionId)
    if (state === undefined || state.fingerprint !== liveFingerprint) {
      await probe(PROBE_TRIGGERS.STALE_GENERATION_BEFORE_NEW_WORK)
      const fresh = await repositories.compatibility.get(rootSessionId)
      if (fresh === undefined) {
        throw new CompatibilityError(
          COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED,
          `compatibility: the re-probe did not establish a durable state for '${rootSessionId}' (fail closed, §28.1)`,
          { rootSessionId, problem: 'no-durable-state-after-probe' },
        )
      }
      return fresh
    }
    return state
  }

  /** The §28 gate: throw when new work must be blocked. */
  function gateNewWork(state: CompatibilityStateRecord): void {
    if (state.status === 'BLOCKED_WARNING' || state.status === 'BLOCKED_FATAL') {
      throw new CompatibilityError(
        COMPATIBILITY_ERROR_CODES.NEW_WORK_BLOCKED,
        `compatibility: the team's compatibility state is ${state.status} —new work admission is blocked (DevPlan §20.1: 新 warning block NEW work; Architecture §28.1/§41.7); already admitted work may still settle (§28.2)`,
        {
          rootSessionId,
          status: state.status,
          fingerprint: state.fingerprint,
          generation: state.generation,
          blockingRequirementIds: blockingRequirementIdsOf(state),
        },
      )
    }
  }

  async function admitNewWork(workKey: string): Promise<NewWorkDecision> {
    const state = await ensureFreshGeneration()
    gateNewWork(state)
    const decision = await withLock<NewWorkDecision>(async () => {
      workCounter += 1
      const workId = `work-${workCounter}`
      const entry: InFlightEntry = {
        workId,
        workKey,
        admittedAt: now(),
        admittedGeneration: state.generation,
        admittedStatus: state.status,
        settled: false,
      }
      inFlight.set(workId, entry)
      return {
        admitted: true,
        workId,
        status: state.status,
        fingerprint: state.fingerprint,
        generation: state.generation,
      }
    })
    return decision
  }

  async function settleWork(workId: string): Promise<SettleRecord> {
    // §28.2: this path NEVER reads the compatibility state —drift does
    // not cancel in-flight work; settling is always allowed for a work
    // this prober admitted.
    const entry = inFlight.get(workId)
    if (entry === undefined) {
      throw new CompatibilityError(
        COMPATIBILITY_ERROR_CODES.WORK_UNKNOWN,
        `compatibility: work '${workId}' was never admitted by this prober`,
        { rootSessionId, workId },
      )
    }
    if (entry.settled) {
      throw new CompatibilityError(
        COMPATIBILITY_ERROR_CODES.WORK_ALREADY_SETTLED,
        `compatibility: work '${workId}' already settled`,
        { rootSessionId, workId, admittedGeneration: entry.admittedGeneration },
      )
    }
    entry.settled = true
    return {
      workId,
      settledAt: now(),
      admittedGeneration: entry.admittedGeneration,
    }
  }

  async function enforceNewWorkAdmission(): Promise<void> {
    const state = await ensureFreshGeneration()
    gateNewWork(state)
  }

  return {
    rootSessionId,
    probe,
    current: async () => repositories.compatibility.get(rootSessionId),
    acknowledge,
    admitNewWork,
    settleWork,
    enforceNewWorkAdmission,
  }
}
