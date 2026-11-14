#!/usr/bin/env node
/**
 * census-plan.mjs — TINF M4: the census work plan (`census-plan/1`), SHADOW.
 *
 * WHAT IT IS. The plan a sharded census would execute: one task per (root, capture), each carrying
 * the command the census runner actually builds, a stable `task_id`, an optional grouping constraint,
 * a load-balancing estimate, and an identity block (merge tree, host pin, catalog digest, plan
 * digest) so a shard can prove it ran the plan it was handed.
 *
 * WHAT IT IS NOT. It is NOT authority, and it decides nothing about what runs:
 *   - it is not wired into `ci-required`, `ci-census` or any Required context;
 *   - no Required context reads the file it writes, and none is added or changed by it;
 *   - the workflow lists and `dev/ci/eb3-ci-manifest.json` remain the only things that decide what
 *     CI executes (that is M5's problem, not this file's);
 *   - it does not shard anything by itself: it emits a plan, and `--balance K` says how the plan's
 *     indivisible groups WOULD be spread over K shards. Nothing in CI consumes either today.
 *
 * WHERE THE ROOTS COME FROM (no hand-written list, and no "nine"):
 *   `scripts/test-catalog.mjs` already owns collection authority: it parses the `include[]` /
 *   `exclude[]` arrays of the vitest configs and classifies every tracked test file. The census root
 *   set is the set of directories covered by the ROOT `vitest.config.ts` (`base === ''`) — the config
 *   the census's single `vitest run` actually loads. Each matching file is mapped to its root with
 *   `rootOf()` from `scripts/tinf-timing.mjs`, the SAME derivation M3 uses to name roots in the timing
 *   rows, so a plan task's root name and a timing row's root name cannot disagree.
 *   On this tree that yields 11 roots / 705 files, which is exactly what the last real census reported
 *   (`captured 705f/9213l`, and 11 `census-root` names in the M3 timing TSV) — the derivation is the
 *   same authority, not a coincidence.
 *   It REFUSES when the root set cannot be derived from the config (missing root config, unparsable
 *   `include[]`, a matched file that resolves to no root, an empty set). There is no fallback count
 *   and no recorded "nine": a plan built on a remembered number is the defect this milestone exists
 *   to remove.
 *
 * THE IDENTITY IS RECORDED, NOT RECOMPUTED (stated in the memo as a limit): `merge_tree_sha` is the
 * tree of the commit this plan was made on (`git rev-parse HEAD^{tree}`), `host_sha` is the pin from
 * `tests/paths.mjs`, `catalog_digest` comes from `test-catalog.mjs`'s own digest function, and
 * `build_digest` is whatever the operator passed with `--build-digest` (or `null`). Nothing here
 * rebuilds a merge tree or hashes a build; the plan states what it read.
 *
 * THE COMMAND IS THE RUNNER'S. Every task's `runner.argv` is
 * `censusVitestArgv()` from `scripts/census-invocation.mjs` — the module `scripts/ci-pr-gate.mjs`'s
 * census leg now imports too. A plan cannot drift from the runner by construction.
 *
 * GROUPS. Spec §1 forbids assuming that two captures can be parallelised losslessly. This tool does
 * not know that they can, so it does not assume it: both captures of a root form one indivisible
 * group (`capture-pair:<root>`, kind `ordering-unproven`). That is a CONSTRAINT ADDED, never a task
 * dropped — the group set is what sharding must keep together, and the plan says why. No World is
 * claimed to be shared: the reason is the missing evidence, stated as such, not an invented resource.
 *
 * ESTIMATES. `est_ms` comes from M3's `tinf-timing/1` rows (per-root median, nearest-rank, the same
 * statistic `tinf-timing.mjs` publishes), and is `null` when the root has no measured row. It is a
 * LOAD-BALANCING HINT ONLY: no code path in this file removes, merges or skips a task because of it,
 * and `--balance` REFUSES when any estimate is unknown rather than balancing on a guess.
 *
 * USAGE
 *   node scripts/census-plan.mjs --plan [--out FILE] [--captures N] [--test-timeout MS]
 *                                [--timings FILE|DIR ...] [--build-digest DIGEST] [--balance K]
 *   node scripts/census-plan.mjs --verify-plan FILE
 *   node scripts/census-plan.mjs --self-test
 *
 * Exit: 0 ok | 2 REFUSED (named code on stderr; the plan is never printed when it cannot be derived).
 *
 * REFUSAL CODES: ROOT_CONFIG_MISSING, ROOT_CONFIG_UNREADABLE, CATALOG_UNREADABLE, GIT_READ_FAILED,
 *   ROOTS_NOT_DERIVED, ROOT_UNRESOLVED,
 *   CAPTURES_INVALID, TIMINGS_INPUT_UNREADABLE, TIMINGS_BAD_ROW, TIMINGS_NO_CENSUS_ROWS,
 *   GIT_READ_FAILED, PLAN_UNREADABLE, PLAN_SCHEMA_UNKNOWN, PLAN_DIGEST_MISMATCH,
 *   PLAN_TASK_DUPLICATE, PLAN_TASK_SET_CHANGED, PLAN_IDENTITY_DRIFT, BALANCE_K_INVALID,
 *   ESTIMATES_UNKNOWN, NO_MODE, UNKNOWN_ARGUMENT, OUTPUT_UNWRITABLE.
 *
 * @module scripts/census-plan
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CENSUS_COMMAND, censusVitestArgv } from './census-invocation.mjs'
import { buildEntries, digestOf as catalogDigestOf, gather as gatherCatalog } from './test-catalog.mjs'
// M3 owns both the root naming and the timing rows. `rootOf` is imported (not copied) so a plan
// task's root and a `census-root` row's root are the same string by construction.
import { collectInputs, parseRows, rootOf as rootOfCensusPath, summarize as summarizeTiming } from './tinf-timing.mjs'

export const SCHEMA = 'census-plan/1'
/** The config whose `include[]` defines the census population (the one a census run loads). */
export const ROOT_CONFIG = 'vitest.config.ts'
/** The L2 census invocation's capture count. A plan may say 1; the aggregator will refuse to PASS it. */
export const DEFAULT_CAPTURES = 2
/** Above this many groups the balancer falls back to greedy LPT (exhaustive search is exponential). */
export const MAX_EXACT_GROUPS = 14

