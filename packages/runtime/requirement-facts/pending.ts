/**
 * pre-alpha3 PR-E, D-3 (2026-09-30, adjudicated) — the pure classification
 * of ONE scope's live 3-state observations into the fail-closed PENDING /
 * DOWN partition the decision paths consume (the requirement gate, the
 * activation provider step 6, the creation preflight, the s6 probe).
 *
 * D-3 semantics (plan §C.3 "否则 unresolved fail closed；禁止 false OPEN" +
 * E.3 "no false OPEN" + E.11 negative #10 "readiness 重置 unknown" + C.5
 * "pending is a real materialization state"): a REQUIRED applicable
 * requirement whose LIVE observation is `unknown` (materialization slot
 * pending / not yet probed) is a TYPED PENDING block — NEVER a seed-filled
 * PASS (the static bootstrap seed is display/bootstrap only, never a
 * verdict, guide §2.5). This module reads the 3-state observations
 * directly and deliberately NEVER the 2-state engine verdict: the seed can
 * satisfy an unknown required fact (a false PASS), and a no-seed unknown
 * reads as a missing FATAL — both are reclassified here from the 3-state
 * truth.
 *
 * **Probeable scoping (D-3 narrowing, 2026-09-30 — parent adjudication,
 * option 1).** D-3 targets the TRANSIENT window only: a probe EXISTS for
 * the capability type and its observation has not settled yet
 * (materialization in flight / not yet probed — the B5 window). Whether a
 * live probe port is registered for a type is a DETERMINISTIC STRUCTURAL
 * fact — read from the host's probe-port registry (the readiness port's
 * `hasProbe` query; the single source of truth, never a duplicated type
 * list) and carried on each observation as `probeable` (ABSENT =
 * probeable — the conservative default for records produced before the
 * query existed and for test doubles without it). A required `unknown` of
 * a NON-probeable type is NOT the transient window: the type is
 * structurally unobservable live, so its `unknown` is permanent — this is
 * the DOCUMENTED KNOWN GAP (non-probeable required types — e.g.
 * `skill`/`tool`/`modelRoute`/`teamStructure` in the current production
 * host, which registers only the `mcpServer` probe port — have no live
 * observation; the bootstrap seed is their only source). That gap is the
 * pre-W2-A behavior, preserved DELIBERATELY: it is NOT the W2-A "seed
 * never truth" rule, which applies to PROBEABLE domains where the live
 * verdict settles. Neither this classifier nor the probe drop-filter
 * below invents a type list — both consume the same structural fact
 * (invariant 2: one source of truth).
 *
 * **The PF-2 tri-state (2026-09-30 — parent adjudication, option A).**
 * The D-3 PENDING window is the TRANSIENT (in-flight) window ONLY. An
 * unsettled (`unknown`) probeable observation may carry the
 * `observationState` (see {@link OBSERVATION_STATES}): `in-flight` — a
 * pending materialization slot EXISTS on a live session (the B5 window;
 * the typed PENDING stands — C.3 "否则 unresolved fail closed；禁止 false
 * OPEN" scoped to the OBSERVABLE domain; C.5 "pending is a real
 * materialization state") — or `never-observed` — NO fiber / NO pending
 * slot / NO failed slot on ANY live session (the capability is STRUCTURALLY
 * not-yet-applicable: the canonical v1→v2 first-create shape where a
 * team-scope server materializes only at the leader boundary of an EXISTING
 * team — PENDING there is a liveness deadlock, no observation can settle
 * short of the create itself; the v1→v2 upgrade path is the liveness
 * argument). The {@link isPendingWindow} predicate is the ONE shared
 * classifier decision: never-observed subjects are EXEMPT from the PENDING
 * partition (both here and in {@link dropSeedFilledPendingFacts}) — the
 * legacy seed-satisfied 2-state stands for them (C.2 — the bootstrap seed
 * as static bootstrap source; E.6 preflight — the seed's TRUTH decides:
 * available `true` → OPEN/proceed, `false`/absent → FATAL; the exemption
 * is NOT a blanket OPEN). ABSENT state = `in-flight` (the conservative
 * default — the exemption is never inferred, only observed). Every decision
 * consumer reads this ONE predicate — the gate, the activation step, the
 * creation preflight (through {@link classifyScopeReadiness}) and the probe
 * (through {@link dropSeedFilledPendingFacts}) — so they inherit identical
 * behavior: probe == gate (INV-9.4). Product-message correction (PF-2):
 * PENDING now means IN-FLIGHT only ("recheckable at the next boundary" is
 * TRUE for every PENDING the decision paths emit — never a state that only
 * the blocked action itself could settle).
 *
 * Applicability (the E.11 negative #1 "cold member required MCP + mounted
 * false ≠ blocked" guard — applicability gates BEFORE readiness): a
 * `mcpServer` observation whose materialization axis is `not-applicable`
 * (a COLD member — no live agent, nothing to observe) is NEVER PENDING-
 * or DOWN-blocked: the capability's materialization is not applicable
 * until the member exists (guide §2.5.4 "a cold member MUST NOT block").
 * The axis exists only on the template/instance boundary; the Team scope
 * (whose own session boundary exists after creation) is always applicable.
 *
 * Precedence within one required requirement: a subject observed
 * `unreachable` SETS the requirement DOWN (a confirmed down is not
 * reclassified as pending by a sibling subject still unknown); otherwise
 * an `unknown` subject sets it PENDING.
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirement-facts/pending
 */

