/**
 * tests/world-factory/suites/085-u7r3-uif4-pos.mjs — the `u7r3-uif4-pos` C2
 * suite: is a governed `ask_user_question` able to reach a HUMAN ANSWER over
 * public faces only? (the ledger `:647` DISCLOSED arm's positive leg).
 *
 * ONE World, ONE boot, every cell in this single drive (the C-册 budget row is
 * the only path past a retry). The runner plays the Human resolver exactly as
 * u7-f-web proved it (p6t6 ledger face to READ, public team.resolveControl v4
 * to SETTLE — the leader carries no control tool, so no decision in this
 * record can have come from the model lane), and additionally carries the one
 * face LEG-0 pinned offline but never ran live: a cookie-carrying
 * `/api/remote.mux` `$events` stream that answers a pending
 * `user-questions/request` waterfall through `POST /api/$events/result`.
 *
 * Two ask arms share the boot so the record separates the two claims that
 * f3's disclosure fused:
 *   ARM A  the governed member row (the target — the cell is about THIS row);
 *   ARM B  the host's OWN `ask_user_question` tool in a plain session (the
 *          discriminator — its call site passes `exec.agent`, so if the
 *          answering face can reach a Client at all, this arm sees it).
 *
 * INVOCATION LAW (learned the hard way on this lane): the runner writes its
 * RUN record ONLY when `--run-record <path>` is passed. Both of this lane's
 * starts omitted it, so the durable record is the stdout RUN-SUMMARY plus the
 * suite's own `*.uif4-evidence.json`; the next lane MUST pass --run-record with
 * one per-start record file placed in this suite's evidence c2 directory (a
 * tracked directory in the lane branch; spelled out here as prose so the
 * docs:sync cited-path law never trips on a placeholder shape).
 *
 * Honesty law: a verdict is earned by a named witness (host-log observe line,
 * the ledger face, the mock transcript's tool_result head, or the runner's own
 * disk read). Silence is FAIL, and a step the drive never arrived at is
 * NOT_REACHED — never a softened PASS.
 */
import { apiPrompt, apiSessionCreate, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../lib/u6-fs-assembly.mjs'
import { classifyUnwitnessedArm, envSignal } from '../lib/arm-verdict.mjs'
import { createUif4Assembly, judgeUif4, makeUif4Decide } from '../lib/u7r3-uif4-assembly.mjs'
import { createEventsAnswerer, EVENTS_ENDPOINT, EVENTS_RESULT_ENDPOINT, REMOTE_MUX_PATH } from '../lib/u7r3-uif4-answer.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CASES = Object.freeze([
  'ui:ask-approved-ran',
  'ui:ask-approval-chain',
  'ui:ask-replay-refused',
  'ui:answer-wire',
  'ui:live-root-law',
  'ui:present-env-truth',
  'ui:leak-check',
])

const LOG_RE = /governed-ask|governed-present|placement-feed rows=|a5-plane: (mount|placement)-REFUSED|PLANE_UI_REGISTRATION_REFUSED|TOOL_BINDING_UNVERIFIED|user-questions|NO_PROVIDER/

