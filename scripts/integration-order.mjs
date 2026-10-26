#!/usr/bin/env node
/**
 * integration-order.mjs — EB4-E: is this C2 evidence still worth anything against the candidate?
 *
 * THE RULE THIS CHECKS, verbatim from the current plan (U7 bullet, EB4-E):
 *   "并行的 Family Contribution 及短事务集成，分支局部 C2 不能替代合并后的 C2"
 *   — branch-local C2 CANNOT substitute for merged-head C2. A family branch may prove C1 and run
 *   its own real C2 against its own tree; the Integrator then merges a short transaction into ONE
 *   candidate and re-runs C2 on that candidate against the shared registration / teardown /
 *   authorization chain, plus the cross-family security negatives. The reason is mechanical, not
 *   ceremonial: `agent-bindings.mjs` / `team-tool-plane.mjs` are shared surfaces, so a C2 taken on a
 *   branch measures a tree that does not have the other family's contribution in it.
 *
 * WHAT THIS TOOL DOES. Every C2 record in `dev/agent-workflow/evidence/**` that carries the
 * `u5-run-record/1` schema binds itself to a `bindings.teamSha`. This tool answers, per record and
 * then per branch, the only question that decides whether that binding is still the candidate:
 *
 *   EXACT_MERGED_HEAD       teamSha IS the target head — the strongest form
 *   MERGED_ANCESTOR         teamSha is merged but behind the target (lag N) — usable as history, but
 *                           it did not test the candidate; re-run on the merged head
 *   BRANCH_LOCAL            teamSha is a DESCENDANT of the target — it tested a tree that is not the
 *                           candidate; this is exactly the substitution EB4-E forbids
 *   UNRELATED               teamSha is on neither side — history diverged, evidence unusable
 *   NO_TEAM_SHA             the record does not bind a Team SHA at all
 *   INCOMPLETE_RECORD       record has no `overall` verdict, or zero cases, or no `finishedAt` — a
 *                           record that never finished is not delivery, whatever else it says
 *
 * It is a read-only git + JSON reader: it does not run tests, boot anything, or write. It never
 * says "the branch is verified"; it says what the evidence currently binds to.
 *
 * Fail-closed: an unknown target ref is REFUSED (exit 2, never "no evidence = fine"); an unreadable
 * or oversize record is reported, never skipped silently; `--strict` exits 1 unless every record is
 * EXACT_MERGED_HEAD.
 *
 * BOUNDS (declared, enforced): records scanned ≤ 400 (extension `.json`, ≤ 512 KiB each);
 * records reported ≤ 40 per class; stdout ≤ 24 KiB; one memoized git call per distinct SHA; no
 * child process other than `git`.
 *
 * Usage:
 *   node scripts/integration-order.mjs [--target origin/master] [--branch <task/branch>] [--json] [--strict]
 *   node scripts/integration-order.mjs --self-test
 * Exit: 0 report produced · 1 --strict and something is not EXACT_MERGED_HEAD · 2 REFUSED.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const BOUNDS = Object.freeze({ maxRecords: 400, maxRecordBytes: 512 * 1024, perClass: 40, outputBytes: 24 * 1024 })
const EVIDENCE_ROOT = 'dev/agent-workflow/evidence'
const SCHEMA = 'u5-run-record/1'

export const CLASSES = Object.freeze({
  EXACT_MERGED_HEAD: 'teamSha IS the candidate head — the strongest binding',
  MERGED_ANCESTOR: 'teamSha is merged but BEHIND the candidate: it did not test the candidate (re-run)',
  BRANCH_LOCAL: 'teamSha DESCENDS from the candidate: branch-local C2, which cannot substitute for merged-head C2',
  UNRELATED: 'teamSha is on neither side of the candidate: history diverged, evidence unusable',
  NO_TEAM_SHA: 'the record binds no Team SHA at all',
  INCOMPLETE_RECORD: 'record never finished (no overall verdict, zero cases, or no finishedAt) — not delivery',
})

const git = (root, args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

function resolveRev(root, rev) {
  const r = git(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`])
  return r.status === 0 ? r.stdout.trim() : null
}

/** Memoized ancestry + lag, so a corpus of records costs one git pair per distinct SHA. */
function makeAncestry(root) {
  const memo = new Map()
  const isAncestor = (a, b) => {
    const key = `A:${a}:${b}`
    if (!memo.has(key)) memo.set(key, git(root, ['merge-base', '--is-ancestor', a, b]).status === 0)
    return memo.get(key)
  }
  const lag = (a, b) => {
    const key = `L:${a}:${b}`
    if (!memo.has(key)) {
      const r = git(root, ['rev-list', '--count', `${a}..${b}`])
      memo.set(key, r.status === 0 ? Number(r.stdout.trim()) : null)
    }
    return memo.get(key)
  }
  return { isAncestor, lag }
}

