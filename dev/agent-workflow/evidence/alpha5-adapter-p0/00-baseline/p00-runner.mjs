#!/usr/bin/env node
/**
 * p00-runner.mjs — Alpha.5 P0-0 evidence runner (plain node, deterministic).
 * Plan §3 P0-0 GO: reproduce native tool calls, count REAL bodies vs
 * Adapter bodies, distinguish A/B real Scopes, freeze all source/env
 * versions. Fixture-level only (NOT a real-host proof — plan §0; P0-6 does
 * the pinned-host re-proof).
 *
 * Usage: node dev/agent-workflow/evidence/alpha5-adapter-p0/00-baseline/p00-runner.mjs
 * Exit 0 = all P0-0 assertions met; 1 = assertion failure; 2 = environment.
 */
import { execFileSync } from 'node:child_process'
import { release } from 'node:os'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WORKTREE_ROOT, makeFixture, countingTool } from './p00-fixture.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const git = (args, cwd) => { try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' } }

const header = {
  recorded_at_utc: new Date().toISOString(),
  pwd: HERE,
  team_HEAD: git(['rev-parse', 'HEAD'], WORKTREE_ROOT),
  team_branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], WORKTREE_ROOT),
  test_use_HEAD: git(['rev-parse', 'HEAD'], join(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')),
  test_use_porcelain: git(['status', '--porcelain'], join(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')).length === 0 ? 'CLEAN' : 'DIRTY(FATAL-PATH — fixture must not write here)',
  node: process.version,
  platform: `${process.platform} ${release()}`,
}
const results = []
const assert = (id, cond, detail) => { results.push({ id, verdict: cond ? 'PASS' : 'FAIL', detail }) }

try {
  const f = await makeFixture()
  const { ctx, obs, mintScope, run, counters, resolution } = f

  // P0-0-1 — register "native" grep/read as global test definitions with body counters.
  const nativeGrep = countingTool(obs, 'grep', 'NATIVE.grep')
  const nativeRead = countingTool(obs, 'read', 'NATIVE.read')
  ctx.tools.register(nativeGrep)
  ctx.tools.register(nativeRead)

  // P0-0-2 — two real agent Scopes on the same Host.
  const A = await mintScope('agent-A')
  const B = await mintScope('agent-B')

  const rA0 = await run('grep', A.key)
  const rB0 = await run('read', B.key)
  assert('P0-0.repro-native', rA0.bodies?.[0]?.identity === 'NATIVE.grep' && rB0.bodies?.[0]?.identity === 'NATIVE.read',
    `A ran ${rA0.bodies?.[0]?.identity ?? rA0.threw}; B ran ${rB0.bodies?.[0]?.identity ?? rB0.threw}`)

  // P0-0-3 — Team Adapter (same-name) in Agent A's own Scope shadows for A only.
  const adapterGrep = countingTool(obs, 'grep', 'ADAPTER.grep')
  A.scope.ctx.tools.register(adapterGrep)
  assert('P0-0.scope-distinction.get',
    resolution('grep', A.key) === 'ADAPTER.grep' && resolution('grep', B.key) === 'NATIVE.grep' && resolution('grep', undefined) === 'NATIVE.grep',
    `A=${resolution('grep', A.key)} B=${resolution('grep', B.key)} global=${resolution('grep', undefined)}`)

  const rA1 = await run('grep', A.key)
  const rB1 = await run('grep', B.key)
  assert('P0-0.counters',
    counters('ADAPTER.grep') === 1 && counters('NATIVE.grep') === 2 /* A0 (pre-adapter) + B1 (scope B never sees the adapter) */ && rA1.bodies?.[0]?.identity === 'ADAPTER.grep' && rB1.bodies?.[0]?.identity === 'NATIVE.grep',
    `ADAPTER=${String(counters('ADAPTER.grep'))} NATIVE=${String(counters('NATIVE.grep'))} (expect 1/2: A0+B1 ran native, A1 ran adapter)`)

  // P0-0-4 — schemas() visibility per scope.
  const names = (agent) => ctx.tools.schemas(agent).map((s) => s.name).sort().join(',')
  assert('P0-0.schemas', names(A.key) === 'grep,read' && names(B.key) === 'grep,read', `A=[${names(A.key)}] B=[${names(B.key)}]`)

  // P0-0-5 — real Preset topology (plan §P0-0 "绑定真实 Preset" fixture analogue):
  // natives live on a PRESET scope; Agent A is bound as preset child via
  // bindScopeParent (S-01 mechanism); Agent B is NOT bound to the preset.
  {
    const preset = await mintScope('preset-1')
    const presetNative = countingTool(obs, 'psp_grep', 'PRESET.psp_grep')
    preset.scope.ctx.tools.register(presetNative)
    f.bindScopeParent(A.key, { id: 'preset-1' })
    const ad2 = countingTool(obs, 'psp_grep', 'ADAPTER.psp_grep')
    A.scope.ctx.tools.register(ad2)
    const ra = await run('psp_grep', A.key)
    const rb = await run('psp_grep', B.key) // unbound agent must not reach preset tools
    assert('P0-0.preset-topology',
      ra.bodies?.[0]?.identity === 'ADAPTER.psp_grep' && rb.bodies?.length === 0 && (rb.isError === true || String(rb.text).includes('unknown tool')) && f.counters('PRESET.psp_grep') === 0,
      `boundA→${ra.bodies?.[0]?.identity ?? ra.threw}; unboundB→${rb.bodies?.length ? rb.bodies[0].identity : 'fail-closed:' + JSON.stringify(rb.text ?? rb.threw).slice(0, 60)}; presetBodyCount=${String(f.counters('PRESET.psp_grep'))} (finding: own-layer adapter shadows the INHERITED preset body; non-bound scopes fail closed)`)
  }

  const out = { header, results, observations: obs }
  const path = join(HERE, 'p00-result.json')
  writeFileSync(path, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ results: results.map((r) => `${r.id}:${r.verdict}`), header_frozen: { team: header.team_HEAD.slice(0, 8), host: header.test_use_HEAD.slice(0, 10) }, out: path }))
  process.exit(results.every((r) => r.verdict === 'PASS') ? 0 : 1)
} catch (err) {
  console.error('P00_ENV_FAIL', err?.stack ?? String(err))
  process.exit(2)
}