// ────────────────────────────────────────────────────────────────── digests ──

/**
 * Canonical JSON: object keys sorted, no whitespace. Arrays keep their order because the plan's task
 * order is part of what a shard executes. A digest over `JSON.stringify` of an object literal is a
 * digest over key insertion order, which is a bug waiting for the next refactor.
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
}

export function digestJson(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`
}

// ────────────────────────────────────────────────────────── root derivation ──

/**
 * The census root set, from the collection authority. No `cwd` argument is read from a config file
 * list of its own: `test-catalog.mjs` does the parsing, this function only filters to the ROOT
 * config's matches and names their roots.
 *
 * @returns {{ok: true, roots: Array<{root: string, files: number}>, catalog_digest: string,
 *            file_count: number} | {ok: false, code: string, detail: string}}
 */
export function deriveRoots({ cwd = process.cwd() } = {}) {
  let state
  try {
    state = gatherCatalog({ cwd })
  } catch (e) {
    // A missing `dev/ci/test-contracts.json` or a git read failure lands here. Both mean "the
    // collection authority could not be read", never "therefore the old nine".
    const message = String(e && e.message ? e.message : e)
    const code = /test-contracts\.json/.test(message) ? 'CATALOG_UNREADABLE' : 'GIT_READ_FAILED'
    return { ok: false, code, detail: `the collection authority could not be read: ${message}` }
  }
  if (!state.files.has(ROOT_CONFIG)) {
    return {
      ok: false,
      code: 'ROOT_CONFIG_MISSING',
      detail: `${ROOT_CONFIG} is not a tracked file, so the census population has no authority to be derived ` +
        'from — refusing instead of falling back to a recorded root count',
    }
  }
  const rootCfg = state.vitestCfg
  if (!rootCfg || !Array.isArray(rootCfg.include) || rootCfg.include.length === 0) {
    const finding = (state.findings ?? []).find((f) => f.code === 'VITEST_CONFIG_UNREADABLE')
    return {
      ok: false,
      code: 'ROOT_CONFIG_UNREADABLE',
      detail: `${ROOT_CONFIG} could not be parsed into include[]` +
        (finding ? ` (${finding.detail})` : '') +
        ' — a root set derived from a partial read would be a guess',
    }
  }

  // Only the root config is applied: a per-package config collects a different population (e.g.
  // `packages/client`'s jsdom suite), and the census is the ROOT `vitest run`. Applying every config
  // would plan tasks for files the census never runs — a task set larger than the population is as
  // wrong as a smaller one.
  const built = buildEntries(state.files, {
    configs: [{ base: '', file: ROOT_CONFIG, cfg: rootCfg }],
    registry: state.registry,
  })
  const counts = new Map()
  for (const entry of built.entries) {
    if (entry.runner !== 'vitest' || entry.classification !== 'DISCOVERED_AND_COLLECTED') continue
    // Same derivation as the timing rows (M3), imported rather than re-implemented.
    const root = rootOfCensusPath(entry.path)
    if (root === 'unknown') {
      return {
        ok: false,
        code: 'ROOT_UNRESOLVED',
        detail: `${entry.path} is collected by ${ROOT_CONFIG} but resolves to no census root; naming it ` +
          '"unknown" in a plan would create a task the census report cannot account for',
      }
    }
    counts.set(root, (counts.get(root) ?? 0) + 1)
  }
  const roots = [...counts.entries()]
    .map(([root, files]) => ({ root, files }))
    .sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0))
  if (roots.length === 0) {
    return {
      ok: false,
      code: 'ROOTS_NOT_DERIVED',
      detail: `${ROOT_CONFIG} include[] matched no test file under any census root (include: ` +
        `${JSON.stringify(rootCfg.include)}) — an empty root set is not a small plan`,
    }
  }
  return {
    ok: true,
    roots,
    catalog_digest: catalogDigestOf(state.entries),
    file_count: roots.reduce((a, r) => a + r.files, 0),
  }
}

// ───────────────────────────────────────────────────────────────── identity ──

/** Identity fields a plan records; `plan_digest` is derived from them, not read from a file. */
export const IDENTITY_FIELDS = ['merge_tree_sha', 'host_sha', 'catalog_digest', 'build_digest']

/**
 * @param {object} p
 * @param {string} p.merge_tree_sha  tree id of the commit this plan is made on
 * @param {string} p.host_sha        `TEST_USE_BASELINE_SHA` from tests/paths.mjs
 * @param {string} p.catalog_digest  `test-catalog.mjs` digest of the catalog
 * @param {string|null} [p.build_digest] operator-supplied product build identity, null = unrecorded
 */
export function makeIdentity({ merge_tree_sha, host_sha, catalog_digest, build_digest = null }) {
  for (const [k, v] of Object.entries({ merge_tree_sha, host_sha, catalog_digest })) {
    if (typeof v !== 'string' || v.trim() === '') throw new Error(`makeIdentity: ${k} is required`)
  }
  return { merge_tree_sha, host_sha, catalog_digest, build_digest: build_digest ?? null }
}

