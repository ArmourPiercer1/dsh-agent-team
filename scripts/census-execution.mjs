#!/usr/bin/env node
/**
 * census-execution.mjs — TINF M5: the PLAN-DRIVEN census execution core.
 *
 * WHAT CHANGED IN M5. M4 shipped two tools that could not yet run anything: a planner
 * (`census-plan.mjs`) and an aggregator (`census-aggregate.mjs`), both shadow, both refusing the
 * real data because no `build_digest` producer existed and no runner wrote per-result `root` /
 * `capture` / `evidence`. M5 replaces the census leg's INTERNAL execution with plan → execute →
 * aggregate while keeping the Required contexts, the job names and the verdict token identical
 * (spec 07 §6 step 5: "replace the internal execution of the existing ci-census, not the context").
 *
 * THE EXECUTION MODEL, STATED BECAUSE IT IS NOT OBVIOUS.
 * The census invocation (`censusVitestArgv`, M4) has no file filter: one `vitest run` loads the
 * ROOT config and runs the WHOLE population, with the roots concurrent inside that process. That is
 * why M4 attached the same command (modulo its report path) to every plan task, and why M4 measured
 * that root-level process sharding buys ~0 s of wall clock. M5 therefore does NOT spawn one process
 * per task (22 tasks × the whole population would be 11× the shipped census), and does NOT invent
 * per-root process sharding. It executes ONE invocation per capture — exactly what the legacy path
 * did — and DERIVES one terminal result per planned `(root, capture)` task from that capture's JSON
 * report. Every planned task is executed (its root ran in the capture) and every planned task gets
 * an identity-bearing result; what changes is the proof (plan coverage + fail-closed aggregation),
 * not the test population.
 *
 * `--census-shards N` is a SHARD-ARTIFACT LAYOUT, not independent Worlds. It splits the plan's task
 * list into N `census-shard/1` artifacts so the aggregator's multi-artifact path is exercised on
 * real data. It does not add processes, ports or Worlds, and the census job uses N=1 — claiming
 * otherwise would be the "shard" lie spec §3 forbids. Independent-World sharding needs the
 * workflow-level matrix M4 deliberately deferred; it is M6 work, not this cutover.
 *
 * WHAT THIS MODULE OWNS.
 *   resultsFromReport   report → per-task terminal state + evidence (the LIVE derivation)
 *   resultsFromReplay   a recorded `census-replay/1` → the same results (the DRY-RUN path)
 *   buildShardArtifacts plan + results → `census-shard/1` artifacts
 *   aggregateArtifacts  artifacts → the M4 aggregator's verdict (no second verdict algebra)
 *   renderPlanTokens    the transcript's ubiquitous-language lines
 * The gate (`scripts/ci-pr-gate.mjs`, `LEGS.census`) owns the spawn, the transcript, the timing
 * rows and the final `DSH-CI-VERDICT` token; this module never prints a verdict of its own.
 *
 * REFUSALS ARE NAMED AND NEVER FALL BACK. A plan/aggregate/derivation refusal is data
 * (`{ok:false, code, detail}`); the census leg turns it into a RED census whose detail carries the
 * code. There is no path from a refusal back to the legacy execution — a silent fallback would make
 * "the plan ran" unmeasurable, which is the failure mode this milestone exists to remove.
 *
 * `census-replay/1` (the DRY-RUN recording; small, machine-readable, written by the runner):
 *   { schema, plan_digest, capture, results: [{task_id, root, capture, state, evidence, detail?}] }
 * It is written by the live plan path next to the transcripts (`census-replay-<n>.json`), so a
 * cheap CI leg can replay a recorded plan-mode run without a host: the recorded bytes ARE what the
 * runner derived, not a hand-written fixture.
 *
 * @module scripts/census-execution
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { aggregate, readShardFile, SHARD_SCHEMA, TASK_STATES, POLICY_DIGEST, verifyEvidenceRefs } from './census-aggregate.mjs'
import { IDENTITY_FIELDS } from './census-digest.mjs'
import { digestJson } from './census-plan.mjs'
import { rootOf } from './tinf-timing.mjs'

export const REPLAY_SCHEMA = 'census-replay/1'
/** Result states the aggregator grades. Kept as a set here so the deriver cannot invent one. */
const STATES = new Set(TASK_STATES)

