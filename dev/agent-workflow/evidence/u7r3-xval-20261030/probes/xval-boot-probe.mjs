#!/usr/bin/env node
/**
 * xval-boot-probe.mjs — lane probe (NOT a tracked suite) for the u7r3-xval
 * controlled parallel-validation experiment (real-UTC 2026-10-30, pool C1,
 * NO ACCEPTANCE CREDIT anywhere).
 *
 * One invocation = one World boot on ONE measurement worktree, with the full
 * factory discipline:
 *   factory bindings (Team SHA + Host base + leaseRoot + authority) ->
 *   preflightHostSandbox() -> createWorld({line}) -> startMock ->
 *   BUDGET LEDGER LINE BEFORE THE SPAWN -> startHost (shared DshInstance
 *   launcher) -> public readiness witness (GET / 401-tokenless, 303 auth,
 *   GET / 200 cookie) -> capture ports/leases/homes/logs -> [optional rendez-
 *   vous: stay up until a peer World is up = the concurrency window] ->
 *   teardown (stopHost graceMs + receipts) -> post-invariants (:3080 status,
 *   ~/.dsh mtime, host base, ports free, leases gone, home gone).
 *
 * Emits RUN-<token>.json (u5-run-record/1) in --out and a RUN-SUMMARY line.
 *
 * Flags:
 *   --worktree <abs>   measurement worktree root (repoRoot)
 *   --line <tag>       world line ([a-z0-9-]{1,24}); world = u5<line>-<UTC>
 *   --out <abs>        evidence dir for this probe (RUN json + logs/<world>)
 *   --budget <abs>     host-start budget JSONL (line appended BEFORE spawn)
 *   --token <id>       budget token (x1|x2|x3)
 *   --phase <label>    human phase (p0-sequential / p0-concurrent / p2-corotate)
 *   --rendezvous <abs> dir; after readiness write <token>.up.json and HOLD the
 *                      World up until <peer>.up.json exists (or timeout)
 *   --peer <id>        peer token for the rendezvous
 *   --rendezvous-timeout-ms N   (default 180000)
 *   --hold-until <abs> also hold until this file exists (P2: C1 pair done)
 *   --boot-timeout-ms N         (default 90000, factory default)
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const arg = (name, dflt = undefined) => {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = process.argv[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} needs a value`)
  return v
}
const num = (name, dflt) => Number(arg(name, String(dflt)))

const WORKTREE = arg('worktree')
// TEST_METHODS §9 provisioning-source override (the ONLY sanctioned override
// point): for task-worktree repoRoots the default source resolves to the
// destination tree itself (SOURCE_IS_DESTINATION) and the MAIN checkout is
// not a trusted root from a worktree; the rule-compliant resolution (precedent
// u7-g4r3-20261028 SETUP-NOTES) is a byte-identical `cp -al` hardlink copy of
// the main-checkout runtime tree INSIDE the worktree (gitignored
// .artifacts/tmp/xval-sbx-source), which the trust gate roots at the worktree.
process.env.DSH_TEAM_SANDBOX_ASSET_SOURCE = `${WORKTREE}/.artifacts/tmp/xval-sbx-source`
const LINE = arg('line')
const OUT = arg('out')
const BUDGET = arg('budget')
const TOKEN = arg('token')
const PHASE = arg('phase', 'p0')
const RENDEZVOUS = arg('rendezvous', null)
const PEER = arg('peer', null)
const RENDEZVOUS_TIMEOUT_MS = num('rendezvous-timeout-ms', 180_000)
const HOLD_UNTIL = arg('hold-until', null)
const BOOT_TIMEOUT_MS = num('boot-timeout-ms', 90_000)
for (const [k, v] of Object.entries({ WORKTREE, LINE, OUT, BUDGET, TOKEN })) if (!v) throw new Error(`missing --${k.toLowerCase()}`)

// Import the measurement worktree's OWN factory (never the lane checkout's).
const libRoot = join(WORKTREE, 'tests', 'world-factory', 'lib')
const { TestWorldFactory, stableInstanceProbe, homesCensus, authenticate, utcStamp } = await import(`file://${libRoot}/world-factory.mjs`)
const { createRunRecord, formatSummary, exitCodeFor, readAuthorityBinding } = await import(`file://${libRoot}/run-record.mjs`)
const { scanAllLeases, pidAlive } = await import(`file://${libRoot}/port-lease.mjs`)
const { portInUse } = await import(`file://${WORKTREE}/tests/characterization/lib/util.mjs`)

const now = () => new Date().toISOString()
const stamp = utcStamp()
const runId = `${TOKEN}-${stamp}`
const log = (m) => console.log(`[${now()}] ${TOKEN}: ${m}`)
const load = () => readFileSync('/proc/loadavg', 'utf8').trim()

const envShots = []
const envShot = async (phase) => {
  const s = {
    at: now(), phase,
    loadavg: load(),
    stable3080: await stableInstanceProbe(),
    realDshHome: (() => { try { const st = statSync(join(homedir(), '.dsh')); return { mtimeMs: st.mtimeMs, mtime: st.mtime.toISOString() } } catch (e) { return { error: String(e?.code ?? e) } } })(),
    diskAvailKb: Number(spawnSync('df', ['--output=avail', '-k', '/srv/workspace'], { encoding: 'utf8' }).stdout.split('\n')[1]?.trim() ?? -1),
  }
  envShots.push(s)
  return s
}

const pre = await envShot('pre')
log(`env pre: load=${pre.loadavg} :3080=${JSON.stringify(pre.stable3080)} ~/.dsh=${JSON.stringify(pre.realDshHome)}`)

const teamSha = spawnSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
const factory = new TestWorldFactory({ repoRoot: WORKTREE, evidenceRoot: OUT })
const leaseRootProved = {
  leaseRoot: factory.leaseRoot,
  expectedMainHoist: '/srv/workspace/dsh-plugins/dsh-agent-team/.artifacts/tmp/port-leases',
  hoisted: factory.leaseRoot === '/srv/workspace/dsh-plugins/dsh-agent-team/.artifacts/tmp/port-leases',
}
log(`leaseRoot = ${leaseRootProved.leaseRoot} (hoisted=${leaseRootProved.hoisted})`)

const SELECTED = ['host-base-pre', 'sandbox-preflight', 'budget-line-before-spawn', 'boot', 'token-gate-401', 'auth-303', 'readiness-200', 'lease-capture', 'overlap-window', 'teardown', 'host-base-post', 'ports-released', 'leases-released', 'home-removed', 'stable-3080-untouched', 'real-dsh-home-untouched']
const record = createRunRecord({
  runId, suite: 'u7r3-xval-parallel-validation (NO-ACCEPTANCE-CREDIT)',
  selectedCases: SELECTED,
  ledgerPath: BUDGET,
  bindings: {
    teamSha, worktree: WORKTREE, token: TOKEN, phase: PHASE,
    hostTree: factory.hostTree,
    hostBase: factory.assertHostBase('pre-bindings'),
    leaseRoot: leaseRootProved,
    homeRoot: factory.homeRoot,
    authority: readAuthorityBinding(WORKTREE),
    worldIds: [],
    noAcceptanceCredit: true,
  },
})
factory.bindRunRecord(record)
const hostBasePre = factory.assertHostBase('host-base-pre')
record.addCase('host-base-pre', 'PASS', hostBasePre)

let preflight = null
try {
  preflight = await factory.preflightHostSandbox({})
  record.addCase('sandbox-preflight', ['full', 'partial'].includes(preflight.backend) ? 'PASS' : 'ENV_BLOCK', { backend: preflight.backend })
} catch (error) {
  record.addCase('sandbox-preflight', 'FAIL', { code: error?.code ?? null, error: String(error?.message ?? error), assetSource: process.env.DSH_TEAM_SANDBOX_ASSET_SOURCE })
  finish()
}

const world = await factory.createWorld({ line: LINE })
record.record.bindings.worldIds.push(world.id)
log(`world ${world.id} home=${world.home}`)

// Crash guard: an unexpected throw may NEVER leak a booted world — teardown
// first, then finalize the RUN record (the attempt-1 lesson: a post-spawn
// probe crash consumed a budget line and orphaned a World until reclaimWorld).
let crashed = false
const fatal = async (err) => {
  if (crashed) return
  crashed = true
  log(`FATAL: ${String(err?.stack ?? err).split('\n').slice(0, 4).join(' | ')}`)
  record.addCase('probe-crash', 'FAIL', { error: String(err?.message ?? err), stack: String(err?.stack ?? '').split('\n').slice(0, 6) })
  try { await world.teardown() } catch { /* best effort */ }
  finish()
}
process.on('uncaughtException', fatal)
process.on('unhandledRejection', fatal)

