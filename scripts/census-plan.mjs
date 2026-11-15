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
 * A DIGEST IS A DIGEST. `merge_tree_sha`, `host_sha`, `catalog_digest`, `build_digest` and the derived
 * `plan_digest` are all validated against ONE shape (`scripts/census-digest.mjs`): `sha256:<64 hex>` or
 * a bare `<40 hex>`. The sentinels `null`, `"null"`, `"undefined"`, `""`, whitespace, uppercase hex and
 * a 39/65-hex value are refused by name, at plan time and again when a plan is read (`--verify-plan`).
 * M4 review round 1 proved the bypass: `--plan --build-digest null` recorded the STRING `"null"` and
 * two shards echoing it aggregated to `PASS expected=22 observed=22`. A plan may still record
 * `build_digest: null` (its own code, `IDENTITY_BUILD_UNRECORDED`), but never a string that only looks
 * like a value.
 *
 * ROOTS DROPPED BY exclude[]. A config edit that excludes a root's only files would otherwise shrink
 * the census silently: the plan is derived from `include[]`, and a root that no longer matches is not
 * in it. So `deriveRoots` reports every root that HAS test-like files but is entirely excluded by the
 * root config's `exclude[]`, the plan lists them in `roots_dropped`, and the CLI REFUSES
 * (`ROOT_DROPPED_BY_EXCLUDE`, exit 2) unless each one is named with `--allow-dropped-root <root>`.
 * An allowed drop is recorded, not hidden: it stays in `roots_dropped` with `allowed: true`, it is part
 * of `plan_digest`, and the aggregator prints it in the summary.
 *
 * FILE POPULATION (TINF trust-closeout, F-02). Counting files per root was not equality: a plan that
 * says "root A has 100 files" and a report that collects ONE of them agreed on the root's presence and
 * passed. Each plan root now carries the sorted list of its expected test files (relative to the
 * root), `file_count` and a `file_digest` over the sorted newline-joined list, and all of it is inside
 * `plan_digest`. The population comes from the SAME catalog discovery that names the roots (there is no
 * second list) and stays bound to `catalog_digest`.
 *
 * POPULATION BASELINE. A reviewed artifact `dev/ci/census-population-baseline.json` records each
 * root's file count + digest at the last review. The census leg compares the freshly derived plan
 * against it and refuses POPULATION_SHRANK when a root loses files (or swaps them at equal size), so
 * "shrink the config until plan and report agree" is not a valid fix: the config edit must also edit
 * the baseline, visibly, in the same review. The baseline is GENERATED by
 * `node scripts/census-plan.mjs --write-population-baseline` — not hand-written.
 *
 * REFUSAL CODES: ROOT_CONFIG_MISSING, ROOT_CONFIG_UNREADABLE, CATALOG_UNREADABLE, GIT_READ_FAILED,
 *   ROOTS_NOT_DERIVED, ROOT_UNRESOLVED, ROOT_DROPPED_BY_EXCLUDE,
 *   CAPTURES_INVALID, TIMINGS_INPUT_UNREADABLE, TIMINGS_BAD_ROW, TIMINGS_NO_CENSUS_ROWS,
 *   GIT_READ_FAILED, PLAN_UNREADABLE, PLAN_SCHEMA_UNKNOWN, PLAN_DIGEST_MISMATCH,
 *   PLAN_TASK_DUPLICATE, PLAN_TASK_SET_CHANGED, PLAN_IDENTITY_DRIFT, PLAN_IDENTITY_UNRECORDED,
 *   PLAN_DIGEST_UNRECORDED, DIGEST_INVALID, IDENTITY_BUILD_UNRECORDED, DROPPED_ROOT_UNKNOWN,
 *   BALANCE_K_INVALID, ESTIMATES_UNKNOWN, NO_MODE, UNKNOWN_ARGUMENT, OUTPUT_UNWRITABLE,
 *   POPULATION_BASELINE_MISSING, POPULATION_SHRANK.
 *
 * @module scripts/census-plan
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CENSUS_COMMAND, censusVitestArgv } from './census-invocation.mjs'
import { DIGEST_SHAPE, IDENTITY_FIELDS, identityProblems, isValidDigest } from './census-digest.mjs'
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
/** The reviewed population baseline (per-root file counts + digests). Refuses shrink, not growth. */
export const POPULATION_BASELINE_REL = 'dev/ci/census-population-baseline.json'
export const POPULATION_BASELINE_SCHEMA = 'census-population-baseline/1'

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

/**
 * The per-root file-set digest: sha256 over the SORTED file list joined by newlines (`\n`, no
 * trailing newline). Relative paths, sorted, so the digest is independent of discovery order and of
 * the absolute checkout path.
 */
