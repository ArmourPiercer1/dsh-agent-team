#!/usr/bin/env node
/**
 * alpha5-pr8-e2e — the PR8 E2E kit at the location its skeleton README
 * reserves (`tests/kits/alpha5-pr8-e2e/`, pins read from `tests/paths.mjs`,
 * nothing hardcoded about baseline generations).
 *
 * GLUE queue round (gaps C-01 + C-11, coordinator queue): the registry
 * suites `00-guard-dispatch` and `40-search-shell` now have assertion
 * implementations (`run !== null`); every other suite keeps `run: null`
 * until its own queue item. This kit implements NO new law — that is the
 * whole design: each run ORCHESTRATES the authoritative runners that own
 * the criteria (the `a5-pr1-guard-dispatch` kit trio for suite 00 — its
 * 41 criteria already carry the dynRan→typed-deny flip, the NEG hazard
 * arms and the ordered teardown; the W5 live runner for suite 40 — 34
 * gated criteria plus the ungated RED control), consumes their receipts,
 * and adds exactly one new deterministic leg of its own (S00-VOCAB-FACE,
 * the C-01 vocabulary check: the tool surface the real Host LOADED for
 * the leader, cross-checked against the compiled tools face's `team_*`
 * literals — the loaded face equals the compiled facade face, no phantom
 * names, no denied name loaded). PoC records stay where they are; every
 * run writes a FRESH receipt here (KIT 断言可更新，原始工件不动).
 *
 * Three-state discipline (IF-7): a run answers PASS / FAIL / NOT_RUN.
 * Missing prerequisites (host tree, built dist) answer NOT_RUN — the kit
 * refuses to fake a PASS and refuses to call "cannot run here" a FAIL.
 *
 * Usage:
 *   node tests/kits/alpha5-pr8-e2e/kit.mjs --suite all|00-guard-dispatch|40-search-shell
 *        [--evidence-dir <p>]   default dev/agent-workflow/evidence/alpha5/wiring/glue-registry/runs/
 *   exit 0 = every executed suite PASS; 2 = a suite FAILed; 1 = fatal.
 *
 * @module tests/kits/alpha5-pr8-e2e/kit
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')

export const RESULTS = { PASS: 'PASS', FAIL: 'FAIL', NOT_RUN: 'NOT_RUN' }

const kitPins = () => ({ source: 'tests/paths.mjs', version: DSH_BASELINE_VERSION, testUseSha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH })

function leg (id, claim, pass, observed) { return { id, claim, pass: pass === true, observed: String(observed ?? '').slice(0, 400) } }

function verdict (suiteId, legs, extra = {}) {
  const failed = legs.filter((l) => !l.pass && l.status !== RESULTS.NOT_RUN)
  const notRun = legs.filter((l) => l.status === RESULTS.NOT_RUN)
  const status = failed.length > 0 ? RESULTS.FAIL : notRun.length > 0 ? RESULTS.NOT_RUN : RESULTS.PASS
  return { suite: suiteId, status, legs, ...extra }
}

/** Spawn a runner and hand back { code, text } with bounded capture. */
function run (cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8', timeout: opts.timeout ?? 1_500_000, maxBuffer: 64 * 1024 * 1024 })
  const text = `${r.stdout ?? ''}${(r.stderr ?? '').split('\n').map((l) => `[E] ${l}`).join('\n')}`
  if (r.error) return { code: -1, text: `spawn error: ${r.error.message}\n${text}`, timedOut: r.signal === 'SIGTERM' }
  return { code: r.status ?? -1, text, timedOut: false }
}

function readJsonSafe (p) { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }

