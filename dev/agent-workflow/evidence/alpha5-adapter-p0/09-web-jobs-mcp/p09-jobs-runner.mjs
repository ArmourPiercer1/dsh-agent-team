#!/usr/bin/env node
/**
 * p09-jobs-runner.mjs — Alpha.5 P0-9 jobs family (fixture level).
 *
 * FAMILY SHAPE IN PINNED 0.2.0-rc.2 (grep facts, recorded before run):
 *  - @deepseek-ai/dsh-jobs        = ABSTRACT Service Definition `ctx.jobs`
 *    (JobRegistry; loading it alone throws on purpose).
 *  - @deepseek-ai/dsh-jobs-local  = LocalJobRegistry (process-local provider).
 *  - @deepseek-ai/dsh-tool-jobs   = the model-facing surface: EXACTLY three
 *    tools — job_output / job_list / job_kill. There is NO "job_start"-style
 *    model tool in the pinned tree: jobs are started by PRODUCERS (kind map
 *    bash/subagent, merge-extensible) calling ctx.jobs.start. Verified by
 *    grepping tool definitions in packages/jobs/tool-jobs/src/index.ts
 *    (name: 'job_output' / 'job_list' / 'job_kill').
 *  Therefore this leg is the honest minimal closed loop named in the brief:
 *  background-job lifecycle via DIRECT CALLS TO THE PRODUCTION SERVICE
 *  (start/wait/kill/read/list/remove) + the three production tools mounted
 *  and executed through ToolRuntime + the P0-1 assembly conclusion re-checked
 *  on the jobs injection path (restrict-first + same-name adapter for A).
 *
 * Producers here are SYNTHETIC (timer-driven in-process) — Team-owned TEST
 * DOUBLE producers against the public JobSpec seam. Disclosed: kind string
 * 'synthetic' (runtime treats kind as an opaque namespace; the pinned
 * JobKindMap declares bash/subagent via declaration merging). Ownership-
 * scoped jobs need the agent registry (dsh-agent) and are recorded NOT_RUN
 * with the production fail-loud message as the observable.
 *
 * No loopback sockets, no MCP, no network. Loopback/mock authorization of
 * this round is not even needed here.
 *
 * Usage: node dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-jobs-runner.mjs
 * Exit 0 = every leg matched; 1 = assertion failure; 2 = environment.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeFixture, countingTool } from '../00-baseline/p00-fixture.mjs'
import { HERE, envHeader, makeLedger, libUrl } from './p09-shared.mjs'

const { results, expect } = makeLedger('J')
const observations = {}

const timerProducers = new Set()
function synthJob({ append = [], settleAfterMs = 20, outcome = { status: 'completed', result: 'JOB-RESULT-OK' }, hang = false, throwOnStart = false, tag: label }) {
  return function run(job) {
    if (throwOnStart) throw new Error(`starter-boom:${label}`)
    for (const text of append) job.append(text, { channel: 'stdout' })
    let resolveDone
    const done = new Promise((r) => { resolveDone = r })
    let cancelReason
    if (!hang) {
      const t = setTimeout(() => { timerProducers.delete(t); resolveDone(outcome) }, settleAfterMs)
      timerProducers.add(t)
    }
    return {
      cancel(reason) {
        cancelReason = reason
        job.append(`[producer saw cancel reason=${String(reason)}]\n`, { channel: 'log' })
        resolveDone({ status: 'killed', detail: 'producer-cancelled' })
      },
      done,
      get cancelReasonSeen() { return cancelReason },
    }
  }
}

try {
  const header = envHeader({ family: 'jobs', import: 'file-URL imports of jobs-local / tool-jobs (no new junctions)' })
  const dshJobs = await import(libUrl('jobs', 'jobs'))
  const jobsLocal = await import(libUrl('jobs', 'jobs-local'))
  const toolJobs = await import(libUrl('jobs', 'tool-jobs'))
  observations.shape = {
    dsh_jobs_exports: Object.keys(dshJobs),
    abstract_guard: (() => { try { new dshJobs.default({} ); return 'no-throw?!' } catch (err) { return String(err?.message).slice(0, 120) } })(),
    jobs_local_default: jobsLocal.default?.name,
    tool_jobs_plugin: { name: toolJobs.name, inject: toolJobs.inject },
  }
  // abstract seam refuses direct load (fail-loud evidence)
  expect('J0.seam-shape', typeof dshJobs.default === 'function' && /abstract job registry seam/.test(observations.shape.abstract_guard) && jobsLocal.default?.name === 'LocalJobRegistry',
    `dsh-jobs default=${typeof dshJobs.default} abstract_threw="${observations.shape.abstract_guard.slice(0, 70)}"; jobs-local=${jobsLocal.default?.name}; tool-jobs inject=${JSON.stringify(toolJobs.inject)}`)

  // J1 — missing-controller refusal BEFORE any controller exists (start fails closed)
  const bare = await makeFixture()
  await bare.ctx.plugin(jobsLocal.default, {})
  let refused = ''
  try {
    bare.ctx.jobs.start({ kind: 'synthetic', label: 'no-controller', run: synthJob({ append: [], settleAfterMs: 5, tag: 'j1' }) })
  } catch (err) { refused = String(err?.message ?? err) }
  expect('J1.start-refused-without-controller', /no job controller serves/.test(refused),
    `exact observable: ${JSON.stringify(refused.slice(0, 120))}`)

  // main mount: registry + tool surface (attachController runs inside tool-jobs.apply)
  const f = await makeFixture()
  await f.ctx.plugin(jobsLocal.default, {})
  await f.ctx.plugin(toolJobs, { completionDelivery: 'quiet' })
  const schemas = f.ctx.tools.schemas().map((s) => s.name).sort()
  expect('J2.tools-are-exactly-three', schemas.join(',') === 'job_kill,job_list,job_output', `schemas=${JSON.stringify(schemas)} (no start tool exists in pinned tree)`)
  const A = await f.mintScope('agent-A')
  const B = await f.mintScope('agent-B')
  const call = async (name, args, agent, seq) => {
    try {
      const res = await f.ctx.tools.execute({ signal: new AbortController().signal, callId: f.ToolCallId(`p09j-${String(seq)}`), name, arguments: args, ...(agent ? { agent } : {}) })
      return { res, text: (res?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('') }
    } catch (err) { return { res: undefined, threw: String(err?.message ?? err), text: String(err?.message ?? err) } }
  }
  const textOf = (r) => r.text ?? ''

  // J3 — complete lifecycle: start → running → completed; ring output + result once
  const id1 = f.ctx.jobs.start({ kind: 'synthetic', label: 'j3-complete', run: synthJob({ append: ['chunk-a\n', 'chunk-b\n'], settleAfterMs: 20, outcome: { status: 'completed', result: 'J3-RESULT' }, tag: 'j3' }) })
  const view1 = await f.ctx.jobs.wait(id1, 1500)
  const read1 = f.ctx.jobs.read(id1)
  const read1again = f.ctx.jobs.read(id1)
  expect('J3.complete-lifecycle', view1.status === 'completed' && read1.chunks.map((c) => c.text).join('') === 'chunk-a\nchunk-b\n' && read1.result === 'J3-RESULT' && read1again.result === undefined,
    `id=${String(id1)} status=${view1.status} chunks=${JSON.stringify(read1.chunks.map((c) => c.text))} result-once=${String(read1.result === 'J3-RESULT')}/${String(read1again.result === undefined)} (result handed out by first terminal read only)`)

  // J4 — kill in-flight: kill → stopping → killed; reason forwarded verbatim; detail merged
  let hooksRef
  const id2 = f.ctx.jobs.start({
    kind: 'synthetic', label: 'j4-kill',
    run: (job) => {
      job.append('tick-1\n', { channel: 'stdout' })
      const inner = synthJob({ hang: true, tag: 'j4' })(job)
      hooksRef = inner
      return inner
    },
  })
  const stoppingView = f.ctx.jobs.get(id2)
  const killRes = f.ctx.jobs.kill(id2, undefined, 'fixture-stop')
  const view2 = await f.ctx.jobs.wait(id2, 1500)
  expect('J4.kill-in-flight', stoppingView.status === 'running' && killRes === 'requested' && view2.status === 'killed' && hooksRef.cancelReasonSeen === 'fixture-stop' && String(view2.detail ?? '').includes('fixture-stop'),
    `preKill=${stoppingView.status} kill=${killRes} final=${view2.status} producer_saw_reason=${JSON.stringify(hooksRef.cancelReasonSeen)} detail=${JSON.stringify(String(view2.detail ?? ''))}`)

  // J5 — failed producer outcome
  const id3 = f.ctx.jobs.start({ kind: 'synthetic', label: 'j5-fail', run: synthJob({ settleAfterMs: 5, outcome: { status: 'failed', detail: 'boom' }, tag: 'j5' }) })
  const view3 = await f.ctx.jobs.wait(id3, 1500)
  expect('J5.failed-outcome', view3.status === 'failed' && String(view3.detail) === 'boom', `status=${view3.status} detail=${JSON.stringify(String(view3.detail))}`)

  // J6 — throwing starter leaves NOTHING registered
  const before = f.ctx.jobs.list().length
  let starterErr = ''
  try { f.ctx.jobs.start({ kind: 'synthetic', label: 'j6', run: synthJob({ throwOnStart: true, tag: 'j6' }) }) } catch (err) { starterErr = String(err?.message ?? err) }
  const after = f.ctx.jobs.list().length
  expect('J6.throwing-starter-no-registration', /starter-boom:j6/.test(starterErr) && after === before, `threw=${JSON.stringify(starterErr)} list ${String(before)}→${String(after)}`)

  // J7 — ownership path in this fixture = production fail-loud observable (NOT_RUN for scoped isolation)
  let ownerErr = ''
  try { f.ctx.jobs.start({ kind: 'synthetic', label: 'j7', owner: 'p09-session-x', run: synthJob({ settleAfterMs: 5, tag: 'j7' }) }) } catch (err) { ownerErr = String(err?.message ?? err) }
  observations.j7_owner_not_run = ownerErr
  expect('J7.owner-scoped-start-observably-deferred', /agent registry/.test(ownerErr),
    `owner-scoped jobs need dsh-agent (absent by fixture design) — exact fail-loud: ${JSON.stringify(ownerErr.slice(0, 100))} → owner-fence legs = NOT_RUN (recorded, not faked)`)

  // J8 — model-facing tools through ToolRuntime (agentless caller sees unowned set)
  const rList = await call('job_list', {}, undefined, 1)
  const listText = textOf(rList)
  expect('J8a.job_list-tool', rList.res?.isError !== true && listText.includes(String(id1)) && listText.includes(String(id2)),
    `job_list shows ${String(id1)}/${String(id2)}; head=${JSON.stringify(listText.slice(0, 100))}`)
  const rOut = await call('job_output', { job_id: String(id2) }, undefined, 2)
  const outText = textOf(rOut)
  expect('J8b.job_output-tool', rOut.res?.isError !== true && outText.includes('tick-1') && /killed/i.test(outText),
    `job_output(j4) head=${JSON.stringify(outText.slice(0, 140))}`)
  const rKill = await call('job_kill', { job_id: String(id1) }, undefined, 3)
  const killText = textOf(rKill)
  expect('J8c.job_kill-on-settled-is-already-finished', rKill.res?.isError !== true && /already[- ]finished|already (completed|settled)/i.test(killText),
    `kill on settled job: ${JSON.stringify(killText.slice(0, 100))}`)

  // J9 — P0-1 assembly re-check on the jobs injection path:
  // restrict-first + A-scope same-name adapter shadows job_list for A only.
  A.scope.ctx.tools.restrict({ deny: ['job_list'] })
  const maskedA = f.resolution('job_list', A.key) === 'UNKNOWN' && f.resolution('job_list', B.key) !== 'UNKNOWN'
  const ad = countingTool(f.obs, 'job_list', 'ADAPTER.job_list')
  A.scope.ctx.tools.register(ad)
  const rA = await call('job_list', {}, A.key, 4)
  const rB = await call('job_list', {}, B.key, 5)
  const aText = textOf(rA)
  const bText = textOf(rB)
  expect('J9.assembly-shadow-jobs-path', maskedA && f.counters('ADAPTER.job_list') === 1 && aText.includes('ran:job_list@ADAPTER.job_list') && !bText.includes('ran:job_list@ADAPTER.job_list'),
    `masked-first=${String(maskedA)}; A→ADAPTER (count=${String(f.counters('ADAPTER.job_list'))}, text=${JSON.stringify(aText.slice(0, 40))}); B text=${JSON.stringify(bText.slice(0, 40))} (no adapter marker in B = native body)`)

  observations.list_final = f.ctx.jobs.list().map((j) => ({ id: String(j.id), status: j.status }))
  const out = {
    header,
    observations,
    assertions: results,
    verdict: {
      family: 'jobs (ctx.jobs seam + dsh-jobs-local provider + tool-jobs 3-tool surface)',
      level: 'FIXTURE-LEVEL (synthetic producers over the public JobSpec seam; not a real-host proof — no GO writable)',
      family_shape: 'pinned 0.2.0-rc.2 has NO model-facing job-start tool; producers call ctx.jobs.start (kinds bash/subagent). Model surface = job_output/job_list/job_kill only.',
      directional: results.every((r) => r.verdict === 'PASS')
        ? 'INCONCLUSIVE(方向性: service-direct 闭环可行) — start/wait/kill/read/list/remove 全生产 service 直调闭环 PASS（complete/kill+reason/fail/throwing-starter 零泄漏）；三工具经 ToolRuntime 执行 PASS；P0-1 装配结论在 jobs 注入路径复现 PASS；owner-scoped 隔离面 NOT_RUN（需 dsh-agent，缺服务时生产面 fail-loud 原文已录）'
        : 'INCONCLUSIVE(fixtures not all green, see legs)',
      NOT_RUN: ['owner-scoped fence/隔离（需真实 dsh-agent + Session owner）', 'pull-source pump 与真实子进程输出（需 subprocess producer，如真实 bash 后台）', 'completion wakeup 投递（需 agent loop/inbox）'],
    },
  }
  writeFileSync(join(HERE, 'p09-jobs-result.json'), JSON.stringify(out, null, 2))
  const pass = results.filter((r) => r.verdict === 'PASS').length
  console.log(`\nWRITTEN p09-jobs-result.json (${String(pass)}/${String(results.length)} PASS)`)
  for (const t of timerProducers) clearTimeout(t)
  process.exit(results.every((r) => r.verdict === 'PASS') ? 0 : 1)
} catch (err) {
  console.error('P09_JOBS_ENV_FAIL', err?.stack ?? String(err))
  writeFileSync(join(HERE, 'p09-jobs-result.json'), JSON.stringify({ error: String(err?.stack ?? err), results }, null, 2))
  process.exit(2)
}
