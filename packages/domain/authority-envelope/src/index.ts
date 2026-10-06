/**
 * `@dsh-agent-team/domain/authority-envelope` — the Alpha.4 shared
 * authority-envelope grammar and effective-ceiling algebra (ADR A3-9/A2-3,
 * spec §5.2/§24.2; plan Task 1 lane B).
 *
 * The dependency direction is ONE-WAY and lane-policed: `packages/runtime`
 * imports this barrel; this barrel imports nothing from anywhere (a leaf), so
 * the Blueprint domain layer can describe its own authority documents without
 * reaching into the runtime layer. `a3p3-governance-lane-hygiene.test.ts`
 * walks the tree in both directions to keep it that way.
 *
 * The names come in THREE families and the families are not interchangeable:
 *  - the DECLARED (AST) family — `AuthorityEnvelopeAst`, `AuthorityEnvelopeRuleAst`,
 *    `AuthorityEnvelopeAstMatcher`: what a hash-bound document carries;
 *  - the RUNTIME family — `AuthorityEnvelope`, `AuthorityEnvelopeRule`,
 *    `AuthorityResourceMatcher`: what the kernel and the overlay chain store;
 *  - the LATTICE family — `EffectiveCeiling`, `meetAuthorityCeilings`,
 *    `CEILING_IDENTITY`, `CEILING_NO_AUTHORITY` and the two lookups
 *    (`effectiveAuthorityCeiling`, `narrowingForApproval`) whose no-match
 *    answers are deliberately OPPOSITE (ADR A1-4).
 *
 * `PermissionMutationEnvelope` / `PermissionEnvelopeRule` survive as aliases of
 * the runtime family until PR7 deletes them (ADR A1-18), which is what lets
 * PR1-PR6 add the shared grammar without renaming callers in six places.
 *
 * @module @dsh-agent-team/domain/authority-envelope
 */

export {
  AUTHORITY_EFFECT_PRECEDENCE,
  AUTHORITY_EFFECT_VALUES,
  AUTHORITY_ENVELOPE_PROBLEMS,
  AUTHORITY_MATCHER_KINDS,
  AUTHORITY_OPERATION_CLASSES,
  AUTHORITY_SHELL_OPERATION_CLASSES,
  AUTHORITY_UNDETERMINED_REASONS,
  CEILING_IDENTITY,
  CEILING_NO_AUTHORITY,
  effectiveAuthorityCeiling,
  isShellOperationClass,
  matcherCovers,
  meetAllAuthorityCeilings,
  meetAuthorityCeilings,
  narrowingForApproval,
  parseAuthorityEnvelope,
} from './authority-envelope.js'

export type {
  AuthorityEffect,
  AuthorityEnvelope,
  AuthorityEnvelopeAst,
  AuthorityEnvelopeParseResult,
  AuthorityEnvelopeProblem,
  AuthorityEnvelopeProblemEntry,
  AuthorityEnvelopeRule,
  AuthorityEnvelopeRuleAst,
  AuthorityEnvelopeAstMatcher,
  AuthorityMatcherKind,
  AuthorityOperationClass,
  AuthorityResourceMatcher,
  AuthorityScope,
  AuthorityUndeterminedReason,
  CoverageVerdict,
  EffectiveCeiling,
  SubtreeContains,
} from './authority-envelope.js'