import { MATERIALIZATION_STATES, OBSERVATION_STATES, PROBE_VERDICTS } from '../readiness/index.js'
import type {
  EnvironmentFact,
  RequirementInput,
} from '../../domain/compatibility/src/index.js'
import type { RequirementObservation } from './types.js'

/** One live-readiness finding (a REQUIRED requirement's subject). */
export interface LiveReadinessSubject {
  readonly scopeKey: string
  readonly requirementId: string
  readonly subject: string
}

/**
 * The PENDING / DOWN partition of one scope's REQUIRED requirements.
 *
 * - `pending` — required, live-`unknown`, PROBEABLE (a live probe port is
 *   registered for the type — the structural fact on the observation;
 *   absent = probeable), applicable (NOT cold-not-applicable), and NOT
 *   never-observed (the PF-2 tri-state — the observation-state fact on the
 *   observation; absent = in-flight): the materialization is IN FLIGHT /
 *   not yet settled — the typed PENDING block category. A required
 *   `unknown` of a NON-probeable type (no live probe port — structurally
 *   unobservable live) is never `pending` here: it keeps the legacy
 *   seed-satisfied 2-state (the documented known gap — module doc above);
 *   a required `unknown` that is NEVER-OBSERVED (no fiber / pending slot /
 *   failed slot on ANY live session — structurally not-yet-applicable, the
 *   first-create bootstrap window) is never `pending` here either: its
 *   seed-satisfied 2-state decides — the seed's truth (C.2/E.6; module doc
 *   above);
 * - `down` — required, live-`unreachable`: a confirmed down — the existing
 *   FATAL-down block category (takes precedence over pending for the same
 *   requirement).
 */
export interface ScopeReadinessClassification {
  readonly pending: readonly LiveReadinessSubject[]
  readonly down: readonly LiveReadinessSubject[]
}

/**
 * D-3 narrowing (2026-09-30, parent adjudication — option 1): the
 * deterministic STRUCTURAL predicate — the observation's capability type
 * has a live probe port registered. The fact is the `probeable` field the
 * provider read from the host's probe-port registry (the readiness port's
 * `hasProbe` query — the single source of truth); ABSENT = probeable (the
 * conservative default preserving the full D-3 PENDING semantics for
 * observation records produced before the query existed and for test
 * doubles without it). Never timing- or observation-count-based.
 */
function isProbeable(observation: RequirementObservation): boolean {
  return observation.probeable !== false
}

/**
 * **The PF-2 tri-state predicate (2026-09-30 — parent adjudication, option
 * A) — the ONE classifier-level decision** of the D-3 PENDING window: a
 * required subject's live `unknown` is the transient PENDING window only
 * while its observation is IN-FLIGHT —
 *
 * - the type is PROBEABLE (the structural fact on the observation; absent =
 *   probeable — `isProbeable` above), AND
 * - the observation is NOT `never-observed` (the observation-state fact on
 *   the observation; ABSENT = `in-flight` — the conservative default, the
 *   exemption is never inferred).
 *
 * A `never-observed` subject (NO fiber / NO pending slot / NO failed slot on
 * ANY live session — the host probe's structural reading of the live world)
 * is the first-create bootstrap window: nothing can settle the observation
 * short of the create itself (a liveness deadlock if PENDING — the
 * canonical v1→v2 upgrade shape). The PENDING partition EXEMPTS it: the
 * legacy seed-satisfied 2-state stands (the bootstrap seed is the only
 * pre-observation source — C.2; E.6 preflight; the seed's TRUTH decides —
 * available `true` → OPEN/proceed, `false`/absent → FATAL; the exemption is
 * NOT a blanket OPEN). Every decision consumer reads this ONE predicate —
 * the gate, the activation step and the creation preflight through
 * {@link classifyScopeReadiness}, the probe through
 * {@link dropSeedFilledPendingFacts} — so they all inherit identical
 * behavior: probe == gate (INV-9.4).
 */
