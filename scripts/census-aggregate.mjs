#!/usr/bin/env node
/**
 * census-aggregate.mjs — TINF M4: the census shard aggregator (`census-summary/1`), SHADOW.
 *
 * WHAT IT IS. One function that takes a `census-plan/1` plan and the shard result artifacts a sharded
 * census produced, applies spec §5's fail-closed rules 1–6 IN ORDER, and answers PASS or a named
 * non-PASS with the reason. The single law it exists to enforce: **a shard's exit 0 is not a verdict.**
 * A shard can exit 0 while its own results carry a FAIL, a missing second capture, or an empty task
 * list; every one of those must aggregate to non-PASS, and every one is negative-controlled in
 * `scripts/census-aggregate.test.mjs`.
 *
 * WHAT IT IS NOT (spec §5.7, verbatim intent). This tool is NOT an authority:
 *   - it is NOT wired to `ci-required`, `ci-census`, `eb3-ci-required.mjs` or any Required context;
 *   - it writes NO artifact that a Required context reads — the real consumption path is the layer
 *     verdict token plus `eb3-merge-tree.mjs --grade-needs`, and there is no aggregate artifact in it;
 *   - nothing protects a branch by consulting its output;
 *   - it does not run, schedule or shard anything. It reads files and decides, and its PASS is a
 *     statement about the artifacts it was handed, not about the world.
 * Turning it into a merge gate would change the manifest shape and is a separately reviewed change.
 *
 * THE RULES (spec §5, in this order; each refusal/gate names its code)
 *   1. POLICY + PLAN DIGEST. The shard's `policy_digest` must be this module's (POLICY_DIGEST), and
 *      the plan's declared digest must equal a digest recomputed from the plan's own tasks+identity.
 *      A shard carrying a different plan_digest came from another plan (PLAN_DIGEST_MISMATCH).
 *   2. STRUCTURE. Every shard must be parseable JSON with a known schema, a unique shard id, unique
 *      task ids (within a shard and across shards), a known status, known terminal states, and — per
 *      result — an identity of its own: `root` and `capture` that MATCH the plan task that id encodes
 *      (RESULT_ROOT_MISMATCH / RESULT_CAPTURE_MISMATCH) and a non-empty `evidence` reference
 *      (RESULT_EVIDENCE_MISSING). Keying on task_id alone let capture-2 ids carry capture-1 data.
 *   3. IDENTITY. The PLAN's identity must be five real digests before anything can match it
 *      (`sha256:<64 hex>` or `<40 hex>`, `scripts/census-digest.mjs`): a null field is
 *      PLAN_IDENTITY_UNRECORDED / IDENTITY_BUILD_UNRECORDED and a sentinel string is DIGEST_INVALID,
 *      never a match. Then all five fields (merge_tree_sha, host_sha, plan_digest, catalog_digest,
 *      build_digest) must equal the plan's, exactly, and a shard value that agrees with the plan but
 *      is not a digest still refuses (DIGEST_INVALID) — equality of two non-digests proves nothing.
 *   4. MULTISET + TERMINAL STATE. expected task ids == observed task ids as a multiset; every planned
 *      task has a terminal state; no task outside the plan. Missing / extra / unterminated are
 *      INCOMPLETE, never green.
 *   5. ORACLES. Every required oracle contract in the plan must appear on every PASS task with a
 *      decidable, passing state. Missing/undecidable/failed oracles are not green.
 *   6. VERDICT. Only if 1–5 all hold is the census_verdict PASS. Otherwise the verdict names the
 *      class, with precedence FAIL > INFRA_ERROR > CANCELLED > INCOMPLETE, and the code list says
 *      exactly which rule fired.
 *
 * TERMINAL STATES (per task): PASS | FAIL | INCOMPLETE | INFRA_ERROR | CANCELLED.
 * SHARD STATUS (per shard):    COMPLETED | INCOMPLETE | INFRA_ERROR | CANCELLED.
 *
 * USAGE
 *   node scripts/census-aggregate.mjs --aggregate <shard.json...> --plan <plan.json> [--json]
 *   node scripts/census-aggregate.mjs --self-test
 *
 * REFUSAL CODES added by review round 1: DIGEST_INVALID, PLAN_IDENTITY_UNRECORDED,
 *   PLAN_DIGEST_UNRECORDED, RESULT_ROOT_MISMATCH, RESULT_CAPTURE_MISMATCH, RESULT_EVIDENCE_MISSING,
 *   PLAN_ROOTS_DROPPED_MALFORMED.
 *
 * Exit: 0 PASS | 1 non-PASS | 2 REFUSED (a named refusal; nothing is graded).
 *
 * @module scripts/census-aggregate
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DIGEST_SHAPE, identityProblems, isValidDigest } from './census-digest.mjs'
import { IDENTITY_FIELDS, SCHEMA as PLAN_SCHEMA, buildPlan, digestJson, makeIdentity, planDigest } from './census-plan.mjs'

export const SCHEMA = 'census-summary/1'
export const SHARD_SCHEMA = 'census-shard/1'
/** Captures the L2 census is defined as. A plan below this is a smaller population, not a plan. */
export const REQUIRED_CAPTURES = 2

export const TASK_STATES = Object.freeze(['PASS', 'FAIL', 'INCOMPLETE', 'INFRA_ERROR', 'CANCELLED'])
export const SHARD_STATES = Object.freeze(['COMPLETED', 'INCOMPLETE', 'INFRA_ERROR', 'CANCELLED'])
/** The only state that is green. Everything else is enumerated, never the other way round. */
export const PASS = 'PASS'

/** Verdict precedence when several rules fail at once. */
const VERDICT_ORDER = ['FAIL', 'INFRA_ERROR', 'CANCELLED', 'INCOMPLETE']

/**
 * The policy this file implements. It is a CONSTANT inside the aggregator on purpose: the thing that
 * decides must not be something a shard (or a PR under test) can hand in. A shard declares this digest
 * so a result produced under a different rule set refuses instead of being graded by these rules.
 */