// Idle decide: the probe never prompts; any unexpected model request is
// recorded and answered with a plain text completion.
const decide = ({ seq }) => ({
  id: `chatcmpl-xval-${seq}`, object: 'chat.completion', model: 'xval-idle',
  choices: [{ index: 0, message: { role: 'assistant', content: 'xval-idle' }, finish_reason: 'stop' }],
})
await world.startMock({ decide })

// BUDGET LINE BEFORE THE SPAWN (pre-registration law): the shared ledger line
// is appended here, then verified on disk, before startHost is entered.
const budgetBefore = existsSync(BUDGET) ? readFileSync(BUDGET, 'utf8').split('\n').filter((l) => l.trim() !== '').length : 0
const startEntry = record.logHostStart({ world: world.id, phase: PHASE, token: TOKEN, worktree: WORKTREE, hostTree: factory.hostTree, teamSha })
const budgetAfter = readFileSync(BUDGET, 'utf8').split('\n').filter((l) => l.trim() !== '').length
record.addCase('budget-line-before-spawn', budgetAfter === budgetBefore + 1 ? 'PASS' : 'FAIL', { budgetLineCount: budgetAfter, entry: startEntry, wroteAt: startEntry.at, spawnedAt: null })

const t0 = Date.now()
let boot = null
try {
  boot = await world.startHost({ bootTimeoutMs: BOOT_TIMEOUT_MS })
} catch (error) {
  record.addCase('boot', 'START_FAILED', { error: String(error?.message ?? error), bootMs: Date.now() - t0, logTail: world.receipts.notes })
  try { await world.teardown() } catch { /* receipts best effort */ }
  finish()
}
const bootMs = Date.now() - t0
record.getCase('budget-line-before-spawn').spawnedAt = now()
record.addCase('boot', 'PASS', {
  port: boot.port, bootMs, logPath: boot.logPath,
  hostPid: world.instance?.child?.pid ?? null,
  redacted: boot.redacted,
})
log(`booted port=${boot.port} in ${bootMs}ms pid=${world.instance?.child?.pid}`)

