/**
 * Alpha.6 — the composition-owned assigned-Officer facts provider.
 *
 * The control plane's delegated-Officer entry needs TWO trusted facts that a
 * durable control row cannot carry: who the leg's reviewer currently is
 * (`ControlServiceOptions.currentReviewerForTransfer`) and the Blueprint
 * policy/classification in force (`ControlServiceOptions.
 * reviewCallFactsForAssignedOfficer`). Both are decision-time facts, so they
 * must come from the composition — never from model input, request text or a
 * caller-supplied flag.
 *
 * This module is the ONE composition-owned producer for BOTH ports:
 *
 *   const facts = createAssignedOfficerFactsPort({ ... })
 *   createControlService({
 *     ...,
 *     currentReviewerForTransfer: facts.resolveCurrentReviewer,
 *     reviewCallFactsForAssignedOfficer: facts,
 *   })
 *
 * Keeping the two answers in one module is the point: the reviewer named by
 * the assignment port and the Officer whose policy the facts port returns are
 * resolved by the SAME durable lookup against the SAME frozen Blueprint, so
 * they cannot drift into "one reviewer, another policy".
 *
 * ## What this provider proves before it answers
 *
 * - the query belongs to THIS root (a cross-team query refuses);
 * - the parsed v5 Blueprint really carries `reviewRouting.enabled: true`;
 * - the durable leg exists, is `pending`, and matches the query on
 *   case/request/ordinal/kind/rung (a decided/abandoned/other-leg query refuses);
 * - the Blueprint identity the leg was opened under (`blueprintContentHash` +
 *   `blueprintRevision`) is EXACTLY the parsed Blueprint that supplied the
 *   routing — a newer/older Blueprint never lends its policy to an old leg;
 * - no current-leg transfer exists for the leg;
 * - exactly ONE live (`RUNNING`) Member instance carries the Blueprint's Officer
 *   template in this team — zero or multiple live Officers refuse THE QUERY
 *   (never "pick one"). This is a per-query refusal, not a boot refusal: the
 *   Team boots with zero Officer rows and the review attempt is what refuses
 *   (`officer-instance-count`); only a missing/Leader-equal
 *   `officerTemplateId` refuses at boot (`composition.ts`);
 * - the frozen authority generation is present and equals the composition's
 *   CURRENT generation FOR THE OPERATION OWNER (not the Officer's). `0` is a
 *   legal initial generation; absence (`undefined`) refuses;
 * - the actual OperationOwner resolves to a member of THIS team whose durable
 *   template is exactly the leg's frozen `operationOwnerTemplateId` and whose
 *   lifecycle is not revoked/terminal (`CREATED`/`RUNNING`/`SETTLED` all own
 *   a valid pending leg — the LEG is the subject of validity; see the law at
 *   `LEG_OWNER_LIVE_LIFECYCLES`); the owner is the leg's trusted SUBJECT
 *   instance (or legacy `targetInstanceId`), never the Requester (a Leader
 *   proxy may ask);
 * - the frozen tool binding (`definitionIdentity`/owner/name) is complete;
 * - the composition's fixed Leader/Human-category classifier answers
 *   explicitly (no answer = refusal, never an implicit `false`).
 *
 * Everything else — principal, case, leg, scope, owner instance, tool
 * coordinates, generation, effect set — is still reassembled by the control
 * service from the durable row, and `memberCapabilityProblem()` re-binds the
 * resulting candidate to that row. This port therefore cannot widen authority.
 *
 * The module IS wired in production (2026-11-09 update; the earlier "unwired
 * in production today" note was stale): `createAlpha6LiveRootComposition`
 * calls `createAlpha6ControlPorts` and the production root passes both ports
 * into `createControlService` (`root.ts:3180-3190`). The control service still
 * refuses the delegated entry whenever a port is absent, which is why an
 * Alpha.6-absent composition stays fail-closed.
 *
 * @module @dsh-agent-team/runtime/alpha6/assigned-officer-facts
 */
import type { ReviewRouting } from '../../domain/blueprint/src/index.js';
import type { AssignedOfficerReviewFacts, AssignedOfficerReviewFactsQuery, ControlCallerRef, ControlRequestKind, ControlStateSnapshot, ControlSubject } from '../control/types.js';
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js';
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js';
import type { parseAlpha6Routing } from './composition.js';
/** The parsed v5 routing the composition feeds the router and this port alike. */
export type AssignedOfficerParsedRouting = NonNullable<ReturnType<typeof parseAlpha6Routing>>;
/**
 * One durable Member row as this provider needs it. The production lookup is
 * the `memberInstances` repository (team-scoped); a row from another team is
 * refused even if a caller hands it over.
 */
