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
 * WHAT THIS TOOL DOES. Every C2 record COMMITTED under `dev/agent-workflow/evidence/**` that carries
 * the `u5-run-record/1` schema binds itself to a `bindings.teamSha`. This tool answers, per record and
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
 * WHAT IT READS: the committed tree only. Candidates are the `.json` blobs `git ls-tree HEAD` lists
 * under the evidence root, read with `git cat-file --batch` — never the disk. The audit is about what
 * is committed, so an untracked local file, or an uncommitted edit of a tracked one, cannot change the
 * verdict (PR #394 walked the disk: at f3f415aa0 the main checkout held 505 `.json` there against 174
 * tracked, and the verdict depended on which of them a given machine happened to have).
 *
 * Fail-closed: an unknown target ref is REFUSED (exit 2, never "no evidence = fine"); an unreadable
 * or oversize record is reported, never skipped silently; a BOUND HIT is REFUSED (exit 2) — a partial
 * report is never printed as if it were the audit; `--strict` exits 1 unless every record is
 * EXACT_MERGED_HEAD.
 *
 * BOUNDS (declared, enforced): RECORDS graded ≤ 200 — the budget is spent on files that parse and
 * carry the run-record schema, not on arbitrary json (PR #394 spent 400 on every `.json` in name
 * order, so at f3f415aa0 it graded 24 of the 50 committed records and dropped the rest). Measured
 * at origin/master f3f415aa0: 174 tracked `.json` under the evidence root, 55 mention the schema,
 * 50 are records; 200 is 4× that. Candidate `.json` blobs read ≤ 4000, each ≤ 512 KiB (over the cap:
 * NOT GRADED by name and size, never read). Rows reported ≤ 40 per class; stdout ≤ 24 KiB; one
 * memoized git call per distinct SHA; no child process other than `git`.
 *
 * Usage:
 *   node scripts/integration-order.mjs [--target origin/master] [--branch <task/branch>] [--json] [--strict]
 *   node scripts/integration-order.mjs --self-test
 * Exit: 0 report produced · 1 --strict and something is not EXACT_MERGED_HEAD · 2 REFUSED (target
 * unresolvable, BOUND HIT, or output over bound).
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const BOUNDS = Object.freeze({ maxRecords: 200, maxCandidates: 4000, maxRecordBytes: 512 * 1024, perClass: 40, outputBytes: 24 * 1024 })
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

/** The `.json` blobs committed at `rev` under the evidence root, in path order: { path, oid, size }. */
function committedJson(root, rev) {
  const r = git(root, ['ls-tree', '-r', '-l', '-z', '--full-tree', rev, '--', EVIDENCE_ROOT])
  if (r.status !== 0) return null
  const out = []
  for (const entry of r.stdout.split('\0')) {
    const m = /^\d+ blob ([0-9a-f]+) +(\d+)\t(.+)$/.exec(entry)
    if (m !== null && m[3].endsWith('.json')) out.push({ oid: m[1], size: Number(m[2]), path: m[3] })
  }
  return out.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0))
}

/** Blob contents for `oids` in ONE `git cat-file --batch` call; Map oid → utf8 text. */
function readBlobs(root, oids) {
  const texts = new Map()
  if (oids.length === 0) return texts
  const r = spawnSync('git', ['-C', root, 'cat-file', '--batch'], { input: `${oids.join('\n')}\n`, maxBuffer: 1024 * 1024 * 1024 })
  if (r.status !== 0 || !Buffer.isBuffer(r.stdout)) return texts
  const buf = r.stdout
  let at = 0
  while (at < buf.length) {
    const nl = buf.indexOf(10, at)
    if (nl === -1) break
    const [oid, type, size] = buf.subarray(at, nl).toString('utf8').split(' ')
    if (type !== 'blob') { at = nl + 1; continue }
    const n = Number(size)
    texts.set(oid, buf.subarray(nl + 1, nl + 1 + n).toString('utf8'))
    at = nl + 1 + n + 1
  }
  return texts
}

/**
 * The run records committed at `rev` (default HEAD of `root`). Untracked and uncommitted files are
 * never read. Non-record json costs one read and no budget; a bound hit sets `bound` and the caller
 * must refuse — the record list is then a prefix, not the corpus.
 */
