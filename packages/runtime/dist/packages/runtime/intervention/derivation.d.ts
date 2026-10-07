/**
 * Alpha.4 A4-PR3 — the legality DERIVATION law and the frozen terminal
 * case-outcome vocabularies (spec §11.5, §11.6, §12, §24.2; ADR A1-7, A1-12,
 * A2-1, A2-8, A3-2, A5-1, A5-2, X8).
 *
 * Scope, stated once because the plan is explicit about it (ADR X8):
 * **A4-PR3 produces outcome VOCABULARY and DERIVATION only.** The durable
 * recording of a terminal outcome behind a real execution, and the
 * registration files that surface these outcomes in the remote/UI planes,
 * belong to PR4/PR5 and PR6. Nothing in this module executes anything, and
 * nothing that executes consults it (ADR A1-17, pinned by
 * `a4p3-intervention-projection.test.ts`).
 *
 * The law is a pure function over an injected {@link RequiredAuthorityFacts}
 * bag. That shape is a ruling, not a shortcut: the ceiling algebra is
 * `CEILING_LANE`-only, and `a3p3-governance-lane-hygiene.test.ts` bans the
 * names that would let this module compute the facts itself — so the facts
 * arrive as a callback's result and the LAW (which action is legal for which
 * combination) lives here where it can be pinned. The bag also carries no
 * ladder ordering: comparing rungs is the reader's job, and re-spelling the
 * ladder or its rank here would create the second ordering ADR X7-R3 forbids.
 *
 * @module @dsh-agent-team/runtime/intervention
 */
import type { ApprovalCaseState, ControlRequestRecord } from '../control/types.js';
import type { InterventionAction, InterventionDerivationReason, InterventionItem, RequiredAuthorityFacts, RequiredAuthorityReader } from './types.js';
/**
 * The closed terminal-outcome vocabulary of a single OPERATION (plan Task 3
 * lane B, frozen by ADR X8 after the task body had dropped `authority-un‐
 * determined` against A1-7 / spec §24.2).
 *
 * The two `authority-*` values name DIFFERENT failures and must never be
 * conflated: `authority-unavailable` means "no resolver/admission path
 * exists today" (a missing Human Admin), while `authority-undetermined` means
 * "the ceiling could not be computed for this scope" (A1-7). Collapsing them
 * would report a filesystem fault or an undecidable containment as an Admin
 * escalation, and A5-2 pins the consequence the other way: undetermined makes
 * `allow` never legal.
 */
export declare const TERMINAL_OPERATION_OUTCOMES: {
    readonly EXECUTION_SUCCEEDED: "execution-succeeded";
    readonly EXECUTION_UNAVAILABLE: "execution-unavailable";
    readonly STALE: "stale";
    readonly DENIED: "denied";
    readonly AUTHORITY_UNAVAILABLE: "authority-unavailable";
    readonly AUTHORITY_UNDETERMINED: "authority-undetermined";
};
/** One closed terminal operation outcome. */
export type TerminalOperationOutcome = (typeof TERMINAL_OPERATION_OUTCOMES)[keyof typeof TERMINAL_OPERATION_OUTCOMES];
/** Every closed terminal operation outcome, in declaration order. */
export declare const TERMINAL_OPERATION_OUTCOME_VALUES: readonly TerminalOperationOutcome[];
/**
 * The closed terminal-outcome vocabulary of a durable MUTATION proposal
 * (spec §24.2, plan Task 3 lane B). `mutation-stale` is the drift outcome
 * (CAS / lifecycle / root-identity drift after approval, acceptance 21.6) and
 * `mutation-no-change` the "approved but nothing to write" outcome.
 */
