#!/usr/bin/env node
/**
 * devex-integration.test.mjs — node:test coverage for scripts/devex.mjs (EB4-D) and
 * scripts/integration-order.mjs (EB4-E). No Host, no network, no port, no test run:
 * every spawned command is an injected fake, or a real script that only READS this tree.
 * The EB4-E fixtures are throwaway git repos built under `.artifacts/tmp/` (gitignored) with a
 * KNOWN history, so no assertion depends on the shape of whatever commit this checkout sits on.
 * Run: node --test tests/u7-3-devex/devex-integration.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const DEVEX = join(REPO, 'scripts', 'devex.mjs')
const ORDER = join(REPO, 'scripts', 'integration-order.mjs')
const devex = await import(DEVEX)
const order = await import(ORDER)
const scratch = mkdtempSync(join(tmpdir(), 'u7-3-devex-'))
mkdirSync(join(REPO, '.artifacts', 'tmp'), { recursive: true })
const fixtures = mkdtempSync(join(REPO, '.artifacts', 'tmp', 'u7-3-devex-'))
after(() => { rmSync(scratch, { recursive: true, force: true }); rmSync(fixtures, { recursive: true, force: true }) })

const run = (tool, args) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8', timeout: 120_000 })

// ── EB4-D: the closed command table ───────────────────────────────────────────────────────────

test('D1 --self-test: every routed script exists, every entry declares bounds + an owner + a red story', () => {
  const r = run(DEVEX, ['--self-test'])
  assert.equal(r.status, 0, r.stdout)
  assert.match(r.stdout, /OK \d+ entries/)
})

test('D2 the self-test is not vacuous: a routed script that does not exist is caught', () => {
  const problems = devex.selfTest(scratch)
  assert.ok(problems.some((p) => p.includes('does not exist')), JSON.stringify(problems))
})

test('D3 the table is closed and bounded: no entry routes outside scripts/ or pnpm, all bounds positive', () => {
  for (const [name, e] of Object.entries(devex.COMMANDS)) {
    if (e.refuse) { assert.equal(e.argv ?? e.steps, undefined, `${name}: a refused entry must route nowhere`); continue }
    assert.ok(e.bounds.timeoutMs > 0 && e.bounds.outputCap > 0, `${name}: bounds must be positive`)
    const steps = e.steps ?? [e.argv]
    for (const step of steps) {
      if (step[0] === 'node') assert.ok(step[1].startsWith('scripts/'), `${name}: routes outside scripts/ (${step[1]})`)
      else assert.equal(step[0], 'pnpm', `${name}: only node scripts and pnpm are routed (got ${step[0]})`)
    }
  }
})

test('D4 list + describe: every refused entry explains why and points at its doc', () => {
  const list = run(DEVEX, ['list'])
  assert.equal(list.status, 0)
  assert.match(list.stdout, /host\s+\[refused\]/)
  for (const name of ['host', 'release']) {
    const d = run(DEVEX, ['describe', name])
    assert.equal(d.status, 0)
    assert.match(d.stdout, /REFUSED as self-service/)
    assert.match(d.stdout, /Never|never|not self-service|approval-gated|test-instance/)
  }
})

test('D5 run host / release REFUSES (exit 2) and runs nothing', () => {
  for (const name of ['host', 'release']) {
    let spawned = 0
    const r = devex.runEntry(name, [], { spawn: () => { spawned += 1 } })
    assert.equal(r.verdict, 'refused')
    assert.equal(r.exit, 2)
    assert.equal(spawned, 0, 'a refused entry must not spawn anything')
  }
})

test('D6 run: verdict comes from the child status alone (pass / fail / refused)', () => {
  const fake = (status, text = 'x') => () => ({ status, stdout: text, stderr: '' })
  assert.equal(devex.runEntry('verify-gated-missing', [], { spawn: fake(0) }).exit, 2) // unknown name
  assert.equal(devex.runEntry('verify-changed', [], { spawn: fake(0, 'ok') }).verdict, 'pass')
  assert.equal(devex.runEntry('verify-changed', [], { spawn: fake(1, 'FAIL LINK_DANGLING') }).verdict, 'fail')
  assert.equal(devex.runEntry('verify-changed', [], { spawn: fake(2, 'REFUSED') }).verdict, 'refused')
})

test('D7 a timeout is reported TIMEOUT, never pass, and never left running', () => {
  const timeoutSpawn = () => ({ status: null, signal: 'SIGKILL', error: { code: 'ETIMEDOUT' }, stdout: 'partial', stderr: '' })
  const r = devex.runEntry('verify-changed', [], { spawn: timeoutSpawn })
  assert.equal(r.verdict, 'timeout')
  assert.notEqual(r.exit, 0)
})

test('D8 output is capped per step, the TAIL kept, and the cut size stated', () => {
  const big = 'A'.repeat(devex.COMMANDS['verify-changed'].bounds.outputCap * 2) + 'DEVEX-TAIL-MARKER'
  const r = devex.runEntry('verify-changed', [], { spawn: () => ({ status: 0, stdout: big, stderr: '' }) })
  assert.match(r.out, /bytes cut from the head; tail kept/)
  assert.match(r.out, /DEVEX-TAIL-MARKER/, 'the verdict-bearing tail must survive the cap')
  assert.ok(!r.out.includes('A'.repeat(devex.COMMANDS['verify-changed'].bounds.outputCap + 10)))
})

test('D9 arguments only pass through where the entry declares passArgs', () => {
  const r = devex.runEntry('verify-gate', ['--full'], { spawn: () => ({ status: 0, stdout: '', stderr: '' }) })
  assert.equal(r.verdict, 'refused')
  assert.match(r.out, /takes no arguments/)
})

test('D10 real routed commands (read-only ones) actually pass through devex', () => {
  const r = run(DEVEX, ['run', 'diag', '--', '--code', 'GRANT_STALE'])
  assert.equal(r.status, 0, r.stdout)
  assert.match(r.stdout, /DEVEX-RESULT name=diag verdict=pass/)
  assert.match(r.stdout, /GRANT_STALE/)
})

test('D11 real: verify-changed over this tree passes and prints one DEVEX-RESULT line', () => {
  const r = run(DEVEX, ['run', 'verify-changed'])
  assert.equal(r.status, 0, r.stdout.slice(-800))
  assert.equal((r.stdout.match(/^DEVEX-RESULT /gm) ?? []).length, 1)
  assert.match(r.stdout, /verdict=pass/)
})

// ── EB4-E: integration order ──────────────────────────────────────────────────────────────────

test('E1 --self-test: the six classes behave, including the fail-closed record checks', () => {
  const r = run(ORDER, ['--self-test'])
  assert.equal(r.status, 0, r.stdout)
})

// A throwaway repo with a KNOWN history (the PR #394 E2 took HEAD^ of this checkout and asserted
// `lag 1`, which only holds on a linear tip: on a merge commit HEAD^ is the previous master and
// the lag was 22). `main` = a → b → c; `side` = c → d; `orphan` = e (no shared history).
let fixtureN = 0
const gitIn = (dir, args, input) => {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.name=u7-3', '-c', 'user.email=u7-3@invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8', input })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${dir}: ${r.stderr}`)
  return r.stdout.trim()
}
function fixtureRepo() {
  const dir = join(fixtures, `repo-${String((fixtureN += 1))}`)
  mkdirSync(dir, { recursive: true })
  gitIn(dir, ['init', '-q', '-b', 'main'])
  return dir
}
const commitEmpty = (dir, msg) => { gitIn(dir, ['commit', '-q', '--allow-empty', '-m', msg]); return gitIn(dir, ['rev-parse', 'HEAD']) }
function lineage() {
  const dir = fixtureRepo()
  const a = commitEmpty(dir, 'a')
  const b = commitEmpty(dir, 'b')
  const c = commitEmpty(dir, 'c')
  gitIn(dir, ['checkout', '-q', '-b', 'side'])
  const d = commitEmpty(dir, 'd')
  gitIn(dir, ['checkout', '-q', '--orphan', 'orphan'])
  const e = commitEmpty(dir, 'e')
  gitIn(dir, ['checkout', '-q', 'main'])
  const anc = {
    isAncestor: (x, y) => spawnSync('git', ['-C', dir, 'merge-base', '--is-ancestor', x, y]).status === 0,
    lag: (x, y) => Number(gitIn(dir, ['rev-list', '--count', `${x}..${y}`])),
  }
  return { dir, a, b, c, d, e, anc }
}
const rec = (sha, over = {}) => ({ schema: 'u5-run-record/1', finishedAt: 't', overall: 'PASS', cases: [1], bindings: { teamSha: sha }, ...over })

/** Every way `classify` must read the known lineage; [] = all hold. Shared by E2 and its mutation proof. */
function lineageProblems(classify, L) {
  const expect = [
    [L.c, 'EXACT_MERGED_HEAD', new RegExp(`^${L.c}$`)],
    [L.b, 'MERGED_ANCESTOR', /^lag 1 commit\(s\)$/],
    [L.a, 'MERGED_ANCESTOR', /^lag 2 commit\(s\)$/],
    [L.d, 'BRANCH_LOCAL', /^ahead of the candidate by 1 commit\(s\)$/],
    [L.e, 'UNRELATED', /not an ancestor or descendant/],
    ['0'.repeat(40), 'UNRELATED', /not an ancestor or descendant/],
  ]
  const problems = []
  for (const [sha, cls, detail] of expect) {
    const got = classify(rec(sha), L.c, L.anc)
    if (got.cls !== cls || !detail.test(got.detail)) problems.push(`${sha.slice(0, 8)}: want ${cls} ${String(detail)}, got ${got.cls} ${JSON.stringify(got.detail)}`)
  }
  if (classify(rec(undefined), L.c, L.anc).cls !== 'NO_TEAM_SHA') problems.push('no teamSha is not NO_TEAM_SHA')
  if (classify(rec(L.c, { overall: undefined }), L.c, L.anc).cls !== 'INCOMPLETE_RECORD') problems.push('no overall is not INCOMPLETE_RECORD')
  if (classify(rec(L.c, { cases: [] }), L.c, L.anc).cls !== 'INCOMPLETE_RECORD') problems.push('zero cases is not INCOMPLETE_RECORD')
  return problems
}