/** Classify one record's teamSha against the candidate head. Pure apart from the injected git. */
export function classify(record, head, anc) {
  const b = record?.bindings ?? {}
  const teamSha = typeof b.teamSha === 'string' && /^[0-9a-f]{40}$/.test(b.teamSha) ? b.teamSha : null
  const finished = typeof record?.finishedAt === 'string' && record.finishedAt.length > 0
  const overall = typeof record?.overall === 'string' && record.overall.length > 0
  const cases = Array.isArray(record?.cases) ? record.cases.length : 0
  if (teamSha === null) return { cls: 'NO_TEAM_SHA', detail: 'bindings.teamSha absent or not a 40-hex SHA' }
  if (!finished || !overall || cases === 0) {
    return { cls: 'INCOMPLETE_RECORD', detail: `finishedAt=${finished ? 'yes' : 'ABSENT'} overall=${overall ? record.overall : 'ABSENT'} cases=${String(cases)}` }
  }
  if (teamSha === head) return { cls: 'EXACT_MERGED_HEAD', detail: teamSha }
  if (anc.isAncestor(teamSha, head)) {
    const n = anc.lag(teamSha, head)
    return { cls: 'MERGED_ANCESTOR', detail: `${n === null ? 'lag unknown' : `lag ${String(n)} commit(s)`}` }
  }
  if (anc.isAncestor(head, teamSha)) {
    const n = anc.lag(head, teamSha)
    return { cls: 'BRANCH_LOCAL', detail: `ahead of the candidate by ${n === null ? '?' : String(n)} commit(s)` }
  }
  return { cls: 'UNRELATED', detail: 'not an ancestor or descendant of the candidate' }
}

function* walkJson(dir, budget) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of [...entries].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (budget.left <= 0) return
    const full = join(dir, e.name)
    if (e.isDirectory()) { yield* walkJson(full, budget); continue }
    if (!e.isFile() || !e.name.endsWith('.json')) continue
    budget.left -= 1
    yield full
  }
}

export function collectRecords(root = REPO_ROOT) {
  const dir = join(root, ...EVIDENCE_ROOT.split('/'))
  const budget = { left: BOUNDS.maxRecords }
  const records = []
  const skipped = []
  for (const file of walkJson(dir, budget)) {
    let st
    try { st = statSync(file) } catch { skipped.push([relative(root, file).split(sep).join('/'), 'unstatable']); continue }
    if (st.size > BOUNDS.maxRecordBytes) { skipped.push([relative(root, file).split(sep).join('/'), `${String(st.size)} B over the record cap (not read)`]); continue }
    let text
    try { text = readFileSync(file, 'utf8') } catch { skipped.push([relative(root, file).split(sep).join('/'), 'unreadable']); continue }
    if (!text.includes(SCHEMA)) continue
    let parsed
    try { parsed = JSON.parse(text) } catch { skipped.push([relative(root, file).split(sep).join('/'), 'unparseable despite carrying the run-record schema']); continue }
    if (parsed?.schema !== SCHEMA) continue
    records.push({ path: relative(root, file).split(sep).join('/'), record: parsed })
  }
  return { records, skipped, exhausted: budget.left <= 0 }
}

export function report({ target = 'origin/master', branch = null, root = REPO_ROOT } = {}) {
  const head = resolveRev(root, branch ?? target)
  if (head === null) return { refused: `target ${JSON.stringify(branch ?? target)} does not resolve to a commit in this repository — refusing rather than reporting an empty answer` }
  const anc = makeAncestry(root)
  const { records, skipped, exhausted } = collectRecords(root)
  const rows = records.map(({ path, record }) => ({ path, suite: record.suite ?? null, runId: record.runId ?? null, startedAt: record.startedAt ?? null, head, ...classify(record, head, anc) }))
  const byClass = {}
  for (const r of rows) (byClass[r.cls] ??= []).push(r)
  return { target: branch ?? target, head, rows, byClass, skipped, exhausted }
}

