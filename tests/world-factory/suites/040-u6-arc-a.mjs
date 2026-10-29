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
import { remoteCall, hasMarker, surfaceNamesOf, toolMsgsOf, messagesOf, MANAGED_TOOL_NAMES, SAFE_UNMANAGED_TOOL_NAMES } from '../lib/u6-fs-assembly.mjs'
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
// the ask-lane glob DENIAL (U7-R3 pilot C2: a governed team_glob whose
// durable ask row the RUNNER denies over the public seam — typed
// APPROVAL_DENIED, zero effect), and the non-Team native grep control.
const CASES = Object.freeze(['arca:mounted', 'arca:probe-positive', 'arca:probe-unbound-refused-zero-effect', 'arca:probe-replay-refused-zero-effect', 'arca:probe-unload-settles', 'arca:search-grep-live', 'arca:search-glob-live', 'arca:search-refusal-zero-effect', 'arca:glob-ask-deny-refusal-zero-effect', 'arca:native-grep-control'])

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

  // ── U7-R3 pilot C2 — the glob ask-DENY DENIER (the runner IS the human) ──
  // The governed Team Session's durable Control lane is observed over the
  // PRODUCT read plane (remote team.getLedgerPage — the p6t6 state route is
  // boot-root-anchored and structurally blind here, the R-U6P4-2 law read
  // verbatim from the jobs suite) and EVERY pending ask row is answered
  // DENY through the public team.resolveControl seam. By construction this
  // world arms exactly one ask row: the greper's allow rule never asks, the
  // ctl lane is the legacy native surface, the leader owns no exec lane —
  // the row's toolName/summary are nonetheless recorded as WITNESSES, and a
  // row NOT naming the glob/read class is treated as an identity mismatch
  // (rowSeen stays false, the case cannot borrow its green).
  const unwrapRemote = (body) => {
    const v = body?.result?.value
    return v && typeof v === 'object' && 'data' in v ? v.data : v
  }
  const globTeamSessionId = unwrapRemote(created.body)?.rootSessionId ?? assembly.CREATE_ROOT
  const denierErrors = []
  const globDenyRow = { seen: false, deniedOk: false, toolName: null, summary: null, requestId: null, resolutions: [], identityMismatch: false }
  let globDenyCensusArmed = null
  const pendingControlRows = async () => {
    const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 20; pageNo += 1) {
      const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage',
        { teamSessionId: globTeamSessionId, afterSequence, limit: 500 }, 'u6arca-ledger', 1)
      const r = page?.body?.result
      // FAIL LOUD on an error page (the kit's run-9 law: an error read as
      // an empty ledger launders a broken read plane into zeros).
      if (page?.status !== 200 || r?.ok !== true) {
        throw new Error(`team.getLedgerPage failed (page ${String(pageNo + 1)}, afterSequence=${String(afterSequence)}): status=${String(page?.status)} ${JSON.stringify(r?.error ?? r ?? null).slice(0, 200)}`)
      }
      const data = unwrapRemote(page.body)
      const entries = Array.isArray(data?.entries) ? data.entries : []
      for (const e of entries) {
        if (byType[e?.factType] === undefined) continue
        let payload = e.payload
        if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
        byType[e.factType].push(payload ?? {})
      }
      const next = data?.nextAfterSequence
      if (next === null || next === undefined || entries.length === 0) break
      afterSequence = Number(next)
    }
    const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']]
      .map((p) => String(p?.requestId ?? '')))
    const rows = []
    for (const p of byType['control-request-recorded']) {
      if (p?.requestId === undefined || settled.has(String(p.requestId))) continue
      rows.push({ requestId: String(p.requestId), toolName: p.toolName ?? null, summary: String(p.summary ?? '').slice(0, 140) })
    }
    return rows
  }
  let denierStop = false
  const denier = (async () => {
    while (!denierStop) {
      try {
        for (const r of (await pendingControlRows())) {
          if (!globDenyRow.seen && globDenyRow.requestId === null && !globDenyRow.identityMismatch) {
            const tag = `${String(r.toolName ?? '')} ${String(r.summary ?? '')}`
            if (/glob|read/i.test(tag)) {
              globDenyRow.seen = true
              globDenyRow.toolName = r.toolName
              globDenyRow.summary = r.summary
              globDenyRow.requestId = r.requestId
              // The census is ARMED at the observed row: the refused call's
              // backend can only run AFTER this row settles allow, so the
              // armed→post window is exactly the refused call's window.
              globDenyCensusArmed = fixtureCensus()
            } else {
              globDenyRow.identityMismatch = true
              globDenyRow.toolName = r.toolName
              globDenyRow.summary = r.summary
            }
          }
          const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
            { teamSessionId: globTeamSessionId, requestId: r.requestId, decision: 'deny', note: 'u7r3-c2-glob-ask-deny' }, 'u6arca-deny', 4)
          const ok = res?.status === 200 && res?.body?.result?.ok === true
          globDenyRow.resolutions.push({ requestId: r.requestId, status: res?.status ?? null, ok })
          if (ok && r.requestId === globDenyRow.requestId) globDenyRow.deniedOk = true
        }
      } catch (err) { denierErrors.push(String(err?.message ?? err).slice(0, 200)) }
      await sleep(1200)
    }
  })()

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
  // U7-R3 pilot C2: the ask-lane glob leg (the DENIER above answers its
  // durable ask row DENY; the fence is the lane's own close text).
  laneDone.globden = await wakeCadence('U6ARCA_GLOBDENY_DONE', 120_000, 'x')
  const globDenyCensusPost = fixtureCensus()
  laneDone.probe = await fireTrigger(assembly.markers.T_PROBE, 'U6ARCA_WALK_DONE')
  laneDone.unbound = await fireTrigger(assembly.markers.T_UNBOUND, 'U6ARCA_UNBOUND_DONE')
  laneDone.replay = await fireTrigger(assembly.markers.T_REPLAY, 'U6ARCA_REPLAY_DONE')
  laneDone.teardown = await fireTrigger(assembly.markers.T_TEARDOWN, 'U6ARCA_TD_DONE')
  laneDone.postTeardown = await fireTrigger(assembly.markers.T_POSTTEARDOWN, 'U6ARCA_POSTTD_DONE')
  laneDone.leader = await wakeCadence('U6ARCA_L1_DONE', 60_000, 'z')

  // ── evidence collection (DISK / LEDGER / HOST LOG; digests, tokens never recorded) ──
  // Stop the DENIER only after the glob leg closed (or timed out) — its
  // last ledger pass also settles a late row so no parked ask can masquerade.
  denierStop = true
  try { await denier } catch { /* observational */ }
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
  // U7-R3 pilot C2 witnesses — the glob ask-DENY arm, ledger + transcript
  // face. The d3 ENVELOPE needle is member-side (the leader's team_delegate
  // ARGS carry the raw token, never the `[team-work requestToken=` envelope
  // — the run-2/3 contamination law of the jobs suite, applied here).
  const d3Lane = `[team-work requestToken=${assembly.tokens('d3')}`
  const d3Reqs = (world.mock?.requests ?? []).filter((r) => hasMarker(r, d3Lane))
  const d3Results = d3Reqs.flatMap((r) => toolMsgsOf(r).map((m) => String(m.text)))
  // Did the leg's tool call even REACH the Host? A stalled call (no
  // tool_result) still shows its tool_use block — that shape (issued, no
  // answer, no row) is the honest ENV_BLOCK family; a leg that never
  // issued is a chain FAIL, never a block.
  const globAskIssued = d3Reqs.some((r) => messagesOf(r).some((m) => Array.isArray(m?.content)
    && m.content.some((b) => b?.type === 'tool_use' && String(b?.name ?? '') === 'team_glob')))
  const globRefusalText = d3Results.find((t) => /refused|denied|APPROVAL_DENIED/i.test(t)) ?? null
  const globDenyResult = {
    rowSeen: globDenyRow.seen,
    rowDeniedOk: globDenyRow.deniedOk === true,
    refusalSeen: globRefusalText !== null,
    approvalDeniedCodeSeen: globRefusalText !== null && /APPROVAL_DENIED/.test(globRefusalText),
    // LAW FIX (dated 2026-10-29, boot u5-u6-arc-a-u7r3c2a2 measured): the
    // a5p5 pipeline answers EVERY pre-backend deny with the ZERO-BODY kind
    // 'refused-admission' - both the admission-kernel shut faces AND the
    // durable Control ask DENIAL (packages/tools/a5p5-tools/src/pipeline.ts
    // :110-112/:155-159: "the code distinguishes them, never the wire
    // shape"). The shut-face discrimination therefore lives in the CODE:
    // IO_POLICY_UNSUPPORTED / template-* / APPROVAL_NOT_RESOLVED / no
    // durable row are shut faces; refused-admission CARRIED BY
    // code=APPROVAL_DENIED on a row this DENIER settled is the ask-lane
    // refusal landing (the run8 law against shut faces stands unchanged).
    admissionRefused: globRefusalText !== null
      && (/IO_POLICY_UNSUPPORTED|template-default-deny|template-deny-lane|no durable ControlService|APPROVAL_NOT_RESOLVED/i.test(globRefusalText)
        || (!/APPROVAL_DENIED/.test(globRefusalText) && /refused-admission/i.test(globRefusalText))),
    // zero-confusion binding witness (detail only, never a gate): the
    // refusal's fingerprint must be the SAME sha256 that ends the durable
    // ask row's summary - the refusal IS this row's answer.
    fingerprintBound: (() => {
      if (globRefusalText === null || !globDenyRow?.seen) return false
      const m = /sha256:[0-9a-f]{16,}/.exec(globRefusalText)
      const t = /sha256:[0-9a-f]{16,}/.exec(String(globDenyRow.summary ?? ''))
      // R458d N2 (2026-10-30): the durable row summary is stored .slice(0,140),
      // which can cut a 64-hex fingerprint to exactly 48 hex (measured in
      // boot#3's own record) — full-string equality would then record a genuine
      // PASS as fingerprintBound=false. Compare by common prefix instead
      // (>=16 hex on both sides); detail-only witness, never a gate.
      if (m === null || t === null) return false
      const mh = m[0].slice('sha256:'.length)
      const th = t[0].slice('sha256:'.length)
      const n = Math.min(mh.length, th.length)
      return n >= 16 && mh.slice(0, n) === th.slice(0, n)
    })(),
    censusUnchanged: globDenyCensusArmed !== null && globDenyCensusArmed === globDenyCensusPost,
    claimsEchoed: globRefusalText !== null
      && Object.values(assembly.files).some((f) => globRefusalText.includes(f.claim)),
    // Honest disclosure for the ENV_BLOCK minting below: the call ANSWERED
    // a file enumeration (the ask lane never gated it) — that is a product
    // finding, never an environment block.
    allowedAnswer: d3Results.some((t) => t.includes('.txt') && !/refused|denied/i.test(t)),
    row: { ...globDenyRow },
    armedAtRow: globDenyCensusArmed !== null,
    censusArmed: globDenyCensusArmed,
    censusPost: globDenyCensusPost,
    globAskIssued,
    refusalSample: globRefusalText === null ? null : globRefusalText.slice(0, 220),
    answerSample: d3Results.length > 0 ? String(d3Results[d3Results.length - 1]).slice(0, 160) : null,
    denierErrors: [...new Set(denierErrors)].slice(-4),
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
    globDenyResult,
    hostKernelHits,
    hostAlive: hostAlive(),
  })
  // Three-way law for the new arm (no ENV_BLOCK forging): the arm is
  // ENV_BLOCK ONLY when its durable ask row never reached the ledger face
  // at all (the leg died upstream — the 070-web precedent's honest shape).
  // A row that WAS seen, or an enumeration that answered, is graded — a
  // governance hole is a FAIL, never a block.
  const globArmId = 'arca:glob-ask-deny-refusal-zero-effect'
  const globArmEnvBlock = verdicts[globArmId] !== true
    && globDenyResult.globAskIssued === true
    && globDenyResult.rowSeen !== true && globDenyResult.allowedAnswer !== true
    && globDenyResult.refusalSeen !== true
  for (const id of Object.keys(verdicts)) {
    if (done.has(id)) continue
    if (id === globArmId && globArmEnvBlock) {
      add(id, 'ENV_BLOCK', { reason: 'the governed glob ask never armed a durable Control row on the ledger face (the DENIER observed zero rows; the leg died upstream, no refusal witness exists either way)', globDenyResult, laneDone })
      continue
    }
    add(id, verdicts[id] === true ? 'PASS' : 'FAIL', {
      markerFiles: markerFiles.filter((m) => m.endsWith('-marker.txt')),
      posNonce: nonceOf('pos-1-marker.txt'),
      expectedNonce: assembly.probe.posNonce,
      nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
      claimCounts: { g1: claimOccurrences(assembly.files.g1.claim), g2: claimOccurrences(assembly.files.g2.claim), git: claimOccurrences(assembly.files.git.claim) },
      globResults, refusalResult, ctlResult,
      ...(id === globArmId ? { globDenyResult } : {}),
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
    globDenyResult,
    probeLedgerRows: probeRows.length,
  }
  // u7-w0b (EB3 RUN rule): this is a PRE-FINISH snapshot (no finishedAt /
  // overall yet) — it must not masquerade as a `u5-run-record/1` RUN. It is
  // written under its own digest schema; the finalized RUN is the runner's
  // run-record. Content: the record snapshot, verbatim, under `snapshot`.
  writeFileSync(join(evidence, `${runId}.digest.json`), JSON.stringify({ schema: 'u6arca-digest/1', runId, snapshot: record.record }, null, 2) + '\n')
  if (!hostAlive()) failRest('host died during the run')
}

export default {
  suite: 'u6-arc-a',
  cases: CASES,
  totalRequests: 110,
  run: (opts, ctx) => runU6ArcA(opts, ctx),
}