// ── suite 00-guard-dispatch (C-01: M-14 / SUP-09 / SUP-11) ─────────────────
// Authoritative surface: tests/kits/a5-pr1-guard-dispatch. Its a5p1-kit.mjs
// already orchestrates its own trio (host legs + order-hazard arms + the
// re-registration window) into one summary.json; this run re-executes it on
// the CURRENT tree and grades the suite from that receipt plus the one new
// vocabulary leg.
export function runSuite00GuardDispatch ({ evidenceDir } = {}) {
  const dir = join(evidenceDir ?? join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'wiring', 'glue-registry', 'runs'), `00-guard-dispatch-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`)
  mkdirSync(dir, { recursive: true })
  const legs = []
  const kitPath = 'tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs'
  const prereqs = ['tests/deepseek-harness-test-use', 'packages/runtime/dist', 'packages/tools/harness/plugin.mjs', 'packages/tools/dist']
  const missing = prereqs.filter((p) => !existsSync(join(REPO_ROOT, p)))
  if (missing.length > 0) {
    legs.push({ ...leg('S00-KIT-TRIO', 'authoritative a5-pr1 trio re-executed on the current tree', false, `NOT_RUN: prerequisites absent: ${missing.join(', ')}`), status: RESULTS.NOT_RUN })
    return verdict('00-guard-dispatch', legs, { evidenceDir: dir, pins: kitPins() })
  }
  const kitEvidence = join(dir, 'a5p1-kit')
  const r = run(process.execPath, [kitPath, '--evidence-dir', kitEvidence], { timeout: 1_800_000 })
  const summary = readJsonSafe(join(kitEvidence, 'summary.json'))
  if (summary === null) {
    legs.push(leg('S00-KIT-TRIO', 'authoritative a5-pr1 trio re-executed on the current tree', false, `no summary.json (exit=${String(r.code)}); head: ${r.text.slice(0, 200)}`))
    return verdict('00-guard-dispatch', legs, { evidenceDir: dir, pins: kitPins() })
  }
  // The receipt's `criteria` array carries the FULL folded leg set (the
  // B3 round folded the order/window legs in so they cannot drift
  // uncounted); the C* ids are the host legs themselves.
  const all = summary.criteria ?? []
  const allBad = all.filter((c) => !c.ok)
  const host = all.filter((c) => /^C\d/.test(String(c.id)))
  const hostBad = host.filter((c) => !c.ok)
  legs.push(leg('S00-KIT-HOST', 'a5p1-kit receipt fully green, host legs (C1 assembly … C7 discipline; the Guard on the real Host) among them', allBad.length === 0 && host.length >= 13, `all ok=${String(all.length - allBad.length)}/${String(all.length)}; host legs ${String(host.length - hostBad.length)}/${String(host.length)}${allBad.length ? ` bad=[${allBad.map((c) => c.id).join(',')}]` : ''}`))
  const order = summary.orderLeg?.criteria ?? []
  const orderBad = order.filter((c) => !c.ok)
  const arms = summary.orderLeg?.result ?? {} // the order-leg result IS the arms record
  legs.push(leg('S00-ORDER-ARMS', 'ordered-teardown arms incl. the NEG-1 hazard contrast all ok', orderBad.length === 0 && order.length >= 10 && Object.hasOwn(arms, 'hazard') && Object.hasOwn(arms, 'shadowBound'), `ok=${String(order.length - orderBad.length)}/${String(order.length)} arms=[${Object.keys(arms).join(',')}]`))
  const win = summary.reregWindow?.criteria ?? []
  const winBad = win.filter((c) => !c.ok)
  legs.push(leg('S00-REREG-WINDOW', 'the 14 re-registration-window arms all ok (late re-resolution NEG-1 leg included)', winBad.length === 0 && win.length >= 18, `ok=${String(win.length - winBad.length)}/${String(win.length)}`))
  const c2a = all.find((c) => c.id === 'C2a')
  const c2b = all.find((c) => c.id === 'C2b')
  legs.push(leg('S00-DYNRAN-TYPED-DENY', 'SUP-09 obligation: the dynRan flip re-ran green on the real Host (C2a typed readable refusal ∧ C2b body produced no effect)', c2a !== undefined && c2b !== undefined && c2a.ok === true && c2b.ok === true, `C2a=${String(c2a?.ok)} C2b=${String(c2b?.ok)}`))

  // S00-VOCAB-FACE (C-01, the new leg): per-agent loading, asserted at the
  // point where "loaded" is observable — the tool array the real Host put
  // in front of the leader Agent (captured from the model request, not
  // restated) — cross-checked against the compiled tools face (the very
  // emit this round wired into the production build). Member-lane loading
  // is proved by EXECUTION in the trio's own legs (C3/C4 governed calls),
  // which this suite just re-ran; this leg pins the loaded face itself.
  const surface = readJsonSafe(join(kitEvidence, 'discovery-surface.json'))
  const toolsJs = join(REPO_ROOT, 'packages', 'tools', 'dist', 'packages', 'tools', 'src', 'tools.js')
  if (surface === null || !existsSync(toolsJs)) {
    legs.push(leg('S00-VOCAB-FACE', 'loaded team_* face == compiled tools face team_* literals; no denied name loaded', false, `inputs absent (discovery-surface=${String(surface !== null)} tools.js=${String(existsSync(toolsJs))})`))
  } else {
    const compiled = [...new Set([...readFileSync(toolsJs, 'utf8').matchAll(/['"](team_[a-z0-9_]+)['"]/g)].map((m) => m[1]))].sort()
    const loaded = [...new Set((surface.surface ?? []).filter((n) => n.startsWith('team_')))].sort()
    const denied = new Set(surface.denyList ?? [])
    const phantoms = loaded.filter((n) => !compiled.includes(n))
    const unloaded = compiled.filter((n) => !loaded.includes(n))
    const deniedLoaded = loaded.filter((n) => denied.has(n))
    legs.push(leg('S00-VOCAB-FACE', 'loaded team_* face == compiled tools face team_* literals; no denied name loaded', phantoms.length === 0 && unloaded.length === 0 && deniedLoaded.length === 0 && loaded.length >= 13, `loaded=${String(loaded.length)} compiled=${String(compiled.length)} phantom=[${phantoms}] unloaded=[${unloaded}] denied∩loaded=[${deniedLoaded}]`))
  }
  const v = verdict('00-guard-dispatch', legs, { evidenceDir: dir, pins: kitPins(), kitExit: r.code })
  writeFileSync(join(dir, 'suite-00-guard-dispatch.receipt.json'), JSON.stringify(v, null, 2) + '\n')
  return v
}

// ── suite 40-search-shell (C-11: M-06 / M-07 / SUP-12 / SUP-13) ───────────
// Authoritative surface: the W5 LIVE assembly runner (dev/agent-workflow/
// evidence/alpha5/wiring/w5/run-w5-live.mjs). gated 34/34 = the lane's
// R3-parity/deny-before-spawn/Spill-attribution law on a real session
// Agent; ungated RED with the pinned 9-id gate-carrier set = the negative
// control ("the gate carries the refusals, not the prose").
const UNGATED_RED_SET = ['L-W5-DENY-ZERO', 'L-W5-E2E-BASH', 'L-W5-E2E-SEARCH', 'L-W5-GUARD', 'L-W5-ONESHOT', 'L-W5-OVERPRIV', 'L-W5-PARITY-SEARCH', 'L-W5-SPILL-POINTER', 'L-W5-UNBOUND']

export function runSuite40SearchShell ({ evidenceDir } = {}) {
  const dir = join(evidenceDir ?? join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'wiring', 'glue-registry', 'runs'), `40-search-shell-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`)
  mkdirSync(dir, { recursive: true })
  const legs = []
  const prereqs = ['tests/deepseek-harness-test-use', 'packages/runtime/dist', 'dev/agent-workflow/evidence/alpha5/wiring/w5/run-w5-live.mjs']
  const missing = prereqs.filter((p) => !existsSync(join(REPO_ROOT, p)))
  if (missing.length > 0) {
    legs.push({ ...leg('S40-LIVE', 'W5 live runner executed', false, `NOT_RUN: prerequisites absent: ${missing.join(', ')}`), status: RESULTS.NOT_RUN })
    return verdict('40-search-shell', legs, { evidenceDir: dir, pins: kitPins() })
  }
  // Lane ESM build (the runner's L-W5-LANE prerequisite): the lane tsconfig
  // is noEmit by law; the W5 lane's own tsc-flag driver compiles src/index.ts
  // into the gitignored build copy the LIVE row imports. Orchestrated here
  // because a fresh worktree has none — creating it touches no shared file.
  const laneBuild = join(REPO_ROOT, 'tests', 'homes', '.a5w5-build')
  if (!existsSync(join(laneBuild, 'packages', 'tools', 'a5p5-tools', 'src', 'index.js'))) {
    const b = run(process.execPath, ['dev/agent-workflow/evidence/alpha5/wiring/w5/build-lane-esm.mjs', REPO_ROOT, laneBuild], { timeout: 300_000 })
    if (b.code !== 0) { legs.push(leg('S40-LANE-BUILD', 'lane ESM build (build-lane-esm driver) produced the LIVE row module', false, `exit=${String(b.code)} head: ${b.text.slice(0, 200)}`)); return verdict('40-search-shell', legs, { evidenceDir: dir, pins: kitPins() }) }
  }
  // Hygiene note (the runner's own L-W5-IF5 law, surfaced not worked around):
  // the W5 runner requires packages/, scripts/ and root vitest.config.ts
  // BYTE-UNTOUCHED at run time — so this suite must be executed with the
  // shared-surface work COMMITTED (a dirty tree legitimately goes RED).
  for (const [mode, id, claim] of [
    ['gated', 'S40-GATED', 'W5 gated: every live criterion GREEN (parity vs system grep/rg, deny-before-spawn, Spill attribution, one-shot, unbound negative control)'],
    ['ungated', 'S40-UNGATED-RED', 'W5 ungated RED control: the gate carries the refusals — exactly the pinned gate-carrier set is red'],
  ]) {
    const evidence = join(dir, `w5-${mode}`)
    const r = run(process.execPath, ['dev/agent-workflow/evidence/alpha5/wiring/w5/run-w5-live.mjs', '--mode', mode, '--evidence-dir', evidence], { timeout: 1_200_000 })
    const j = readJsonSafe(join(evidence, 'criteria.json'))
    if (j === null) { legs.push(leg(id, claim, false, `no criteria.json (exit=${String(r.code)}); head: ${r.text.slice(0, 200)}`)); continue }
    const cr = j.criteria ?? []
    const red = cr.filter((c) => !c.pass).map((c) => c.id).sort()
    if (mode === 'gated') {
      legs.push(leg(id, claim, j.status === 'GREEN' && red.length === 0 && cr.length >= 34, `status=${String(j.status)} legs=${String(cr.length)} red=[${red}]`))
    } else {
      const sameSet = JSON.stringify(red) === JSON.stringify([...UNGATED_RED_SET].sort())
      legs.push(leg(id, claim, j.status === 'RED' && sameSet, `status=${String(j.status)} red=${String(red.length)} set-match=${String(sameSet)} red=[${red}]`))
    }
  }
  // the unit face this round wired: the lane's six suites under the ROOT
  // vitest config (the same collection CI census performs, run narrow).
  const unit = run('npx', ['vitest', 'run', '--maxWorkers=1', 'packages/tools/a5p5-tools/test/'], { timeout: 900_000 })
  const m = /Tests\s+(\d+) passed(?:\s+\((\d+)\))?/.exec(unit.text)
  legs.push(leg('S40-UNIT-FACE', 'a5p5 lane suites pass under the ROOT vitest config (collection wired by GLUE-2)', unit.code === 0 && m !== null, m === null ? `exit=${String(unit.code)} no Tests line; head: ${unit.text.slice(0, 200)}` : `exit=${String(unit.code)} passed=${m[1]}`))
  const v = verdict('40-search-shell', legs, { evidenceDir: dir, pins: kitPins() })
  writeFileSync(join(dir, 'suite-40-search-shell.receipt.json'), JSON.stringify(v, null, 2) + '\n')
  return v
}

export const SUITE_RUNS = {
  '00-guard-dispatch': runSuite00GuardDispatch,
  '40-search-shell': runSuite40SearchShell,
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
  const suite = argValue('suite', 'all')
  const evidenceDir = argValue('evidence-dir', undefined)
  const ids = suite === 'all' ? Object.keys(SUITE_RUNS) : [suite]
  let exitCode = 0
  for (const id of ids) {
    const fn = SUITE_RUNS[id]
    if (fn === undefined) { console.log(`unknown suite: ${id} (implemented: ${Object.keys(SUITE_RUNS).join(', ')})`); process.exit(1) }
    const v = fn({ evidenceDir })
    for (const l of v.legs) console.log(`${l.status === RESULTS.NOT_RUN ? 'NOT_RUN' : l.pass ? 'PASS' : 'FAIL'} ${l.id} — ${l.claim} [${l.observed}]`)
    console.log(`SUITE ${id} status=${v.status} evidence=${v.evidenceDir}`)
    if (v.status === RESULTS.FAIL) exitCode = 2
  }
  process.exit(exitCode)
}