export declare const TERMINAL_MUTATION_OUTCOMES: {
    readonly MUTATION_COMMITTED: "mutation-committed";
    readonly MUTATION_NO_CHANGE: "mutation-no-change";
    readonly MUTATION_STALE: "mutation-stale";
    readonly DENIED: "denied";
    readonly AUTHORITY_UNAVAILABLE: "authority-unavailable";
    readonly AUTHORITY_UNDETERMINED: "authority-undetermined";
};
/** One closed terminal mutation outcome. */
export type TerminalMutationOutcome = (typeof TERMINAL_MUTATION_OUTCOMES)[keyof typeof TERMINAL_MUTATION_OUTCOMES];
/** Every closed terminal mutation outcome, in declaration order. */
export declare const TERMINAL_MUTATION_OUTCOME_VALUES: readonly TerminalMutationOutcome[];
/** The authorization side of a terminal outcome (who said what, last). */
export declare const TERMINAL_AUTHORIZATIONS: {
    readonly ALLOWED: "allowed";
    readonly DENIED: "denied";
    readonly STALE: "stale";
    readonly NONE: "none";
};
export type TerminalAuthorization = (typeof TERMINAL_AUTHORIZATIONS)[keyof typeof TERMINAL_AUTHORIZATIONS];
/** The authority side: availability of a resolver, and decidability (§24.2). */
export declare const TERMINAL_AUTHORITY_STATES: {
    readonly RESOLVED: "resolved";
    readonly UNAVAILABLE: "unavailable";
    readonly UNDETERMINED: "undetermined";
};
export type TerminalAuthorityState = (typeof TERMINAL_AUTHORITY_STATES)[keyof typeof TERMINAL_AUTHORITY_STATES];
/** The execution side of an operation that reached its last-mile check. */
export declare const TERMINAL_EXECUTIONS: {
    readonly SUCCEEDED: "succeeded";
    readonly UNAVAILABLE: "unavailable";
};
export type TerminalExecution = (typeof TERMINAL_EXECUTIONS)[keyof typeof TERMINAL_EXECUTIONS];
/** Whether an approved mutation actually changed the durable document. */
export declare const TERMINAL_MUTATION_EFFECTS: {
    readonly CHANGED: "changed";
    readonly NO_CHANGE: "no-change";
};
export type TerminalMutationEffect = (typeof TERMINAL_MUTATION_EFFECTS)[keyof typeof TERMINAL_MUTATION_EFFECTS];
/** The inputs of the operation terminal-outcome table (all three, always). */
export interface TerminalOperationInput {
    readonly authorization: TerminalAuthorization;
    readonly authority: TerminalAuthorityState;
    readonly execution: TerminalExecution;
}
/** The inputs of the mutation terminal-outcome table. */
export interface TerminalMutationInput {
    readonly authorization: TerminalAuthorization;
    readonly authority: TerminalAuthorityState;
    readonly effect: TerminalMutationEffect;
}
/**
 * The operation terminal outcome, as a TOTAL table with a fixed precedence
 * (spec §12, §24.2; ADR A1-7, A5-2).
 *
 * Precedence is the law, so it is stated: authority first (an undetermined
 * ceiling is absorbing and an unavailable resolver means no execution was
 * ever admissible), then the reviewer's decision, then execution. The
 * consequence that matters is that an `allow` NEVER outranks an authority
 * problem — an approval cannot execute itself into existence.
 *
 * @param input - the three axes of the terminated invocation.
 * @returns the closed terminal outcome.
 */
export declare function deriveTerminalOperationOutcome(input: TerminalOperationInput): TerminalOperationOutcome;
/**
 * The mutation terminal outcome, same precedence (spec §21.6, §24.2).
 *
 * @param input - the three axes of the terminated proposal.
 * @returns the closed terminal outcome.
 */
export declare function deriveTerminalMutationOutcome(input: TerminalMutationInput): TerminalMutationOutcome;
/**
 * The two row shapes the Control plane carries (ADR X8: the discriminator is
 * `approvalCaseId` PRESENCE, and it decides strictness).
 *
 * `present ⇒ strict` is what makes the additive fields safe: a row that
 * carries a case id but no `reviewAuthority` is CORRUPT and must be reported
 * as corrupt — defaulting it would silently invent a reviewer for an
 * authority-bearing row (A2-9). A row without a case id is a pre-Alpha.4 row
 * and keeps its pre-Alpha.4 semantics exactly.
 */
export declare const CONTROL_ROW_SHAPES: {
    readonly STRICT: "strict";
    readonly LEGACY: "legacy";
};
export type ControlRowShape = (typeof CONTROL_ROW_SHAPES)[keyof typeof CONTROL_ROW_SHAPES];
/** The minimal structural view the discriminator reads. */
export interface ControlRowDiscriminee {
    readonly approvalCaseId?: string;
    readonly legOrdinal?: number;
    readonly reviewAuthority?: string;
}
/**
 * Which shape a durable request row has.
 *
 * @param row - the row's additive Alpha.4 fields.
 * @returns `strict` exactly when the row carries an `approvalCaseId`.
 */
