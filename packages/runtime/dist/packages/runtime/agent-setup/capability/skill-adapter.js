/**
 * Skill adapter — register Team-managed skills with the Agent scope (T3 /
 * plan §8.1).
 *
 * Bridges the policy-resolved skill allow-list to the Agent's skill
 * registration seam:
 *
 * - `skills allow(items)` → catalog lookup → register found definitions
 *   in Agent scope;
 * - `skills deny` → register none;
 * - Unknown skill id → skip silently (never crashes the Agent).
 *
 * Returns a composite disposer that removes every scoped registration.
 *
 * Pure module: no I/O, no ambient state.
 * @module @dsh-agent-team/runtime/agent-setup/capability/skill-adapter
 */
/**
 * Register Team-managed skills with the Agent scope according to the
 * policy entry and catalog.
 *
 * @param agentCtx - the Agent context providing the skill registration seam.
 * @param catalog - the team skill catalog (reads definitions from plugin
 *   config or equivalent narrow input).
 * @param policy - the resolved policy entry for the `skills` capability
 *   cell.
 * @param diagnostics - optional diagnostic callback for skipped skills.
 * @returns a composite disposer that removes every registration created
 *   by this call. Calling `dispose()` on the composite is idempotent.
 */
export function registerTeamSkills(agentCtx, catalog, policy, diagnostics) {
    const disposers = [];
    if (policy.kind !== 'allow') {
        return { dispose: () => { } };
    }
    const seam = agentCtx.get('skills');
    if (!seam) {
        return { dispose: () => { } };
    }
    for (const skillId of policy.items) {
        const def = catalog.get(skillId);
        if (def === undefined) {
            diagnostics?.onSkip?.(skillId, 'not-in-catalog');
            continue;
        }
        try {
            const disposer = seam.register(def);
            disposers.push(disposer);
        }
        catch {
            // Registration failed for one skill: skip and continue with others.
        }
    }
    return {
        dispose() {
            for (const d of disposers) {
                try {
                    d.dispose();
                }
                catch {
                    // Dispose errors are non-fatal (best-effort cleanup).
                }
            }
        },
    };
}
//# sourceMappingURL=skill-adapter.js.map