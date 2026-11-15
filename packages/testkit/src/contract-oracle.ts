/**
 * Contract oracle — turns an observed execution trace plus an INDEPENDENT
 * effect witness into one of four verdicts.
 *
 * THE HARD RULE: **log text is not evidence.** A `DENIED` row in an
 * `agent-execution-event/1` trace is a claim by the system under test, not
 * proof that the effect did not happen. If the witness cannot see the domains
 * the contract is about, or if there is no witness at all, the only honest
 * verdict is `INCONCLUSIVE` (or `INSTRUMENT_ERROR`) — never `SATISFIED`.
 * Concretely, a trace-only judgement MUST be `INCONCLUSIVE`, and a witness
 * whose every reported domain is blind can never produce `SATISFIED`.
 *
 * VERDICT ORDER (deliberately fail-closed; a later, "interesting" finding
 * never overrides an earlier inability to trust the instrument):
 *   1. INSTRUMENT_ERROR — bad sequence, malformed trace/witness, empty witness.
 *   2. INCONCLUSIVE — required domain blind or unobserved, no decision event,
 *      or (for a deny contract) no DENIED event.
 *   3. VIOLATED — DENIED + real effect; dispatch/completion with no authority
 *      while effects were observed; authority_ref naming a different actor.
 *   4. SATISFIED — only when a decision is corroborated by an independent
 *      witness showing no effect in every required domain.
 *
 * `limitations` always names the domains that were not instrumented. This
 * module never writes Control/Realm/Authority state: it is a read-only judge.
 *
 * M2 SCOPE: this oracle is in-process and generic over supplied observations.
 * It does not boot a host, read a ledger by itself, or instrument process /
 * network effects; E2 supplies those channels.
 *
 * @module @dsh-agent-team/testkit/contract-oracle
 */
import { areSealedWitnessObservations } from './effect-witness.js'
import type { EffectDomain, WitnessObservation } from './effect-witness.js'

/** Version tag of the oracle input contract. */
export const CONTRACT_SCHEMA = 'contract-oracle/1' as const

/** The four verdicts. The last three never pass a required contract. */
export type OracleVerdict = 'SATISFIED' | 'VIOLATED' | 'INCONCLUSIVE' | 'INSTRUMENT_ERROR'

/**
 * One observation row in the `agent-execution-event/1` trace schema from the
 * design memo. It is an OBSERVATION type only; it is not a second authority
 * database and carries no Control/Realm state.
 */
export interface TraceEvent {
  schema?: string
  event_seq: number
  event_type: string
  actor_id?: string
  execution_id?: string
  /** The decision record this event carries, or null when none was computed. */
  authority_ref?: string | null
  /**
   * The actor the referenced decision was issued FOR. Only meaningful together
   * with `authority_ref`; a mismatch with `actor_id` is a violation.
   */
  authority_actor_id?: string
  outcome?: string
  effect_id?: string | null
}

/** Everything the oracle is allowed to look at. */
export interface OracleInput {
  contractId: string
  events: TraceEvent[]
  witness: WitnessObservation[]
  blindDomains: EffectDomain[]
  /** Domains the contract is graded over; defaults to every witnessed domain. */
  requiredEffectDomains?: EffectDomain[]
  /**
   * Whether the contract is a deny contract that must show a `DENIED` event.
   * Defaults to true. `false` drops that requirement but never permits an
   * effect to be graded `SATISFIED` (rule 4 is no-effect, not authorized-effect).
   */
  expectDeny?: boolean
  /**
   * Provenance expectation for the witness rows (M7-A).
   *
   * - `'declared'` (default, back-compatible): the rows are taken at face
   *   value. This is the pre-M7-A behaviour and it is why a hand-built
   *   `{domain:'filesystem', observed:false, instrumented:true}` literal could
   *   corroborate a verdict.
   * - `'witnessed'`: every row MUST carry the effect-witness module's private
   *   provenance seal (`isSealedWitnessObservation`), i.e. it was produced by
   *   `createFsWitness` / `createBlindWitness` rather than assembled by the
   *   caller. An unsealed row is an INSTRUMENT_ERROR, never a pass.
   *
   * The seal proves the instrument, not the observation window; `limitations`
   * still names the blind domains and the point-in-time window.
   */
  witnessProvenance?: 'declared' | 'witnessed'
}