function refused(code, detail) {
  return { ok: false, code, detail }
}

/**
 * Assertion statuses, with the LEGACY semantics this file must mirror.
 *
 * The shipped census grades a report through `scripts/fail-set.mjs`, which counts exactly
 * `status === 'failed'` and never a skipped leg: a `pending` / `skipped` / `todo` assertion is a
 * test the runner declined to run, not a test that failed. The first draft here counted
 * `status !== 'passed'`, which would have turned a CONDITIONAL SKIP into a red census — a latent
 * false RED, since the population already contains such skips (e.g.
 * `packages/runtime/test/a5rbn-runtime-base-narrow.test.ts`). Skips are still COUNTED and printed,
 * because "0 failures" and "0 ran" must not read the same.
 *
 * An UNKNOWN status is the one place this file is deliberately STRICTER than fail-set: a reporter
 * status nobody taught us about is not evidence that the leg passed, so it is graded as a failure
 * (`UNKNOWN_ASSERTION_STATUS`) rather than silently ignored.
 */
const SKIPPED_STATUSES = new Set(['skipped', 'pending', 'todo'])

/**
 * Per-root slices of ONE vitest JSON report: which files belong to the root, whether any assertion
 * failed, how many were skipped, and whether the report as a whole failed without a per-test failure
 * in this root (a collection error, which must never be graded PASS for an unrelated root).
 */
export function rootsFromReport(report) {
  const files = Array.isArray(report?.testResults) ? report.testResults : []
  const byRoot = new Map()
  for (const f of files) {
    const name = String(f?.name ?? '')
    const root = rootOf(name)
    if (!byRoot.has(root)) byRoot.set(root, [])
    const assertions = Array.isArray(f?.assertionResults) ? f.assertionResults : []
    let failedAssertions = 0
    let skipped = 0
    let unknown = 0
    for (const a of assertions) {
      const status = a?.status
      if (status === 'failed') failedAssertions += 1
      else if (SKIPPED_STATUSES.has(status)) skipped += 1
      else if (status !== 'passed') unknown += 1
    }
    // A file-level failure with no per-assertion detail (collection error, unhandled rejection) is
    // still a red: `status: failed` / a non-empty `message` is the reporter saying so.
    const fileFailed = f?.status === 'failed' || (assertions.length === 0 && String(f?.message ?? '').trim() !== '')
    byRoot.get(root).push({
      name,
      assertions: assertions.length,
      failed: failedAssertions + (fileFailed ? 1 : 0),
      skipped,
      unknown,
    })
  }
  return byRoot
}

/**
 * Derive one terminal result per planned task of `capture` from that capture's report.
 *
 * A planned root ABSENT from the report is `INCOMPLETE`, never PASS: a dropped root is exactly the
 * quiet shrinkage TINF-12 names, and "the report did not mention it" is not evidence that it ran.
 */
