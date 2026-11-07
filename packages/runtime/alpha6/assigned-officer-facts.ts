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
 *   template in this team — zero or multiple Officers refuse (never "pick one");
 * - the frozen authority generation is present and equals the composition's
 *   CURRENT generation FOR THE OPERATION OWNER (not the Officer's). `0` is a
 *   legal initial generation; absence (`undefined`) refuses;
 * - the actual OperationOwner resolves to a live member of THIS team whose
 *   durable template is exactly the leg's frozen `operationOwnerTemplateId`;
 *   the owner is the leg's trusted SUBJECT instance (or legacy
 *   `targetInstanceId`), never the Requester (a Leader proxy may ask);
 * - the frozen tool binding (`definitionIdentity`/owner/name) is complete;
 * - the composition's fixed Leader/Human-category classifier answers
 *   explicitly (no answer = refusal, never an implicit `false`).
 *
 * Everything else — principal, case, leg, scope, owner instance, tool
 * coordinates, generation, effect set — is still reassembled by the control
 * service from the durable row, and `memberCapabilityProblem()` re-binds the
 * resulting candidate to that row. This port therefore cannot widen authority.
 *
 * The module is unwired in production today (see the PR5 design note): the
 * control service refuses the delegated entry whenever a port is absent, which
 * is why an unwired composition stays fail-closed.
 *
 * @module @dsh-agent-team/runtime/alpha6/assigned-officer-facts
 */
import type { ReviewRouting } from '../../domain/blueprint/src/index.js'
import type {
  AssignedOfficerReviewFacts,
  AssignedOfficerReviewFactsQuery,
  ControlCallerRef,
  ControlRequestKind,
  ControlStateSnapshot,
  ControlSubject,
} from '../control/types.js'
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js'
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js'
import type { parseAlpha6Routing } from './composition.js'

/** The parsed v5 routing the composition feeds the router and this port alike. */
export type AssignedOfficerParsedRouting = NonNullable<ReturnType<typeof parseAlpha6Routing>>

/**
 * One durable Member row as this provider needs it. The production lookup is
 * the `memberInstances` repository (team-scoped); a row from another team is
 * refused even if a caller hands it over.
 */
export interface AssignedOfficerMemberSnapshot {
  readonly instanceId: string
  /** Present on durable rows; when present it must equal the team root. */
  readonly rootSessionId?: string
  readonly templateId: string
  /**
   * Present on contracts-v1 member rows. ABSENT on the production contracts-v2
   * LeaderInstanceRecord (the Leader row carries neither childSessionId nor
   * lifecycle); consumers must not require it for Leader identity.
   */
  readonly childSessionId?: string
  /**
   * The contracts lifecycle spelling. CREATED / RUNNING / SETTLED are live
   * (SETTLED is the normal idle state; delivery and cold resume cover it);
   * ARCHIVED / DISPOSED are not. A missing value is not evidence of liveness.
   */
  readonly lifecycle?: string
}

/** The durable member reads this provider consults. */
export interface AssignedOfficerMemberLookup {
  /** The durable row of one instance inside ONE team. */
  readonly get: (
    rootSessionId: string,
    instanceId: string,
  ) => Promise<AssignedOfficerMemberSnapshot | undefined> | AssignedOfficerMemberSnapshot | undefined
  /** Every durable member row of ONE team (for the unique-Officer law). */
  readonly list: (
    rootSessionId: string,
  ) => Promise<readonly AssignedOfficerMemberSnapshot[]> | readonly AssignedOfficerMemberSnapshot[]
}

/**
 * The durable control row subset the provider reads. A `ControlRequestRecord`
 * is structurally assignable; every authority-bearing member is optional here
 * and a missing one REFUSES (the row is validated, never defaulted).
 */
export interface AssignedOfficerFactsLeg {
  readonly rootSessionId: string
  readonly requestId: string
  readonly kind: ControlRequestKind
  readonly status: 'pending' | 'decided' | 'abandoned'
  readonly requester: ControlCallerRef
  readonly subject: ControlSubject
  readonly approvalCaseId?: string
  readonly legOrdinal?: number
  readonly reviewAuthority?: ProposalAuthorityPosition
  readonly requestedEffect?: PermissionOverlayEffect
  readonly targetInstanceId?: string
  readonly operationOwnerTemplateId?: string
  readonly operationToolDefinitionIdentity?: string
  readonly operationToolOwner?: string
  readonly operationToolName?: string
  readonly authorityGeneration?: number
  readonly blueprintContentHash?: string
  readonly blueprintRevision?: string
  readonly operationFingerprint?: string
  readonly mutationProposalFingerprint?: string
}