async function runUif4Pos({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, findFirstKey, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const CASE_IDS = CASES
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 260)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
  }

  // THE NO-PATH-LEAKS-ANYTHING LAW (start#1 RCA: an early return left the
  // answerer's socket open and the world half-alive, and the run had to be
  // killed with no RUN record). Every exit — success, bail-out, or throw —
  // goes through cleanup(): close the stream, stop the child, tear the world
  // down, and only then settle the leak cell.
  let answerer = null
  let cleanedUp = false
  // Hoisted so cleanup() can ALWAYS see it: start#2's leak-check FAILed with
  // "world is not defined" because the const lived inside the try block and
  // the finally-clause closure could not reach it. The World itself was torn
  // down by the runner's own registry, but a lane cell must never fail on the
  // lane's own scope error, so the binding is declared before the cleanup.
  let world = null
  const HARD_STOP_MS = 7.5 * 60_000
  const hardStopAt = Date.now() + HARD_STOP_MS
  const overBudget = () => Date.now() > hardStopAt
  const cleanup = async () => {
    if (cleanedUp) return
    cleanedUp = true
    try { answerer?.stop() } catch { /* already gone */ }
    try { await rc.stopChild() } catch { /* idempotent */ }
    let leak = { ok: false, detail: { reason: 'teardown not reached' } }
    try {
      if (world === null) {
        leak = { ok: true, detail: { reason: 'no World was ever created — nothing of this lane is left behind' } }
      } else {
        const receipts = await world.teardown({ keepHome })
        leak = await evaluateLeak({ world, receipts, factory })
      }
    } catch (error) {
      leak = { ok: false, detail: { reason: `teardown threw: ${String(error?.message ?? error).slice(0, 160)}` } }
    }
    if (!done.has('ui:leak-check')) add('ui:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  }
  try {
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try { hit = (await predicate()) === true } catch { hit = false }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs || overBudget()) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }

  // ── materialize + boot (ONE host start of a declared ≤3 budget) ──────────
  world = await factory.createWorld({ line, u7FsUi: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createUif4Assembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  const planted = assembly.writePreBootFiles()
  world.u7FsUi.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeUif4Decide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'uif4-boot1' })
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
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'uif4-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  // The lane's own record header (the order asks for host sha / plugin sha /
  // port / DSH_HOME explicitly; the runner binds the rest).
  record.record.uif4Run = {
    subjectTeamSha: record.record.bindings.teamSha,
    hostSha: record.record.bindings.hostSha,
    canaryPluginSha256: record.record.bindings.canaryPluginSha256,
    port: boot.port,
    dshHome: world.home,
    dshHomeRelative: String(world.home).startsWith(REPO_ROOT) ? world.home.slice(REPO_ROOT.length + 1) : world.home,
    logPath: boot.logPath,
  }

  // ── readiness ────────────────────────────────────────────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && st.body?.ok === true
  }, 60_000)
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 45_000)

  let cookie = null
  let surface = []
  if (!healthW.hit || health?.body?.ok !== true || !stateW.hit) {
    failRest(`mount readiness failed: health=${String(health?.status)} stateHit=${String(stateW.hit)}`)
    return
  }
  cookie = await authenticate(origin, world.token)

  // ── the answering arm is OPEN before any question can exist ──────────────
  answerer = createEventsAnswerer({ port: boot.port, cookie, log })
  const facts = {
    wire: { muxPath: REMOTE_MUX_PATH, endpoint: EVENTS_ENDPOINT, resultEndpoint: EVENTS_RESULT_ENDPOINT, readySeen: false, readyFrame: null, openError: null, waterfallSeen: false, waterfallShapeOk: false, resultAccepted: false },
    approval: { requestRows: [], decisions: [], consumed: [], resolutions: [] },
    secondResolve: null,
    answered: [],
    waterfallFrames: [],
    assertLiveRootObserved: false,
    answeredLabel: 'Option A',
    native: { created: null, sessionId: null, done: false, toolResultHead: null },
  }
  await answerer.start()
  const ready = await answerer.waitReady(12_000)
  facts.wire.openError = answerer.facts.openError
  facts.wire.readySeen = ready
  facts.wire.readyFrame = answerer.facts.readyFrame
  const pumpAnswers = async () => {
    const fresh = await answerer.answerPending(fetchJson)
    for (const entry of fresh) {
      facts.answered.push(entry)
      if (entry.httpStatus === 200 && /"ok"\s*:\s*true/.test(entry.responseHead)) facts.wire.resultAccepted = true
      if (/DELEGATED_CALLER|CALLER_NOT_LIVE|lane-refusal/.test(entry.responseHead)) facts.assertLiveRootObserved = true
    }
    if (answerer.facts.waterfallFrames.length > 0) {
      facts.waterfallFrames = answerer.facts.waterfallFrames
      facts.wire.waterfallSeen = true
      facts.wire.waterfallShapeOk = answerer.facts.waterfallFrames.every((f) => f.event === 'user-questions/request'
        && typeof f.eventId === 'string' && typeof f.agentId === 'string' && Array.isArray(f.questions))
    }
  }

  // ── discovery → blueprint → team.create ──────────────────────────────────
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'uif4')
  if (discPrompt.status !== 200) {
    failRest(`discovery prompt rejected: ${String(discPrompt.status)}`)
    return
  }
  const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 60_000 })
  if (!discW.hit) {
    failRest('discovery model request absent (deny list cannot be computed)')
    return
  }
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  surface = [...new Set(disc)].sort()
  const denyList = surface.filter((n) => !n.startsWith('team_')
    && !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh'].includes(n)
    && !['todo_write'].includes(n))
  assembly.writeMainBlueprint(denyList)
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } }, 'uif4-create', 1)
  if (!(created.status === 200 && created.body?.result?.ok === true)) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── the runner IS the Human resolver (u7-f-web proven shape) ─────────────
  const unwrap = (body) => {
    const v = body?.result?.value
    return v && typeof v === 'object' && 'data' in v ? v.data : v
  }
  const ledgerFacts = async () => {
    const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 4; pageNo += 1) {
      if (approverStop || overBudget()) break
      // The approver must never be the thing that outlives the drive: every
      // page call races a short timer (start#1 lesson — an unbounded join on
      // this loop is what stalled the run past the run-control watchdog).
      const page = await Promise.race([
        remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage',
          { teamSessionId: assembly.CREATE_ROOT, afterSequence, limit: 500 }, 'uif4-ledger', 1),
        sleep(8_000).then(() => null),
      ])
      if (page === null) { approverErrors.push('getLedgerPage raced out (8s)'); break }
      const r = page?.body?.result
      if (page?.status !== 200 || r?.ok === false) {
        throw new Error(`team.getLedgerPage failed: status=${String(page?.status)} ${JSON.stringify(r ?? null).slice(0, 160)}`)
      }
      const data = unwrap(page.body)
      const entries = Array.isArray(data?.entries) ? data.entries : []
      for (const e of entries) {
        if (byType[e?.factType] === undefined) continue
        let payload = e.payload
        if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
        byType[e.factType].push({ payload: payload ?? {} })
      }
      const next = data?.nextAfterSequence
      if (next === null || next === undefined || entries.length === 0) break
      afterSequence = Number(next)
    }
    return byType
  }
  const rowsFrom = (byType) => {
    const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']]
      .map((f) => String(f.payload?.requestId ?? '')))
    const rows = []
    for (const f of byType['control-request-recorded']) {
      const p = f.payload ?? {}
      if (p.requestId === undefined) continue
      rows.push({
        requestId: String(p.requestId),
        toolName: p.toolName ?? null,
        summary: String(p.summary ?? '').slice(0, 200),
        status: settled.has(String(p.requestId)) ? 'settled' : 'pending',
      })
    }
    return rows
  }
  let approverStop = false
  const approverErrors = []
  const resolved = new Map()
  let allowRequestId = null
  const approver = (async () => {
    for (;;) {
      if (approverStop) return
      try {
        const byType = await ledgerFacts()
        const rows = rowsFrom(byType)
        facts.approval.requestRows = rows.map((r) => ({ requestId: String(r.requestId).slice(0, 16), toolName: r.toolName, status: r.status, summary: r.summary.slice(0, 120) }))
        facts.approval.decisions = (byType['control-decision-recorded'] ?? []).map((f) => ({ requestId: String(f.payload?.requestId ?? '').slice(0, 16), decision: f.payload?.decision ?? f.payload?.outcome ?? null }))
        facts.approval.consumed = (byType['control-allow-consumed'] ?? []).map((f) => ({ requestId: String(f.payload?.requestId ?? '').slice(0, 16) }))
        for (const r of rows) {
          if (approverStop || overBudget()) break
          const rid = String(r?.requestId ?? '')
          if (rid === '' || resolved.has(rid) || r?.status !== 'pending') continue
          const tag = `${String(r?.toolName ?? '')} ${String(r?.summary ?? '')}`
          const mine = /ask_user_question|user question|interaction|ask/i.test(tag)
          const decision = resolved.size === 0 ? 'allow' : 'deny'
          const res = await Promise.race([
            remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
              { teamSessionId: assembly.CREATE_ROOT, requestId: rid, decision, note: `uif4-c2-${decision}${mine ? '' : '-unmatched'}` }, 'uif4-approval', 4),
            sleep(15_000).then(() => null),
          ])
          const ok = res?.status === 200 && (res?.body?.result?.ok === true || res?.body?.result?.value !== undefined)
          resolved.set(rid, { decision, ok })
          facts.approval.resolutions.push({
            requestId: rid, decision, ok, matchedAsk: mine, resolveStatus: res?.status ?? null,
            bodyHead: JSON.stringify(res?.body ?? null).slice(0, 200), toolName: r.toolName,
          })
          log(`approval ${decision} requestId=${rid.slice(0, 12)}… ok=${String(ok)} matched=${String(mine)}`)
          if (decision === 'allow' && ok && allowRequestId === null) {
            allowRequestId = rid
            // THE CONSUME-ONCE WITNESS: the SAME requestId, settled again,
            // through the same public seam. The seam must refuse.
            const again = await Promise.race([
              remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
                { teamSessionId: assembly.CREATE_ROOT, requestId: rid, decision: 'allow', note: 'uif4-c2-replay' }, 'uif4-replay', 4),
              sleep(15_000).then(() => null),
            ])
            facts.secondResolve = {
              requestId: rid,
              ok: again?.status === 200 && again?.body?.result?.ok === true,
              status: again?.status ?? null,
              bodyHead: JSON.stringify(again?.body ?? null).slice(0, 240),
            }
            log(`replay resolve ok=${String(facts.secondResolve.ok)} status=${String(facts.secondResolve.status)}`)
          }
        }
      } catch (err) { approverErrors.push(String(err?.message ?? err).slice(0, 200)) }
      await sleep(350)
    }
  })()

  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `UIF4_PHASE_${tag}`, 'uif4-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (content, deadlineMs, tag, onEach = null) => {
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (onEach !== null) { try { await onEach() } catch { /* the pump never breaks a drive */ } }
      if (replySeen(content)) return true
      if (Date.now() - t0 > deadlineMs || overBudget()) return replySeen(content)
      if (Date.now() - lastWake > 3000 && wakes < 20) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await sleep(350)
    }
  }

  const laneDone = { uigov: false, leader: false }
  laneDone.uigov = await wakeCadence('UIF4_UI_DONE', 110_000, 's', pumpAnswers)
  laneDone.leader = await wakeCadence('UIF4_L1_DONE', 35_000, 'z', pumpAnswers)
  record.record.uif4Lanes = laneDone

  // ── ARM B: the host's OWN ask_user_question in a plain session ───────────
  try {
    const createdSession = await apiSessionCreate(origin, cookie, world.workspaceDir, 'uif4-native')
    facts.native.created = { status: createdSession.status, bodyHead: JSON.stringify(createdSession.body ?? null).slice(0, 200) }
    const nativeSessionId = findFirstKey(createdSession.body, 'sessionId')
    facts.native.sessionId = typeof nativeSessionId === 'string' ? nativeSessionId : null
    if (typeof nativeSessionId === 'string') {
      await apiPrompt(origin, cookie, nativeSessionId, assembly.markers.MK_NATIVE, 'uif4-native')
      facts.native.done = await wakeCadence('UIF4_NATIVE_DONE', 50_000, 'n', pumpAnswers)
      const lastNative = [...(world.mock?.requests ?? [])].reverse().find((r) => hasMarker(r, assembly.markers.MK_NATIVE)
        && JSON.stringify(r.body?.messages ?? []).includes('tool_result'))
      const msgs = lastNative?.body?.messages ?? []
      const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
      facts.native.toolResultHead = typeof lastUser?.content === 'string'
        ? lastUser.content.slice(0, 400)
        : JSON.stringify(lastUser?.content ?? null).slice(0, 400)
    }
  } catch (error) {
    facts.native.error = String(error?.message ?? error).slice(0, 200)
  }

  answerer.stop()
  approverStop = true
  try { await approver } catch { /* exits on the flag */ }
  record.record.uif4Asks = { ...facts.approval, errors: approverErrors, secondResolve: facts.secondResolve }
  record.record.uif4Wire = {
    ...facts.wire, answered: facts.answered, frames: answerer.facts.frames.length,
    transportTypes: answerer.facts.transportTypes, transportErrors: answerer.facts.transportErrors,
    unwrappedFrames: answerer.facts.unwrappedFrames, streamEnded: answerer.facts.streamEnded,
    rawFrames: answerer.facts.frames.slice(0, 6),
    closeError: answerer.facts.closeError?.message ?? null,
  }
  record.record.uif4Native = facts.native

  // ── evidence: host-log witnesses + the mock transcript heads + disk ──────
  let logLines = []
  try {
    const text = readFileSync(boot.logPath, 'utf8')
    logLines = text.split('\n').filter((l) => LOG_RE.test(l))
  } catch { /* unreadable log → verdicts fall to the transcript */ }
  const journal = (world.mock?.requests ?? []).slice(-80).map((rec) => {
    const msgs = rec.body?.messages ?? []
    const toolUses = msgs.flatMap((m) => m?.role === 'assistant' && Array.isArray(m.content)
      ? m.content.filter((b) => b?.type === 'tool_use').map((b) => String(b.name)) : [])
    const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
    const resultHead = typeof lastUser?.content === 'string' ? lastUser.content.slice(0, 400)
      : Array.isArray(lastUser?.content)
        ? (lastUser.content.find((b) => b?.type === 'tool_result')?.content?.slice?.(0, 400)
           ?? JSON.stringify(lastUser.content[0] ?? '').slice(0, 400))
        : null
    return {
      seq: rec.seq,
      nCalls: toolUses.length,
      lastCall: toolUses.length > 0 ? toolUses[toolUses.length - 1] : null,
      resultHead,
    }
  })
  const oracle = assembly.readOracleFacts()
  record.record.uif4Digest = {
    planted, oracle, surface,
    logHits: {
      askRan: logLines.filter((l) => l.includes('governed-ask RAN')).length,
      askRefusals: logLines.filter((l) => l.includes('governed-ask') && !l.includes('RAN')).map((l) => l.slice(0, 220)),
      presentLines: presentHead(logLines),
      noProvider: logLines.filter((l) => /NO_PROVIDER/.test(l)).map((l) => l.slice(0, 220)),
      planeRefusals: logLines.filter((l) => /REFUSED|TOOL_BINDING_UNVERIFIED/.test(l)).map((l) => l.slice(0, 220)),
    },
    journal,
  }
  try {
    writeFileSync(join(evidence, `${runId}.uif4-evidence.json`), JSON.stringify({
      run: record.record.uif4Run, wire: record.record.uif4Wire, asks: record.record.uif4Asks,
      native: record.record.uif4Native, digest: record.record.uif4Digest,
    }, null, 2) + '\n')
  } catch { /* evidence is best-effort */ }

  const hostAlive = world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null
  const verdicts = judgeUif4({
    facts, log: logLines, journal, laneDone, hostAlive,
    healthOk: health?.body?.ok === true, stateOk: stateW.hit,
  })

  // ── the R-ENVBLOCK-1 law: an arm that never arrived is NOT_REACHED, and an
  // environment claim needs a quotable host line. Nothing here may soften.
  const envWall = envSignal({
    channel: 'host-log',
    text: logLines.find((l) => /a5-plane: (?:mount|placement)-REFUSED|EADDRINUSE|EACCES|EPERM/.test(l)) ?? null,
    observed: logLines,
  })
  const reached = {
    askRow: facts.approval.requestRows.length > 0 || logLines.some((l) => l.includes('governed-ask')),
    wire: facts.wire.readySeen === true,
    present: journal.some((e) => e?.lastCall === 'present') || logLines.some((l) => l.includes('governed-present')),
  }
  for (const [id, verdict, detail] of verdicts) {
    if (done.has(id)) continue
    if (verdict === 'FAIL') {
      const reachedKey = id === 'ui:answer-wire' ? 'wire' : (id === 'ui:present-env-truth' ? 'present' : 'askRow')
      if (!reached[reachedKey]) {
        const v = classifyUnwitnessedArm({ step: id, reachedStep: false, signal: envWall, extra: detail })
        add(id, v.verdict, v.detail)
        continue
      }
    }
    add(id, verdict, detail)
  }

  log(`uif4 run ${runId}: lanes=${JSON.stringify(laneDone)} answers=${String(facts.answered.length)} waterfalls=${String(facts.waterfallFrames.length)} resolutions=${String(facts.approval.resolutions.length)} approverErrors=${JSON.stringify(approverErrors).slice(0, 200)}`)
  } finally {
    // Every path — success, bail-out return, or a thrown drive — stops the
    // stream, stops the child and tears the world down before the run ends.
    // No orphaned sockets, no half-alive world, no unwritten record.
    await cleanup()
  }
}

function presentHead(logLines) {
  return logLines.filter((l) => l.includes('governed-present')).map((l) => l.slice(0, 220))
}

export default {
  suite: 'u7r3-uif4-pos',
  cases: CASES,
  totalRequests: 90,
  run: (opts, ctx) => runUif4Pos(opts, ctx),
}