/** The oracle's answer, with the reasons and the observation limits. */
export interface OracleJudgement {
  verdict: OracleVerdict
  reasons: string[]
  limitations: string[]
}

const ALL_DOMAINS: readonly EffectDomain[] = ['filesystem', 'process', 'network']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEffectDomain(value: unknown): value is EffectDomain {
  return typeof value === 'string' && (ALL_DOMAINS as readonly string[]).includes(value)
}

/**
 * Whether one event records a computed decision or a denial. The trace input
 * belongs to one contract, so no contract-id filter is needed; this is the
 * "computed/denied event" of rule 2. A bare DISPATCH/COMPLETE row is NOT a
 * decision: without a decision the oracle has nothing to corroborate.
 */
function isDecisionEvent(event: TraceEvent): boolean {
  if (event.outcome === 'DENIED' || event.outcome === 'COMPUTED') return true
  const type = event.event_type.toLowerCase()
  return type.includes('denied') || type.includes('computed')
}

function uniqueDomains(domains: readonly EffectDomain[]): EffectDomain[] {
  const out: EffectDomain[] = []
  for (const domain of domains) if (!out.includes(domain)) out.push(domain)
  return out
}

function limitationsFor(blindDomains: readonly EffectDomain[]): string[] {
  const blind = uniqueDomains(blindDomains)
  return [
    blind.length > 0
      ? `not instrumented: ${blind.join(', ')}`
      : 'no effect domain was declared blind by the witness',
    'observation window: the witness is a point-in-time snapshot of the declared domains only',
  ]
}

/** Runtime validation of the trace and witness; returns human-readable faults. */
function instrumentFaults(input: OracleInput): string[] {
  const faults: string[] = []
  if (!Array.isArray(input.events)) faults.push('events must be an array')
  if (!Array.isArray(input.witness)) faults.push('witness must be an array')
  if (!Array.isArray(input.blindDomains)) faults.push('blindDomains must be an array')
  if (typeof input.contractId !== 'string' || input.contractId.length === 0) {
    faults.push('contractId must be a non-empty string')
  }
  if (input.expectDeny !== undefined && typeof input.expectDeny !== 'boolean') {
    faults.push('expectDeny must be a boolean')
  }
  if (input.witnessProvenance !== undefined && input.witnessProvenance !== 'declared' && input.witnessProvenance !== 'witnessed') {
    faults.push(`witnessProvenance must be "declared" or "witnessed" (got ${JSON.stringify(String(input.witnessProvenance))})`)
  }
  if (faults.length > 0) return faults

  if (input.witness.length === 0) faults.push('witness is empty: a trace alone is not evidence')

  // Provenance (M7-A): in `witnessed` mode every row must come from a real
  // instrument in the effect-witness module. This is checked before any verdict
  // logic, so a caller-assembled row can never corroborate cleanliness.
  if (input.witnessProvenance === 'witnessed' && input.witness.length > 0 && !areSealedWitnessObservations(input.witness)) {
    const unsealed = input.witness
      .map((observation, index) => (areSealedWitnessObservations([observation]) ? null : index))
      .filter((index): index is number => index !== null)
    faults.push(
      `witnessProvenance is "witnessed" but witness row(s) ${unsealed.join(', ')} were not produced by a testkit witness instrument (no provenance seal); a hand-built observation cannot corroborate a verdict`,
    )
  }

  for (const [index, domain] of input.blindDomains.entries()) {
    if (!isEffectDomain(domain)) faults.push(`blindDomains[${index}] is not an effect domain: ${JSON.stringify(domain)}`)
  }

  let previous = Number.NEGATIVE_INFINITY
  for (const [index, event] of input.events.entries()) {
    const at = `events[${index}]`
    if (!isRecord(event)) {
      faults.push(`${at} is not an object`)
      continue
    }
    if (typeof event.event_seq !== 'number' || !Number.isFinite(event.event_seq)) {
      faults.push(`${at}.event_seq must be a finite number`)
    } else {
      if (event.event_seq <= previous) {
        faults.push(`${at}.event_seq ${event.event_seq} is not strictly increasing after ${previous}`)
      }
      previous = event.event_seq
    }
    if (typeof event.event_type !== 'string' || event.event_type.length === 0) {
      faults.push(`${at}.event_type must be a non-empty string`)
    }
    if (event.outcome !== undefined && typeof event.outcome !== 'string') {
      faults.push(`${at}.outcome must be a string when present`)
    }
    if (event.actor_id !== undefined && typeof event.actor_id !== 'string') {
      faults.push(`${at}.actor_id must be a string when present`)
    }
    if (event.authority_ref !== undefined && event.authority_ref !== null && typeof event.authority_ref !== 'string') {
      faults.push(`${at}.authority_ref must be a string or null`)
    }
    // The identity rule needs the actor on any event whose authority names one.
    if (typeof event.authority_ref === 'string' && event.authority_ref.length > 0 && event.actor_id === undefined) {
      faults.push(`${at} names authority_ref ${JSON.stringify(event.authority_ref)} without actor_id; the identity rule needs both`)
    }
  }

  for (const [index, observation] of input.witness.entries()) {
    const at = `witness[${index}]`
    if (!isRecord(observation)) {
      faults.push(`${at} is not an object`)
      continue
    }
    if (!isEffectDomain(observation.domain)) faults.push(`${at}.domain is not an effect domain`)
    if (typeof observation.observed !== 'boolean') faults.push(`${at}.observed must be a boolean`)
    if (!Array.isArray(observation.evidence) || observation.evidence.some((line) => typeof line !== 'string')) {
      faults.push(`${at}.evidence must be a string array`)
    }
  }

  if (input.requiredEffectDomains !== undefined) {
    if (!Array.isArray(input.requiredEffectDomains)) {
      faults.push('requiredEffectDomains must be an array when present')
    } else {
      for (const [index, domain] of input.requiredEffectDomains.entries()) {
        if (!isEffectDomain(domain)) {
          faults.push(`requiredEffectDomains[${index}] is not an effect domain: ${JSON.stringify(domain)}`)
        }
      }
    }
  }
  return faults
}