function isPendingWindow(observation: RequirementObservation): boolean {
  return (
    isProbeable(observation) &&
    observation.observationState !== OBSERVATION_STATES.neverObserved
  )
}

/**
 * Classify one scope's live observations over its requirement inputs.
 *
 * @param args.scopeKey - the scope key for provenance (the gate's
 *   `scopeKey(scope)`; the provider's own scope keys).
 * @param args.inputs - the scope's requirement inputs (the
 *   `complete === true` ones are the REQUIRED set — only these can block).
 * @param args.observations - the scope's live 3-state observations (one
 *   full-resolution read; the gate/provider capture the read the verdict
 *   was computed from — see the capturing-wrapper pattern at the call
 *   sites).
 * @returns the PENDING / DOWN partition (empty when there are no
 *   observations — the rule is off).
 */
export function classifyScopeReadiness(args: {
  readonly scopeKey: string
  readonly inputs: readonly RequirementInput[]
  readonly observations: readonly RequirementObservation[]
}): ScopeReadinessClassification {
  const { scopeKey, inputs, observations } = args

  const requiredIds = new Set(
    inputs.filter((input) => input.complete === true).map((input) => input.requirementId),
  )

  // Per required requirement: fold the 3-state readiness of its subjects.
  const stateByRequirement = new Map<string, { unreachable: boolean; unknown: boolean }>()
  for (const observation of observations) {
    if (!requiredIds.has(observation.requirementId)) continue
    // Applicability: a COLD member's mcpServer capability (materialization
    // `not-applicable`) is never blocked on — its materialization is not
    // applicable until the member exists (E.11 negative #1, guide §2.5.4).
    if (
      observation.type === 'mcpServer' &&
      observation.materialization === MATERIALIZATION_STATES.notApplicable
    ) {
      continue
    }
    const state = stateByRequirement.get(observation.requirementId) ?? {
      unreachable: false,
      unknown: false,
    }
    if (observation.readiness === PROBE_VERDICTS.unreachable) state.unreachable = true
    // D-3 narrowing + PF-2 tri-state: only an IN-FLIGHT unknown of a
    // PROBEABLE type is the transient window (one shared predicate —
    // never-observed is exempt, in-flight/absent-default stands).
    else if (observation.readiness === PROBE_VERDICTS.unknown && isPendingWindow(observation)) state.unknown = true
    stateByRequirement.set(observation.requirementId, state)
  }

  const pending: LiveReadinessSubject[] = []
  const down: LiveReadinessSubject[] = []
  const pendingSeen = new Set<string>()
  const downSeen = new Set<string>()
  for (const [requirementId, state] of stateByRequirement) {
    // A confirmed down SETS the requirement (it is not reclassified as
    // pending by a sibling subject still unknown).
    if (state.unreachable) {
      for (const observation of observations) {
        if (observation.requirementId !== requirementId) continue
        if (observation.readiness !== PROBE_VERDICTS.unreachable) continue
        const key = `${scopeKey}|${requirementId}|${observation.subject}`
        if (downSeen.has(key)) continue
        downSeen.add(key)
        down.push({ scopeKey, requirementId, subject: observation.subject })
      }
    } else if (state.unknown) {
      for (const observation of observations) {
        if (observation.requirementId !== requirementId) continue
        if (observation.readiness !== PROBE_VERDICTS.unknown) continue
        // D-3 narrowing + PF-2 tri-state: a non-probeable or NEVER-OBSERVED
        // type's unknown is not the transient window — it never lands in
        // the pending partition (the seed-satisfied 2-state decides).
        if (!isPendingWindow(observation)) continue
        const key = `${scopeKey}|${requirementId}|${observation.subject}`
        if (pendingSeen.has(key)) continue
        pendingSeen.add(key)
        pending.push({ scopeKey, requirementId, subject: observation.subject })
      }
    }
  }

  return { pending, down }
}

