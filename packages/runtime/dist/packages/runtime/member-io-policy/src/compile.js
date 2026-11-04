/**
 * Alpha.5 P1-02 — the MemberPolicy / EffectiveIo compiler.
 *
 * WHAT THIS MODULE IS: the ONE place where the two authoring facts (the v4
 * Member ceiling, P1-01, and the v4 per-tool I/O restriction) become the
 * single per-invocation hard ceiling the FS / Web / Subprocess consumers
 * obey. It is PURE: no I/O, no clock, no mutation of its inputs, no re-reading
 * of Alpha.4 approval state (that arrives as `Alpha4EffectiveAuthority`).
 *
 * WHAT IT IS NOT: it never GRANTS anything. `ask`, a one-shot approval or an
 * `approvedOnce: true` invocation can only live INSIDE the compiled ceiling;
 * nothing here can widen a ceiling. A ceiling change is a different operation
 * (an explicitly authorized policy revision producing a new `revision`).
 *
 * FAIL-CLOSED LAWS (all machine-checked by `test/a5sf-member-policy.test.ts`):
 *  - an undeclared Member ceiling compiles to a TYPED REFUSAL, never to a
 *    synthesized `read: all` (absence is not permission);
 *  - `network: restricted` is UNSUPPORTED this round, never coerced;
 *  - a stale instance generation / mismatched policy revision / mismatched
 *    member identity / tool binding is refused, never "repaired";
 *  - read and write are INDEPENDENT: a write-only grant never implies read.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/compile
 */
import { createHash } from 'node:crypto';
import { findMemberIoCeiling } from '../../../domain/blueprint/src/index.js';
import { declareV4AuthoringMaps, projectV4MemberIoCeiling, projectV4ToolBindingAuthoring } from '../../../domain/vnext-field-mapping/src/index.js';
import { intersectPathRuleSets } from './path-rules.js';
/** The one shipped declaration set (declaration is deterministic and pure). */
const AUTHORING_MAPS = (() => {
    const declared = declareV4AuthoringMaps();
    if (!declared.ok)
        throw new Error(`v4 authoring tables refused: ${declared.detail}`);
    return declared.maps;
})();
function refuse(code, detail, path) {
    return { ok: false, code, detail, path };
}
function freezeRuleSet(rules) {
    return Object.freeze({
        mode: rules.mode,
        allow: Object.freeze([...rules.allow]),
        ask: Object.freeze([...rules.ask]),
        deny: Object.freeze([...rules.deny]),
    });
}
/** Deterministic JSON: object keys sorted, arrays kept in authored order. */
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
    if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}
/** Stable, content-addressed policy revision (changes iff any input changes). */
function derivePolicyRevision(material) {
    return `a5sf1:${createHash('sha256').update(canonicalJson(material)).digest('hex').slice(0, 32)}`;
}
function laneFromProjected(projected) {
    const list = (key) => {
        const value = projected[key];
        return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
    };
    return freezeRuleSet({
        mode: projected['mode'] === 'all' ? 'all' : 'restricted',
        allow: list('allow'),
        ask: list('ask'),
        deny: list('deny'),
    });
}
/**
 * Compile the LEFT factor: one trusted Member → its hard I/O ceiling.
 *
 * The trusted input is consumed, never derived: no field of the ceiling can
 * be inferred from a tool owner, an argv value, a cwd string or a UI label.
 */