/**
 * The leg-identifying subset BOTH control-service ports pass: the assignment
 * port (`currentReviewerForTransfer`) never carries kind/rung, the facts port
 * does. The durable row is the authority for both; a present query field must
 * still agree with it.
 */
export type AssignedOfficerReviewerQuery = Pick<
  AssignedOfficerReviewFactsQuery,
  'rootSessionId' | 'approvalCaseId' | 'currentLegRequestId' | 'legOrdinal'
>

/**
 * Read the FROZEN durable control row for one leg. This callback must be a
 * durable read the composition owns; it must NOT call back into the same
 * control service (the per-team chain is not re-entrant while the delegated
 * entry is being evaluated). `null` = the row is not there (refuse).
 */
export type AssignedOfficerLegLookup = (
  query: AssignedOfficerReviewerQuery,
) => Promise<AssignedOfficerFactsLeg | null | undefined> | AssignedOfficerFactsLeg | null | undefined

/** The durable current-leg transfer fact (routing only, never authority). */
export interface AssignedOfficerTransferFact {
  readonly currentLegRequestId: string
  readonly approvalCaseId?: string
  readonly legOrdinal?: number
  readonly target: 'leader'
}

/**
 * Read the current-leg transfer state. `null`/`undefined` = no transfer. Any
 * transfer refuses delegation: the former Officer has no future signing
 * authority over the leg.
 */
export type AssignedOfficerTransferLookup = (
  query: AssignedOfficerReviewerQuery,
) =>
  | Promise<AssignedOfficerTransferFact | null | undefined>
  | AssignedOfficerTransferFact
  | null
  | undefined

/** What the fixed-category classifier sees: frozen policy + frozen leg only. */
export interface AssignedOfficerCategoryQuery {
  readonly rootSessionId: string
  readonly leg: AssignedOfficerFactsLeg
  readonly routing: ReviewRouting
}

/**
 * The composition's fixed Leader/Human-category answer.
 *
 * PR5 §2 records that no production classifier exists yet, so this module does
 * not invent one and does NOT default to `false` (a default would quietly widen
 * the delegable set). The composition must answer from its own frozen activity
 * taxonomy; `null` = "cannot classify" = refusal.
 */
export type AuthorityGenerationSource =
  | number
  | ((input: {
      readonly rootSessionId: string
      /**
       * The OPERATION OWNER's instance — the Member whose tool call was
       * frozen into the leg. This is deliberately NOT the reviewer: the PA
       * plan's generation belongs to the member that executed the operation.
       */
      readonly operationOwnerInstanceId: string
    }) => Promise<number | undefined>)

/**
 * Read the current generation for the OPERATION OWNER; a faulting read is a
 * refusal. `0` is a LEGAL generation (the durable overlay's initial state for
 * a member that never had an overlay row), not an absence sentinel; absence is
 * `undefined`.
 */
async function resolveGeneration(
  source: AuthorityGenerationSource | undefined,
  input: { readonly rootSessionId: string; readonly operationOwnerInstanceId: string },
): Promise<number | undefined> {
  if (source === undefined) return undefined
  if (typeof source === 'number') return source
  try {
    return await source(input)
  } catch {
    return undefined
  }
}

/**
 * The production fixed-category classifier over the CLOSED control kinds.
 *
 * It invents no taxonomy: `envelope-mutation` is the Leader governance /
 * mutation category, and `user-approval` is Human-only by construction. Only
 * `leader-approval` (the ordinary ask) is delegable to the Officer. Reading a
 * frozen kind is deterministic and cannot be supplied by a model or caller.
 */
export function createAlpha6CategoryLookup(): AssignedOfficerCategoryLookup {
  return ({ leg }) => {
    if (leg.kind === 'envelope-mutation') return true
    if (leg.kind === 'user-approval') return true
    if (leg.kind === 'leader-approval') return false
    return null
  }
}

