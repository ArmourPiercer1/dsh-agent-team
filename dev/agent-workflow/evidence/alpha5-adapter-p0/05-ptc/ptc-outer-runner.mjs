#!/usr/bin/env node
/**
 * ptc-outer-runner.mjs — Alpha.5 PTC-08 outer-process leg (05-ptc supplement). Team-owned, PoC only.
 * IDEMPOTENT: safe to re-run; overwrites ./ptc-outer-result.json and rewrites ./probe-scratch/ptc-outer-scratch/.
 *
 * This is the concretization of p05-runner's P05-PTC-8 (then NOT_RUN: "no real outer ptc Node process").
 * The parent spawns ./ptc-outer-child.mjs as a REAL OS process; that outer process mounts the pinned
 * PRODUCTION PTC stack — @deepseek-ai/dsh-ptc-runtime-node NodePtcRuntime (isolation='process') +
 * ToolRuntime(mode:'ptc') + the real createRunCodeTool bridge + tools.guard + sandbox-local/subprocess-local/
 * sandbox-policy — and executes one run_code whose program (in a FURTHER real sandboxed Node child process)
 * performs the positive control (tools.echo) and hits the guard denial (tools.blocked).
 * NO test double replaces the runtime this time (unlike p05's in-process double); only the two tool
 * BODIES are fixture counting definitions. Evidence channels: body counters + persistent tool/ptc-dispatch
 * events + pid separation (primary), return text only as corroboration (plan §1.2).
 *
 * Package existence (grep evidence recorded in result): @deepseek-ai/dsh-ptc-runtime-node EXISTS in T
 * (packages/ptc-runtime/ptc-runtime-node, public package.json exports '.'/'./process', built lib present)
 * — so the previous round's BLOCKED-CONFIRMED branch does NOT apply; the outer layer is runnable.
 *
 * Import mechanism: ESM resolve hook ./p05-ai-hook.mjs (reuse) → absolute lib/index.js file URLs inside T;
 * transitive deps via T's own node_modules layout; NO new W/node_modules junctions; T read-only.
 * Exit 0 iff all legs PASS.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const TEST_USE = join(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')
const SCRATCH = join(HERE, 'probe-scratch', 'ptc-outer-scratch')
const CHILD = join(HERE, 'ptc-outer-child.mjs')
const MODEL_NAME = 'qwen3.8-flash-next'

const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return { cmd: [cmd, ...args].join(' '), code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() } }

const result = {
  leg: '05-ptc supplement — PTC-08 outer process (production NodePtcRuntime, real OS processes)',
  agent: 'Alpha.5 P0 supplement leg (qwen3.8-flash-next)',
  model_name_verbatim: { powered_by_line: 'You are a coding agent powered by the qwen3.8-flash-next model.', model: MODEL_NAME },
  recorded_at_utc: new Date().toISOString(),
  concretizes: 'p05-runner.mjs P05-PTC-8 (previously NOT_RUN — fixture used an in-process runtime double; see 05-ptc/notes.md)',
  import_mechanism: 'ESM resolve hook p05-ai-hook.mjs → absolute lib/index.js file URLs inside T; transitive deps via T own layout; no new junctions; T read-only',
  commands: [],
  legs: [],
  counters: {},
}
function shRun(label, cmd, args) { const r = sh(cmd, args); result.commands.push({ label, ...r }); return r }

const gT = shRun('git T HEAD', 'git', ['-C', TEST_USE, 'rev-parse', 'HEAD'])
const gTs = shRun('git T status before', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
const gW = shRun('git W HEAD', 'git', ['-C', WORKTREE_ROOT, 'rev-parse', 'HEAD'])

// ---------- package-existence evidence (BLOCKED-CONFIRMED branch check) ----------
const pkgManifest = join(TEST_USE, 'packages', 'ptc-runtime', 'ptc-runtime-node', 'package.json')
const lsPtc = shRun('ls packages/ptc-runtime', 'ls', [join(TEST_USE, 'packages', 'ptc-runtime')])
const pkgName = shRun('package name', 'node', ['-e', `console.log(require(${JSON.stringify(pkgManifest)}).name)`])
const grepping = shRun('grep RUN_CODE_NAME consumers (lib plane)', 'grep', ['-rl', 'RUN_CODE_NAME', join(TEST_USE, 'packages', 'core', 'tools', 'lib')])
const grepRuntime = shRun('grep RUN_CODE_NAME in ptc-runtime pkgs', 'grep', ['-rl', 'RUN_CODE_NAME\\|ptcRuntime', join(TEST_USE, 'packages', 'ptc-runtime')])
result.package_existence = {
  dir_listing: lsPtc.out, package_name: pkgName.out,
  consumers_grep: { tools_lib: grepping.out.split('\n').filter(Boolean), ptc_pkgs: grepRuntime.out.split('\n').filter(Boolean).slice(0, 10) },
  verdict: pkgName.out === '@deepseek-ai/dsh-ptc-runtime-node' ? 'EXISTS-PUBLIC — BLOCKED-CONFIRMED branch not applicable' : 'MISSING',
}

rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(SCRATCH, { recursive: true })

// ---------- spawn the REAL outer OS process ----------
const spawnT0 = Date.now()
const spawnRes = spawnSync(process.execPath, [CHILD, '--test-use', TEST_USE, '--scratch', SCRATCH], {
  encoding: 'utf8', timeout: 240_000, maxBuffer: 16 * 1024 * 1024, cwd: HERE,
})
const spawnPid = spawnRes.pid
const line = (spawnRes.stdout ?? '').trim().split('\n').filter(l => l.startsWith('PTC_OUTER_RESULT:')).pop()
const child = line ? JSON.parse(line.slice('PTC_OUTER_RESULT:'.length)) : null
result.commands.push({ label: 'spawn outer child', cmd: `${process.execPath} ${CHILD} --test-use ${TEST_USE} --scratch ${SCRATCH}`, code: spawnRes.status, out: line ?? '(no result line)', err: (spawnRes.stderr ?? '').slice(0, 4000), spawn_pid: spawnPid, wall_ms: Date.now() - spawnT0 })

const leg = (id, verdict, detail) => { result.legs.push({ id, verdict, detail }); console.log(`[${verdict}] ${id}${detail === undefined ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400)}`) }
const check = (id, ok, detail) => leg(id, ok ? 'PASS' : 'FAIL', detail)
const GUARD_REASON = 'PTC-OUTER-GUARD: blocked is denied by fixture policy'

const innerPid = child?.innerPidFromProgramText ?? null
check('PTC-OUTER-1.outer-real-os-process',
  child !== null && Number.isInteger(child.outerPid) && child.outerPid === spawnPid && String(child.assembly?.find(a => a.startsWith('NodePtcRuntime')) ?? '').includes('isolation=process'),
  { outer_pid_self_reported: child?.outerPid, outer_pid_spawn_side: spawnPid, ppid: child?.ppid, node: child?.node, runtime: child?.assembly?.find(a => a.startsWith('NodePtcRuntime')) })

check('PTC-OUTER-2.inner-separate-os-process',
  Number.isInteger(innerPid) && innerPid !== child?.outerPid,
  { inner_pid_reported_by_program: innerPid, outer_pid: child?.outerPid, mechanism: 'NodePtcRuntime.isolation="process" — run_code program runs in a fresh sandboxed Node child (spawned via pinned sandbox-local + subprocess-local under sandbox-policy danger-full-access)' })

const evs = child?.durableDispatchEvents ?? []
check('PTC-OUTER-3.guard-deny-original-body-zero',
  child?.bodyCounts?.blocked === 0 && (child?.runCode?.textHead ?? '').includes(GUARD_REASON) && (child?.runCode?.textHead ?? '').includes('"toolName": "blocked"') && evs.some(e => e.type === 'tool/ptc-dispatch' && e.name === 'blocked' && e.isError === true) && child?.runCode?.isError === false,
  { blocked_body_counter: child?.bodyCounts?.blocked, guard_reason_reached_program: (child?.runCode?.textHead ?? '').includes(GUARD_REASON), typed_error: { name: 'ToolCallError', toolName: 'blocked' }, durable_isError_settle: evs.filter(e => e.type === 'tool/ptc-dispatch' && e.isError === true).length, outer_run_code_isError: child?.runCode?.isError })

check('PTC-OUTER-4.positive-control-body-plus-one',
  child?.bodyCounts?.echo === 1 && (child?.runCode?.textHead ?? '').includes(`ran:echo@outer-pid-${child?.outerPid}`) && evs.some(e => e.type === 'tool/ptc-dispatch' && e.name === 'echo' && e.isError === false),
  { echo_body_counter: child?.bodyCounts?.echo, value_round_trip: (child?.runCode?.textHead ?? '').includes(`ran:echo@outer-pid-${child?.outerPid}`) })

const innerObs = (child?.events ?? []).filter(e => e.parentPresent && (e.name === 'echo' || e.name === 'blocked'))
check('PTC-OUTER-5.dispatch-through-production-pipeline',
  innerObs.length === 2 && child?.sessionId !== undefined,
  { inner_post_execute_obs: innerObs, note: 'both inner calls settled through the SAME ToolRuntime pipeline (tools/post-execute observer, exec.parent set); durable tool/ptc-dispatch(-start) events on a real Session (dsh-session ctx.sessions.create)' })

const gTsAfter = shRun('git T status after', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
result.host_env = { test_use_HEAD: gT.out, test_use_porcelain_empty_before: gTs.out === '', test_use_porcelain_empty_after: gTsAfter.out === '', worktree_HEAD: gW.out }
result.counters = {
  outer_pid: child?.outerPid ?? null, spawn_side_pid: spawnPid ?? null, inner_pid: innerPid,
  original_body_counts: child?.bodyCounts ?? null,
  durable_dispatch_events: evs.length,
  guard_denials: child?.bodyCounts ? 1 - child.bodyCounts.blocked : null, // reason reached program with body 0 → 1
}
result.verdict = {
  ptc_08_outer: child !== null && result.legs.every(l => l.verdict === 'PASS') ? 'PASS' : 'FAIL',
  replaces: 'P05-PTC-8 NOT_RUN — now concretized on the pinned production outer (no runtime test double)',
  scope_of_claim: 'fixture-level: real OS outer process + real sandboxed inner Node process, pinned libs (0.2.0-rc.2 @ 639ed01539). Sandbox strength (read/write/network enforcement matrix) remains P0-4 scope — this leg proves the bridge/inner-dispatch/guard path over the real process runtime, with policy mode danger-full-access.',
  s09_note: 'spill abstention leg lives in 02-search/spill-result.json (SRCH-04, 4/4 PASS)',
}
const allPass = result.legs.every(l => l.verdict === 'PASS')
result.exit_code_planned = allPass ? 0 : 1
writeFileSync(join(HERE, 'ptc-outer-result.json'), JSON.stringify(result, null, 2) + '\n')
console.log(`SUMMARY outer-pid=${child?.outerPid} spawn-pid=${spawnPid} inner-pid=${innerPid} bodyCounts=${JSON.stringify(child?.bodyCounts)} legs-PASS=${result.legs.filter(l => l.verdict === 'PASS').length}/${result.legs.length}`)
process.exit(result.exit_code_planned)
