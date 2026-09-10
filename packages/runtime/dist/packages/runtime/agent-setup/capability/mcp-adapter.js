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
/**
 * Filter configured MCP server names against the policy entry.
 *
 * - `allow(items)` → returns configured servers whose name appears in
 *   `items`;
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
    const result = [];
    for (const server of configuredServers) {
        if (allowed.has(server) && !result.includes(server)) {
            result.push(server);
        }
    }
    return result;
}
//# sourceMappingURL=mcp-adapter.js.map