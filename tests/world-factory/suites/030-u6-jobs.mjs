/**
 * tests/world-factory/suites/030-u6-jobs.mjs — the `u6-jobs` C2 suite,
 * collected by u5-canary-runner.mjs from this directory (u7-w0, 2026-10-26).
 *
 * Moved VERBATIM out of u5-canary-runner.mjs at origin/master 88107ad71 (the
 * suite's SUITE_CASES entry + its comment, its run function and the banner
 * above it, and its totalRequests budget) so a new suite lane ADDS a file here
 * and edits no shared list in the runner. The only textual changes: the runner
 * helpers it used arrive through the `ctx` argument, `SUITE_CASES['u6-jobs']`
 * reads the module's own CASES, and imports name exactly what the body uses.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf, MANAGED_TOOL_NAMES, SAFE_UNMANAGED_TOOL_NAMES } from '../lib/u6-fs-assembly.mjs'
import { createJobsAssembly, makeJobsDecide, judgeU6Jobs, toolExchanges, laneTranscript, extractJobIds, JOBS_WORLD_MANAGED_NAMES } from '../lib/u6-jobs-assembly.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// U6 PR4 C2 (ARC-C, the FIRST named Bridge at the Host): the jobs trio
// mounted through the governance kernel on a live World — a REAL
// background job born on the member native lane whose EFFECT stands on
// disk (independent Oracle), managed through the bridge (list/output/
// kill), foreign viewer refused with measured zero settlement, kill
// answered as REQUEST only with the HOST settling, the boot-root native
// control untouched, and the no-second-ledger law measured over the
// durable Control lane. U7-R3 pilot C2 adds the job_list DENY-LEG arm
// (J4's live mirror): the foreign lane's own background birth is DENIED
// on the durable Control lane by the RUNNER, and job_list witnesses the
// denied call as UNBORN — typed refusal, honest zero, foreign scope clean.
const CASES = Object.freeze(['jobs:mounted', 'jobs:birth-positive', 'jobs:ci05-governed-fail-closed', 'jobs:owner-fence', 'jobs:list-deny-leg-honest-zero', 'jobs:kill-refusal-zero-reach', 'jobs:ctl-native-untouched', 'jobs:no-second-ledger', 'jobs:leak-check'])

/**
 * U6 PR4 C2 (ARC-C at the Host). ONE boot. The leader chain creates a
 * WORKER (birth + management lane) and a FOREIGN viewer; the worker's
 * script births TWO real background jobs on the member NATIVE bash lane
 * (the confined governed row refuses `run_in_background` by name — the
 * disclosed CI-03 law at this pin) and then manages them through the
 * kernel-mounted trio (the first named Bridge riding the SAME admission
 * path as read/team_bash); the foreign lane attempts to manage the owner's
 * REAL job id (learned through the leader's collect — a real teammate's
 * channel) and must be refused while the job provably keeps running. The
 * kill answer must be REQUEST vocabulary, the FINAL marker must never land
 * (the host settled), and the boot-root's NATIVE trio must show zero
 * kernel involvement. Every effect fact is read from DISK by this runner —
 * the tool returns are cross-checked, never trusted.
 */
