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
  authority_ref?: string | null
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
  if (faults.length > 0) return faults

  if (input.witness.length === 0) faults.push('witness is empty: a trace alone is not evidence')

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

  const blind = new Set<EffectDomain>(input.blindDomains)
  const required = uniqueDomains(
    input.requiredEffectDomains ?? input.witness.map((observation) => observation.domain),
  )
  const denyExpected = input.expectDeny !== false

  // Rule 2a: an uninstrumented required domain can never be graded clean.
  const blindRequired = required.filter((domain) => blind.has(domain))
  if (required.length === 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: ['no required effect domain is declared: there is nothing the witness could corroborate'],
      limitations,
    }
  }
  if (blindRequired.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [`required effect domain(s) not instrumented: ${blindRequired.join(', ')}`],
      limitations,
    }
  }

  // Rule 2b: every required domain must actually be reported by the witness.
  const missingObservations = required.filter(
    (domain) => !input.witness.some((observation) => observation.domain === domain),
  )
  if (missingObservations.length > 0) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [`witness reported no observation for required domain(s): ${missingObservations.join(', ')}`],
      limitations,
    }
  }

  // Log text alone is not evidence: if every reported domain is blind, the
  // trace cannot be promoted to SATISFIED no matter what it says.
  if (input.witness.every((observation) => blind.has(observation.domain))) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: ['every witnessed effect domain is blind: the trace alone is not evidence'],
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
  const effectDomains = required.filter((domain) =>
    input.witness.some((observation) => observation.domain === domain && observation.observed),
  )
  const effectsObserved = effectDomains.length > 0

  // Rule 3a: a DENIED log line plus a real effect in a required domain.
  if (denied && effectsObserved) {
    return {
      verdict: 'VIOLATED',
      reasons: [
        `trace reports DENIED but the independent witness observed an effect in: ${effectDomains.join(', ')}`,
      ],
      limitations,
    }
  }

  // Rule 3b/3c: authority is null while an effect happened, or authority names
  // a different actor than the event's actor.
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
  for (const [index, event] of input.events.entries()) {
    if (typeof event.authority_ref !== 'string' || event.actor_id === undefined) continue
    if (event.authority_ref !== event.actor_id) {
      return {
        verdict: 'VIOLATED',
        reasons: [
          `events[${index}] authority_ref ${JSON.stringify(event.authority_ref)} names a different actor than actor_id ${JSON.stringify(event.actor_id)}`,
        ],
        limitations,
      }
    }
  }

  // Rule 4: SATISFIED needs independent corroboration of no effect, and a deny
  // contract additionally needs its DENIED event. An authorized effect is a
  // different contract; this deny/no-effect oracle does not promote it to
  // SATISFIED.
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
