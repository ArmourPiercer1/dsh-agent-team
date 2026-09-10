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

import type { PolicyEntry } from '../../../domain/policy/src/index.js'
import type { TeamSkillCatalog, TeamSkillDefinition } from './skill-catalog.js'

/** Disposer for a single skill registration. */
export interface SkillRegistrationDisposer {
  dispose(): void
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
    register(def: TeamSkillDefinition): SkillRegistrationDisposer
  } | undefined
}

/** Optional diagnostic callback for skipped skills. */
export interface SkillAdapterDiagnostics {
  onSkip?(id: string, reason: string): void
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
export function registerTeamSkills(
  agentCtx: SkillAgentContext,
  catalog: TeamSkillCatalog,
  policy: PolicyEntry,
  diagnostics?: SkillAdapterDiagnostics,
): SkillRegistrationDisposer {
  const disposers: SkillRegistrationDisposer[] = []

  if (policy.kind !== 'allow') {
    return { dispose: () => {} }
  }

  // P2.2 (hardening §7.2): unified skill diagnostics — the stable reason
  // vocabulary (not-in-catalog / skills-seam-missing / register-failed).
  // Diagnostics only: they never change the fail-closed behavior (a missing
  // seam or a failed registration is still a no-op for that skill, the agent
  // never crashes).
  const seam = agentCtx.get('skills')
  if (!seam) {
    diagnostics?.onSkip?.('(seam)', 'skills-seam-missing')
    return { dispose: () => {} }
  }

  for (const skillId of policy.items) {
    const def = catalog.get(skillId)
    if (def === undefined) {
      diagnostics?.onSkip?.(skillId, 'not-in-catalog')
      continue
    }
    try {
      // P2.3 (hardening, found by the live closure smoke): the registry's
      // load-time validation (validateDefinition) requires `source` to be a
      // string — register() defaults invocation and provider but NOT source,
      // so a def registered without one is storable yet unloadable (the live
      // `skill` tool load failed with "loaded skill X source must be a
      // string"). Team skills are runtime contributions from the row config
      // -> the 'runtime' source bucket; a catalog-provided source wins.
      const disposer = seam.register({ ...def, source: def.source ?? 'runtime' })
      disposers.push(disposer)
    } catch {
      // Registration failed for one skill: diagnose + skip and continue
      // with the others.
      diagnostics?.onSkip?.(skillId, 'register-failed')
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