/**
 * The digest payload. Spec §2 says "sha256 over canonical JSON of the tasks + identity"; the root
 * list, the capture count and the clock are included too because they PRODUCE the task set — a plan
 * whose `captures` was edited from 2 to 1 while its tasks stayed put would otherwise keep its digest.
 */
export function planPayload(plan) {
  return {
    schema: plan.schema,
    identity: Object.fromEntries(IDENTITY_FIELDS.map((k) => [k, plan.identity?.[k] ?? null])),
    captures: plan.captures,
    test_timeout_ms: plan.test_timeout_ms ?? null,
    roots: (plan.roots ?? []).map((r) => r.root),
    groups: (plan.groups ?? []).map((g) => ({ id: g.id, kind: g.kind, task_ids: g.task_ids })),
    tasks: (plan.tasks ?? []).map((t) => ({
      task_id: t.task_id,
      root: t.root,
      capture: t.capture,
      group: t.group,
      // `est_ms` is a balancing hint, but it IS a field of the task: leaving it out of the digest
      // would let a plan file be edited (a task made to look cheap) without any digest moving.
      est_ms: t.est_ms ?? null,
      runner: t.runner,
    })),
  }
}

export function planDigest(plan) {
  return digestJson(planPayload(plan))
}

// ──────────────────────────────────────────────────────────────────── tasks ──

/** The plan-declared report path for one task. Deterministic, so a shard's artifact is nameable. */
export function taskReportPath(taskId) {
  return `.artifacts/census/${String(taskId).replace(/[^A-Za-z0-9._-]+/g, '_')}.json`
}

export function taskIdOf(root, capture) {
  return `census:${root}#${String(capture)}`
}

/**
 * Build the plan. Pure: every input is an argument, so the self-test and the CLI reach the same code.
 *
 * @param {object} p
 * @param {Array<{root: string, files?: number}>} p.roots
 * @param {number} p.captures
 * @param {object} p.identity                    see makeIdentity
 * @param {number|null} [p.testTimeout]
 * @param {object|null} [p.timings]              {byRoot: Map<string, number>, source_files: string[]}
 */
export function buildPlan({ roots, captures, identity, testTimeout = null, timings = null }) {
  if (!Number.isInteger(captures) || captures < 1) {
    throw new Error(`buildPlan: captures must be a positive integer, got ${String(captures)}`)
  }
  const sorted = [...roots].sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0))
  const groups = []
  const tasks = []
  for (const { root } of sorted) {
    const groupId = `capture-pair:${root}`
    const groupTaskIds = []
    for (let capture = 1; capture <= captures; capture += 1) {
      const task_id = taskIdOf(root, capture)
      const jsonPath = taskReportPath(task_id)
      const est = timings?.byRoot instanceof Map ? timings.byRoot.get(root) : undefined
      tasks.push({
        task_id,
        root,
        capture,
        group: groupId,
        // A hint for load balancing. `null` means "not measured", which is different from 0 and is
        // never read as "free" — `balance()` refuses to run on a plan with unknown estimates.
        est_ms: Number.isFinite(est) ? Math.round(est) : null,
        runner: { cmd: CENSUS_COMMAND, argv: censusVitestArgv({ jsonPath, testTimeout }) },
      })
      groupTaskIds.push(task_id)
    }
    groups.push({
      id: groupId,
      kind: 'ordering-unproven',
      reason:
        'the two captures of one root are currently executed SEQUENTIALLY in one process; nothing has ' +
        'shown that observing them concurrently is lossless (spec §1 forbids assuming it), so they are ' +
        'an indivisible group. No World is claimed to be shared — the constraint is the missing evidence.',
      task_ids: groupTaskIds,
    })
  }
  const unknown = sorted.map((r) => r.root).filter((root) => !Number.isFinite(timings?.byRoot?.get(root)))
  const plan = {
    schema: SCHEMA,
    identity: { ...identity },
    captures,
    test_timeout_ms: testTimeout,
    roots: sorted.map((r) => ({ root: r.root, files: r.files ?? null })),
    groups,
    tasks,
    timings: {
      statistic: 'median_ms (nearest-rank, as tinf-timing.mjs publishes it)',
      source_files: (timings?.source_files ?? []).slice(),
      measured_roots: sorted.length - unknown.length,
      unknown_roots: unknown,
      used_for: 'load-balancing hint only — no task is added, removed or reordered by an estimate',
    },
    notes: [
      'identity is RECORDED, not recomputed: merge_tree_sha is the tree of the planning commit, host_sha ' +
        'is the tests/paths.mjs pin, catalog_digest is test-catalog.mjs\'s own digest, build_digest is ' +
        'operator-supplied (null = unrecorded)',
      'every task\'s runner.argv is built by scripts/census-invocation.mjs, the module the census leg of ' +
        'scripts/ci-pr-gate.mjs imports — the plan cannot drift from the runner by construction',
      'shadow: no workflow, no Required context and no ci-required input reads this file',
    ],
  }
  plan.identity.plan_digest = planDigest(plan)
  return plan
}

// ─────────────────────────────────────────────────────────────────── verify ──

/**
 * Re-derive the plan from the current tree and compare it with a recorded plan file. Refuses on
 * digest drift (the file was edited without recomputing its digest) AND on identity/task-set drift
 * (the tree moved since the plan was made). Both are named, and both are refusals, because a shard
 * that runs a plan for one tree and reports into a plan for another is exactly the "mixed tree"
 * failure TINF-13 names.
 */
