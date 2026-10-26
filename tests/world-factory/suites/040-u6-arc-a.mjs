/**
 * tests/world-factory/suites/040-u6-arc-a.mjs — the `u6-arc-a` C2 suite,
 * collected by u5-canary-runner.mjs from this directory (u7-w0, 2026-10-26).
 *
 * Moved VERBATIM out of u5-canary-runner.mjs at origin/master 88107ad71 (the
 * suite's SUITE_CASES entry + its comment, its run function and the banner
 * above it, and its totalRequests budget) so a new suite lane ADDS a file here
 * and edits no shared list in the runner. The only textual changes: the runner
 * helpers it used arrive through the `ctx` argument, `SUITE_CASES['u6-arc-a']`
 * reads the module's own CASES, and imports name exactly what the body uses.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf, toolMsgsOf, MANAGED_TOOL_NAMES, SAFE_UNMANAGED_TOOL_NAMES } from '../lib/u6-fs-assembly.mjs'
import { createArcAssembly, makeArcDecide, judgeU6ArcA } from '../lib/u6-arc-a-assembly.mjs'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// U6 PR5 C2 (ARC-A at the Host): the PROBE FAMILY — a NEW family with
// ZERO center diff — mounted on the real Host through the lane's own
// public assembly, beside the PRODUCTION plane whose moved search rows
// must answer live. The matrix: family mount, the real marker effect read
// off DISK, the no-entry / replay / post-unload refusals each with ZERO
// effect, the family's own unload settling, live governed grep+glob over
// a runner-computed ground truth (the .git decoy proves the native
// exclusion contract), the anchored containment refusal with zero effect,
// and the non-Team native grep control.
const CASES = Object.freeze(['arca:mounted', 'arca:probe-positive', 'arca:probe-unbound-refused-zero-effect', 'arca:probe-replay-refused-zero-effect', 'arca:probe-unload-settles', 'arca:search-grep-live', 'arca:search-glob-live', 'arca:search-refusal-zero-effect', 'arca:native-grep-control'])

// u6-arc-a (U6 PR5 C2 / ARC-A at the Host): ONE Team World; the probe
// FAMILY (tests/u6-arc-a-probe-family — a new family, zero center diff)
// mounts beside the production plane as a profile-patch row, and the
// suite's whole verdict set is read from DISK (marker dir + fixture +
// ledger) and the HOST LOG — never from the model transcript. ONE host
// start; the design budget is 1 boot/run (the runner-wide budget gate
// still caps at maxHostStarts).
async function runU6ArcA({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, REPO_ROOT, RUN_LIFETIME_MS }) {
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
  const redactLine = (t) => String(t).replace(/\?token=[A-Za-z0-9_-]+/g, '?token=<redacted>').slice(0, 260)
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
  const world = await factory.createWorld({ line, u6ArcA: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createArcAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles() // must precede teamRows(): the plane rootDir canonicalizes the workspace
  world.u6ArcA.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeArcDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u6arca-boot1' })
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
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6arca-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const probeLedger = () => world.u6arcaLedgerRows() ?? []
  const listMarkers = () => {
    try { return readdirSync(world.u6arcaMarkerDir) } catch { return [] }
  }
  const fixtureCensus = () => {
    const out = []
    const walk = (dir, rel) => {
      for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.isDirectory()) walk(join(dir, e.name), `${rel}${e.name}/`)
        else out.push(`${rel}${e.name}:${String(readFileSync(join(dir, e.name)).length)}`)
      }
    }
    walk(assembly.workspaceDir, '')
    // PROBE MARKERS ARE NOT FIXTURE STATE: the probe lane legitimately
    // writes u6arca-markers/*.txt (its own effect, verified by the
    // marker/nonce evidence of that leg). The refusal leg's ZERO-EFFECT
    // law is about the FIXTURE files; counting another leg's declared
    // output made censusUnchanged false in run8 for a legitimate write
    // (post-run8 harness fix, disclosed; verdicts unaffected — the search
    // legs fail at the enum gap regardless).
    return out.filter((row) => !row.startsWith('u6arca-markers/')).join('|')
  }
  const censusPre = fixtureCensus()

  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('arca:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 90_000)
  const mountRows0 = probeLedger()
  add('arca:mounted', stateW.hit
    && mountRows0.some((r) => r.leg === 'family-mount' && r.ok === true)
    && mountRows0.some((r) => r.leg === 'register' && r.kind === 'probe-tool' && r.ok === true)
    && hostAlive() ? 'PASS' : 'FAIL', {
    teamSession: stateBody?.teamSession !== null && stateBody?.teamSession !== undefined,
    familyMount: mountRows0.find((r) => r.leg === 'family-mount') ?? { missing: true },
    probeRegister: mountRows0.find((r) => r.leg === 'register' && r.kind === 'probe-tool') ?? { missing: true },
    hostAlive: hostAlive(),
  })
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }
  if (!probeLedger().some((r) => r.leg === 'register' && r.kind === 'probe-tool' && r.ok === true)) {
    failRest('probe tool never registered (the family has no callable surface)')
    return
  }

  // ── discovery -> main blueprint -> team.create ────────────────────────────
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6arca')
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

  // ── drive ────────────────────────────────────────────────────────────────
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const laneDone = {}
  record.record.u6arcaLanes = laneDone
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6ARCA_PHASE_${tag}`, 'u6arca-wake')
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
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, markerText, 'u6arca-trig')
    if (pr.status !== 200) {
      log(`trigger ${String(markerText).slice(0, 44)} rejected: status=${String(pr.status)}`)
      return false
    }
    return (await waitA(async () => replySeen(doneText), deadlineMs)).hit
  }
  laneDone.grep = await wakeCadence('U6ARCA_GREP_DONE', 120_000, 'g')
  laneDone.ctl = await wakeCadence('U6ARCA_CTL_DONE', 90_000, 'c')
  laneDone.probe = await fireTrigger(assembly.markers.T_PROBE, 'U6ARCA_WALK_DONE')
  laneDone.unbound = await fireTrigger(assembly.markers.T_UNBOUND, 'U6ARCA_UNBOUND_DONE')
  laneDone.replay = await fireTrigger(assembly.markers.T_REPLAY, 'U6ARCA_REPLAY_DONE')
  laneDone.teardown = await fireTrigger(assembly.markers.T_TEARDOWN, 'U6ARCA_TD_DONE')
  laneDone.postTeardown = await fireTrigger(assembly.markers.T_POSTTEARDOWN, 'U6ARCA_POSTTD_DONE')
  laneDone.leader = await wakeCadence('U6ARCA_L1_DONE', 60_000, 'z')

  // ── evidence collection (DISK / LEDGER / HOST LOG; digests, tokens never recorded) ──
  const censusPost = fixtureCensus()
  const probeRows = probeLedger()
  const markerFiles = listMarkers()
  const nonceOf = (f) => {
    try { return readFileSync(join(world.u6arcaMarkerDir, f), 'utf8').trim() } catch { return null }
  }
  const claimOccurrences = (claim) => (world.mock?.requests ?? []).reduce((n, r) =>
    n + toolMsgsOf(r).filter((m) => String(m.text).includes(claim)).length, 0)
  const toolResultTexts = () => (world.mock?.requests ?? []).flatMap((r) => toolMsgsOf(r).map((m) => String(m.text)))
  const results = toolResultTexts()
  const grepResults = [{
    ok: true,
    claimsFound: claimOccurrences(assembly.files.g1.claim) >= 1 ? ['g1'] : [],
  }]
  const allGlobs = results.filter((t) => t.includes('.txt'))
  const enumHasG3 = results.some((t) => t.includes('u6arca-uni-'))
  const gitDecoyExcluded = !results.some((t) => t.includes('.git/'))
  const globResults = [{ ok: enumHasG3 && gitDecoyExcluded, enumHasG3, gitDecoyExcluded }]
  const refusalText = results.find((t) => /refus|denied|outside|unsupported|not allowed|cannot be verified/i.test(t) && !t.includes(assembly.files.g1.claim)) ?? null
  const refusalResult = {
    refused: refusalText !== null,
    // containment ONLY: the old regex counted ANY refusal word, so an
    // ADMISSION refusal (refused-admission / IO_POLICY_UNSUPPORTED — what
    // the enum gap produces) masqueraded as the anchored containment
    // refusal the leg actually claims. Post-run8 honesty fix.
    outsideRootCodeSeen: refusalText !== null ? /outside|containment|OUTSIDE_ROOT/i.test(refusalText) : false,
    admissionRefused: refusalText !== null ? /refused-admission/i.test(refusalText) : false,
    censusUnchanged: censusPre === censusPost,
    refusalSample: refusalText === null ? null : refusalText.slice(0, 220),
  }
  const ctlResult = {
    ok: true,
    claimFound: claimOccurrences(assembly.files.g2.claim) >= 1,
  }
  const hostKernelHits = (() => {
    const pats = ['a5g7: placement-feed rows=', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED',
      'PLANE_KERNEL_UNAVAILABLE', 'PLANE_SEARCH_REGISTRATION_REFUSED', 'cannot be verified at dispatch',
      'U6_PROBE', 'u6arc', 'governance-center']
    let text = ''
    try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
    const out = {}
    for (const p of pats) {
      const lines = text.split('\n').filter((l) => l.includes(p))
      out[p] = { count: lines.length, sample: lines.length > 0 ? redactLine(lines[lines.length - 1]) : null }
    }
    return out
  })()
  const verdicts = judgeU6ArcA({
    ledgerRows: probeRows,
    markerFiles,
    grepResults,
    globResults,
    ctlResult,
    refusalResult,
    hostKernelHits,
    hostAlive: hostAlive(),
  })
  for (const id of Object.keys(verdicts)) {
    if (done.has(id)) continue
    add(id, verdicts[id] === true ? 'PASS' : 'FAIL', {
      markerFiles: markerFiles.filter((m) => m.endsWith('-marker.txt')),
      posNonce: nonceOf('pos-1-marker.txt'),
      expectedNonce: assembly.probe.posNonce,
      nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
      claimCounts: { g1: claimOccurrences(assembly.files.g1.claim), g2: claimOccurrences(assembly.files.g2.claim), git: claimOccurrences(assembly.files.git.claim) },
      globResults, refusalResult, ctlResult,
      censusUnchanged: censusPre === censusPost,
      laneDone,
      hostKernelHits,
      familyRows: probeRows.filter((r) => ['family-mount', 'register', 'walk', 'teardown', 'unload-settle'].includes(String(r.leg))).map((r) => ({ leg: r.leg, action: r.action ?? null, ok: r.ok, code: r.code ?? null, outcome: r.outcome ?? null })),
    })
  }
  record.record.u6arcaDigest = {
    mockTail: world.mockRequestDigest().slice(-8),
    surface, denyList, censusPre, censusPost,
    markerFiles, nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
    grepResults, globResults, refusalResult, ctlResult, hostKernelHits,
    probeLedgerRows: probeRows.length,
  }
  writeFileSync(join(evidence, `${runId}.evidence.json`), JSON.stringify(record.record, null, 2) + '\n')
  if (!hostAlive()) failRest('host died during the run')
}

export default {
  suite: 'u6-arc-a',
  cases: CASES,
  totalRequests: 90,
  run: (opts, ctx) => runU6ArcA(opts, ctx),
}
