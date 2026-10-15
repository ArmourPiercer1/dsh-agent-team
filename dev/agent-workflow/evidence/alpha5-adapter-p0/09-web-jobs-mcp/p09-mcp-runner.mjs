#!/usr/bin/env node
/**
 * p09-mcp-runner.mjs — Alpha.5 P0-9 MCP family (fixture level, mock stdio server).
 *
 * WHAT THIS IS: the pinned dsh-mcp-client plugin (inject=['tools'], imported
 * via absolute file URL — no new junctions) is loaded on a plain ToolRuntime
 * fixture and connects to a Team-owned MOCK stdio MCP server
 * (p09-mcp-mock-server.mjs, dependency-free NDJSON JSON-RPC). The mock is a
 * REAL OS child process (self-reports process.pid in every tool result and in
 * its append-only event/call log). Evidence channels:
 *   - child-side append-only log (P09_MCP_CALL_LOG): spawn/initialize/
 *     tools/list/tools/call/shutdown lines = ground-truth "did the native
 *     MCP body actually reach the server" counters (no monkey-patching);
 *   - ToolRuntime counters on the Team same-name Adapter (p00 countingTool);
 *   - OS checks: /proc/<pid>/cmdline proves the real process identity;
 *     post-dispose pid polling proves reclamation.
 *
 * Legs:
 *  M0 plugin shape (name/inject recorded)
 *  M1 production mcp-client mount → tools/list generation registers
 *     mcp__mock__echo (public name contract mcp__<server>__<raw>)
 *  M2 execute through ToolRuntime → child echoes (real pid, ≠ self); handshake
 *     lines present in child log
 *  M3 P0-1 assembly re-check on the MCP injection path: restrict-first +
 *     A-scope same-name adapter → A runs adapter with ZERO child-side
 *     tools/call growth; B still dispatches the MCP-backed definition (+1)
 *  M4 resolution identity A/B/global
 *  M5 disposal → tool unregistered; EVERY spawned child pid reaped; child log
 *     shows shutdown event for the live generation
 * Observed production shape (recorded, NOT asserted): the supervisor's first
 * generation may be superseded (spawn→SIGTERM pre-handshake, second
 * generation serves) — reproduced deterministically in probes, root-cause
 * investigation OUT OF SCOPE (fixture brief: no upstream debugging).
 *
 * Loopback/mock authorization: no sockets at all (pure stdio pipes).
 * Usage: node dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-mcp-runner.mjs
 * Exit 0 = every leg matched; 1 = assertion failure; 2 = environment.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeFixture, countingTool } from '../00-baseline/p00-fixture.mjs'
import { HERE, envHeader, makeLedger, libUrl, scratch, git, TEST_USE } from './p09-shared.mjs'

const { results, expect } = makeLedger('M')
const observations = {}
const SERVER = join(HERE, 'p09-mcp-mock-server.mjs')
const CALL_LOG = join(scratch('mcp'), 'child-events.jsonl')
writeFileSync(CALL_LOG, '')
process.env.P09_MCP_CALL_LOG = CALL_LOG

const readChildLog = () => readFileSync(CALL_LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return { ev: 'unparsable', raw: l } } })
const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch (err) { return err?.code === 'EPERM' } }

let fiber = null
try {
  const header = envHeader({ family: 'mcp', mock_server: SERVER })
  const mcp = await import(libUrl('mcp', 'mcp-client'))
  observations.shape = { name: mcp.name, inject: mcp.inject, exports: Object.keys(mcp) }
  expect('M0.plugin-shape', mcp.name === 'mcp-client' && Array.isArray(mcp.inject) && mcp.inject.join(',') === 'tools',
    `name=${mcp.name} inject=${JSON.stringify(mcp.inject)} (no default export — namespace plugin)`)

  const f = await makeFixture()
  fiber = await f.ctx.plugin(mcp, {
    transport: 'stdio',
    serverName: 'mock',
    command: process.execPath,
    args: [SERVER],
    env: { P09_MCP_CALL_LOG: CALL_LOG },
    cwd: HERE,
    failOnStartupError: true,
    reconnect: { enabled: false },
  })
  const names = f.ctx.tools.schemas().map((s) => s.name)
  const mcpTool = 'mcp__mock__echo'
  expect('M1.connect-and-register', fiber?.state === 2 && names.includes(mcpTool),
    `fiber.state=${String(fiber?.state)} schemas=${JSON.stringify(names)} (public name contract mcp__mock__echo verified against live registration)`)

  const log1 = readChildLog()
  observations.child_events_after_mount = log1
  const spawned = [...new Set(log1.filter((e) => e.ev === 'spawn').map((e) => e.pid))]
  expect('M2.handshake-in-child-log', log1.some((e) => e.ev === 'initialize') && log1.some((e) => e.ev === 'tools/list') && spawned.length >= 1,
    `child log lines=${String(log1.length)} spawns=${JSON.stringify(spawned)} (first-generation churn = observed production supervisor shape, recorded not asserted)`)

  const call = async (args, agent, seq) => {
    try {
      const res = await f.ctx.tools.execute({ signal: new AbortController().signal, callId: f.ToolCallId(`p09m-${String(seq)}`), name: mcpTool, arguments: args, ...(agent ? { agent } : {}) })
      return { res, text: (res?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('') }
    } catch (err) { return { res: undefined, threw: String(err?.message ?? err), text: String(err?.message ?? err) } }
  }

  // M2b execute loop: ToolRuntime → pinned client → wire → REAL OS child
  const r0 = await call({ message: 'ping-42' }, undefined, 1)
  const pidMatch = /pid=(\d+)/.exec(r0.text)
  const livePid = Number(pidMatch?.[1] ?? -1)
  const cmdline = livePid > 0 && existsSync(`/proc/${String(livePid)}/cmdline`) ? readFileSync(`/proc/${String(livePid)}/cmdline`, 'utf8').replace(/\0/g, ' ') : ''
  expect('M2.call-loop-real-os-child', r0.res?.isError !== true && r0.text.includes('echo:ping-42') && livePid > 0 && livePid !== process.pid && pidAlive(livePid) && cmdline.includes('p09-mcp-mock-server.mjs'),
    `text=${JSON.stringify(r0.text.slice(0, 60))}; child pid=${String(livePid)} (self-reported, alive, cmdline="${cmdline.slice(0, 70)}"; runner pid=${String(process.pid)})`)
  observations.live_child = { pid: livePid, cmdline, spawned_generations: spawned }

  // M3 assembly re-check (P0-1 conclusion on the MCP injection path)
  const callsBefore = readChildLog().filter((e) => e.ev === 'tools/call').length
  {
    const A = await f.mintScope('agent-A')
    const B = await f.mintScope('agent-B')
    A.scope.ctx.tools.restrict({ deny: [mcpTool] })
    const maskedA = f.resolution(mcpTool, A.key) === 'UNKNOWN'
    const ad = countingTool(f.obs, mcpTool, 'ADAPTER.mcp__mock__echo')
    A.scope.ctx.tools.register(ad)
    expect('M4.resolution-identity', maskedA && f.resolution(mcpTool, A.key) === 'ADAPTER.mcp__mock__echo' && f.resolution(mcpTool, B.key) === 'untagged',
      `masked-first=${String(maskedA)} A=${f.resolution(mcpTool, A.key)} B=${f.resolution(mcpTool, B.key)} (B/global resolve the MCP-backed native def; untagged = production def)`)

    const rA = await call({ message: 'should-not-reach-child' }, A.key, 2)
    const callsAfterA = readChildLog().filter((e) => e.ev === 'tools/call').length
    expect('M3.A-adapter-child-zero', rA.text.includes('ran:mcp__mock__echo@ADAPTER.mcp__mock__echo') && callsAfterA === callsBefore,
      `A→ADAPTER (text=${JSON.stringify(rA.text.slice(0, 50))}); child-side tools/call +${String(callsAfterA - callsBefore)} [expect 0 — native wire untouched]`)

    const rB = await call({ message: 'from-B' }, B.key, 3)
    const callsAfterB = readChildLog().filter((e) => e.ev === 'tools/call').length
    expect('M3.B-native-mcp-reaches-child', rB.res?.isError !== true && rB.text.includes('echo:from-B') && rB.text.includes(`pid=${String(livePid)}`) && callsAfterB === callsBefore + 1,
      `B→MCP native: child tools/call +${String(callsAfterB - callsBefore)} [expect 1], echo text=${JSON.stringify(rB.text.slice(0, 50))}`)
  }

  // M5 disposal: unregister + reap EVERY spawned generation
  await fiber.dispose()
  fiber = null
  const namesAfter = f.ctx.tools.schemas().map((s) => s.name)
  const allPids = [...new Set([...spawned, livePid])]
  const deadline = Date.now() + 5000
  let reaped = allPids.filter((p) => pidAlive(p))
  while (reaped.length > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100))
    reaped = allPids.filter((p) => pidAlive(p))
  }
  const logFinal = readChildLog()
  const shutdownSeen = logFinal.filter((e) => ['stdin-end', 'sigterm', 'sigint'].includes(e.ev)).map((e) => ({ pid: e.pid, ev: e.ev }))
  expect('M5.dispose-unregisters-and-reaps', !namesAfter.includes(mcpTool) && reaped.length === 0 && shutdownSeen.some((s) => s.pid === livePid),
    `after dispose schemas=${JSON.stringify(namesAfter)}; all spawned pids ${JSON.stringify(allPids)} reaped=${String(reaped.length === 0)}; child shutdown events=${JSON.stringify(shutdownSeen)}`)

  observations.child_events_final = logFinal
  const out = {
    header,
    observations,
    assertions: results,
    test_use_porcelain_final: git(['status', '--porcelain'], TEST_USE).length === 0 ? 'CLEAN' : 'DIRTY(FATAL-PATH)',
    verdict: {
      family: 'mcp (dsh-mcp-client stdio + mcp__<server>__<tool> injection into ToolRuntime)',
      level: 'FIXTURE-LEVEL (mock stdio server = Team TEST FIXTURE over the public MCP wire; pinned client/bridge are production code; not a real-host proof — no GO writable)',
      directional: results.every((r) => r.verdict === 'PASS')
        ? 'INCONCLUSIVE(方向性: MCP 注入路径与 P0-1 装配结论一致) — 生产 mcp-client 插件+真实 OS 子进程：tools/list→注册 mcp__mock__echo→tools/call 回声闭环 PASS；restrict-first+同名 Adapter 遮蔽在 MCP 注入路径复现 PASS（A=Adapter 且子进程侧 tools/call 零增长，B=原生 +1）；dispose 后注销+全部子进程代际回收 PASS。观测记录：supervisor 首代连接可被静默换代（spawn→SIGTERM 预握手），断言面已按存活代际设计'
        : 'INCONCLUSIVE(fixtures not all green, see legs)',
      NOT_RUN: ['真实第三方 MCP server（禁止外联——mock 即测试面）', 'streamable-http 传输（需回环 HTTP MCP 服务，本轮未扩面）', 'mcp-resources 资源面', 'reconnect/stability 窗口的重连语义（换代观测已录，语义腿 NOT_RUN）'],
    },
  }
  writeFileSync(join(HERE, 'p09-mcp-result.json'), JSON.stringify(out, null, 2))
  const pass = results.filter((r) => r.verdict === 'PASS').length
  console.log(`\nWRITTEN p09-mcp-result.json (${String(pass)}/${String(results.length)} PASS)`)
  process.exit(results.every((r) => r.verdict === 'PASS') ? 0 : 1)
} catch (err) {
  console.error('P09_MCP_ENV_FAIL', err?.stack ?? String(err))
  try {
    if (fiber) await fiber.dispose()
  } catch (_e) { appendFileSync(CALL_LOG, JSON.stringify({ ev: 'runner-cleanup-failed' }) + '\n') }
  writeFileSync(join(HERE, 'p09-mcp-result.json'), JSON.stringify({ error: String(err?.stack ?? err), results, child_events: (() => { try { return readChildLog() } catch { return [] } })() }, null, 2))
  process.exit(2)
}
