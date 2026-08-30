/**
 * Environment facts for the compatibility engine.
 *
 * An environment fact is one probe result about the real substrate: whether
 * a named capability in a probeable domain is currently available, at which
 * environment generation. Facts are *data* about the environment (the shape
 * follows the seam-manifest environment-fact model: one row per probed
 * capability with a verdict); they are produced by probes elsewhere and
 * consumed here —the engine itself never probes and never starts any work.
 *
 * **Relevance**: only facts whose (domain, subject) is named by some
 * requirement are *relevant*; the environment fingerprint is a hash of the
 * relevant probe records only, so irrelevant environment churn cannot
 * invalidate a result (Architecture §27.3 binds the ack to the
 * capability/environment fingerprint of the mismatch).
 *
 * **Generation**: a generation bump (even with unchanged availability)
 * changes the probe record and therefore the fingerprint —re-probe
 * semantics per Development Plan §20.1 ("relevant capability generation
 * change" is a re-probe trigger) and Architecture §14.3 E (staleness/generation).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/environment-facts
 */

import { canonicalJsonStringify, deepFreeze, teamContractError } from '../../../contracts/src/index.js'
import {
  assertNoUnknownFields,
  isPlainRecord,
  readBoolean,
  readNonEmptyString,
  readNonNegativeInteger,
} from './common.js'
import { assertRequirementType } from './requirement.js'
import type { Requirement, RequirementType } from './requirement.js'
import { computeFingerprint, NO_PROBE_GENERATION } from './fingerprint.js'

/** The exact frozen fields of an environment fact. */
const ENVIRONMENT_FACT_FIELDS: readonly string[] = [
  'domain',
  'subject',
  'available',
  'generation',
  'detail',
]

/** One probe result about a named capability (a "seam row" as environment fact). */
export interface EnvironmentFact {
  /** The probeable domain the fact is about (closed §27.1 vocabulary). */
  readonly domain: RequirementType
  /** The named subject (tool/skill/MCP server/model-route name, preset id, structural capability name). */
  readonly subject: string
  /** Probe verdict: is the capability currently available? */
  readonly available: boolean
  /** Environment generation of the probe (staleness/generation, §14.3 E). */
  readonly generation: number
  /** Optional probe diagnostic (not part of the fingerprint —diagnostics must not invalidate results). */
  readonly detail?: string
}

/** Collision-proof key for a (domain, subject) pair. */
function factKey(domain: RequirementType, subject: string): string {
  return canonicalJsonStringify([domain, subject])
}

/**
 * Parse and validate one environment fact.
 * @param value - the raw fact.
 * @param path - pointer used in the error details (defaults to `$`).
 * @returns the frozen fact.
 * @throws `MALFORMED_DTO` for unknown domains, malformed fields, or unknown
 *   fields (diagnostics carry the offending value).
 */
export function parseEnvironmentFact(value: unknown, path = '$'): EnvironmentFact {
  if (!isPlainRecord(value)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `environment fact must be a plain record at ${path}`,
      { path, problem: 'not a plain record' },
    )
  }
  assertNoUnknownFields(value, ENVIRONMENT_FACT_FIELDS, 'environment fact', path)
  const domain = assertRequirementType(value['domain'], `${path}.domain`)
  const subject = readNonEmptyString(value, 'subject', path)
  const available = readBoolean(value, 'available', path)
  const generation = readNonNegativeInteger(value, 'generation', path)
  const detail = value['detail']
  if (detail !== undefined && typeof detail !== 'string') {
    throw teamContractError(
      'MALFORMED_DTO',
      `detail must be a string at ${path}.detail`,
      { path: `${path}.detail`, problem: 'detail must be a string' },
    )
  }
  const fact: EnvironmentFact = detail === undefined
    ? { domain, subject, available, generation }
    : { domain, subject, available, generation, detail }
  return deepFreeze(fact)
}

