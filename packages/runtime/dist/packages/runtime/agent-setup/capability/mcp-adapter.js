/**
 * MCP adapter — filter MCP servers according to Team policy (T3 / plan §9).
 *
 * One function:
 *
 * - {@link filterMcpServers} — filter configured server names against the
 *   policy entry's allow-list or deny.
 *
 * Semantics:
 *
 * - `mcp allow(items)` → configured ∩ items (only servers that are BOTH
 *   configured AND explicitly allowed);
 * - `mcp deny` → empty (no mount);
 * - Unknown / unconfigured servers in the allow-list are silently ignored
 *   (they simply won't be in the configured set).
 *
 * The production mount path is the live glue's `reconcileMcp` (the real
 * `agentCtx.plugin(mcpClient, config)` public seam). The former
 * `mountAllowedMcpServers` helper — which faked an
 * `agentCtx.plugin(serverName, config)` signature that is not a real public
 * seam and was never on the production path — was removed in the alpha.1
 * hardening (P2.1).
 *
 * Pure module: no I/O, no ambient state.
 * @module @dsh-agent-team/runtime/agent-setup/capability/mcp-adapter
 */
import { MCP_FACET_WILDCARD } from './mcp-facet.js';
/**
 * Filter configured MCP server names against the policy entry.
 *
 * - `allow(items)` → returns configured servers whose name appears in
 *   `items`, OR every configured server when `items` contains the
 *   `MCP_FACET_WILDCARD` (`*`) (allow-all — the SAME wildcard the durable
 *   mcp facet view honors, closing the template-vs-facet asymmetry where a
 *   `mcp: allow ['*']` template would have silently excluded every server
 *   while the facet view allowed them);
 * - `deny` → returns `[]` (no servers allowed).
 *
 * @param configuredServers - the servers the host has configured (available
 *   to mount).
 * @param policy - the resolved policy entry for the `mcp` capability cell.
 * @returns the allowed subset of configured servers.
 */
export function filterMcpServers(configuredServers, policy) {
    if (policy.kind !== 'allow') {
        return [];
    }
    const allowed = new Set(policy.items);
    // The wildcard: `allow ['*']` mounts every configured server (matching the
    // facet view's `items.includes(MCP_FACET_WILDCARD)` — the template gate
    // previously had no wildcard branch, so a wildcard template excluded all).
    const allowAll = allowed.has(MCP_FACET_WILDCARD);
    const result = [];
    for (const server of configuredServers) {
        if ((allowAll || allowed.has(server)) && !result.includes(server)) {
            result.push(server);
        }
    }
    return result;
}
//# sourceMappingURL=mcp-adapter.js.map