export function resultsFromReport({ plan, capture, report, reportRef }) {
  if (!plan || !Array.isArray(plan.tasks)) return refused('PLAN_UNREADABLE', 'resultsFromReport needs a census-plan/1 plan')
  if (typeof reportRef !== 'string' || reportRef === '') {
    return refused('RESULT_EVIDENCE_MISSING', 'resultsFromReport needs a report reference: a terminal state with nothing to point at is not a measurement')
  }
  const byRoot = rootsFromReport(report)
  const tasks = plan.tasks.filter((t) => t.capture === capture)
  if (tasks.length === 0) {
    return refused('PLAN_CAPTURE_UNKNOWN', `the plan has no task for capture ${String(capture)}`)
  }
  // The multiset invariant runs BOTH ways. A planned root with no result is `INCOMPLETE` below; a
  // root that RAN without being planned is refused here. Legacy compared whole identity sets, so
  // the reverse direction was red too — dropping it would make plan mode a quiet loosening.
  const planned = new Set((Array.isArray(plan.roots) ? plan.roots : []).map((r) => r.root))
  const unplanned = [...byRoot.keys()].filter((k) => !planned.has(k))
  if (unplanned.length > 0) {
    const named = unplanned.slice(0, 5).map((k) => `${k} (${String(byRoot.get(k).length)} file(s))`).join(', ')
    return refused(
      'RESULT_ROOT_UNPLANNED',
      `the report contains file(s) the plan does not name: ${named} — a root that ran without being planned makes the graded population different from the planned one`,
    )
  }
  const reportFailed = report?.success === false
  const results = []
  for (const task of tasks) {
    const slice = byRoot.get(task.root)
    if (slice === undefined) {
      results.push({
        task_id: task.task_id,
        root: task.root,
        capture: task.capture,
        state: 'INCOMPLETE',
        files: 0,
        assertions: 0,
        skipped: 0,
        evidence: `${reportRef}#${task.root}`,
        detail: `root ${task.root} is planned for capture ${String(capture)} but the report contains no file of it — a root that vanished is not a root that passed`,
      })
      continue
    }
    const failed = slice.filter((f) => f.failed > 0)
    const skipped = slice.reduce((n, f) => n + (Number.isFinite(f.skipped) ? f.skipped : 0), 0)
    const unknown = slice.filter((f) => (Number.isFinite(f.unknown) ? f.unknown : 0) > 0)
    // Evidence is a real, re-derivable pointer: the report path the runner wrote plus a digest over
    // the exact per-file slice that was graded (so the transcript can prove WHAT was graded).
    const evidence = `${reportRef}#${task.root} ${digestJson({ root: task.root, capture: task.capture, files: slice })}`
    const shape = { files: slice.length, assertions: slice.reduce((n, f) => n + (Number.isFinite(f.assertions) ? f.assertions : 0), 0), skipped }
    if (failed.length > 0) {
      results.push({
        task_id: task.task_id,
        root: task.root,
        capture: task.capture,
        state: 'FAIL',
        evidence,
        ...shape,
        detail: `${String(failed.length)} file(s) failed in ${task.root}: ${failed.slice(0, 6).map((f) => f.name).join(', ')}`,
      })
      continue
    }
    if (unknown.length > 0) {
      // Fail-closed on a status this tool does not know (see SKIPPED_STATUSES): counting it as a
      // skip would be the same "not-passed is not-failed" inversion that made a skip red.
      results.push({
        task_id: task.task_id,
        root: task.root,
        capture: task.capture,
        state: 'FAIL',
        evidence,
        ...shape,
        detail: `${String(unknown.length)} file(s) in ${task.root} reported an assertion status this tool does not know (UNKNOWN_ASSERTION_STATUS); an unrecognised status is not evidence of a pass`,
      })
      continue
    }
    if (reportFailed) {
      results.push({
        task_id: task.task_id,
        root: task.root,
        capture: task.capture,
        state: 'INCOMPLETE',
        evidence,
        ...shape,
        detail: `the report failed (success=false) but no failure is attributable to ${task.root}; an unattributed report failure is not this root's PASS`,
      })
      continue
    }
    results.push({ task_id: task.task_id, root: task.root, capture: task.capture, state: 'PASS', evidence, ...shape })
  }
  return { ok: true, results }
}

/**
 * Replay a recorded `census-replay/1` recording. Only the tasks the recording carries are returned:
 * a recording that dropped a task must reach the aggregator as `TASK_MISSING` (INCOMPLETE), never be
 * padded here — synthesising the missing states would make the dropped-root control untestable.
 */
