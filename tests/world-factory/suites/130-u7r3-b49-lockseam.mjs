/**
 * tests/world-factory/suites/130-u7r3-b49-lockseam.mjs — lane u7r3-b49 (#449
 * pool row "受影响生产路径 (≤2)"): the PRODUCTION agent-state store's lock /
 * clock-seam / applyId-consumption paths driven on a LIVE Host World, across
 * REAL process boundaries, at the PRODUCTION DEFAULT clock (the R-413-1 seam
 * untouched: nowMs defaults to Date.now), with NO faultAt seam and NO
 * injected store port: the host builds its durable store from its own
 * DSH_HOME (= the World home under tests/homes); runner-side legs drive the
 * SAME production module (this checkout's
 * `packages/tools/agent-state-family/src/fs-state-store.mjs`, the
 * pre-registered sha) from this process and from spawned CHILD processes
 * against the same realm root — real multi-OS-process contention on real fs
 * primitives, verdicts from the runner's OWN disk reads.
 *
 * Case lineage = the C1 u7as:* scenario families this boot re-grades live:
 *   u7as:L (concurrent appliers serialised)  u7as:F (lock-owner policy: age
 *   alone NEVER breaks a live holder / death-proved break)  u7as:M + u7as:I
 *   (applyId consumed ATOMICALLY and cross-scope-GLOBAL BEFORE the commit;
 *   refund)  u7as:R (a refused apply never burns its applyId).  The #461
 *   generation-checked break (revalidate + verify-after) is graded live as
 *   u7as:R3 (module-header owner law R3-1).
 *
 * Boot budget: ONE host start per run against the pool row "#449 受影响生产
 * 路径 (≤2)" (boot#1 = 1 of ≤2 starts; the 2nd stays reserved, spendable only
 * on an ENV_BLOCK-class NOT_REACHED, re-registered first). Before ANY host
 * start the home guard runs (TEST_METHODS §1/§7): the World home must realpath
 * under tests/homes/ — never ~/.dsh, never :3080's home.
 *
 * Verdict law: disk facts first (raw JSON + ledgers + FRESH production store
 * instances over the same home), the governed Control ledger, the mock
 * transcripts. A positive the host's own authority refuses is REFUSED
 * verbatim, never flipped; silence FAILS; ENV_BLOCK can never PASS.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf, messagesOf, toolCall, textOf, lastUserTextOfStatic } from '../lib/u6-fs-assembly.mjs'
import { AGENT_STATE_NAMES, createU7AStoreAssembly } from '../lib/u7astore-assembly.mjs'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const CASES = Object.freeze([
  'u7as:P-live-host-positive',
  'u7as:L-live-serialise',
  'u7as:F-live-timeout-refusal',
  'u7as:F-live-break-after-death',
  'u7as:R3-live-break-revalidate',
  'u7as:M-live-replay',
  'u7as:I-live-cross-scope-replay',
  'u7as:R-live-refund',
  'u7as:leak-check',
])

/** The child driver: a REAL second/third OS process holding, dying-with, or
 *  applying-through the production store. Written to the (gitignored)
 *  evidence dir at run time; imports the store module BY PATH (this checkout
 *  = the pre-registered sha). Emits one JSON event per line on stdout. */
