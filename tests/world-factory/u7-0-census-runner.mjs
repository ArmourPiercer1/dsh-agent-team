/**
 * u7-0-census-runner.mjs — the U7-0 (EB2-A) C2 live-census runner.
 *
 * EXACTLY TWO HOST BOOTS (hard budget, fail-closed BEFORE any spawn):
 *   boot 1 — non-Team World: the census row mounted beside the canary;
 *            a real session turn drives `u7_census {snapshot, tag:live1}`
 *            (public model lane; the tool call IS the drive);
 *   boot 2 — governed-Team World (production Team row, enforcing plane,
 *            anchor blueprint): the leader chain creates one worker, then
 *            takes the census (`tag:team-live`) — the team lane is a REAL
 *            governed lane (plane takeover rows armed); auto-snapshot arms
 *            backstop the model legs; the transcript is never evidence.
 *
 * Outputs (all under --evidence, small JSON): the two ObservedRuntime-
 * Inventory snapshots (pinned digests), the three-way reconcile verdicts,
 * and a RUN record (boots, ports, receipts, leak check). Nothing in the
 * product tree is touched; hosts run ONLY on the 3180-family leased ports
 * through the world-factory (the :3080 stable instance is probed
 * read-only before/after and must be unchanged).
 *
 * Usage:
 *   node tests/world-factory/u7-0-census-runner.mjs \
 *     [--line u7c] [--evidence <dir>] [--budget-ledger <file>] \
 *     [--max-host-starts 2] [--keep-home]
 *
 * @module tests/world-factory/u7-0-census-runner
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRunControl } from '../kits/rc2-real-host-smoke/run-control.mjs'
import { portInUse } from '../characterization/lib/util.mjs'
import {
  TestWorldFactory,
  apiPrompt,
  apiSessionCreate,
  authenticate,
  homesCensus,
  scrubProviderEnv,
  stableInstanceProbe,
} from './lib/world-factory.mjs'
import { createCensusTeamAssembly, makeCensusDecide, buildInventoryFromLedger, reconcileWorld, readLedgerRows } from './lib/u7-census-assembly.mjs'
import { findTestRepoRoot, testUseTree, TEST_USE_BASELINE_SHA } from '../paths.mjs'
import { pidAlive, scanAllLeases } from './lib/port-lease.mjs'
import { createRunRecord, exitCodeFor, formatSummary } from './lib/run-record.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const RUN_LIFETIME_MS = 8 * 60_000
const CASE_WAIT_MS = 150_000

function parseArgs(argv) {
  const out = { line: 'u7c', evidence: null, budgetLedger: null, maxHostStarts: 2, keepHome: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--line') out.line = String(argv[++i])
    else if (a === '--evidence') out.evidence = resolve(String(argv[++i]))
    else if (a === '--budget-ledger') out.budgetLedger = resolve(String(argv[++i]))
    else if (a === '--max-host-starts') out.maxHostStarts = Number(argv[++i])
    else if (a === '--keep-home') out.keepHome = true
    else throw new Error(`unknown argument: ${a}`)
  }
  if (!Number.isInteger(out.maxHostStarts) || out.maxHostStarts < 1) throw new Error('--max-host-starts must be a positive integer')
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitUntil(predicate, { timeoutMs, intervalMs = 2000 } = {}) {
  const started = Date.now()
  for (;;) {
    let hit = false
    try { hit = predicate() === true } catch { hit = false }
    if (hit) return { hit: true, waitedMs: Date.now() - started }
    if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
    await sleep(intervalMs)
  }
}

function findFirstKey(value, key) {
  if (value === null || typeof value !== 'object') return undefined
  if (!Array.isArray(value) && typeof value[key] === 'string') return value[key]
  for (const inner of Object.values(value)) {
    const got = findFirstKey(inner, key)
    if (got !== undefined) return got
  }
  return undefined
}

/** The census ledger fact the run stands on (sync read; poll wrapper). */
function censusFacts(path) {
  const rows = readLedgerRows(path)
  const snaps = rows.filter((r) => r?.leg === 'census-snapshot' && Array.isArray(r.scopes))
  const teamScoped = snaps.filter((r) => r.scopes.some((s) => s.team_lane === true))
  return {
    mounted: rows.some((r) => r?.leg === 'probe-mounted'),
    applied: rows.some((r) => r?.leg === 'plugin-apply'),
    registerOk: rows.some((r) => r?.leg === 'register' && r.ok === true),
    seamRefusals: rows.filter((r) => String(r?.leg ?? '').includes('refused') || String(r?.leg ?? '').endsWith('-error')).length,
    snapshotCount: snaps.length,
    teamLaneSnapshots: teamScoped.length,
    agentLanes: snaps.length > 0 ? Math.max(...snaps.map((r) => r.scopes.filter((s) => s.kind === 'agent').length)) : 0,
    tags: snaps.map((r) => String(r.tag ?? '')),
  }
}

