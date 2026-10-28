/**
 * tests/world-factory/suites/050-u6-arc-d.mjs — the `u6-arc-d` C2 suite,
 * collected by u5-canary-runner.mjs from this directory (u7-w0, 2026-10-26).
 *
 * Moved VERBATIM out of u5-canary-runner.mjs at origin/master 88107ad71 (the
 * suite's SUITE_CASES entry + its comment, its run function and the banner
 * above it, and its totalRequests budget) so a new suite lane ADDS a file here
 * and edits no shared list in the runner. The only textual changes: the runner
 * helpers it used arrive through the `ctx` argument, `SUITE_CASES['u6-arc-d']`
 * reads the module's own CASES, and imports name exactly what the body uses.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf, toolMsgsOf, MANAGED_TOOL_NAMES, SAFE_UNMANAGED_TOOL_NAMES } from '../lib/u6-fs-assembly.mjs'
import { createArcDAssembly, makeArcDDecide, judgeU6ArcD } from '../lib/u6-arc-d-assembly.mjs'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// U6 PR6 C2 (ARC-D at the Host): the PR5 probe family ATTACKED AS SHIPPED
// — zero new family code is the claim, so the row mounts the PR5 assembly
// unchanged. ONE boot, nine legs: mount, positive walk (marker + nonce),
// replay of a settled grant, self-reported foreign scope, a swapped
// identity the table never bound, a decide on a never-bound name, honest
// teardown + post-teardown refusal, the CI-03 native control (a member
// with NO capabilities block), and the ledger's global arithmetic. Verdict
// law DISK + LEDGER + HOST LOG — never the model transcript. No shadow
// twin: the kernel computes refuse verdicts in every mode (assembly header).
const CASES = Object.freeze(['arcd:mounted', 'arcd:positive', 'arcd:spoof-zero-authority', 'arcd:swap-refused', 'arcd:unbound-refused', 'arcd:replay-refused', 'arcd:ci03-native-parity', 'arcd:restrict-veto', 'arcd:lift-control', 'arcd:marker-ledger', 'arcd:teardown-honest'])

// u6-arc-d (U6 PR6 C2 / ARC-D at the Host): the ADVERSARIAL laws proven
// offline at the production seams (u6-pr6-arc-d-adversarial + -matrix) get
// their LIVE legs on the PR5 probe family AS SHIPPED — the row mounts the
// very assembly tests/u6-arc-a-probe-family ships (zero new family code is
// the whole claim) and attacks it: replay of a settled grant, self-reported
// foreign scope, a swapped identity the table never bound, a decide on a
// never-bound name, honest teardown + post-teardown refusal — plus the
// CI-03 native control (member WITHOUT a capabilities block, judged from a
// DIRECT DISK READ of the effect the lane writes — E1). ONE host start (design
// budget: 1 boot/run, tier 1 like ARC-A); the verdict law is DISK + LEDGER
// + HOST LOG — every row the judge below derives comes off those channels,
// never the model transcript.
async function runU6ArcD({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, REPO_ROOT, RUN_LIFETIME_MS }) {
  const CASE_IDS = CASES
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
  }
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try { hit = (await predicate()) === true } catch { hit = false }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u6ArcD: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createArcDAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles() // must precede teamRows(): the plane rootDir canonicalizes the workspace
  world.u6ArcD.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeArcDDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u6arcd-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6arcd-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const probeLedger = () => world.u6arcdLedgerRows() ?? []
  const listMarkers = () => {
    try { return readdirSync(world.u6arcdMarkerDir) } catch { return [] }
  }
  const nonceOf = (f) => {
    try { return readFileSync(join(world.u6arcdMarkerDir, f), 'utf8').trim() } catch { return null }
  }

  // ── readiness gates (arc-a law; every early bail is a FAIL with its own
  // reason — the JUDGE owns the nine verdicts, ENV_BLOCK included) ─────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
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
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }
  if (!probeLedger().some((r) => r.leg === 'register' && r.kind === 'probe-tool' && r.ok === true)) {
    failRest('probe tool never registered (the family has no callable surface)', {
      familyRows: probeLedger().filter((r) => ['family-mount', 'register'].includes(String(r.leg))),
    })
    return
  }

  // ── discovery -> main blueprint -> team.create (arc-a lines kept 1:1) ────
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6arcd')
  if (discPrompt.status !== 200) {
    failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    return
  }
  const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
  if (!discW.hit) {
    failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
    return
  }
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive (native lane first: it runs on the member while the leader
  // chain is still walking; the trigger legs ride boot-root prompts) ──────
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const laneDone = {}
  record.record.u6arcdLanes = laneDone
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6ARCD_PHASE_${tag}`, 'u6arcd-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (doneText, deadlineMs, tag) => {
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replySeen(doneText)) return true
      if (Date.now() - t0 > deadlineMs) return replySeen(doneText)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  const fireTrigger = async (markerText, doneText, deadlineMs = 90_000) => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, markerText, 'u6arcd-trig')
    if (pr.status !== 200) {
      log(`trigger ${String(markerText).slice(0, 44)} rejected: status=${String(pr.status)}`)
      return false
    }
    return (await waitA(async () => replySeen(doneText), deadlineMs)).hit
  }
  laneDone.native = await wakeCadence('U6ARCD_NATIVE_DONE', 120_000, 'n')
  laneDone.pos = await fireTrigger(assembly.markers.T_POS, 'U6ARCD_WALK_DONE')
  laneDone.spoof = await fireTrigger(assembly.markers.T_SPOOF, 'U6ARCD_SPOOF_DONE')
  laneDone.swap = await fireTrigger(assembly.markers.T_SWAP, 'U6ARCD_SWAP_DONE')
  laneDone.unbound = await fireTrigger(assembly.markers.T_UNBOUND, 'U6ARCD_UNBOUND_DONE')
  laneDone.replay = await fireTrigger(assembly.markers.T_REPLAY, 'U6ARCD_REPLAY_DONE')
  laneDone.teardown = await fireTrigger(assembly.markers.T_TD, 'U6ARCD_TD_DONE')
  laneDone.postTeardown = await fireTrigger(assembly.markers.T_POSTTD, 'U6ARCD_POSTTD_DONE')
  // R-U6P6-1 live deny-change pair (d_restrict_veto / d_lift_control): the
  // restrict leg masks the leader lane's bash (the builtinToolDeny lane,
  // applied by the plugin ON the calling agent), attempts its effect, and
  // must leave ZERO disk effect; the lift leg disposes the mask (its own
  // first step — even if the restrict leg stalls, the mask never outlives
  // the pair) and its effect must LAND. The judge reads DISK + the durable
  // govern rows, never these fences — laneDone records closure only.
  laneDone.pairRestrict = await fireTrigger(assembly.markers.T_RESTRICT, 'U6ARCD_RESTRICT_VETOED')
  laneDone.pairLift = await fireTrigger(assembly.markers.T_LIFT, 'U6ARCD_LIFT_RAN')
  laneDone.leader = await wakeCadence('U6ARCD_L1_DONE', 60_000, 'z')

  // ── evidence collection (DISK / LEDGER / wire-claimed disk facts) ────────
  const probeRows = probeLedger()
  const markerFiles = listMarkers()
  const markerNonces = Object.fromEntries(markerFiles.map((f) => [f, nonceOf(f)]))
  // The claims on WIRE tool_results are disk-channel facts the runner
  // authored (the exact standard arc-a applies to its ctlResult /
  // claimOccurrences) — under E1 they are recorded as the nativeGrepParity
  // NOTE only: claim bytes inside a tool_result are what the native lane
  // ECHOED. The VERDICT basis is the DIRECT disk read below: a file the
  // native lane WROTE during the run and the ORACLE (this process) reads
  // back itself — independent of every tool return.
  const claimOccurrences = (claim) => (world.mock?.requests ?? []).reduce((n, r) =>
    n + toolMsgsOf(r).filter((m) => String(m.text).includes(claim)).length, 0)
  const nativeGrepParity = { claimOccurrences: claimOccurrences(assembly.files.native.claim) }
  const nativeEvidence = { readFromDisk: true, present: false, contentMatches: false, pathTail: assembly.files.nativeEffect.path.slice(assembly.files.nativeEffect.path.lastIndexOf('/') + 1) }
  try {
    const effectText = readFileSync(assembly.files.nativeEffect.path, 'utf8')
    nativeEvidence.present = true
    nativeEvidence.contentMatches = effectText.includes(assembly.files.nativeEffect.marker)
  } catch { /* ABSENT = the native lane produced no disk effect — a measurement, not an error */ }
  // R-U6P6-1: the pair legs' DISK witnesses, read the same direct way.
  // pairDeny PRESENT would be the mask failing to hide (a FAIL there);
  // pairLift ABSENT would be the lift never restoring (a FAIL there).
  const pairEvidence = {}
  for (const key of ['pairDeny', 'pairLift']) {
    const file = assembly.files[key]
    const e = { readFromDisk: true, present: false, contentMatches: false, marker: file.marker, pathTail: file.path.slice(file.path.lastIndexOf('/') + 1) }
    try {
      const t = readFileSync(file.path, 'utf8')
      e.present = true
      e.contentMatches = t.includes(file.marker)
    } catch { /* ABSENT = a measurement, not an error */ }
    pairEvidence[key] = e
  }
  // DIAGNOSTIC note (never a verdict basis): the settle texts the effect
  // lanes saw — the native write attempt and the pair bash attempts. When
  // the DISK says ABSENT these names WHY (sandbox refusal vs no-call); when
  // the DISK says present these must be consistent — a settle claiming a
  // write the disk denies is itself the finding.
  const settleSeen = new Map()
  for (const r of world.mock?.requests ?? []) {
    for (const m of toolMsgsOf(r)) {
      const t = String(m?.text ?? '')
      if (/u6arcd|sandbox:|file access denied|not permitted|Permission denied|not-visible|Tool Binding|no such tool|not available|Unknown tool/i.test(t)) {
        const k = t.slice(0, 200)
        settleSeen.set(k, (settleSeen.get(k) ?? 0) + 1)
      }
    }
  }
  const effectNotes = { distinct: settleSeen.size, heads: [...settleSeen.entries()].slice(0, 10).map(([t, n]) => n > 1 ? `${t} [x${n}]` : t) }
  const alive = hostAlive()
  const verdicts = judgeU6ArcD({ probeRows, markerFiles, markerNonces, nativeEvidence, nativeGrepParity, pairEvidence, hostAlive: alive })
  for (const [id, verdict, detail] of verdicts) {
    if (done.has(id)) continue
    add(id, verdict, {
      markerFiles: markerFiles.filter((m) => m.endsWith('-marker.txt')),
      posNonce: nonceOf('pos-1-marker.txt'),
      expectedNonce: assembly.probe.posNonce,
      nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
      nativeEvidence,
      nativeGrepParity,
      pairEvidence,
      laneDone,
      hostAlive: alive,
      ...(detail ?? {}),
    })
  }
  record.record.u6arcdDigest = {
    mockTail: world.mockRequestDigest().slice(-8),
    surface, denyList, markerFiles,
    nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
    nativeEvidence, nativeGrepParity, pairEvidence, effectNotes, laneDone, probeLedgerRows: probeRows.length,
    governRows: probeRows.filter((r) => String(r.leg) === 'govern').map((r) => ({ action: r.action ?? null, ok: r.ok, detail: r.detail ?? null })),
    probeRows: probeRows
      .filter((r) => ['family-mount', 'register', 'walk', 'teardown', 'unload-settle', 'govern', 'pair-effect'].includes(String(r.leg)))
      .map((r) => ({ leg: r.leg, action: r.action ?? null, callId: r.callId ?? null, ok: r.ok, code: r.code ?? null, outcome: r.outcome ?? null })),
  }
  // u7-w0b (EB3 RUN rule): this is a PRE-FINISH snapshot (no finishedAt /
  // overall yet) — it must not masquerade as a `u5-run-record/1` RUN. It is
  // written under its own digest schema; the finalized RUN is the runner's
  // run-record. Content: the record snapshot, verbatim, under `snapshot`.
  writeFileSync(join(evidence, `${runId}.digest.json`), JSON.stringify({ schema: 'u6arcd-digest/1', runId, snapshot: record.record }, null, 2) + '\n')
  if (!alive) failRest('host died during the run')
}

export default {
  suite: 'u6-arc-d',
  cases: CASES,
  totalRequests: 90,
  run: (opts, ctx) => runU6ArcD(opts, ctx),
}