export interface AssignedOfficerMemberSnapshot {
    readonly instanceId: string;
    /** Present on durable rows; when present it must equal the team root. */
    readonly rootSessionId?: string;
    readonly templateId: string;
    /**
     * Present on contracts-v1 member rows. ABSENT on the production contracts-v2
     * LeaderInstanceRecord (the Leader row carries neither childSessionId nor
     * lifecycle); consumers must not require it for Leader identity.
     */
    readonly childSessionId?: string;
    /**
     * The contracts lifecycle spelling. CREATED / RUNNING / SETTLED are live
     * (SETTLED is the normal idle state; delivery and cold resume cover it);
     * ARCHIVED / DISPOSED are not. A missing value is not evidence of liveness.
     */
    readonly lifecycle?: string;
}
/** The durable member reads this provider consults. */
export interface AssignedOfficerMemberLookup {
    /** The durable row of one instance inside ONE team. */
    readonly get: (rootSessionId: string, instanceId: string) => Promise<AssignedOfficerMemberSnapshot | undefined> | AssignedOfficerMemberSnapshot | undefined;
    /** Every durable member row of ONE team (for the unique-Officer law). */
    readonly list: (rootSessionId: string) => Promise<readonly AssignedOfficerMemberSnapshot[]> | readonly AssignedOfficerMemberSnapshot[];
}
/**
 * The durable control row subset the provider reads. A `ControlRequestRecord`
 * is structurally assignable; every authority-bearing member is optional here
 * and a missing one REFUSES (the row is validated, never defaulted).
 */
export interface AssignedOfficerFactsLeg {
    readonly rootSessionId: string;
    readonly requestId: string;
    readonly kind: ControlRequestKind;
    readonly status: 'pending' | 'decided' | 'abandoned';
    readonly requester: ControlCallerRef;
    readonly subject: ControlSubject;
    readonly approvalCaseId?: string;
    readonly legOrdinal?: number;
    readonly reviewAuthority?: ProposalAuthorityPosition;
    readonly requestedEffect?: PermissionOverlayEffect;
    readonly targetInstanceId?: string;
    readonly operationOwnerTemplateId?: string;
    readonly operationToolDefinitionIdentity?: string;
    readonly operationToolOwner?: string;
    readonly operationToolName?: string;
    readonly authorityGeneration?: number;
    readonly blueprintContentHash?: string;
    readonly blueprintRevision?: string;
    readonly operationFingerprint?: string;
    readonly mutationProposalFingerprint?: string;
}
/**
 * The leg-identifying subset BOTH control-service ports pass: the assignment
 * port (`currentReviewerForTransfer`) never carries kind/rung, the facts port
 * does. The durable row is the authority for both; a present query field must
 * still agree with it.
 */
export type AssignedOfficerReviewerQuery = Pick<AssignedOfficerReviewFactsQuery, 'rootSessionId' | 'approvalCaseId' | 'currentLegRequestId' | 'legOrdinal'>;
/**
 * Read the FROZEN durable control row for one leg. This callback must be a
 * durable read the composition owns; it must NOT call back into the same
 * control service (the per-team chain is not re-entrant while the delegated
 * entry is being evaluated). `null` = the row is not there (refuse).
 */
export type AssignedOfficerLegLookup = (query: AssignedOfficerReviewerQuery) => Promise<AssignedOfficerFactsLeg | null | undefined> | AssignedOfficerFactsLeg | null | undefined;
/** The durable current-leg transfer fact (routing only, never authority). */
export interface AssignedOfficerTransferFact {
    readonly currentLegRequestId: string;
    readonly approvalCaseId?: string;
    readonly legOrdinal?: number;
    readonly target: 'leader';
}
/**
 * Read the current-leg transfer state. `null`/`undefined` = no transfer. Any
 * transfer refuses delegation: the former Officer has no future signing
 * authority over the leg.
 */
export type AssignedOfficerTransferLookup = (query: AssignedOfficerReviewerQuery) => Promise<AssignedOfficerTransferFact | null | undefined> | AssignedOfficerTransferFact | null | undefined;
/** What the fixed-category classifier sees: frozen policy + frozen leg only. */
export interface AssignedOfficerCategoryQuery {
    readonly rootSessionId: string;
    readonly leg: AssignedOfficerFactsLeg;
    readonly routing: ReviewRouting;
}
/**
 * The composition's fixed Leader/Human-category answer.
 *
 * PR5 §2 records that no production classifier exists yet, so this module does
 * not invent one and does NOT default to `false` (a default would quietly widen
 * the delegable set). The composition must answer from its own frozen activity
 * taxonomy; `null` = "cannot classify" = refusal.
 */
export type AuthorityGenerationSource = number | ((input: {
    readonly rootSessionId: string;
    /**
     * The OPERATION OWNER's instance — the Member whose tool call was
     * frozen into the leg. This is deliberately NOT the reviewer: the PA
     * plan's generation belongs to the member that executed the operation.
     */
    readonly operationOwnerInstanceId: string;
}) => Promise<number | undefined>);
/**
 * The production fixed-category classifier over the CLOSED control kinds.
 *
 * It invents no taxonomy: `envelope-mutation` is the Leader governance /
 * mutation category, and `user-approval` is Human-only by construction. Only
 * `leader-approval` (the ordinary ask) is delegable to the Officer. Reading a
 * frozen kind is deterministic and cannot be supplied by a model or caller.
 */
