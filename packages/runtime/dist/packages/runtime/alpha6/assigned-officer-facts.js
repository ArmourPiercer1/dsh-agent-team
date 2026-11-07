/**
 * Read the current generation for the OPERATION OWNER; a faulting read is a
 * refusal. `0` is a LEGAL generation (the durable overlay's initial state for
 * a member that never had an overlay row), not an absence sentinel; absence is
 * `undefined`.
 */
async function resolveGeneration(source, input) {
    if (source === undefined)
        return undefined;
    if (typeof source === 'number')
        return source;
    try {
        return await source(input);
    }
    catch {
        return undefined;
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
export function createAlpha6CategoryLookup() {
    return ({ leg }) => {
        if (leg.kind === 'envelope-mutation')
            return true;
        if (leg.kind === 'user-approval')
            return true;
        if (leg.kind === 'leader-approval')
            return false;
        return null;
    };
}
function nonEmpty(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isGeneration(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
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
function operationOwnerInstanceId(leg) {
    if (leg.subject.kind === 'instance')
        return leg.subject.instanceId;
    return leg.targetInstanceId ?? '';
}
/**
 * Build the composition-owned assigned-Officer facts provider.
 *
 * The returned function answers `null` on ANY missing, stale, cross-team,
 * transferred or mismatched fact; it never falls back to request text, a
 * default routing, or a caller-supplied flag.
 */
export function createAssignedOfficerFactsPort(input) {
    const root = input.rootSessionId;
    const routing = input.routing.routing;
    const blueprint = input.routing.blueprint;
    /**
     * The shared gate both faces of the port use: prove the query/leg/team/
     * transfer/unique-Officer facts. The reviewer is resolved HERE and nowhere
     * else, so the assignment face and the facts face cannot name different
     * people.
     */
    async function resolveAssignedOfficer(query) {
        if (query.rootSessionId !== root)
            return null;
        if (routing.enabled !== true)
            return null;
        let leg;
        try {
            leg = await input.leg(query);
        }
        catch {
            return null;
        }
        if (leg === null || leg === undefined)
            return null;
        // The row must be THIS team's, THIS query's leg, and still pending. A
        // decided/abandoned leg is stale; a different case/ordinal/rung is a
        // forged or overtaken query.
        if (leg.rootSessionId !== root)
            return null;
        if (leg.requestId !== query.currentLegRequestId)
            return null;
        if (leg.approvalCaseId !== query.approvalCaseId)
            return null;
        if (leg.legOrdinal !== query.legOrdinal)
            return null;
        // The assignment port carries no kind/rung; the facts port does. A
        // present query field must agree with the durable row.
        if (query.kind !== undefined && leg.kind !== query.kind)
            return null;
        if (query.reviewAuthority !== undefined && leg.reviewAuthority !== query.reviewAuthority)
            return null;
        if (leg.status !== 'pending')
            return null;
        // The routing may speak for a leg ONLY if it is the very Blueprint the leg
        // was frozen under. A revision/content-hash mismatch is a different policy,
        // and naming a reviewer from it would bind the wrong person to the leg.
        if (!nonEmpty(blueprint.contentHash) || !nonEmpty(blueprint.revision))
            return null;
        if (leg.blueprintContentHash !== blueprint.contentHash)
            return null;
        if (leg.blueprintRevision !== blueprint.revision)
            return null;
        // A transferred leg belongs to the Leader now; the former Officer has no
        // future signing authority (the service refuses this before the evaluator,
        // and the provider refuses it independently).
        let transfer;
        try {
            transfer = await input.transfer(query);
        }
        catch {
            return null;
        }
        if (transfer !== null && transfer !== undefined)
            return null;
        let members;
        try {
            members = await input.members.list(root);
        }
        catch {
            return null;
        }
        const officers = members.filter((member) => member.templateId === routing.officerTemplateId &&
            (member.lifecycle === 'CREATED' || member.lifecycle === 'RUNNING' || member.lifecycle === 'SETTLED') &&
            // The Leader's durable child session IS the team root; it is never the
            // Officer even if a row were forged with the Officer template.
            member.childSessionId !== root &&
            (member.rootSessionId === undefined || member.rootSessionId === root));
        // Zero or multiple live Officers is a refusal, never a choice.
        if (officers.length !== 1)
            return null;
        const officer = officers[0];
        if (officer === undefined)
            return null;
        if (!nonEmpty(officer.instanceId) || !nonEmpty(officer.childSessionId))
            return null;
        return { leg, officer };
    }
    async function resolveCurrentReviewer(query) {
        const resolved = await resolveAssignedOfficer(query);
        return resolved === null ? null : { instanceId: resolved.officer.instanceId };
    }
    async function reviewCallFacts(query) {
        const resolved = await resolveAssignedOfficer(query);
        if (resolved === null)
            return null;
        const { leg } = resolved;
        // The generation is the OPERATION OWNER's, not the Officer's. Resolve the
        // owner from the trusted subject first, then compare THAT member's current
        // generation with the generation PA froze on the leg. The Officer's own
        // generation is irrelevant to the operation's authority facts.
        const ownerInstanceId = operationOwnerInstanceId(leg);
        if (!nonEmpty(ownerInstanceId))
            return null;
        if (!nonEmpty(leg.operationOwnerTemplateId))
            return null;
        const authorityGeneration = await resolveGeneration(input.authorityGeneration, {
            rootSessionId: root,
            operationOwnerInstanceId: ownerInstanceId,
        });
        if (!isGeneration(authorityGeneration))
            return null;
        if (!isGeneration(leg.authorityGeneration))
            return null;
        if (leg.authorityGeneration !== authorityGeneration)
            return null;
        let owner;
        try {
            owner = await input.members.get(root, ownerInstanceId);
        }
        catch {
            return null;
        }
        if (owner === undefined)
            return null;
        if (owner.rootSessionId !== undefined && owner.rootSessionId !== root)
            return null;
        if (owner.instanceId !== ownerInstanceId)
            return null;
        if (owner.lifecycle !== 'RUNNING')
            return null;
        if (owner.templateId !== leg.operationOwnerTemplateId)
            return null;
        // The frozen tool binding must be complete; the evaluator rechecks the
        // owner/name against the ordinary-ask set and Leader exceptions.
        if (!nonEmpty(leg.operationToolDefinitionIdentity))
            return null;
        if (!nonEmpty(leg.operationToolOwner))
            return null;
        if (!nonEmpty(leg.operationToolName))
            return null;
        let fixedLeaderOrHumanCategory;
        try {
            fixedLeaderOrHumanCategory = await input.fixedLeaderOrHumanCategory({
                rootSessionId: root,
                leg,
                routing,
            });
        }
        catch {
            return null;
        }
        if (typeof fixedLeaderOrHumanCategory !== 'boolean')
            return null;
        return {
            reviewRouting: routing,
            fixedLeaderOrHumanCategory,
            // The ladder already answers whether the leg's legal path needs a Human.
            requiresHuman: leg.reviewAuthority === 'human-user',
        };
    }
    return Object.assign(reviewCallFacts, { resolveCurrentReviewer });
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
export function createAlpha6ControlPorts(input) {
    const portsByRoot = new Map();
    async function snapshot(rootSessionId) {
        try {
            return await input.control.readControlState(rootSessionId);
        }
        catch {
            return null;
        }
    }
    const leg = async (query) => {
        const state = await snapshot(query.rootSessionId);
        if (state === null)
            return null;
        return state.requests.find((row) => row.requestId === query.currentLegRequestId) ?? null;
    };
    const transfer = async (query) => {
        const state = await snapshot(query.rootSessionId);
        if (state === null)
            return null;
        return state.transfers.find((row) => row.currentLegRequestId === query.currentLegRequestId) ?? null;
    };
    // The boot root and every created team have distinct frozen Blueprints. Cache
    // one port per request root: the port's own root identity checks stay exact,
    // and a root whose v5 routing cannot be resolved gets no reviewer at all.
    function factsFor(rootSessionId) {
        const existing = portsByRoot.get(rootSessionId);
        if (existing !== undefined)
            return existing;
        const created = (async () => {
            const parsed = input.routingForRoot === undefined ? input.routing : input.routingForRoot(rootSessionId);
            if (parsed === null)
                return null;
            return createAssignedOfficerFactsPort({
                rootSessionId,
                routing: parsed,
                members: input.members,
                leg,
                transfer,
                ...(input.authorityGeneration === undefined ? {} : { authorityGeneration: input.authorityGeneration }),
                fixedLeaderOrHumanCategory: input.fixedLeaderOrHumanCategory,
            });
        })();
        portsByRoot.set(rootSessionId, created);
        return created;
    }
    return {
        currentReviewerForTransfer: async (query) => {
            const facts = await factsFor(query.rootSessionId);
            return facts === null ? null : facts.resolveCurrentReviewer(query);
        },
        reviewCallFactsForAssignedOfficer: async (query) => {
            const facts = await factsFor(query.rootSessionId);
            return facts === null ? null : facts(query);
        },
    };
}
//# sourceMappingURL=assigned-officer-facts.js.map