export function resultsFromReplay({ plan, capture, replay, replayRef }) {
  if (!plan || !Array.isArray(plan.tasks)) return refused('PLAN_UNREADABLE', 'resultsFromReplay needs a census-plan/1 plan')
  if (!replay || typeof replay !== 'object' || Array.isArray(replay)) {
    return refused('DRYRUN_REPLAY_UNREADABLE', `${String(replayRef)} is not an object`)
  }
  if (replay.schema !== REPLAY_SCHEMA) {
    return refused('DRYRUN_REPLAY_SCHEMA_UNKNOWN', `${String(replayRef)}: schema must be ${REPLAY_SCHEMA}, got ${String(replay.schema)}`)
  }
  if (replay.plan_digest !== plan.identity?.plan_digest) {
    return refused(
      'DRYRUN_PLAN_MISMATCH',
      `${String(replayRef)} was recorded for plan_digest=${String(replay.plan_digest)} but this plan is ` +
        `${String(plan.identity?.plan_digest)} — replaying another plan's results is the mixed-tree failure TINF-13 names`,
    )
  }
  // WHICH TREE the recording came from. A recording that does not say is not replayable: the whole
  // point of the dry run is that the bytes under test are the bytes of THIS tree, and `plan_digest`
  // alone cannot prove that once a plan is rebuilt (the digest covers the plan, and a plan for
  // another tree with the same task set would still differ only in its identity fields).
  const recordedTree = typeof replay.merge_tree === 'string' ? replay.merge_tree : replay.identity?.merge_tree_sha
  if (typeof recordedTree !== 'string' || recordedTree === '') {
    return refused(
      'DRYRUN_IDENTITY_MISMATCH',
      `${String(replayRef)} does not record the merge_tree it was made on; a recording whose tree is unknown cannot be replayed`,
    )
  }
  if (recordedTree !== plan.identity?.merge_tree_sha) {
    return refused(
      'DRYRUN_IDENTITY_MISMATCH',
      `${String(replayRef)} was recorded on merge_tree=${recordedTree} but this plan is ` +
        `${String(plan.identity?.merge_tree_sha)} — replaying another tree's bytes would grade a census this checkout never ran`,
    )
  }
  if (replay.capture !== capture) {
    return refused('DRYRUN_CAPTURE_MISMATCH', `${String(replayRef)} records capture ${String(replay.capture)} but capture ${String(capture)} was asked for`)
  }
  if (!Array.isArray(replay.results)) {
    return refused('DRYRUN_REPLAY_UNREADABLE', `${String(replayRef)}: results must be an array (a recording with no list is not an empty run)`)
  }
  const byId = new Map(plan.tasks.map((t) => [t.task_id, t]))
  const seen = new Set()
  const out = []
  for (const result of replay.results) {
    if (!result || typeof result !== 'object' || typeof result.task_id !== 'string' || result.task_id === '') {
      return refused('TASK_ID_MISSING', `${String(replayRef)}: every recorded result needs a string task_id`)
    }
    const planned = byId.get(result.task_id)
    if (planned === undefined) {
      return refused('DRYRUN_TASK_UNKNOWN', `${String(replayRef)}: task ${JSON.stringify(result.task_id)} is not in this plan`)
    }
    if (seen.has(result.task_id)) {
      return refused('SHARD_TASK_ID_DUPLICATE', `${String(replayRef)}: task ${JSON.stringify(result.task_id)} is recorded more than once`)
    }
    seen.add(result.task_id)
    if (result.root !== planned.root) {
      return refused('RESULT_ROOT_MISMATCH', `${String(replayRef)}: task ${result.task_id} records root ${JSON.stringify(result.root)} but the plan's task is ${JSON.stringify(planned.root)}`)
    }
    if (result.capture !== planned.capture) {
      return refused('RESULT_CAPTURE_MISMATCH', `${String(replayRef)}: task ${result.task_id} records capture ${JSON.stringify(result.capture)} but the plan's task is ${JSON.stringify(planned.capture)}`)
    }
    if (!STATES.has(result.state)) {
      return refused('TASK_STATE_UNKNOWN', `${String(replayRef)}: task ${result.task_id} state=${JSON.stringify(result.state)} is not terminal (${TASK_STATES.join('|')})`)
    }
    if (typeof result.evidence !== 'string' || result.evidence.trim() === '') {
      return refused('RESULT_EVIDENCE_MISSING', `${String(replayRef)}: task ${result.task_id} carries no evidence reference`)
    }
    out.push({
      task_id: result.task_id,
      root: result.root,
      capture: result.capture,
      state: result.state,
      evidence: result.evidence,
      ...(typeof result.detail === 'string' && result.detail !== '' ? { detail: result.detail } : {}),
    })
  }
  // COVERAGE. The aggregator would catch a missing task as TASK_MISSING, but a dry run has a
  // stronger obligation: the recording must be a recording OF THIS CENSUS, so a recording that
  // covers only some roots is refused here rather than aggregated into an INCOMPLETE that a reader
  // could mistake for a half-run.
  const covered = new Set(out.map((r) => r.root))
  const uncovered = (Array.isArray(plan.roots) ? plan.roots : []).map((r) => r.root).filter((root) => !covered.has(root))
  if (uncovered.length > 0) {
    return refused(
      'DRYRUN_COVERAGE_MISMATCH',
      `${String(replayRef)} covers ${String(covered.size)} of ${String(plan.roots.length)} planned root(s); ` +
        `missing: ${uncovered.slice(0, 6).join(', ')} — a dry run must replay the whole planned population`,
    )
  }
  return { ok: true, results: out }
}

