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
    // Empty deny → no-op (zero calls to restrict)
    if (uniqueDenied.length === 0) {
        return { dispose: () => { } };
    }
    // P0-2 (hardening §4): the public seam is `restrict(filter): () => void` —
    // the RETURNED function is the exact disposer that lifts this restriction.
    // CAPTURE it (the previous adapter modeled the seam as returning void and
    // returned a no-op disposer, so the restriction was never explicitly
    // unwound). dispose() invokes the captured upstream disposer EXACTLY ONCE
    // (idempotent); a double dispose is a no-op. If the live close already
    // best-effort-catches disposer exceptions, the adapter does not re-swallow.
    const lift = agentCtx.tools.restrict({ deny: uniqueDenied });
    let disposed = false;
    return {
        dispose() {
            if (disposed)
                return;
            disposed = true;
            lift();
        },
    };
}
//# sourceMappingURL=builtin-deny.js.map