export function verifyPlan(plan, { cwd = process.cwd(), currentPlan } = {}) {
  const codes = []
  const detail = []
  if (!plan || typeof plan !== 'object') {
    return { ok: false, codes: ['PLAN_UNREADABLE'], detail: ['the plan is not an object'] }
  }
  if (plan.schema !== SCHEMA) {
    return { ok: false, codes: ['PLAN_SCHEMA_UNKNOWN'], detail: [`schema must be ${SCHEMA}, got ${String(plan.schema)}`] }
  }
  // 1. the file's OWN digest, over the file's OWN fields. An edit that did not recompute the digest
  //    is caught here, before anything is compared with the tree.
  const recomputed = planDigest(plan)
  if (recomputed !== plan.identity?.plan_digest) {
    codes.push('PLAN_DIGEST_MISMATCH')
    detail.push(`plan.identity.plan_digest=${String(plan.identity?.plan_digest)} but the file's own tasks+identity digest to ${recomputed}`)
  }
  const ids = (plan.tasks ?? []).map((t) => t.task_id)
  if (new Set(ids).size !== ids.length) {
    codes.push('PLAN_TASK_DUPLICATE')
    detail.push(`the plan names ${ids.length} tasks but only ${new Set(ids).size} distinct task ids`)
  }
  // 2. the tree. `currentPlan` is injectable so the self-test can exercise identity and task-set
  //    drift without a git checkout.
  const current = currentPlan ?? (() => {
    const roots = deriveRoots({ cwd })
    if (!roots.ok) return { refusal: roots }
    return {
      plan: buildPlan({
        roots: roots.roots,
        captures: plan.captures,
        identity: {
          merge_tree_sha: gitTreeSha(cwd),
          host_sha: hostSha(),
          catalog_digest: roots.catalog_digest,
          build_digest: plan.identity?.build_digest ?? null,
        },
        testTimeout: plan.test_timeout_ms ?? null,
        timings: null,
      }),
    }
  })()
  if (current.refusal) {
    return { ok: false, codes: [...codes, current.refusal.code], detail: [...detail, current.refusal.detail] }
  }
  for (const field of IDENTITY_FIELDS) {
    const was = plan.identity?.[field] ?? null
    const now = current.plan.identity?.[field] ?? null
    if (was !== now) {
      codes.push('PLAN_IDENTITY_DRIFT')
      detail.push(`${field} drifted: plan=${String(was)} current=${String(now)}`)
    }
  }
  const nowIds = new Set(current.plan.tasks.map((t) => t.task_id))
  const plannedIds = new Set(ids)
  const missing = [...plannedIds].filter((id) => !nowIds.has(id))
  const added = [...nowIds].filter((id) => !plannedIds.has(id))
  if (missing.length > 0 || added.length > 0) {
    codes.push('PLAN_TASK_SET_CHANGED')
    detail.push(`task set changed: ${missing.length} planned task(s) no longer derivable` +
      `${missing.length ? ` (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''})` : ''}; ` +
      `${added.length} new task(s) the plan does not carry${added.length ? ` (${added.slice(0, 5).join(', ')}${added.length > 5 ? '…' : ''})` : ''}`)
  }
  if (plan.captures !== current.plan.captures || (plan.test_timeout_ms ?? null) !== (current.plan.test_timeout_ms ?? null)) {
    codes.push('PLAN_IDENTITY_DRIFT')
    detail.push(`invocation drifted: captures ${String(plan.captures)} vs ${String(current.plan.captures)}, ` +
      `clock ${String(plan.test_timeout_ms ?? null)} vs ${String(current.plan.test_timeout_ms ?? null)}`)
  }
  return { ok: codes.length === 0, codes: [...new Set(codes)], detail, current }
}

// ────────────────────────────────────────────────────────────────── balance ──

/**
 * Spread the plan's indivisible groups over `k` shards by MINIMISING the maximum shard load
 * (makespan). Exhaustive when the group count is small (11 groups × 4 bins is ~146k assignments, tens
 * of ms), greedy LPT above `MAX_EXACT_GROUPS`. Deterministic: groups are visited in descending weight
 * with a stable tie-break, and only a strict improvement replaces the incumbent.
 *
 * A null estimate refuses: balancing on partial knowledge produces a confident-looking table built on
 * guesses, which is the thing M3 exists to stop.
 */
