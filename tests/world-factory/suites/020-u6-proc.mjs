/**
 * tests/world-factory/suites/020-u6-proc.mjs — the `u6-proc` C2 suite,
 * collected by u5-canary-runner.mjs from this directory (u7-w0, 2026-10-26).
 *
 * Moved VERBATIM out of u5-canary-runner.mjs at origin/master 88107ad71 (the
 * suite's SUITE_CASES entry + its comment, its run function and the banner
 * above it, and its totalRequests budget) so a new suite lane ADDS a file here
 * and edits no shared list in the runner. The only textual changes: the runner
 * helpers it used arrive through the `ctx` argument, `SUITE_CASES['u6-proc']`
 * reads the module's own CASES, and imports name exactly what the body uses.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf, toolMsgsOf, MANAGED_TOOL_NAMES, SAFE_UNMANAGED_TOOL_NAMES } from '../lib/u6-fs-assembly.mjs'
import { createProcAssembly, makeProcDecide, judgeU6Proc } from '../lib/u6-proc-assembly.mjs'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// U6 PR3 C2 (ARC-B at the Host): the governed SHELL lane on the SAME
// kernel instance as the read lane — ask-lane spawn through a
// kernel-consumed grant, default-deny zero-spawn, settled-request replay
// refusal, identity-swap plant held off (with its guard-off positive
// channel), timeout→terminate honesty, and the CI-03 native control.
// Review-r1 adds the two POSITIVE cases: the World authorises ONE
// governed bash call through the real Control/ask path (public
// team.resolveControl seam) and measures exactly-once consume + real
// spawn on the independent disk oracle, then the same-identity replay
// refusal with zero second spawn.
const CASES = Object.freeze(['proc:mounted', 'proc:exec-door-fail-closed', 'proc:member-ask-born-terminal', 'proc:deny-zero-spawn', 'proc:replay-settled-refusal', 'proc:spoof-refusal', 'proc:guard-off-channel', 'proc:late-call-refused', 'proc:ctl-native-untouched', 'proc:approve-spawn-once', 'proc:approve-replay-refused'])

// u6-proc (U6 PR3 C2 / ARC-B at the Host): ONE governed Team World whose
// plane carries BOTH governed lanes — the read row (PR2) and the shell row
// (PR3) — on ONE kernel instance, ONE ledger. The case matrix drives the
// ask-lane spawn (grant minted on the durable Control lane, consumed EXACTLY
// ONCE by the kernel), the default-deny typed refusal with ZERO spawned
// processes, the settled-request replay refusal, the identity-swap plant
// against the kernel-owned `team_bash` identity (plus its guard-off positive
// channel), the timeout→terminate honesty arm, and the CI-03 native control.
// Verdicts lean on DISK effect oracles + the probe ledger + host-log hits —
// never on the model transcript alone (review-r1 F5 law from PR2).
async function runU6Proc({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, readLedgerRows, REPO_ROOT, RUN_LIFETIME_MS }) {
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
      try {
        hit = (await predicate()) === true
      } catch {
        hit = false
      }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u6Proc: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createProcAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles()
  world.u6Proc.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeProcDecide({ assembly, readProbeLedger: () => readLedgerRows(world.u6procLedgerPath) }) })
  record.logHostStart({ world: world.id, phase: 'u6proc-boot1' })
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
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6proc-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const probeLedger = () => world.u6procLedgerRows() ?? []
  const listMarkers = () => {
    try { return readdirSync(world.u6procMarkerDir) } catch { return [] }
  }

  // ── readiness: p6t6 health + anchored team session + probe mount ─────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('proc:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 90_000)
  const mountedRow = probeLedger().find((r) => r.leg === 'register' && r.kind === 'probe-tool')
  // mount evidence OUTSIDE the probe too: the host log must carry the
  // placement feed for the plane and NONE of the refusal codes (the kernel
  // is now mount-wide: a registration refusal or PLANE_KERNEL_UNAVAILABLE
  // would name itself in the log and every governed call would fail).
  const kernelHits = () => {
    const pats = ['a5g7: placement-feed rows=', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED',
      'PLANE_KERNEL_UNAVAILABLE', 'PLANE_PROCESS_REGISTRATION_REFUSED', 'PLANE_READ_REGISTRATION_REFUSED',
      'cannot be verified at dispatch']
    let text = ''
    try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
    const out = {}
    for (const p of pats) {
      const lines = text.split('\n').filter((l) => l.includes(p))
      out[p] = { count: lines.length, sample: lines.length > 0 ? redactLine(lines[lines.length - 1]) : null }
    }
    return out
  }
  // Early mount facts; the VERDICT is added at evidence time — the plane's
  // placement-feed echo lands when the first governed agent is created,
  // which is AFTER team.create (judging it here off the just-booted log is
  // what made run 2 fail a healthy mount).
  const earlyMount = {
    teamSession: stateBody?.teamSession !== null && stateBody?.teamSession !== undefined,
    probeRegister: mountedRow ?? { missing: true },
    listenLegs: probeLedger().filter((r) => r.leg === 'listen').map((r) => `${String(r.event)}:${String(r.ok)}`),
    launcherPin: { launcher: assembly.LAUNCHER, sha256: assembly.launcherSha() },
  }
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }

  // ── discovery prompt -> builtinToolDeny -> main blueprint -> team.create ─
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6proc')
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
  // (b2 law from u6-fs, kept verbatim in meaning: the probe tool and the
  // channel tool are unmanaged surface the A2C-2 COVERAGE GATE must see
  // declared — deny is coverage here, not a call site: no governed lane
  // ever calls them; the plants ride the boot-root session.)
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive ─────────────────────────────────────────────────────────────────
  // The leader chain owns all ordering; the runner fires the plant triggers
  // on the UNGOVERNED boot-root session and wakes the parked chain (u6-fs
  // rhythm, reused). The runner takes the HUMAN USER role on the durable
  // control lane: it watches the GOVERNED team session's rows over the
  // remote `team.getLedgerPage` read plane (R-U6P3-1 — the p6t6 observer is
  // boot-anchor-scoped and cannot see these rows) and settles each pending
  // user-approval request through the PUBLIC `team.resolveControl` seam —
  // the very endpoint the GUI calls for a human operator. No private API,
  // no test backdoor: this IS the product's human lane, driven honestly.
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const anyReplySeen = (contents) => contents.some((c) => replySeen(c))
  const laneDone = {}
  record.record.u6procLanes = laneDone
  const fireTrigger = async (markerText, pred, timeoutMs = 90_000) => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, markerText, 'u6proc-trig')
    if (pr.status !== 200) {
      log(`trigger prompt ${String(markerText).slice(0, 40)} rejected: status=${String(pr.status)} ${JSON.stringify(pr.body ?? null).slice(0, 160)}`)
      return false
    }
    return (await waitA(pred, timeoutMs)).hit
  }
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6PROC_PHASE_${tag}`, 'u6proc-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (doneTexts, deadlineMs, tag) => {
    const texts = Array.isArray(doneTexts) ? doneTexts : [doneTexts]
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (anyReplySeen(texts)) return true
      if (Date.now() - t0 > deadlineMs) return anyReplySeen(texts)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  // R-U6P3-1 — THE GOVERNED-SESSION TARGETING FIX. The p6t6 /state control
  // block is ANCHOR-scoped (its directive pins the BOOT ROOT team): it
  // structurally cannot see the rows of the team team.create made, so the
  // old `teamSession` read returned the BOOT root and every observation /
  // resolve below addressed the WRONG session (the pr-d kit's named law:
  // governed control state is read over the remote team.getLedgerPage,
  // never the boot-anchored observer). The governed identity now comes
  // from the create RESPONSE, identity-asserted; the boot-anchor read
  // survives only as a recorded NOTE beside the governed channel.
  const unwrapRemoteProc = (body) => {
    const v = body?.result?.value
    return v && typeof v === 'object' && 'data' in v ? v.data : v
  }
  const echoedRoot = unwrapRemoteProc(created.body)?.rootSessionId ?? null
  const teamSessionId = echoedRoot ?? assembly.CREATE_ROOT
  if (teamSessionId !== assembly.CREATE_ROOT || teamSessionId === assembly.ROOT) {
    failRest(`governed Team Session identity mismatch: create echoed ${String(echoedRoot)}, expected ${assembly.CREATE_ROOT} (never the boot root ${assembly.ROOT})`)
    return
  }
  const stateSnapshot = async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    return st?.body ?? null
  }
  const controlSnapshot = async () => (await stateSnapshot())?.control ?? null
  // The governed session's durable Control lane over the PRODUCT read
  // plane: remote team.getLedgerPage, paged, FAIL LOUD on an error page
  // (the kit's run-9 law: an error read as an empty ledger launders a
  // broken read plane into zeros). A request is pending until a decision/
  // consumption/abandon fact settles the same requestId.
  const CONTROL_FACT_TYPES = ['control-request-recorded', 'control-decision-recorded', 'control-allow-consumed', 'control-request-abandoned']
  const governedControlSnapshot = async () => {
    const byType = Object.fromEntries(CONTROL_FACT_TYPES.map((t) => [t, []]))
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 20; pageNo += 1) {
      const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage',
        { teamSessionId, afterSequence, limit: 500 }, 'u6proc-ledger', 1)
      const r = page?.body?.result
      if (page?.status !== 200 || r?.ok !== true) {
        throw new Error(`team.getLedgerPage failed (page ${String(pageNo + 1)}, afterSequence=${String(afterSequence)}): status=${String(page?.status)} ${JSON.stringify(r?.error ?? r ?? null).slice(0, 200)}`)
      }
      const data = unwrapRemoteProc(page.body)
      const entries = Array.isArray(data?.entries) ? data.entries : []
      for (const e of entries) {
        if (byType[e?.factType] === undefined) continue
        let payload = e.payload
        if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
        byType[e.factType].push({ sequence: e.sequence, payload: payload ?? {} })
      }
      const next = data?.nextAfterSequence
      if (next === null || next === undefined || entries.length === 0) break
      afterSequence = Number(next)
    }
    const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']]
      .map((f) => String(f.payload?.requestId ?? '')))
    return {
      requests: byType['control-request-recorded'].map((f) => ({
        requestId: String(f.payload?.requestId ?? ''),
        kind: f.payload?.kind ?? null,
        toolName: f.payload?.toolName ?? null,
        summary: String(f.payload?.summary ?? '').slice(0, 120),
        operationFingerprint: f.payload?.operationFingerprint ?? null,
        status: settled.has(String(f.payload?.requestId)) ? 'settled' : 'pending',
      })),
      decisions: byType['control-decision-recorded'].map((f) => ({ requestId: String(f.payload?.requestId ?? ''), decision: f.payload?.decision ?? null })),
      consumptions: byType['control-allow-consumed'].map((f) => ({ requestId: String(f.payload?.requestId ?? '') })),
    }
  }
  // The observation-channel record the judge reads (see judgeU6Proc's
  // positive-read law): a zero-row claim only counts on a channel that has
  // shown a row THIS run CREATED.
  const controlRead = {
    channel: 'remote:team.getLedgerPage',
    teamSessionId,
    anchoredToBootRoot: false,
    positiveReadProven: false,
    bootAnchorNote: null,
  }
  // Bridge forensics: the AUTH bridge (pa-control-bridge) and the plane
  // record every PA-leg stage (leg-deny details included) in the row's
  // observations stream — the p6t6 observer publishes it verbatim. The
  // positive arm captures those lines so every refusal carries its OWN
  // stated cause in the evidence, never an inferred one.
  const FORENSIC = /a5-pa-bridge|pa-ask|PA ask|production-admission|a5m1-binding|exec dual-gate|dual-gate/i
  const forensicLines = new Set()
  const captureForensic = async () => {
    const st = await stateSnapshot()
    for (const line of (st?.observations ?? [])) {
      const text = String(line ?? '')
      if (FORENSIC.test(text)) forensicLines.add(text.slice(0, 400))
    }
  }
  const resolvedAsks = []
  laneDone.mask = await wakeCadence('U6PROC_MASK_DONE', 90_000, 'm')
  laneDone.deny = await wakeCadence('U6PROC_DENY_DONE', 90_000, 'd')
  // ── review-r1 POSITIVE arm: the ask-lane member (default:ask, no shell
  // rule) issues its governed team_bash; the call BLOCKS on its real
  // pending Control row. The runner observes the row through the p6t6
  // observer (no private API) and settles it with the PUBLIC
  // team.resolveControl v4 seam — the very endpoint the GUI calls for a
  // human operator. Approval -> bridge -> kernel consumeOnce (exactly one
  // port call; the consumption row count is the durable witness) -> the
  // confined provider REALLY spawns; the world-workspace marker file is
  // the independent oracle. The member then re-issues the identical
  // command in-world (same approval-case identity): the replay attempt
  // must be refused and must NOT spawn a second process.
  const apprArm = { pendingSeen: false, requestId: null, kind: null, resolveBody: null, resolvedOk: false, waitedMs: null, pendingAny: [], forensic: [] }
  {
    // The leader chain needs WAKES to reach create-asker + delegate-d3,
    // and the appr call only blocks (creating the pending row) after that
    // delegate lands — so the fence cadence runs CONCURRENTLY with the
    // pending-row poll; the resolve fires as soon as the row is observed.
    const apprDrive = wakeCadence('U6PROC_APPR_DONE', 150_000, 'a')
    const pend = await waitA(async () => {
      await captureForensic()
      const st = await stateSnapshot()
      const governed = await governedControlSnapshot().catch((error) => {
        apprArm.channelError = String(error?.message ?? error).slice(0, 200)
        return null
      })
      if (governed === null) return false
      const pending = (governed.requests ?? []).filter((r) => r.status === 'pending' && (r.toolName === 'team_bash' || /tool:team_bash|tool=team_bash/.test(String(r.summary ?? ''))))
      if (pending.length > 0) apprArm.pendingAny = pending.map((r) => ({ requestId: String(r.requestId).slice(0, 60), kind: r.kind ?? null, summary: String(r.summary ?? '').slice(0, 160) }))
      // The asker's own row: its case id embeds the asker instanceId
      // (tadm:<team>:<instanceId>:<fp>:g0) — exact attribution, never a
      // borrowed row from an earlier lane. The templateId lookup rides the
      // same observer read (members list); no private API.
      const askerInst = (st?.members ?? []).find((m) => m.templateId === 'asker')?.instanceId ?? null
      const exact = askerInst === null
        ? pending[0] ?? null
        : pending.find((r) => String(r.summary ?? '').includes(`:${askerInst}:`) || r.targetInstanceId === askerInst) ?? null
      // The asker is the ONLY ask-lane template in this world (mask/deny
      // settle synchronously and never open rows), so exactly one pending
      // row IS the asker's — attribution recorded, never silently borrowed.
      const p = exact ?? (pending.length === 1 ? pending[0] : null)
      if (p !== undefined && p !== null) {
        apprArm.pendingSeen = true
        apprArm.requestId = p.requestId
        apprArm.kind = p.kind ?? null
        apprArm.attribution = exact !== null ? 'exact-instance' : 'sole-pending-row'
        // POSITIVE READ: this channel just showed a row THIS run created.
        controlRead.positiveReadProven = true
        return true
      }
      return false
    }, 120_000)
    apprArm.waitedMs = pend.waitedMs
    if (apprArm.pendingSeen) {
      const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
        { teamSessionId, requestId: apprArm.requestId, decision: 'allow', note: 'u6proc-review-r1-positive-arm' }, 'u6proc-approve', 4)
      apprArm.resolveBody = JSON.stringify(res?.body ?? null).slice(0, 500)
      apprArm.resolvedOk = res?.status === 200 && res?.body?.result?.ok === true
      resolvedAsks.push({ tag: 'approve', requestId: apprArm.requestId, kind: apprArm.kind, firstBody: apprArm.resolveBody, secondBody: null })
    }
    laneDone.appr = await apprDrive
  }
  // The leader exec calls ride the DUAL-GATED allow lane (measured law at
  // this baseline: the shell ask is born-terminal for EVERY rung —
  // fingerprint resource pins requiredAuthority=human-admin and A1-12 has
  // no Admin resolver; the leader allow-lane + envelope 'bash' token is the
  // legal spawnable lane, exec-autonomy-contract ruling 2026-09-18). No
  // approval wait: the kernel admits, the confined provider spawns.
  laneDone.pos = await wakeCadence('U6PROC_POS_DONE', 90_000, 'p')
  // ── the Human-User seam replay arm: resolve a requestId that the durable
  // control service does NOT hold open (the born-terminal ask cases close
  // DECIDED — listControlState skips decided rows — so their ids are not
  // pendable; the seam's exactly-once law is the same closed CONTROL_*
  // vocabulary on any non-open id). Recorded for proc:replay-settled-refusal.
  laneDone.posReplay = await (async () => {
    // Same governed lane as the positive arm (R-U6P3-1): the replay names
    // a row read on the session the lanes ACTUALLY opened rows on.
    const governedPre = await governedControlSnapshot().catch(() => null)
    // Since the review-r1 positive arm legitimately opens and settles the
    // appr case, this arm names a BORN-TERMINAL ask (its summary carries
    // the mask/deny claim — a request the service closed decided, never
    // held open): the settled-replay law is measured on the case the
    // born-terminal close created, not on the authorised one.
    const bornTerminal = (governedPre?.requests ?? [])
      .find((r) => r.status !== 'pending' && /U6PROC_(MASK|DENY)_|u6proc-(mask|deny)/.test(String(r.summary ?? '')))
    const decided = (governedPre?.decisions ?? []).find((x) => x.requestId !== apprArm.requestId)
    const requestId = bornTerminal?.requestId ?? decided?.requestId ?? apprArm.requestId ?? 'u6proc-unknown-request'
    // v4: team.resolveControl is the v4-only human control-resolution
    // command (s6-remote.ts:4106); a v1 envelope is refused with
    // method-version-unsupported BEFORE any control-service work.
    const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
      { teamSessionId, requestId, decision: 'allow', note: 'u6proc-c2-replay-arm' }, 'u6proc-replay', 4)
    resolvedAsks.push({ tag: 'replay', requestId, kind: bornTerminal?.kind ?? 'non-open', firstBody: JSON.stringify(res?.body ?? null).slice(0, 500), secondBody: null })
    return true
  })()
  laneDone.swapTrigger = await fireTrigger(assembly.markers.T_SWAP, () => probeLedger().some((r) => r.leg === 'spoof-attempt' && r.trigger === 'probe-body'))
  laneDone.swap = await wakeCadence('U6PROC_SWAP_DONE', 90_000, 'w')
  laneDone.restoreTrigger = await fireTrigger(assembly.markers.T_RESTORE, () => probeLedger().some((r) => r.leg === 'spoof-restore'))
  laneDone.late = await wakeCadence('U6PROC_LATE_DONE', 90_000, 'l')
  laneDone.leader = await wakeCadence('U6PROC_L1_DONE', 45_000, 'z')
  laneDone.channelReg = await fireTrigger(assembly.markers.T_CHANNEL, () => probeLedger().some((r) => r.leg === 'channel-attempt'), 60_000)
  laneDone.channelCall = await fireTrigger(assembly.markers.T_CHANNELCALL, () => probeLedger().some((r) => r.leg === 'channel-body-ran'), 60_000)
  // CI-03 native control on the UNGOVERNED boot-root session (wake() would
  // hit the team root — wrong subject). Success predicate = the mock corpus
  // shows the model asked for the NATIVE 'bash' tool with the ctl claim;
  // whether the host-native approval posture then ran or held the call is
  // HOST-owned and NOT required by the verdict (absence-of-mediation arm).
  laneDone.ctl = await fireTrigger(assembly.markers.T_CTL, () => (world.mock?.requests ?? []).some((r) => {
    const t = JSON.stringify(r?.body?.messages ?? [])
    return t.includes('"name":"bash"') && t.includes(assembly.claims.ctl)
  }), 45_000)
  if (!laneDone.leader) {
    const stuck = world.mock.requests.map((r) => (r.reply?.kind === 'text' ? String(r.reply.content ?? '') : '')).filter((x) => x.startsWith('U6PROC_ID_FAIL') || x.startsWith('U6PROC_GATE_HOLD') || x.startsWith('U6PROC_FENCE_HOLD') || x.startsWith('U6PROC_EXEC_HOLD'))
    log(`leader chain did not close cleanly${stuck.length > 0 ? ` (${stuck[stuck.length - 1]})` : ''}; verdicts read the evidence as-is`)
  }
  // the terminate-honesty window: the late command sleeps 6 s then writes;
  // the row timeout is 1.5 s. Absence AFTER the sleep window + the timeout
  // word in the answer = the provider killed the payload (terminate arm).
  await sleep(9_000)

  // ── evidence collection ───────────────────────────────────────────────────
  const probeRows = probeLedger()
  const markerFiles = listMarkers()
  const spoofBodyMarkers = markerFiles.filter((m) => m.startsWith('spoof-bash-body-ran-'))
  const channelMarkers = markerFiles.filter((m) => m.startsWith('channel-body-ran-'))
  const bashExecutes = probeRows.filter((r) => r.leg === 'bash-execute')
  const bashResults = probeRows.filter((r) => r.leg === 'bash-result')
  const notifTurns = (world.mock?.requests ?? []).filter((r) => JSON.stringify(r?.body?.messages ?? r?.messages ?? []).includes('[team-control requestId=')).length
  const claimOccurrences = (claim) => (world.mock?.requests ?? []).reduce((n, r) =>
    n + toolMsgsOf(r).filter((m) => String(m.text).includes(claim)).length, 0)
  const hits = kernelHits()
  await captureForensic()
  apprArm.forensic = [...forensicLines].slice(0, 40)
  const ctlFinal = await controlSnapshot()
  const governedFinal = await governedControlSnapshot().catch((error) => {
    controlRead.finalControlError = String(error?.message ?? error).slice(0, 200)
    return null
  })
  // The boot-anchor observer stays RECORDED (counts only): the honest
  // witness that it structurally misses the governed rows.
  controlRead.bootAnchorNote = ctlFinal === null
    ? null
    : { requests: (ctlFinal.requests ?? []).length, decisions: (ctlFinal.decisions ?? []).length, consumptions: (ctlFinal.consumptions ?? []).length }
  const controlDigest = governedFinal === null ? null : {
    requests: (governedFinal.requests ?? []).map((r) => ({ requestId: r.requestId, kind: r.kind ?? null, status: r.status, toolName: r.toolName ?? null, summary: String(r.summary ?? '').slice(0, 90), operationFingerprint: r.operationFingerprint ?? null })),
    decisions: governedFinal.decisions ?? [],
    consumptions: governedFinal.consumptions ?? [],
  }
  const decisionsFor = (requestId) => (controlDigest?.decisions ?? []).filter((d) => d.requestId === requestId).length
  const consumptionsFor = (requestId) => (controlDigest?.consumptions ?? []).filter((c) => c.requestId === requestId).length
  // Per-ask notification evidence: the MASK ask's own requestId must never
  // appear in a leader notification turn (born-terminal asks are never
  // notified); the positive arm's appr ask may legitimately notify.
  const maskAskRid = (controlDigest?.requests ?? [])
    .find((r) => /U6PROC_MASK_|u6proc-mask/.test(String(r.summary ?? '')))?.requestId ?? null
  // No mask ask row EVER exists ⇒ there is nothing of the mask case's to
  // notify: zero is the measured fact (the born-terminal close happens
  // inside the call; the notification port fires only on row creation).
  // A row that exists is counted by its OWN requestId — the positive
  // arm's asker notification must never be mistaken for the mask case's.
  const notifTurnsMask = maskAskRid === null
    ? 0
    : (world.mock?.requests ?? []).filter((r) => JSON.stringify(r?.body?.messages ?? r?.messages ?? [])
      .includes(`[team-control requestId=${maskAskRid}`)).length
  const approveEvidence = {
    ...apprArm,
    decisions: apprArm.requestId === null ? 0 : decisionsFor(apprArm.requestId),
    consumptions: apprArm.requestId === null ? 0 : consumptionsFor(apprArm.requestId),
  }
  const digest = {
    surface, denyList,
    effects: Object.fromEntries(Object.entries(assembly.files).map(([k]) => [k, assembly.readEffect(k)])),
    effectLines: Object.fromEntries(Object.entries(assembly.files).map(([k]) => [k, assembly.effectLines(k)])),
    spoofBodyMarkers, channelMarkers,
    registerAttempts: probeRows.filter((r) => r.leg === 'spoof-register'),
    swapAttempts: probeRows.filter((r) => r.leg === 'spoof-attempt'),
    restoreRows: probeRows.filter((r) => r.leg === 'spoof-restore'),
    channelRows: probeRows.filter((r) => r.leg === 'channel-attempt' || r.leg === 'channel-body-ran'),
    bashExecutes: bashExecutes.map((r) => ({ tool: r.tool, command: String(r.command ?? '').slice(0, 90), agent: r.agent })),
    bashResults: bashResults.map((r) => ({ tool: r.tool, isError: r.isError, head: String(r.head ?? '').slice(0, 180) })),
    resolvedAsks,
    controlDigest,
    controlRead,
    notifTurns,
    notifTurnsMask,
    approveEvidence,
    kernelHits: hits,
    laneDone,
    claims: Object.fromEntries(Object.entries(assembly.claims).map(([k, c]) => [k, claimOccurrences(c)])),
  }
  add('proc:mounted', earlyMount.teamSession && (probeLedger().find((r) => r.leg === 'register' && r.kind === 'probe-tool'))?.ok === true
    && hostAlive()
    && hits['a5g7: placement-feed rows='].count > 0
    && hits['a5-plane: mount-REFUSED'].count === 0
    && hits['a5-plane: placement-REFUSED'].count === 0
    && hits['PLANE_KERNEL_UNAVAILABLE'].count === 0
    && hits['PLANE_PROCESS_REGISTRATION_REFUSED'].count === 0
    && hits['PLANE_READ_REGISTRATION_REFUSED'].count === 0
    ? 'PASS' : 'FAIL', {
    ...earlyMount,
    hostAlive: hostAlive(),
    kernelHits: hits,
    note: 'ONE kernel for both families: the placement feed lists team_bash AND read (ARC-B visible from the Host log); a refused registration or an unbuildable kernel would name itself in the log (mount-wide law, PR3)',
  })
  record.record.u6procDigest = digest
  try {
    writeFileSync(join(evidence, `${runId}.u6proc-evidence.json`), JSON.stringify(digest, null, 2) + '\n')
  } catch { /* evidence is best-effort; the RUN record carries the digest */ }

  // ── verdicts (shared judge — the SAME function the offline
  // reconstruct uses; the evidence digest above is its entire input) ──────
  for (const [id, verdict, detail] of judgeU6Proc(digest, hostAlive())) add(id, verdict, detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
}

export default {
  suite: 'u6-proc',
  cases: CASES,
  totalRequests: 130,
  run: (opts, ctx) => runU6Proc(opts, ctx),
}