async function runCensus(opts) {
  const { line, evidence, budgetLedger, maxHostStarts, keepHome } = opts
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-')
  const evRoot = evidence ?? join(REPO_ROOT, '.artifacts', 'tmp', 'u7-0-census-live', runStamp)
  mkdirSync(evRoot, { recursive: true })
  const runId = `u7-0-census-${runStamp}`
  const log = (m) => console.log(`[u7c] ${m}`)

  const factory = new TestWorldFactory({
    repoRoot: REPO_ROOT,
    evidenceRoot: evRoot,
    hostTree: testUseTree(findTestRepoRoot(REPO_ROOT) ?? REPO_ROOT),
  })
  const record = createRunRecord({
    runId,
    suite: 'u7-0-census',
    selectedCases: ['c2-non-team', 'c2-governed-team', 'reconcile', 'leak-check', 'stable-instance-unchanged'],
    ledgerPath: budgetLedger ?? join(evRoot, `${runId}.host-starts.jsonl`),
    bindings: {
      // m4 (review-R1): source identity of THIS repo at run time (U7-PLAN
      // exit evidence wants the source digest, not an empty field).
      teamSha: process.env.U7C_TEAM_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: factory.hostTree,
      leaseRoot: factory.leaseRoot,
      maxHostStarts,
      provider: { kind: 'mock-deepseek', base: 'injected http://127.0.0.1:<leased-port>' },
      worldIds: [],
      disclosure: 'The pristine host base is the main checkout tests/deepseek-harness-test-use tree, mounted READ-ONLY through the factory (HEAD/porcelain asserted before every spawn). Worlds live under tests/homes/<world>; ports 3180-family via leases; the census row registers ONE tool and reads only public seams.',
    },
  })

  // u7-sbx: the native-sandbox pre-flight is bound into this record too.
  factory.bindRunRecord(record)
  const rc = createRunControl({
    log,
    writeEvidence: (name, content) => { writeFileSync(join(evRoot, `${runId}.${name}`), JSON.stringify(content, null, 2) + '\n') },
    limits: { childLifetimeMs: RUN_LIFETIME_MS, totalRequests: 40, perSessionRequests: 12, perScenarioRequests: 12, sameStateRepeats: 5, consecutiveMisses: 3 },
  })
  const uninstall = rc.installSignalHandlers()
  const hardWatchdog = setTimeout(() => rc.requestAbort('hard run watchdog exceeded'), RUN_LIFETIME_MS)
  hardWatchdog.unref?.()

  const stablePre = await stableInstanceProbe()
  const homesPre = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const scrubbed = scrubProviderEnv()
  log(`provider env scrubbed: ${JSON.stringify(scrubbed)}`)

  if (record.ledgerStartCount() >= maxHostStarts) {
    const CASE_IDS = ['c2-non-team', 'c2-governed-team', 'reconcile', 'leak-check', 'stable-instance-unchanged']
    for (const id of CASE_IDS) record.addCase(id, 'FAIL', { reason: `host-start budget exhausted BEFORE any spawn (ledger has ${String(record.ledgerStartCount())} >= ${String(maxHostStarts)})` })
    record.finalize(); record.write(join(evRoot, `${runId}.RUN.json`))
    return { record, evRoot, inventories: null }
  }

  const worlds = []
  const inventories = {}
  const verdicts = {}
  try {
    // ── boot 1: non-Team World ──────────────────────────────────────────────
    factory.assertHostBase('boot1-pre')
    const w1 = await factory.createWorld({ line: `${line}a`, u7Census: { rows: [], autoSnapshotMs: [25000, 45000] } })
    worlds.push(w1)
    record.record.bindings.worldIds.push(w1.id)
    await w1.startMock({ decide: makeCensusDecide({ rootSessionId: 'unused-non-team' }) })
    record.logHostStart({ world: w1.id, phase: 'c2-non-team' })
    rc.arm()
    const p1 = w1.startHost()
    if (w1.instance?.child) rc.bindChild(w1.instance.child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
    const boot1 = await p1
    log(`boot1 ${w1.id} port ${String(boot1.port)} home ${w1.home}`)
    const origin1 = `http://127.0.0.1:${String(boot1.port)}`
    const cookie1 = await authenticate(origin1, w1.token)
    const created = await apiSessionCreate(origin1, cookie1, w1.workspaceDir, `u7c-${line}`)
    if (created.status !== 200) throw new Error(`session/create ${String(created.status)}: ${JSON.stringify(created.body ?? '').slice(0, 200)}`)
    const sessionId = findFirstKey(created.body, 'sessionId')
    await apiPrompt(origin1, cookie1, sessionId, 'u7-0 census live snapshot please', `u7c-${line}`)
    const f1 = await waitUntil(() => censusFacts(w1.u7cLedgerPath).tags.includes('live1'), { timeoutMs: CASE_WAIT_MS })
    const facts1 = censusFacts(w1.u7cLedgerPath)
    record.addCase('c2-non-team', f1.hit && facts1.mounted && facts1.registerOk && facts1.seamRefusals === 0 ? 'PASS' : 'FAIL', { tag: 'live1', waitedMs: f1.waitedMs, facts: facts1, sessionId })
    inventories.nonTeam = buildInventoryFromLedger({
      ledgerPath: w1.u7cLedgerPath, kind: 'non-team', hostSha: TEST_USE_BASELINE_SHA,
      worldId: w1.id, bootId: `${w1.id}/boot-1`, preferTag: 'live1', repoRoot: REPO_ROOT,
    })
    await w1.teardown({ keepHome })

    // ── boot 2: governed-Team World ─────────────────────────────────────────
    factory.assertHostBase('boot2-pre')
    if (record.ledgerStartCount() >= maxHostStarts) throw new Error('host-start budget exhausted before boot2 (law: ≤2 total)')
    const w2 = await factory.createWorld({ line: `${line}b`, u7Census: { rows: [], autoSnapshotMs: [30000, 60000] } })
    worlds.push(w2)
    record.record.bindings.worldIds.push(w2.id)
    const assembly = createCensusTeamAssembly({ repoRoot: REPO_ROOT, home: w2.home, workspaceDir: w2.workspaceDir, runStamp: w2.id, reportDir: w2.logDir })
    assembly.writePreBootFiles()
    w2.u7Census.rows.push(...assembly.rows())
    await w2.startMock({ decide: makeCensusDecide({ rootSessionId: assembly.ROOT }) })
    record.logHostStart({ world: w2.id, phase: 'c2-governed-team' })
    rc.arm()
    const p2 = w2.startHost()
    if (w2.instance?.child) rc.bindChild(w2.instance.child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
    const boot2 = await p2
    log(`boot2 ${w2.id} port ${String(boot2.port)}`)
    // The governed lanes materialize at BOOT (team row bootPhase create +
    // the leader chain's team_create_member); the census CALL itself rides
    // the boot-root session lane (legacy surface — the row tool is denied
    // on the governed leader surface by the alpha2 coverage law). Wait for
    // the unattended arm to prove the lanes exist, THEN drive the call.
    const f2pre = await waitUntil(() => censusFacts(w2.u7cLedgerPath).agentLanes >= 1, { timeoutMs: 90_000 })
    const origin2 = `http://127.0.0.1:${String(boot2.port)}`
    let teamLiveHit = false
    if (f2pre.hit) {
      const cookie2 = await authenticate(origin2, w2.token)
      const created2 = await apiSessionCreate(origin2, cookie2, w2.workspaceDir, `u7ct-${line}`)
      if (created2.status === 200) {
        const sessionId2 = findFirstKey(created2.body, 'sessionId')
        await apiPrompt(origin2, cookie2, sessionId2, 'u7-0 census live snapshot of the governed team world please', `u7ct-${line}`)
        const w = await waitUntil(() => censusFacts(w2.u7cLedgerPath).tags.includes('team-live'), { timeoutMs: CASE_WAIT_MS / 2 })
        teamLiveHit = w.hit
      }
    }
    const f2 = await waitUntil(() => {
      const facts = censusFacts(w2.u7cLedgerPath)
      return facts.teamLaneSnapshots >= 1 && facts.agentLanes >= 1
    }, { timeoutMs: CASE_WAIT_MS / 2 })
    const facts2 = censusFacts(w2.u7cLedgerPath)
    record.addCase('c2-governed-team', f2.hit && facts2.mounted && facts2.registerOk ? 'PASS' : 'FAIL', { waitedLanesMs: f2pre.waitedMs, teamLiveHit, waitedMs: f2.waitedMs, facts: facts2 })
    inventories.team = buildInventoryFromLedger({
      ledgerPath: w2.u7cLedgerPath, kind: 'governed-team', hostSha: TEST_USE_BASELINE_SHA,
      worldId: w2.id, bootId: `${w2.id}/boot-1`, preferTag: 'team-live', requiresTeamLane: true, repoRoot: REPO_ROOT,
    })
    await w2.teardown({ keepHome })

    // ── reconcile verdicts (offline; no boots) ──────────────────────────────
    try {
      verdicts.nonTeam = reconcileWorld({ repoRoot: REPO_ROOT, observed: inventories.nonTeam })
      verdicts.team = reconcileWorld({ repoRoot: REPO_ROOT, observed: inventories.team })
      // cross-boot baseline leg: boot2 vs boot1 — same host pin, different
      // boots: shape/source columns must stand; per-boot columns excluded.
      verdicts.teamVsNonTeam = reconcileWorld({ repoRoot: REPO_ROOT, observed: inventories.team, baseline: inventories.nonTeam })
      // M4 (review-R1): the reconcile case ASSERTS, it does not merely
      // record. The reviewed expectation sets below are the disclosed live
      // facts of this census (profile-gated host rows; blueprint-limited
      // leader grants; reviewed scope-mismatches) — the gate goes RED when
      // the live world drifts away from them, which is the point.
      const REVIEWED = {
        missingNonTeam: ['cordis_inspect_list', 'cordis_inspect_query', 'list_mcp_resource_templates', 'list_mcp_resources', 'list_subagent_models', 'lsp', 'plugin_manager', 'pwsh', 'read_mcp_resource', 'run_code', 'str_replace_editor'],
        missingTeam: ['cordis_inspect_list', 'cordis_inspect_query', 'list_mcp_resource_templates', 'list_mcp_resources', 'list_subagent_models', 'lsp', 'plugin_manager', 'pwsh', 'read_mcp_resource', 'run_code', 'str_replace_editor', 'team_archive_member', 'team_collect', 'team_delegate', 'team_follow_up', 'team_grant_permission', 'team_inspect_config', 'team_list_pending_control', 'team_list_templates', 'team_report_progress', 'team_request_control', 'team_resolve_control', 'team_revoke_permission', 'team_send_message'],
        unknownNonTeam: ['u5_canary', 'u7_census'],
        // edit/write/read_image: native REQUIRED observed on the governed
        // leader lane while the reviewed seeds say NO Team arm — reported
        // scope-mismatch (M3), reviewed & disclosed, never authorized.
        unknownTeam: ['edit', 'read_image', 'u5_canary', 'u7_census', 'write'],
      }
      const problems = []
      if (!inventories.team.scopes.some((s) => s.team_lane === true)) problems.push('governed-team inventory carries NO team_lane scope')
      if (!inventories.nonTeam.scopes.some((s) => s.kind === 'agent')) problems.push('non-team inventory carries NO agent scope')
      const eq = (xs, ys) => [...xs].sort().join(',') === [...ys].sort().join(',')
      if (!eq(verdicts.nonTeam.missing.map((m) => m.name), REVIEWED.missingNonTeam)) problems.push('non-team MISSING set differs from the reviewed set')
      if (!eq(verdicts.team.missing.map((m) => m.name), REVIEWED.missingTeam)) problems.push('team MISSING set differs from the reviewed set')
      if (!eq(verdicts.nonTeam.unknown.map((u) => u.name), REVIEWED.unknownNonTeam)) problems.push('non-team UNKNOWN set differs from the reviewed set')
      if (!eq(verdicts.team.unknown.map((u) => u.name), REVIEWED.unknownTeam)) problems.push('team UNKNOWN set differs from the reviewed set')
      for (const [k, v] of Object.entries({ nonTeam: verdicts.nonTeam, team: verdicts.team })) {
        if (v.counts.source_findings !== 0) problems.push(`${k}: source_findings must be 0 against the tracked pair (got ${v.counts.source_findings})`)
        if (v.drift.length !== 0) problems.push(`${k}: self-referenced leg must be drift-free (got ${v.drift.length})`)
        for (const u of v.unknown) if (u.authorized !== false) problems.push(`${k}: UNKNOWN row ${String(u.name)} without authorized:false`)
      }
      const perBoot = verdicts.teamVsNonTeam.drift.filter((d) => d.kind === 'definition-identity' || d.kind === 'revision')
      if (perBoot.length > 0) problems.push(`cross-boot leg carries per-boot drift kinds (${perBoot.length})`)
      record.addCase('reconcile', problems.length === 0 ? 'PASS' : 'FAIL', {
        problems,
        nonTeam: verdicts.nonTeam.counts, team: verdicts.team.counts,
        nonTeam_snapshot_digest: inventories.nonTeam.snapshot_digest,
        team_snapshot_digest: inventories.team.snapshot_digest,
        nonTeam_verdict_digest: verdicts.nonTeam.verdict_digest,
        team_verdict_digest: verdicts.team.verdict_digest,
        crossBoot: { drift: verdicts.teamVsNonTeam.counts.drift, kinds: [...new Set(verdicts.teamVsNonTeam.drift.map((d) => String(d.kind)))] },
      })
    } catch (error) {
      record.addCase('reconcile', 'FAIL', { error: String(error?.message ?? error).slice(0, 400) })
    }
  } catch (error) {
    log(`run unwind: ${String(error?.stack ?? error).slice(0, 600)}`)
    rc.requestAbort(String(error?.message ?? error))
  } finally {
    for (const w of worlds) {
      try { if (w.tornDown === null) await w.teardown({ keepHome }) } catch { /* already down */ }
    }
  }

  // ── leak check + stable-instance guard + evidence write ──────────────────
  const leak = { ownedPidsDead: true, portsReleased: true, homeReleased: true, leasesReleased: true, notes: [] }
  for (const w of worlds) {
    for (const k of w.receipts.killedPids ?? []) if (pidAlive(k.pid ?? k)) { leak.ownedPidsDead = false; leak.notes.push(`pid alive ${String(k.pid ?? k)}`) }
    for (const port of [...new Set(w.receipts.releasedPorts ?? [])]) if (await portInUse(port)) { leak.portsReleased = false; leak.notes.push(`port bound ${String(port)}`) }
    if (w.receipts.homeDeleted === null && !keepHome) { leak.homeReleased = false; leak.notes.push(`home not deleted ${w.home}`) }
    const held = scanAllLeases(factory.leaseRoot).filter((l) => l.by?.world === w.id)
    if (held.length > 0) { leak.leasesReleased = false; leak.notes.push(`leases held ${w.id}`) }
  }
  record.addCase('leak-check', leak.ownedPidsDead && leak.portsReleased && leak.homeReleased && leak.leasesReleased ? 'PASS' : 'FAIL', leak)
  const stablePost = await stableInstanceProbe()
  const homesPost = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  record.addCase('stable-instance-unchanged', stablePre.status === stablePost.status ? 'PASS' : 'FAIL', {
    pre: stablePre, post: stablePost,
    homesCreated: Object.keys(homesPost).filter((n) => !(n in homesPre)),
    note: 'read-only probe of :3080 before/after',
  })
  factory.assertHostBase('post-run')

  for (const [k, inv] of Object.entries(inventories)) {
    writeFileSync(join(evRoot, `${runId}.inventory.${k}.json`), JSON.stringify(inv, null, 2) + '\n')
  }
  if (Object.keys(verdicts).length > 0) writeFileSync(join(evRoot, `${runId}.reconcile.json`), JSON.stringify(verdicts, null, 2) + '\n')
  const rec = record.finalize()
  record.write(join(evRoot, `${runId}.RUN.json`))
  uninstall()
  log(`evidence: ${evRoot}`)
  return { record: rec, evRoot, inventories, verdicts }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const out = await runCensus(opts)
  console.log(formatSummary(out.record))
  if (out.inventories) {
    for (const [k, inv] of Object.entries(out.inventories)) {
      console.log(`INVENTORY ${k}: scopes=${String(inv.scopes.length)} snapshot_digest=${inv.snapshot_digest}`)
    }
  }
  if (out.verdicts) {
    for (const [k, v] of Object.entries(out.verdicts)) {
      console.log(`VERDICT ${k}: missing=${String(v.counts.missing)} unknown=${String(v.counts.unknown)} drift=${String(v.counts.drift)} oos=${String(v.counts.out_of_scope_observed)} gaps=${String(v.counts.scope_gaps)} digest=${v.verdict_digest}`)
    }
  }
  process.exit(exitCodeFor(out.record))
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`FATAL: ${String(error?.stack ?? error)}`)
    process.exit(2)
  })
}