export function balance(plan, k, { maxExactGroups = MAX_EXACT_GROUPS } = {}) {
  const tasks = plan.tasks ?? []
  if (!Number.isInteger(k) || k < 1) {
    return { ok: false, code: 'BALANCE_K_INVALID', detail: `shard count must be a positive integer, got ${String(k)}` }
  }
  const groups = (plan.groups ?? []).map((g) => {
    const members = tasks.filter((t) => g.task_ids.includes(t.task_id))
    const total = members.reduce((a, t) => a + (Number.isFinite(t.est_ms) ? t.est_ms : NaN), 0)
    return { id: g.id, task_ids: g.task_ids.slice().sort(), ms: total, unknown: members.some((t) => !Number.isFinite(t.est_ms)) }
  })
  // A plan with no groups is balanced per task: the group list is the plan's constraint set, and an
  // empty one means every task stands alone.
  const units = groups.length > 0
    ? groups
    : tasks.map((t) => ({ id: `task:${t.task_id}`, task_ids: [t.task_id], ms: t.est_ms, unknown: !Number.isFinite(t.est_ms) }))
  const unknown = units.filter((u) => u.unknown).map((u) => u.id)
  if (unknown.length > 0) {
    return {
      ok: false,
      code: 'ESTIMATES_UNKNOWN',
      detail: `${unknown.length} unit(s) have no measured estimate (${unknown.slice(0, 5).join(', ')}` +
        `${unknown.length > 5 ? '…' : ''}) — refuse to balance on guesses, and never on a subset of the plan`,
    }
  }
  if (k > units.length) {
    return { ok: false, code: 'BALANCE_K_INVALID', detail: `${String(k)} shards for ${units.length} indivisible unit(s) would leave empty shards; the task set cannot be split further` }
  }
  const ordered = [...units].sort((a, b) => b.ms - a.ms || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const totalMs = ordered.reduce((a, u) => a + u.ms, 0)
  const lowerBound = Math.max(ordered[0]?.ms ?? 0, Math.ceil(totalMs / k))
  let assignment
  let method
  if (units.length <= maxExactGroups) {
    method = 'exhaustive-min-makespan'
    assignment = exactAssign(ordered, k)
  } else {
    method = 'greedy-lpt'
    assignment = greedyAssign(ordered, k)
  }
  const loads = Array.from({ length: k }, () => 0)
  for (let i = 0; i < ordered.length; i += 1) loads[assignment[i]] += ordered[i].ms
  let best = Math.max(...loads)
  // One deterministic local-improvement pass for the greedy path only; the exhaustive path is optimal
  // by construction and a "better" result from a heuristic would mean the search was wrong.
  if (method === 'greedy-lpt') {
    const improved = localImprove(ordered, assignment, loads.slice(), k, best)
    if (improved !== null) {
      assignment = improved.assignment
      best = improved.makespan
      method = 'greedy-lpt+move'
    }
  }
  const shards = Array.from({ length: k }, (_, shard) => {
    const ids = ordered.filter((_, i) => assignment[i] === shard).flatMap((u) => u.task_ids).sort()
    return { id: `shard-${String(shard + 1)}`, task_ids: ids, units: ordered.filter((_, i) => assignment[i] === shard).map((u) => u.id), load_ms: loads[shard] }
  })
  const makespan = Math.max(...shards.map((s) => s.load_ms))
  return {
    ok: true,
    method,
    shards,
    makespan_ms: makespan,
    total_ms: totalMs,
    ideal_ms: Math.ceil(totalMs / k),
    lower_bound_ms: lowerBound,
    optimal: makespan === lowerBound,
    est_note: 'loads are SUMMED per-shard estimates, not measured wall clock; the L2 roots run concurrently ' +
      'inside one capture, so a shard\'s real wall clock is not the sum (tinf-timing\'s window semantics)',
  }
}

function exactAssign(ordered, k) {
  const loads = Array.from({ length: k }, () => 0)
  const current = new Array(ordered.length).fill(0)
  const best = { makespan: Infinity, assignment: null }
  const recurse = (i) => {
    if (i === ordered.length) {
      const m = Math.max(...loads)
      if (m < best.makespan) {
        best.makespan = m
        best.assignment = current.slice()
      }
      return
    }
    for (let bin = 0; bin < k; bin += 1) {
      // A new bin that is empty while an earlier one is also empty is a symmetry the search does not
      // need to re-explore: shard ids are labels, not schedules.
      if (bin > 0 && loads[bin] === 0 && loads[bin - 1] === 0) continue
      loads[bin] += ordered[i].ms
      current[i] = bin
      if (Math.max(...loads) < best.makespan) recurse(i + 1)
      loads[bin] -= ordered[i].ms
    }
  }
  recurse(0)
  return best.assignment ?? new Array(ordered.length).fill(0)
}

function greedyAssign(ordered, k) {
  const loads = Array.from({ length: k }, () => 0)
  const assignment = new Array(ordered.length).fill(0)
  for (let i = 0; i < ordered.length; i += 1) {
    let target = 0
    for (let bin = 1; bin < k; bin += 1) if (loads[bin] < loads[target]) target = bin
    assignment[i] = target
    loads[target] += ordered[i].ms
  }
  return assignment
}

function localImprove(ordered, assignment, loads, k, makespan) {
  let bestAssignment = assignment.slice()
  let bestMakespan = makespan
  let improved = false
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false
    for (let i = 0; i < ordered.length; i += 1) {
      for (let bin = 0; bin < k; bin += 1) {
        if (bin === assignment[i]) continue
        const from = assignment[i]
        const fromLoad = loads[from] - ordered[i].ms
        const toLoad = loads[bin] + ordered[i].ms
        const next = Math.max(
          ...loads.map((l, b) => (b === from ? fromLoad : b === bin ? toLoad : l)),
        )
        if (next < bestMakespan) {
          assignment[i] = bin
          loads[from] = fromLoad
          loads[bin] = toLoad
          bestAssignment = assignment.slice()
          bestMakespan = next
          improved = true
          moved = true
        }
      }
    }
    if (!moved) break
  }
  return improved ? { assignment: bestAssignment, makespan: bestMakespan } : null
}

// ─────────────────────────────────────────────────────────────────── inputs ──

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()
}

export function gitTreeSha(cwd = process.cwd()) {
  return git(['rev-parse', 'HEAD^{tree}'], cwd)
}

/** The host pin, read from `tests/paths.mjs` — never copied into this file. */
export function hostSha() {
  return HOST_SHA
}

const HOST_SHA = (() => {
  const file = fileURLToPath(new URL('../tests/paths.mjs', import.meta.url))
  const found = /export\s+const\s+TEST_USE_BASELINE_SHA\s*=\s*'([0-9a-f]{40})'/.exec(readFileSync(file, 'utf8'))
  if (!found) throw new Error('tests/paths.mjs: TEST_USE_BASELINE_SHA is not a 40-hex literal — refusing to plan against an unpinned host')
  return found[1]
})()