/**
 * D-3 (2026-09-30) — the s6 probe's seed-filled-fact drop filter (the
 * adjudicated probe rule; the probe is a FAITHFUL PREDICTOR of the
 * post-creation admission gate — s6-remote.ts T1.4-B frozen contract +
 * INV-9.4 "the fix for incomplete observation is to complete the
 * observation, not weaken the verdict").
 *
 * The gate now blocks with the typed PENDING outcome when a REQUIRED
 * requirement's live observation is `unknown`. The probe's wire verdict is
 * the engine's 2-state vocabulary (it cannot express PENDING), so the
 * faithful prediction of that block is a MISSING required fact → engine
 * FATAL → probe BLOCKED_FATAL: STRICTER (it never predicts an OPEN the
 * gate would deny — the documented safe direction), never looser.
 *
 * Rule (adjudicated, narrowed 2026-09-30 — parent adjudication option 1):
 * drop a feed fact `f` iff ∃ a REQUIRED requirement `r` (complete ===
 * true) with `r.type === f.domain` ∧ `f.subject ∈ r.subjects` ∧ the live
 * observation of `(r, f.subject)` is `unknown` ∧ that observation is
 * PROBEABLE (a live probe port is registered for the type — the SAME
 * structural fact {@link classifyScopeReadiness} consumes: one source of
 * truth, the host's probe-port registry; no duplicated type list). By the
 * feed contract (requirement-facts/types.ts) a fact present beside an
 * `unknown` observation is SEED-filled — dropping it turns the seed's
 * false PASS into an honest missing fact. A NON-probeable type's
 * `unknown` (structurally unobservable live — the documented known gap)
 * keeps its seed-filled fact (the legacy 2-state, pre-W2-A behavior
 * preserved deliberately).
 *
 * The `persona` domain is NEVER touched (U5 caller-only persona merge is
 * FROZEN, T1.4-B — the probe's persona semantics are unchanged by D-3).
 *
 * Team-scope only: the probe evaluates the blueprint's TEAM-scope
 * requirements (compatibilityRequirementsOf), and the materialization
 * axis exists only on the template/instance boundary — a Team-scope
 * observation is always applicable, so no cold exemption applies here
 * (the cold-member deadlock guard lives in {@link classifyScopeReadiness}
 * for the template-scope decision paths).
 *
 * Pure function: no I/O, no `node:` builtins.
 *
 * @param args.feed - the host feed facts (one per (domain, subject), the
 *   first observation wins — the provider's resolution).
 * @param args.observations - the live 3-state observations of the SAME
 *   resolution (the atomic pair).
 * @param args.requirements - the TEAM-scope requirement inputs the probe
 *   evaluates (the `complete === true` ones are the REQUIRED set).
 * @returns the feed with the seed-filled pending facts dropped.
 */
export function dropSeedFilledPendingFacts(args: {
  readonly feed: readonly EnvironmentFact[]
  readonly observations: readonly RequirementObservation[]
  readonly requirements: readonly RequirementInput[]
}): readonly EnvironmentFact[] {
  const { feed, observations, requirements } = args

  const requiredById = new Map(
    requirements.filter((input) => input.complete === true).map((input) => [input.requirementId, input]),
  )

  // The (domain, subject) pairs a REQUIRED requirement covers while its
  // live observation is still unknown — the seed-filled false PASSes.
  const pendingPairs = new Set<string>()
  for (const observation of observations) {
    const input = requiredById.get(observation.requirementId)
    if (input === undefined) continue
    if (observation.readiness !== PROBE_VERDICTS.unknown) continue
    // D-3 narrowing + PF-2 tri-state (SYMMETRIC with classifyScopeReadiness
    // — the SAME single predicate, one source of truth, no duplicated type
    // list): a non-probeable or NEVER-OBSERVED type's unknown is not the
    // transient window — its seed-filled fact is NOT dropped (the probe
    // consumes the seed truth for that subject — probe == gate, INV-9.4).
    if (!isPendingWindow(observation)) continue
    pendingPairs.add(`${input.type}|${observation.subject}`)
  }

  return feed.filter((fact) => {
    // U5 (FROZEN): the caller contributes ONLY the persona domain; the
    // probe's persona semantics are untouched by D-3.
    if (fact.domain === 'persona') return true
    return !pendingPairs.has(`${fact.domain}|${fact.subject}`)
  })
}
