/**
 * The closed persona KIND vocabulary of the compatibility model.
 *
 * The persona domain's subjects are PERSONA KINDS — the three closed
 * effective-persona states of a runtime preset (Architecture §13.5) — NOT
 * preset ids (the P5-T2 subject decision, revised by the
 * team-persona-requirement-preset-id bug report: a preset id pins the
 * requirement to one exact preset while the compatibility question is
 * about the preset's persona SHAPE). The runtime preset-substrate side of
 * the same vocabulary is `PRESET_PERSONA_KINDS` (runtime/agent-setup/
 * preset) — the two constants carry identical values by construction
 * (both derive from the frozen §13.5 three-state); the p5t2 runtime
 * suite asserts the equality.
 *
 * - `absent` — no effective persona section (nothing to compose, nothing
 *   to conflict with — still unmeetable for a persona requirement: the
 *   team identity has no persona surface to install onto, §27.2);
 * - `standard` — a composable non-complete effective persona (the
 *   compatible case: the Team scoped persona composes through the public
 *   scoped-section shadow, §13.4);
 * - `complete` — a complete effective persona (`complete: true` prompt
 *   section semantics, §13.5): the environment fact that justifies the
 *   frozen contracts-v1 code `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`.
 *
 * Authority: Architecture §13.5, §27.1, §27.2; Development Plan §16.2;
 * bug report docs/issues/team-persona-requirement-preset-id-bug-report.md
 * (direction B: subject = persona kind, not preset id).
 *
 * Pure module: no I/O, no side effects.
 * @module @dsh-agent-team/domain/compatibility/persona-kind
 */

/** The closed three-state effective-persona vocabulary (§13.5). */
export const PERSONA_KINDS = {
  /** No effective persona (nothing to compose, nothing to conflict). */
  absent: 'absent',
  /** A composable non-complete effective persona (the compatible case). */
  standard: 'standard',
  /** A complete effective persona (structural FATAL for Team, §13.5). */
  complete: 'complete',
} as const

/** One of the three closed effective-persona states. */
export type PersonaKind = (typeof PERSONA_KINDS)[keyof typeof PERSONA_KINDS]

/** Whether `value` is one of the closed persona kinds (string input guard). */
export function isPersonaKind(value: unknown): value is PersonaKind {
  return value === PERSONA_KINDS.absent || value === PERSONA_KINDS.standard || value === PERSONA_KINDS.complete
}