async function runU6Jobs({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
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
  const world = await factory.createWorld({ line, u6Jobs: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createJobsAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles()
  world.u6Jobs.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeJobsDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u6jobs-boot1' })
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
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6jobs-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  const kernelHits = () => {
    const pats = ['a5g7: placement-feed rows=', 'job_output', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED',
      'PLANE_KERNEL_UNAVAILABLE', 'PLANE_JOBS_REGISTRATION_REFUSED', 'PLANE_READ_REGISTRATION_REFUSED',
      'PLANE_PROCESS_REGISTRATION_REFUSED', 'cannot be verified at dispatch']
    let text = ''
    try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
    const out = {}
    for (const p of pats) {
      const lines = text.split('\n').filter((l) => l.includes(p))
      out[p] = { count: lines.length, sample: lines.length > 0 ? redactLine(lines[lines.length - 1]) : null }
    }
    return out
  }

  // ── readiness ────────────────────────────────────────────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('jobs:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
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
  // (R-U6P4-2) the boot-root p6t6 state snapshot is NOT a control channel:
  // its control block is anchored to the legacy boot team. Control
  // observation lives below, on the governed session's ledger page.

  // ── discovery -> blueprint -> team.create ────────────────────────────────
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6jobs')
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
  // In THIS world the trio IS managed (the governed rows mount them) —
  // builtinToolDeny would cover the un-managed surface only.
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n)
    && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !JOBS_WORLD_MANAGED_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive (proc rhythm) ──────────────────────────────────────────────────
  // R-U6P4-2 / R-U6P3-1 (harness half): TARGET THE GOVERNED TEAM SESSION.
  // Every durable Control row of this world (the member-birth asks — and the
  // trio rows that must NEVER exist) belongs to the Team session that
  // team.create just returned, NOT to the legacy boot team the p6t6 observer
  // anchors (/__p6t6/state's control block is root-ANCHOR-scoped — the PR-D
  // kit names that law verbatim). Boots 4-7 read that blind channel:
  // controlRows [] while ask rows sat UNREAD on the governed session, and
  // from boot 5 (the envelope that lets the ask lane open rows) every parked
  // member lane was the visible symptom of this wrong-root observation.
  // Since team.create may run before the observer would ever see it, the
  // governed identity comes from the create RESPONSE, identity-asserted.
  const unwrapRemote = (body) => {
    const v = body?.result?.value
    return v && typeof v === 'object' && 'data' in v ? v.data : v
  }
  const echoedRoot = unwrapRemote(created.body)?.rootSessionId ?? null
  const teamSessionId = echoedRoot ?? assembly.CREATE_ROOT
  if (teamSessionId !== assembly.CREATE_ROOT || teamSessionId === assembly.ROOT) {
    failRest(`governed Team Session identity mismatch: create echoed ${String(echoedRoot)}, expected ${assembly.CREATE_ROOT} (never the boot root ${assembly.ROOT})`)
    return
  }
  const replyPrefixSeen = (prefix) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith(prefix))
  const wakeLog = []
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6JOBS_PHASE_${tag}`, 'u6jobs-wake')
    wakeLog.push({ tag, status: pr.status })
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (prefix, deadlineMs, tag) => {
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replyPrefixSeen(prefix)) return true
      if (Date.now() - t0 > deadlineMs) return replyPrefixSeen(prefix)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  // The durable Control lane of the GOVERNED team session, OBSERVED
  // continuously over the PRODUCT read plane: remote team.getLedgerPage
  // (the p6t6 state route is boot-root-anchored and structurally cannot
  // see these rows — the PR-D kit's named law). Every poll merges its rows
  // into the record map. Member-birth asks (tool:bash) are settled through
  // the PUBLIC team.resolveControl seam NAMED FOR THE GOVERNED SESSION;
  // trio rows are NEVER settled (their existence would itself be the
  // second-ledger violation this suite measures).
  const trioNameRe = /job_(output|list|kill)/
  const controlRows = new Map()
  const birthRow = { seen: false, resolved: false, resolutions: [] }
  const governedControlRows = async () => {
    const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 20; pageNo += 1) {
      const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage',
        { teamSessionId, afterSequence, limit: 500 }, 'u6jobs-ledger', 1)
      const r = page?.body?.result
      // FAIL LOUD on an error page (the kit's run-9 law: an error read as
      // an empty ledger silently launders a broken read plane into zeros).
      if (page?.status !== 200 || r?.ok !== true) {
        throw new Error(`team.getLedgerPage failed (page ${String(pageNo + 1)}, afterSequence=${String(afterSequence)}): status=${String(page?.status)} ${JSON.stringify(r?.error ?? r ?? null).slice(0, 200)}`)
      }
      const data = unwrapRemote(page.body)
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
    const rows = []
    for (const f of byType['control-request-recorded']) {
      const p = f.payload ?? {}
      if (p.requestId === undefined) continue
      rows.push({
        requestId: String(p.requestId),
        toolName: p.toolName ?? null,
        summary: String(p.summary ?? '').slice(0, 120),
        status: settled.has(String(p.requestId)) ? 'settled' : 'pending',
      })
    }
    return rows
  }
  let approverStop = false
  const approverErrors = []
  // U7-R3 pilot C2 (job_list deny-leg): the runner becomes the DENIER for
  // the foreign lane's OWN background birth. Time-window law: the WORK
  // lane must settle first (its bash asks are births the suite needs), the
  // foreign lane runs only afterwards — by construction every bash ask row
  // armed after laneDone.work is the deny-leg subject. The row's identity
  // is NOT inferred from the PA summary (it carries only case/rung/tool/
  // effects counts, never the command) — it is ORDER + lane sequencing, and
  // the judge's witnesses (typed APPROVAL_DENIED, zero birth, honest-zero
  // list) bind the answer to the leg.
  const denyWindow = { active: false }
  const denyRow = { seen: false, denied: false, resolutions: [] }
  const approver = (async () => {
    while (!approverStop) {
      try {
        for (const r of (await governedControlRows())) {
          controlRows.set(String(r.requestId), { toolName: r.toolName, summary: r.summary, status: r.status })
          const tag = `${String(r.toolName ?? '')} ${String(r.summary ?? '')}`
          if (r.status === 'pending' && /\bbash\b/.test(tag) && !trioNameRe.test(tag)) {
            if (denyWindow.active && !denyRow.seen) {
              denyRow.seen = true
              const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
                { teamSessionId, requestId: r.requestId, decision: 'deny', note: 'u7r3-c2-deny-leg' }, 'u6jobs-denyleg', 4)
              const ok = res?.status === 200 && res?.body?.result?.ok === true
              denyRow.denied = denyRow.denied || ok
              denyRow.resolutions.push({ requestId: r.requestId, status: res?.status ?? null, ok })
              continue
            }
            if (denyWindow.active) continue // a bash ask armed after the deny leg is NOT this leg's witness — never auto-allow it
            birthRow.seen = true
            const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
              { teamSessionId, requestId: r.requestId, decision: 'allow', note: 'u6jobs-c2-birth-approval' }, 'u6jobs-birth', 4)
            const ok = res?.status === 200 && res?.body?.result?.ok === true
            birthRow.resolved = birthRow.resolved || ok
            birthRow.resolutions.push({ requestId: r.requestId, status: res?.status ?? null, ok })
          }
        }
      } catch (err) { approverErrors.push(String(err?.message ?? err).slice(0, 200)) }
      await sleep(1200)
    }
  })()
  const laneDone = {}
  record.record.u6jobsLanes = laneDone
  laneDone.work = await wakeCadence('U6JOBS_WORK_DONE', 180_000, 'w')
  // U7-R3 pilot C2: with the work lane settled (its birth asks resolved),
  // every later bash ask row is the foreign deny-leg subject — the DENIER
  // window opens (see the approver block).
  denyWindow.active = true
  laneDone.foreign = await wakeCadence('U6JOBS_FENCE_DONE', 180_000, 'f')
  laneDone.leader = await wakeCadence('U6JOBS_L1_DONE', 90_000, 'z')
  // CI-03 native control on the UNGOVERNED boot-root session.
  laneDone.ctl = await (async () => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.T_CTL, 'u6jobs-ctl')
    if (pr.status !== 200) return false
    return (await waitA(() => replyPrefixSeen('U6JOBS_CTL_RAN'), 90_000)).hit
  })()
  // settle window: the kill-subject sleeps 35 s between its warm marker and
  // its FINAL marker; a survived (leaked) job lands FINAL INSIDE this
  // window — the absence the judge measures is meaningful, not early exit.
  await sleep(45_000)
  approverStop = true
  try { await approver } catch { /* observational */ }

  // ── evidence ─────────────────────────────────────────────────────────────
  const requests = world.mock?.requests ?? []
  // ENVELOPE match, not the raw token: the delegation token also rides
  // the LEADER's team_delegate ARGS, so matching it picks the leader's
  // transcript and MISSES every member exchange (run 2/3 receipts proved
  // the contamination: trioUses saw only the root's single call). The
  // `[team-work requestToken=` envelope text exists only in the member
  // session's own user message.
  const wReq = laneTranscript(requests, `[team-work requestToken=${assembly.tokens('d1')}`)
  const fReq = laneTranscript(requests, `[team-work requestToken=${assembly.tokens('d2')}`)
  const cReq = laneTranscript(requests, assembly.markers.T_CTL)
  const wEx = wReq === null ? [] : toolExchanges(wReq)
  const fEx = fReq === null ? [] : toolExchanges(fReq)
  const cEx = cReq === null ? [] : toolExchanges(cReq)
  const firstNamed = (ex, name) => (ex.find((e) => e.name === name) ?? { result: null }).result
  const lastNamed = (ex, name) => { for (let i = ex.length - 1; i >= 0; i -= 1) if (ex[i]?.name === name) return ex[i].result; return null }
  const namesJob = (e, name, id) => e?.name === name && id !== undefined && id !== null && String(e.args?.job_id ?? '') === String(id)
  const firstFor = (ex, name, id) => (ex.find((e) => namesJob(e, name, id)) ?? { result: null }).result
  const lastFor = (ex, name, id) => { for (let i = ex.length - 1; i >= 0; i -= 1) if (namesJob(ex[i], name, id)) return ex[i].result; return null }
  const jobIds = extractJobIds(wEx.map((e) => e.result).join('\n'))
  let finalControlError = null
  try {
    for (const r of (await governedControlRows())) {
      controlRows.set(String(r.requestId), { toolName: r.toolName, summary: r.summary, status: r.status })
    }
  } catch (err) { finalControlError = String(err?.message ?? err).slice(0, 200) }
  let hostLogText = ''
  try { hostLogText = readFileSync(boot.logPath, 'utf8') } catch { /* unreadable */ }
  const settleEvents = (jobId, re) => jobId === undefined || jobId === null ? 0
    : hostLogText.split('\n').filter((l) => l.includes(String(jobId)) && re.test(l)).length
  const rootKernelMentions = (() => {
    if (cReq === null) return 0
    const t = JSON.stringify(cReq?.body?.messages ?? cReq?.messages ?? [])
    return (t.match(/a5jobs|a5-plane|placement-feed|kernelGuard/gi) ?? []).length
  })()
  // R-U6P4-2 leader-lane telemetry: boots 4-7 could not answer the obvious
  // question ('what did the LEADER ever exchange?') because the digest only
  // transcribed the two member lanes and the root. The leader rides the
  // governed root session: every request whose transcript carries the
  // root-work envelope / phase pings / settled notices / control
  // notifications, minus any member request (the member envelope is
  // `[team-work requestToken=` and appears ONLY in the member's own
  // transcript — the run-2/3 contamination law again, inverted).
  const isLeaderReq = (r) => {
    const t = JSON.stringify(r?.body?.messages ?? r?.messages ?? [])
    if (t.includes('[team-work requestToken=')) return false
    return t.includes('[team-root-work') || t.includes('U6JOBS_PHASE_')
      || t.includes(assembly.markers.MK_L1) || t.includes('[team-work-settled')
      || t.includes('[team-control requestId=')
  }
  const leaderReqs = requests.filter(isLeaderReq)
  const leaderReq = leaderReqs.length > 0 ? leaderReqs[leaderReqs.length - 1] : null
  const leaderEx = leaderReq === null ? [] : toolExchanges(leaderReq)
  const leaderLastText = (() => {
    for (let i = leaderReqs.length - 1; i >= 0; i -= 1) {
      const rep = leaderReqs[i]?.reply
      if (rep?.kind === 'text') return String(rep.content ?? '').slice(0, 160)
    }
    return null
  })()
  const digest = {
    runId, worldId: world.id,
    kernelHits: kernelHits(),
    claims: assembly.claims,
    claim1Text: assembly.readEffect('claim1'),
    jobIds,
    list1: firstNamed(wEx, 'job_list'),
    output1: firstFor(wEx, 'job_output', jobIds[0]) ?? firstNamed(wEx, 'job_output'),
    output2: firstFor(wEx, 'job_output', jobIds[1]),
    output2Post: lastFor(wEx, 'job_output', jobIds[1]),
    kill2: firstNamed(wEx, 'job_kill'),
    list2: lastNamed(wEx, 'job_list'),
    foreignOutput: firstNamed(fEx, 'job_output'),
    foreignKill: firstNamed(fEx, 'job_kill'),
    // U7-R3 pilot C2 deny-leg witnesses (J4 live mirror): the DENIED
    // foreign birth answer, the honest-zero foreign list, the ZERO spawn
    // vocabulary in the foreign lane, and the observed+DENIED ask row.
    foreignDenyBash: firstNamed(fEx, 'bash'),
    foreignList: firstNamed(fEx, 'job_list'),
    foreignJobIds: extractJobIds(fEx.map((e) => String(e.result ?? '')).join('\n')),
    denyLegIssued: fEx.some((e) => e.name === 'bash'),
    denyRow,
    ctlOutput: lastNamed(cEx, 'job_output'),
    trioUses: [...wEx, ...fEx, ...cEx].filter((e) => e.name !== null && trioNameRe.test(String(e.name))).length,
    controlRows: [...controlRows.values()],
    birthRow,
    // WHERE the control rows were read from — the digest names its own
    // channel so a receipt can never again claim governed-session zeros from
    // the boot-root observer (R-U6P3-1's positive-read precondition is the
    // judge's; these fields are the evidence it reads).
    controlRead: {
      channel: 'remote:team.getLedgerPage',
      teamSessionId,
      anchoredToBootRoot: false,
      positiveReadProven: birthRow.seen === true,
      approverErrors: [...new Set(approverErrors)].slice(-4),
      ...(finalControlError !== null ? { finalControlError } : {}),
    },
    // R-U6P4-2: the leader's own lane, transcript-first (a silent leader must
    // now say WHAT it saw, from the receipt alone).
    leaderLane: {
      requests: leaderReqs.length,
      exchanges: leaderEx.length,
      lastText: leaderLastText,
      wakes: wakeLog.length,
      wakeRejected: wakeLog.filter((s) => s.status !== 200).length,
      tail: leaderEx.slice(-8).map((e) => ({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 220) })),
    },
    settle: {
      killLines: settleEvents(jobIds[1], /aborted|killed|cancel-requested/i),
      foreignKillLines: settleEvents(jobIds[0], /aborted|killed|cancel-requested/i),
    },
    rootKernelMentions,
    lanes: { ...laneDone },
    // compact transcript tails per lane (a stalled chain must be diagnosable
    // from the receipt alone — every field below is truncated transcript text,
    // never a secret: no token rides a tool result).
    debug: {
      worker: wEx.slice(-8).map((e) => ({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 220) })),
      foreign: fEx.slice(-4).map((e) => ({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 220) })),
      root: cEx.slice(-3).map((e) => ({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 220) })),
      // global diagnostics: what did the HOST answer EVERY bash/trio call
      // anywhere in the world (dedup, truncated) — a stalled birth must
      // name its own cause in the receipt, boot 2/3 lesson.
      bashResults: [...new Set(requests.flatMap((r) => toolExchanges(r))
        .filter((e) => e.name === 'bash')
        .map((e) => JSON.stringify({ args: e.args ?? null, result: String(e.result ?? '').slice(0, 200) })))]
        .slice(-10),
      trioResults: [...new Set(requests.flatMap((r) => toolExchanges(r))
        .filter((e) => e.name !== null && trioNameRe.test(String(e.name)))
        .map((e) => JSON.stringify({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 200) })))]
        .slice(-12),
    },
  }
  record.record.u6jobsDigest = digest
  try {
    writeFileSync(join(evidence, `${runId}.u6jobs-evidence.json`), JSON.stringify(digest, null, 2) + '\n')
  } catch { /* evidence best-effort; the RUN record carries the digest */ }

  // ── verdicts (shared judge; the digest is its entire input) ─────────────
  // Three-way law for the deny-leg arm (no ENV_BLOCK forging): ENV_BLOCK is
  // minted ONLY when the leg genuinely issued its birth attempt, NO ask
  // row ever reached the ledger face, and nothing was born either (the
  // approval lane died upstream — the 070-web precedent's honest shape). A
  // row that WAS seen, or a birth that DID happen, is graded: FAIL.
  for (const [id, verdict, detail] of judgeU6Jobs(digest, hostAlive())) {
    if (id === 'jobs:list-deny-leg-honest-zero' && verdict === 'FAIL'
      && digest.denyRow?.seen !== true && digest.denyLegIssued === true
      && (digest.foreignJobIds ?? []).length === 0) {
      add(id, 'ENV_BLOCK', { ...detail, reason: 'the foreign deny-leg birth attempt was issued but no ask row reached the durable ledger face (the observer saw zero rows, and nothing was born either — the leg died upstream of the approval lane, no refusal witness exists)' })
      continue
    }
    add(id, verdict, detail)
  }

  // ── leak-check: teardown, then the factory's owned-resources audit ──────
  try {
    await rc.stopChild()
  } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  add('jobs:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
}

export default {
  suite: 'u6-jobs',
  cases: CASES,
  totalRequests: 130,
  run: (opts, ctx) => runU6Jobs(opts, ctx),
}