export declare function createAlpha6CategoryLookup(): AssignedOfficerCategoryLookup;
export type AssignedOfficerCategoryLookup = (query: AssignedOfficerCategoryQuery) => Promise<boolean | null> | boolean | null;
/** The trusted composition inputs; every one is required. */
export interface AssignedOfficerFactsInput {
    readonly rootSessionId: string;
    /** The parsed v5 routing already consumed by the router/wiring. */
    readonly routing: AssignedOfficerParsedRouting;
    readonly members: AssignedOfficerMemberLookup;
    readonly leg: AssignedOfficerLegLookup;
    readonly transfer: AssignedOfficerTransferLookup;
    /**
     * The composition's CURRENT authority generation for the OPERATION OWNER
     * (the Member frozen into the leg's subject by PA). The provider refuses when
     * it is absent or when it disagrees with the generation frozen on the leg.
     * `0` is legal: it is the initial durable state of a member with no overlay
     * row, and equality with the frozen leg is still required.
     */
    readonly authorityGeneration?: AuthorityGenerationSource;
    readonly fixedLeaderOrHumanCategory: AssignedOfficerCategoryLookup;
}
/**
 * The facts port plus the matching assignment resolver.
 *
 * The callable face is exactly `ControlServiceOptions.
 * reviewCallFactsForAssignedOfficer`; `resolveCurrentReviewer` is exactly
 * `ControlServiceOptions.currentReviewerForTransfer`. Wire both from the same
 * provider instance.
 */
export interface AssignedOfficerFactsPort {
    (query: AssignedOfficerReviewFactsQuery): Promise<AssignedOfficerReviewFacts | null>;
    readonly resolveCurrentReviewer: (query: AssignedOfficerReviewerQuery) => Promise<{
        readonly instanceId: string;
    } | null>;
}
/**
 * Build the composition-owned assigned-Officer facts provider.
 *
 * The returned function answers `null` on ANY missing, stale, cross-team,
 * transferred or mismatched fact; it never falls back to request text, a
 * default routing, or a caller-supplied flag.
 */
export declare function createAssignedOfficerFactsPort(input: AssignedOfficerFactsInput): AssignedOfficerFactsPort;
/**
 * A6-PR5 (integration: A6 non-locking control reader) — the minimal durable
 * control reader `createAlpha6ControlPorts` consumes: EXACTLY
 * `ControlService.readControlState`, the non-locking snapshot route. Naming
 * the shape (rather than the whole service) keeps the helper from depending
 * on the mutation surface it must never call, and lets the composition pass
 * the live service instance without handing the facts provider authority.
 */
export interface Alpha6ControlStateReader {
    readonly readControlState: (rootSessionId: string) => Promise<ControlStateSnapshot>;
}
/**
 * The composition inputs for {@link createAlpha6ControlPorts}. Deliberately
 * free of request text, model flags, or any caller-supplied capability claim:
 * the durable ledger rows and the frozen routing are the only inputs.
 */
export interface Alpha6ControlPortsInput extends Omit<AssignedOfficerFactsInput, 'leg' | 'transfer'> {
    /** The live control service (or any narrower reader exposing the same). */
    readonly control: Alpha6ControlStateReader;
    /**
     * A created team has its OWN frozen v5 Blueprint. Resolve that root's parsed
     * routing instead of reusing the boot-root policy; null refuses this root.
     */
    readonly routingForRoot?: (rootSessionId: string) => AssignedOfficerParsedRouting | null;
}
/**
 * The TWO trusted control-service ports, produced together so they cannot
 * drift: exactly `ControlServiceOptions.currentReviewerForTransfer` and
 * `ControlServiceOptions.reviewCallFactsForAssignedOfficer`.
 */
export interface Alpha6ControlPorts {
    readonly currentReviewerForTransfer: (query: AssignedOfficerReviewerQuery) => Promise<{
        readonly instanceId: string;
    } | null>;
    readonly reviewCallFactsForAssignedOfficer: (query: AssignedOfficerReviewFactsQuery) => Promise<AssignedOfficerReviewFacts | null>;
}
/**
 * A6-PR5 (integration: A6 non-locking control reader) — compose the two
 * trusted control ports over the NON-LOCKING durable read.
 *
 * The control service evaluates these ports WHILE it holds the per-team lock,
 * and that lock chain is not re-entrant. Wiring them to `listControlState`
 * would deadlock the very operation that needs them, so this helper builds
 * both lookups on `readControlState` (same validation, same projections, no
 * lock) and hands them to the existing `createAssignedOfficerFactsPort`.
 *
 * There is ONE reviewer resolution and ONE policy answer behind both ports
 * (the facts provider's shared gate), and neither takes request text or a
 * model flag — only the durable rows `readControlState` reports.
 */
export declare function createAlpha6ControlPorts(input: Alpha6ControlPortsInput): Alpha6ControlPorts;
//# sourceMappingURL=assigned-officer-facts.d.ts.map