/**
 * pre-alpha3 PR-E / review fix F1 — the runtime requirement-facts package
 * (guide §2.3): the production live-environment source for the
 * RequirementAuthority.
 *
 * The public surface: the `RuntimeRequirementFactsProvider` (the ONE live
 * environment source — MCP supply + fresh readiness + materialization + the
 * production substrate plan), the 3-state {@link RequirementObservation}s
 * the gate's BLOCK/OPEN decision reads, and the derived 2-state engine feed.
 *
 * The #42 consumer switching (W3-A) consumes this surface: the gate's
 * preflight/ack/re-check paths move from the static row `environmentFacts`
 * to `resolveFacts` (fresh 3-state), keeping the 2-state engine feed for the
 * compatibility engine's fingerprint/ack machinery.
 *
 * This is the package index — the only place a consumer imports the
 * requirement-facts surface from (`@dsh-agent-team/runtime/requirement-facts`).
 * @module @dsh-agent-team/runtime/requirement-facts
 */
export { createRuntimeRequirementFactsProvider, } from './provider.js';
export { classifyScopeReadiness, dropSeedFilledPendingFacts, type LiveReadinessSubject, type ScopeReadinessClassification, } from './pending.js';
export { assertRequirementFactScope, type MemberMaterializationView, type RequirementFactScope, type RequirementFactsPorts, type RequirementFactsResolution, type RequirementObservation, type RuntimeRequirementFactsProvider, type SeedEnvironmentFact, } from './types.js';
//# sourceMappingURL=index.d.ts.map