export function fileListDigest(files) {
  const list = (Array.isArray(files) ? files : []).map((f) => String(f).replace(/^\.\//, '')).sort()
  return `sha256:${createHash('sha256').update(list.join('\n')).digest('hex')}`
}

// ────────────────────────────────────────────────────────── root derivation ──

/**
 * The census root set, from the collection authority. No `cwd` argument is read from a config file
 * list of its own: `test-catalog.mjs` does the parsing, this function only filters to the ROOT
 * config's matches and names their roots.
 *
 * @param {{cwd?: string, allowDropped?: string[]}} [opts] `allowDropped` names roots whose
 *   exclude[]-removal is a DELIBERATE, recorded drop; anything else refuses (ROOT_DROPPED_BY_EXCLUDE).
 * @returns {{ok: true, roots: Array<{root: string, files: number}>, catalog_digest: string,
 *            file_count: number, roots_dropped: Array<{root: string, files_excluded: number}>} |
 *           {ok: false, code: string, detail: string}}
 */
export function deriveRoots({ cwd = process.cwd(), allowDropped = [] } = {}) {
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
  const byRoot = new Map()
  // A root whose only test-like files are excluded by the ROOT config's `exclude[]`. Counted, not
  // silently dropped: an 11-root census becoming a 10-root census is exactly the kind of quiet
  // shrinkage the multiset invariant cannot see (the lost root is simply not in C).
  const excluded = new Map()
  for (const entry of built.entries) {
    if (entry.classification === 'EXCLUDED_WITH_REASON' && entry.reason === 'vitest config exclude[]') {
      const lost = rootOfCensusPath(entry.path)
      if (lost !== 'unknown') excluded.set(lost, (excluded.get(lost) ?? 0) + 1)
    }
  }
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
    if (!byRoot.has(root)) byRoot.set(root, [])
    byRoot.get(root).push(String(entry.path).replace(/^\.\//, ''))
  }
  // THE POPULATION, not just its size: each root's sorted file list (relative to the root) and the
  // digest over it. Derived from the SAME catalog entries that produced the root name.
  const roots = [...byRoot.entries()]
    .map(([root, paths]) => {
      const rel = paths.map((p) => (p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p)).sort()
      return { root, files: rel.length, file_count: rel.length, files_expected: rel, file_digest: fileListDigest(rel) }
    })
    .sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0))
  const dropped = [...excluded.entries()]
    .filter(([root]) => !byRoot.has(root))
    .map(([root, files_excluded]) => ({ root, files_excluded }))
    .sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0))
  if (roots.length === 0) {
    return {
      ok: false,
      code: 'ROOTS_NOT_DERIVED',
      detail: `${ROOT_CONFIG} include[] matched no test file under any census root (include: ` +
        `${JSON.stringify(rootCfg.include)}) — an empty root set is not a small plan` +
        (dropped.length > 0
          ? ` (and ${String(dropped.length)} root(s) have files that exclude[] removes: ${dropped.map((d) => `${d.root}(${String(d.files_excluded)})`).join(', ')})`
          : ''),
    }
  }
  // Each dropped root must be named explicitly to proceed; naming a root that was NOT dropped is a
  // typo, not a permission, so it refuses rather than quietly permitting nothing.
  const allowed = new Set(allowDropped)
  const known = new Set(dropped.map((d) => d.root))
  const unknownAllowed = [...allowed].filter((root) => !known.has(root))
  if (unknownAllowed.length > 0) {
    return {
      ok: false,
      code: 'DROPPED_ROOT_UNKNOWN',
      detail: `--allow-dropped-root ${unknownAllowed.join(', ')} names a root that exclude[] did not drop ` +
        `(dropped: ${dropped.length === 0 ? 'none' : dropped.map((d) => d.root).join(', ')})`,
    }
  }
  if (dropped.some((d) => !allowed.has(d.root))) {
    const silent = dropped.filter((d) => !allowed.has(d.root))
    return {
      ok: false,
      code: 'ROOT_DROPPED_BY_EXCLUDE',
      detail: `${silent.length} census root(s) have test files that ${ROOT_CONFIG} exclude[] removes, so the ` +
        `plan would be SMALLER than the population: ${silent.map((d) => `${d.root} (${String(d.files_excluded)} file(s))`).join(', ')}. ` +
        'A smaller census that still aggregates to PASS is the failure this refuses; pass ' +
        `--allow-dropped-root <root> for each one to record the drop deliberately`,
    }
  }
  return {
    ok: true,
    roots,
    roots_dropped: dropped,
    catalog_digest: catalogDigestOf(state.entries),
    file_count: roots.reduce((a, r) => a + r.files, 0),
  }
}