const CHILD_SOURCE = `
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const spec = JSON.parse(process.argv[2])
const ev = (o) => process.stdout.write(JSON.stringify({ pid: process.pid, atMs: Date.now(), ...o }) + '\\n')
const bootId = (() => { try { return readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() } catch { return '' } })()
const plant = (text) => { const t = spec.lockPath + '.plant-' + process.pid + '.tmp'; writeFileSync(t, text, { mode: 0o600 }); renameSync(t, spec.lockPath) }
const plantRecord = (nonce, token, at) => JSON.stringify({ pid: process.pid, host: hostname(), boot: bootId, nonce, token, at })
if (spec.role === 'hold') {
  // A LIVE holder: plant the record naming OUR (alive) pid and beat. This is
  // a disk-level fixture of the same documented shape production publishes;
  // the code under test is every WAITER (production acquireLock/mayBreak).
  const nonce = 'b49hold-' + randomUUID()
  let i = 0
  let lastToken = 't0-' + randomUUID()
  plant(plantRecord(nonce, lastToken, Date.now()))
  ev({ kind: 'PLANTED', nonce, token: lastToken })
  const timer = setInterval(() => {
    i += 1; lastToken = 't' + i + '-' + randomUUID()
    try { plant(plantRecord(nonce, lastToken, Date.now())) } catch (e) { ev({ kind: 'BEAT-FAIL', error: String((e && e.code) || e) }) }
  }, spec.beatMs)
  setTimeout(() => {
    clearInterval(timer)
    let present = false, mine = false, nonceSeen = null
    try { const rec = JSON.parse(readFileSync(spec.lockPath, 'utf8')); present = true; nonceSeen = rec.nonce; mine = rec.pid === process.pid } catch { /* gone */ }
    ev({ kind: 'RELEASE_CHECK', present, mine, nonceSeen })
    try { if (existsSync(spec.lockPath)) unlinkSync(spec.lockPath) } catch { /* best effort */ }
    ev({ kind: 'RELEASED' })
    // natural exit (exitCode, never process.exit) so the stdout pipe FLUSHES
    process.exitCode = present ? 0 : 3
  }, spec.holdMs)
} else if (spec.role === 'die') {
  // A CRASHED holder: plant naming our pid, then EXIT (the pid really dies).
  const nonce = 'b49die-' + randomUUID()
  const token = 'd0-' + randomUUID()
  plant(plantRecord(nonce, token, Date.now() - (spec.plantAgeMs || 0)))
  ev({ kind: 'PLANTED', nonce, token, exitSoon: true })
  // natural exit flushes the pipe (the pid still dies identically)
} else if (spec.role === 'apply') {
  const gateDeadline = Date.now() + (spec.gateMaxMs || 0)
  if (spec.gateFile) { while (!existsSync(spec.gateFile) && Date.now() < gateDeadline) { /* gate spin */ } }
  const mod = await import(pathToFileURL(spec.modulePath).href)
  const opts = { rootDir: spec.rootDir, anchorDir: spec.anchorDir, realmId: spec.realmId }
  if (typeof spec.lockTimeoutMs === 'number') opts.lockTimeoutMs = spec.lockTimeoutMs
  const store = mod.createFsStateStore(opts)
  const t0 = Date.now()
  let out
  try {
    out = spec.op === 'goal'
      ? await store.applyGoal(spec.scope, { expectedRevision: spec.expectedRevision, next: spec.next, applyId: spec.applyId })
      : await store.applyTodos(spec.scope, { todos: spec.todos, applyId: spec.applyId })
  } catch (error) { out = { ok: false, code: String((error && error.code) || 'CHILD_THROW'), detail: String((error && error.message) || error) } }
  ev({ kind: 'RESULT', ok: (out && out.ok) === true, code: (out && out.code) || null, elapsedMs: Date.now() - t0, head: JSON.stringify(out).slice(0, 400) })
  // natural exit flushes the pipe
} else {
  ev({ kind: 'BAD-ROLE', role: spec.role })
  process.exitCode = 2
}
`

/** The mock model for this lane: leader = create_goal → get_goal → DONE.
 *  The lock/clock legs hang off the create_goal EFFECT; the u7-astore
 *  member/fence machinery is deliberately NOT loaded — smallest live lane
 *  that drives the governed row against the production store. */
