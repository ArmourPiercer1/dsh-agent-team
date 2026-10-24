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
import { dirname, isAbsolute, join, resolve } from 'node:path'

/**
 * Pristine upstream test-use checkout: repo-root-relative by default (the
 * canonical per-worktree location, gitignored), or the absolute path
 * `DSH_TEST_USE_ROOT` names.
 *
 * ROOT 02:04 HANDLING + 02:3x AMENDMENT (G5 lane, no Host) — both facts
 * stand together; the lane does not delete anything and the default shape
 * is unchanged:
 *
 * (02:04) This g5 worktree carries a nested `tests/deepseek-harness-test-use`
 * created at 01:42 by a `clone --shared` from the INT worktree's tree instead
 * of the read-only shared baseline, with generated `lib/` outputs rsynced in
 * and an offline install run against it — a violation of the zero-copy order
 * in force at that moment. It is NOT removed, NOT permission-changed and NOT
 * tidied (root/a356 rule its scope), and until that ruling lands the
 * default repo-relative shape below still resolves to it in this worktree.
 *
 * (02:3x) The migration of the LANE'S Host-test-runtime references to the
 * pre-existing, 639-pin-consistent READ-ONLY BASE
 * `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use`
 * (measured HEAD `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain 0,
 * `node_modules` present) is supplied by THE LANE'S OWN ENTRY, not by a
 * committed default: `packages/runtime/test/a5m2-g5-lane-entry.mjs` sets
 * `DSH_TEST_USE_ROOT` to that base and runs the lane's three specs through
 * it. `paths.mjs` hardcodes no absolute path; this constant's default is
 * byte-identical to the pre-amendment value, so other lanes and any direct
 * `vitest run` (a full battery included) keep their original behavior.
 * Consumers that must reach the base read `TEST_USE_REL` / go through
 * `testUsePath` below.
 */
export const TEST_USE_REL = process.env.DSH_TEST_USE_ROOT ?? 'tests/deepseek-harness-test-use'

/** Workspace-relative root of all per-world DSH_HOME dirs. */
export const TEST_HOME_ROOT_REL = 'tests/homes'

/**
 * Pinned upstream baseline (0.2.0-rc.2 — the official 0.2.0-rc.2 release
 * point: `release(dsh): 0.2.0-rc.2` (c1b47e41fc) plus its release-PR merge
 * 639ed01539 (upstream deepseek-ai/deepseek-harness PR #5479), carried in
 * this fork as branch `stable-3-0.2.0-rc.2` on
 * https://github.com/ArmourPiercer1/deepseek-harness.git; that branch tip IS
 * the checkout point (unlike the 0.1.x generations the fork carries NO
 * `dsh-v0.2.0-rc.2` tag object — its newest tag is `dsh-v0.1.7-rc.1`, so the
 * branch name + full SHA below are the anchors to verify).
 * The pinned version string is `DSH_BASELINE_VERSION` — tests and manifests
 * read the version from here instead of restating it.
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
 * 46a7f68b09 (0.1.7-rc.1, 2026-09-24 … 2026-10-03 — host upgrade round per
 * docs/plans/active/dsh-agent-team-0.1.7-rc.1-upgrade-plan.md) →
 * 639ed01539 (0.2.0-rc.2, from 2026-10-03 — host upgrade round, branch
 * task/dsh-020rc2-upgrade-20261003, evidence
 * dev/agent-workflow/evidence/dsh-020rc2-upgrade/).
 */
export const DSH_BASELINE_VERSION = '0.2.0-rc.2'
export const TEST_USE_BASELINE_SHA = '639ed015397290b3745d163aafe02ffee4aa3f84'
export const CLIENT_COMMIT_HASH = '639ed01539'

/**
 * Port policy, canonicalized here for the same reason paths are: the ranges live
 * in docs/TEST_METHODS.md (3180 family + 3491-3500; :3080 is the stable
 * development instance and is never a test port), but they were being
 * re-transcribed per harness — and one transcription had drifted out of policy
 * (the P5-T5 mini-MCP server was binding 3481-3485). Harnesses and bounded
 * runners now read these numbers, so a drift is a one-line fix in one place and
 * a ledger test can enforce it.
 */
export const TEST_PORT_RANGES = Object.freeze([
  Object.freeze([3180, 3186]),
  Object.freeze([3491, 3500]),
])
/** The stable development instance. A test must never bind it, only probe it. */
export const STABLE_INSTANCE_PORT = 3080

/** @param {number} port @returns {boolean} */
export function isSanctionedTestPort(port) {
  if (!Number.isInteger(port) || port === STABLE_INSTANCE_PORT) return false
  return TEST_PORT_RANGES.some(([lo, hi]) => port >= lo && port <= hi)
}

/**
 * The nearest ancestor of `start` containing the test-use checkout at its
 * canonical location (the marker that identifies a team-repo root for test
 * purposes). Returns null when no ancestor qualifies.
 */
export function findTestRepoRoot(start) {
  // ROOT 02:04 handling, absolute shape: when the ACTIVE checkout is an
  // absolute base (`DSH_TEST_USE_ROOT`), it lives OUTSIDE the walk; the base
  // must exist (else fail closed), and the repo-root marker degrades to this
  // file's own location — the team-repo root the specs read their sources
  // under — so `testUseTree(root)` and source joins stay correct.
  const absolute = isAbsolute(TEST_USE_REL)
  if (absolute && !existsSync(TEST_USE_REL)) return null
  let dir = resolve(start)
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(absolute ? join(dir, 'tests', 'paths.mjs') : join(dir, TEST_USE_REL))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

/**
 * Absolute path of the pristine test-use tree for a resolved repo root.
 * `TEST_USE_REL` may be repo-root-relative (the canonical shape) OR absolute
 * (the `DSH_TEST_USE_ROOT` shape); `isAbsolute` keeps both correct, where a
 * bare `join` would corrupt an absolute override.
 */
export function testUseTree(repoRoot) {
  return isAbsolute(TEST_USE_REL) ? TEST_USE_REL : join(resolve(repoRoot), TEST_USE_REL)
}

/**
 * Resolve one test-use-relative path under the ACTIVE test-use checkout.
 * `start` is the importer's own directory: the same upward walk
 * `findTestRepoRoot` performs. Consumers that hold no repo root (a spec
 * reading a host source or `lib` output) build their host path HERE rather
 * than joining the constant themselves, so the env-supplied base and the
 * canonical relative location resolve through one door.
 */
export function testUsePath(start, ...segments) {
  const root = findTestRepoRoot(typeof start === 'string' ? start : resolve(String(start ?? '.')))
  if (root === null) {
    throw new Error(`testUsePath: no ancestor of '${String(start)}' carries the test-use checkout at the ${DSH_BASELINE_VERSION} pin — failing closed (point DSH_TEST_USE_ROOT at the read-only ${CLIENT_COMMIT_HASH} base)`)
  }
  return join(testUseTree(root), ...segments)
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