// ────────────────────────────────────────────────── population baseline (F-02) ──

/**
 * The reviewed artifact for one derived root set. Reviewable because it is SMALL (one row per root)
 * and because any change to it is a visible line in the diff: a config edit that drops files must drop
 * them from this file too, in the same PR, or `POPULATION_SHRANK` refuses.
 */
export function populationBaselineOf(roots) {
  const rows = (Array.isArray(roots) ? roots : [])
    .map((r) => ({
      root: r.root,
      file_count: Array.isArray(r.files_expected) ? r.files_expected.length : (r.file_count ?? r.files ?? null),
      file_digest: r.file_digest ?? (Array.isArray(r.files_expected) ? fileListDigest(r.files_expected) : null),
    }))
    .sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0))
  return {
    schema: POPULATION_BASELINE_SCHEMA,
    note:
      'Reviewed census population baseline (TINF trust-closeout, F-02). Generated by ' +
      '`node scripts/census-plan.mjs --write-population-baseline` from the catalog discovery of the ' +
      'root vitest.config.ts; never hand-written. The census leg refuses POPULATION_SHRANK when a root ' +
      'loses files (or swaps them at an equal count) relative to this file. Updating it is the visible ' +
      'review act when the population intentionally shrinks.',
    file_count: rows.every((r) => Number.isFinite(r.file_count)) ? rows.reduce((n, r) => n + r.file_count, 0) : null,
    roots: rows,
  }
}

/**
 * Compare a freshly derived root set with the committed baseline. Growth is allowed (a new test is
 * not a shrink); loss is refused, including an equal-size replacement (same count, different digest)
 * because that is the "shrink one, add one" shape a count baseline cannot see.
 *
 * @returns {{ok: true, file_count: number, roots: number} | {ok: false, code: string, detail: string}}
 */
export function checkPopulationBaseline({ roots, baseline }) {
  if (!baseline || typeof baseline !== 'object' || baseline.schema !== POPULATION_BASELINE_SCHEMA) {
    return {
      ok: false,
      code: 'POPULATION_BASELINE_MISSING',
      detail:
        `${POPULATION_BASELINE_REL} is absent or is not ${POPULATION_BASELINE_SCHEMA} — without the reviewed ` +
        'baseline a config edit that shrinks the census would be indistinguishable from the truth; ' +
        'generate it with `node scripts/census-plan.mjs --write-population-baseline` and commit the result',
    }
  }
  const now = new Map((Array.isArray(roots) ? roots : []).map((r) => [r.root, r]))
  const shrunk = []
  for (const was of Array.isArray(baseline.roots) ? baseline.roots : []) {
    const cur = now.get(was.root)
    if (cur === undefined) {
      shrunk.push(`${was.root}: root absent (baseline ${String(was.file_count)} file(s))`)
      continue
    }
    const count = Array.isArray(cur.files_expected) ? cur.files_expected.length : (cur.file_count ?? cur.files ?? 0)
    const digest = cur.file_digest ?? (Array.isArray(cur.files_expected) ? fileListDigest(cur.files_expected) : null)
    if (count < was.file_count) shrunk.push(`${was.root}: ${String(count)} file(s) < baseline ${String(was.file_count)}`)
    else if (count === was.file_count && digest !== was.file_digest) {
      shrunk.push(`${was.root}: same count (${String(count)}) but a DIFFERENT file set (digest ${String(digest)} != baseline ${String(was.file_digest)})`)
    }
  }
  const total = [...now.values()].reduce((n, r) => n + (Array.isArray(r.files_expected) ? r.files_expected.length : (r.file_count ?? r.files ?? 0)), 0)
  if (shrunk.length === 0 && Number.isFinite(baseline.file_count) && total < baseline.file_count) {
    shrunk.push(`total: ${String(total)} file(s) < baseline ${String(baseline.file_count)}`)
  }
  if (shrunk.length > 0) {
    return {
      ok: false,
      code: 'POPULATION_SHRANK',
      detail:
        `the census population lost files relative to ${POPULATION_BASELINE_REL}: ${shrunk.slice(0, 6).join('; ')}` +
        `${shrunk.length > 6 ? ` (+${String(shrunk.length - 6)} more)` : ''} — if the shrink is intended, update the ` +
        'baseline in the SAME PR so the loss is a reviewed line; if it is not, restore the tests',
    }
  }
  return { ok: true, file_count: total, roots: now.size }
}

