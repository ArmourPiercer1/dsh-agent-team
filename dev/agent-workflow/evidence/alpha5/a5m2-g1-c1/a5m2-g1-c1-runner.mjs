#!/usr/bin/env node
/**
 * A5M2-G1 LIMITED C1 TAKEOVER-CHAIN ENTRY (root 04:0x order, narrowed by the
 * root's follow-up: this entry ONLY chains the EXISTING four specs and the
 * EXISTING checks — no new per-leg test/audit system, no Host-only gates.
 * The unauthorized Host dimensions answer NOT_RUN, one line each).
 *
 * Fixed order, EXISTING specs (nothing re-stated, nothing re-run beyond them):
 *   1. test/a5m2-g1-wire-c1.test.ts            (31 legs; incl. the ROOT-P1
 *      real claim->raw-let->exact-capture->registration chain legs)
 *   2. test/a5m2-g1-control85-handover.test.ts (4 legs)
 *   3. test/a5m2-g1-trusted-topology-supply.test.ts (9 legs)
 *   4. test/a5m2-g1-query-assembly.test.ts     (12 legs)
 * Per-leg lines come from vitest's OWN json reporter — no parallel reporting
 * system. Status law (root): these are author mirror-assembly worlds, NOT
 * Host; the two real-mount dimensions are the HOST_NOT_RUN lines below and
 * stay NOT_RUN with their named precondition until the bounded window rules.
 *
 * Fixture identity (reuse in place, ZERO copy): DSH_TEST_USE_ROOT pinned in
 * THIS entry only (g5 law: not a global default), verified read-only against
 * tests/paths.mjs (HEAD == TEST_USE_BASELINE_SHA, porcelain empty) or refuse.
 * Booking: refuse to run unless the booked int combination head is reachable
 * in this tree. Receipt: spec-set sha256 + booked int head + tree HEAD + tool
 * versions — machine-checkable. Modes: --dry-run (checks only) | --run.
 */
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'

import { TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION } from '../../../../../tests/paths.mjs'

const REPO = resolve(import.meta.dirname, '../../../../..')
/** The int combination merge the 85 C1 source card was signed against. */
const INT_COMBINATION_SHA = '96d3aa13cfe0332b50afd2f892a1cd70a172b1af'
/** The lane tip whose source signature closed P1 (root 04:0x review). */
const LANE_SOURCE_CARD_SHA = '94798f7dcfc65ffe77d968ea6f9f82a366110c35'
/** Lane-local fixture pin (g5 law: pinned in THIS entry only, never a copy). */
const TEST_USE_PIN_PATH = process.env.DSH_TEST_USE_ROOT
  ?? '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use'
const VITEST_VERSION = '4.1.11'
const EXPECTED = Object.freeze({
  'test/a5m2-g1-wire-c1.test.ts': 31,
  'test/a5m2-g1-control85-handover.test.ts': 4,
  'test/a5m2-g1-trusted-topology-supply.test.ts': 9,
  'test/a5m2-g1-query-assembly.test.ts': 12,
})
const SPECS = Object.keys(EXPECTED)
/** The Host dimensions NOT authorized today: NOT_RUN with their precondition,
 *  one line each (root: 现Host未准维度直接NOT_RUN即可). */
const HOST_NOT_RUN = Object.freeze([
  { leg: 'host::real-takeover-execution', status: 'NOT_RUN', precondition: 'bounded window ruling: a live leader mount (g1PureQuery row + selection carries team_list_pending_control) over the product package at the booked int head, measuring claim -> raw-let -> EXACT selected-instance capture -> placement -> registration in production agent-bindings' },
  { leg: 'host::member-zero-assembly', status: 'NOT_RUN', precondition: 'same window: a live member mount with the g1PureQuery row present and the selection WITHOUT the name answers only capture-absent (no assembly/placement/registration/ledger for 85), even with a same-named parent-layer definition' },
])

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = (obj) => process.stdout.write(JSON.stringify(obj) + '\n')
const git = (args) => spawnSync('git', ['-C', REPO, ...args], { encoding: 'utf8' })