// ---- public readiness witness -------------------------------------------
const origin = `http://127.0.0.1:${boot.port}`
const noTok = await fetch(`${origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).then((r) => r.status).catch(() => 0)
record.addCase('token-gate-401', noTok === 401 ? 'PASS' : 'FAIL', { status: noTok })
let cookie = null
let authStatus = 0
try {
  cookie = await authenticate(origin, world.token)
  authStatus = 303
  record.addCase('auth-303', 'PASS', { via: 'authenticate(): GET /?token -> 303 + set-cookie' })
} catch (error) {
  record.addCase('auth-303', 'FAIL', { error: String(error?.message ?? error) })
}
let authedStatus = 0
let authedBytes = 0
if (cookie !== null) {
  const r = await fetch(`${origin}/`, { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(10_000) })
  authedStatus = r.status
  authedBytes = (await r.text()).length
}
record.addCase('readiness-200', authedStatus === 200 ? 'PASS' : (authedStatus === 404 ? 'ENV_BLOCK' : 'FAIL'), { status: authedStatus, bytes: authedBytes, disclosure: authedStatus === 404 ? 'apps/web/dist absent in this runtime build (TEST_METHODS 2.3): token-authed GET serves 404; 401/303 gates still prove the web surface' : null })

// ---- capture: ports, leases, home, logs ----------------------------------
const leaseEntries = scanAllLeases(factory.leaseRoot).filter((l) => l.by?.world === world.id)
const capture = {
  world: world.id, home: world.home, workspaceDir: world.workspaceDir, logDir: world.logDir,
  instanceLog: boot.logPath, hostPort: boot.port, mockPort: world.mockLease?.port ?? null,
  leaseEntries: leaseEntries.map((l) => ({ port: l.port, file: l.fileName, alive: l.alive, purpose: l.by?.purpose })),
  dshHomeUnderOwnWorktree: world.home.startsWith(join(WORKTREE, 'tests', 'homes')),
  tokenFingerprint: world.receipts.booted.at(-1)?.tokenFingerprint ?? 'absent',
}
record.addCase('lease-capture', leaseEntries.length >= 1 ? 'PASS' : 'FAIL', capture)

// ---- rendezvous / hold: the concurrency window ------------------------------
// Modes: (1) PEER set = two worlds held up simultaneously (P0 core);
//        (2) HOLD_UNTIL only = world stays up while external work co-rotates (P2);
//        (3) neither = SKIP.
if (RENDEZVOUS !== null || HOLD_UNTIL !== null) {
  if (RENDEZVOUS !== null) writeFileSync(join(RENDEZVOUS, `${TOKEN}.up.json`), JSON.stringify({ token: TOKEN, world: world.id, port: boot.port, mockPort: capture.mockPort, home: world.home, at: now(), teamSha }, null, 2) + '\n')
  const deadline = Date.now() + RENDEZVOUS_TIMEOUT_MS
  let peer = null
  let holdDone = HOLD_UNTIL === null
  const samples = []
  let timedOut = false
  for (;;) {
    if (PEER !== null && peer === null && existsSync(join(RENDEZVOUS, `${PEER}.up.json`))) peer = JSON.parse(readFileSync(join(RENDEZVOUS, `${PEER}.up.json`), 'utf8'))
    if (!holdDone && existsSync(HOLD_UNTIL)) holdDone = true
    if ((PEER === null || peer !== null) && holdDone) { samples.push(await witness()); break }
    if (Date.now() > deadline) { timedOut = true; break }
    samples.push(await witness())
    await new Promise((r) => setTimeout(r, 1000))
  }
  async function witness() {
    const mine = await fetch(`${origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(5000) }).then((r) => r.status).catch(() => 0)
    const theirs = peer === null ? null : await fetch(`http://127.0.0.1:${peer.port}/`, { redirect: 'manual', signal: AbortSignal.timeout(5000) }).then((r) => r.status).catch(() => 0)
    return { at: now(), mine, theirs, loadavg: load() }
  }
  if (timedOut) {
    record.addCase('overlap-window', 'TIMEOUT', { waitedMs: RENDEZVOUS_TIMEOUT_MS, peer: PEER, holdUntil: HOLD_UNTIL, note: 'peer/hold condition never satisfied' })
  } else if (PEER !== null) {
    const distinct = {
      portsDistinct: peer.port !== boot.port, mockPortsDistinct: peer.mockPort !== capture.mockPort,
      homesDistinct: peer.home !== world.home, teamShasSame: peer.teamSha === teamSha,
    }
    writeFileSync(join(OUT, `OVERLAP-${TOKEN}.json`), JSON.stringify({ self: capture, peer, samples, distinct, window: { overlapSamples: samples.length, bothUpSince: peer.at } }, null, 2) + '\n')
    record.addCase('overlap-window', Object.values(distinct).every((v) => v) ? 'PASS' : 'FAIL', { peerToken: PEER, distinct, sampleCount: samples.length, firstSample: samples[0] ?? null, lastSample: samples.at(-1) ?? null })
  } else {
    writeFileSync(join(OUT, `CO-ROTATION-${TOKEN}.json`), JSON.stringify({ self: capture, samples, window: { samples: samples.length, holdMarker: HOLD_UNTIL } }, null, 2) + '\n')
    const all401 = samples.every((s) => s.mine === 401)
    record.addCase('overlap-window', all401 ? 'PASS' : 'FAIL', { kind: 'co-rotation hold (no peer world)', sampleCount: samples.length, all401, firstSample: samples[0] ?? null, lastSample: samples.at(-1) ?? null })
  }
} else {
  record.addCase('overlap-window', 'SKIP', { note: 'no rendezvous/hold requested' })
}