/** Read the committed baseline. Absence is data (`null`), not an exemption — see the check above. */
export function readPopulationBaseline({ cwd = process.cwd(), readFile = readFileSync } = {}) {
  const abs = resolve(cwd, POPULATION_BASELINE_REL)
  try {
    return { ok: true, baseline: JSON.parse(String(readFile(abs))) }
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ok: false, code: 'POPULATION_BASELINE_MISSING', detail: `${POPULATION_BASELINE_REL} does not exist` }
    return { ok: false, code: 'POPULATION_BASELINE_UNREADABLE', detail: `${POPULATION_BASELINE_REL}: ${String(e && e.message ? e.message : e)}` }
  }
}

// ───────────────────────────────────────────────────────────────── identity ──

/** Identity fields a plan records; `plan_digest` is derived from them, not read from a file. */
export { DIGEST_SHAPE, IDENTITY_FIELDS, isValidDigest }

/**
 * @param {object} p
 * @param {string} p.merge_tree_sha  tree id of the commit this plan is made on
 * @param {string} p.host_sha        `TEST_USE_BASELINE_SHA` from tests/paths.mjs
 * @param {string} p.catalog_digest  `test-catalog.mjs` digest of the catalog
 * @param {string|null} [p.build_digest] operator-supplied product build identity, null = unrecorded
 */
