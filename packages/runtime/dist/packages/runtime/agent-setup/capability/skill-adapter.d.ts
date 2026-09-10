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
import type { PolicyEntry } from '../../../domain/policy/src/index.js';
import type { TeamSkillCatalog, TeamSkillDefinition } from './skill-catalog.js';
/** Disposer for a single skill registration. */
export interface SkillRegistrationDisposer {
    dispose(): void;
}
/**
 * Minimal Agent context shape the adapter needs for skill registration.
 *
 * The adapter calls `agentCtx.get('skills')` to obtain the skill seam,
 * then calls `seam.register(def)` for each allowed skill definition.
 * Each call returns a disposer.
 */
export interface SkillAgentContext {
    get(key: string): {
        register(def: TeamSkillDefinition): SkillRegistrationDisposer;
    } | undefined;
}
/** Optional diagnostic callback for skipped skills. */
export interface SkillAdapterDiagnostics {
    onSkip?(id: string, reason: string): void;
}
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
export declare function registerTeamSkills(agentCtx: SkillAgentContext, catalog: TeamSkillCatalog, policy: PolicyEntry, diagnostics?: SkillAdapterDiagnostics): SkillRegistrationDisposer;
//# sourceMappingURL=skill-adapter.d.ts.map