test('E2 classify over a known lineage: exact / ancestor lag 1 and 2 / branch-local / unrelated / no-sha / incomplete', () => {
  assert.deepEqual(lineageProblems(order.classify, lineage()), [])
})

test('E2b E2 is not vacuous: a classify with an off-by-one lag is caught', async () => {
  const src = readFileSync(ORDER, 'utf8')
  const planted = src.replace('const n = anc.lag(teamSha, head)', 'const n = anc.lag(teamSha, head) + 1')
  assert.notEqual(planted, src, 'the off-by-one could not be planted — the mutation proof must not pass by not applying')
  const file = join(fixtures, 'integration-order.off-by-one.mjs')
  writeFileSync(file, planted)
  const mutant = await import(pathToFileURL(file).href)
  const problems = lineageProblems(mutant.classify, lineage())
  assert.ok(problems.some((p) => /lag 2 commit/.test(p)), `planted off-by-one went undetected: ${JSON.stringify(problems)}`)
})

test('E3 an unresolvable target REFUSES (exit 2) — absence of evidence is never a clean report', () => {
  const r = run(ORDER, ['--target', 'refs/heads/definitely-not-a-branch-u7-3'])
  assert.equal(r.status, 2)
  assert.match(r.stdout, /REFUSED TARGET_UNRESOLVABLE/)
})