export const POLICY = Object.freeze({
  schema: 'census-policy/1',
  version: 1,
  rules: Object.freeze([
    'policy-and-plan-digest',
    'task-id-uniqueness-and-shard-parseability',
    'identity-equality',
    'expected-vs-observed-multiset-and-terminal-state',
    'required-oracle-contracts',
    'non-green-on-any-failure',
  ]),
})
export const POLICY_DIGEST = digestJson(POLICY)

const sha256Bytes = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`

// ─────────────────────────────────────────────────────────────── result shape ──

/** A refusal (exit 2) means "nothing was graded"; a failure (exit 1) means "graded, and not green". */
function refused(codes, detail, extra = {}) {
  // `summary: null` is part of the contract: a refusal GRADED NOTHING, so there is no expected/observed
  // delta for a reader to mistake for a measurement.
  return { ok: false, refused: true, verdict: null, codes: [...new Set(codes)], detail, summary: null, ...extra }
}

function graded(verdict, codes, detail, extra = {}) {
  return { ok: verdict === PASS, refused: false, verdict, codes: [...new Set(codes)], detail, ...extra }
}

/** Read one shard artifact from a file: bytes -> digest + text. Never throws; refusal is data. */
export function readShardFile(file, { readFile = readFileSync } = {}) {
  const abs = resolve(file)
  try {
    const buffer = readFile(abs)
    return { file, text: Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer) }
  } catch (e) {
    return { file, text: null, unreadable: `${abs}: ${String(e && e.message ? e.message : e)}` }
  }
}

/** A shard input built from an object, so a test states only the field it is about. */
export function shardOf(file, json) {
  return { file, text: `${JSON.stringify(json, null, 2)}\n` }
}

// ──────────────────────────────────────────────────────────────── aggregation ──

/**
 * Aggregate. Pure: `plan` and `shards` are data, so the self-test and the CLI reach the same code.
 *
 * @param {object} p
 * @param {object} p.plan      a parsed `census-plan/1` artifact
 * @param {Array<{file: string, text: string|null, unreadable?: string}>} p.shards
 * @returns {{ok: boolean, refused: boolean, verdict: string|null, codes: string[], detail: string[],
 *            summary: object|null}}
 */
export function aggregate({ plan, shards }) {
  const detail = []
  const codes = []

  // ── rule 1: policy + plan digest ────────────────────────────────────────────────────────────────
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return refused(['PLAN_UNREADABLE'], ['the plan is not an object'])
  }
  if (plan.schema !== PLAN_SCHEMA) {
    return refused(['PLAN_SCHEMA_UNKNOWN'], [`plan.schema must be ${PLAN_SCHEMA}, got ${String(plan.schema)}`])
  }
  // The identity block first: a plan with `merge_tree_sha: null` (or the string "null") used to
  // "match" shards carrying the same nothing. A null field is a refusal on its own; a sentinel string
  // is DIGEST_INVALID. This runs before the digest recomputation so the message names the real problem.
  const planIdentityProblems = identityProblems(plan.identity, { scope: 'plan' })
  if (planIdentityProblems.length > 0) {
    return refused(
      [...new Set(planIdentityProblems.map((problem) => problem.code))],
      planIdentityProblems.map((problem) => problem.detail),
    )
  }
  if (!isValidDigest(plan.identity?.plan_digest)) {
    return refused(
      ['PLAN_DIGEST_UNRECORDED'],
      [`plan.identity.plan_digest ${plan.identity?.plan_digest === undefined ? 'is absent' : `is ${JSON.stringify(plan.identity.plan_digest)}`} (${DIGEST_SHAPE})`],
    )
  }
  if (plan.roots_dropped !== undefined && !Array.isArray(plan.roots_dropped)) {
    return refused(['PLAN_ROOTS_DROPPED_MALFORMED'], ['plan.roots_dropped must be an array of {root, files_excluded, allowed}'])
  }
  for (const drop of plan.roots_dropped ?? []) {
    if (!drop || typeof drop !== 'object' || typeof drop.root !== 'string' || drop.root === '' ||
        !Number.isInteger(drop.files_excluded) || drop.files_excluded < 1 || drop.allowed !== true) {
      return refused(
        ['PLAN_ROOTS_DROPPED_MALFORMED'],
        [`plan.roots_dropped entry ${JSON.stringify(drop)} is not {root: <non-empty string>, files_excluded: <positive integer>, allowed: true} — ` +
          'a drop that is not explicitly allowed and counted is a silent one'],
      )
    }
  }
  const expectedTaskIds = (plan.tasks ?? []).map((t) => t.task_id)
  if (expectedTaskIds.length === 0) {
    return refused(['PLAN_TASK_SET_EMPTY'], ['the plan enumerates no task; an empty plan would make every shard set vacuously complete'])
  }
  if (new Set(expectedTaskIds).size !== expectedTaskIds.length) {
    return refused(['PLAN_TASK_DUPLICATE'], [`the plan names ${expectedTaskIds.length} tasks but only ${new Set(expectedTaskIds).size} distinct ids`])
  }
  if (!Number.isInteger(plan.captures) || plan.captures < REQUIRED_CAPTURES) {
    // The "missing second capture" control. A one-capture plan is self-consistent and would aggregate
    // to PASS, which is exactly the fail-open this refusal exists to prevent: the L2 population is
    // two captures per root, and a plan with one is a smaller claim wearing the same name.
    return refused(
      ['CAPTURES_INSUFFICIENT'],
      [`the plan declares ${String(plan.captures)} capture(s) per root; the L2 census population is ` +
        `${String(REQUIRED_CAPTURES)} (a single-capture plan is a smaller population, not a shard layout)`],
    )
  }
  const recomputedPlanDigest = planDigest(plan)
  if (recomputedPlanDigest !== plan.identity?.plan_digest) {
    return refused(
      ['PLAN_DIGEST_MISMATCH'],
      [`plan.identity.plan_digest=${String(plan.identity?.plan_digest)} but the plan's own tasks+identity ` +
        `digest to ${recomputedPlanDigest} — the plan was edited after it was signed`],
    )
  }
  if (!Array.isArray(shards) || shards.length === 0) {
    return refused(['NO_SHARDS'], ['no shard artifact was given; nothing to aggregate'])
  }

  const parsed = []
  for (const shard of shards) {
    const file = shard.file ?? '(unnamed)'
    if (shard.unreadable) return refused(['SHARD_UNREADABLE'], [`${file}: ${shard.unreadable}`])
    if (typeof shard.text !== 'string') return refused(['SHARD_UNREADABLE'], [`${file}: no text was read`])
    const digest = sha256Bytes(Buffer.from(shard.text, 'utf8'))
    let json
    try {
      json = JSON.parse(shard.text)
    } catch (e) {
      // A truncated artifact is the classic half-uploaded shard. Its absence of a parse is not "no
      // results", so it refuses here rather than becoming an INCOMPLETE verdict that looks measured.
      return refused(['SHARD_UNPARSEABLE'], [`${file}: ${String(e && e.message ? e.message : e)}`])
    }
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
      return refused(['SHARD_UNPARSEABLE'], [`${file}: the artifact is ${Array.isArray(json) ? 'an array' : typeof json}, not a census-shard object`])
    }
    if (json.schema !== SHARD_SCHEMA) {
      return refused(['SHARD_SCHEMA_UNKNOWN'], [`${file}: schema must be ${SHARD_SCHEMA}, got ${String(json.schema)}`])
    }
    parsed.push({ file, digest, json })
  }

  // policy: the rule set that produced the result must be the one grading it.
  for (const { file, json } of parsed) {
    if (json.policy_digest !== POLICY_DIGEST) {
      return refused(
        ['POLICY_DIGEST_MISMATCH'],
        [`${file}: policy_digest=${String(json.policy_digest)} but this aggregator implements ${POLICY_DIGEST} ` +
          `(${POLICY.schema} v${String(POLICY.version)}) — a result produced under other rules is not graded by these`],
      )
    }
  }
  // plan: a shard from another plan is the "mixed tree" failure even if its own fields look coherent.
  for (const { file, json } of parsed) {
    if (json.identity?.plan_digest !== plan.identity.plan_digest) {
      return refused(
        ['PLAN_DIGEST_MISMATCH'],
        [`${file}: ran plan_digest=${String(json.identity?.plan_digest)} but the plan given is ` +
          `${String(plan.identity.plan_digest)} — the shard executed a different plan`],
      )
    }
  }

  // ── rule 2: shard structure, task-id uniqueness, parseability, per-result identity ────────────
  const shardIds = new Set()
  const seenTask = new Map()
  // The plan is the only authority on what a task id MEANS. The check maps id -> plan task, so a
  // result cannot re-label capture 2's data as capture 1's by carrying a different root/capture.
  const planTaskById = new Map((plan.tasks ?? []).map((task) => [task.task_id, task]))
  for (const { file, json } of parsed) {
    if (json.shard_id === undefined || json.shard_id === null || String(json.shard_id).trim() === '') {
      return refused(['SHARD_ID_MISSING'], [`${file}: shard_id is required (a shard with no name cannot be counted)`])
    }
    const id = String(json.shard_id)
    if (shardIds.has(id)) return refused(['SHARD_ID_DUPLICATE'], [`shard id ${JSON.stringify(id)} appears more than once (${file})`])
    shardIds.add(id)
    if (!SHARD_STATES.includes(json.status)) {
      return refused(['SHARD_STATUS_UNKNOWN'], [`${file}: status must be one of ${SHARD_STATES.join('|')}, got ${String(json.status)}`])
    }
    if (!Array.isArray(json.results)) {
      return refused(['SHARD_UNPARSEABLE'], [`${file}: results must be an array (a shard that reports no list is not an empty run)`])
    }
    for (const result of json.results) {
      if (result === null || typeof result !== 'object' || typeof result.task_id !== 'string' || result.task_id === '') {
        return refused(['TASK_ID_MISSING'], [`${file}: every result needs a string task_id`])
      }
      if (seenTask.has(result.task_id)) {
        // Within one shard or across shards: a task reported twice means the multiset has a duplicate,
        // and a duplicate is how a lost task hides (two rows for one id, none for another).
        return refused(
          ['SHARD_TASK_ID_DUPLICATE'],
          [`task ${JSON.stringify(result.task_id)} is reported by ${seenTask.get(result.task_id)} and by ${file}`],
        )
      }
      seenTask.set(result.task_id, file)
      // Per-result identity. The spec asks for a terminal state plus a raw reference per task; a
      // result that names no root/capture cannot be checked against the plan, and one that names the
      // WRONG root/capture is how capture-1 data gets reported under a capture-2 id.
      const planned = planTaskById.get(result.task_id)
      if (planned !== undefined) {
        if (result.root !== planned.root) {
          return refused(
            ['RESULT_ROOT_MISMATCH'],
            [`${file}: task ${result.task_id} reports root ${JSON.stringify(result.root)} but the plan's task is ` +
              `root ${JSON.stringify(planned.root)}`],
          )
        }
        if (result.capture !== planned.capture) {
          return refused(
            ['RESULT_CAPTURE_MISMATCH'],
            [`${file}: task ${result.task_id} reports capture ${JSON.stringify(result.capture)} but the plan's task is ` +
              `capture ${JSON.stringify(planned.capture)}`],
          )
        }
      }
      if (typeof result.evidence !== 'string' || result.evidence.trim() === '') {
        return refused(
          ['RESULT_EVIDENCE_MISSING'],
          [`${file}: task ${result.task_id} carries no evidence reference — a terminal state with nothing to point at ` +
            'is an assertion, not a measurement'],
        )
      }
      if (result.state !== undefined && !TASK_STATES.includes(result.state)) {
        return refused(['TASK_STATE_UNKNOWN'], [`${file}: task ${result.task_id} has state ${JSON.stringify(result.state)}; terminal states are ${TASK_STATES.join('|')}`])
      }
    }
  }

  // ── rule 3: identity equality (all five fields, exactly) ───────────────────────────────────────
  // Shape first, per shard: a shard that agrees with the plan on a NON-digest (two sentinels, two
  // nulls) must not be graded as "identity matches". (The plan side already refused above; this
  // catches a shard carrying a malformed value independent of the plan's.)
  for (const { file, json } of parsed) {
    const shapeBad = identityProblems(json.identity, { scope: 'shard' })
    if (shapeBad.length > 0) {
      return refused([...new Set(shapeBad.map((problem) => problem.code))], shapeBad.map((problem) => `${file}: ${problem.detail}`))
    }
    if (json.identity?.plan_digest !== undefined && json.identity?.plan_digest !== null && !isValidDigest(json.identity.plan_digest)) {
      return refused(['DIGEST_INVALID'], [`${file}: identity.plan_digest is ${JSON.stringify(json.identity.plan_digest)} (${DIGEST_SHAPE})`])
    }
  }
  for (const field of IDENTITY_FIELDS) {
    const want = plan.identity?.[field] ?? null
    const mismatched = []
    for (const { file, json } of parsed) {
      const got = json.identity?.[field] ?? null
      if (got !== want) mismatched.push(`${file}: ${field}=${String(got)}`)
    }
    if (mismatched.length > 0) {
      return refused(
        [`IDENTITY_MISMATCH_${field.toUpperCase()}`],
        [`plan ${field}=${String(want)} but ${mismatched.length} shard(s) disagree — ${mismatched.slice(0, 3).join('; ')}` +
          `${mismatched.length > 3 ? ` (+${String(mismatched.length - 3)} more)` : ''}`],
      )
    }
  }
  if ((plan.identity?.build_digest ?? null) === null) {
    // Equality of two nulls proves nothing about the build. `IDENTITY_BUILD_UNRECORDED` is a refusal,
    // not a warning, because a census PASS without a recorded build identity is the claim M4 must not
    // manufacture (spec §2 lists the build digest as part of the identity).
    return refused(
      ['IDENTITY_BUILD_UNRECORDED'],
      ['build_digest is null in the plan and in every shard: equality of two unrecorded values is not ' +
        'a build identity — re-plan with --build-digest and have the shards report it'],
    )
  }

  // ── rule 4: expected-vs-observed multiset, terminal state per task ────────────────────────────
  const verdicts = new Set()
  const observedTaskIds = []
  for (const { file, json } of parsed) {
    if (json.status !== 'COMPLETED') {
      codes.push(`SHARD_STATUS_${json.status}`)
      verdicts.add(json.status)
      detail.push(`${file}: shard status is ${json.status}, not COMPLETED`)
    }
    // exit code and status must agree in BOTH directions. non-zero + COMPLETED is a shard that says it
    // failed; exit 0 with a non-COMPLETED status is a shard that failed while claiming success.
    if (json.exit_code !== undefined && json.exit_code !== null) {
      if (json.status === 'COMPLETED' && json.exit_code !== 0) {
        codes.push('SHARD_EXIT_NONZERO')
        verdicts.add('INFRA_ERROR')
        detail.push(`${file}: status=COMPLETED but exit_code=${String(json.exit_code)} — the shard's own two signals disagree`)
      }
      if (json.status !== 'COMPLETED' && json.exit_code === 0) {
        codes.push('SHARD_EXIT_DISAGREES')
        verdicts.add('INFRA_ERROR')
        detail.push(`${file}: exit_code=0 but status=${json.status} — an exit 0 is not a verdict`)
      }
    }
    const shardTaskIds = json.results.map((r) => r.task_id)
    if (shardTaskIds.length === 0 && json.status === 'COMPLETED') {
      codes.push('SHARD_EMPTY')
      verdicts.add('INCOMPLETE')
      detail.push(`${file}: status=COMPLETED with zero results — an empty shard cannot be complete`)
    }
    for (const result of json.results) {
      observedTaskIds.push(result.task_id)
      const state = result.state
      if (!TASK_STATES.includes(state)) {
        codes.push('TASK_NO_TERMINAL_RESULT')
        verdicts.add('INCOMPLETE')
        detail.push(`${file}: task ${result.task_id} has no terminal state (state=${String(state)})`)
        continue
      }
      if (state !== PASS) {
        codes.push(`TASK_STATE_${state}`)
        verdicts.add(state)
        detail.push(`${file}: task ${result.task_id} state=${state}`)
      }
    }
  }
  const observedSet = new Set(observedTaskIds)
  const expectedSet = new Set(expectedTaskIds)
  const missing = expectedTaskIds.filter((id) => !observedSet.has(id))
  const extra = [...observedSet].filter((id) => !expectedSet.has(id))
  if (missing.length > 0) {
    codes.push('TASK_MISSING')
    verdicts.add('INCOMPLETE')
    detail.push(`${missing.length} planned task(s) have no result: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' (+…)' : ''}`)
  }
  if (extra.length > 0) {
    codes.push('TASK_EXTRA')
    verdicts.add('INCOMPLETE')
    detail.push(`${extra.length} result(s) are not in the plan: ${extra.slice(0, 6).join(', ')}${extra.length > 6 ? ' (+…)' : ''}`)
  }

  // ── rule 5: required oracle contracts ─────────────────────────────────────────────────────────
  const requiredOracles = (plan.required_oracles ?? []).map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
  const oracleRows = []
  for (const { file, json } of parsed) {
    for (const result of json.results) {
      const byId = new Map((Array.isArray(result.oracles) ? result.oracles : [])
        .filter((o) => o && typeof o === 'object' && typeof o.id === 'string')
        .map((o) => [o.id, o]))
      for (const oracleId of requiredOracles) {
        const row = byId.get(oracleId)
        if (row === undefined) {
          codes.push('ORACLE_MISSING')
          verdicts.add('INCOMPLETE')
          detail.push(`${file}: task ${result.task_id} carries no result for required oracle ${JSON.stringify(oracleId)}`)
          oracleRows.push({ task_id: result.task_id, oracle: oracleId, state: 'MISSING' })
          continue
        }
        if (!TASK_STATES.includes(row.state)) {
          codes.push('ORACLE_UNDECIDABLE')
          verdicts.add('INCOMPLETE')
          detail.push(`${file}: task ${result.task_id} oracle ${oracleId} state=${String(row.state)} is not decidable`)
          oracleRows.push({ task_id: result.task_id, oracle: oracleId, state: 'UNDECIDABLE' })
          continue
        }
        if (row.state !== PASS) {
          // An oracle red is a measured red, regardless of the task's own state.
          codes.push('ORACLE_FAILED')
          verdicts.add(row.state === 'FAIL' ? 'FAIL' : 'INCOMPLETE')
          detail.push(`${file}: task ${result.task_id} oracle ${oracleId} state=${row.state}`)
          oracleRows.push({ task_id: result.task_id, oracle: oracleId, state: row.state })
          continue
        }
        oracleRows.push({ task_id: result.task_id, oracle: oracleId, state: PASS })
      }
    }
  }

  // ── rule 6: verdict ───────────────────────────────────────────────────────────────────────────
  const verdict = verdicts.size === 0
    ? PASS
    : (VERDICT_ORDER.find((v) => verdicts.has(v)) ?? 'INCOMPLETE')

  const summary = {
    schema: SCHEMA,
    policy_digest: POLICY_DIGEST,
    identity: {
      merge_tree_sha: plan.identity.merge_tree_sha,
      host_sha: plan.identity.host_sha,
      plan_digest: plan.identity.plan_digest,
      catalog_digest: plan.identity.catalog_digest,
      build_digest: plan.identity.build_digest,
    },
    plan: {
      captures: plan.captures,
      test_timeout_ms: plan.test_timeout_ms ?? null,
      roots: (plan.roots ?? []).map((r) => r.root),
      tasks: expectedTaskIds.length,
      required_oracles: requiredOracles,
    },
    // Structured, asserted by tests: prose alone can be reworded into a lie without a test noticing.
    scope: {
      shadow: true,
      wired_to_ci_required: false,
      writes_required_context_artifact: false,
      branch_protection_authority: false,
      decides_what_ci_runs: false,
    },
    roots_dropped: (plan.roots_dropped ?? []).map((d) => ({ root: d.root, files_excluded: d.files_excluded, allowed: d.allowed === true })),
    expected_task_ids: expectedTaskIds.slice().sort(),
    observed_task_ids: [...observedSet].sort(),
    shards: parsed.map(({ file, digest, json }) => ({
      id: json.shard_id,
      status: json.status,
      artifact_digest: digest,
      file,
      exit_code: json.exit_code ?? null,
      tasks: json.results.length,
    })),
    counts: {
      expected: expectedTaskIds.length,
      observed: observedSet.size,
      reported: observedTaskIds.length,
      missing: missing.length,
      extra: extra.length,
      by_state: Object.fromEntries(TASK_STATES.map((s) => [s, parsed.flatMap((p) => p.json.results).filter((r) => r.state === s).length])),
    },
    oracles: {
      required: requiredOracles,
      rows: oracleRows,
      missing: oracleRows.filter((r) => r.state === 'MISSING').length,
      undecidable: oracleRows.filter((r) => r.state === 'UNDECIDABLE').length,
      failed: oracleRows.filter((r) => r.state !== PASS && r.state !== 'MISSING' && r.state !== 'UNDECIDABLE').length,
      checked: oracleRows.length,
    },
    codes: [...new Set(codes)],
    detail,
    census_verdict: verdict,
    scope_note:
      'SHADOW: not wired to ci-required, not read by any Required context, not branch-protection ' +
      'authority. PASS here means these artifacts are a complete, identity-consistent, oracle-clean ' +
      'cover of THIS plan — nothing more.',
  }
  return graded(verdict, codes, detail, { summary })
}