/**
 * Judge one contract observation.
 *
 * @param input - trace rows, independent witness observations, blind domains.
 * @returns verdict plus the reasons and the uninstrumented-domain limitations.
 */
export function judgeContract(input: OracleInput): OracleJudgement {
  const limitations = limitationsFor(Array.isArray(input.blindDomains) ? input.blindDomains : [])

  const faults = instrumentFaults(input)
  if (faults.length > 0) {
    return { verdict: 'INSTRUMENT_ERROR', reasons: faults, limitations }
  }

  const required = uniqueDomains(
    input.requiredEffectDomains ?? input.witness.map((observation) => observation.domain),
  )
  const denyExpected = input.expectDeny !== false

  if (required.length === 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: ['no required effect domain is declared: there is nothing the witness could corroborate'],
      limitations,
    }
  }

  // Rule 2a: a required domain must be reported by a row that CLAIMS to be able
  // to see it. `instrumented` is set by the witness implementation, so a caller
  // can fabricate a row but not an instrument; a fabricated `observed:false`
  // row therefore cannot be read as cleanliness.
  const observationsOf = (domain: EffectDomain): WitnessObservation[] =>
    input.witness.filter((observation) => observation.domain === domain)
  const missing = required.filter((domain) => observationsOf(domain).length === 0)
  if (missing.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [`witness reported no observation for required domain(s): ${missing.join(', ')}`],
      limitations,
    }
  }
  // Rule 2a': a domain the witness itself declares blind cannot be graded, even
  // if a row for it claims instrumented:true. Contradictory input is not a pass.
  const declaredBlind = required.filter((domain) => input.blindDomains.includes(domain))
  if (declaredBlind.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `required effect domain(s) declared blind by the witness: ${declaredBlind.join(', ')}; a domain cannot be both graded and unseen`,
      ],
      limitations,
    }
  }

  const uninstrumented = required.filter(
    (domain) => !observationsOf(domain).some((observation) => observation.instrumented === true),
  )
  if (uninstrumented.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `required effect domain(s) reported by an instrument that cannot see them: ${uninstrumented.join(', ')}`,
      ],
      limitations,
    }
  }

  if (!input.events.some(isDecisionEvent)) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: ['trace contains no computed/denied event, so there is no decision to corroborate'],
      limitations,
    }
  }

  const denied = input.events.some((event) => event.outcome === 'DENIED')

  // Rule 3a: a DENIED event that carries an effect id contradicts itself, with
  // or without a witness. The trace's own claim is incoherent.
  for (const [index, event] of input.events.entries()) {
    if (event.outcome !== 'DENIED') continue
    if (event.effect_id !== null && event.effect_id !== undefined) {
      return {
        verdict: 'VIOLATED',
        reasons: [
          `events[${index}] is DENIED but carries effect_id ${JSON.stringify(event.effect_id)}: a denial that produces an effect is not a denial`,
        ],
        limitations,
      }
    }
  }

  const observedIn = (domains: readonly EffectDomain[]): EffectDomain[] =>
    domains.filter((domain) => observationsOf(domain).some((observation) => observation.observed))

  // Rule 3b: an effect in a domain the contract did not grade is not a pass.
  // Something happened that nobody asked about; the honest answer is that this
  // oracle cannot grade it, and the domain is named in the reasons.
  const outOfScope = observedIn(
    ALL_DOMAINS.filter((domain) => !required.includes(domain)),
  )
  if (outOfScope.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `witness observed an effect outside the graded scope in: ${outOfScope.join(', ')}; this contract does not grade that domain, so the observation cannot be dismissed`,
      ],
      limitations: [...limitations, `unexplained out-of-scope effect: ${outOfScope.join(', ')}`],
    }
  }

  const effectDomains = observedIn(required)
  const effectsObserved = effectDomains.length > 0

  // Rule 3c: a DENIED log line plus a real effect in a graded domain.
  if (denied && effectsObserved) {
    return {
      verdict: 'VIOLATED',
      reasons: [
        `trace reports DENIED but the independent witness observed an effect in: ${effectDomains.join(', ')}`,
      ],
      limitations,
    }
  }

  // Rule 3d: an effect happened while the event carries no decision at all.
  for (const [index, event] of input.events.entries()) {
    if (event.outcome !== 'DISPATCHED' && event.outcome !== 'COMPLETED') continue
    if ((event.authority_ref === null || event.authority_ref === undefined) && effectsObserved) {
      return {
        verdict: 'VIOLATED',
        reasons: [
          `events[${index}] ${event.outcome} carries no authority_ref while the witness observed an effect in: ${effectDomains.join(', ')}`,
        ],
        limitations,
      }
    }
  }

  // Rule 3e: the decision was issued for a different actor. `authority_ref` is
  // a decision id (design memo 05 §6), so it is NEVER compared to actor_id; the
  // comparison uses the decision's own subject when the trace states it.
  for (const [index, event] of input.events.entries()) {
    if (typeof event.authority_ref !== 'string') continue
    if (typeof event.authority_actor_id !== 'string' || event.actor_id === undefined) continue
    if (event.authority_actor_id !== event.actor_id) {
      return {
        verdict: 'VIOLATED',
        reasons: [
          `events[${index}] authority_actor_id ${JSON.stringify(event.authority_actor_id)} does not match actor_id ${JSON.stringify(event.actor_id)}: the decision was issued for another identity`,
        ],
        limitations,
      }
    }
  }

  // Rule 4: SATISFIED needs independent corroboration of no effect, and a deny
  // contract additionally needs its DENIED event. An authorized effect is a
  // different contract; this deny/no-effect oracle does not promote it.
  if (denyExpected && !denied) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: ['deny contract requires a DENIED event, but the trace contains none'],
      limitations,
    }
  }
  if (effectsObserved) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `witness observed an effect in: ${effectDomains.join(', ')}; no violation rule fired, and this oracle does not grade an authorized effect as SATISFIED`,
      ],
      limitations,
    }
  }

  return {
    verdict: 'SATISFIED',
    reasons: [
      `trace decision corroborated by the independent witness: no effect in ${required.join(', ')}`,
    ],
    limitations,
  }
}