export function collectRecords(root = REPO_ROOT, { rev = 'HEAD' } = {}) {
  const records = []
  const skipped = []
  const commit = resolveRev(root, rev)
  const listed = commit === null ? null : committedJson(root, commit)
  if (listed === null) return { records, skipped, commit, bound: null, refused: `cannot list the committed evidence at ${rev}` }
  if (listed.length > BOUNDS.maxCandidates) {
    return { records, skipped, commit, bound: `${String(listed.length)} committed .json under ${EVIDENCE_ROOT} > maxCandidates ${String(BOUNDS.maxCandidates)}` }
  }
  const readable = []
  for (const f of listed) {
    if (f.size > BOUNDS.maxRecordBytes) skipped.push([f.path, `${String(f.size)} B over the record cap (not read)`])
    else readable.push(f)
  }
  const texts = readBlobs(root, readable.map((f) => f.oid))
  for (const f of readable) {
    const text = texts.get(f.oid)
    if (text === undefined) { skipped.push([f.path, 'unreadable (git cat-file returned no blob)']); continue }
    if (!text.includes(SCHEMA)) continue
    let parsed
    try { parsed = JSON.parse(text) } catch { skipped.push([f.path, 'unparseable despite carrying the run-record schema']); continue }
    if (parsed?.schema !== SCHEMA) continue
    if (records.length >= BOUNDS.maxRecords) {
      return { records, skipped, commit, bound: `more than maxRecords ${String(BOUNDS.maxRecords)} committed run records (stopped at ${f.path})` }
    }
    records.push({ path: f.path, record: parsed })
  }
  return { records, skipped, commit, bound: null }
}

export function report({ target = 'origin/master', branch = null, root = REPO_ROOT } = {}) {
  const head = resolveRev(root, branch ?? target)
  if (head === null) return { refused: `target ${JSON.stringify(branch ?? target)} does not resolve to a commit in this repository — refusing rather than reporting an empty answer` }
  const anc = makeAncestry(root)
  const { records, skipped, commit, bound, refused } = collectRecords(root)
  if (refused) return { refused }
  if (bound !== null) return { bound, evidenceAt: commit, target: branch ?? target, head }
  const rows = records.map(({ path, record }) => ({ path, suite: record.suite ?? null, runId: record.runId ?? null, startedAt: record.startedAt ?? null, head, ...classify(record, head, anc) }))
  const byClass = {}
  for (const r of rows) (byClass[r.cls] ??= []).push(r)
  return { target: branch ?? target, head, evidenceAt: commit, rows, byClass, skipped }
}

function render(rep) {
  const lines = [`integration-order: target=${rep.target} head=${rep.head.slice(0, 12)} evidence@${rep.evidenceAt.slice(0, 12)} records=${String(rep.rows.length)}`]
  for (const [cls, rows] of Object.entries(rep.byClass)) {
    lines.push(`${cls} (${String(rows.length)}) — ${CLASSES[cls]}`)
    for (const r of rows.slice(0, BOUNDS.perClass)) lines.push(`  ${r.path}${r.suite ? ` [${r.suite}]` : ''} ${r.detail}`)
    if (rows.length > BOUNDS.perClass) lines.push(`  …(+${String(rows.length - BOUNDS.perClass)} more in this class)`)
  }
  if (rep.skipped.length > 0) {
    lines.push(`NOT GRADED (${String(rep.skipped.length)}):`)
    for (const [p, why] of rep.skipped.slice(0, 10)) lines.push(`  ${p}: ${why}`)
  }
  const sub = (rep.byClass.BRANCH_LOCAL?.length ?? 0) + (rep.byClass.MERGED_ANCESTOR?.length ?? 0)
  lines.push(`RULE branch-local C2 cannot substitute for merged-head C2: ${String(sub)} record(s) do not bind the candidate; ${String(rep.byClass.EXACT_MERGED_HEAD?.length ?? 0)} do.`)
  lines.push(`LIMIT read-only evidence binding audit of the run records COMMITTED at ${rep.evidenceAt.slice(0, 12)} (git ls-tree; untracked and uncommitted files are not read): no test run, no Host boot, no verdict on whether any C2 PASSED its own lanes`)
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
  if (rep.bound) {
    // A partial corpus is not an audit: no class counts, no RULE line, non-zero exit.
    process.stdout.write(`BOUND HIT: ${rep.bound} — REFUSED, no partial report is produced; raise the bound with a measurement (see the BOUNDS header)\n`)
    process.exit(2)
  }
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