/** Human-readable rendering of a summary (the token is the last line). `/`-free, greppable. */
export function render(result) {
  if (result.refused) {
    const lines = [`census-summary (${SCHEMA}) REFUSED — nothing was graded`]
    for (const code of result.codes) lines.push(`  REFUSED ${code}`)
    for (const d of result.detail) lines.push(`    ${d}`)
    lines.push(`DSH-CENSUS-SUMMARY refused codes=${result.codes.join(',')}`)
    return lines.join('\n')
  }
  const s = result.summary
  const lines = []
  lines.push(`census-summary (${SCHEMA}) — SHADOW: not an authority, not read by any Required context`)
  lines.push(`  identity: merge_tree=${s.identity.merge_tree_sha} host=${s.identity.host_sha}`)
  lines.push(`            plan=${s.identity.plan_digest} catalog=${s.identity.catalog_digest} build=${String(s.identity.build_digest)}`)
  lines.push(`  plan: captures=${String(s.plan.captures)} roots=${String(s.plan.roots.length)} tasks=${String(s.plan.tasks)} clock=${String(s.plan.test_timeout_ms)}`)
  lines.push(`  shards: ${s.shards.length} (${s.shards.map((x) => `${x.id}:${x.status}`).join(', ')})`)
  for (const x of s.shards) lines.push(`    ${String(x.id).padEnd(10)} status=${String(x.status).padEnd(11)} exit=${String(x.exit_code)} tasks=${String(x.tasks)} digest=${x.artifact_digest}`)
  if (s.roots_dropped.length > 0) {
    lines.push(`  DROPPED ROOTS (exclude[] removed them; allowed explicitly, recorded in the plan digest):`)
    for (const d of s.roots_dropped) lines.push(`    ${d.root} files_excluded=${String(d.files_excluded)} allowed=${String(d.allowed)}`)
  }
  lines.push(`  tasks: expected=${String(s.counts.expected)} observed=${String(s.counts.observed)} missing=${String(s.counts.missing)} extra=${String(s.counts.extra)}`)
  lines.push(`  states: ${Object.entries(s.counts.by_state).map(([k, v]) => `${k}=${String(v)}`).join(' ')}`)
  lines.push(`  oracles: required=${String(s.oracles.required.length)} checked=${String(s.oracles.checked)} failed=${String(s.oracles.failed)} undecidable=${String(s.oracles.undecidable)} missing=${String(s.oracles.missing)}`)
  if (s.detail.length > 0) {
    lines.push(`  findings (${s.detail.length}):`)
    for (const d of s.detail.slice(0, 25)) lines.push(`    ${d}`)
    if (s.detail.length > 25) lines.push(`    ... ${s.detail.length - 25} more`)
  }
  lines.push(`DSH-CENSUS-SUMMARY ${s.census_verdict} codes=${s.codes.join(',') || 'none'} ` +
    `expected=${String(s.counts.expected)} observed=${String(s.counts.observed)} shards=${String(s.shards.length)} ` +
    `expected_task_ids=${String(s.expected_task_ids.length)} observed_task_ids=${String(s.observed_task_ids.length)}`)
  return lines.join('\n')
}