/**
 * Parse and validate an environment-fact list.
 * @param values - the raw array (an empty list is valid: nothing was probed — *   every required subject is then an absent probe).
 * @returns the frozen list; each (domain, subject) pair appears at most once
 *   (a contradictory double probe is a validation error, not a classification).
 * @throws `MALFORMED_DTO` when not an array, for any malformed fact, or on a
 *   duplicate (domain, subject) pair.
 */
export function parseEnvironmentFacts(values: unknown): readonly EnvironmentFact[] {
  if (!Array.isArray(values)) {
    throw teamContractError(
      'MALFORMED_DTO',
      'environment facts must be an array at $.environmentFacts',
      { path: '$.environmentFacts', problem: 'not an array' },
    )
  }
  const seen = new Set<string>()
  return deepFreeze(
    values.map((item, index) => {
      const fact = parseEnvironmentFact(item, `environmentFacts[${index}]`)
      const key = factKey(fact.domain, fact.subject)
      if (seen.has(key)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `duplicate environment fact for '${fact.domain}/${fact.subject}' at environmentFacts[${index}]`,
          {
            path: `environmentFacts[${index}]`,
            domain: fact.domain,
            subject: fact.subject,
            problem: 'duplicate (domain, subject) fact',
          },
        )
      }
      seen.add(key)
      return fact
    }),
  )
}

/**
 * The probe state of one (domain, subject) as the engine sees it. Absent
 * facts (never probed) are encoded as `available: false` with
 * {@link NO_PROBE_GENERATION} so absence itself is part of the fingerprint.
 *
 * (type alias rather than interface: the frozen remote-safe record type
 * needs the implicit index signature that interfaces do not have).
 */
export type ProbeRecord = {
  readonly domain: RequirementType
  readonly subject: string
  readonly available: boolean
  readonly generation: number
}

/**
 * Compute the probe records relevant to `requirements`: exactly the
 * (domain, subject) pairs the requirements name, sorted by (domain, subject).
 * @param requirements - validated requirements.
 * @param facts - validated environment facts.
 * @returns the frozen, deterministically sorted probe records.
 */
export function computeProbeRecords(
  requirements: readonly Requirement[],
  facts: readonly EnvironmentFact[],
): readonly ProbeRecord[] {
  const factByKey = new Map<string, EnvironmentFact>()
  for (const fact of facts) {
    factByKey.set(factKey(fact.domain, fact.subject), fact)
  }
  const relevant = new Map<string, ProbeRecord>()
  for (const requirement of requirements) {
    for (const subject of requirement.subjects) {
      const key = factKey(requirement.type, subject)
      if (relevant.has(key)) continue
      const fact = factByKey.get(key)
      relevant.set(key, {
        domain: requirement.type,
        subject,
        available: fact === undefined ? false : fact.available,
        generation: fact === undefined ? NO_PROBE_GENERATION : fact.generation,
      })
    }
  }
  const records = [...relevant.values()]
  records.sort((a, b) => {
    if (a.domain !== b.domain) return a.domain < b.domain ? -1 : 1
    if (a.subject !== b.subject) return a.subject < b.subject ? -1 : 1
    return 0
  })
  return deepFreeze(records)
}

/**
 * Compute the environment fingerprint bound to the compatibility result:
 * the hash of the *relevant* probe records only (availability + generation
 * for every subject the requirements name). Any drift in a relevant fact — * availability flip, generation bump, new/removed probe —changes the
 * fingerprint and invalidates earlier results/acks; irrelevant environment
 * churn does not.
 * @param requirements - validated requirements.
 * @param facts - validated environment facts.
 * @returns the stable `fp-v1:` fingerprint string.
 */
export function computeEnvironmentFingerprint(
  requirements: readonly Requirement[],
  facts: readonly EnvironmentFact[],
): string {
  return computeFingerprint({ probes: [...computeProbeRecords(requirements, facts)] })
}