test('E4 --strict fails while any record does not bind the candidate head', () => {
  const r = run(ORDER, ['--target', 'origin/master', '--strict'])
  assert.equal(r.status, 1, r.stdout.slice(-400))
  assert.match(r.stdout, /STRICT FAIL/)
})

test('E5 the report states the EB4-E rule and its own limit; the bound is not hit on this tree', () => {
  const r = run(ORDER, ['--target', 'origin/master'])
  assert.equal(r.status, 0)
  assert.match(r.stdout, /RULE branch-local C2 cannot substitute for merged-head C2/)
  assert.match(r.stdout, /LIMIT read-only evidence binding audit/)
  assert.ok(!/BOUND HIT/.test(r.stdout), 'this tree should fit inside maxRecords; if not, the bound must be raised with a measurement')
})

// ── EB4-E: what the audit reads — committed records only, and a bound is a failure ───────────
// Each fixture is a repo carrying a COPY of the real script at scripts/integration-order.mjs, so
// the script's own root (resolved from its location) is the fixture and nothing reads this tree.

const EVID = join('dev', 'agent-workflow', 'evidence')
function evidenceRepo(files) {
  const dir = fixtureRepo()
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'scripts', 'integration-order.mjs'), readFileSync(ORDER))
  gitIn(dir, ['add', 'scripts/integration-order.mjs'])
  const head = commitEmpty(dir, 'base')
  for (const [rel, body] of Object.entries(files(head))) {
    mkdirSync(dirname(join(dir, EVID, rel)), { recursive: true })
    writeFileSync(join(dir, EVID, rel), typeof body === 'string' ? body : JSON.stringify(body))
  }
  gitIn(dir, ['add', '--', EVID.split('\\').join('/')])
  gitIn(dir, ['commit', '-q', '-m', 'evidence'])
  return { dir, head }
}
const runIn = (dir, args) => spawnSync(process.execPath, [join(dir, 'scripts', 'integration-order.mjs'), ...args], { encoding: 'utf8', timeout: 120_000 })