/**
 * Per-root medians from M3 `tinf-timing/1` rows. Uses M3's parser and summarizer (so the statistic is
 * the one M3 publishes) and keeps only `ok` census-root rows — a failed span is not a duration and is
 * never rendered as 0 ms. Rows for roots the plan does not have are reported, not dropped silently.
 */
export function loadTimings(paths, { readFile = readFileSync } = {}) {
  // M3's own input collector: a file or a directory of `*.tsv`, with its named refusal when a path
  // does not exist. Reusing it keeps "which files were read" the same question M3 answers.
  const collected = collectInputs(paths)
  if (collected.problems.length > 0) {
    return { ok: false, code: 'TIMINGS_INPUT_UNREADABLE', detail: collected.problems.map((p) => p.reason).join(' ;; ') }
  }
  if (collected.files.length === 0) {
    return { ok: false, code: 'TIMINGS_INPUT_UNREADABLE', detail: `no *.tsv file under ${paths.join(', ')}` }
  }
  const rows = []
  const problems = []
  for (const file of collected.files) {
    let text
    try {
      text = readFile(file, 'utf8')
    } catch (e) {
      return { ok: false, code: 'TIMINGS_INPUT_UNREADABLE', detail: `${file}: ${String(e && e.message ? e.message : e)}` }
    }
    const parsed = parseRows(text, { file })
    rows.push(...parsed.rows)
    problems.push(...parsed.problems)
  }
  if (problems.length > 0) {
    return {
      ok: false,
      code: 'TIMINGS_BAD_ROW',
      detail: problems.slice(0, 3).map((p) => `${p.file}:${String(p.line)} ${p.reason}`).join(' ;; '),
    }
  }
  const censusRows = rows.filter((r) => r.phase === 'census-root' || r.phase === 'census-capture')
  if (censusRows.length === 0) {
    return {
      ok: false,
      code: 'TIMINGS_NO_CENSUS_ROWS',
      detail: `${collected.files.length} file(s) but no census-capture|census-root row; a timing file without a census row measures no root`,
    }
  }
  // M3's summarizer decides the statistic (nearest-rank median) so the plan's estimate and the
  // published timing report cannot be two different numbers under the same name.
  const report = summarizeTiming(rows, { files: collected.files })
  const byRoot = new Map()
  for (const r of report.census_roots) {
    if (r.n > 0 && Number.isFinite(r.median_ms)) byRoot.set(r.root, r.median_ms)
  }
  return { ok: true, byRoot, source_files: collected.files, report }
}

// ───────────────────────────────────────────────────────────────────── cli ──

const HELP = [
  'usage: node scripts/census-plan.mjs --plan [--out FILE] [--captures N] [--test-timeout MS]',
  '                                      [--timings FILE ...] [--build-digest DIGEST] [--balance K]',
  '       node scripts/census-plan.mjs --verify-plan FILE',
  '       node scripts/census-plan.mjs --self-test',
  '',
  '  --plan              print the census-plan/1 artifact (stdout, or --out FILE)',
  '  --captures N        captures per root (default 2; the L2 census invocation)',
  '  --test-timeout MS   the clock the runner passes to vitest; omitted = the suite default',
  '  --timings FILE...   tinf-timing/1 tsv file(s) for est_ms (load-balancing hint only)',
  '  --build-digest D    product build identity recorded in the plan (default: unrecorded)',
  '  --balance K         print the group-to-shard assignment for K shards instead of the plan',
  '  --verify-plan FILE  re-derive and refuse on digest / identity / task-set drift',
  '  --self-test         pin the derivation, the digest, the refusals and the balancer',
  '',
].join('\n')

function refuse(code, detail) {
  process.stderr.write(`REFUSED ${code}: ${detail}\n`)
  return 2
}

function parseArgs(argv) {
  const opts = {
    plan: false, out: null, captures: DEFAULT_CAPTURES, testTimeout: null,
    timings: [], buildDigest: null, balance: null, verifyPlan: null, selfTest: false, help: false,
    root: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--plan') opts.plan = true
    else if (a === '--out') opts.out = argv[++i] ?? null
    else if (a === '--captures') opts.captures = Number(argv[++i])
    else if (a === '--test-timeout') opts.testTimeout = Number(argv[++i])
    else if (a === '--timings') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.timings.push(argv[++i]) }
    else if (a === '--build-digest') opts.buildDigest = argv[++i] ?? null
    else if (a === '--balance') opts.balance = Number(argv[++i])
    else if (a === '--verify-plan') opts.verifyPlan = argv[++i] ?? null
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw Object.assign(new Error(`unknown argument ${a}`), { code: 'UNKNOWN_ARGUMENT' })
  }
  if (opts.testTimeout !== null && !Number.isFinite(opts.testTimeout)) {
    throw Object.assign(new Error('--test-timeout needs a number of milliseconds'), { code: 'UNKNOWN_ARGUMENT' })
  }
  return opts
}