export function makeIdentity({ merge_tree_sha, host_sha, catalog_digest, build_digest = null }) {
  const identity = { merge_tree_sha, host_sha, catalog_digest, build_digest: build_digest ?? null }
  // `allowUnrecordedBuild: true` here: an operator who does not pass --build-digest records `null`
  // (which the aggregator then refuses to PASS), but a STRING that is not a digest is never recorded.
  // The three required fields may not be null at all.
  const malformed = identityProblems(identity, { scope: 'plan', allowUnrecordedBuild: true })
    .filter((problem) => problem.code === 'DIGEST_INVALID')
  if (malformed.length > 0) {
    const e = new Error(malformed.map((problem) => problem.detail).join('; '))
    e.code = 'DIGEST_INVALID'
    throw e
  }
  for (const field of ['merge_tree_sha', 'host_sha', 'catalog_digest']) {
    if (identity[field] === null || identity[field] === undefined) {
      const e = new Error(`makeIdentity: ${field} is required (${DIGEST_SHAPE})`)
      e.code = 'PLAN_IDENTITY_UNRECORDED'
      throw e
    }
  }
  return identity
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
    // THE POPULATION IS PART OF THE IDENTITY. A digest over root NAMES let a plan keep its digest
    // while a root lost files; the F-02 defect was exactly that "a count was recorded, not equality".
    file_count: plan.file_count ?? null,
    roots: (plan.roots ?? []).map((r) => ({
      root: r.root,
      files: r.files ?? null,
      file_count: r.file_count ?? null,
      files_expected: Array.isArray(r.files_expected) ? [...r.files_expected].sort() : null,
      file_digest: r.file_digest ?? null,
    })),
    // A recorded drop changes the census population. Leaving it out of the digest would let a plan be
    // edited from 0 to 3 dropped roots (or back) without any digest moving.
    // Defensive: a malformed `roots_dropped` must reach the aggregator's named refusal, not crash the
    // digest. (The plan-side builder always emits an array.)
    roots_dropped: (Array.isArray(plan.roots_dropped) ? plan.roots_dropped : []).map((d) => ({ root: d.root, files_excluded: d.files_excluded, allowed: d.allowed === true })),
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
export function buildPlan({ roots, captures, identity, testTimeout = null, timings = null, rootsDropped = [] }) {
  if (!Number.isInteger(captures) || captures < 1) {
    throw new Error(`buildPlan: captures must be a positive integer, got ${String(captures)}`)
  }
  // Validates the digest SHAPE. A throw here is a refusal, not a crash: every caller (CLI, verify,
  // tests) either catches it or is asserting the throw.
  const checkedIdentity = makeIdentity(identity)
  const sorted = [...roots].sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0))
  const groups = []
  const tasks = []
  for (const { root } of sorted) {
    const groupId = `capture-pair:${root}`
    const groupTaskIds = []
    for (let capture = 1; capture <= captures; capture += 1) {
      const task_id = taskIdOf(root, capture)
      const jsonPath = taskReportPath(task_id)
      // Per TASK first: a `census-root` row is already (root, attempt), so the most precise estimate
      // for `census:<root>#<capture>` is that attempt's own measurement. The per-root median is the
      // fallback (e.g. a plan with more captures than the timing file has attempts).
      const est = timings?.byTask?.get(`${root}#${String(capture)}`)
        ?? (timings?.byRoot instanceof Map ? timings.byRoot.get(root) : undefined)
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
  // Normalise the per-root population. A root that carries an expected list gets its count and digest
  // RECOMPUTED from that list (never trusted from the caller); a root with only a count keeps
  // `files` (synthetic fixtures) but declares no file_digest — the aggregator refuses to PASS a plan
  // whose population is not enumerable, so this is a test/fixture shape only, not a production one.
  const rootsOut = sorted.map((r) => {
    const list = Array.isArray(r.files_expected) ? [...r.files_expected].map(String).sort() : null
    const count = list !== null ? list.length : (Number.isFinite(r.file_count) ? r.file_count : (Number.isFinite(r.files) ? r.files : null))
    if (list !== null && Number.isFinite(r.file_count) && r.file_count !== list.length) {
      throw Object.assign(new Error(`buildPlan: root ${r.root} declares file_count=${String(r.file_count)} but files_expected has ${String(list.length)} entries`), { code: 'POPULATION_INCONSISTENT' })
    }
    return {
      root: r.root,
      files: count,
      file_count: count,
      ...(list === null ? {} : { files_expected: list, file_digest: fileListDigest(list) }),
    }
  })
  const totalFiles = rootsOut.every((r) => Number.isFinite(r.file_count)) ? rootsOut.reduce((n, r) => n + r.file_count, 0) : null
  const plan = {
    schema: SCHEMA,
    identity: { ...checkedIdentity },
    captures,
    test_timeout_ms: testTimeout,
    file_count: totalFiles,
    roots: rootsOut,
    roots_dropped: rootsDropped.map((d) => ({ root: d.root, files_excluded: d.files_excluded, allowed: true })),
    groups,
    tasks,
    timings: {
      statistic: 'per-attempt census-root window_ms where the timing file has that attempt, else the ' +
        'per-root median (nearest-rank, as tinf-timing.mjs publishes it)',
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
  // 0. the identity block itself. A plan with `merge_tree_sha: null` (or `"null"`) is not a plan whose
  //    identity "matches" anything — the digest comparison below must never be reached by a plan whose
  //    recorded identity is not an identity.
  const identityBad = identityProblems(plan.identity, { scope: 'plan', allowUnrecordedBuild: true })
  if (identityBad.length > 0) {
    return { ok: false, codes: [...new Set(identityBad.map((p) => p.code))], detail: identityBad.map((p) => p.detail) }
  }
  if (!isValidDigest(plan.identity?.plan_digest)) {
    return {
      ok: false,
      codes: ['PLAN_DIGEST_UNRECORDED'],
      detail: [`plan.identity.plan_digest ${plan.identity?.plan_digest === undefined ? 'is absent' : `is ${JSON.stringify(plan.identity.plan_digest)}`} (${DIGEST_SHAPE})`],
    }
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
    // A plan built with `--allow-dropped-root` is a LEGAL plan that records its drop. Re-deriving it
    // without those permissions made `--verify-plan` refuse ROOT_DROPPED_BY_EXCLUDE on exactly the
    // plans the CLI had blessed — the command could not verify the only kind of plan that needed it.
    // So: derive without permissions first; if (and only if) the refusal is the dropped-root one,
    // retry naming the plan's OWN recorded `allowed: true` entries. A drop the plan did not record
    // still refuses (the retry names nothing for it), and a recorded drop the tree no longer performs
    // is a changed population, reported as PLAN_TASK_SET_CHANGED below rather than as a shape error.
    let roots = deriveRoots({ cwd })
    if (!roots.ok && roots.code === 'ROOT_DROPPED_BY_EXCLUDE') {
      const recorded = (Array.isArray(plan.roots_dropped) ? plan.roots_dropped : [])
        .filter((d) => d && d.allowed === true && typeof d.root === 'string')
        .map((d) => d.root)
      if (recorded.length > 0) {
        const retried = deriveRoots({ cwd, allowDropped: recorded })
        if (!retried.ok && retried.code === 'DROPPED_ROOT_UNKNOWN') {
          return {
            refusal: {
              code: 'PLAN_TASK_SET_CHANGED',
              detail: `the plan records allowed drop(s) [${recorded.join(', ')}] but the current tree no longer drops every one of them ` +
                `(${retried.detail}) — a root that came back is a different census population, not a verification failure to hide`,
            },
          }
        }
        roots = retried
      }
    }
    if (!roots.ok) return { refusal: roots }
    let currentPlanObject
    try {
      currentPlanObject = buildPlan({
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
        rootsDropped: roots.roots_dropped ?? [],
      })
    } catch (e) {
      return { refusal: { code: e.code ?? 'DIGEST_INVALID', detail: String(e.message) } }
    }
    return { plan: currentPlanObject }
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
  const droppedWas = (plan.roots_dropped ?? []).map((d) => d.root).sort()
  const droppedNow = (current.plan.roots_dropped ?? []).map((d) => d.root).sort()
  if (JSON.stringify(droppedWas) !== JSON.stringify(droppedNow)) {
    codes.push('PLAN_TASK_SET_CHANGED')
    detail.push(`dropped-root set changed: plan=[${droppedWas.join(', ')}] current=[${droppedNow.join(', ')}] — a different ` +
      'population is a different census, even when the surviving task ids are the same')
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
    // `matches_lower_bound` says the search reached the information-theoretic floor. Exhaustive search
    // can PROVE a makespan that is above the floor is still the minimum (discrete unit weights), so
    // "did it hit the floor" and "is it optimal" are different questions and are named separately.
    matches_lower_bound: makespan === lowerBound,
    optimal_guarantee: method.startsWith('exhaustive')
      ? 'minimum makespan proven by exhaustive search over indivisible units'
      : 'heuristic (greedy LPT + single-move local search); not proven minimal',
    est_note:
      'load_ms is the SUM of the shard\'s per-task medians — a WORK metric, not wall clock. In the real ' +
      'census every root runs CONCURRENTLY inside one capture, so a shard\'s wall clock is roughly ' +
      'captures × max(root median in that shard), not the sum (tinf-timing window semantics).',
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
  // `root#attempt` -> that attempt's own duration. Only `ok` rows: a failed span is not a duration,
  // and rendering it as 0 ms would make a broken root look free.
  const byTask = new Map()
  for (const row of rows) {
    if (row.phase !== 'census-root' || row.status !== 'ok') continue
    const ms = Number(row.duration_ms)
    if (!Number.isFinite(ms)) continue
    const key = `${row.root}#${String(Number(row.attempt))}`
    if (!byTask.has(key)) byTask.set(key, ms)
  }
  return { ok: true, byRoot, byTask, source_files: collected.files, report }
}

// ───────────────────────────────────────────────────────────────────── cli ──

const HELP = [
  'usage: node scripts/census-plan.mjs --plan [--out FILE] [--captures N] [--test-timeout MS]',
  '                                      [--timings FILE ...] [--build-digest DIGEST] [--balance K]',
  '                                      [--allow-dropped-root ROOT ...]',
  '       node scripts/census-plan.mjs --verify-plan FILE',
  '       node scripts/census-plan.mjs --write-population-baseline [--out FILE]',
  '       node scripts/census-plan.mjs --self-test',
  '',
  '  --plan              print the census-plan/1 artifact (stdout, or --out FILE)',
  '  --captures N        captures per root (default 2; the L2 census invocation)',
  '  --test-timeout MS   the clock the runner passes to vitest; omitted = the suite default',
  '  --timings FILE...   tinf-timing/1 tsv file(s) for est_ms (load-balancing hint only)',
  '  --build-digest D    product build identity recorded in the plan (default: unrecorded).',
  '                      Must be sha256:<64 hex> or <40 hex>; "null"/""/" " are refused, not recorded.',
  '  --allow-dropped-root R  record (do not hide) that exclude[] removes every file of root R;',
  '                      without it a dropped root is ROOT_DROPPED_BY_EXCLUDE (exit 2)',
  '  --balance K         print the group-to-shard assignment for K shards instead of the plan',
  '  --verify-plan FILE  re-derive and refuse on digest / identity / task-set drift',
  '  --write-population-baseline  regenerate dev/ci/census-population-baseline.json from discovery',
  '  --out FILE          with --write-population-baseline: write there instead of the default path',
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
    writePopulationBaseline: false, allowDropped: [],
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--plan') opts.plan = true
    else if (a === '--out') opts.out = argv[++i] ?? null
    else if (a === '--captures') opts.captures = Number(argv[++i])
    else if (a === '--test-timeout') opts.testTimeout = Number(argv[++i])
    else if (a === '--timings') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.timings.push(argv[++i]) }
    else if (a === '--build-digest') opts.buildDigest = argv[++i] ?? null
    else if (a === '--allow-dropped-root') {
      const root = argv[++i] ?? null
      if (root === null || root.startsWith('--')) throw Object.assign(new Error('--allow-dropped-root needs a root name'), { code: 'UNKNOWN_ARGUMENT' })
      opts.allowDropped.push(root)
    }
    else if (a === '--balance') opts.balance = Number(argv[++i])
    else if (a === '--verify-plan') opts.verifyPlan = argv[++i] ?? null
    else if (a === '--write-population-baseline') opts.writePopulationBaseline = true
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
  // A digest is a digest at the CLI boundary too: `--build-digest null` must not become the string
  // "null" in a plan file (M4 review round 1 bypass).
  if (opts.buildDigest !== null && !isValidDigest(opts.buildDigest)) {
    return {
      refusal: {
        code: 'DIGEST_INVALID',
        detail: `--build-digest ${JSON.stringify(opts.buildDigest)} is not a digest (${DIGEST_SHAPE}); ` +
          'omit the flag to record build_digest: null (which the aggregator refuses to PASS)',
      },
    }
  }
  const roots = deriveRoots({ cwd: process.cwd(), allowDropped: opts.allowDropped })
  if (!roots.ok) return { refusal: roots }
  if (!Number.isInteger(opts.captures) || opts.captures < 1) {
    return { refusal: { code: 'CAPTURES_INVALID', detail: `--captures must be a positive integer, got ${String(opts.captures)}` } }
  }
  let timings = null
  if (opts.timings.length > 0) {
    const loaded = loadTimings(opts.timings)
    if (!loaded.ok) return { refusal: loaded }
    timings = { byRoot: loaded.byRoot, byTask: loaded.byTask, source_files: loaded.source_files }
  }
  let plan
  try {
    plan = buildPlan({
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
      rootsDropped: roots.roots_dropped ?? [],
    })
  } catch (e) {
    return { refusal: { code: e.code ?? 'DIGEST_INVALID', detail: String(e && e.message ? e.message : e) } }
  }
  return { plan, roots }
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

  if (opts.writePopulationBaseline) {
    const roots = deriveRoots({ cwd: process.cwd(), allowDropped: opts.allowDropped })
    if (!roots.ok) return refuse(roots.code, roots.detail)
    const baseline = populationBaselineOf(roots.roots)
    const out = opts.out ?? resolve(process.cwd(), POPULATION_BASELINE_REL)
    try {
      writeFileSync(out, `${JSON.stringify(baseline, null, 2)}\n`)
    } catch (e) {
      return refuse('OUTPUT_UNWRITABLE', `${out}: ${String(e && e.message ? e.message : e)}`)
    }
    process.stdout.write(`DSH-CENSUS-POPULATION-BASELINE written=ok roots=${String(baseline.roots.length)} ` +
      `files=${String(baseline.file_count)} catalog=${roots.catalog_digest} out=${out}\n`)
    return 0
  }

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
  const TREE = '1'.repeat(40)
  const HOST = '2'.repeat(40)
  const CAT = `sha256:${'3'.repeat(64)}`
  const BUILD = `sha256:${'4'.repeat(64)}`
  const identity = makeIdentity({ merge_tree_sha: TREE, host_sha: HOST, catalog_digest: CAT, build_digest: BUILD })
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
  const perAttempt = buildPlan({
    roots: [{ root: 'packages/a' }],
    captures: 2,
    identity,
    timings: { byRoot: new Map([['packages/a', 500]]), byTask: new Map([['packages/a#2', 77]]) },
  })
  ok('a per-attempt row beats the root median for that task',
    perAttempt.tasks[0].est_ms === 500 && perAttempt.tasks[1].est_ms === 77,
    JSON.stringify(perAttempt.tasks.map((t) => t.est_ms)))
  ok('an estimate never removes a task', measured.tasks.length === 4, String(measured.tasks.length))
  ok('unknown roots are named, not hidden', JSON.stringify(measured.timings.unknown_roots) === '["packages/b"]', JSON.stringify(measured.timings.unknown_roots))

  // digest: canonical, order-independent for objects, order-SENSITIVE for the task list
  ok('canonical JSON sorts object keys', canonicalJson({ b: 1, a: 2 }) === '{"a":2,"b":1}', canonicalJson({ b: 1, a: 2 }))
  // Every task field is covered: mutating ANY one of them must move the digest. A "digest of a
  // round-tripped copy equals itself" case would pass even if the payload dropped the tasks entirely.
  const fieldEdits = [
    ['root', (t) => { t.root = 'packages/zz' }],
    ['capture', (t) => { t.capture = 9 }],
    ['group', (t) => { t.group = 'capture-pair:other' }],
    ['est_ms', (t) => { t.est_ms = 1 }],
    ['task_id', (t) => { t.task_id = 'census:packages/zz#1' }],
    ['runner', (t) => { t.runner.argv.push('--testTimeout=1') }],
  ]
  const unmoved = fieldEdits.filter(([, edit]) => {
    const copy = JSON.parse(JSON.stringify(plan))
    edit(copy.tasks[0])
    return planDigest(copy) === plan.identity.plan_digest
  }).map(([name]) => name)
  ok('editing ANY task field moves the digest', unmoved.length === 0, `unmoved: ${unmoved.join(',') || 'none'}`)
  const reordered = JSON.parse(JSON.stringify(plan))
  reordered.tasks.reverse()
  ok('reordering tasks changes the digest', planDigest(reordered) !== plan.identity.plan_digest, 'digest')
  const reCaptured = JSON.parse(JSON.stringify(plan))
  reCaptured.captures = 1
  ok('editing the capture count moves the digest', planDigest(reCaptured) !== plan.identity.plan_digest, 'captures')

  // verify: a plan verifies against a CURRENT plan derived from the same population in a different
  // input order (order-insensitivity), not merely against itself.
  const permuted = buildPlan({ roots: [roots[1], roots[0]], captures: 2, identity })
  ok('verify: an unchanged population verifies (root input order does not matter)',
    verifyPlan(plan, { currentPlan: { plan: permuted } }).ok === true,
    JSON.stringify(verifyPlan(plan, { currentPlan: { plan: permuted } }).codes))
  const stale = JSON.parse(JSON.stringify(plan))
  stale.tasks[0].capture = 9
  ok('verify: an edit without a new digest is PLAN_DIGEST_MISMATCH',
    verifyPlan(stale, { currentPlan: { plan: stale } }).codes.includes('PLAN_DIGEST_MISMATCH'), JSON.stringify(verifyPlan(stale, { currentPlan: { plan: stale } }).codes))
  const other = buildPlan({
    roots,
    captures: 2,
    identity: makeIdentity({ merge_tree_sha: '9'.repeat(40), host_sha: HOST, catalog_digest: CAT, build_digest: BUILD }),
  })
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

  // digest shape (M4 review round 1, blocking): the sentinels must never become a recorded value
  const base = { merge_tree_sha: TREE, host_sha: HOST, catalog_digest: CAT }
  const sentinels = ['null', 'undefined', '', ' ', 'NULL', `${'a'.repeat(39)}`, `${'a'.repeat(65)}`, `sha256:${'A'.repeat(64)}`, TREE.slice(0, 39)]
  const accepted = sentinels.filter((v) => {
    try {
      makeIdentity({ ...base, build_digest: v })
      return true
    } catch {
      return false
    }
  })
  ok('every digest sentinel / wrong-length / wrong-case value is refused', accepted.length === 0, `accepted: ${JSON.stringify(accepted)}`)
  ok('a bare 40-hex and a sha256:64-hex digest are both accepted',
    isValidDigest(TREE) && isValidDigest(CAT) && !isValidDigest(`sha1:${TREE}`), JSON.stringify([TREE, CAT]))
  let unrecordedCode = null
  try {
    makeIdentity({ ...base, merge_tree_sha: null })
  } catch (e) {
    unrecordedCode = e.code
  }
  ok('a required identity field may not be null', unrecordedCode === 'PLAN_IDENTITY_UNRECORDED', String(unrecordedCode))
  const nullBuild = makeIdentity({ ...base })
  ok('build_digest may be null (unrecorded) but is recorded as null, not a string', nullBuild.build_digest === null, String(nullBuild.build_digest))
  const badPlan = JSON.parse(JSON.stringify(plan))
  badPlan.identity.build_digest = 'null'
  ok('verify: a sentinel string in a plan file is DIGEST_INVALID',
    verifyPlan(badPlan, { currentPlan: { plan } }).codes.includes('DIGEST_INVALID'), JSON.stringify(verifyPlan(badPlan, { currentPlan: { plan } }).codes))
  const nullPlan = JSON.parse(JSON.stringify(plan))
  nullPlan.identity.merge_tree_sha = null
  ok('verify: a null identity field in a plan file is PLAN_IDENTITY_UNRECORDED',
    verifyPlan(nullPlan, { currentPlan: { plan } }).codes.includes('PLAN_IDENTITY_UNRECORDED'), JSON.stringify(verifyPlan(nullPlan, { currentPlan: { plan } }).codes))

  // dropped roots: recorded in the plan, part of the digest, and never silently zero
  const droppedPlan = buildPlan({ roots, captures: 2, identity, rootsDropped: [{ root: 'packages/c', files_excluded: 2 }] })
  ok('a dropped root is recorded with its excluded file count',
    droppedPlan.roots_dropped.length === 1 && droppedPlan.roots_dropped[0].root === 'packages/c' &&
    droppedPlan.roots_dropped[0].files_excluded === 2 && droppedPlan.roots_dropped[0].allowed === true,
    JSON.stringify(droppedPlan.roots_dropped))
  const droppedEdited = JSON.parse(JSON.stringify(droppedPlan))
  droppedEdited.roots_dropped[0].files_excluded = 3
  ok('editing a dropped-root record moves the digest', planDigest(droppedEdited) !== droppedPlan.identity.plan_digest, 'digest')
  ok('a plan with no drops says so explicitly', Array.isArray(plan.roots_dropped) && plan.roots_dropped.length === 0, JSON.stringify(plan.roots_dropped))

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