export type AssignedOfficerCategoryLookup = (
  query: AssignedOfficerCategoryQuery,
) => Promise<boolean | null> | boolean | null

/** The trusted composition inputs; every one is required. */
export interface AssignedOfficerFactsInput {
  readonly rootSessionId: string
  /** The parsed v5 routing already consumed by the router/wiring. */
  readonly routing: AssignedOfficerParsedRouting
  readonly members: AssignedOfficerMemberLookup
  readonly leg: AssignedOfficerLegLookup
  readonly transfer: AssignedOfficerTransferLookup
  /**
   * The composition's CURRENT authority generation for the OPERATION OWNER
   * (the Member frozen into the leg's subject by PA). The provider refuses when
   * it is absent or when it disagrees with the generation frozen on the leg.
   * `0` is legal: it is the initial durable state of a member with no overlay
   * row, and equality with the frozen leg is still required.
   */
  readonly authorityGeneration?: AuthorityGenerationSource
  readonly fixedLeaderOrHumanCategory: AssignedOfficerCategoryLookup
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
  (
    query: AssignedOfficerReviewFactsQuery,
  ): Promise<AssignedOfficerReviewFacts | null>
  readonly resolveCurrentReviewer: (
    query: AssignedOfficerReviewerQuery,
  ) => Promise<{ readonly instanceId: string } | null>
}

function nonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isGeneration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/**
 * The OperationOwner instance, derived from the TRUSTED operation identity —
 * never from the Requester.
 *
 * `pa-control-bridge` writes the executing Member's instance id as the leg
 * subject and freezes that member's `authorityGeneration`. A Requester may be
 * the Leader (proxy ask) or a different instance of the same template, so
 * Requester-first inference binds the wrong Member. A leg whose trusted
 * identity is not an instance has no verifiable OperationOwner here: return
 * empty and let the provider refuse.
 */
function operationOwnerInstanceId(leg: AssignedOfficerFactsLeg): string {
  if (leg.subject.kind === 'instance') return leg.subject.instanceId
  return leg.targetInstanceId ?? ''
}

/**
 * Build the composition-owned assigned-Officer facts provider.
 *
 * The returned function answers `null` on ANY missing, stale, cross-team,
 * transferred or mismatched fact; it never falls back to request text, a
 * default routing, or a caller-supplied flag.
 */
