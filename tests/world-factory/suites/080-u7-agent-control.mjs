/**
 * tests/world-factory/suites/080-u7-agent-control.mjs — the `u7-agent-control`
 * C2 suite (U7-F): the seven governed agent-control rows on the production
 * Team row, mounted as ONE family over the FamilyAssembly seam, ONE World,
 * ZERO center diff (CA-01). Boot budget: ONE host start (≤3 declared).
 *
 * Verdict law: every witness is PUBLIC — the mock transcripts (the rows' own
 * tool_result heads, what the model saw, verbatim), the governed session
 * ledger over team.getLedgerPage v1 (the durable Control rows: recorded /
 * settled — the enumeration's ask REALLY opened and the runner REALLY
 * settled it through team.resolveControl v4), and host-log witnesses of the
 * plane's own lines. A DISCLOSED arm (the fail-closed spawn without a wired
 * caller-authority snapshot) is recorded REFUSED with its verbatim head —
 * never promoted to PASS; a governed walk whose port leg answers typed is
 * recorded REFUSED verbatim — never flipped.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../lib/u6-fs-assembly.mjs'
import { createU7FaAssembly, makeU7FaDecide, judgeU7Fa, AGENT_CONTROL_MANAGED_NAMES } from '../lib/u7fa-assembly.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CASES = Object.freeze(['ac:mounted', 'ac:enumerate-governed', 'ac:spawn-failclosed', 'ac:interrupt-foreign-zero', 'ac:leak-check'])

async function runU7AgentControl({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const CASE_IDS = CASES
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
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
  const world = await factory.createWorld({ line, u7AgentControl: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createU7FaAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles()
  world.u7AgentControl.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeU7FaDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u7fa-boot1' })
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
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u7fa-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const laneDone = { pilot: false, leader: false }
  record.record.u7faLanes = laneDone

  // ── readiness: p6t6 health + anchored Team Session ───────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('ac:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.phase === 'create' && stateBody?.teamSession !== null
  }, 90_000)

  // ── discovery -> blueprint -> team.create ────────────────────────────────
  let surface = []
  let cookie = null
  let created = null
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
  } else {
    cookie = await authenticate(origin, world.token)
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7fa')
    if (discPrompt.status !== 200) {
      failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    } else {
      const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
      if (!discW.hit) {
        failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
      } else {
        const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
        surface = [...new Set(disc)].sort()
        // The governed family names + the lifecycle/team set + todo_write
        // stay on the surface; everything else the host offers is DENIED so
        // the pilot's transcript carries ONLY the family's answers.
        const denyList = surface.filter((n) => !n.startsWith('team_')
          && !AGENT_CONTROL_MANAGED_NAMES.includes(n)
          && !['todo_write'].includes(n))
        assembly.writeMainBlueprint(denyList)
        created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
        const createOk = created.status === 200 && created.body?.result?.ok === true
        if (!createOk) {
          failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
        }
      }
    }
  }

  // ── the governed session ledger + the runner approver (PUBLIC seams only) ─
  const unwrapRemote = (body) => {
    const v = body?.result?.value
    return v && typeof v === 'object' && 'data' in v ? v.data : v
  }
  const echoedRoot = created === null ? null : unwrapRemote(created.body)?.rootSessionId ?? null
  const teamSessionId = echoedRoot ?? assembly.CREATE_ROOT
  const identityOk = created !== null && teamSessionId === assembly.CREATE_ROOT && teamSessionId !== assembly.ROOT
  if (created !== null && !identityOk) {
    failRest(`governed Team Session identity mismatch: create echoed ${String(echoedRoot)}, expected ${assembly.CREATE_ROOT}`)
    return
  }
  const familyNameRe = /subagent|subagent_fork|send_message|interrupt_agent|list_agents|list_subagent_models|workflow/
  const controlRows = new Map()
  const resolutions = []
  const governedControlRows = async () => {
    const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 20; pageNo += 1) {
      const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage',
        { teamSessionId, afterSequence, limit: 500 }, 'u7fa-ledger', 1)
      const r = page?.body?.result
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
  const approver = (async () => {
    if (!identityOk) return
    while (!approverStop) {
      try {
        for (const r of (await governedControlRows())) {
          controlRows.set(String(r.requestId), { toolName: r.toolName, summary: r.summary, status: r.status })
          const tag = `${String(r.toolName ?? '')} ${String(r.summary ?? '')}`
          // The runner settles ONLY the family's ASK rows (the enumeration);
          // every other row would be an UNEXPECTED row the judge reads as a
          // law break — the approver never papers over it.
          if (r.status === 'pending' && familyNameRe.test(tag)) {
            const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
              { teamSessionId, requestId: r.requestId, decision: 'allow', note: 'u7fa-c2-approval' }, 'u7fa-approve', 4)
            const ok = res?.status === 200 && res?.body?.result?.ok === true
            resolutions.push({ requestId: r.requestId, toolName: r.toolName, status: res?.status ?? null, ok })
          }
        }
      } catch (err) { approverErrors.push(String(err?.message ?? err).slice(0, 200)) }
      await sleep(1200)
    }
  })()

  // ── drive ─────────────────────────────────────────────────────────────────
  if (identityOk) {
    const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
    const wake = async (tag) => {
      const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7FA_PHASE_${tag}`, 'u7fa-wake')
      if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
    }
    const wakeCadence = async (content, deadlineMs, tag) => {
      const t0 = Date.now()
      let lastWake = 0
      let wakes = 0
      for (;;) {
        if (replySeen(content)) return true
        if (Date.now() - t0 > deadlineMs) return replySeen(content)
        if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
        await sleep(350)
      }
    }
    laneDone.pilot = await wakeCadence('U7FA_PILOT_DONE', 180_000, 'p')
    laneDone.leader = await wakeCadence('U7FA_L1_DONE', 120_000, 'z')
  }
  // settle window: a late ledger row / late tool result still lands.
  await sleep(6_000)
  approverStop = true
  try { await approver } catch { /* observational */ }

  // ── evidence: the pilot transcript's own tool_result heads ───────────────
  const requests = world.mock?.requests ?? []
  const pilotEnvelope = `[team-work requestToken=${assembly.tokens('d1')}`
  const pilotReqs = requests.filter((r) => JSON.stringify((r?.body?.messages ?? r?.messages ?? []).map((m) => (m?.role === 'user' ? m.content : ''))).includes(pilotEnvelope))
  const pilotReq = pilotReqs.length === 0 ? null : pilotReqs[pilotReqs.length - 1]
  const pilotExchanges = []
  if (pilotReq !== null) {
    const msgs = pilotReq?.body?.messages ?? pilotReq?.messages ?? []
    for (let i = 0; i < msgs.length; i += 1) {
      const m = msgs[i]
      if (m?.role !== 'assistant' || !Array.isArray(m?.content)) continue
      for (const b of m.content) {
        if (b?.type !== 'tool_use') continue
        const name = String(b?.name ?? '')
        if (!AGENT_CONTROL_MANAGED_NAMES.includes(name)) continue
        let head = ''
        for (let j = i + 1; j < msgs.length && head === ''; j += 1) {
          const u = msgs[j]
          if (u?.role !== 'user' || !Array.isArray(u?.content)) continue
          for (const rb of u.content) {
            if (rb?.type !== 'tool_result') continue
            const txt = (Array.isArray(rb?.content) ? rb.content : []).map((c) => c?.text ?? '').join('')
              ?? String(rb?.content ?? '')
            if (txt !== '') head = txt
          }
        }
        pilotExchanges.push({ name, resultHead: head })
      }
    }
  }
  let logLines = []
  try {
    const text = readFileSync(boot.logPath, 'utf8')
    logLines = text.split('\n').filter((l) => /placement-feed rows=|a5-plane: (mount|placement)-REFUSED|agent-control-|PLANE_AGENT_CONTROL_REGISTRATION_REFUSED/.test(l))
  } catch { /* log unreadable → verdicts fall to the ledger + transcripts */ }

  record.record.u7faDigest = {
    teamSessionId,
    surface,
    pilotExchangeHeads: pilotExchanges.map((e) => ({ name: e.name, head: e.resultHead.slice(0, 400) })),
    controlRows: [...controlRows.entries()].map(([requestId, r]) => ({ requestId, ...r })),
    resolutions,
    approverErrors,
    logHits: logLines.slice(-40).map((l) => l.slice(0, 240)),
  }
  try {
    writeFileSync(join(evidence, `${runId}.u7fa-evidence.json`), JSON.stringify(record.record.u7faDigest, null, 2) + '\n')
  } catch { /* evidence is best-effort */ }

  const verdicts = judgeU7Fa({
    healthOk: health?.body?.ok === true,
    stateOk: stateW.hit,
    surface,
    hostAlive: hostAlive(),
    laneDone,
    pilotExchanges,
    controlRows: [...controlRows.entries()].map(([requestId, r]) => ({ requestId, ...r })),
    resolutions,
    log: logLines,
  })
  for (const [id, verdict, detail] of verdicts) {
    if (!done.has(id)) add(id, verdict, detail)
  }

  // ── leak-check ────────────────────────────────────────────────────────────
  // Sample aliveness BEFORE our own stop (stopChild makes it false by design).
  const diedMidRun = !hostAlive()
  try { await rc.stopChild() } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  if (!done.has('ac:leak-check')) add('ac:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
  if (diedMidRun && !done.has('ac:host-died')) log('host died during the run (verdicts read the evidence as-is)')
}

export default {
  suite: 'u7-agent-control',
  cases: CASES,
  totalRequests: 60,
  run: (opts, ctx) => runU7AgentControl(opts, ctx),
}
