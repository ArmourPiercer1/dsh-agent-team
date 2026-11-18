/**
 * boot.test.mjs — NEXT HOST (0.2.2-rc.5) REAL BOOT, scripted model on the wire.
 *
 * WHAT THIS PROVES: the pinned second host is not just installed — it BOOTS,
 * serves a session through its public HTTP/RPC surface, and the model traffic
 * goes through the SAME in-process scripted mock provider the existing tests use
 * (`packages/tools/harness/mock-deepseek.mjs` on DEEPSEEK_BASE_URL). Nothing
 * here fakes a boot: the child is `<nextTree>/apps/cli/lib/bin.js`, its own
 * DSH_HOME under `tests/homes/<world>-next`, its own port from the next-host
 * band (13000-13049, never :3080 and never the legacy 3181-3199 family — the
 * two bands are disjoint by the 2026-11-16 generation partition), its own log.
 *
 * Recorded: boot wall time (spawn -> boot marker), the boot marker line, the
 * session id the host returned, the host's own session log path, and the number
 * of model requests the mock actually saw.
 *
 * FAIL-LOUD: a missing/ drifted tree or asset throws before anything spawns.
 * CORE PATCH BUDGET = 0 (no host file is written; the home is created under
 * tests/homes and deleted at teardown).
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { test } from 'node:test'
import { performance } from 'node:perf_hooks'

import { HOST_PORT_BANDS, NEXT_HOST, nextHostHomeDir } from '../paths.mjs'
import { DshInstance } from '../characterization/lib/instance.mjs'
import { apiPrompt, apiSessionCreate, authenticate } from '../world-factory/lib/world-factory.mjs'
import { startMockModel } from '../../packages/tools/harness/mock-deepseek.mjs'
import {
  NEXT_LANE_REPO_ROOT, assertGenerationBandsDisjoint, assertNextHostAssets, assertNextHostTree, nextLaneWorkdir, proof,
} from './host-next-lib.mjs'

const host = assertNextHostTree()
assertNextHostAssets()

/** Is a TCP port free on loopback right now? */
function portFree(port) {
  return new Promise((done) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    socket.once('connect', () => { socket.destroy(); done(false) })
    socket.once('error', () => done(true))
    setTimeout(() => { socket.destroy(); done(true) }, 800)
  })
}

async function firstFreePort(bands) {
  for (const [lo, hi] of bands) {
    for (let port = lo; port <= hi; port += 1) {
      if (await portFree(port)) return port
    }
  }
  throw new Error(`no free port in the next-host bands ${JSON.stringify(bands)}`)
}

// RULING 2026-11-16 (UTE-Prep): the generation partition is asserted as a LAW,
// not inferred from a free-port probe. This runs before any boot and is the
// cheapest possible RED when someone overlaps the bands again.
test('host port bands are disjoint by generation: legacy 3181-3199, next host 13000-13049 only', () => {
  const { legacy, next } = assertGenerationBandsDisjoint()
  assert.deepEqual([legacy[0], legacy.at(-1), legacy.length], [3181, 3199, 19])
  assert.deepEqual([next[0], next.at(-1), next.length], [13000, 13049, 50])
  assert.deepEqual(JSON.parse(JSON.stringify(HOST_PORT_BANDS)), [[3181, 3199]])
  assert.deepEqual(JSON.parse(JSON.stringify(NEXT_HOST.portBands)), [[13000, 13049]])
  assert.equal(next.some((p) => legacy.includes(p)), false)
  proof('BANDS', true, `legacy=3181-3199(19) next=13000-13049(50) overlap=0`)
})

/** A text-only scripted reply: the mock provider's own wire shape. */
const decide = () => ({ kind: 'text', content: 'NEXT-BOOT-OK scripted model reply' })