export function createAssignedOfficerFactsPort(
  input: AssignedOfficerFactsInput,
): AssignedOfficerFactsPort {
  const root = input.rootSessionId
  const routing = input.routing.routing
  const blueprint = input.routing.blueprint

  /**
   * The shared gate both faces of the port use: prove the query/leg/team/
   * transfer/unique-Officer facts. The reviewer is resolved HERE and nowhere
   * else, so the assignment face and the facts face cannot name different
   * people.
   */
  async function resolveAssignedOfficer(
    query: AssignedOfficerReviewerQuery & {
      readonly kind?: AssignedOfficerReviewFactsQuery['kind']
      readonly reviewAuthority?: AssignedOfficerReviewFactsQuery['reviewAuthority']
    },
  ): Promise<{ readonly leg: AssignedOfficerFactsLeg; readonly officer: AssignedOfficerMemberSnapshot } | null> {
    if (query.rootSessionId !== root) return null
    if (routing.enabled !== true) return null

    let leg: AssignedOfficerFactsLeg | null | undefined
    try {
      leg = await input.leg(query)
    } catch {
      return null
    }
    if (leg === null || leg === undefined) return null

    // The row must be THIS team's, THIS query's leg, and still pending. A
    // decided/abandoned leg is stale; a different case/ordinal/rung is a
    // forged or overtaken query.
    if (leg.rootSessionId !== root) return null
    if (leg.requestId !== query.currentLegRequestId) return null
    if (leg.approvalCaseId !== query.approvalCaseId) return null
    if (leg.legOrdinal !== query.legOrdinal) return null
    // The assignment port carries no kind/rung; the facts port does. A
    // present query field must agree with the durable row.
    if (query.kind !== undefined && leg.kind !== query.kind) return null
    if (query.reviewAuthority !== undefined && leg.reviewAuthority !== query.reviewAuthority) return null
    if (leg.status !== 'pending') return null

    // The routing may speak for a leg ONLY if it is the very Blueprint the leg
    // was frozen under. A revision/content-hash mismatch is a different policy,
    // and naming a reviewer from it would bind the wrong person to the leg.
    if (!nonEmpty(blueprint.contentHash) || !nonEmpty(blueprint.revision)) return null
    if (leg.blueprintContentHash !== blueprint.contentHash) return null
    if (leg.blueprintRevision !== blueprint.revision) return null

    // A transferred leg belongs to the Leader now; the former Officer has no
    // future signing authority (the service refuses this before the evaluator,
    // and the provider refuses it independently).
    let transfer: AssignedOfficerTransferFact | null | undefined
    try {
      transfer = await input.transfer(query)
    } catch {
      return null
    }
    if (transfer !== null && transfer !== undefined) return null

    let members: readonly AssignedOfficerMemberSnapshot[]
    try {
      members = await input.members.list(root)
    } catch {
      return null
    }
    const officers = members.filter((member) =>
      member.templateId === routing.officerTemplateId &&
      (member.lifecycle === 'CREATED' || member.lifecycle === 'RUNNING' || member.lifecycle === 'SETTLED') &&
      // The Leader's durable child session IS the team root; it is never the
      // Officer even if a row were forged with the Officer template.
      member.childSessionId !== root &&
      (member.rootSessionId === undefined || member.rootSessionId === root))
    // Zero or multiple live Officers is a refusal, never a choice.
    if (officers.length !== 1) return null
    const officer = officers[0]
    if (officer === undefined) return null
    if (!nonEmpty(officer.instanceId) || !nonEmpty(officer.childSessionId)) return null
    return { leg, officer }
  }

  async function resolveCurrentReviewer(
    query: AssignedOfficerReviewerQuery,
  ): Promise<{ readonly instanceId: string } | null> {
    const resolved = await resolveAssignedOfficer(query)
    return resolved === null ? null : { instanceId: resolved.officer.instanceId }
  }

  async function reviewCallFacts(
    query: AssignedOfficerReviewFactsQuery,
  ): Promise<AssignedOfficerReviewFacts | null> {
    const resolved = await resolveAssignedOfficer(query)
    if (resolved === null) return null
    const { leg } = resolved

    // The generation is the OPERATION OWNER's, not the Officer's. Resolve the
    // owner from the trusted subject first, then compare THAT member's current
    // generation with the generation PA froze on the leg. The Officer's own
    // generation is irrelevant to the operation's authority facts.
    const ownerInstanceId = operationOwnerInstanceId(leg)
    if (!nonEmpty(ownerInstanceId)) return null
    if (!nonEmpty(leg.operationOwnerTemplateId)) return null
    const authorityGeneration = await resolveGeneration(input.authorityGeneration, {
      rootSessionId: root,
      operationOwnerInstanceId: ownerInstanceId,
    })
    if (!isGeneration(authorityGeneration)) return null
    if (!isGeneration(leg.authorityGeneration)) return null
    if (leg.authorityGeneration !== authorityGeneration) return null

    let owner: AssignedOfficerMemberSnapshot | undefined
    try {
      owner = await input.members.get(root, ownerInstanceId)
    } catch {
      return null
    }
    if (owner === undefined) return null
    if (owner.rootSessionId !== undefined && owner.rootSessionId !== root) return null
    if (owner.instanceId !== ownerInstanceId) return null
    if (owner.lifecycle !== 'RUNNING') return null
    if (owner.templateId !== leg.operationOwnerTemplateId) return null

    // The frozen tool binding must be complete; the evaluator rechecks the
    // owner/name against the ordinary-ask set and Leader exceptions.
    if (!nonEmpty(leg.operationToolDefinitionIdentity)) return null
    if (!nonEmpty(leg.operationToolOwner)) return null
    if (!nonEmpty(leg.operationToolName)) return null

    let fixedLeaderOrHumanCategory: boolean | null
    try {
      fixedLeaderOrHumanCategory = await input.fixedLeaderOrHumanCategory({
        rootSessionId: root,
        leg,
        routing,
      })
    } catch {
      return null
    }
    if (typeof fixedLeaderOrHumanCategory !== 'boolean') return null

    return {
      reviewRouting: routing,
      fixedLeaderOrHumanCategory,
      // The ladder already answers whether the leg's legal path needs a Human.
      requiresHuman: leg.reviewAuthority === 'human-user',
    }
  }

  return Object.assign(reviewCallFacts, { resolveCurrentReviewer })
}

