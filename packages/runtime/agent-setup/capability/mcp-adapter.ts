/**
 * MCP adapter — filter and mount MCP servers according to Team policy (T3 /
 * plan §9).
 *
 * Two functions:
 *
 * - {@link filterMcpServers} — filter configured server names against the
 *   policy entry's allow-list or deny;
 * - {@link mountAllowedMcpServers} — mount the allowed servers through the
 *   Agent context's plugin seam, returning a composite disposer.
 *
 * Semantics:
 *
 * - `mcp allow(items)` → configured ∩ items (only servers that are BOTH
 *   configured AND explicitly allowed);
 * - `mcp deny` → empty (no mount);
 * - Unknown / unconfigured servers in the allow-list are silently ignored
 *   (they simply won't be in the configured set).
 *
 * Pure module: no I/O, no ambient state.
 * @module @dsh-agent-team/runtime/agent-setup/capability/mcp-adapter
 */

import type { PolicyEntry } from '../../../domain/policy/src/index.js'

/** Disposer for an MCP server mount. */
export interface McpMountDisposer {
  dispose(): void
}

/**
 * Minimal Agent context shape the adapter needs for MCP plugin mounting.
 */
export interface McpAgentContext {
  plugin(name: string, config: unknown): McpMountDisposer
}

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
export function filterMcpServers(
  configuredServers: readonly string[],
  policy: PolicyEntry,
): string[] {
  if (policy.kind !== 'allow') {
    return []
  }
  const allowed = new Set(policy.items)
  const result: string[] = []
  for (const server of configuredServers) {
    if (allowed.has(server) && !result.includes(server)) {
      result.push(server)
    }
  }
  return result
}

/**
 * Mount the allowed MCP servers through the Agent's plugin seam.
 *
 * For each allowed server name, looks up its configuration in
 * `mcpConfig` (keyed by server name) and mounts it via
 * `agentCtx.plugin(serverName, config)`.
 *
 * @param agentCtx - the Agent context providing the plugin mounting seam.
 * @param allowedServers - the allowed server names (output of
 *   {@link filterMcpServers}).
 * @param mcpConfig - a record mapping server name → its mount configuration.
 * @returns a composite disposer that unmounts every server this call
 *   mounted. Idempotent.
 */
export function mountAllowedMcpServers(
  agentCtx: McpAgentContext,
  allowedServers: string[],
  mcpConfig: Record<string, unknown>,
): McpMountDisposer {
  const disposers: McpMountDisposer[] = []

  for (const serverName of allowedServers) {
    const config = mcpConfig[serverName]
    if (config === undefined) {
      continue
    }
    try {
      const disposer = agentCtx.plugin(serverName, config)
      disposers.push(disposer)
    } catch {
      // Mount failed for one server: skip and continue.
    }
  }

  return {
    dispose(): void {
      for (const d of disposers) {
        try {
          d.dispose()
        } catch {
          // Dispose errors are non-fatal (best-effort cleanup).
        }
      }
    },
  }
}