// ───────────────────────────────────────────────────────────────────── cli ──

const HELP = [
  'usage: node scripts/census-aggregate.mjs --aggregate <shard.json...> --plan <plan.json> [--json]',
  '       node scripts/census-aggregate.mjs --self-test',
  '',
  '  --aggregate FILE...  one or more census-shard/1 artifacts',
  '  --plan FILE          the census-plan/1 the shards executed',
  '  --json               print the census-summary/1 artifact instead of the human report',
  '  --self-test          pin the refusal set, the verdict algebra and the negative controls',
  '',
  'Exit: 0 PASS | 1 non-PASS | 2 REFUSED',
  '',
].join('\n')

function refuse(code, detail) {
  process.stderr.write(`REFUSED ${code}: ${detail}\n`)
  return 2
}

export function main(argv) {
  const opts = { shards: [], plan: null, json: false, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--aggregate') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.shards.push(argv[++i]) }
    else if (a === '--plan') opts.plan = argv[++i] ?? null
    else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else return refuse('UNKNOWN_ARGUMENT', `${a} (see --help)`)
  }
  if (opts.help) {
    process.stdout.write(HELP)
    return 0
  }
  if (opts.selfTest) return selfTest()
  if (opts.shards.length === 0) return refuse('NO_MODE', 'nothing to aggregate: give --aggregate <shard...> --plan <plan.json> or --self-test')
  if (opts.plan === null) return refuse('PLAN_UNREADABLE', '--plan is required: a shard set with no plan is not a census')

  let plan
  try {
    plan = JSON.parse(readFileSync(resolve(opts.plan), 'utf8'))
  } catch (e) {
    return refuse('PLAN_UNREADABLE', `${opts.plan}: ${String(e && e.message ? e.message : e)}`)
  }
  const result = aggregate({ plan, shards: opts.shards.map((f) => readShardFile(f)) })
  if (result.refused) {
    for (const code of result.codes) process.stderr.write(`REFUSED ${code}\n`)
    for (const d of result.detail) process.stderr.write(`  ${d}\n`)
    if (opts.json) process.stdout.write(`${JSON.stringify({ schema: SCHEMA, refused: true, codes: result.codes, detail: result.detail }, null, 2)}\n`)
    return 2
  }
  process.stdout.write(opts.json ? `${JSON.stringify(result.summary, null, 2)}\n` : `${render(result)}\n`)
  return result.ok ? 0 : 1
}

