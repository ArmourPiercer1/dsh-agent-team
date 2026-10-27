/**
 * tests/world-factory/suites/120-u7-astore.mjs — the `u7-astore` C2 suite:
 * the AGENT-STATE family on the production Team row with its PRODUCTION
 * durable store (no injected port), ONE World, ZERO center diff.
 * Boot budget: ONE host start per run, ≤3 declared for the lane (every
 * actual start is listed in the run record's hostStarts and the shared
 * budget ledger).
 *
 * Before ANY host start the runner asserts the World home (= the host's
 * DSH_HOME, where the store writes) realpaths under `tests/homes/`
 * (docs/TEST_METHODS.md §1/§7) — never ~/.dsh, never :3080's home.
 *
 * Verdict law: the runner's OWN reads — the store files ON DISK (raw JSON,
 * nlink, the durable writes/attempts ledgers, plus a fresh production store
 * instance over the same home), the governed Control ledger
 * (team.getLedgerPage v1), the mock transcripts (what the model saw) and
 * host-log witnesses. A positive the host's own authority refuses is
 * REFUSED verbatim, never flipped; silence FAILS.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf, messagesOf } from '../lib/u6-fs-assembly.mjs'
import { AGENT_STATE_NAMES, createU7AStoreAssembly, judgeU7AStore, makeU7AStoreDecide } from '../lib/u7astore-assembly.mjs'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const CASES = Object.freeze([
  'ast:mounted', 'ast:store-under-world-home', 'ast:create-goal-positive', 'ast:get-goal-readback',
  'ast:update-goal-positive', 'ast:exit-plan-mode-positive',
  'ast:todo-write-positive', 'ast:cross-scope-zero-effect', 'ast:leak-check',
])

async function runU7AStore({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 260)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASES) if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
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

  // ── materialize; the home guard runs BEFORE the first host start ─────────
  const world = await factory.createWorld({ line, u7AStore: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const homesRoot = realpathSync(join(REPO_ROOT, 'tests', 'homes'))
  const homeReal = realpathSync(world.home)
  const homeUnderTests = homeReal.startsWith(`${homesRoot}${sep}`)
  const assembly = createU7AStoreAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  record.record.bindings.agentStateStore = {
    base: 'DSH_HOME/team-state/agent-state/<realmId>',
    baseRelativeToHome: assembly.readStoreOnDisk().base,
    realmId: assembly.PLANE_REALM_ID,
    homeUnderTestsHomes: homeUnderTests,
    homeSource: 'the host process DSH_HOME (the World home) — read by the family descriptor at build; no injected port',
    bootBudgetDeclared: 3,
  }
  if (!homeUnderTests) {
    failRest(`refusing to boot: the World home ${homeReal} is not under tests/homes (TEST_METHODS §1/§7)`)
    return
  }
  assembly.writePreBootFiles()
  // DISCLOSED plant (see assembly): leader-scope plan mode ON, pre-boot,
  // through the production store's own atomic seed path.
  let plantedPlanScope = null
  try {
    const laneMod = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'agent-state-family', 'src', 'fs-state-store.mjs')).href)
    plantedPlanScope = await assembly.plantLeaderPlanMode(laneMod, homeReal)
    record.record.bindings.agentStateStore.plantedPlanModeScope = plantedPlanScope
  } catch (error) {
    log(`plan-mode plant failed: ${String(error?.message ?? error).slice(0, 160)}`)
    record.record.bindings.agentStateStore.plantError = String(error?.message ?? error).slice(0, 300)
  }
  world.u7AStore.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeU7AStoreDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u7as-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try { boot = await startPromise } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u7as-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  // ── readiness ────────────────────────────────────────────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && st.body?.ok === true
  }, 120_000)
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    return st.status === 200 && st.body?.rootSessionId === assembly.ROOT && st.body?.teamSession !== null
  }, 90_000)

  const lanes = { goalTurn: false, worker: false, leader: false }
  const controlRows = new Map()
  const resolutions = []
  const approverErrors = []
  let cookie = null
  let teamSessionId = assembly.CREATE_ROOT
  if (!healthW.hit || !stateW.hit) {
    log(`readiness failed: health=${String(health?.status)} state=${String(stateW.hit)}`)
  } else {
    cookie = await authenticate(origin, world.token)
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7as')
    const discW = discPrompt.status === 200
      ? await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
      : { hit: false }
    if (discW.hit) {
      const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
      const denyList = [...new Set(disc)].sort().filter((n) => !n.startsWith('team_') && !AGENT_STATE_NAMES.includes(n))
      assembly.writeMainBlueprint(denyList)
      const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
      record.record.u7asCreate = { status: created.status, ok: created.body?.result?.ok === true, body: JSON.stringify(created.body ?? null).slice(0, 600) }
      if (created.status === 200 && created.body?.result?.ok === true) {
        const v = created.body?.result?.value
        const data = v && typeof v === 'object' && 'data' in v ? v.data : v
        teamSessionId = data?.rootSessionId ?? assembly.CREATE_ROOT
        // ── the runner = the Human resolver (public seams only) ─────────────
        const unwrap = (body) => { const x = body?.result?.value; return x && typeof x === 'object' && 'data' in x ? x.data : x }
        const ledgerRows = async () => {
          const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
          let afterSequence = 0
          for (let pageNo = 0; pageNo < 20; pageNo += 1) {
            const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage', { teamSessionId, afterSequence, limit: 500 }, 'u7as-ledger', 1)
            if (page?.status !== 200 || page?.body?.result?.ok === false) throw new Error(`team.getLedgerPage failed: ${String(page?.status)}`)
            const data2 = unwrap(page.body)
            const entries = Array.isArray(data2?.entries) ? data2.entries : []
            for (const e of entries) {
              if (byType[e?.factType] === undefined) continue
              let payload = e.payload
              if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
              byType[e.factType].push({ payload: payload ?? {} })
            }
            const next = data2?.nextAfterSequence
            if (next === null || next === undefined || entries.length === 0) break
            afterSequence = Number(next)
          }
          const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']].map((x) => String(x.payload?.requestId ?? '')))
          return byType['control-request-recorded'].filter((x) => x.payload?.requestId !== undefined).map((x) => ({
            requestId: String(x.payload.requestId), toolName: x.payload.toolName ?? null, summary: String(x.payload.summary ?? '').slice(0, 140),
            status: settled.has(String(x.payload.requestId)) ? 'settled' : 'pending',
          }))
        }
        const nameRe = /todo_write|create_goal|get_goal|update_goal|exit_plan_mode/
        let stop = false
        const approver = (async () => {
          while (!stop) {
            try {
              for (const r of await ledgerRows()) {
                controlRows.set(r.requestId, r)
                if (r.status === 'pending' && nameRe.test(`${String(r.toolName ?? '')} ${r.summary}`) && !resolutions.some((x) => x.requestId === r.requestId)) {
                  const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl', { teamSessionId, requestId: r.requestId, decision: 'allow', note: 'u7as-c2-human-approval' }, 'u7as-approve', 4)
                  resolutions.push({ requestId: r.requestId, toolName: r.toolName, status: res?.status ?? null, ok: res?.status === 200 && res?.body?.result?.ok === true })
                  log(`approval allow ${r.requestId.slice(0, 14)} tool=${String(r.toolName)} status=${String(res?.status)}`)
                }
              }
            } catch (err) { approverErrors.push(String(err?.message ?? err).slice(0, 200)) }
            await sleep(900)
          }
        })()
        const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
        const toolSeen = (name) => (world.mock?.requests ?? []).some((r) => (r.reply?.toolCalls ?? []).some((c) => c?.name === name))
        // the leader's first turn (initialWork) parks waiting for the human
        await waitUntil(() => replySeen('U7AS_L1_WAITING_FOR_HUMAN'), { timeoutMs: 90_000 })
        // THE DIRECT-HUMAN TURN: a real session/prompt from the runner
        const goalPrompt = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, assembly.markers.MK_GOAL, 'u7as-human')
        record.record.u7asGoalPrompt = { status: goalPrompt.status }
        lanes.goalTurn = (await waitUntil(() => toolSeen('team_delegate'), { timeoutMs: 240_000 })).hit === true
        const wakeCadence = async (content, deadlineMs, tag) => {
          const t0 = Date.now()
          let lastWake = 0
          let wakes = 0
          for (;;) {
            if (replySeen(content)) return true
            if (Date.now() - t0 > deadlineMs) return replySeen(content)
            if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7AS_PHASE_${tag}`, 'u7as-wake').catch(() => {}) }
            await sleep(350)
          }
        }
        lanes.worker = await wakeCadence('U7AS_WORKER_DONE', 200_000, 'w')
        lanes.leader = await wakeCadence('U7AS_L1_DONE', 90_000, 'z')
        await sleep(4_000)
        stop = true
        try { await approver } catch { /* loop exits on the flag */ }
      }
    }
  }

  // ── evidence: transcripts (per lane), host log, DISK ─────────────────────
  const requests = world.mock?.requests ?? []
  const workerEnv = `[team-work requestToken=${assembly.tokens('d1')}`
  const isWorker = (r) => JSON.stringify(messagesOf(r).filter((m) => m?.role === 'user').map((m) => m.content)).includes(workerEnv)
  const lastOf = (pred) => { const xs = requests.filter(pred); return xs.length === 0 ? null : xs[xs.length - 1] }
  const exchangesOf = (req, lane) => {
    const out = []
    if (req === null) return out
    const msgs = messagesOf(req)
    for (let i = 0; i < msgs.length; i += 1) {
      const m = msgs[i]
      if (m?.role !== 'assistant' || !Array.isArray(m?.content)) continue
      for (const b of m.content) {
        if (b?.type !== 'tool_use' || !AGENT_STATE_NAMES.includes(String(b?.name ?? ''))) continue
        let head = ''
        for (let j = i + 1; j < msgs.length && head === ''; j += 1) {
          for (const rb of Array.isArray(msgs[j]?.content) ? msgs[j].content : []) {
            if (rb?.type === 'tool_result' && (rb.tool_use_id === undefined || rb.tool_use_id === b.id)) {
              head = (Array.isArray(rb.content) ? rb.content : []).map((c) => c?.text ?? '').join('') || String(rb.content ?? '')
            }
          }
        }
        out.push({ lane, name: String(b.name), input: b.input ?? null, head })
      }
    }
    return out
  }
  const leaderReq = lastOf((r) => !isWorker(r) && hasMarker(r, assembly.markers.MK_GOAL))
  const workerReq = lastOf(isWorker)
  const exchanges = [...exchangesOf(leaderReq, 'leader'), ...exchangesOf(workerReq, 'worker')]
  const workerUpdateArgs = exchanges.find((e) => e.lane === 'worker' && e.name === 'update_goal')?.input ?? null
  let logLines = []
  try { logLines = readFileSync(boot.logPath, 'utf8').split('\n').filter((l) => /placement-feed rows=|a5-agent-state|a5-plane: (mount|placement)-REFUSED|PLANE_AGENT_STATE/.test(l)) } catch { /* verdicts fall to disk */ }
  const placement = logLines.filter((l) => l.includes('placement-feed rows=') && l.includes('create_goal'))
  const storeLine = logLines.filter((l) => l.includes('agent-state store=fs'))
  const disk = assembly.readStoreOnDisk()
  // a FRESH production store instance over the same home (restart re-read)
  let reread = null
  try {
    const lane = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'agent-state-family', 'src', 'fs-state-store.mjs')).href)
    const goalKey = disk.records.find((r) => r.goal?.objective === assembly.claims.goal || r.goal?.objective === assembly.claims.goalEdited)?.key
    if (goalKey !== undefined) {
      const fresh = lane.createFsStateStore({ rootDir: assembly.STORE_ROOT, anchorDir: realpathSync(world.home), realmId: assembly.PLANE_REALM_ID })
      reread = { key: goalKey, goal: await fresh.readGoal(goalKey) }
    }
  } catch (error) { reread = { error: String(error?.message ?? error).slice(0, 200) } }

  const digest = {
    lanes, teamSessionId, exchanges: exchanges.map((e) => ({ ...e, head: String(e.head).slice(0, 500) })),
    controlRows: [...controlRows.values()], resolutions, approverErrors,
    disk, reread, placement: placement.map((l) => l.slice(0, 300)), storeLine, logHits: logLines.slice(-40).map((l) => l.slice(0, 260)),
  }
  record.record.u7asDigest = digest
  try { writeFileSync(join(evidence, `${runId}.u7as-evidence.json`), JSON.stringify(digest, null, 2) + '\n') } catch { /* best-effort */ }

  // ── teardown + verdicts ──────────────────────────────────────────────────
  try { await rc.stopChild() } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  const verdicts = judgeU7AStore({
    disk, exchanges, placement, storeLine, controlRows: [...controlRows.values()], resolutions,
    homeUnderTests, reread, claims: assembly.claims, workerUpdateArgs, plantedPlanScope, leakOk: leak.ok, leakDetail: leak.detail,
  })
  for (const [id, verdict, detail] of verdicts) if (!done.has(id)) add(id, verdict, detail)
  log(`u7as run ${runId}: lanes=${JSON.stringify(lanes)} records=${String(disk.records.length)} writes=${String(disk.writes.length)} attempts=${String(disk.attempts.length)}`)
}

export default {
  suite: 'u7-astore',
  cases: CASES,
  totalRequests: 110,
  run: (opts, ctx) => runU7AStore(opts, ctx),
}
