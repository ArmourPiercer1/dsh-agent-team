#!/usr/bin/env node
/**
 * devex-integration.test.mjs — node:test coverage for scripts/devex.mjs (EB4-D) and
 * scripts/integration-order.mjs (EB4-E). No Host, no network, no port, no test run:
 * every spawned command is an injected fake, or a real script that only READS this tree.
 * Run: node --test tests/u7-3-devex/devex-integration.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import test, { after } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const DEVEX = join(REPO, 'scripts', 'devex.mjs')
const ORDER = join(REPO, 'scripts', 'integration-order.mjs')
const devex = await import(DEVEX)
const order = await import(ORDER)
const scratch = mkdtempSync(join(tmpdir(), 'u7-3-devex-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

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

test('E2 classify: branch-local / merged-ancestor / unrelated / no-sha / incomplete', () => {
  const git = (args) => spawnSync('git', ['-C', REPO, ...args], { encoding: 'utf8' })
  const head = git(['rev-parse', 'HEAD']).stdout.trim()
  const parent = git(['rev-parse', 'HEAD^']).stdout.trim()
  const anc = {
    isAncestor: (a, b) => git(['merge-base', '--is-ancestor', a, b]).status === 0,
    lag: (a, b) => Number(git(['rev-list', '--count', `${a}..${b}`]).stdout.trim()),
  }
  const rec = (sha, over = {}) => ({ schema: 'u5-run-record/1', finishedAt: 't', overall: 'PASS', cases: [1], bindings: { teamSha: sha }, ...over })
  assert.equal(order.classify(rec(head), head, anc).cls, 'EXACT_MERGED_HEAD')
  assert.equal(order.classify(rec(parent), head, anc).cls, 'MERGED_ANCESTOR')
  assert.match(order.classify(rec(parent), head, anc).detail, /lag 1/)
  // HEAD is an ancestor of nothing below it; a fake sha that exists nowhere is UNRELATED.
  assert.equal(order.classify(rec('0'.repeat(40)), head, anc).cls, 'UNRELATED')
  assert.equal(order.classify(rec(undefined), head, anc).cls, 'NO_TEAM_SHA')
  assert.equal(order.classify(rec(head, { overall: undefined }), head, anc).cls, 'INCOMPLETE_RECORD')
  assert.equal(order.classify(rec(head, { cases: [] }), head, anc).cls, 'INCOMPLETE_RECORD')
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
