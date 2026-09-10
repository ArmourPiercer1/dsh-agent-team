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
export interface ToolRestrictionDisposer {
    dispose(): void;
}
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
export declare function applyBuiltInToolDeny(agentCtx: {
    tools: {
        restrict: (opts: {
            deny: string[];
        }) => void;
    };
}, deniedNames: readonly string[]): ToolRestrictionDisposer;
//# sourceMappingURL=builtin-deny.d.ts.map