export function compileMemberPolicy(input) {
    const member = input.trustedMember;
    if (typeof member.teamId !== 'string' || member.teamId.trim() === '' ||
        typeof member.memberInstanceId !== 'string' || member.memberInstanceId.trim() === '' ||
        typeof member.templateId !== 'string' || member.templateId.trim() === '') {
        return refuse('MEMBER_IDENTITY_UNTRUSTED', 'a Member ceiling compiles only from a complete trusted TeamDomain identity (teamId / memberInstanceId / templateId)', 'trustedMember');
    }
    if (member.teamId !== input.boundBlueprint.teamId) {
        return refuse('TEAM_MISMATCH', `member '${member.memberInstanceId}' belongs to team '${member.teamId}', but the bound blueprint is team '${input.boundBlueprint.teamId}'`, 'trustedMember.teamId');
    }
    const authority = input.effectiveAuthority;
    if (authority.memberInstanceId !== member.memberInstanceId) {
        return refuse('MEMBER_IDENTITY_UNTRUSTED', 'Alpha.4 effective authority was computed for a DIFFERENT member instance; the compiler never substitutes identity', 'effectiveAuthority.memberInstanceId');
    }
    if (authority.instanceGeneration !== member.instanceGeneration) {
        return refuse('MEMBER_GENERATION_STALE', `Alpha.4 authority generation ${String(authority.instanceGeneration)} does not match the member generation ${String(member.instanceGeneration)}`, 'effectiveAuthority.instanceGeneration');
    }
    if (!authority.admitted) {
        return refuse('AUTHORITY_REFUSED', 'Alpha.4 does not admit this member; no I/O policy is compiled for a non-admitted member', 'effectiveAuthority.admitted');
    }
    const blueprint = input.boundBlueprint.blueprint;
    const templates = new Set([blueprint.leader.templateId, ...blueprint.members.map((entry) => entry.templateId)]);
    if (!templates.has(member.templateId)) {
        return refuse('MEMBER_TEMPLATE_UNKNOWN', `template '${member.templateId}' is not declared by blueprint '${blueprint.blueprintId}'; a Member ceiling cannot bind an undeclared template`, 'trustedMember.templateId');
    }
    const ceiling = findMemberIoCeiling(blueprint, member.templateId);
    if (ceiling === null) {
        // Absence is NOT permission and NOT a deny-all floor either: there is no
        // policy to compile, so the managed path refuses this member instead of
        // inventing an upper bound.
        return refuse('MEMBER_CEILING_UNDECLARED', `template '${member.templateId}' declares no Member ceiling; absence never compiles to an unrestricted policy`, 'boundBlueprint.blueprint.memberIoCeilings');
    }
    const projected = projectV4MemberIoCeiling(AUTHORING_MAPS, ceiling);
    if (!projected.ok) {
        return refuse('IO_POLICY_UNSUPPORTED', `the Member ceiling could not be projected: ${projected.detail}`, 'boundBlueprint.blueprint.memberIoCeilings');
    }
    const ceilingProjection = projected.value;
    if (ceilingProjection.networkCeiling.kind !== 'boolean') {
        return refuse('IO_POLICY_UNSUPPORTED', 'the Member ceiling requests a destination-restricted network lane; this round commits the network BOOLEAN only and never coerces restricted into allow/deny', 'boundBlueprint.blueprint.memberIoCeilings.network');
    }
    const read = laneFromProjected(ceilingProjection.io.read);
    const write = laneFromProjected(ceilingProjection.io.write);
    const network = Object.freeze({ access: ceilingProjection.networkCeiling.access });
    const revision = derivePolicyRevision({
        schema: 'a5sf-member-policy/1',
        teamId: member.teamId,
        memberInstanceId: member.memberInstanceId,
        templateId: member.templateId,
        instanceGeneration: member.instanceGeneration,
        blueprintContentHash: blueprint.contentHash,
        authorityRevision: authority.revision,
        read,
        write,
        network,
    });
    return {
        ok: true,
        value: Object.freeze({
            memberIdentity: member.memberInstanceId,
            templateId: member.templateId,
            instanceGeneration: member.instanceGeneration,
            revision,
            read,
            write,
            network,
        }),
    };
}
/** Intersect one Member lane with one tool lane (the RIGHT factor). */
function intersectLane(member, tool) {
    if (tool === 'no-additional-narrowing')
        return freezeRuleSet(member);
    return intersectPathRuleSets(member, tool);
}
/**
 * Compile the per-invocation policy:
 *   EffectiveIo ⊆ MemberCeiling(member) ∩ ToolRestriction(member, tool).
 *
 * The invocation is BOUND, not trusted loosely: a call minted for another
 * member, another policy revision or another tool binding is refused.
 */
export function compileEffectiveIo(member, tool, invocation) {
    if (invocation.memberIdentity !== member.memberIdentity) {
        return refuse('INVOCATION_MISMATCH', `invocation '${invocation.callId}' was minted for '${invocation.memberIdentity}', not '${member.memberIdentity}'`, 'invocation.memberIdentity');
    }
    if (invocation.policyRevision !== member.revision) {
        return refuse('STALE_POLICY_REVISION', `invocation '${invocation.callId}' carries revision '${invocation.policyRevision}', but the member policy is '${member.revision}'; a stale invocation is never upgraded in place`, 'invocation.policyRevision');
    }
    if (invocation.toolBindingIdentity !== tool.bindingIdentity) {
        return refuse('INVOCATION_MISMATCH', `invocation '${invocation.callId}' is bound to tool '${invocation.toolBindingIdentity}', not '${tool.bindingIdentity}'`, 'invocation.toolBindingIdentity');
    }
    if (tool.network === 'unsupported') {
        return refuse('TOOL_NETWORK_UNSUPPORTED', `tool '${tool.bindingIdentity}' declares a network restriction this round cannot enforce`, 'tool.network');
    }
    const read = intersectLane(member.read, tool.read);
    const write = intersectLane(member.write, tool.write);
    const network = Object.freeze({
        access: member.network.access === 'allow' && tool.network === 'allow' ? 'allow' : 'deny',
    });
    return {
        ok: true,
        value: Object.freeze({
            memberIdentity: member.memberIdentity,
            toolBindingIdentity: tool.bindingIdentity,
            invocationId: invocation.callId,
            policyRevision: member.revision,
            read,
            write,
            network,
        }),
    };
}
/**
 * Project one v4 tool binding into the RIGHT factor of the two-axis policy.
 * `mode: all` becomes `'no-additional-narrowing'` — it declares no path, so
 * it cannot widen anything; a `restricted` network lane becomes the typed
 * `'unsupported'` this round, never a boolean guess.
 */
export function projectToolIoRestriction(binding) {
    const projected = projectV4ToolBindingAuthoring(AUTHORING_MAPS, binding);
    if (!projected.ok) {
        return refuse('IO_POLICY_UNSUPPORTED', `the tool binding could not be projected: ${projected.detail}`, 'toolBindings');
    }
    const value = projected.value;
    const io = value['io'];
    const laneValue = (axis) => {
        const lane = io[axis];
        if (lane['mode'] === 'all')
            return 'no-additional-narrowing';
        return laneFromProjected(lane);
    };
    const networkLane = io['network'];
    const networkMode = networkLane['mode'];
    const owner = String(value['authoringOwner'] ?? '');
    const name = String(value['toolName'] ?? '');
    if (owner === '' || name === '') {
        return refuse('IO_POLICY_UNSUPPORTED', 'a projected tool binding must carry its authoring owner and tool name', 'toolBindings');
    }
    return {
        ok: true,
        value: Object.freeze({
            bindingIdentity: `${owner}/${name}`,
            read: laneValue('read'),
            write: laneValue('write'),
            network: networkMode === 'allow' || networkMode === 'deny' ? networkMode : 'unsupported',
        }),
    };
}
//# sourceMappingURL=compile.js.map