/**
 * Split the plan's task list into `shards` contiguous `census-shard/1` artifacts (an artifact
 * LAYOUT, see the header). Identity is the plan's, so the aggregator's identity rule is exercised
 * on real data rather than on a fixture.
 *
 * `status` is the SHARD's execution status: a shard that ran to completion is `COMPLETED` even when
 * a result it carries is FAIL — the two are different facts, and the aggregator is what turns the
 * latter into a red verdict (`TASK_STATE_FAIL`) rather than trusting an exit code.
 */
export function buildShardArtifacts({ plan, results, shards = 1, execution = null }) {
  if (!Number.isInteger(shards) || shards < 1) {
    return refused('CENSUS_SHARDS_INVALID', `--census-shards must be a positive integer, got ${String(shards)}`)
  }
  const tasks = plan?.tasks ?? []
  if (tasks.length === 0) return refused('PLAN_TASK_SET_EMPTY', 'the plan enumerates no task')
  const byId = new Map(results.map((r) => [r.task_id, r]))
  const perShard = Math.ceil(tasks.length / shards)
  const buckets = []
  for (let k = 0; k < shards; k += 1) {
    const slice = tasks.slice(k * perShard, (k + 1) * perShard)
    if (slice.length === 0) continue
    buckets.push(slice)
  }
  const identity = Object.fromEntries(IDENTITY_FIELDS.map((f) => [f, plan.identity?.[f] ?? null]))
  identity.plan_digest = plan.identity?.plan_digest
  const artifacts = buckets.map((slice, index) => {
    const rows = slice.map((t) => byId.get(t.task_id)).filter(Boolean)
    const json = {
      schema: SHARD_SCHEMA,
      shard_id: `census-plan-shard-${String(index + 1)}`,
      policy_digest: POLICY_DIGEST,
      identity: { ...identity },
      status: 'COMPLETED',
      exit_code: 0,
      plan: { captures: plan.captures, tasks: tasks.length, shard_tasks: slice.length },
      execution: execution ?? null,
      results: rows,
    }
    return { file: `census-shard-${String(index + 1)}.json`, json }
  })
  return { ok: true, artifacts }
}

/** Write the artifacts under `dir` and return their absolute paths (raw bytes are what is graded). */
export function writeShardArtifacts(dir, artifacts, { writeFile = writeFileSync } = {}) {
  const files = []
  for (const artifact of artifacts) {
    const abs = join(dir, artifact.file)
    writeFile(abs, `${JSON.stringify(artifact.json, null, 2)}\n`)
    files.push(abs)
  }
  return files
}