function currentPlanFor(opts) {
  const roots = deriveRoots({ cwd: process.cwd() })
  if (!roots.ok) return { refusal: roots }
  if (!Number.isInteger(opts.captures) || opts.captures < 1) {
    return { refusal: { code: 'CAPTURES_INVALID', detail: `--captures must be a positive integer, got ${String(opts.captures)}` } }
  }
  let timings = null
  if (opts.timings.length > 0) {
    const loaded = loadTimings(opts.timings)
    if (!loaded.ok) return { refusal: loaded }
    timings = { byRoot: loaded.byRoot, source_files: loaded.source_files }
  }
  return {
    plan: buildPlan({
      roots: roots.roots,
      captures: opts.captures,
      identity: {
        merge_tree_sha: gitTreeSha(process.cwd()),
        host_sha: hostSha(),
        catalog_digest: roots.catalog_digest,
        build_digest: opts.buildDigest,
      },
      testTimeout: opts.testTimeout,
      timings,
    }),
    roots,
  }
}

export function main(argv) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (e) {
    return refuse(e.code ?? 'UNKNOWN_ARGUMENT', e.message)
  }
  if (opts.help) {
    process.stdout.write(HELP)
    return 0
  }
  if (opts.selfTest) return selfTest()

  if (opts.verifyPlan !== null) {
    let plan
    try {
      plan = JSON.parse(readFileSync(resolve(opts.verifyPlan), 'utf8'))
    } catch (e) {
      return refuse('PLAN_UNREADABLE', `${opts.verifyPlan}: ${String(e && e.message ? e.message : e)}`)
    }
    const verdict = verifyPlan(plan)
    if (!verdict.ok) {
      for (const code of verdict.codes) process.stderr.write(`REFUSED ${code}\n`)
      for (const line of verdict.detail) process.stderr.write(`  ${line}\n`)
      return 2
    }
    process.stdout.write(`DSH-CENSUS-PLAN verify=ok tasks=${String(verdict.current.plan.tasks.length)} ` +
      `roots=${String(verdict.current.plan.roots.length)} captures=${String(verdict.current.plan.captures)} ` +
      `digest=${String(plan.identity.plan_digest)}\n`)
    return 0
  }

  if (!opts.plan && opts.balance === null) {
    return refuse('NO_MODE', 'nothing to do: give --plan, --verify-plan FILE, --balance K or --self-test')
  }

  const made = currentPlanFor(opts)
  if (made.refusal) return refuse(made.refusal.code, made.refusal.detail)

  if (opts.balance !== null) {
    const b = balance(made.plan, opts.balance)
    if (!b.ok) return refuse(b.code, b.detail)
    process.stdout.write(`${JSON.stringify({ schema: 'census-balance/1', shard_count: opts.balance, ...b }, null, 2)}\n`)
    return 0
  }

  const text = `${JSON.stringify(made.plan, null, 2)}\n`
  if (opts.out === null) {
    process.stdout.write(text)
    return 0
  }
  try {
    writeFileSync(resolve(opts.out), text)
  } catch (e) {
    return refuse('OUTPUT_UNWRITABLE', `${opts.out}: ${String(e && e.message ? e.message : e)}`)
  }
  process.stdout.write(`DSH-CENSUS-PLAN plan=ok roots=${String(made.plan.roots.length)} ` +
    `tasks=${String(made.plan.tasks.length)} captures=${String(made.plan.captures)} ` +
    `est_unknown=${String(made.plan.timings.unknown_roots.length)} ` +
    `digest=${made.plan.identity.plan_digest} out=${opts.out}\n`)
  return 0
}

// ──────────────────────────────────────────────────────────────── self-test ──

