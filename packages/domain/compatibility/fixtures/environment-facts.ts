/**
 * Environment-fact fixtures for the compatibility engine tests.
 *
 * The shape follows the seam-manifest environment-fact model (one row per
 * probed capability: domain + subject + verdict + generation, as in
 * tests/characterization/seam-manifest/manifest.json — referenced as a data
 * model only, never imported). These are probe results about the substrate,
 * not policy and not work: the engine only reads them.
 *
 * Pure data module: no I/O, no side effects.
 * @module @dsh-agent-team/domain/compatibility/fixtures/environment-facts
 */

import type { EnvironmentFact } from '../src/environment-facts.js'

/**
 * A fully compatible environment: every capability the blueprint
 * requirements name is available. Includes one UNRELATED fact
 * (`tool/browser-use`) that no requirement references — it must be
 * irrelevant to the environment fingerprint.
 */
export const FULLY_COMPATIBLE_FACTS: readonly EnvironmentFact[] = [
  { domain: 'tool', subject: 'delegate', available: true, generation: 3 },
  { domain: 'tool', subject: 'spawn-member', available: true, generation: 3 },
  { domain: 'skill', subject: 'code-review', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'abtem', available: true, generation: 2 },
  { domain: 'modelRoute', subject: 'qwen3.8-27b', available: true, generation: 5 },
  { domain: 'persona', subject: 'team-preset-cordis', available: true, generation: 2 },
  { domain: 'teamStructure', subject: 'durable-persistence', available: true, generation: 4 },
  { domain: 'teamStructure', subject: 'agent-lifecycle-seam', available: true, generation: 4 },
  { domain: 'teamStructure', subject: 'leader-member-surface', available: true, generation: 4 },
  // Unrelated to any requirement: its drift must not invalidate results.
  { domain: 'tool', subject: 'browser-use', available: true, generation: 7 },
]

/** The MCP server probe reports unavailable (ordinary capability mismatch). */
export const MCP_UNAVAILABLE_FACTS: readonly EnvironmentFact[] = [
  ...FULLY_COMPATIBLE_FACTS.map((fact) =>
    fact.domain === 'mcpServer' && fact.subject === 'abtem'
      ? { ...fact, available: false, generation: 3, detail: 'mcp server not reachable' }
      : fact,
  ),
]

/**
 * Same availability as MCP_UNAVAILABLE_FACTS but the abtem probe re-ran
 * (generation 3 -> 4): a pure generation bump — must still change the
 * fingerprint (staleness/generation, Architecture §14.3 E).
 */
export const MCP_GENERATION_BUMP_FACTS: readonly EnvironmentFact[] = [
  ...FULLY_COMPATIBLE_FACTS.map((fact) =>
    fact.domain === 'mcpServer' && fact.subject === 'abtem'
      ? { ...fact, available: false, generation: 4, detail: 'mcp server not reachable (re-probe)' }
      : fact,
  ),
]

/** The structural durable-persistence capability is unavailable (FATAL). */
export const STRUCTURE_MISSING_FACTS: readonly EnvironmentFact[] = [
  ...FULLY_COMPATIBLE_FACTS.map((fact) =>
    fact.domain === 'teamStructure' && fact.subject === 'durable-persistence'
      ? { ...fact, available: false }
      : fact,
  ),
]

/** The persona probe reports incompatible (structural FATAL, non-complete). */
export const PERSONA_INCOMPATIBLE_FACTS: readonly EnvironmentFact[] = [
  ...FULLY_COMPATIBLE_FACTS.map((fact) =>
    fact.domain === 'persona' && fact.subject === 'team-preset-cordis'
      ? { ...fact, available: false }
      : fact,
  ),
]

/**
 * The complete:true persona preset conflict environment (Architecture
 * §13.5): the preset's effective persona is complete, so Team identity
 * cannot be composed.
 */
export const COMPLETE_PERSONA_CONFLICT_FACTS: readonly EnvironmentFact[] = [
  { domain: 'persona', subject: 'cordis-preset', available: false, generation: 1, detail: 'effective persona section is complete:true' },
]

/** The skill probe is absent entirely (no fact row — never probed). */
export const SKILL_NO_PROBE_FACTS: readonly EnvironmentFact[] = [
  ...FULLY_COMPATIBLE_FACTS.filter(
    (fact) => !(fact.domain === 'skill' && fact.subject === 'code-review'),
  ),
]

/**
 * Multi-subject environment where only one of two tools is available
 * (partial availability case).
 */
export const MULTI_SUBJECT_PARTIAL_FACTS: readonly EnvironmentFact[] = [
  { domain: 'tool', subject: 'delegate', available: true, generation: 3 },
]

/**
 * Irrelevant drift: only the unrelated `tool/browser-use` fact flips —
 * must NOT change the environment fingerprint.
 */
export const IRRELEVANT_DRIFT_FACTS: readonly EnvironmentFact[] = [
  ...FULLY_COMPATIBLE_FACTS.map((fact) =>
    fact.domain === 'tool' && fact.subject === 'browser-use'
      ? { ...fact, available: false, generation: 8 }
      : fact,
  ),
]