test('the pinned next host boots, serves a session, and its wire traffic is the scripted model', async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const world = `next-boot-${stamp}`
  const home = nextHostHomeDir(NEXT_LANE_REPO_ROOT, world)
  const logDir = join(NEXT_LANE_REPO_ROOT, '.artifacts', 'tmp', 'next-host-lane', 'logs')
  const cwd = nextLaneWorkdir(NEXT_LANE_REPO_ROOT)
  mkdirSync(logDir, { recursive: true })
  const mockPort = await firstFreePort([[3491, 3500]])
  assertGenerationBandsDisjoint()
  const hostPort = await firstFreePort(NEXT_HOST.portBands)
  // The boot's port must be in the next-generation band AND outside every
  // legacy band — asserted from the value actually bound, not from intent.
  const legacyPorts = HOST_PORT_BANDS.flatMap(([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i))
  assert.ok(hostPort >= 13000 && hostPort <= 13049, `boot port ${hostPort} is inside 13000-13049`)
  assert.equal(legacyPorts.includes(hostPort), false, `boot port ${hostPort} is NOT a legacy host port`)
  const mock = await startMockModel({ port: mockPort, decide })
  const instance = new DshInstance({
    hostTree: host.tree,
    dshHome: home,
    port: hostPort,
    clientCommitHash: NEXT_HOST.shortSha,
    logDir,
  })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mockPort}`
  process.env.DEEPSEEK_API_KEY = 'next-host-smoke-key'
  try {
    // ── boot, measured: spawn -> boot marker ────────────────────────────────
    const startedAt = performance.now()
    const booted = await instance.start({ timeoutMs: 120_000 })
    const bootMs = Math.round(performance.now() - startedAt)
    const bootLine = readFileSync(booted.logPath, 'utf8')
      .split('\n')
      .find((line) => /dsh web: http:\/\/127\.0\.0\.1:\d+\/\?token=/.test(line))
    assert.ok(bootLine, `no boot marker in ${booted.logPath}`)
    assert.ok(bootLine.includes(`:${hostPort}/`), `the boot marker names this World's port ${hostPort}: ${bootLine}`)
    proof('BOOT', true, `ms=${bootMs} port=${hostPort} treeHead=${host.head} version=${host.version} line=${JSON.stringify(bootLine.replace(/\?token=[A-Za-z0-9_-]+/, '?token=<redacted>'))}`)

    // ── public surface: auth + session + prompt ─────────────────────────────
    const token = new URL(booted.url).searchParams.get('token')
    assert.ok(token, 'the boot URL carries the launch token')
    const cookie = await authenticate(`http://127.0.0.1:${hostPort}`, token)
    const created = await apiSessionCreate(`http://127.0.0.1:${hostPort}`, cookie, cwd, 'nextboot')
    assert.notEqual(created.status, 0, `session/create did not answer: ${JSON.stringify(created.error ?? null)}`)
    // The host's RPC envelope: { result: { ok, value: { sessionId, agentPreset } } }.
    const sessionId = created.body?.result?.value?.sessionId ?? created.body?.result?.sessionId
    assert.ok(typeof sessionId === 'string' && sessionId.length > 0, `session/create returned no session id: ${JSON.stringify(created.body)}`)
    const prompted = await apiPrompt(`http://127.0.0.1:${hostPort}`, cookie, sessionId, 'next-host boot smoke: reply with the scripted text', 'nextboot')
    assert.notEqual(prompted.status, 0, `session/prompt did not answer: ${JSON.stringify(prompted.error ?? null)}`)
    // The prompt is QUEUED; the turn's model call arrives asynchronously on the
    // mock's wire. Poll (bounded) instead of assuming the RPC response ordered it.
    const deadline = Date.now() + 30_000
    while (mock.requests.length === 0 && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100))
    }
    assert.ok(mock.requests.length >= 1, `the scripted model provider saw no session traffic within 30s (prompt response: ${JSON.stringify(prompted.body)})`)
    proof('SESSION', true, `sessionId=${sessionId} createStatus=${created.status} promptStatus=${prompted.status} modelRequests=${mock.requests.length}`)

    // ── the host's own durable trace of that session ───────────────────────
    const sessionsDir = join(home, 'sessions')
    assert.ok(existsSync(sessionsDir), `the host wrote no sessions dir at ${sessionsDir}`)
    const files = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else files.push(path)
      }
    }
    walk(sessionsDir)
    assert.ok(files.length >= 1, `the host served the session but wrote no durable session log under ${sessionsDir}`)
    const hostLog = join(home, 'logs')
    proof('SERVED', true, `home=${home} sessionFiles=${files.map((f) => f.slice(home.length + 1)).join(',')} hostLogs=${existsSync(hostLog) ? 'present' : 'absent'} modelReplies=${mock.requests.length}`)
  } finally {
    const stopped = await instance.stop({ timeoutMs: 20_000 })
    await mock.close()
    rmSync(home, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
    delete process.env.DEEPSEEK_BASE_URL
    delete process.env.DEEPSEEK_API_KEY
    assert.equal(stopped.killed, true, 'the booted host was stopped')
  }
})
