/**
 * P2-T2 probe plugin — `p2t2-agent-lifecycle` (host row, positive fixture).
 *
 * Characterizes the agent create/resume/cold-Root TeamDomain binding seam of
 * TaskDoc §11.3 through PUBLIC APIs only:
 *
 *   - `agents` (AgentRegistry)      create / resume
 *   - `sessions` (SessionStore)     live-session reads (header, liveness)
 *   - `sessionPersistence`          persistence seam (required, injected)
 *   - `webServer`                   scenario ingress route /__p2t2/run
 *   - `storage` (Storage hub)       json backend KV sidecar (the binding unit)
 *
 * Setup-ordering contract: this row is a `--patch` overlay entry of the web
 * profile (`patchReload: "live"`), and the Loader may activate it while the
 * base-bundle rows are still becoming active. A strict `ctx.get(name)`
 * (default `strict: true`, i.e. "providing fiber currently active") can
 * return `undefined` for any base service at apply time, varying boot to
 * boot (observed: empty store at one boot's apply, partial at another's;
 * all services present ~2s later). The row therefore declares `inject` for
 * all five services above: the Loader defers `apply` until every injected
 * service is available (upstream Post-mortem 0001; packages/AGENTS.md:
 * "Function plugins named-export name / inject / Config / apply"). The
 * `activate` trace entry is thus provably AFTER spine readiness, and every
 * scenario that follows it runs on a fully set-up instance.
 *
 * The root binding fixture follows the frozen vNext Architecture, which makes
 * the TeamDomain sidecar over the DSH storage seam the Team control-plane
 * durable authority (the Root Session log is explicitly NOT the vNext
 * authority): a durable KV record {marker} keyed by root session id in unit
 * `p2t2_binding` / table `roots` of the json storage backend (rooted at
 * <DSH_HOME>/storages). Writes are durable on resolve; a new process reopens
 * the same unit from disk — that is the cold-recovery mechanism.
 *
 * Every scenario records a machine ordering trace [{seq, ts, phase, ...}]
 * from plugin activation through the first Team-sensitive step, and writes
 * one observation JSON to $P2T2_OBS_DIR (the probe group exports it before
 * every boot). The trace + obs files are the evidence the group asserts.
 *
 * Scenario codes (query param `scenario`):
 *   fresh                 create root agent -> attach binding -> root first
 *                         Team-sensitive step -> create member (with
 *                         parentSession) -> member first Team-sensitive step
 *                         -> flush both sessions (durable barrier)
 *   resume-root           cold-resume the root; the binding is recovered from
 *                         the sidecar BEFORE the first Team-sensitive step
 *   resume-member         cold-resume the member; the root binding is resolved
 *                         via the sidecar (the root session is not live)
 *   neg-late-binding      the first Team-sensitive step BEFORE the binding
 *                         attach must fail with P2T2_ROOT_BINDING_MISSING;
 *                         then attach; then the same step succeeds
 *   prep-custom-event     append a downstream (out-of-vocabulary) session
 *                         event and flush — sets up the cold-read negative
 *   neg-custom-event-cold agents.resume of that session must be REFUSED on
 *                         the cold read path (session event vocabulary
 *                         whitelist), with the upstream "unknown to this
 *                         harness" message
 *
 * Agents are NEVER disposed: handle.dispose() removes the session from the
 * store and retires its persistence, which would destroy the cold-resume
 * precondition. The instance stop (process kill) is the teardown.
 */
import { SessionId } from '@deepseek-ai/dsh-session'
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleepMs } from 'node:timers/promises'

export const name = 'p2t2-agent-lifecycle'

// Setup-ordering requirement (see header): the Loader only applies this row
// once all five services are available. Named exports, no default export —
// the function-plugin form the Loader honors.
export const inject = ['sessions', 'agents', 'sessionPersistence', 'webServer', 'storage']

const PROBE = 'p2t2-agent-lifecycle'
const ROUTE = '/__p2t2/run'
const UNIT = { name: 'p2t2_binding', version: 1, tables: ['roots'], hasGlobal: false }
const TABLE = 'roots'
const DOWNSTREAM_EVENT_TYPE = 'team/vnext/p2t2-probe-marker'