function precheck () {
  const problems = []
  const notes = { intCombinationHead: INT_COMBINATION_SHA, sourceCard: LANE_SOURCE_CARD_SHA }
  if (git(['cat-file', '-e', `${INT_COMBINATION_SHA}^{commit}`]).status !== 0) problems.push(`booked int head ${INT_COMBINATION_SHA} is NOT reachable in this tree — refusing`)
  notes.treeHead = git(['rev-parse', 'HEAD']).stdout.trim()
  if (!existsSync(TEST_USE_PIN_PATH)) problems.push(`test-use root absent at ${TEST_USE_PIN_PATH}`)
  else {
    const head = (spawnSync('git', ['-C', TEST_USE_PIN_PATH, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout ?? '').trim()
    if (head !== TEST_USE_BASELINE_SHA) problems.push(`test-use HEAD ${head || '?'} != paths.mjs TEST_USE_BASELINE_SHA ${TEST_USE_BASELINE_SHA} — refusing (pinned identity, never a copy)`)
    if ((spawnSync('git', ['-C', TEST_USE_PIN_PATH, 'status', '--porcelain'], { encoding: 'utf8' }).stdout ?? '').trim().length !== 0) problems.push('test-use porcelain not empty — refusing')
    notes.testUse = { path: TEST_USE_PIN_PATH, head, baseline: TEST_USE_BASELINE_SHA, version: DSH_BASELINE_VERSION }
  }
  for (const spec of SPECS) if (!existsSync(join(REPO, 'packages', 'runtime', spec))) problems.push(`spec missing: ${spec}`)
  const candidates = []
  for (const base of [REPO, resolve(REPO, '..', '..')]) {
    const pnpmDir = join(base, 'node_modules', '.pnpm')
    if (!existsSync(pnpmDir)) continue
    for (const entry of readdirSync(pnpmDir)) {
      if (!entry.startsWith(`vitest@${VITEST_VERSION}_`)) continue
      const p = join(pnpmDir, entry, 'node_modules', 'vitest', 'vitest.mjs')
      if (existsSync(p) && !candidates.includes(p)) candidates.push(p)
    }
    if (candidates.length > 0) break
  }
  const pinnedEnv = process.env.A5M2_G1_C1_VITEST
  if (pinnedEnv !== undefined && pinnedEnv.length > 0 && existsSync(pinnedEnv)) notes.vitest = pinnedEnv
  else if (candidates.length === 1) notes.vitest = candidates[0]
  else problems.push(`vitest@${VITEST_VERSION} resolution ${candidates.length === 0 ? 'found nothing' : `AMBIGUOUS (${String(candidates.length)})`} — set A5M2_G1_C1_VITEST`)
  notes.toolchain = { node: process.version, vitest: VITEST_VERSION, git: (spawnSync('git', ['--version'], { encoding: 'utf8' }).stdout ?? '').trim() }
  return { ok: problems.length === 0, problems, notes }
}

function specSetDigest () {
  const files = {}
  const hasher = createHash('sha256')
  for (const spec of SPECS) {
    const h = sha256(readFileSync(join(REPO, 'packages', 'runtime', spec)))
    files[spec] = h
    hasher.update(`${spec} ${h}\n`)
  }
  files['$self'] = sha256(readFileSync(new URL(import.meta.url)))
  return { digest: hasher.digest('hex'), files }
}

function main () {
  const mode = process.argv[2] ?? '--dry-run'
  if (!['--dry-run', '--run'].includes(mode)) { json({ event: 'refused', reason: `unknown mode ${mode}` }); process.exitCode = 2; return }
  const pre = precheck()
  json({ event: 'precheck', mode, ok: pre.ok, problems: pre.problems, notes: pre.notes })
  if (!pre.ok) { json({ event: 'refused', reason: 'preconditions failed' }); process.exitCode = 2; return }
  const specSet = specSetDigest()
  if (mode === '--dry-run') {
    json({ event: 'receipt', ok: true, mode, intCombinationHead: INT_COMBINATION_SHA, treeHead: pre.notes.treeHead, specSetDigest: specSet.digest, specFiles: specSet.files, toolchain: pre.notes.toolchain, planned: SPECS.map((s, i) => ({ ordinal: i + 1, spec: s, expectedLegs: EXPECTED[s] })), hostNotRun: HOST_NOT_RUN.map((g) => g.leg) })
    return
  }
  const outDir = join(tmpdir(), `a5m2-g1-c1-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  mkdirSync(outDir, { recursive: true })
  const counts = { PASS: 0, FAIL: 0, NOT_RUN: 0 }
  let ok = pre.ok
  SPECS.forEach((spec, ordinal) => {
    json({ event: 'spec', ordinal: ordinal + 1, spec, expectedLegs: EXPECTED[spec] })
    const outFile = join(outDir, `${spec.replace(/[^a-z0-9]+/gi, '_')}.json`)
    const r = spawnSync(process.execPath, [pre.notes.vitest, 'run', spec, '--reporter=json', `--outputFile=${outFile}`, '--no-file-parallelism'], {
      cwd: join(REPO, 'packages', 'runtime'),
      env: { ...process.env, DSH_TEST_USE_ROOT: TEST_USE_PIN_PATH },
      encoding: 'utf8', timeout: 1_500_000,
    })
    let legs = []
    try {
      const parsed = JSON.parse(readFileSync(outFile, 'utf8'))
      for (const suite of parsed.testResults ?? []) {
        for (const a of suite.assertionResults ?? []) {
          legs.push({ leg: `${spec}::${a.fullName ?? a.title}`, status: a.status === 'passed' ? 'PASS' : a.status === 'failed' ? 'FAIL' : 'NOT_RUN', detail: (a.failureMessages ?? [])[0]?.slice(0, 200) ?? '' })
        }
      }
    } catch { /* fall back on the exit code below */ }
    if (legs.length === 0) legs = [{ leg: `${spec}::(spec-load)`, status: r.status === 0 ? 'NOT_RUN' : 'FAIL', detail: `vitest answered no json assertions (exit ${String(r.status)})` }]
    for (const leg of legs) { counts[leg.status] += 1; json({ event: 'leg', ...leg }) }
    if (r.status !== 0 || legs.length !== EXPECTED[spec] || legs.some((l) => l.status !== 'PASS')) ok = false
  })
  for (const gap of HOST_NOT_RUN) { counts.NOT_RUN += 1; json({ event: 'leg', ...gap }) }
  json({ event: 'receipt', ok, mode, intCombinationHead: INT_COMBINATION_SHA, treeHead: pre.notes.treeHead, specSetDigest: specSet.digest, specFiles: specSet.files, toolchain: pre.notes.toolchain, counts, outDir })
  process.exitCode = ok ? 0 : 1
}

main()