test('E6 untracked and uncommitted evidence does not change the result', () => {
  const { dir, head } = evidenceRepo((h) => ({ 'lane-a/run.json': rec(h), 'lane-b/notes.json': { not: 'a record' } }))
  const before = runIn(dir, ['--target', 'main', '--json'])
  assert.equal(before.status, 0, before.stdout)
  // Plant: an untracked record, untracked non-record json, and a working-tree edit of the tracked record.
  mkdirSync(join(dir, EVID, 'local-only'), { recursive: true })
  writeFileSync(join(dir, EVID, 'local-only', 'untracked-run.json'), JSON.stringify(rec(head)))
  for (let i = 0; i < 20; i += 1) writeFileSync(join(dir, EVID, 'local-only', `scratch-${String(i)}.json`), '{}')
  writeFileSync(join(dir, EVID, 'lane-a', 'run.json'), JSON.stringify(rec(head, { overall: undefined })))
  const planted = runIn(dir, ['--target', 'main', '--json'])
  assert.equal(planted.status, before.status)
  assert.equal(planted.stdout, before.stdout, 'local files changed the audit of committed evidence')
  assert.equal(JSON.parse(before.stdout).rows.length, 1)
})

test('E7 more records than the bound FAILS (non-zero, BOUND HIT) — partial evidence is never a clean audit', () => {
  const n = order.BOUNDS.maxRecords + 1
  const { dir } = evidenceRepo((h) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`many/r-${String(i).padStart(4, '0')}.json`, rec(h)])))
  const r = runIn(dir, ['--target', 'main'])
  assert.notEqual(r.status, 0, r.stdout.slice(-400))
  assert.match(r.stdout, /BOUND HIT/)
  assert.doesNotMatch(r.stdout, /^RULE /m, 'a bound-hit run must not print the verdict line of a complete audit')
})

test('E8 a record late in name order is found: non-record json does not spend the record budget', () => {
  const n = order.BOUNDS.maxRecords
  const { dir } = evidenceRepo((h) => ({
    ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`a-early/x-${String(i).padStart(4, '0')}.json`, { census: i }])),
    'zz-late/run.json': rec(h),
  }))
  const r = runIn(dir, ['--target', 'main'])
  assert.equal(r.status, 0, r.stdout.slice(-400))
  assert.match(r.stdout, /records=1\b/)
  assert.match(r.stdout, /zz-late\/run\.json/)
  assert.doesNotMatch(r.stdout, /BOUND HIT/)
})