/**
 * Aggregate the artifacts FROM DISK: the shard digest the summary reports is the bytes' digest.
 *
 * Before aggregating, every result's `evidence` reference is RESOLVED AND OPENED (see
 * `verifyEvidenceRefs`): the shard's own directory is the evidence root, and a reference that does
 * not name a file inside it is refused. Without that step a doctored shard set (22 PASS results
 * pointing at `<something>#<root>`) aggregated to PASS — the evidence field was a string the
 * aggregator trusted, not a pointer it checked.
 */
export function aggregateArtifacts({ plan, files, readShard = readShardFile }) {
  const shards = []
  for (const file of files) {
    const shard = readShard(file)
    const evidence = verifyEvidenceRefs(shard, { dir: dirname(file), file })
    if (!evidence.ok) return evidence
    shards.push(shard)
  }
  return aggregate({ plan, shards })
}

// ─────────────────────────────────────────────────── evidence artifacts ──

export const EVIDENCE_SCHEMA = 'census-evidence/1'

/** `sha256:<64 hex>` of a file's bytes, or null when it cannot be read. */
export function digestFile(file, { readFile = readFileSync } = {}) {
  try {
    return `sha256:${createHash('sha256').update(readFile(file)).digest('hex')}`
  } catch {
    return null
  }
}

/**
 * Write the capture's EVIDENCE ARTIFACT into the shard directory and re-anchor every result's
 * `evidence` to it.
 *
 * Why a second file: the graded bytes are the shard, and the shard must point at something the
 * aggregator can OPEN. The vitest report lives outside the shard directory (`.artifacts/census/`),
 * and a reference that escapes the artifact directory is exactly what `verifyEvidenceRefs` refuses.
 * So the runner writes a compact, self-describing slice — per root: state, file/assertion counts,
 * skip count and a digest over the same fields the result carries — and the shard points at THAT,
 * with the report (or recording) named plus digested inside it.
 */
export function writeEvidenceArtifact(dir, { capture, source, sourceDigest = null, results, writeFile = writeFileSync }) {
  const roots = results.map((r) => ({
    root: r.root,
    task_id: r.task_id,
    state: r.state,
    files: Number.isFinite(r.files) ? r.files : null,
    assertions: Number.isFinite(r.assertions) ? r.assertions : null,
    skipped: Number.isFinite(r.skipped) ? r.skipped : null,
    digest: digestJson({ root: r.root, capture: r.capture, state: r.state, files: r.files ?? null, assertions: r.assertions ?? null, skipped: r.skipped ?? null }),
  }))
  const name = `census-evidence-${String(capture)}.json`
  const json = {
    schema: EVIDENCE_SCHEMA,
    capture,
    source: { path: source, digest: sourceDigest },
    roots,
  }
  writeFile(join(dir, name), `${JSON.stringify(json, null, 2)}\n`)
  const anchored = results.map((r, i) => ({ ...r, evidence: `${name}#${r.root} ${roots[i].digest}` }))
  return { ok: true, name, json, results: anchored }
}

/**
 * The report path a plan-mode capture writes. STAMPED with this run's stamp and pid, exactly like
 * the legacy capture path: the plan's own argv path is deterministic (`taskReportPath`), so without
 * the stamp a vitest crash before writing the report would leave the PREVIOUS run's report at the
 * graded path and the census would grade stale bytes as a fresh PASS. The leg also unlinks the path
 * before spawning, so "no report" stays a named refusal.
 */
export function stampedReportPath({ stamp, pid, capture }) {
  return join('.artifacts', 'census', `census-${String(stamp)}-${String(pid)}-${String(capture)}.json`)
}

// ───────────────────────────────────────────────────────────── transcript lines ──

/**
 * The ubiquitous-language lines. They exist so a human reading the transcript can SEE that the
 * census was full, not infer it: the plan digest, the task/root/capture counts, the per-capture
 * counts, the shard layout and the aggregate verdict with expected/observed.
 */
