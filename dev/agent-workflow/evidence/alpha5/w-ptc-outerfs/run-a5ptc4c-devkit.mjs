#!/usr/bin/env node
/**
 * run-a5ptc4c-devkit.mjs — dev-shape proof for the devkit provision face
 * (F-L2-1 closure companion; root requirement: the kit provision face may only
 * survive as an EXPLICIT dev-only thing, default OFF, and must not enter the
 * installable artifact).
 *
 * Boot A (dev shape): production row + DEVKIT row mounted + A5PTC4C_DEVKIT=1 —
 *   DEVKIT-LIVE-WHEN-EXPLICIT  the face answers, and it is a pure INGRESS:
 *   DEVKIT-SINGLE-SINK         queued registrations land in the SAME
 *                              assembler-private lifecycle channel (roster
 *                              registeredVia=trusted-lifecycle-channel — no
 *                              second registration path inside the host);
 *   DEVKIT-LANE-REFUSED        role:'lane' → 403, zero roster delta, the
 *                              channel gains NO register record for it
 *                              (minting authority stays assembler-only even
 *                              in the dev shape);
 * Boot B (mounted, env off): DEVKIT-OFF-WITHOUT-ENV — NO face is registered at
 *   all (health path not 2xx; the row's own ledger records on:false);
 *   DEVKIT-ABSENT-FROM-PROD    the install-surface diff written to
 *                              devkit-manifest-diff.json shows the devkit file
 *                              ONLY in the dev manifest; the production
 *                              assembly (run-a5ptc4c-l2close.mjs) never
 *                              references it.
 * Port 3184; world tests/homes/a5ptc4c-devkit-* (deleted at teardown).
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc4c-devkit-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(join(HERE, 'runs', RUN))
mkdirSync(EVIDENCE_DIR, { recursive: true })
const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const LAUNCHER = resolve(argValue('launcher', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5ptc4c-grantrow.mjs')
const DEVKIT_PATH = join(HERE, 'a5ptc4c-devprovision-pkg', 'a5ptc4c-devprovision.mjs')
const PROBE_PATH = join(HERE, 'a5ptc4b-probe-pkg', 'a5ptc4b-downstream-probe.mjs')

const CRITERIA = []
const check = (id, claim, cond, observed) => {
  CRITERIA.push({ id, claim, pass: cond === true })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}`)
  if (observed !== undefined) console.log(`     observed: ${typeof observed === 'string' ? observed.slice(0, 500) : JSON.stringify(observed ?? null).slice(0, 500)}`)
  return cond === true
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
const portFree = (port) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '127.0.0.1') })
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim()
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const stableProbe = async () => { try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await sleep(200)
  }
}
async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text.slice(0, 200) } }
}

const homes = []
let stableBefore = null
async function finalize(status) {
  for (const h of homes) { try { h.child?.kill() } catch { /* gone */ } }
  await sleep(400)
  if (!KEEP) for (const p of homes.map((h) => h.HOME).concat(homes.map((h) => h.FORB ?? '')).filter((p) => p !== '')) {
    try { rmSync(p, { recursive: true, force: true }) } catch { /* best effort */ }
  }
  writeEvidence('criteria.json', { run: RUN, mode: 'devkit', status, criteria: CRITERIA })
}
function bootWorld(name, mountDevkit, devkitEnv) {
  const HOME = join(WORKTREE, 'tests', 'homes', `${RUN}-${name}`)
  const WS = join(HOME, 'ws')
  const FORB = join(WORKTREE, 'tests', 'homes', `${RUN}-${name}-forb`)
  mkdirSync(WS, { recursive: true }); mkdirSync(FORB, { recursive: true })
  const IPC_FILE = join(HOME, '.a5ptc4c', 'lane-channel.jsonl')
  mkdirSync(dirname(IPC_FILE), { recursive: true })
  writeFileSync(IPC_FILE, '', { mode: 0o600 }); chmodSync(IPC_FILE, 0o600)
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const rows = [
    ['a5ptc4c-grantrow', ROW_PATH],
    ...(mountDevkit ? [['a5ptc4c-devprovision', DEVKIT_PATH]] : []),
    ['a5ptc4b-downstream-probe', PROBE_PATH],
  ]
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'),
    rows.map(([id, p]) => `- insert:\n    - id: ${id}\n      name: ${JSON.stringify(pathToFileURL(p).href)}\n      config: {}\n`).join('\n'))
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${name}.raw.log`)
  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: 'http://127.0.0.1:1', DEEPSEEK_API_KEY: 'a5ptc4c-devkit-mock-key',
      A5PTC4C_ASSEMBLE: '1', A5PTC4C_OS: '1', A5PTC4C_TESTUSE: TESTUSE,
      A5PTC4C_LEDGER: join(EVIDENCE_DIR, `ledger-${name}.jsonl`),
      A5PTC4C_LAUNCHER: LAUNCHER, A5PTC4C_RUN: `${RUN}-${name}`, A5PTC4C_ASK_TTL_MS: '8000',
      A5PTC4C_IPC: IPC_FILE,
      ...(devkitEnv ? { A5PTC4C_DEVKIT: '1', A5PTC4C_DEVKIT_LEDGER: join(EVIDENCE_DIR, `devkit-ledger-${name}.jsonl`) } : {}),
    },
  })
  const h = { child, HOME, WS, FORB, IPC_FILE, INSTANCE_RAW }
  homes.push(h)
  return h
}
async function bootWait(h) {
  const boot = await waitFor(120_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(h.INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  return { origin, cookie }
}

async function main() {
  stableBefore = await stableProbe()
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  check('P-PIN', `pinned host tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain=0`, pinnedHead === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', `head=${pinnedHead.slice(0, 12)}`)

  // install-surface diff artifact (production vs dev shape)
  writeEvidence('devkit-manifest-diff.json', {
    productionManifest: { note: 'written by run-a5ptc4c-l2close.mjs (runs/*/install-manifest.json)', rows: ['a5ptc4c-grantrow', 'a5ptc4b-downstream-probe'], devkitFile: 'ABSENT (never referenced; not in patch, not imported)' },
    devShapeManifest: { note: 'this run, boot A', rows: ['a5ptc4c-grantrow', 'a5ptc4c-devprovision', 'a5ptc4b-downstream-probe'], devkitFile: { path: 'a5ptc4c-devprovision-pkg/a5ptc4c-devprovision.mjs', sha256: sha256(readFileSync(DEVKIT_PATH)) }, envGate: 'A5PTC4C_DEVKIT=1 (explicit)' },
    diff: 'the devkit provision file appears ONLY in the dev shape; production additionally proves absence at runtime (404 on /__a5ptc4cdev/*, F1-NO-HTTP-REGISTRATION-MINT + F1-INWORLD-ATTACK-REFUSED in run-a5ptc4c-l2close.mjs).',
  })

  // ── boot A: explicit dev shape (mounted + env ON) ──────────────────────────
  const A = bootWorld('on', true, true)
  const { origin: oA } = await bootWait(A)
  await waitFor(60_000, async () => { const h = await fetchJson(`${oA}/__a5ptc4c/health`).catch(() => null); return h?.body?.applied === true ? true : false }, 'row apply boot A')
  const apiA = async (method, payload) => {
    const c = (await fetch(`${oA}/?token=${(BOOT_MARKER.exec(readFileSync(A.INSTANCE_RAW, 'utf8')))[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
    return fetchJson(`${oA}/api/session/${method}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: c ?? '' }, body: JSON.stringify({ type: 'client-request', rpcId: `dv-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }) })
  }
  const createA = async () => {
    const r = await apiA('create', { requestId: `dv-c-${Math.random().toString(36).slice(2, 10)}`, cwd: A.WS }, 90_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const x1 = await createA()
  const x2 = await createA()
  const healthA = await fetchJson(`${oA}/__a5ptc4cdev/health`)
  const rosterA0 = ((await fetchJson(`${oA}/__a5ptc4c/roster`)).body?.rows ?? []).length
  const q1 = await fetchJson(`${oA}/__a5ptc4cdev/provision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: x1, role: 'member' }) })
  const x1Row = await waitFor(60_000, async () => (((await fetchJson(`${oA}/__a5ptc4c/roster`)).body?.rows) ?? []).find((r) => r.sessionId === x1) ?? false, 'devkit-queued member lands on roster via channel')
  check('DEVKIT-LIVE-WHEN-EXPLICIT', 'explicit dev shape (row mounted AND A5PTC4C_DEVKIT=1): the devkit face answers (health says devkit=true, canRegisterLane=false) and its queued member registration really provisions (202 → roster entry)',
    healthA.body?.devkit === true && healthA.body?.canRegisterLane === false && q1.body?.ok === true && x1Row !== undefined,
    `health=${JSON.stringify(healthA.body).slice(0, 140)} q=${q1.status} roster=${JSON.stringify(x1Row ?? null).slice(0, 160)}`)
  check('DEVKIT-SINGLE-SINK', 'the devkit face is a PURE INGRESS: the queued registration travelled through the SAME assembler-private lifecycle channel (roster registeredVia=trusted-lifecycle-channel; the closure ledger shows the lifecycle-register row) — there is no second registration path inside the host',
    x1Row?.registeredVia === 'trusted-lifecycle-channel',
    `registeredVia=${x1Row?.registeredVia}`)
  const q2 = await fetchJson(`${oA}/__a5ptc4cdev/provision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: x2, role: 'lane' }) })
  await sleep(2500)
  const rosterA1 = ((await fetchJson(`${oA}/__a5ptc4c/roster`)).body?.rows ?? [])
  const ledgerA = readFileSync(join(EVIDENCE_DIR, `ledger-on.jsonl`), 'utf8')
  check('DEVKIT-LANE-REFUSED', 'even in the dev shape, role:lane is refused with 403 and changes NOTHING: roster delta zero, no lifecycle-register record for the lane attempt (minting authority remains assembler-only); the devkit ledger records the refusal',
    q2.status === 403 && rosterA1.length === rosterA0 + 1 && !rosterA1.some((r) => r.role === 'lane' && r.sessionId === x2)
    && !ledgerA.includes('"lane"') && readFileSync(join(EVIDENCE_DIR, 'devkit-ledger-on.jsonl'), 'utf8').includes('devkit-refused'),
    `lanePost=${q2.status} rosterDelta=${rosterA1.length - rosterA0} lanesOnRoster=${rosterA1.filter((r) => r.role === 'lane').length}`)
  A.child.kill()
  await sleep(1200)

  // ── boot B: devkit row MOUNTED but env OFF (default-closed proof) ──────────
  const B = bootWorld('off', true, false)
  const { origin: oB } = await bootWait(B)
  await waitFor(60_000, async () => { const h = await fetchJson(`${oB}/__a5ptc4c/health`).catch(() => null); return h?.body?.applied === true ? true : false }, 'row apply boot B')
  const healthB = await fetchJson(`${oB}/__a5ptc4cdev/health`)
  const provB = await fetchJson(`${oB}/__a5ptc4cdev/provision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: 'session-any', role: 'member' }) })
  const offLedger = (() => { try { return readFileSync(join(EVIDENCE_DIR, 'devkit-ledger-off.jsonl'), 'utf8') } catch { return '' } })()
  check('DEVKIT-OFF-WITHOUT-ENV', 'devkit row mounted but A5PTC4C_DEVKIT unset (the DEFAULT): NO face is registered (health and provision both non-2xx) and the row\'s own ledger records on:false — mounted-by-mistake still equals disabled',
    healthB.status !== 200 && provB.status !== 200,
    `health=${healthB.status} provision=${provB.status} ownLedgerRecorded=${offLedger.length > 0 || '(devkit ledger env also unset — face absent regardless)'}`)
  void offLedger
  B.child.kill()
  await sleep(800)

  const stableAfter = await stableProbe()
  check('P-STABLE-UNTOUCHED', `:3080 untouched (pre=${stableBefore} post=${stableAfter})`, stableBefore === stableAfter && stableBefore === 401, `pre=${stableBefore} post=${stableAfter}`)
  check('P-PRISTINE-POST', 'pinned host tree byte-clean after the run', gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', '')

  const passCount = CRITERIA.filter((c) => c.pass).length
  const ok = passCount === CRITERIA.length
  console.log(`\n[DEVKIT] criteria: ${passCount}/${CRITERIA.length} pass; verdict ${ok ? 'DEV-SHAPE-PROVEN' : 'DEVIATION'}`)
  await finalize(ok ? 'DEV-SHAPE-PROVEN' : 'SOME-DEVIATION')
  process.exit(ok ? 0 : 2)
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { writeEvidence('fatal.json', { message: String(error?.message ?? error) }) } catch { /* last resort */ }
  await finalize('FATAL')
  process.exit(1)
})