// ──────────────────────────────────────────────────────────────── self-test ──

/** A coherent 2-root × 2-capture plan for the self-test, with one required oracle contract. */
export function selfTest() {
  const cases = []
  const ok = (label, cond, detail = '') => cases.push([label, Boolean(cond), detail])
  const TREE = '1'.repeat(40)
  const HOST = '2'.repeat(40)
  const CAT = `sha256:${'3'.repeat(64)}`
  const BUILD = `sha256:${'4'.repeat(64)}`
  const plan = buildPlan({
    roots: [{ root: 'packages/a' }, { root: 'packages/b' }],
    captures: 2,
    identity: makeIdentity({ merge_tree_sha: TREE, host_sha: HOST, catalog_digest: CAT, build_digest: BUILD }),
  })
  plan.required_oracles = ['ORACLE-A']
  // The plan digest is recomputed after the oracle list is added, so the fixture exercises the
  // aggregator's own recomputation instead of pinning a literal that a plan edit could not disturb.
  plan.identity.plan_digest = planDigest(plan)

  const identityOf = (over = {}) => ({
    merge_tree_sha: plan.identity.merge_tree_sha,
    host_sha: plan.identity.host_sha,
    plan_digest: plan.identity.plan_digest,
    catalog_digest: plan.identity.catalog_digest,
    build_digest: plan.identity.build_digest,
    ...over,
  })
  // The plan is the authority on what a task id means; `taskIdentity` decodes it the same way the
  // aggregator checks it, so a fixture cannot accidentally agree with the code by construction.
  const taskIdentity = (task_id) => {
    const m = /^census:(.+)#([0-9]+)$/.exec(task_id)
    return m === null ? { root: null, capture: null } : { root: m[1], capture: Number(m[2]) }
  }
  const res = (task_id, over = {}) => ({
    task_id,
    ...taskIdentity(task_id),
    state: 'PASS',
    evidence: `artifacts/${task_id}.json`,
    oracles: [{ id: 'ORACLE-A', state: 'PASS' }],
    ...over,
  })
  const passResults = (taskIds) => taskIds.map((task_id) => res(task_id))
  const shard = (id, taskIds, over = {}) => {
    const base = {
      schema: SHARD_SCHEMA,
      shard_id: id,
      status: 'COMPLETED',
      exit_code: 0,
      policy_digest: POLICY_DIGEST,
      identity: identityOf(),
      results: passResults(taskIds),
    }
    return shardOf(`${id}.json`, { ...base, ...over })
  }
  const all = plan.tasks.map((t) => t.task_id)
  const s1 = shard('shard-1', all.slice(0, 2))
  const s2 = shard('shard-2', all.slice(2))

  const pass = aggregate({ plan, shards: [s1, s2] })
  ok('positive: a complete consistent set is PASS', pass.verdict === PASS && pass.ok, JSON.stringify(pass.codes))
  ok('positive: expected == observed == the plan 4 tasks, no missing/extra',
    JSON.stringify(pass.summary.expected_task_ids) === JSON.stringify([...all].sort()) &&
    JSON.stringify(pass.summary.observed_task_ids) === JSON.stringify([...all].sort()) &&
    pass.summary.counts.missing === 0 && pass.summary.counts.extra === 0,
    JSON.stringify(pass.summary.counts))
  ok('positive: the summary is STRUCTURALLY not an authority (asserted fields, not prose)',
    pass.summary.scope.shadow === true && pass.summary.scope.wired_to_ci_required === false &&
    pass.summary.scope.writes_required_context_artifact === false &&
    pass.summary.scope.branch_protection_authority === false &&
    pass.summary.scope.decides_what_ci_runs === false,
    JSON.stringify(pass.summary.scope))
  ok('positive: shard artifact digests are recorded', pass.summary.shards.every((x) => /^sha256:[0-9a-f]{64}$/.test(x.artifact_digest)), 'digest')
  ok('positive: the verdict token renders', /DSH-CENSUS-SUMMARY PASS/.test(render(pass)), render(pass).split('\n').pop())

  const omitted = aggregate({ plan, shards: [s1] })
  ok('an omitted shard is INCOMPLETE / TASK_MISSING with the exact delta',
    omitted.codes.includes('TASK_MISSING') && omitted.verdict === 'INCOMPLETE' &&
    omitted.summary.counts.missing === 2 && omitted.summary.counts.expected === 4 &&
    omitted.summary.counts.observed === 2 && omitted.summary.counts.extra === 0,
    JSON.stringify(omitted.summary.counts))
  const dupeShard = aggregate({ plan, shards: [s1, shard('shard-1', all.slice(2))] })
  ok('a duplicate shard id refuses', dupeShard.refused && dupeShard.codes.includes('SHARD_ID_DUPLICATE'), JSON.stringify(dupeShard.codes))
  const twice = aggregate({ plan, shards: [s1, shard('shard-3', [all[0], all[0]])] })
  ok('a duplicate task id refuses', twice.refused && twice.codes.includes('SHARD_TASK_ID_DUPLICATE'), JSON.stringify(twice.codes))
  const extra = aggregate({ plan, shards: [s1, shard('shard-2', [...all.slice(2), 'census:packages/z#1'])] })
  ok('a task outside the plan is TASK_EXTRA with the exact delta',
    extra.codes.includes('TASK_EXTRA') && extra.verdict === 'INCOMPLETE' &&
    extra.summary.counts.extra === 1 && extra.summary.counts.missing === 0,
    JSON.stringify(extra.summary.counts))
  const noTerminal = aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), { results: all.slice(2).map((task_id) => res(task_id, { state: undefined })) })] })
  ok('a task with no terminal state is INCOMPLETE', noTerminal.codes.includes('TASK_NO_TERMINAL_RESULT'), JSON.stringify(noTerminal.codes))
  const failExit0 = aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), {
    results: all.slice(2).map((task_id, i) => res(task_id, { state: i === 0 ? 'FAIL' : 'PASS' })),
  })] })
  ok('exit 0 with a FAIL result is not PASS', failExit0.verdict === 'FAIL' && failExit0.codes.includes('TASK_STATE_FAIL'), JSON.stringify(failExit0.codes))
  for (const state of ['INCOMPLETE', 'CANCELLED', 'INFRA_ERROR']) {
    const r = aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), { status: state, exit_code: 1 })] })
    ok(`a shard status ${state} is not PASS`, r.verdict !== PASS && r.codes.some((c) => c.includes(state)), JSON.stringify(r.codes))
  }
  ok('a truncated shard refuses', aggregate({ plan, shards: [s1, { file: 'cut.json', text: '{"schema":"census-shard/1",' }] }).codes.includes('SHARD_UNPARSEABLE'), 'truncated')
  ok('a shard with a foreign policy digest refuses', aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), { policy_digest: 'sha256:other' })] }).codes.includes('POLICY_DIGEST_MISMATCH'), 'policy')
  ok('a shard from another plan refuses', aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), { identity: identityOf({ plan_digest: `sha256:${'9'.repeat(64)}` }) })] }).codes.includes('PLAN_DIGEST_MISMATCH'), 'plan-drift')
  ok('an identity mismatch refuses',
    aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), { identity: identityOf({ host_sha: '9'.repeat(40) }) })] }).codes.includes('IDENTITY_MISMATCH_HOST_SHA'), 'identity')
  ok('a one-capture plan refuses (the missing second capture)', (() => {
    const one = buildPlan({ roots: [{ root: 'packages/a' }], captures: 1, identity: plan.identity })
    one.identity.plan_digest = planDigest(one)
    return aggregate({ plan: one, shards: [shard('shard-1', one.tasks.map((t) => t.task_id))] }).codes.includes('CAPTURES_INSUFFICIENT')
  })(), 'one-capture')
  ok('a plan whose digest was recomputed after editing a task still refuses (the shards name the old digest)', (() => {
    const edited = JSON.parse(JSON.stringify(plan))
    edited.tasks[0].est_ms = 1
    edited.identity.plan_digest = planDigest(edited)
    return aggregate({ plan: edited, shards: [s1, s2] }).codes.includes('PLAN_DIGEST_MISMATCH')
  })(), 'plan-drift')
  ok('a plan edited WITHOUT a new digest refuses', (() => {
    const stale = JSON.parse(JSON.stringify(plan))
    stale.tasks[0].est_ms = 1
    return aggregate({ plan: stale, shards: [s1, s2] }).codes.includes('PLAN_DIGEST_MISMATCH')
  })(), 'stale-digest')
  ok('a missing required oracle is not PASS',
    aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), { results: all.slice(2).map((task_id) => res(task_id, { oracles: [] })) })] }).codes.includes('ORACLE_MISSING'), 'oracle-missing')
  ok('an undecidable oracle is not PASS',
    aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), { results: all.slice(2).map((task_id) => res(task_id, { oracles: [{ id: 'ORACLE-A', state: 'MAYBE' }] })) })] }).codes.includes('ORACLE_UNDECIDABLE'), 'oracle-undecidable')

  // ── review round 1: a digest is a digest (both sides), and a result carries its own identity ──
  const SENTINELS = ['null', 'undefined', '', ' ', 'NULL', 'a'.repeat(39), 'a'.repeat(65), `sha256:${'A'.repeat(64)}`]
  const sentinelPlan = SENTINELS.filter((value) => (() => {
    const p = JSON.parse(JSON.stringify(plan))
    p.identity.build_digest = value
    p.identity.plan_digest = planDigest(p)
    const r = aggregate({ plan: p, shards: [shard('shard-1', all)] })
    return !r.refused
  })())
  ok('a sentinel build_digest in the PLAN refuses (both sides, not just null)', sentinelPlan.length === 0, `accepted: ${JSON.stringify(sentinelPlan)}`)
  const sentinelShard = SENTINELS.filter((value) => {
    const r = aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), {
      identity: identityOf({ merge_tree_sha: value }),
      results: all.slice(2).map((task_id) => res(task_id)),
    })] })
    return !r.refused
  })
  ok('a sentinel identity in a SHARD refuses', sentinelShard.length === 0, `accepted: ${JSON.stringify(sentinelShard)}`)
  const planNulls = ['merge_tree_sha', 'host_sha', 'catalog_digest', 'build_digest'].filter((field) => {
    const p = JSON.parse(JSON.stringify(plan))
    p.identity[field] = null
    p.identity.plan_digest = planDigest(p)
    return !aggregate({ plan: p, shards: [shard('shard-1', all, { identity: { ...identityOf(), [field]: null, plan_digest: p.identity.plan_digest } })] }).refused
  })
  ok('a plan with ANY null identity field refuses (all five, build included)', planNulls.length === 0, `matched: ${JSON.stringify(planNulls)}`)
  const droppedRootWithCapture1 = aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), {
    results: all.slice(2).map((task_id) => res(task_id, { capture: 1 })),
  })] })
  ok('a capture-2 id carrying capture-1 data refuses (RESULT_CAPTURE_MISMATCH)',
    droppedRootWithCapture1.refused && droppedRootWithCapture1.codes.includes('RESULT_CAPTURE_MISMATCH'), JSON.stringify(droppedRootWithCapture1.codes))
  ok('a result reporting another root refuses (RESULT_ROOT_MISMATCH)',
    aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), {
      results: all.slice(2).map((task_id) => res(task_id, { root: 'packages/other' })),
    })] }).codes.includes('RESULT_ROOT_MISMATCH'), 'root')
  ok('a result with no evidence reference refuses (RESULT_EVIDENCE_MISSING)',
    aggregate({ plan, shards: [s1, shard('shard-2', all.slice(2), {
      results: all.slice(2).map((task_id) => res(task_id, { evidence: '' })),
    })] }).codes.includes('RESULT_EVIDENCE_MISSING'), 'evidence')

  const droppedPlan = JSON.parse(JSON.stringify(plan))
  droppedPlan.roots_dropped = [{ root: 'packages/z', files_excluded: 2, allowed: true }]
  droppedPlan.identity.plan_digest = planDigest(droppedPlan)
  const droppedIdentity = { ...identityOf(), plan_digest: droppedPlan.identity.plan_digest }
  const droppedOut = aggregate({
    plan: droppedPlan,
    shards: [
      shard('shard-1', all.slice(0, 2), { identity: droppedIdentity }),
      shard('shard-2', all.slice(2), { identity: droppedIdentity }),
    ],
  })
  ok('an allowed dropped root is recorded in the aggregator output',
    droppedOut.verdict === PASS && JSON.stringify(droppedOut.summary.roots_dropped) === '[{"root":"packages/z","files_excluded":2,"allowed":true}]',
    JSON.stringify(droppedOut.summary.roots_dropped))
  const malformedDrop = JSON.parse(JSON.stringify(plan))
  malformedDrop.roots_dropped = [{ root: 'packages/z', files_excluded: 2 }]
  malformedDrop.identity.plan_digest = planDigest(malformedDrop)
  ok('an undeclared (not allowed) dropped root refuses',
    aggregate({ plan: malformedDrop, shards: [s1, s2] }).codes.includes('PLAN_ROOTS_DROPPED_MALFORMED'), 'drop')

  const nullBuildPlan = JSON.parse(JSON.stringify(plan))
  nullBuildPlan.identity.build_digest = null
  nullBuildPlan.identity.plan_digest = planDigest(nullBuildPlan)
  ok('an unrecorded build identity refuses',
    aggregate({ plan: nullBuildPlan, shards: [shard('shard-1', all, { identity: identityOf({ build_digest: null, plan_digest: nullBuildPlan.identity.plan_digest }) })] }).codes.includes('IDENTITY_BUILD_UNRECORDED'), 'build-null')
  ok('no shards refuses', aggregate({ plan, shards: [] }).codes.includes('NO_SHARDS'), 'none')

  let bad = 0
  for (const [label, cond, detail] of cases) {
    if (!cond) bad += 1
    process.stdout.write(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : `: ${detail}`}\n`)
  }
  process.stdout.write(`DSH-CENSUS-AGGREGATE-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${String(cases.length)} failed=${String(bad)}\n`)
  return bad === 0 ? 0 : 1
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main(process.argv.slice(2)))