/**
 * A6-PR5 (integration: A6 non-locking control reader) — the minimal durable
 * control reader `createAlpha6ControlPorts` consumes: EXACTLY
 * `ControlService.readControlState`, the non-locking snapshot route. Naming
 * the shape (rather than the whole service) keeps the helper from depending
 * on the mutation surface it must never call, and lets the composition pass
 * the live service instance without handing the facts provider authority.
 */
export interface Alpha6ControlStateReader {
  readonly readControlState: (rootSessionId: string) => Promise<ControlStateSnapshot>
}

/**
 * The composition inputs for {@link createAlpha6ControlPorts}. Deliberately
 * free of request text, model flags, or any caller-supplied capability claim:
 * the durable ledger rows and the frozen routing are the only inputs.
 */
export interface Alpha6ControlPortsInput extends Omit<AssignedOfficerFactsInput, 'leg' | 'transfer'> {
  /** The live control service (or any narrower reader exposing the same). */
  readonly control: Alpha6ControlStateReader
  /**
   * A created team has its OWN frozen v5 Blueprint. Resolve that root's parsed
   * routing instead of reusing the boot-root policy; null refuses this root.
   */
  readonly routingForRoot?: (rootSessionId: string) => AssignedOfficerParsedRouting | null
}

/**
 * The TWO trusted control-service ports, produced together so they cannot
 * drift: exactly `ControlServiceOptions.currentReviewerForTransfer` and
 * `ControlServiceOptions.reviewCallFactsForAssignedOfficer`.
 */
export interface Alpha6ControlPorts {
  readonly currentReviewerForTransfer: (
    query: AssignedOfficerReviewerQuery,
  ) => Promise<{ readonly instanceId: string } | null>
  readonly reviewCallFactsForAssignedOfficer: (
    query: AssignedOfficerReviewFactsQuery,
  ) => Promise<AssignedOfficerReviewFacts | null>
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
export function createAlpha6ControlPorts(input: Alpha6ControlPortsInput): Alpha6ControlPorts {
  const portsByRoot = new Map<string, Promise<AssignedOfficerFactsPort | null>>()

  async function snapshot(rootSessionId: string): Promise<ControlStateSnapshot | null> {
    try {
      return await input.control.readControlState(rootSessionId)
    } catch {
      return null
    }
  }

  const leg: AssignedOfficerLegLookup = async (query) => {
    const state = await snapshot(query.rootSessionId)
    if (state === null) return null
    return state.requests.find((row) => row.requestId === query.currentLegRequestId) ?? null
  }

  const transfer: AssignedOfficerTransferLookup = async (query) => {
    const state = await snapshot(query.rootSessionId)
    if (state === null) return null
    return state.transfers.find((row) => row.currentLegRequestId === query.currentLegRequestId) ?? null
  }

  // The boot root and every created team have distinct frozen Blueprints. Cache
  // one port per request root: the port's own root identity checks stay exact,
  // and a root whose v5 routing cannot be resolved gets no reviewer at all.
  function factsFor(rootSessionId: string): Promise<AssignedOfficerFactsPort | null> {
    const existing = portsByRoot.get(rootSessionId)
    if (existing !== undefined) return existing
    const created = (async () => {
      const parsed = input.routingForRoot === undefined ? input.routing : input.routingForRoot(rootSessionId)
      if (parsed === null) return null
      return createAssignedOfficerFactsPort({
        rootSessionId,
        routing: parsed,
        members: input.members,
        leg,
        transfer,
        ...(input.authorityGeneration === undefined ? {} : { authorityGeneration: input.authorityGeneration }),
        fixedLeaderOrHumanCategory: input.fixedLeaderOrHumanCategory,
      })
    })()
    portsByRoot.set(rootSessionId, created)
    return created
  }

  return {
    currentReviewerForTransfer: async (query) => {
      const facts = await factsFor(query.rootSessionId)
      return facts === null ? null : facts.resolveCurrentReviewer(query)
    },
    reviewCallFactsForAssignedOfficer: async (query) => {
      const facts = await factsFor(query.rootSessionId)
      return facts === null ? null : facts(query)
    },
  }
}
