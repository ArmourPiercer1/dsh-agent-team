/**
 * Alpha.4 A4-PR3 — the Intervention module's public surface (spec §14; ADR
 * A1-17, A5-7, X8).
 *
 * Frozen for PR4/PR5 (the names and their homes are enumerated in
 * `dev/agent-workflow/evidence/a4-pr3/interface-freeze.md`; a name absent
 * from that file is not frozen and not usable across the PR boundary):
 *
 * - the projection vocabulary: {@link INTERVENTION_KINDS},
 *   {@link INTERVENTION_STATUSES}, {@link INTERVENTION_RESPONSE_BEHAVIORS},
 *   {@link INTERVENTION_ACTIONS}, {@link INTERVENTION_DERIVATION_REASONS},
 *   {@link INTERVENTION_SOURCE_KINDS} and their union types, plus
 *   {@link InterventionItem} / {@link InterventionSource} /
 *   {@link InterventionBlockScope};
 * - the terminal case-outcome vocabularies: {@link TERMINAL_OPERATION_OUTCOMES}
 *   / {@link TERMINAL_MUTATION_OUTCOMES} with
 *   {@link TerminalOperationOutcome} / {@link TerminalMutationOutcome};
 * - the derivation law: {@link deriveLegalActions},
 *   {@link deriveInterventionItem}, {@link deriveInterventionItems},
 *   {@link deriveTerminalOperationOutcome}, {@link deriveTerminalMutationOutcome},
 *   {@link deriveZeroLegAuthorityUnavailableItem};
 * - the strict/legacy row discriminator: {@link CONTROL_ROW_SHAPES},
 *   {@link controlRowShapeOf}, {@link strictRowProblem};
 * - the projection seam: {@link projectInterventions},
 *   {@link projectZeroLegTermination}, {@link InterventionControlSource},
 *   {@link InterventionSourceAdapter}, {@link freezeItem};
 * - the injected-reader contract PR4 implements: {@link RequiredAuthorityFacts},
 *   {@link RequiredAuthorityReader}, {@link RequiredAuthorityReaderInput}.
 *
 * TWO DISCLOSURES that belong to this PR's record, not to a later discovery:
 *
 * 1. **Vocabulary and derivation only.** PR3 does not execute operations and
 *    does not record a terminal outcome behind a real execution — PR4 (the
 *    operation plane) and PR5 (the mutation plane) do, against these names.
 *    The durable row a terminal close needs is the existing
 *    `control-decision-recorded` row with the additive `terminalReason` field
 *    (ADR A2-8); PR3 deliberately does not invent a second fact type, and the
 *    registration files for the outcome surfacing are PR4/PR5's per ADR X8.
 * 2. **The escalation and abandonment rows render as generic Events until
 *    PR6.** `control-escalation-recorded` is registered in BOTH category maps
 *    in this commit (host `projection-source.ts` and the client mirror, ADR
 *    A5-6 / A5-22 / X8-R3, category `control` per X8-R3's correction), but
 *    `INTERNAL_FACT_TYPES` — which decides whether a row is an ordinary
 *    visible Event at all — is owned by PR6 (A5-7). Until then a reviewer
 *    sees an uncategorised Event row for an escalation rather than a
 *    structured one; the Intervention items above are the server-side truth
 *    that PR6 will surface.
 *
 * Zero-dist posture: `intervention/` is NOT in
 * `packages/runtime/tsconfig.build.json`'s include list, and PR3 must not add
 * it (ADR A4-6's precedent, restated for PR3 by plan line 302). PR6 wires the
 * module and co-commits its dist.
 *
 * @module @dsh-agent-team/runtime/intervention
 */

export {
  INTERVENTION_ACTIONS,
  INTERVENTION_ACTION_VALUES,
  INTERVENTION_DERIVATION_REASONS,
  INTERVENTION_KINDS,
  INTERVENTION_KIND_VALUES,
  INTERVENTION_RESPONSE_BEHAVIORS,
  INTERVENTION_SOURCE_KINDS,
  INTERVENTION_STATUSES,
  INTERVENTION_STATUS_VALUES,
} from './types.js'
export type {
  InterventionAction,
  InterventionBlockScope,
  InterventionDerivationReason,
  InterventionItem,
  InterventionKind,
  InterventionResponseBehavior,
  InterventionSource,
  InterventionSourceKind,
  InterventionStatus,
  RequiredAuthorityFacts,
  RequiredAuthorityReader,
  RequiredAuthorityReaderInput,
} from './types.js'

export {
  CONTROL_ROW_SHAPES,
  TERMINAL_AUTHORIZATIONS,
  TERMINAL_AUTHORITY_STATES,
  TERMINAL_EXECUTIONS,
  TERMINAL_MUTATION_EFFECTS,
  TERMINAL_MUTATION_OUTCOMES,
  TERMINAL_MUTATION_OUTCOME_VALUES,
  TERMINAL_OPERATION_OUTCOMES,
  TERMINAL_OPERATION_OUTCOME_VALUES,
  controlRowShapeOf,
  deriveInterventionItem,
  deriveInterventionItems,
  deriveLegalActions,
  deriveTerminalMutationOutcome,
  deriveTerminalOperationOutcome,
  deriveZeroLegAuthorityUnavailableItem,
  currentLegOf,
  strictRowProblem,
} from './derivation.js'
export type {
  ControlRowShape,
  LegalActionDerivation,
  TerminalAuthorization,
  TerminalAuthorityState,
  TerminalExecution,
  TerminalMutationEffect,
  TerminalMutationInput,
  TerminalMutationOutcome,
  TerminalOperationInput,
  TerminalOperationOutcome,
} from './derivation.js'

export {
  freezeItem,
  projectInterventions,
  projectZeroLegTermination,
} from './projection.js'
export type {
  InterventionControlSource,
  InterventionSourceAdapter,
  ProjectInterventionsInput,
} from './projection.js'
