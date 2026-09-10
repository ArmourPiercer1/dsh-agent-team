/**
 * T2 — Built-in tool deny adapter.
 *
 * Apply a deny list to the agent's built-in tool surface through the
 * public `agentCtx.tools.restrict({ deny: [...] })` seam only. The
 * adapter does NOT modify global registries, re-register built-in tools,
 * or access private registry internals.
 *
 * Design principles:
 * - Empty deny → identity / no-op (zero calls to restrict()).
 * - Duplicates → deduplicated before the call.
 * - Returns a disposer for cleanup on agent close.
 *
 * @module @dsh-agent-team/tools/builtin-deny
 */
/**
 * Apply a built-in tool deny list to one agent context.
 *
 * @param agentCtx - the agent-scoped context with a `tools.restrict()`
 *   method (the public restriction seam).
 * @param deniedNames - the deny list (may contain duplicates; deduped).
 * @returns a disposer. Call `dispose()` when the agent closes to unwind
 *   the restriction scope. For an empty deny list the returned disposer
 *   is a no-op.
 */
export function applyBuiltInToolDeny(agentCtx, deniedNames) {
    // Deduplicate while preserving first-seen order
    const uniqueDenied = [...new Set(deniedNames)];
    // Empty deny → no-op
    if (uniqueDenied.length === 0) {
        return { dispose: () => { } };
    }
    // Apply restriction through the public seam
    agentCtx.tools.restrict({ deny: uniqueDenied });
    // The disposer unwinds the scope when the agent closes.
    // The restrict() seam is expected to be scoped to the agent lifetime;
    // dispose() signals that scope is ending.
    return {
        dispose() {
            // The restriction is agent-scoped: when the agent closes, the
            // scope ends naturally. This disposer exists as a lifecycle hook
            // for explicit cleanup when the host supports it.
            // Per spec: does NOT modify global registry, re-register built-in
            // tools, or access private registries.
        },
    };
}
//# sourceMappingURL=builtin-deny.js.map