export function renderPlanTokens({ plan, buildDigest, captureLines, shardCount, shardLayout, summary, verdict, refusal }) {
  const lines = []
  lines.push(
    `DSH-CENSUS-PLAN execution=plan tasks=${String(plan.tasks.length)} roots=${String(plan.roots.length)} ` +
      `captures=${String(plan.captures)} plan=${String(plan.identity.plan_digest)} ` +
      `catalog=${String(plan.identity.catalog_digest)} build=${String(buildDigest)} ` +
      `merge_tree=${String(plan.identity.merge_tree_sha)} host=${String(plan.identity.host_sha)}`,
  )
  for (const line of captureLines) lines.push(line)
  if (refusal !== undefined && refusal !== null) {
    lines.push(`DSH-CENSUS-REFUSED code=${refusal.code} detail=${String(refusal.detail).replace(/\s+/g, ' ').slice(0, 240)}`)
    lines.push(`DSH-CENSUS-SUMMARY verdict=REFUSED codes=${refusal.code} expected=${String(plan?.tasks?.length ?? 0)} observed=0`)
    return lines
  }
  lines.push(`DSH-CENSUS-SHARDS shards=${String(shardCount)} layout=${String(shardLayout)}`)
  lines.push(
    `DSH-CENSUS-SUMMARY verdict=${String(verdict)} codes=${summary.codes.length === 0 ? 'none' : summary.codes.join(',')} ` +
      `expected=${String(summary.counts.expected)} observed=${String(summary.counts.observed)} ` +
      `missing=${String(summary.counts.missing)} extra=${String(summary.counts.extra)} shards=${String(shardCount)} ` +
      `plan=${String(plan.identity.plan_digest)}`,
  )
  return lines
}

/** Read a recorded replay file. Absence is a named refusal: a dry run cannot invent a recording. */
export function readReplay(file, { readFile = readFileSync } = {}) {
  const abs = resolve(file)
  if (!existsSync(abs)) return refused('DRYRUN_REPLAY_MISSING', `${file} is absent — a dry run replays a RECORDED capture, it does not invent one`)
  try {
    return { ok: true, json: JSON.parse(String(readFile(abs))), text: String(readFile(abs)) }
  } catch (e) {
    return refused('DRYRUN_REPLAY_UNREADABLE', `${file}: ${String(e && e.message ? e.message : e)}`)
  }
}

/** Read a recorded vitest JSON report (the other recording shape a transcript dir may hold). */
export function readReport(file, { readFile = readFileSync } = {}) {
  const abs = resolve(file)
  if (!existsSync(abs)) return refused('DRYRUN_CAPTURE_MISSING', `${file} is absent — a dry run replays a RECORDED report, it does not re-run the suite`)
  try {
    return { ok: true, json: JSON.parse(String(readFile(abs))) }
  } catch (e) {
    return refused('DRYRUN_CAPTURE_UNREADABLE', `${file}: ${String(e && e.message ? e.message : e)}`)
  }
}

/**
 * Resolve one dry-run capture from a recorded directory: `census-replay-<n>.json` (the runner's own
 * recording) or `census-capture-<n>.json` (the vitest report it was derived from). Exactly one is
 * used; neither present is a named refusal (a missing second capture must not become a one-capture
 * census that still aggregates).
 */
export function resolveDryRunCapture(dir, capture, { exists = existsSync } = {}) {
  const replayFile = join(dir, `census-replay-${String(capture)}.json`)
  const reportFile = join(dir, `census-capture-${String(capture)}.json`)
  if (exists(replayFile)) return { ok: true, kind: 'replay', file: replayFile }
  if (exists(reportFile)) return { ok: true, kind: 'report', file: reportFile }
  return refused(
    'DRYRUN_CAPTURE_MISSING',
    `neither census-replay-${String(capture)}.json nor census-capture-${String(capture)}.json exists in ${dir} — ` +
      'a dry run of a two-capture census needs both captures recorded',
  )
}
