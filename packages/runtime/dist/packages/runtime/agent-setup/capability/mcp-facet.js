/**
 * P8-S4B — the Team-durable CONSUMPTION of the MCP facet: the bridge from
 * the durable governance overrides (backend truth) to the actual MCP
 * mount decision of one live Agent (DevPlan P8-S §18.1/§18.2: the
 * capability must-close — "allowed -> durable tighten/deny -> next actual
 * operation blocked/absent; restart remains effective").
 *
 * This module owns the `mcp` capability cell's consumer rule (the facet
 * chosen by the S4B ruling — G2-characterized over the public DSH
 * `agentCtx.plugin` MCP seam, streamable-http):
 *
 * - the MCP server is mounted for an agent ONLY when the frozen effective
 *   policy's `mcp` cell is `allow` AND the allow-list names the server
 *   (or `*` for all servers);
 * - EVERY other outcome — `unspecified` (Team never granted the cell),
 *   explicit `deny` (any layer), external capability absence / hard deny /
 *   removed-all — is fail-closed: NO mount, and the deny is surfaced via
 *   the §18.3 provenance, never silently allowed;
 * - the decision re-reads the durable overrides at every boundary, so a
 *   durable tighten/deny takes effect at the NEXT operation and survives
 *   a host restart (same durable truth -> same decision).
 *
 * Pure module: no I/O, no live Agent, no ambient state.
 *
 * @module @dsh-agent-team/runtime/agent-setup/capability/mcp-facet
 */
import { resolveActivationPolicy } from '../../activation/index.js';
import { cellProvenance, } from '../../mutation/cell-provenance.js';
/** The allow-list wildcard naming every MCP server. */
export const MCP_FACET_WILDCARD = '*';
/**
 * Decide the MCP mount for one server from the frozen effective policy.
 * Pure and deterministic; fail-closed (never mounts without an explicit
 * Team allow naming the server or `*`).
 * @param policy - the frozen effective policy of the member.
 * @param serverName - the MCP server name to test.
 * @param options - the durable records + the session's applied record ids.
 * @returns the facet view (lossless-JSON).
 */
export function mcpFacetView(policy, serverName, options = {}) {
    const provenance = cellProvenance(policy, 'mcp', options);
    let allowed = false;
    if (provenance.effective.kind === 'allow' && !provenance.unavailable && serverName.length > 0) {
        const items = provenance.effective.items;
        allowed = items.includes(MCP_FACET_WILDCARD) || items.includes(serverName);
    }
    return {
        serverName,
        allowed,
        source: provenance.source,
        suppressed: provenance.suppressed,
        unavailable: provenance.unavailable,
        deniedBy: provenance.deniedBy,
        pendingNextBoundary: provenance.pendingNextBoundary,
        explanation: provenance.explanation,
    };
}
/**
 * Re-read the durable overrides and re-decide the MCP mount at one
 * boundary. This is the durable-mutation -> actual-Agent-behavior edge
 * for the capability facet: a durable allow/deny takes effect on the next
 * actual operation and survives a host restart.
 *
 * @param args - the boundary inputs.
 * @returns the frozen policy + the MCP facet view.
 * @throws {@link import('../../activation/index.js').ActivationError}
 *   `ACTIVATION_POLICY_RESOLUTION_FAILED` when the stored payload is
 *   malformed (fail closed).
 */
export function resolveDurableMcpFacet(args) {
    const { rootSessionId, instanceId, overrides, external, serverName, appliedRecordIds } = args;
    const policy = resolveActivationPolicy({ rootSessionId, instanceId, overrides, external });
    const refs = overrides.map((record) => ({
        recordId: record.recordId,
        kind: record.kind,
        scope: record.scope,
        generation: record.generation,
        updatedAt: record.updatedAt,
        values: record.values,
    }));
    const view = mcpFacetView(policy, serverName, {
        overrides: refs,
        ...(appliedRecordIds !== undefined ? { appliedRecordIds } : {}),
    });
    return { policy, view };
}
//# sourceMappingURL=mcp-facet.js.map