function makeB49Decide({ assembly }) {
  const { markers } = assembly
  return function decide({ req }) {
    const t = messagesOf(req).map(textOf).join('\n')
    if (t.includes('Generate the session title')) return { kind: 'text', content: 'u7r3-b49 lockseam session' }
    if (t.includes(markers.MK_DISC)) return { kind: 'text', content: 'B49_DISC_DONE' }
    const ut = messagesOf(req)
      .filter((m) => m?.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
      .join('\n')
    const leader = t.includes(markers.MK_L1) || t.includes(markers.MK_GOAL) || ut.includes('B49_PHASE_')
    if (!leader) return { kind: 'text', content: 'B49_NOOP' }
    if (!ut.includes(markers.MK_GOAL)) return { kind: 'text', content: 'B49_WAITING_FOR_HUMAN' }
    const used = []
    for (const m of messagesOf(req)) {
      if (m?.role !== 'assistant' || !Array.isArray(m?.content)) continue
      for (const b of m.content) if (b?.type === 'tool_use') used.push(String(b?.name ?? ''))
    }
    if (!used.includes('create_goal')) return toolCall('create_goal', { objective: assembly.claims.goal, max_goal_rounds: 3 })
    if (!used.includes('get_goal')) return toolCall('get_goal', {})
    return { kind: 'text', content: 'B49_L_DONE' }
  }
}

const digestOf = (text) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')

async function runB49({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const done = new Set()
  const add = (id, verdict, detail) => {
    if (done.has(id)) return
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 280)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASES) add(id, 'FAIL', { reason: why, ...extra })
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

  // ── source binding: boot ONLY on the pre-registered sha ─────────────────
  const preRegSha = process.env.B49_PRE_REG_SHA ?? null
  record.record.bindings.sourceShaRule = 'bindings.teamSha (runner-recorded git HEAD of the lane checkout) must equal B49_PRE_REG_SHA (the pre-registration commit; zero commits between registration and boot); evidence-bound from that moment — forward-merge only, never rebase (ROUTER_RULES §8.5.7)'
  record.record.bindings.preRegistrationSha = preRegSha
  const storeModulePath = join(REPO_ROOT, 'packages', 'tools', 'agent-state-family', 'src', 'fs-state-store.mjs')
  record.record.bindings.storeModule = {
    path: 'packages/tools/agent-state-family/src/fs-state-store.mjs',
    sha256: createHash('sha256').update(readFileSync(storeModulePath)).digest('hex'),
    clockSeam: 'nowMs defaults to Date.now — NO injected clock, NO faultAt seam in ANY store instance this boot builds (production defaults throughout)',
  }
  if (preRegSha !== null && record.record.bindings.teamSha !== preRegSha) {
    failRest(`source-sha rule violated: checkout HEAD ${record.record.bindings.teamSha} != pre-registered ${preRegSha} — refusing to boot`, { class: 'SOURCE_SHA_MISMATCH' })
    return
  }

  // ── materialize; the home guard runs BEFORE the first host start ────────
  const world = await factory.createWorld({ line, u7AStore: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const homesRoot = realpathSync(join(REPO_ROOT, 'tests', 'homes'))
  const homeReal = realpathSync(world.home)
  const homeUnderTests = homeReal.startsWith(`${homesRoot}${sep}`)
  const assembly = createU7AStoreAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  const locksDir = join(assembly.STORE_ROOT, 'locks')
  record.record.bindings.agentStateStore = {
    base: 'DSH_HOME/team-state/agent-state/<realmId>',
    baseRelativeToHome: assembly.readStoreOnDisk().base,
    realmId: assembly.PLANE_REALM_ID,
    homeUnderTestsHomes: homeUnderTests,
    homeSource: 'the host process DSH_HOME (the World home) — the host builds the PRODUCTION store from it; runner-side child processes open the SAME realm root as separate OS processes',
    bootBudget: 'pool #449 <=2 starts; this run declares 1 start (the reserved 2nd is spendable only on an ENV_BLOCK-class NOT_REACHED, re-registered first)',
  }
  if (!homeUnderTests) {
    failRest(`refusing to boot: the World home ${homeReal} is not under tests/homes (TEST_METHODS §1/§7)`)
    return
  }
  assembly.writePreBootFiles()
  world.u7AStore.rows.push(...assembly.teamRows())
  record.record.bindings.seamsUsed = { faultAt: 'none', nowMs: 'none (production default Date.now)', bootId: 'default (local boot id)', recordWriter: 'none' }

  // child-driver file (gitignored evidence dir)
  const childPath = join(evidence, `${runId}.b49-child.mjs`)
  writeFileSync(childPath, CHILD_SOURCE)
  const children = []
  const spawnChild = (spec, tag) => {
    const child = spawn(process.execPath, [childPath, JSON.stringify({ ...spec, modulePath: storeModulePath, rootDir: assembly.STORE_ROOT, anchorDir: homeReal })], { stdio: ['ignore', 'pipe', 'pipe'] })
    const events = []
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += String(d)
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const lineRaw = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (lineRaw === '') continue
        try { events.push(JSON.parse(lineRaw)) } catch { events.push({ kind: 'RAW', text: lineRaw.slice(0, 300) }) }
      }
    })
    let stderrText = ''
    child.stderr.on('data', (d) => { stderrText = (stderrText + String(d)).slice(0, 4000) })
    const doneP = new Promise((resolve) => child.on('exit', (code) => setTimeout(() => resolve({ code, events, stderr: stderrText.slice(0, 800) }), 50)))
    children.push({ tag, child, events, doneP })
    return children[children.length - 1]
  }
  const eventOf = (c, kind) => c.events.find((e) => e.kind === kind) ?? null
  const lockPathFor = (scope) => join(locksDir, `${digestOf(scope)}.lock`)
  const locksList = () => { try { return readdirSync(locksDir) } catch { return [] } }
  const residue = () => locksList().filter((n) => n.includes('.broken.') || n.endsWith('.tmp') || n.includes('.plant-'))

  // ── ONE host start (pool #449 start 1 of ≤2) ─────────────────────────────
  await world.startMock({ decide: makeB49Decide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'b49-boot1', poolRow: '#449 受影响生产路径 (<=2) — start 1/2' })
  rc.arm()
  const startPromise = world.startHost()
  const hostChild = world.instance?.child ?? null
  if (hostChild !== null) rc.bindChild(hostChild, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try { boot = await startPromise } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`, { class: 'START_FAILED-class' })
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'b49-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  // ── readiness + governed lane ────────────────────────────────────────────
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
  const controlRows = new Map()
  const resolutions = []
  const approverErrors = []
  const leaderScope = `agent:${assembly.CREATE_ROOT}`
  let cookie = null
  let teamSessionId = assembly.CREATE_ROOT
  let holdLeg = null
  let laneDone = false
  let createHead = null
  let goalTurn = false
  let hostLaneReached = false
  if (!healthW.hit || !stateW.hit) {
    log(`readiness failed: health=${String(health?.status)} state=${String(stateW.hit)}`)
  } else {
    cookie = await authenticate(origin, world.token)
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'b49')
    const discW = discPrompt.status === 200
      ? await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
      : { hit: false }
    if (discW.hit) {
      const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
      const denyList = [...new Set(disc)].sort().filter((n) => !n.startsWith('team_') && !AGENT_STATE_NAMES.includes(n))
      assembly.writeMainBlueprint(denyList)
      const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
      record.record.b49Create = { status: created.status, ok: created.body?.result?.ok === true, body: JSON.stringify(created.body ?? null).slice(0, 500) }
      if (created.status === 200 && created.body?.result?.ok === true) {
        hostLaneReached = true
        const unwrap = (body) => { const x = body?.result?.value; return x && typeof x === 'object' && 'data' in x ? x.data : x }
        const ledgerRows = async () => {
          const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
          let afterSequence = 0
          for (let pageNo = 0; pageNo < 20; pageNo += 1) {
            const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage', { teamSessionId, afterSequence, limit: 500 }, 'b49-ledger', 1)
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
            requestId: String(x.payload.requestId), toolName: x.payload.toolName ?? null,
            status: settled.has(String(x.payload.requestId)) ? 'settled' : 'pending',
          }))
        }
        const nameRe = /create_goal|get_goal/
        let stop = false
        const approver = (async () => {
          while (!stop) {
            try {
              for (const r of await ledgerRows()) {
                controlRows.set(r.requestId, r)
                if (r.status === 'pending' && nameRe.test(String(r.toolName ?? '')) && !resolutions.some((x) => x.requestId === r.requestId)) {
                  const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl', { teamSessionId, requestId: r.requestId, decision: 'allow', note: 'b49-c2-human-approval' }, 'b49-approve', 4)
                  resolutions.push({ requestId: r.requestId, toolName: r.toolName, atMs: Date.now(), status: res?.status ?? null, ok: res?.status === 200 && res?.body?.result?.ok === true })
                  log(`approval allow ${r.requestId.slice(0, 14)} tool=${String(r.toolName)} status=${String(res?.status)}`)
                }
              }
            } catch (err) { approverErrors.push(String(err?.message ?? err).slice(0, 200)) }
            await sleep(500)
          }
        })()
        const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
        const toolSeen = (name) => (world.mock?.requests ?? []).some((r) => (r.reply?.toolCalls ?? []).some((c) => c?.name === name))
        await waitUntil(() => replySeen('B49_WAITING_FOR_HUMAN'), { timeoutMs: 90_000 })

        // ── LIVE HOLDER planted for the LEADER scope, THEN the human turn ──
        // The host's create_goal EFFECT (its own production store instance, a
        // DIFFERENT OS process) must wait for this live holder and commit only
        // after release — the R-413-1 clock seam exercised at production
        // defaults (nowMs = Date.now, timeout 10 s, never-broken live holder).
        // The plant is a DISK FIXTURE of the documented lock shape written by
        // a separate process; the locks dir is created the way the store does
        // (plain mkdir); the code under test is every production waiter.
        mkdirSync(locksDir, { recursive: true })
        holdLeg = spawnChild({ role: 'hold', lockPath: lockPathFor(leaderScope), holdMs: 9_000, beatMs: 500 }, 'hold-leader')
        const planted = (await waitUntil(() => eventOf(holdLeg, 'PLANTED') !== null, { timeoutMs: 10_000 })).hit
        if (!planted) log('live-holder plant never landed — the serialisation leg has no fixture (case u7as:L-live-serialise will FAIL honestly)')
        const goalPrompt = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, assembly.markers.MK_GOAL, 'b49-human')
        record.record.b49GoalPrompt = { status: goalPrompt.status }
        goalTurn = (await waitUntil(() => toolSeen('create_goal'), { timeoutMs: 120_000 })).hit === true
        for (let w = 0; w < 8 && !replySeen('B49_L_DONE'); w += 1) {
          await sleep(3_000)
          if (!replySeen('B49_L_DONE')) await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `B49_PHASE_${String(w)}`, 'b49-wake').catch(() => {})
        }
        laneDone = (await waitUntil(() => replySeen('B49_L_DONE'), { timeoutMs: 90_000 })).hit
        await sleep(2_000)
        stop = true
        try { await approver } catch { /* loop exits on the flag */ }
        const reqs = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_GOAL))
        const lastReq = reqs[reqs.length - 1] ?? null
        if (lastReq !== null) {
          for (const m of messagesOf(lastReq)) {
            for (const b of Array.isArray(m?.content) ? m.content : []) {
              if (b?.type === 'tool_result') {
                const head = (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('') || String(b.content ?? '')
                if (/goal/i.test(head)) createHead = String(head).slice(0, 500)
              }
            }
          }
        }
      }
    }
  }

  const disk = assembly.readStoreOnDisk()
  const leaderRec = disk.records.find((r) => r.key === leaderScope) ?? null
  const reread = { law: 'fresh PRODUCTION store instance over the same home, runner process, production defaults' }
  try {
    const laneMod = await import(pathToFileURL(storeModulePath).href)
    const fresh = laneMod.createFsStateStore({ rootDir: assembly.STORE_ROOT, anchorDir: homeReal, realmId: assembly.PLANE_REALM_ID })
    reread.goal = await fresh.readGoal(leaderScope)
  } catch (error) { reread.error = String(error?.message ?? error).slice(0, 200) }

  // ── case 1: u7as:P-live-host-positive (host process committed to the
  //    production store under the World home; anchor for every other leg) ──
  const goalWrites = leaderRec === null ? [] : disk.writes.filter((w) => w.op === 'goal/apply' && w.scope === leaderRec.key)
  const isRefusal = (h) => typeof h === 'string' && /^(refused|Error)/.test(h.trim())
  const pOk = laneDone && goalTurn && leaderRec !== null && leaderRec.goal?.objective === assembly.claims.goal
    && goalWrites.length >= 1 && reread.goal !== undefined && JSON.stringify(reread.goal) === JSON.stringify(leaderRec.goal)
    && disk.rootExists === true && disk.realUnderHome === true && homeUnderTests === true && leaderRec.nlink === 1
    && (disk.attempts ?? []).some((a) => a.op === 'goal/apply' && a.scope === leaderScope && a.outcome === 'applied')
  if (isRefusal(createHead)) {
    add('u7as:P-live-host-positive', 'REFUSED', { toolResultHead: createHead, law: 'a positive the host refuses stays REFUSED verbatim (never flipped)' })
  } else {
    add('u7as:P-live-host-positive', pOk ? 'PASS' : 'FAIL', {
      diskRecord: leaderRec === null ? null : { key: leaderRec.key, goal: leaderRec.goal, nlink: leaderRec.nlink },
      writesAudit: goalWrites, freshStoreReread: reread.goal ?? reread.error, modelSaw: createHead,
      lanes: { health: healthW.hit, state: stateW.hit, goalTurn, laneDone },
      law: 'the governed create_goal row (durable Control ask settled ONCE by the public resolveControl seam) committed through the host process\'s PRODUCTION fs store built from its DSH_HOME = the World home (realpath under tests/homes), re-read from disk AND by a fresh production store instance',
    })
  }

  // ── case 2: u7as:L-live-serialise (host waiter vs live cross-process holder) ─
  if (holdLeg !== null) await holdLeg.doneP
  const plantedEv = holdLeg === null ? null : eventOf(holdLeg, 'PLANTED')
  const releasedEv = holdLeg === null ? null : eventOf(holdLeg, 'RELEASED')
  const releaseCheck = holdLeg === null ? null : eventOf(holdLeg, 'RELEASE_CHECK')
  const createApprove = resolutions.find((r) => /create_goal/.test(String(r.toolName ?? '')) && r.ok === true) ?? null
  // the durable record's own updatedAt (store-owned clock) — raw scope file
  let commitAtMs = Number.NaN
  try {
    const rawRec = JSON.parse(readFileSync(join(assembly.STORE_ROOT, 'scopes', `${digestOf(leaderScope)}.json`), 'utf8'))
    commitAtMs = Date.parse(String(rawRec.updatedAt ?? ''))
  } catch { /* stays NaN -> case FAILs honestly */ }
  const lOk = plantedEv !== null && releasedEv !== null && releaseCheck?.present === true && releaseCheck?.mine === true
    && createApprove !== null && Number.isFinite(commitAtMs)
    && createApprove.atMs < releasedEv.atMs - 300       // the settled ask landed DURING the hold
    && commitAtMs >= releasedEv.atMs - 200              // the host could NOT commit before release
    && commitAtMs - createApprove.atMs >= 3_000         // real elapsed wait at production defaults
    && goalWrites.length === 1 && residue().length === 0
  add('u7as:L-live-serialise', lOk ? 'PASS' : 'FAIL', {
    plant: plantedEv, releaseCheck, release: releasedEv, createApprovalAtMs: createApprove?.atMs ?? null, commitAtMs,
    leaderLockDigest: `${digestOf(leaderScope).slice(0, 12)}…`, locksDirAfter: locksList(),
    law: 'u7as:L live arm: a SEPARATE live OS process (the hold child) planted+beat the leader-scope lock; the HOST process\'s production apply (its own store instance, production nowMs=Date.now) waited serially — commit strictly after release, real elapsed wait, the live holder\'s record NEVER broken (age irrelevant: positive-proof law), one goal/apply write, zero lock residue',
  })

  // ── runner-process legs: production module from THIS checkout, this process
  //    + real children, same realm root the host uses. NO seams injected. ───
  mkdirSync(locksDir, { recursive: true }) // the store would too (withDir create)
  const laneMod = await import(pathToFileURL(storeModulePath).href)
  const mkStore = (opts = {}) => laneMod.createFsStateStore({ rootDir: assembly.STORE_ROOT, anchorDir: homeReal, realmId: assembly.PLANE_REALM_ID, ...opts })
  const parentStore = mkStore()
  const readDisk = () => assembly.readStoreOnDisk()
  const countWrites = (applyId) => readDisk().writes.filter((w) => w.applyId === applyId).length
  const countMarkers = () => {
    const dir = join(assembly.STORE_ROOT, 'applied')
    let files = []
    try { files = readdirSync(dir) } catch { /* absent */ }
    const out = new Map()
    for (const f of files) {
      try {
        const rec = JSON.parse(readFileSync(join(dir, f), 'utf8'))
        out.set(String(rec.applyId), (out.get(String(rec.applyId)) ?? 0) + 1)
      } catch { out.set(`?${f}`, 1) }
    }
    return out
  }

  const legs = []

  // leg C — u7as:F-live-timeout-refusal
  legs.push(async () => {
    const scopeC = `agent:b49-C-${assembly.rs}`
    const holdC = spawnChild({ role: 'hold', lockPath: lockPathFor(scopeC), holdMs: 5_200, beatMs: 500 }, 'hold-C')
    const plantedC = (await waitUntil(() => eventOf(holdC, 'PLANTED') !== null, { timeoutMs: 10_000 })).hit ? eventOf(holdC, 'PLANTED') : null
    const waiterC = spawnChild({ role: 'apply', scope: scopeC, op: 'todos', todos: [{ content: 'C-waiter', status: 'pending' }], applyId: `b49-C-${assembly.rs}`, lockTimeoutMs: 3_000 }, 'apply-C')
    const waiterCOut = await waiterC.doneP
    const holdCOut = await holdC.doneP
    const resC = eventOf(waiterC, 'RESULT')
    const diskC = readDisk()
    let lockCNow = null
    try { lockCNow = JSON.parse(readFileSync(lockPathFor(scopeC), 'utf8')) } catch { lockCNow = null }
    const cOk = plantedC !== null && resC !== null && resC.ok === false && resC.code === 'AGENT_STATE_STORE_LOCK_TIMEOUT'
      && resC.elapsedMs >= 2_900 && resC.elapsedMs <= 9_000 && resC.elapsedMs < 5_200 // refused WHILE the lock was held
      && countWrites(`b49-C-${assembly.rs}`) === 0 && !diskC.records.some((r) => r.key === scopeC)
      && (lockCNow === null || lockCNow.nonce === plantedC.nonce) // never broken: same nonce, or self-released after
      && holdCOut.code === 0 && eventOf(holdC, 'RELEASE_CHECK')?.present === true
    add('u7as:F-live-timeout-refusal', cOk ? 'PASS' : 'FAIL', {
      waiter: resC, waiterStderr: waiterCOut.stderr, holdExit: holdCOut.code, holdCheck: eventOf(holdC, 'RELEASE_CHECK'),
      lockAfter: lockCNow === null ? 'gone (self-released)' : { nonce: lockCNow.nonce, pid: lockCNow.pid }, plantedNonce: plantedC?.nonce ?? null,
      config: 'waiter store lockTimeoutMs=3000 (public documented input; production default is 10000 — the refusal CLASS is the config-independent law)',
      law: 'u7as:F live arm: holder pid ALIVE => mayBreak answers false on every retry (age irrelevant) — the second process\'s production apply ends in the typed AGENT_STATE_STORE_LOCK_TIMEOUT refusal with ZERO durable write, zero record, the holder\'s generation never moved',
    })
  })

  // leg D — u7as:F-live-break-after-death
  legs.push(async () => {
    const scopeD = `agent:b49-D-${assembly.rs}`
    const dieD = spawnChild({ role: 'die', lockPath: lockPathFor(scopeD), plantAgeMs: 45_000 }, 'die-D')
    const dieDOut = await dieD.doneP
    const plantedD = eventOf(dieD, 'PLANTED')
    const deadPid = plantedD?.pid ?? null
    let pidCheck = 'no-pid'
    if (deadPid !== null) {
      try { process.kill(deadPid, 0); pidCheck = 'ALIVE (pid recycled?)' } catch (error) { pidCheck = error?.code === 'ESRCH' ? 'ESRCH (dead)' : `kill-error ${String(error?.code)}` }
    }
    const t0D = Date.now()
    const resD = await parentStore.applyTodos(scopeD, { todos: [{ content: 'D-after-break', status: 'pending' }], applyId: `b49-D-${assembly.rs}` })
    const elapsedD = Date.now() - t0D
    const diskD = readDisk()
    const dOk = dieDOut.code === 0 && plantedD !== null && pidCheck === 'ESRCH (dead)' && resD?.ok === true
      && elapsedD >= 900 && elapsedD <= 9_000
      && countWrites(`b49-D-${assembly.rs}`) === 1
      && diskD.records.find((r) => r.key === scopeD)?.todos?.[0]?.content === 'D-after-break'
      && locksList().filter((n) => n === `${digestOf(scopeD)}.lock`).length === 0
      && residue().length === 0
    add('u7as:F-live-break-after-death', dOk ? 'PASS' : 'FAIL', {
      diedPid: deadPid, pidAliveRecheck: pidCheck, plantAgeMs: 45_000, elapsedMs: elapsedD, res: JSON.stringify(resD).slice(0, 200), locksAfter: locksList(),
      law: 'u7as:F live death arm: a REAL process planted the lock and EXITED (pid proven ESRCH); the production breaker judged the generation provably dead, watched the token-stable observation window (real >=~1 s elapsed at production defaults), broke via rename-aside, VERIFIED the moved object by inode+nonce was exactly the judged generation, removed only that generation, then acquired and committed — zero residue',
    })
  })

  // leg E — u7as:R3-live-break-revalidate (#461 live: two breakers, one dead
  // lock; a LIVE holder's fresh generation is never stolen)
  legs.push(async () => {
    const scopeE = `agent:b49-E-${assembly.rs}`
    const dieE = spawnChild({ role: 'die', lockPath: lockPathFor(scopeE), plantAgeMs: 45_000 }, 'die-E')
    await dieE.doneP
    const gateE = join(evidence, `${runId}.gate-E`)
    writeFileSync(gateE, 'go')
    const eParent = parentStore.applyTodos(scopeE, { todos: [{ content: 'E-parent', status: 'pending' }], applyId: `b49-E-p-${assembly.rs}` })
    const eChild = spawnChild({ role: 'apply', scope: scopeE, op: 'todos', todos: [{ content: 'E-child', status: 'pending' }], applyId: `b49-E-c-${assembly.rs}`, gateFile: gateE, gateMaxMs: 30_000 }, 'apply-E')
    const [resE1, eChildOut] = await Promise.all([eParent, eChild.doneP])
    const resE2 = eventOf(eChild, 'RESULT')
    const diskE = readDisk()
    const recE = diskE.records.find((r) => r.key === scopeE) ?? null
    const eOk = resE1?.ok === true && resE2?.ok === true
      && countWrites(`b49-E-p-${assembly.rs}`) === 1 && countWrites(`b49-E-c-${assembly.rs}`) === 1
      && recE !== null && ['E-parent', 'E-child'].includes(recE.todos?.[0]?.content)
      && residue().length === 0 && locksE0().length === 0
    function locksE0() { return locksList().filter((n) => n === `${digestOf(scopeE)}.lock`) }
    void eChildOut
    add('u7as:R3-live-break-revalidate', eOk ? 'PASS' : 'FAIL', {
      parent: JSON.stringify(resE1).slice(0, 200), child: resE2, childStderr: eChildOut.stderr, record: recE?.todos ?? null, locksAfter: locksList(),
      law: '#461 live arm (R3-1 owner policy): two breakers raced the same dead lock; whichever won the rename-aside, the loser REVALIDATED the name against its judgement and touched NOTHING it had not judged — when the winner\'s fresh lock went live, the loser treated it as the live holder it is (never broken, waited, committed only after release). Serialisation holds across processes and re-races: two writes, one record, zero stolen generations, zero residue',
    })
  })

  // leg M — u7as:M-live-replay
  legs.push(async () => {
    const scopeM1 = `agent:b49-M1-${assembly.rs}`
    const scopeM2 = `agent:b49-M2-${assembly.rs}`
    const applyIdM = `b49-M-${assembly.rs}`
    const mChild = spawnChild({ role: 'apply', scope: scopeM1, op: 'todos', todos: [{ content: 'M-first', status: 'pending' }], applyId: applyIdM }, 'apply-M')
    const mOut = await mChild.doneP
    const mRes = eventOf(mChild, 'RESULT')
    const replaySameScope = await mkStore().applyTodos(scopeM1, { todos: [{ content: 'M-replay-same', status: 'pending' }], applyId: applyIdM })
    const replayOtherScope = await mkStore().applyTodos(scopeM2, { todos: [{ content: 'M-replay-other', status: 'pending' }], applyId: applyIdM })
    const diskM = readDisk()
    const mOk = mOut.code === 0 && mRes?.ok === true
      && replaySameScope?.ok === false && replaySameScope?.code === 'STATE_APPLY_REPLAY'
      && replayOtherScope?.ok === false && replayOtherScope?.code === 'STATE_APPLY_REPLAY'
      && countWrites(applyIdM) === 1 && (countMarkers().get(applyIdM) ?? 0) === 1
      && !diskM.records.some((r) => r.key === scopeM2)
      && diskM.writes.filter((w) => w.scope === scopeM2).length === 0
    add('u7as:M-live-replay', mOk ? 'PASS' : 'FAIL', {
      first: mRes, replaySameScope: { ok: replaySameScope?.ok, code: replaySameScope?.code }, replayOtherScope: { ok: replayOtherScope?.ok, code: replayOtherScope?.code },
      writesForId: countWrites(applyIdM), markersForId: countMarkers().get(applyIdM) ?? 0,
      law: 'u7as:M live arm: one process consumed applyId X (O_EXCL marker BEFORE the commit); TWO FRESH store instances replay X — at the committing scope (scope-local appliedIds witness) and at a DIFFERENT scope (the cross-scope-GLOBAL marker witness) — both answer STATE_APPLY_REPLAY with zero persistence; exactly one durable write and one marker for X',
    })
  })

  // leg I — u7as:I-live-cross-scope-replay (#460 live race)
  legs.push(async () => {
    const rounds = []
    let ok = true
    for (let r = 1; r <= 3 && ok; r += 1) {
      const scopeA = `agent:b49-Ia${String(r)}-${assembly.rs}`
      const scopeB = `agent:b49-Ib${String(r)}-${assembly.rs}`
      const applyId = `b49-I-${String(r)}-${assembly.rs}`
      const gate = join(evidence, `${runId}.gate-I${String(r)}`)
      try { rmSync(gate, { force: true }) } catch { /* fresh */ }
      const childScope = r % 2 === 0 ? scopeA : scopeB
      const parentScope = r % 2 === 0 ? scopeB : scopeA
      const childLeg = spawnChild({ role: 'apply', scope: childScope, op: 'todos', todos: [{ content: `I${String(r)}-child`, status: 'pending' }], applyId, gateFile: gate, gateMaxMs: 30_000 }, `apply-I${String(r)}`)
      await sleep(250) // spawn tick: the child is in its gate spin before the gate opens
      writeFileSync(gate, 'go')
      const [parentRes, childOut] = await Promise.all([
        parentStore.applyTodos(parentScope, { todos: [{ content: `I${String(r)}-parent`, status: 'pending' }], applyId }),
        childLeg.doneP,
      ])
      const childRes = eventOf(childLeg, 'RESULT')
      const oks = [parentRes, childRes].filter((x) => x?.ok === true).length
      const codes = [parentRes, childRes].map((x) => (x?.ok === true ? 'ok' : String(x?.code)))
      const writes = countWrites(applyId)
      const markers = countMarkers().get(applyId) ?? 0
      rounds.push({ r, parentScope, childScope, codes, oks, writes, markers, childStderr: childOut.stderr })
      if (oks !== 1 || writes !== 1 || markers !== 1 || !codes.includes('STATE_APPLY_REPLAY')) ok = false
    }
    add('u7as:I-live-cross-scope-replay', ok ? 'PASS' : 'FAIL', {
      rounds,
      law: '#460 live race: for each applyId, two OS processes applied it at DIFFERENT scopes gated to start together; the O_EXCL marker is check AND consume, outside the reach of either scope lock — exactly one durable commit, exactly one marker, the loser refused verbatim STATE_APPLY_REPLAY with zero persistence. This is the interleaving the pre-fix scope-locked check lost (audit P0-2a), graded live',
    })
  })

  // leg R — u7as:R-live-refund
  legs.push(async () => {
    const scopeH = `agent:b49-H-${assembly.rs}`
    const applyIdZ = `b49-Z-${assembly.rs}`
    const nextGoal = { goalId: 'u7as-r-live-goal', revision: 1, objective: 'b49 refund leg', phase: 'active' }
    const refused = await mkStore().applyGoal(scopeH, { expectedRevision: 7, next: nextGoal, applyId: applyIdZ })
    const markerAfterRefuse = countMarkers().get(applyIdZ) ?? 0
    const writesAfterRefuse = countWrites(applyIdZ)
    const redrive = await mkStore().applyGoal(scopeH, { expectedRevision: null, next: nextGoal, applyId: applyIdZ })
    const markerAfterRedrive = countMarkers().get(applyIdZ) ?? 0
    const writesAfterRedrive = countWrites(applyIdZ)
    const hOk = refused?.ok === false && refused?.code === 'GOAL_STALE_REVISION' && markerAfterRefuse === 0 && writesAfterRefuse === 0
      && redrive?.ok === true && markerAfterRedrive === 1 && writesAfterRedrive === 1
    add('u7as:R-live-refund', hOk ? 'PASS' : 'FAIL', {
      refused: { ok: refused?.ok, code: refused?.code }, markerAfterRefuse, writesAfterRefuse, redrive: { ok: redrive?.ok }, markerAfterRedrive, writesAfterRedrive,
      law: 'u7as:R/M1 live arms: applyId Z consumed (the marker create PRECEDES the commit), the CAS precheck refused (GOAL_STALE_REVISION) => clean refund: marker GONE, zero write, the grant stays re-drivable; the SAME applyId re-driven at a valid precondition commits exactly once (marker back, one write)',
    })
  })

  let legErrors = []
  for (const leg of legs) {
    try { await leg() } catch (error) {
      legErrors.push(String(error?.stack ?? error).slice(0, 600))
      // find the case this leg owns by order (legs run in CASES order 3..8)
      const idx = legs.indexOf(leg)
      const caseId = ['u7as:F-live-timeout-refusal', 'u7as:F-live-break-after-death', 'u7as:R3-live-break-revalidate', 'u7as:M-live-replay', 'u7as:I-live-cross-scope-replay', 'u7as:R-live-refund'][idx]
      if (caseId !== undefined) add(caseId, 'FAIL', { legError: String(error?.message ?? error).slice(0, 400) })
    }
  }
  record.record.b49LegErrors = legErrors

  // ── teardown + leak ───────────────────────────────────────────────────────
  for (const c of children) { try { c.child.kill('SIGKILL') } catch { /* exited */ } }
  try { await rc.stopChild() } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  add('u7as:leak-check', leak.ok ? 'PASS' : 'FAIL', { ...(leak.detail ?? {}), childrenSpawned: children.length, hostLaneReached, approverErrors, law: 'every leased port idle, every owned pid dead, every lease file gone, World home released; :3080 never signalled, ~/.dsh never touched' })
  for (const id of CASES) if (!done.has(id)) add(id, 'FAIL', { reason: 'leg not reached' })

  record.record.b49Disk = readDisk()
  log(`b49 run ${runId}: records=${String(record.record.b49Disk.records.length)} writes=${String(record.record.b49Disk.writes.length)} attempts=${String(record.record.b49Disk.attempts.length)}`)
}

export default {
  suite: 'u7r3-b49-lockseam',
  cases: CASES,
  totalRequests: 60,
  run: (opts, ctx) => runB49(opts, ctx),
}
