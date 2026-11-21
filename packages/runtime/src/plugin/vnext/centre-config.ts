/**
 * centre-config.ts — the row-config rules the CENTRE adds, kept out of host.ts so they can be
 * exercised without booting the host composition.
 *
 * WHY A SEPARATE MODULE (2026-11-22): the rule below was first written inline in
 * `validateTeamPluginConfig`, and there is no way to test it from source — host.ts pulls the remote
 * handler tree through `.js` specifiers that only exist after a build. A rule that can only be
 * verified by a full build is a rule that silently stops being verified when the build is broken
 * (which it was). The pure function here is the whole rule; host.ts only decides how to fail.
 *
 * @module packages/runtime/src/plugin/vnext/centre-config
 */

/** The subset of the row config these rules read. Deliberately structural, not `TeamPluginConfig`. */
export interface CentreConfigFacts {
  readonly centreStatePath?: unknown
  readonly alpha6ReviewRouting?: unknown
}

/**
 * The FIRST rule violation, or `undefined` when the centre-related config is coherent.
 *
 * R1 (external review 2026-11-22, C6/C7 deferral): Alpha.6 review routing decides who may review
 * whom. An enabled router whose decisions have nowhere durable to live is a governance claim with no
 * evidence behind it, so the opt-in requires the centre's state directory.
 *
 * This does NOT claim the PA approval-fact join is proven. It only refuses a configuration in which
 * the join could not even be recorded.
 */
export function centreConfigViolation (config: CentreConfigFacts | null | undefined): string | undefined {
  if (config === null || typeof config !== 'object') return undefined
  if (config.centreStatePath !== undefined && (typeof config.centreStatePath !== 'string' || config.centreStatePath.length === 0)) {
    return 'centreStatePath must be a non-empty string when present (the centre\'s durable facts and settlement directory)'
  }
  if (config.alpha6ReviewRouting === true && (typeof config.centreStatePath !== 'string' || config.centreStatePath.length === 0)) {
    return 'alpha6ReviewRouting requires centreStatePath: review routing is refused unless this row records its decisions in the centre\'s durable facts (C6/C7 deferral, 2026-11-22)'
  }
  return undefined
}