function render(rep) {
  const lines = [`integration-order: target=${rep.target} head=${rep.head.slice(0, 12)} records=${String(rep.rows.length)}`]
  for (const [cls, rows] of Object.entries(rep.byClass)) {
    lines.push(`${cls} (${String(rows.length)}) — ${CLASSES[cls]}`)
    for (const r of rows.slice(0, BOUNDS.perClass)) lines.push(`  ${r.path}${r.suite ? ` [${r.suite}]` : ''} ${r.detail}`)
    if (rows.length > BOUNDS.perClass) lines.push(`  …(+${String(rows.length - BOUNDS.perClass)} more in this class)`)
  }
  if (rep.skipped.length > 0) {
    lines.push(`NOT GRADED (${String(rep.skipped.length)}):`)
    for (const [p, why] of rep.skipped.slice(0, 10)) lines.push(`  ${p}: ${why}`)
  }
  if (rep.exhausted) lines.push(`BOUND HIT: stopped after ${String(BOUNDS.maxRecords)} candidate files — the report is partial`)
  const sub = (rep.byClass.BRANCH_LOCAL?.length ?? 0) + (rep.byClass.MERGED_ANCESTOR?.length ?? 0)
  lines.push(`RULE branch-local C2 cannot substitute for merged-head C2: ${String(sub)} record(s) do not bind the candidate; ${String(rep.byClass.EXACT_MERGED_HEAD?.length ?? 0)} do.`)
  lines.push('LIMIT read-only evidence binding audit: no test run, no Host boot, no verdict on whether any C2 PASSED its own lanes')
  return `${lines.join('\n')}\n`
}

function selfTest(root = REPO_ROOT) {
  const problems = []
  const rep = report({ root })
  if (rep.refused) problems.push(`default target refused: ${rep.refused}`)
  const anc = makeAncestry(root)
  const head = resolveRev(root, 'HEAD')
  const fake = (over) => ({ schema: SCHEMA, finishedAt: '2026-01-01T00:00:00Z', overall: 'PASS', cases: [{}], bindings: { teamSha: head }, ...over })
  if (head !== null) {
    if (classify(fake({}), head, anc).cls !== 'EXACT_MERGED_HEAD') problems.push('a HEAD-bound finished record is not classified EXACT_MERGED_HEAD')
    if (classify(fake({ finishedAt: undefined }), head, anc).cls !== 'INCOMPLETE_RECORD') problems.push('a record with no finishedAt is not classified INCOMPLETE_RECORD')
    if (classify(fake({ overall: undefined }), head, anc).cls !== 'INCOMPLETE_RECORD') problems.push('a record with no overall verdict is not classified INCOMPLETE_RECORD')
    if (classify(fake({ cases: [] }), head, anc).cls !== 'INCOMPLETE_RECORD') problems.push('a zero-case record is not classified INCOMPLETE_RECORD')
    if (classify(fake({ bindings: {} }), head, anc).cls !== 'NO_TEAM_SHA') problems.push('a record with no teamSha is not classified NO_TEAM_SHA')
    if (classify(fake({ bindings: { teamSha: 'z'.repeat(40) } }), head, anc).cls !== 'NO_TEAM_SHA') problems.push('a non-hex teamSha is not classified NO_TEAM_SHA')
  }
  return problems
}

function main(argv) {
  const opts = { target: 'origin/master', branch: null, json: false, strict: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--target') opts.target = argv[(i += 1)] ?? 'origin/master'
    else if (a === '--branch') opts.branch = argv[(i += 1)] ?? null
    else if (a === '--json') opts.json = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--self-test') {
      const p = selfTest()
      process.stdout.write(p.length === 0 ? 'integration-order --self-test: OK (six classes, fail-closed record checks)\n' : `integration-order --self-test: FAIL ${String(p.length)}\n${p.map((x) => `  ${x}`).join('\n')}\n`)
      process.exit(p.length === 0 ? 0 : 1)
    } else {
      process.stdout.write(`usage: integration-order.mjs [--target <ref>] [--branch <ref>] [--json] [--strict] | --self-test\n`)
      process.exit(2)
    }
  }
  const rep = report(opts)
  if (rep.refused) { process.stdout.write(`REFUSED TARGET_UNRESOLVABLE: ${rep.refused}\n`); process.exit(2) }
  const out = opts.json ? `${JSON.stringify(rep, null, 1)}\n` : render(rep)
  if (Buffer.byteLength(out) > BOUNDS.outputBytes) { process.stdout.write(`REFUSED OUTPUT_OVER_BOUND: ${String(Buffer.byteLength(out))} B > ${String(BOUNDS.outputBytes)} B\n`); process.exit(2) }
  process.stdout.write(out)
  if (opts.strict) {
    const nonExact = rep.rows.length - (rep.byClass.EXACT_MERGED_HEAD?.length ?? 0)
    if (nonExact > 0) { process.stdout.write(`STRICT FAIL: ${String(nonExact)} record(s) do not bind the candidate head\n`); process.exit(1) }
    if (rep.rows.length === 0) { process.stdout.write('STRICT FAIL: no C2 record binds anything — absence is not a pass\n'); process.exit(1) }
  }
  process.exit(0)
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main(process.argv.slice(2))