export function apply(ctx) {
  const sessions = ctx.get('sessions')
  const agents = ctx.get('agents')
  const persistence = ctx.get('sessionPersistence')
  const webServer = ctx.get('webServer')
  const storage = ctx.get('storage')
  for (const [svcName, svc] of [
    ['sessions', sessions],
    ['agents', agents],
    ['sessionPersistence', persistence],
    ['webServer', webServer],
    ['storage', storage],
  ]) {
    if (svc === undefined) {
      throw new Error(`${PROBE}: required service '${svcName}' is missing; the probe row cannot activate`)
    }
  }
  void persistence // guaranteed present by the inject declaration; the guard above names a loader-contract violation

  const backend = storage.backend.get('json')

  // Durability verification: the session log's on-disk artifacts for one
  // session id. Layout:
  // <DSH_HOME>/sessions/<project-hash-dir>/<sessionId>/{session.jsonl.zstd, *.tmp}
  // A final `session.jsonl.zstd` entry is the durable publication (the
  // write-behind publishes via a synced temp + move; a bare *.tmp is NOT
  // recoverable by a cold read — the cold path's findLog only sees the final
  // name, so an uncommitted staging file reads as "session not found").
  const diskFilesFor = (sessionId) => {
    const home = process.env.DSH_HOME
    if (!home) return { error: 'no DSH_HOME' }
    let sessionsRoot
    try {
      sessionsRoot = join(home, 'sessions')
      const projectDirs = readdirSync(sessionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory())
      for (const pd of projectDirs) {
        const dir = join(sessionsRoot, pd.name, sessionId)
        let entries
        try {
          entries = readdirSync(dir, { withFileTypes: true })
        } catch {
          continue // not this project dir
        }
        const files = entries.filter((e) => e.isFile()).map((e) => ({
          name: e.name,
          size: statSync(join(dir, e.name)).size,
          final: e.name === 'session.jsonl.zstd',
        }))
        return { projectDir: pd.name, files }
      }
      return { found: false, sessionsRoot }
    } catch (error) {
      return { error: String((error && error.message) ?? error) }
    }
  }

  // Bounded wait until the session log is durably published on disk as the
  // final artifact (session.jsonl.zstd). An awaited `session/flush` emit from
  // this sibling row is NOT observably a synchronous publication barrier on
  // this pinned build — the jsonl write-behind's own 200ms window performs the
  // publication (see evidence/manual/obs/obs-diag-commit-*.json), and a process
  // kill inside that window leaves only the staging *.tmp, which a cold read
  // reports as "session not found". The fixture therefore verifies the on-disk
  // state directly before asserting durability.
  const waitForDurable = async (sessionId, timeoutMs = 10_000) => {
    const startedAt = Date.now()
    for (;;) {
      const disk = diskFilesFor(String(sessionId))
      const finalFile = Array.isArray(disk.files) ? disk.files.find((file) => file.final) : undefined
      if (finalFile !== undefined) {
        return { waitMs: Date.now() - startedAt, size: finalFile.size, projectDir: disk.projectDir ?? null }
      }
      const elapsed = Date.now() - startedAt
      if (elapsed >= timeoutMs) {
        const error = new Error(
          `${PROBE}: session log for "${String(sessionId)}" not durably published as the final session.jsonl.zstd within ${timeoutMs}ms; last disk state: ${JSON.stringify(disk)}`,
        )
        error.code = 'P2T2_DURABILITY_VERIFY_TIMEOUT'
        throw error
      }
      await sleepMs(50)
    }
  }

  const obsDir = process.env.P2T2_OBS_DIR
  if (typeof obsDir !== 'string' || obsDir.length === 0) {
    throw new Error(`${PROBE}: P2T2_OBS_DIR is not set; the probe group must export it before boot`)
  }
  const homeTag = (process.env.DSH_HOME ?? 'unknown-home').split(/[\\/]/).filter(Boolean).pop() ?? 'unknown-home'

  // --- machine ordering trace (per boot; the process is the scope) --------
  let seq = 0
  const trace = []
  const sessionStartSources = {}
  const record = (phase, detail = {}) => {
    seq += 1
    const entry = { seq, ts: Date.now(), phase }
    for (const [key, value] of Object.entries(detail)) entry[key] = value
    trace.push(entry)
    return entry
  }

  const isOurs = (value) => typeof value === 'string' && value.startsWith('p2t2-')
  ctx.on('session/created', (session) => {
    if (isOurs(session.id)) record('event:session/created', { sessionId: String(session.id) })
  })
  ctx.on('session/disposed', (session) => {
    if (isOurs(session.id)) record('event:session/disposed', { sessionId: String(session.id) })
  })
  ctx.on('session/event', (session, event) => {
    if (isOurs(session.id)) record('event:session/event', { sessionId: String(session.id), eventType: String(event.type) })
  })
  ctx.on('agent/created', (payload) => {
    const agent = payload && payload.agent
    if (agent && isOurs(agent.id)) record('event:agent/created', { sessionId: String(agent.id) })
  })
  ctx.on('agent/session-start', (payload) => {
    const agent = payload && payload.agent
    if (agent && isOurs(agent.id)) {
      sessionStartSources[String(agent.id)] = String(payload.source)
      record('event:agent/session-start', { sessionId: String(agent.id), source: String(payload.source) })
    }
  })

  record('activate', {
    port: Number(webServer.port),
    backendNames: storage.backend.names(),
    dshHome: process.env.DSH_HOME ?? null,
    services: {
      sessions: sessions !== undefined,
      agents: agents !== undefined,
      sessionPersistence: persistence !== undefined,
      webServer: webServer !== undefined,
      storage: storage !== undefined,
    },
  })

  // --- binding sidecar (public KV seam beneath the StorageDomain form) ----
  const withUnit = (fn) => backend.kv.open(UNIT).then((unit) => fn(unit).finally(() => unit.close()))
  const attachRootBinding = async (rootId, marker) => {
    await withUnit((unit) => unit.putRecord(TABLE, String(rootId), { marker, boundAt: Date.now() }))
    record('binding-attach', { sessionId: String(rootId), marker })
  }
  const resolveRootBinding = async (rootId) => {
    const all = await withUnit((unit) => unit.loadAll())
    const stored = all.tables[TABLE] ? all.tables[TABLE][String(rootId)] : undefined
    if (stored === undefined || typeof stored.marker !== 'string') {
      const error = new Error(
        `${PROBE}: first Team-sensitive step failed for root "${String(rootId)}": no binding record in the ${UNIT.name} sidecar (attach missing or not durable)`,
      )
      error.code = 'P2T2_ROOT_BINDING_MISSING'
      throw error
    }
    return stored.marker
  }
  const live = (id) => sessions.get(SessionId(String(id))) !== undefined

  // --- observation output --------------------------------------------------
  const writeObs = (scenario, primaryId, payload) => {
    mkdirSync(obsDir, { recursive: true })
    const file = join(obsDir, `obs-${scenario}-${primaryId}-${homeTag}.json`)
    writeFileSync(
      file,
      `${JSON.stringify({ probe: PROBE, scenario, primaryId, writtenAt: Date.now(), dshHome: process.env.DSH_HOME ?? null, trace: [...trace], ...payload }, null, 2)}\n`,
    )
    return file
  }
  const respond = (res, body) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  // --- scenario bodies -----------------------------------------------------
  const memberFirstTeamStep = async (memberSession, memberId, expectedRootId) => {
    const parentRaw = memberSession.header ? memberSession.header.parentSession : undefined
    if (parentRaw === undefined) {
      const error = new Error(`${PROBE}: member "${memberId}" has no parentSession in its header; the root is unresolvable for its first Team-sensitive step`)
      error.code = 'P2T2_MEMBER_NO_ROOT'
      throw error
    }
    const parent = String(parentRaw)
    if (parent !== String(expectedRootId)) {
      const error = new Error(`${PROBE}: member "${memberId}" carries parentSession "${parent}" but the fixture root is "${expectedRootId}"`)
      error.code = 'P2T2_MEMBER_WRONG_ROOT'
      throw error
    }
    return resolveRootBinding(parent)
  }

  const scenarioFresh = async ({ rootId, memberId }) => {
    record('run-start', { scenario: 'fresh', rootId, memberId })
    const marker = `P2T2-ROOT-MARKER-${rootId}`
    const rootHandle = await agents.create({ sessionId: SessionId(rootId), meta: { cwd: process.cwd() } })
    const rootSession = rootHandle.agent.session
    await attachRootBinding(rootId, marker)
    const rootMarker = await resolveRootBinding(rootId)
    if (rootMarker !== marker) {
      const error = new Error(`${PROBE}: root marker mismatch after attach: got "${rootMarker}" want "${marker}"`)
      error.code = 'P2T2_MARKER_MISMATCH'
      throw error
    }
    record('first-team-step', { sessionId: rootId, role: 'root', marker: rootMarker, rootLive: live(rootId) })
    const memberHandle = await agents.create({ sessionId: SessionId(memberId), meta: { cwd: process.cwd(), parentSession: SessionId(rootId) } })
    const memberSession = memberHandle.agent.session
    const memberMarker = await memberFirstTeamStep(memberSession, memberId, rootId)
    record('first-team-step', { sessionId: memberId, role: 'member', rootId: String(rootId), marker: memberMarker, rootLive: live(rootId) })
    await ctx.emit('session/flush', rootSession)
    const rootDurable = await waitForDurable(rootId)
    record('durable', { sessionId: rootId, rootLogLength: rootSession.events.length, waitMs: rootDurable.waitMs, size: rootDurable.size })
    await ctx.emit('session/flush', memberSession)
    const memberDurable = await waitForDurable(memberId)
    record('durable', { sessionId: memberId, memberLogLength: memberSession.events.length, waitMs: memberDurable.waitMs, size: memberDurable.size })
    record('run-end', { scenario: 'fresh', rootId, memberId })
    return { ok: true, marker, rootLogLength: rootSession.events.length, memberLogLength: memberSession.events.length }
  }

  const scenarioResumeRoot = async ({ rootId, expectedMarker }) => {
    record('run-start', { scenario: 'resume-root', rootId })
    let handle
    try {
      handle = await agents.resume({ resumeSessionId: SessionId(rootId) })
    } catch (error) {
      const errorName = String(error && error.constructor ? error.constructor.name : 'Error')
      const sessionIdField = error && error.sessionId !== undefined ? String(error.sessionId) : null
      record('resume-rejected', {
        sessionId: rootId,
        errorName,
        errorMessage: String((error && error.message) ?? error),
        sessionIdField,
      })
      if (errorName === 'SessionPersistenceNotFoundError') {
        record('run-end', { scenario: 'resume-root', rootId, rejected: true })
        return { ok: false, code: 'P2T2_RESUME_NOT_FOUND', sessionId: rootId, error: String(error.message) }
      }
      throw error
    }
    const session = handle.agent.session
    const marker = await resolveRootBinding(rootId)
    if (expectedMarker !== undefined && marker !== expectedMarker) {
      const error = new Error(`${PROBE}: recovered root marker "${marker}" does not match the fresh-run marker "${expectedMarker}"`)
      error.code = 'P2T2_MARKER_MISMATCH'
      throw error
    }
    record('binding-recovered', { sessionId: rootId, marker, rootLive: live(rootId) })
    record('first-team-step', { sessionId: rootId, role: 'root', marker, rootLive: live(rootId), source: sessionStartSources[rootId] ?? null })
    await ctx.emit('session/flush', session)
    record('run-end', { scenario: 'resume-root', rootId, rootLogLength: session.events.length })
    return { ok: true, sessionId: rootId, marker, source: sessionStartSources[rootId] ?? null, rootLogLength: session.events.length }
  }

  const scenarioResumeMember = async ({ memberId, rootId, expectedMarker }) => {
    record('run-start', { scenario: 'resume-member', memberId, rootId })
    const handle = await agents.resume({ resumeSessionId: SessionId(memberId) })
    const session = handle.agent.session
    const marker = await memberFirstTeamStep(session, memberId, rootId)
    if (expectedMarker !== undefined && marker !== expectedMarker) {
      const error = new Error(`${PROBE}: recovered root marker "${marker}" does not match the fresh-run marker "${expectedMarker}"`)
      error.code = 'P2T2_MARKER_MISMATCH'
      throw error
    }
    const rootLive = live(rootId)
    record('binding-recovered', { sessionId: memberId, role: 'member', rootId: String(rootId), marker, rootLive, via: rootLive ? 'live+sidecar' : 'sidecar-only' })
    record('first-team-step', { sessionId: memberId, role: 'member', rootId: String(rootId), marker, rootLive, source: sessionStartSources[memberId] ?? null })
    await ctx.emit('session/flush', session)
    record('run-end', { scenario: 'resume-member', memberId, rootId, memberLogLength: session.events.length })
    return { ok: true, sessionId: memberId, rootId: String(rootId), marker, rootLive, source: sessionStartSources[memberId] ?? null, memberLogLength: session.events.length }
  }

  const scenarioNegLateBinding = async ({ lateId }) => {
    record('run-start', { scenario: 'neg-late-binding', rootId: lateId })
    const handle = await agents.create({ sessionId: SessionId(lateId), meta: { cwd: process.cwd() } })
    const session = handle.agent.session
    let violation
    try {
      await resolveRootBinding(lateId)
      const error = new Error(`${PROBE}: neg-late-binding: the first Team-sensitive step unexpectedly succeeded BEFORE the binding attach (rootId=${lateId})`)
      error.code = 'P2T2_NEGATIVE_LOST'
      throw error
    } catch (error) {
      if (error.code !== 'P2T2_ROOT_BINDING_MISSING') throw error
      violation = { code: error.code, message: String(error.message) }
    }
    record('first-team-step-failed', { sessionId: lateId, violation })
    await attachRootBinding(lateId, `P2T2-ROOT-MARKER-${lateId}`)
    const marker = await resolveRootBinding(lateId)
    record('first-team-step', { sessionId: lateId, role: 'root', afterLateBinding: true, marker })
    await ctx.emit('session/flush', session)
    record('run-end', { scenario: 'neg-late-binding', rootId: lateId })
    return { ok: false, code: 'P2T2_ROOT_BINDING_MISSING', sessionId: lateId, error: violation.message, marker }
  }

  const scenarioPrepCustomEvent = async ({ probeId }) => {
    record('run-start', { scenario: 'prep-custom-event', sessionId: probeId })
    const handle = await agents.create({ sessionId: SessionId(probeId), meta: { cwd: process.cwd() } })
    const session = handle.agent.session
    session.append(DOWNSTREAM_EVENT_TYPE, { note: 'P2T2: session-log binding candidate (legacy design) — cold-read negative setup' })
    record('session-log-marker-appended', { sessionId: probeId, eventType: DOWNSTREAM_EVENT_TYPE, logLength: session.events.length })
    await ctx.emit('session/flush', session)
    const probeDurable = await waitForDurable(probeId)
    record('durable', { sessionId: probeId, logLength: session.events.length, waitMs: probeDurable.waitMs, size: probeDurable.size })
    record('run-end', { scenario: 'prep-custom-event', sessionId: probeId })
    return { ok: true, sessionId: probeId, eventType: DOWNSTREAM_EVENT_TYPE, logLength: session.events.length }
  }

  const scenarioNegCustomEventCold = async ({ probeId }) => {
    record('run-start', { scenario: 'neg-custom-event-cold', sessionId: probeId })
    let refusal
    try {
      await agents.resume({ resumeSessionId: SessionId(probeId) })
      const error = new Error(
        `${PROBE}: neg-custom-event-cold: agents.resume unexpectedly SUCCEEDED for a session carrying the downstream event type "${DOWNSTREAM_EVENT_TYPE}" (sessionId=${probeId})`,
      )
      error.code = 'P2T2_NEGATIVE_LOST'
      throw error
    } catch (error) {
      const message = String((error && error.message) ?? error)
      if (!message.includes('unknown to this harness')) throw error
      refusal = message
    }
    record('session-log-cold-read-refused', { sessionId: probeId, refusal })
    record('run-end', { scenario: 'neg-custom-event-cold', sessionId: probeId })
    return { ok: false, code: 'P2T2_CUSTOM_EVENT_COLD_READ_REFUSED', sessionId: probeId, error: refusal }
  }

  const dispatch = {
    fresh: (params) => scenarioFresh(params),
    'resume-root': (params) => scenarioResumeRoot({ rootId: params.rootId, expectedMarker: params.marker ?? undefined }),
    'resume-member': (params) => scenarioResumeMember({ memberId: params.memberId, rootId: params.rootId, expectedMarker: params.marker ?? undefined }),
    'neg-late-binding': (params) => scenarioNegLateBinding(params),
    'prep-custom-event': (params) => scenarioPrepCustomEvent(params),
    'neg-custom-event-cold': (params) => scenarioNegCustomEventCold(params),
  }

  const handler = (req, res) => {
    (async () => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const scenario = url.searchParams.get('scenario')
      const params = {
        rootId: url.searchParams.get('rootId'),
        memberId: url.searchParams.get('memberId'),
        lateId: url.searchParams.get('lateId'),
        probeId: url.searchParams.get('probeId'),
        marker: url.searchParams.get('marker'),
      }
      const body = { probe: PROBE, scenario, traceLength: trace.length }
      try {
        const runScenario = dispatch[scenario ?? '']
        if (runScenario === undefined) throw new Error(`${PROBE}: unknown scenario '${scenario}'`)
        const result = await runScenario(params)
        Object.assign(body, result)
      } catch (error) {
        const code = error && typeof error.code === 'string' ? error.code : 'P2T2_UNEXPECTED_ERROR'
        record('scenario-error', { scenario: String(scenario), code, error: String((error && error.message) ?? error) })
        body.ok = false
        body.code = code
        body.error = String((error && error.message) ?? error)
      }
      const primaryId = params.rootId ?? params.memberId ?? params.lateId ?? params.probeId ?? 'unknown'
      body.obsFile = writeObs(String(scenario ?? 'unknown'), String(primaryId), body)
      respond(res, body)
    })().catch(() => {
      try {
        respond(res, { probe: PROBE, ok: false, code: 'P2T2_HANDLER_CRASH', error: 'p2t2 handler crashed; see instance log' })
      } catch {
        // the response is already dead; nothing left to report
      }
    })
  }
  ctx.effect(() => webServer.register({ kind: 'exact', path: ROUTE, handler }), `${PROBE} web route`)
}
