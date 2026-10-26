#!/usr/bin/env node
/**
 * u7-4a-jobs-suite.mjs — the STANDALONE U7-4a C2 live-host runner (tier C2).
 *
 * One process = ONE World = ONE host boot = one RUN record:
 *   run 1 (main)  : node tests/world-factory/u7-4a-jobs-suite.mjs --run-id <id>
 *   run 2 (plant) : node tests/world-factory/u7-4a-jobs-suite.mjs --run-id <id> --plant
 *
 * What it drives (the lifecycle is the proven runU6Jobs shape from
 * u5-canary-runner.mjs — factory.createWorld / startMock / startHost,
 * wake cadence, evidence, judge through the SHARED judgeU74a):
 *   boot (ONE host start, leased port from the factory — NEVER a hard-coded
 *   3180, NEVER :3080) -> p6t6 health + anchored Team session -> the
 *   additive /__u74a/controls canary row answers -> discovery ->
 *   builtinToolDeny computed from the OBSERVED surface -> team.create ->
 *   APPROVER (below) -> the wake lanes (bg / out / list / kill-live /
 *   kill-done / foreign-out / foreign-planted) -> the boot-root NATIVE ctl
 *   control leg -> evidence digest -> judge. PLANT mode runs only lane-bg
 *   and measures the byte-identical background-not-supported refusal.
 *
 * THE APPROVER (the ask lane is settled ONLY through PUBLIC seams): the
 * worker's governed `bash` takeover row is default:ask (A2C-1 grammar —
 * member templates carry no shell allow), so every governed background
 * birth pends a REAL durable Control row. The runner polls the governed
 * lane through its OWN read-only probe route (GET /__u74a/controls?session=
 * …, with the p6t6 observer as the disclosed fallback), and settles each
 * pending tool:bash row EXACTLY ONCE through the PUBLIC team.resolveControl
 * v4 remote seam — the very endpoint the GUI's human lane calls. No token
 * is invented anywhere: authentication rides the boot URL's token through
 * world-factory's authenticate/fetchJson, nothing else. Pending rows that
 * do NOT name bash are recorded as arming rows and NEVER touched (they are
 * disclosed in the evidence, unresolved).
 *
 * Budget law (plan U5 + this task): MAX ONE host boot per invocation
 * (record.logHostStart once; the shared ledger gate refuses a second
 * boot); total wall clock <= 12 min — on overrun the watchdog kills the
 * child, every wait clamps, partial evidence is written and the exit code
 * carries the leg statuses (never a silent pass: run-record finalize fails
 * closed on missing verdicts).
 *
 * Evidence: <runId>.u74a-evidence.json under the World logDir (the digest
 * the shared judge consumes) + the run record under the evidence dir; the
 * console transcript (case lines) is the parent's capture channel.
 *
 * Opt-in only: nothing under vitest roots collects this file.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRunControl } from '../kits/rc2-real-host-smoke/run-control.mjs'
import {
  TestWorldFactory,
  apiPrompt,
  authenticate,
  fetchJson,
  homesCensus,
  scrubProviderEnv,
  stableInstanceProbe,
} from './lib/world-factory.mjs'
import {
  remoteCall,
  hasMarker,
  surfaceNamesOf,
  toolMsgsOf,
  extractInstanceId,
  MANAGED_TOOL_NAMES,
  SAFE_UNMANAGED_TOOL_NAMES,
} from './lib/u6-fs-assembly.mjs'
import { toolExchanges, laneTranscript } from './lib/u6-jobs-assembly.mjs'
import {
  createU74aAssembly,
  makeU74aDecide,
  judgeU74a,
  U74A_MAIN_CASES,
  U74A_PLANT_CASES,
  U74A_PLANTED_JOB_ID,
} from './lib/u74a-jobs-assembly.mjs'
import { findTestRepoRoot, testUseTree } from '../paths.mjs'
import { createRunRecord, exitCodeFor, formatSummary } from './lib/run-record.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const BUDGET_MS = 12 * 60_000
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/

function usageExit(msg) {
  console.error(msg)
  console.error('usage: node tests/world-factory/u7-4a-jobs-suite.mjs --run-id <id> [--plant] [--keep]')
  console.error('       [--evidence <dir>] [--budget-ledger <jsonl>] [--max-host-starts 1] [--line <name>]')
  process.exit(2)
}

function parseArgs(argv) {
  const opts = {
    runId: null,
    plant: false,
    keep: false,
    line: null,
    evidence: join(REPO_ROOT, '.artifacts', 'tmp', 'u74a-evidence'),
    budgetLedger: join(REPO_ROOT, '.artifacts', 'tmp', 'u74a-host-starts.jsonl'),
    maxHostStarts: 1,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--run-id') { i += 1; opts.runId = argv[i] ?? null }
    else if (a === '--plant') opts.plant = true
    else if (a === '--keep') opts.keep = true
    else if (a === '--line') { i += 1; opts.line = argv[i] ?? null }
    else if (a === '--evidence') { i += 1; opts.evidence = resolve(argv[i] ?? '') }
    else if (a === '--budget-ledger') { i += 1; opts.budgetLedger = resolve(argv[i] ?? '') }
    else if (a === '--max-host-starts') { i += 1; opts.maxHostStarts = Number(argv[i]) }
    else usageExit(`unknown argument: ${String(a)}`)
  }
  if (opts.runId === null || !RUN_ID_RE.test(opts.runId)) usageExit('a --run-id matching ^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$ is required')
  if (!Number.isInteger(opts.maxHostStarts) || opts.maxHostStarts < 1) usageExit('--max-host-starts must be a positive integer')
  if (opts.line !== null && !/^[a-z0-9-]{1,24}$/.test(opts.line)) usageExit('--line must match /^[a-z0-9-]{1,24}$/')
  if (opts.line === null) opts.line = opts.plant ? 'u74ap' : 'u74a'
  return opts
}

function git(args, cwd) {
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 15_000 })
    return r.status === 0 ? r.stdout.trim() : `error(${String(r.status)})`
  } catch (error) {
    return `error(${String(error?.message ?? error)})`
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const redact = (t) => String(t).replace(/\?token=[A-Za-z0-9_-]+/g, '?token=<redacted>').slice(0, 260)

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const { runId, plant, keep, line, evidence, budgetLedger, maxHostStarts } = opts
  mkdirSync(evidence, { recursive: true })
  const log = (msg) => console.log(`[u7-4a${plant ? '/plant' : ''}] ${msg}`)
  const CASE_IDS = [...(plant ? U74A_PLANT_CASES : U74A_MAIN_CASES), 'stable-instance-unchanged']
  const startedAt = Date.now()
  const GLOBAL_DEADLINE = startedAt + BUDGET_MS
  const clamp = (ms) => Math.max(2_000, Math.min(ms, GLOBAL_DEADLINE - Date.now() - 45_000))

  const hostRepoRoot = findTestRepoRoot(REPO_ROOT) ?? REPO_ROOT
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidence, hostTree: testUseTree(hostRepoRoot) })
  const hostBaseStartup = factory.assertHostBase('startup')
  const record = createRunRecord({
    runId,
    suite: 'u7-4a-jobs',
    selectedCases: CASE_IDS,
    ledgerPath: budgetLedger,
    bindings: {
      teamSha: git(['rev-parse', 'HEAD'], REPO_ROOT),
      hostSha: hostBaseStartup.head,
      plant,
      worldIds: [],
      leaseRoot: factory.leaseRoot,
      hostTree: factory.hostTree,
      provider: { kind: 'mock-deepseek', base: 'injected http://127.0.0.1:<leased-port>' },
      askLaneDisclosure: 'member bash asks settle EXACTLY ONCE through the PUBLIC team.resolveControl v4 remote seam (the GUI human-lane endpoint); discovery of pending rows rides this suite\'s read-only /__u74a/controls probe row with the p6t6 observer as disclosed fallback; no token invented, no private seam.',
    },
  })
  const done = new Set()
  const add = (id, verdict, detail = {}) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, verdict = 'FAIL', extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, verdict, { reason: why, ...extra })
    }
  }

  const rc = createRunControl({
    log,
    writeEvidence: (name, content) => writeFileSync(join(evidence, `${runId}.${name}`), JSON.stringify(content, null, 2) + '\n'),
    limits: {
      childLifetimeMs: BUDGET_MS,
      // 7 member lanes + leader chain + wake cadence (every wake is a real
      // mock request on the CREATE_ROOT session: cadence caps 20/lane x 9
      // lanes; normal runs land ~100-140). The proven u6-jobs tier was 100
      // for 3 lanes; this chain is ~2.5x wider.
      totalRequests: 240,
      perSessionRequests: 60,
      perScenarioRequests: 60,
      sameStateRepeats: 6,
      consecutiveMisses: 3,
    },
  })
  const uninstall = rc.installSignalHandlers()
  const hardWatchdog = setTimeout(() => rc.requestAbort('u74a wall-clock budget exceeded (12 min)'), BUDGET_MS)
  hardWatchdog.unref?.()

  // Host-start budget gate (MAX ONE boot per invocation; fail-closed BEFORE
  // any spawn). The parent runs run1 = main, run2 = --plant: separate
  // invocations, one ledger entry each.
  let refused = false
  if (record.ledgerStartCount() >= maxHostStarts) {
    refused = true
    failRest(`host-start budget ledger already holds ${String(record.ledgerStartCount())} >= ${String(maxHostStarts)} starts`, 'REFUSED')
  }

  const stablePre = await stableInstanceProbe()
  const homesPre = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const scrubbed = scrubProviderEnv()
  const worlds = []
  let digest = { plant, runId, laneDone: {} }

  try {
    if (!refused) {
      await drive()
    }
  } catch (error) {
    log(`suite unwind: ${String(error?.stack ?? error).split('\n').slice(0, 4).join(' | ')}`)
    record.record.suiteError = String(error?.stack ?? error).split('\n').slice(0, 6).join(' | ')
    failRest(`runner unwind: ${String(error?.message ?? error).slice(0, 160)}`)
  } finally {
    try { writeFileSync(join(worlds[worlds.length - 1]?.logDir ?? evidence, `${runId}.u74a-evidence.json`), JSON.stringify({ ...digest, record: record.record }, null, 2) + '\n') } catch (e) { log(`evidence write failed: ${String(e?.message ?? e)}`) }
    for (const world of worlds) {
      try { await world.teardown({ keepHome: keep }) } catch (error) { log(`teardown(${world.id}) failed: ${String(error?.message ?? error)}`) }
    }
    try { await rc.stopChild() } catch { /* idempotent */ }
    rc.dispose()
  }
  clearTimeout(hardWatchdog)

  // ── post-checks (u5 law): pristine host base, stable instance untouched ──
  try {
    record.record.hostBasePost = factory.assertHostBase('post')
  } catch (error) {
    record.record.hostBasePostError = String(error?.message ?? error)
  }
  const stablePost = await stableInstanceProbe()
  const homesPost = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  record.record.globalPostChecks = {
    stableInstance: { pre: stablePre.status, post: stablePost.status, reachablePre: stablePre.reachable, reachablePost: stablePost.reachable },
    envScrubbedKeys: scrubbed,
    homesNet: { pre: homesPre.length, post: homesPost.length },
  }
  add('stable-instance-unchanged',
    stablePre.status === stablePost.status && stablePre.reachable === stablePost.reachable ? 'PASS' : 'FAIL',
    { status: stablePost.status, note: `read-only probe of :${String(3080)} before/after (never touched beyond the probe)` })

  const rec = record.finalize()
  record.write(join(evidence, `${runId}.u74a-run-record.json`))
  console.log(formatSummary(rec))
  process.exit(exitCodeFor(rec))

  // ─────────────────────────────────────────────────────────────────────────
  async function drive() {
    // ── materialize + boot (ONE host start; factory leases the port) ──────
    const world = await factory.createWorld({ line, u6Jobs: { rows: [] } })
    worlds.push(world)
    record.record.bindings.worldIds.push(world.id)
    const assembly = createU74aAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir, plant })
    assembly.writePreBootFiles()
    world.u6Jobs.rows.push(...assembly.teamRows())
    await world.startMock({ decide: makeU74aDecide({ assembly, plant }) })
    record.logHostStart({ world: world.id, phase: plant ? 'u74a-plant-boot1' : 'u74a-boot1' })
    rc.arm()
    const startPromise = world.startHost()
    const child = world.instance?.child ?? null
    if (child !== null) rc.bindChild(child, { lifetimeMs: BUDGET_MS, processGroup: false })
    let boot
    try {
      boot = await startPromise
    } catch (error) {
      failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`, 'START_FAILED')
      return
    }
    record.record.boots = [{ phase: plant ? 'u74a-plant-boot1' : 'u74a-boot1', world: world.id, port: boot.port, logPath: boot.logPath }]
    const origin = `http://127.0.0.1:${boot.port}`
    const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null
    const waitA = async (predicate, timeoutMs) => {
      const t0 = Date.now()
      const deadline = clamp(timeoutMs)
      for (;;) {
        let hit = false
        try { hit = (await predicate()) === true } catch { hit = false }
        if (hit) return { hit: true, waitedMs: Date.now() - t0 }
        if (Date.now() - t0 >= deadline) return { hit: false, waitedMs: Date.now() - t0 }
        await sleep(400)
      }
    }
    digest.worldId = world.id
    digest.logPath = boot.logPath

    const kernelHits = () => {
      const pats = ['a5g7: placement-feed rows=', 'job_output', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED',
        'PLANE_KERNEL_UNAVAILABLE', 'PLANE_JOBS_REGISTRATION_REFUSED', 'PLANE_PROCESS_REGISTRATION_REFUSED',
        'a5bg: producer-mounted', 'a5bg: attributed hostJobId=', 'a5bg:']
      let text = ''
      try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
      const out = {}
      for (const p of pats) {
        const lines = text.split('\n').filter((l) => l.includes(p))
        out[p] = { count: lines.length, sample: lines.length > 0 ? redact(lines[lines.length - 1]) : null }
      }
      return out
    }

    // ── readiness: p6t6 health + the anchored Team session + the canary ────
    let health = null
    const healthW = await waitA(async () => {
      health = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      return health.status === 200 && (health.body?.ok === true || health.body?.ok === false)
    }, 120_000)
    if (!healthW.hit || health?.body?.ok !== true) {
      failRest(`p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}`)
      return
    }
    let stateBody = null
    const stateW = await waitA(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      stateBody = st.body
      return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
    }, 90_000)
    if (!stateW.hit) {
      failRest('anchored Team session never appeared (state probe timed out; state.rootSessionId must equal assembly.ROOT and teamSession must be present)')
      return
    }
    const teamSessionId = assembly.CREATE_ROOT
    digest.teamSessionId = teamSessionId
    const probe0 = await fetchJson(`${origin}/__u74a/controls?session=${encodeURIComponent(assembly.ROOT)}`, undefined, 20_000)
    if (probe0.status !== 200 || probe0.body?.ok !== true) {
      failRest(`the /__u74a/controls probe row never answered ok (status=${String(probe0.status)} body=${JSON.stringify(probe0.body ?? null).slice(0, 200)}) — the canary row is not mounted`)
      return
    }
    digest.canaryMount = { status: probe0.status, requests: (probe0.body?.requests ?? []).length }

    // ── discovery -> deny list from the OBSERVED surface -> team.create ────
    const cookie = await authenticate(origin, world.token)
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u74a-disc')
    if (discPrompt.status !== 200) {
      failRest(`discovery prompt rejected: ${String(discPrompt.status)}`)
      return
    }
    const discW = await waitA(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), 150_000)
    if (!discW.hit) {
      failRest('discovery model request absent (deny list cannot be computed)', 'FAIL', { mockDigest: world.mockRequestDigest().slice(-6) })
      return
    }
    const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
    const surface = [...new Set(disc)].sort()
    const denyList = surface.filter((n) => !n.startsWith('team_')
      && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n)
      && !['job_output', 'job_list', 'job_kill'].includes(n))
    assembly.writeMainBlueprint(denyList)
    digest.surface = { surfaceCount: surface.length, denyList }
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } }, 'u74a')
    if (!(created.status === 200 && created.body?.result?.ok === true)) {
      failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
      return
    }

    // ── APPROVER (public seams only; each pending bash row resolved ONCE) ──
    const askLedger = new Map()
    const armingRows = []
    const armingSeen = new Set()
    const resolvedOrder = []
    let approverStop = false
    let pollTick = 0
    const approver = (async () => {
      while (!approverStop && Date.now() < GLOBAL_DEADLINE) {
        try {
          const rows = new Map()
          for (const sid of [assembly.ROOT, assembly.CREATE_ROOT]) {
            const st = await fetchJson(`${origin}/__u74a/controls?session=${encodeURIComponent(sid)}`, undefined, 20_000)
            if (st.status === 200 && st.body?.ok === true) {
              for (const r of (st.body.requests ?? [])) rows.set(String(r.requestId), r)
            }
          }
          // disclosed second reader: the p6t6 observer lane (the same
          // durable listControlState read; merged by requestId — reads
          // never settle, only the public v4 seam below does). Read at a
          // slower cadence on purpose: the /state projection is heavy and
          // PF-1 measured it can queue behind an active member turn (the
          // probe row is the light lane; this is the disclosed fallback).
          if (pollTick % 5 === 0) {
            const st6 = await fetchJson(`${origin}/__p6t6/state`, undefined, 15_000)
            for (const r of (st6.body?.control?.requests ?? [])) {
              if (!rows.has(String(r.requestId))) rows.set(String(r.requestId), r)
            }
          }
          pollTick += 1
          for (const r of rows.values()) {
            const id = String(r.requestId)
            if (String(r.status) !== 'pending') continue
            const tagText = `${String(r.toolName ?? '')} ${String(r.summary ?? '')}`
            if (!/\bbash\b/i.test(tagText)) {
              if (!armingSeen.has(id)) {
                armingSeen.add(id)
                armingRows.push({ requestId: id.slice(0, 60), toolName: r.toolName ?? null, summary: String(r.summary ?? '').slice(0, 140), targetInstanceId: r.targetInstanceId ?? null })
              }
              continue // never touch what this suite did not authorize
            }
            if (askLedger.has(id)) continue // EXACTLY ONCE — a seen row is never re-settled
            askLedger.set(id, { requestId: id.slice(0, 60), targetInstanceId: r.targetInstanceId == null ? null : String(r.targetInstanceId), resolutions: 0, ok: false, resolveStatus: null })
            resolvedOrder.push(id)
            const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
              { teamSessionId, requestId: id, decision: 'allow', note: 'u74a-c2-ask-approval' }, 'u74a-ask', 4)
            const row = askLedger.get(id)
            row.resolutions += 1
            row.resolveStatus = res?.status ?? null
            row.ok = res?.status === 200 && res?.body?.result?.ok === true
            row.bodyHead = JSON.stringify(res?.body?.error ?? res?.body?.result ?? null).slice(0, 220)
          }
        } catch { /* observational poll; the next tick retries */ }
        await sleep(1000)
      }
    })()

    // ── drive the lanes (wake cadence watches the DONE reply prefixes) ─────
    const replyPrefixSeen = (prefix) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith(prefix))
    const wake = async (tag) => {
      const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U74A_PHASE_${tag}`, 'u74a-wake')
      if (pr.status !== 200) log(`wake ${tag} rejected: status=${String(pr.status)}`)
    }
    const wakeCadence = async (prefix, deadlineMs, tag) => {
      const t0 = Date.now()
      let lastWake = 0
      let wakes = 0
      const deadline = clamp(deadlineMs)
      for (;;) {
        if (replyPrefixSeen(prefix)) return true
        if (Date.now() - t0 > deadline) return replyPrefixSeen(prefix)
        if (Date.now() - lastWake > 3000 && wakes < 20) { wakes += 1; lastWake = Date.now(); await wake(tag) }
        await sleep(350)
      }
    }
    digest.laneDone = {}
    digest.laneDone.bg = await wakeCadence('U74A_BG_DONE', 150_000, 'b')
    if (!plant) {
      digest.laneDone.out = await wakeCadence('U74A_OUT_DONE', 90_000, 'o')
      digest.laneDone.list = await wakeCadence('U74A_LIST_DONE', 90_000, 'l')
      digest.laneDone.killLive = await wakeCadence('U74A_KILLLIVE_DONE', 90_000, 'k')
      digest.laneDone.killDone = await wakeCadence('U74A_KILLDONE_DONE', 150_000, 'n')
      digest.laneDone.fout = await wakeCadence('U74A_FOUT_DONE', 150_000, 'f')
      digest.laneDone.fplant = await wakeCadence('U74A_FPLANT_DONE', 90_000, 'p')
      // CI-03 native control on the UNGOVERNED boot-root session.
      const pr = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.T_CTL, 'u74a-ctl')
      digest.laneDone.ctl = pr.status === 200
        && (await waitA(() => replyPrefixSeen('U74A_CTL_RAN'), 90_000)).hit
      digest.laneDone.leader = await wakeCadence('U74A_L1_DONE', 150_000, 'z')
      // (the DECISIVE late kill-read now rides the leader's follow-up
      // delegation after its own >35 s fence wait — see the
      // delegate-follow phase in u74a-jobs-assembly; the runner keeps the
      // chain awake with the wake cadence, nothing else.)
    } else {
      digest.laneDone.leader = await wakeCadence('U74A_L1_DONE', 60_000, 'z')
    }
    await sleep(3_000)
    approverStop = true
    try { await approver } catch { /* observational */ }

    // ── evidence (DISK / HOST LOG / mock corpus; the judge stays pure) ─────
    const requests = world.mock?.requests ?? []
    const laneT = (tok) => laneTranscript(requests, `[team-work requestToken=${assembly.tokens(tok)}`)
    const laneEx = (tok) => { const r = laneT(tok); return r === null ? [] : toolExchanges(r) }
    const firstNamed = (ex, name) => (ex.find((e) => e.name === name) ?? { result: null }).result
    const firstJobId = (text) => {
      const m = /started background job ([A-Za-z0-9][A-Za-z0-9_.-]{2,})/.exec(String(text))
      return m === null ? null : m[1]
    }
    const bgEx = laneEx('d-bg')
    const bgReceipt = firstNamed(bgEx, 'bash')
    const jobId = firstJobId((bgEx[0]?.result ?? '') + String(bgReceipt ?? ''))
    digest.claims = assembly.claims
    digest.jobIds = jobId === null ? [] : [jobId]
    digest.bgReceipt = bgReceipt
    if (!plant) {
      digest.outResult = firstNamed(laneEx('d-out'), 'job_output')
      const listEx = laneEx('d-list')
      digest.listResult = firstNamed(listEx, 'job_list')
      digest.listJobId = firstJobId(listEx.map((e) => e.result).join('\n'))
      const klEx = laneEx('d-kl')
      digest.killLiveJobId = firstJobId(klEx.map((e) => e.result).join('\n'))
      digest.killLiveKill = firstNamed(klEx, 'job_kill')
      const klOuts = klEx.filter((e) => e.name === 'job_output').map((e) => e.result)
      digest.killLiveOutEarly = klOuts[0] ?? null
      digest.killLiveOutLate = klOuts.length >= 2 ? klOuts[1] : null
      const kdEx = laneEx('d-kd')
      digest.killDoneJobId = firstJobId(kdEx.map((e) => e.result).join('\n'))
      digest.killDoneOutput = firstNamed(kdEx, 'job_output')
      digest.killDoneKill = firstNamed(kdEx, 'job_kill')
      digest.foreignOut = firstNamed(laneEx('d-fout'), 'job_output')
      digest.foreignPlanted = firstNamed(laneEx('d-fplant'), 'job_output')
      const cReq = laneTranscript(requests, assembly.markers.T_CTL)
      digest.ctlResult = cReq === null ? null : firstNamed(toolExchanges(cReq), 'bash')
      digest.rootKernelMentions = cReq === null ? -1
        : ((JSON.stringify(cReq?.body?.messages ?? cReq?.messages ?? []).match(/a5bg|a5jobs|a5-plane|placement-feed|kernelGuard/gi) ?? []).length)
      // every instance id the corpus ever saw (creation-order set, for the
      // ask-row target check)
      const memberIds = new Set()
      for (const r of requests) {
        for (const t of toolMsgsOf(r)) {
          const inst = extractInstanceId(t.text)
          if (inst !== null) memberIds.add(String(inst))
        }
      }
      digest.memberIds = [...memberIds]
    }
    digest.kernelHits = kernelHits()
    let hostLogText = ''
    try { hostLogText = readFileSync(boot.logPath, 'utf8') } catch { /* unreadable */ }
    digest.attributedLog = hostLogText.split('\n').filter((l) => l.includes('a5bg: attributed hostJobId=')).map((l) => redact(l))
    const settleEvents = (id, re = /cancel|abort|kill|terminat|settl/i) => id === null || id === undefined ? 0
      : hostLogText.split('\n').filter((l) => l.includes(String(id)) && re.test(l)).length
    digest.settle = {
      killLiveLines: settleEvents(digest.killLiveJobId ?? null),
      plantedLines: settleEvents(U74A_PLANTED_JOB_ID),
    }
    digest.startedJobReceipts = (JSON.stringify(requests.map((r) => r?.body?.messages ?? [])).match(/started background job/g) ?? []).length
    digest.askRows = [...askLedger.values()]
    digest.askResolutionsTotal = digest.askRows.reduce((n, r) => n + (r.resolutions ?? 0), 0)
    digest.armingRows = armingRows.slice(0, 8)
    // control-lane census: rows naming any trio name = second-ledger smell
    const finalCtl = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const allCtlRows = (finalCtl.body?.control?.requests ?? []).map((r) => ({
      toolName: r.toolName ?? null,
      summary: String(r.summary ?? '').slice(0, 120),
      status: String(r.status ?? ''),
    }))
    digest.controlRowsTotal = allCtlRows.length
    digest.trioControlRows = allCtlRows.filter((r) => /job_(output|list|kill)/.test(`${r.toolName ?? ''} ${r.summary}`))
    digest.hostAlive = hostAlive()

    const alive = hostAlive()
    const verdicts = judgeU74a(digest, alive)
    for (const [id, verdict, detail] of verdicts) add(id, verdict, { laneDone: digest.laneDone, ...(detail ?? {}) })
    if (!alive) failRest('host died during the run')
    log(`attributed host lines: ${String(digest.attributedLog.length)}; ask rows: ${String(digest.askRows.length)}; kernelHits job_output: ${String(digest.kernelHits['job_output']?.count ?? 0)}`)
    for (const l of digest.attributedLog.slice(0, 4)) log(`hostlog: ${redact(l)}`)
  }
}

main().catch((error) => {
  console.error(`FATAL: ${String(error?.stack ?? error)}`)
  process.exit(2)
})
