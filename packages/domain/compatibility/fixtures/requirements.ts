/**
 * Requirement fixtures for the compatibility engine tests.
 *
 * Raw input data (what a Blueprint revision would declare); the engine
 * re-validates every value, so these doubles as validation fixtures.
 *
 * Pure data module: no I/O, no side effects.
 * @module @dsh-agent-team/domain/compatibility/fixtures/requirements
 */

import type { RequirementInput } from '../src/requirement.js'

/**
 * A representative blueprint requirement set: one subject per ordinary
 * domain, plus the structural persona and team-structure requirements
 * (mirrors the probeable domains of Architecture §27.1).
 */
export const BLUEPRINT_REQUIREMENTS: readonly RequirementInput[] = [
  { requirementId: 'req-tool-delegate', type: 'tool', subjects: ['delegate'] },
  { requirementId: 'req-skill-review', type: 'skill', subjects: ['code-review'] },
  { requirementId: 'req-mcp-abtem', type: 'mcpServer', subjects: ['abtem'] },
  { requirementId: 'req-model-route', type: 'modelRoute', subjects: ['qwen3.8-27b'] },
  { requirementId: 'req-persona', type: 'persona', subjects: ['team-preset-cordis'] },
  {
    requirementId: 'req-team-structure',
    type: 'teamStructure',
    subjects: ['durable-persistence', 'agent-lifecycle-seam', 'leader-member-surface'],
  },
]

/** A `complete:true` persona requirement (Architecture §13.5). */
export const COMPLETE_PERSONA_REQUIREMENT: RequirementInput = {
  requirementId: 'req-persona-complete',
  type: 'persona',
  subjects: ['cordis-preset'],
  complete: true,
}

/** A `complete:true` ordinary (tool) requirement — complete dominates type. */
export const COMPLETE_TOOL_REQUIREMENT: RequirementInput = {
  requirementId: 'req-tool-delegate-complete',
  type: 'tool',
  subjects: ['delegate'],
  complete: true,
}

/** A multi-subject requirement for partial-availability cases. */
export const MULTI_SUBJECT_TOOL_REQUIREMENT: RequirementInput = {
  requirementId: 'req-tools-multi',
  type: 'tool',
  subjects: ['delegate', 'spawn-member'],
}
