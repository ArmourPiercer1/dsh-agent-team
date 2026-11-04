/**
 * Alpha.6 — the ROOT-side assembly of the trusted review facts plane.
 *
 * One pure factory joins the pieces the Host already owns:
 *  - the bound Blueprint SOURCE parsed ONCE (v5 only; a v4/invalid document is
 *    `refused`, never a silent legacy fallback);
 *  - the fail-closed composition decision (exactly one live Officer);
 *  - the durable reader + member rows;
 *  - the durable permission-overlay generation for the RESOLVED reviewer;
 *  - the closed control-kind category classifier.
 *
 * It returns the two ControlService ports and NOTHING else: no notifier swap,
 * no wake delivery, no root mutation. A caller that wants Alpha.6 must pass the
 * result into `createControlService` explicitly; an absent/refused result keeps
 * the Alpha.5 path byte-identical.
 *
 * @module packages/runtime/alpha6/root-composition
 */
import { createAlpha6ControlPorts, createAlpha6CategoryLookup, } from './assigned-officer-facts.js';
import { createAlpha6AuthorityGenerationReader } from './authority-generation.js';
import { decideAlpha6Composition, parseAlpha6Routing } from './composition.js';
/**
 * Assemble the trusted ports. Any missing fact refuses; this function NEVER
 * invents an Officer, a generation, a category or a routing.
 */
export function createAlpha6RootComposition(input) {
    if (input.enabled !== true)
        return { mode: 'legacy', reason: 'disabled' };
    const parsed = parseAlpha6Routing(input.blueprintSource);
    if (parsed === null)
        return { mode: 'refused', refused: 'blueprint-not-v5' };
    const decision = decideAlpha6Composition({
        enabled: true,
        blueprintDocumentVersion: parsed.blueprint.schemaVersion,
        reviewRouting: {
            enabled: parsed.routing.enabled,
            officerTemplateId: parsed.routing.officerTemplateId,
        },
        activeMemberTemplateIds: input.members
            .filter((member) => member.lifecycle === 'RUNNING')
            .map((member) => member.templateId),
        leaderTemplateId: input.leaderTemplateId,
    });
    if (decision.mode !== 'alpha6')
        return decision;
    const officer = input.members.find((member) => member.lifecycle === 'RUNNING' && member.templateId === decision.officerTemplateId);
    if (officer === undefined)
        return { mode: 'refused', refused: 'officer-instance-count' };
    const byId = new Map(input.members.map((member) => [member.instanceId, member]));
    const generation = createAlpha6AuthorityGenerationReader(input.permissionOverlay);
    const ports = createAlpha6ControlPorts({
        rootSessionId: input.rootSessionId,
        routing: parsed,
        control: {
            readControlState: async (rootSessionId) => (await input.control.readControlState(rootSessionId)),
        },
        members: {
            get: (rootSessionId, instanceId) => {
                if (rootSessionId !== input.rootSessionId)
                    return undefined;
                return byId.get(instanceId);
            },
            list: (rootSessionId) => rootSessionId === input.rootSessionId ? [...byId.values()] : [],
        },
        authorityGeneration: async ({ rootSessionId, operationOwnerInstanceId }) => generation({ teamSessionId: rootSessionId, memberInstanceId: operationOwnerInstanceId }),
        fixedLeaderOrHumanCategory: createAlpha6CategoryLookup(),
    });
    return { mode: 'alpha6', ports, officerInstanceId: officer.instanceId };
}
export function createAlpha6RootWiring(enabled, live) {
    if (enabled !== true)
        return { mode: 'legacy' };
    const composition = createAlpha6LiveRootComposition({ ...live(), enabled: true });
    if (composition.mode === 'alpha6')
        return composition;
    if (composition.mode === 'refused')
        return { mode: 'refused', refused: composition.refused };
    // Unreachable: the live composition cannot answer `legacy` when enabled.
    // Throwing (never `legacy`) keeps the fail-closed direction even if a
    // future edit breaks that invariant.
    throw new Error('internal invariant broken: enabled Alpha.6 root wiring composed the legacy mode');
}
export function createAlpha6LiveRootComposition(input) {
    if (input.enabled !== true)
        return { mode: 'legacy', reason: 'disabled' };
    const parsed = parseAlpha6Routing(input.blueprintSource);
    if (parsed === null)
        return { mode: 'refused', refused: 'blueprint-not-v5' };
    // Reuse the ONE static decision for the policy face. The member count is not
    // a construction fact here; the facts port applies the unique-Officer law on
    // every query, so the probe list only satisfies the signature.
    const decision = decideAlpha6Composition({
        enabled: true,
        blueprintDocumentVersion: parsed.blueprint.schemaVersion,
        reviewRouting: {
            enabled: parsed.routing.enabled,
            officerTemplateId: parsed.routing.officerTemplateId,
        },
        activeMemberTemplateIds: [parsed.routing.officerTemplateId],
        leaderTemplateId: input.leaderTemplateId,
    });
    if (decision.mode !== 'alpha6')
        return decision;
    const generation = createAlpha6AuthorityGenerationReader(input.permissionOverlay);
    const ports = createAlpha6ControlPorts({
        rootSessionId: input.rootSessionId,
        routing: parsed,
        control: {
            readControlState: async (rootSessionId) => (await input.control.readControlState(rootSessionId)),
        },
        members: {
            get: (rootSessionId, instanceId) => rootSessionId === input.rootSessionId ? input.members.get(rootSessionId, instanceId) : undefined,
            list: (rootSessionId) => rootSessionId === input.rootSessionId ? input.members.list(rootSessionId) : [],
        },
        authorityGeneration: async ({ rootSessionId, operationOwnerInstanceId }) => generation({ teamSessionId: rootSessionId, memberInstanceId: operationOwnerInstanceId }),
        fixedLeaderOrHumanCategory: createAlpha6CategoryLookup(),
    });
    return { mode: 'alpha6', ports, officerTemplateId: parsed.routing.officerTemplateId };
}
//# sourceMappingURL=root-composition.js.map