// ---- teardown + post-invariants -------------------------------------------
const receipts = await world.teardown({ keepHome: false })
record.addCase('teardown', receipts.host?.wasRunning === true ? 'PASS' : 'FAIL', { receipts: { killedPids: receipts.killedPids, releasedPorts: receipts.releasedPorts, homeDeleted: receipts.homeDeleted, notes: receipts.notes } })

const hostFree = !(await portInUse(boot.port))
const mockFree = capture.mockPort === null || !(await portInUse(capture.mockPort))
record.addCase('ports-released', hostFree && mockFree ? 'PASS' : 'FAIL', { hostPort: boot.port, hostFree, mockPort: capture.mockPort, mockFree })
const leftover = scanAllLeases(factory.leaseRoot).filter((l) => l.by?.world === world.id)
record.addCase('leases-released', leftover.length === 0 ? 'PASS' : 'FAIL', { leftover: leftover.map((l) => `${l.port}:${l.fileName}`) })
const census = homesCensus(factory.homeRoot)
record.addCase('home-removed', !(world.id in census) ? 'PASS' : 'FAIL', { censusWorlds: Object.keys(census).filter((n) => n.startsWith(`u5${LINE}`)), leftoverHomes: Object.keys(census).filter((n) => n.startsWith(`u5${LINE}`)).length })

const post = await envShot('post')
const hostBasePost = factory.assertHostBase('host-base-post')
record.addCase('host-base-post', hostBasePost.head === hostBasePre.head ? 'PASS' : 'FAIL', { ...hostBasePost, pinned: hostBasePre.head })
record.addCase('sandbox-preflight-note', 'PASS', { note: 'preflight record in bindings' })
record.addCase('stable-3080-untouched', JSON.stringify(post.stable3080) === JSON.stringify(pre.stable3080) ? 'PASS' : 'FAIL', { pre: pre.stable3080, post: post.stable3080 })
record.addCase('real-dsh-home-untouched', JSON.stringify(post.realDshHome) === JSON.stringify(pre.realDshHome) ? 'PASS' : 'FAIL', { pre: pre.realDshHome, post: post.realDshHome })

function finish() {
  record.record.envShots = envShots
  record.record.bindings.preflight = preflight
  const out = record.write(join(OUT, `RUN-${TOKEN}.json`))
  console.log(formatSummary(record.record))
  console.log(`RUN record: ${out}`)
  process.exit(exitCodeFor(record.record))
}
finish()