export declare function controlRowShapeOf(row: ControlRowDiscriminee): ControlRowShape;
/**
 * The typed corruption of a strict row, or undefined when it is well formed.
 * A strict row missing `reviewAuthority` or `legOrdinal` is NEVER defaulted.
 *
 * @param row - the row's additive Alpha.4 fields.
 * @returns the corruption reason, or undefined.
 */
export declare function strictRowProblem(row: ControlRowDiscriminee): 'missing-review-authority' | 'missing-leg-ordinal' | undefined;
/** What the law derived, and why (never an empty explanation). */
export interface LegalActionDerivation {
    readonly actions: readonly InterventionAction[];
    readonly reasons: readonly InterventionDerivationReason[];
}
/**
 * The §11.5 legal-action law, derived fresh on the server.
 *
 * ```text
 * reviewAuthority < requiredAuthority  OR  desiredEffect > grantCeiling
 *   -> deny | escalate
 * reviewAuthority >= requiredAuthority AND reviewAuthority < human-admin
 *   -> allow | escalate | deny
 * reviewAuthority = human-admin
 *   -> allow | deny
 * ```
 *
 * Read as code below, with three closures the spec text leaves to the ADRs:
 *
 * - `escalate` is legal only when the rung above HAS a resolver (spec §11.6:
 *   a case whose next rung nobody can decide terminates instead of offering
 *   an escape hatch that leads nowhere);
 * - `allow` is never legal when a ceiling is undetermined (A5-2), which is
 *   why that check precedes the ladder branches — and the OUTCOME stays
 *   `authority-undetermined`, it is never coerced into `deny`;
 * - an empty set is the honest answer for a terminal leg and for a principal
 *   who already acted on an earlier leg of the same case (spec §11.4,
 *   acceptance 21.5: "escalated old leg cannot later allow" — the durable
 *   backing is the case's `reviewedBy` set of PRINCIPALS, ADR 24.5).
 *
 * `escalate` grants ZERO execution authority: it is a routing act, and the
 * action set itself is never consulted by a write path (spec §14.2).
 *
 * @param facts - the fresh facts from the injected reader.
 * @returns the legal actions and the closed reasons behind them.
 */
export declare function deriveLegalActions(facts: RequiredAuthorityFacts): LegalActionDerivation;
/**
 * Project one approval case to its InterventionItem.
 *
 * The item's identity is the CASE's, not the leg's: a risen leg updates the
 * same item (acceptance 21.9: "duplicate fingerprint updates count/time
 * rather than adding item"), which is what the §18.4 escalated-leg UX needs.
 *
 * @param caseState - the derived case state from the durable rows.
 * @param reader - the injected required-authority reader; ABSENT means this
 *   PR has no governance reader wired, and the honest projection is then "no
 *   legal actions" (spec §18.3: the client uses server-provided actions
 *   only — it is never allowed to guess them).
 * @returns the projected item.
 */
export declare function deriveInterventionItem(caseState: ApprovalCaseState, reader?: RequiredAuthorityReader): Promise<InterventionItem | undefined>;
/** The projection over a set of derived cases, in stable (id) order. */
export declare function deriveInterventionItems(caseStates: readonly ApprovalCaseState[], reader?: RequiredAuthorityReader): Promise<readonly InterventionItem[]>;
/**
 * The ADR A1-12 / spec §11.6 synchronous termination item: a case that can
 * produce NO review leg is surfaced once, informationally, with nothing to
 * act on and nothing held. What makes it safe is that the case never had an
 * OPEN leg — the durable close writes its leg row already DECIDED (audit F2),
 * so nothing can reconstruct as "a fake pending Admin request" (acceptance
 * 21.10).
 *
 * @param input - the frozen identity facts of the case that cannot be reviewed.
 * @returns the informational item.
 */
export declare function deriveZeroLegAuthorityUnavailableItem(input: {
    readonly approvalCaseId: string;
    readonly requiredAuthority: RequiredAuthorityFacts['requiredAuthority'];
    readonly fingerprint?: string;
    readonly observedAt: string;
}): InterventionItem;
/**
 * The current leg of a case, exposed for the PR4/PR5 lanes that need the
 * carrier row without re-deriving the case (a convenience projection; it
 * grants nothing).
 *
 * @param caseState - the derived case state.
 * @returns the current leg row, when the case has one.
 */
export declare function currentLegOf(caseState: ApprovalCaseState): ControlRequestRecord | undefined;
//# sourceMappingURL=derivation.d.ts.map