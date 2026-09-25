/**
 * tests/paths.mjs — SINGLE SOURCE OF TRUTH for test-infrastructure paths.
 *
 * Established by test-infra-standardization (2026-09-12, user-directed):
 * every test consumer (the per-package real-instance harnesses and test
 * files under packages/, tests/characterization, tests/kits, the CI
 * workflow, docs/TEST_METHODS.md) reads the canonical locations from here instead of
 * hardcoding them. Moving the test layout again is a change to this file
 * plus docs/TEST_METHODS.md — not a repo-wide path hunt.
 *
 * Layout (all workspace-relative; DSH_HOME must stay inside the session
 * workspace per the workspace-write sandbox ruling, TEST_METHODS.md §5):
 *
 *   tests/deepseek-harness-test-use/  pristine upstream DSH checkout —
 *       the ONLY permitted runtime source for test instances (its own git
 *       repo, pinned at TEST_USE_BASELINE_SHA, porcelain must stay empty;
 *       gitignored). The frozen legacy reference stays at
 *       references/deepseek-harness (read-only, never a runtime).
 *   tests/homes/<name>/               per-world DSH_HOME dirs (gitignored):
 *       - SHARED persistent home:  .dsh-test        (pre-existing durable
 *         rows preserved, never destroyed — d4/g5 era convention)
 *       - ephemeral worlds:        <line>-<UTC stamp>
 *         e.g. rmr-rev7-20260912T03-00-00Z  (one world per dir; deleted at
 *         teardown unless retained as evidence — see TEST_METHODS.md §7)
 *       - long-lived task homes:   .dsh-test-<task> (e.g. .dsh-test-p8s3;
 *         freshness rules are the harness's own)
 *       - lock files live beside their home: <home>.lock
 *
 * Ports: 3180 family only (3180-3186 / 3491-3500). NEVER 3080 (stable
 * instance — read-only probe at most). Unchanged by this move.
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** Workspace-relative path of the pristine upstream test-use checkout. */
export const TEST_USE_REL = 'tests/deepseek-harness-test-use'

/** Workspace-relative root of all per-world DSH_HOME dirs. */
export const TEST_HOME_ROOT_REL = 'tests/homes'

/**
 * Pinned upstream baseline (0.1.7-rc.1 — the official 0.1.7-rc.1 release
 * point: tag `dsh-v0.1.7-rc.1` on upstream deepseek-ai/deepseek-harness,
 * the `release(dsh): 0.1.7-rc.1` line, PR #5073 merge).
 * `TEST_USE_BASELINE_SHA` is the full commit; `CLIENT_COMMIT_HASH`
 * is the short form consumed by the DSH build orchestrator's
 * DSH_CLIENT_COMMIT_HASH env (skips a git spawn inside the build — keep
 * setting it in restricted environments; it is also the deterministic pin).
 * Baseline history: cd5ef814 (0.1.2-alpha.1, P0-P1 era) → 76fda72979
 * (same rc line, PR #3481 descendant merge — never the checkout point) →
 * a66e470204 (0.1.2-rc.1 checkout point, 2026-09-11 … 2026-09-17) →
 * fb2c4b9e69 (0.1.5-rc.2, 2026-09-17 … 2026-09-24 — user ruling: DSH 0.1.2
 * is no longer supported; the rc2-repair round baseline per
 * docs/plans/active/dsh-agent-team-rc2-repair-plan.md §0.1) →
 * 46a7f68b09 (0.1.7-rc.1, from 2026-09-24 — host upgrade round per
 * docs/plans/active/dsh-agent-team-0.1.7-rc.1-upgrade-plan.md).
 */
export const TEST_USE_BASELINE_SHA = '46a7f68b0922371ce7144b668b90e377d8e799f4'
export const CLIENT_COMMIT_HASH = '46a7f68b09'

/**
 * The nearest ancestor of `start` containing the test-use checkout at its
 * canonical location (the marker that identifies a team-repo root for test
 * purposes). Returns null when no ancestor qualifies.
 */
export function findTestRepoRoot(start) {
  let dir = resolve(start)
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, TEST_USE_REL))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

/** Absolute path of the pristine test-use tree for a resolved repo root. */
export function testUseTree(repoRoot) {
  return join(resolve(repoRoot), TEST_USE_REL)
}

/** Absolute path of the per-world DSH_HOME root for a resolved repo root. */
export function homeRoot(repoRoot) {
  return join(resolve(repoRoot), TEST_HOME_ROOT_REL)
}

/**
 * Absolute path of one DSH_HOME under the homes root. `name` must be a bare
 * basename (the harnesses keep their own validation; this helper refuses
 * traversal by construction).
 */
export function homeDir(repoRoot, name) {
  if (typeof name !== 'string' || name.length === 0 || name.includes('/') || name.includes('\\') || name === '..' || name === '.') {
    throw new Error(`homeDir: invalid home name: ${JSON.stringify(name)}`)
  }
  return join(homeRoot(repoRoot), name)
}
