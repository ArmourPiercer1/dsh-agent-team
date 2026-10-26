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
 * Ports: the sanctioned test bands below (TEST_PORT_RANGES — 3180-3199 /
 * 3491-3500 / 13000-13099 since the user ruling of 2026-10-26; before it
 * 3180-3186 / 3491-3500). NEVER 3080 (stable instance — read-only probe at
 * most). See the port-policy block below for the ruling and the bands.
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** Workspace-relative path of the pristine upstream test-use checkout. */
export const TEST_USE_REL = 'tests/deepseek-harness-test-use'

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
 *
 * WIDENED 2026-10-26 (u7-w0), user ruling, verbatim:
 *   "当前机器应该没有太多会占用端口的进程。你可以尝试 3181-3199端口族；如果仍不够用，
 *    目前较大的端口区段（如13000甚至更大）应该都还是空置的"
 * Measured at ruling time: 3180-3199 had nothing listening except :3080 (the
 * user's stable instance, which sits OUTSIDE every band), 13000-13019 had
 * nothing listening. Re-measured by u7-w0 before any bind (ss -ltn, evidence
 * dev/agent-workflow/evidence/u7-w0-20261026/port-probe-pre.txt): 3180-3199,
 * 3491-3500 and 13000-13099 all free; the kernel's ephemeral range here is
 * 32768-60999, so no band can be handed out as an outgoing source port.
 *
 * The bands, by role (the World factory leases from these; legacy kits keep
 * their own candidate lists INSIDE the old 3180-3186 / 3491-3500 ranges, which
 * every band below still contains):
 *   HOST_PORT_BANDS  host instances: 3181-3199, then 13000-13049. 3180 is
 *                    deliberately NOT leased to World hosts: it is the
 *                    hand-run default of TEST_METHODS §2 and several kits pin
 *                    it, so a World never steals it from a human/kit run.
 *   MOCK_PORT_BANDS  the in-process mock provider: 3491-3500, then 13050-13099.
 * The upper band is FINITE on purpose (100 ports: 50 host + 50 mock) — enough
 * for the six planned parallel family lanes at several Worlds each, while a
 * runaway leaser still exhausts quickly and fails closed instead of wandering
 * the port space. Widening it again is a one-line change here plus a recorded
 * ruling.
 */
export const TEST_PORT_RANGES = Object.freeze([
  Object.freeze([3180, 3199]),
  Object.freeze([3491, 3500]),
  Object.freeze([13000, 13099]),
])
/** World-factory host-instance leasing order (3180 excluded — see above). */
export const HOST_PORT_BANDS = Object.freeze([
  Object.freeze([3181, 3199]),
  Object.freeze([13000, 13049]),
])
/** World-factory mock-provider leasing order. */
export const MOCK_PORT_BANDS = Object.freeze([
  Object.freeze([3491, 3500]),
  Object.freeze([13050, 13099]),
])
/** The stable development instance. A test must never bind it, only probe it. */
export const STABLE_INSTANCE_PORT = 3080

/**
 * Expand bands to the concrete ports, in band order. Every port it yields is
 * sanctioned (asserted, so a band edited outside TEST_PORT_RANGES fails loudly).
 * @param {ReadonlyArray<readonly [number, number]>} bands
 * @returns {number[]}
 */
export function portsOfBands(bands) {
  const out = []
  for (const [lo, hi] of bands) {
    for (let p = lo; p <= hi; p += 1) {
      if (!isSanctionedTestPort(p)) throw new Error(`port band ${lo}-${hi} leaves the sanctioned ranges at ${p}`)
      out.push(p)
    }
  }
  return out
}

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