export function selfTest() {
  const cases = []
  const ok = (label, cond, detail = '') => cases.push([label, Boolean(cond), detail])
  const roots = [{ root: 'packages/a', files: 3 }, { root: 'packages/b', files: 1 }]
  const identity = makeIdentity({ merge_tree_sha: 'treetree', host_sha: 'hosthost', catalog_digest: 'sha256:cat', build_digest: 'build1' })
  const plan = buildPlan({ roots, captures: 2, identity })
  const tasks = plan.tasks

  ok('one task per (root, capture)', tasks.length === 4, String(tasks.length))
  ok('task ids are stable and name their root and capture',
    tasks[0].task_id === 'census:packages/a#1' && tasks[1].task_id === 'census:packages/a#2', JSON.stringify(tasks.map((t) => t.task_id)))
  ok('captures of one root form an indivisible group', plan.groups.length === 2 && plan.groups[0].task_ids.length === 2, JSON.stringify(plan.groups))
  ok('the group states WHY it exists', /SEQUENTIALLY/i.test(plan.groups[0].reason) && plan.groups[0].kind === 'ordering-unproven', plan.groups[0].kind)
  ok('every task carries the census invocation', tasks.every((t) => t.runner.cmd === 'pnpm' && t.runner.argv.includes('exec') && t.runner.argv.includes('vitest')), 'argv')
  ok('the clock appears only when it was set',
    !tasks[0].runner.argv.some((a) => a.startsWith('--testTimeout')) &&
    buildPlan({ roots, captures: 1, identity, testTimeout: 90000 }).tasks[0].runner.argv.includes('--testTimeout=90000'), 'clock')
  ok('an unmeasured root is null, never 0', tasks.every((t) => t.est_ms === null), JSON.stringify(tasks.map((t) => t.est_ms)))
  const measured = buildPlan({ roots, captures: 2, identity, timings: { byRoot: new Map([['packages/a', 1234.6]]) } })
  ok('a measured root gets a rounded median', measured.tasks.filter((t) => t.root === 'packages/a').every((t) => t.est_ms === 1235), JSON.stringify(measured.tasks.map((t) => t.est_ms)))
  ok('an estimate never removes a task', measured.tasks.length === 4, String(measured.tasks.length))
  ok('unknown roots are named, not hidden', JSON.stringify(measured.timings.unknown_roots) === '["packages/b"]', JSON.stringify(measured.timings.unknown_roots))

  // digest: canonical, order-independent for objects, order-SENSITIVE for the task list
  ok('canonical JSON sorts object keys', canonicalJson({ b: 1, a: 2 }) === '{"a":2,"b":1}', canonicalJson({ b: 1, a: 2 }))
  ok('the digest covers the task list', planDigest(plan) === planDigest(JSON.parse(JSON.stringify(plan))), 'roundtrip')
  const edited = JSON.parse(JSON.stringify(plan))
  edited.tasks[0].est_ms = 1
  ok('editing a task changes the digest', planDigest(edited) !== plan.identity.plan_digest, 'digest')
  const reordered = JSON.parse(JSON.stringify(plan))
  reordered.tasks.reverse()
  ok('reordering tasks changes the digest', planDigest(reordered) !== plan.identity.plan_digest, 'digest')

  // verify: the four drift classes
  ok('verify: an unedited plan verifies against itself', verifyPlan(plan, { currentPlan: { plan } }).ok === true, JSON.stringify(verifyPlan(plan, { currentPlan: { plan } })))
  const stale = JSON.parse(JSON.stringify(plan))
  stale.tasks[0].capture = 9
  ok('verify: an edit without a new digest is PLAN_DIGEST_MISMATCH',
    verifyPlan(stale, { currentPlan: { plan: stale } }).codes.includes('PLAN_DIGEST_MISMATCH'), JSON.stringify(verifyPlan(stale, { currentPlan: { plan: stale } }).codes))
  const other = buildPlan({ roots, captures: 2, identity: makeIdentity({ merge_tree_sha: 'other', host_sha: 'hosthost', catalog_digest: 'sha256:cat' }) })
  ok('verify: a different tree is PLAN_IDENTITY_DRIFT',
    verifyPlan(plan, { currentPlan: { plan: other } }).codes.includes('PLAN_IDENTITY_DRIFT'), JSON.stringify(verifyPlan(plan, { currentPlan: { plan: other } }).codes))
  const fewer = buildPlan({ roots: [roots[0]], captures: 2, identity })
  ok('verify: a dropped root is PLAN_TASK_SET_CHANGED',
    verifyPlan(plan, { currentPlan: { plan: fewer } }).codes.includes('PLAN_TASK_SET_CHANGED'), JSON.stringify(verifyPlan(plan, { currentPlan: { plan: fewer } }).codes))
  const dup = JSON.parse(JSON.stringify(plan))
  dup.tasks[1].task_id = dup.tasks[0].task_id
  dup.identity.plan_digest = planDigest(dup)
  ok('verify: a duplicate task id is refused even with a fresh digest',
    verifyPlan(dup, { currentPlan: { plan: dup } }).codes.includes('PLAN_TASK_DUPLICATE'), JSON.stringify(verifyPlan(dup, { currentPlan: { plan: dup } }).codes))
  ok('verify: a foreign schema is refused', verifyPlan({ schema: 'census-plan/2' }, { currentPlan: { plan } }).codes.includes('PLAN_SCHEMA_UNKNOWN'), 'schema')
  ok('verify: garbage is refused, not crashed on', verifyPlan(null, { currentPlan: { plan } }).codes.includes('PLAN_UNREADABLE'), 'null')

  // balance: exact makespan on a known partition
  const weighted = buildPlan({
    roots: [{ root: 'packages/a' }, { root: 'packages/b' }, { root: 'packages/c' }, { root: 'packages/d' }],
    captures: 2,
    identity,
    timings: { byRoot: new Map([['packages/a', 500], ['packages/b', 500], ['packages/c', 100], ['packages/d', 100]]) },
  })
  const two = balance(weighted, 2)
  ok('balance: two shards get the minimum makespan', two.ok && two.makespan_ms === 1200, JSON.stringify(two.makespan_ms))
  ok('balance: the exhaustive method is named', two.method === 'exhaustive-min-makespan', two.method)
  ok('balance: every planned task appears exactly once across shards',
    JSON.stringify(two.shards.flatMap((s) => s.task_ids).sort()) === JSON.stringify(weighted.tasks.map((t) => t.task_id).sort()), JSON.stringify(two.shards.map((s) => s.task_ids)))
  ok('balance: a group is never split across shards',
    two.shards.every((s) => !s.task_ids.some((id) => id.endsWith('#1')) || s.task_ids.some((id) => id.endsWith('#2'))), 'group')
  ok('balance: unknown estimates refuse instead of guessing', balance(plan, 2).code === 'ESTIMATES_UNKNOWN', balance(plan, 2).code)
  ok('balance: more shards than units refuses', balance(weighted, 5).code === 'BALANCE_K_INVALID', balance(weighted, 5).code)

  // refusals that need no repository
  ok('captures must be a positive integer', (() => { try { buildPlan({ roots, captures: 0, identity }); return false } catch { return true } })())
  ok('identity requires the three measured fields', (() => { try { makeIdentity({ merge_tree_sha: '', host_sha: 'h', catalog_digest: 'c' }); return false } catch { return true } })())
  const badTiming = loadTimings(['/nonexistent/path/tinf-timing.tsv'])
  ok('a missing timing file is TIMINGS_INPUT_UNREADABLE', badTiming.code === 'TIMINGS_INPUT_UNREADABLE', badTiming.code)

  let bad = 0
  for (const [label, cond, detail] of cases) {
    if (!cond) bad += 1
    process.stdout.write(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : `: ${detail}`}\n`)
  }
  process.stdout.write(`DSH-CENSUS-PLAN-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${String(cases.length)} failed=${String(bad)}\n`)
  return bad === 0 ? 0 : 1
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main(process.argv.slice(2)))
