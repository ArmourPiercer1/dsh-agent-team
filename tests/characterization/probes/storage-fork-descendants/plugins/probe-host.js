/**
 * P2-T5 probe payload — storage-fork-descendants.
 *
 * Runs INSIDE the dsh web instance as a composition-mounted host plugin.
 * It is driven by a directive file the probe group
 * (probes/storage-fork-descendants/index.mjs) writes under the instance's
 * DSH_HOME before each boot, and it answers with one machine-readable
 * observation JSON in the run report directory.
 *
 * Public seam usage only:
 *   - ctx.get('storageDomain' | 'subagents' | 'sessions' | 'agents')
 *     (optional reads; absence is recorded as a failure, never injected)
 *   - agents.create({agentOptions: {provider, model}}) — the public model
 *     route seam; fork children inherit it. The web bundle persona's
 *     {{model}} prompt variable resolves from AgentOptions.model, so a
 *     modelless agent dies in prompt assembly before any model call.
 *   - ctx.on('session/event', (session, event)) — the store's commit-time
 *     event seam (the same one upstream session-persistence/projection
 *     consume). The interrupted grandchild's session DETACHES from the
 *     live store as soon as its turn settles, so its turn/end is captured
 *     synchronously in this observer (inside the append, before detach).
 *   - package roots: @deepseek-ai/dsh-storage-domain (defineDomain,
 *     domainTable, descriptorOf), zod (record schemas — the storage-domain
 *     spec's documented split: plugin config is schemastery, record schemas
 *     are zod)
 *   - node: builtins for directive/observation IO
 *
 * It never serializes live Cordis objects: only leaf fields of headers,
 * events, and listing entries are copied into plain owned objects.
 *
 * Phases (directive.phase):
 *   seed    — write domain records + global; build the root/member/grand
 *             subagent fixture via the public subagent API; enumerate;
 *             interrupt the grandchild (user authority) with negative
 *             controls; drain all continuable descendants; dispose root.
 *   verify  — after a process restart on the SAME DSH_HOME: reopen the
 *             domain and read back every seeded value; re-read the durable
 *             lineage (headers + descendant listing) and the turn/end
 *             reasons left by the interrupt and the drain.
 *   isolate — on a FRESH scratch DSH_HOME: the same domain name must open
 *             clean (initial global, empty table) and the fixture lineage
 *             must not exist (persistence is home-external, not process- or
 *             store-global).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { defineDomain, descriptorOf, domainTable } from '@deepseek-ai/dsh-storage-domain'
import * as z from 'zod'

export const name = 'p2t5-sfd-probe'

/** The probe group's fixed directive name under the instance's DSH_HOME. */
function directivePath() {
  const home = process.env.DSH_HOME
  if (home === undefined || home === '') throw new Error('DSH_HOME env missing — probe cannot locate its directive')
  return join(home, 'p2t5-directive.json')
}

function readDirective() {
  const path = directivePath()
  if (!existsSync(path)) throw new Error(`directive file missing: ${path}`)
  const directive = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof directive.phase !== 'string') throw new Error('directive.phase missing')
  if (typeof directive.reportDir !== 'string') throw new Error('directive.reportDir missing')
  return directive
}

function writeObservation(directive, payload) {
  const path = join(directive.reportDir, `obs-${directive.phase}.json`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`)
  return path
}

/** One deterministic domain spec shared by every phase (values come from the directive). */
function buildSpec(d) {
  return defineDomain({
    name: d.name,
    version: d.version,
    global: {
      schema: z.object({ note: z.string(), count: z.number().int() }),
      initial: d.initial,
    },
    tables: {
      records: domainTable(z.object({ v: z.string(), n: z.number().int() })),
    },
  })
}

/** Poll `fn` (async, truthy = done) every `everyMs` until the deadline. */
async function waitFor(fn, timeoutMs, everyMs, what) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await fn()) return true
    if (Date.now() >= deadline) throw new Error(`timed out after ${timeoutMs}ms waiting: ${what}`)
    await new Promise((resolve) => setTimeout(resolve, everyMs))
  }
}

/** Copy the durable lineage-relevant header leaf fields into a plain object. */
function pickHeader(header) {
  if (header === undefined || header === null) return undefined
  return {
    id: header.id,
    parentSession: header.parentSession ?? null,
    origin: header.origin ?? null,
    delegationDepth: header.delegationDepth ?? null,
    seedLength: header.seedLength ?? null,
    agentPreset: header.agentPreset ?? null,
    cwd: header.cwd ?? null,
    createdAt: header.createdAt,
  }
}

/** The turn-boundary events of one session log, as plain leaf data. */
function turnEvents(session) {
  if (session === undefined || session === null) return null
  return session.events
    .filter((event) => event.type === 'turn/start' || event.type === 'turn/end')
    .map((event) => ({
      seq: event.seq,
      type: event.type,
      ...(event.type === 'turn/end' ? { reason: event.data.reason } : {}),
    }))
}

/** Plain copy of one descendant listing entry (leaf fields only). */
function pickEntry(entry) {
  return {
    kind: entry.kind,
    id: entry.id,
    ...(entry.kind === 'child'
      ? {
        mode: entry.mode,
        label: entry.label ?? null,
        activity: entry.activity,
        hasChildren: entry.hasChildren,
        parentId: entry.parentId,
        depth: entry.depth,
      }
      : { reason: entry.reason }),
  }
}

const textPrompt = (body) => [{ type: 'text', text: body }]

export function apply(ctx) {
  let directive
  try {
    directive = readDirective()
  } catch (error) {
    // No directive: the instance booted without this group's control file
    // (e.g. a shared home). Stay inert and loud in the instance log.
    console.error(`[p2t5-sfd-probe] directive unreadable: ${error.message}`)
    return
  }
  const startedAt = new Date().toISOString()
  const finish = (ok, data, fatal) => {
    try {
      writeObservation(directive, {
        ok,
        phase: directive.phase,
        startedAt,
        finishedAt: new Date().toISOString(),
        ...(data !== undefined ? { data } : {}),
        ...(fatal !== undefined ? { fatal } : {}),
      })
    } catch (writeError) {
      console.error(`[p2t5-sfd-probe] failed writing observation: ${writeError.message}`)
    }
  }

  const work = async () => {
    const d = directive.domain
    const ids = directive.ids
    const spec = buildSpec(d)
    const descriptor = descriptorOf(spec)
    const services = {
      storageDomain: ctx.get('storageDomain'),
      subagents: ctx.get('subagents'),
      sessions: ctx.get('sessions'),
      agents: ctx.get('agents'),
      sessionQuery: ctx.get('sessionQuery'),
    }
    // Bounded wait: base-bundle services (sessionQuery in particular, whose
    // plugin fiber activates asynchronously after this apply runs) may
    // register shortly after apply. The debug1 DIAG poll proved sessionQuery
    // present within ~1 s of apply on all three boots, so a 30 s bound is
    // generous. Only services still absent at the deadline are fatal.
    let missing = Object.entries(services)
      .filter(([, value]) => value === undefined)
      .map(([key]) => key)
    const serviceDeadline = Date.now() + 30_000
    while (missing.length > 0 && Date.now() < serviceDeadline) {
      for (const key of Object.keys(services)) services[key] = ctx.get(key)
      missing = Object.entries(services)
        .filter(([, value]) => value === undefined)
        .map(([key]) => key)
      if (missing.length > 0) await new Promise((r) => setTimeout(r, 500))
    }
    if (missing.length > 0) {
      // Failure-path diagnostics (never run on the success path): which
      // service names resolve, whether the property proxy sees them, what
      // the found services expose, and whether `sessionQuery` registers
      // late. The JSON rides in the error message into the fatal obs.
      const diag = { missing, probe: {}, propProbe: {}, sessionsMethods: null, storageDomainMethods: null, poll: [] }
      for (const n of ['sessionQuery', 'sessions', 'storageDomain', 'subagents', 'agents', 'session-query', 'sessionQuerySqlite', 'sessionQueryEngine', 'sessionPersistence', 'sessionProjection']) {
        try { diag.probe[n] = ctx.get(n) !== undefined } catch (e) { diag.probe[n] = `threw: ${e.message}` }
      }
      for (const n of ['sessionQuery', 'sessions']) {
        try { diag.propProbe[n] = ctx[n] !== undefined } catch (e) { diag.propProbe[n] = `threw: ${e.message}` }
      }
      try {
        const s = ctx.get('sessions')
        if (s !== undefined) diag.sessionsMethods = [...new Set([...Object.keys(Object.getPrototypeOf(s) ?? {}), ...Object.keys(s)])].slice(0, 40)
      } catch { /* stays null */ }
      try {
        const sd = ctx.get('storageDomain')
        if (sd !== undefined) diag.storageDomainMethods = Object.keys(sd).slice(0, 40)
      } catch { /* stays null */ }
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        try { diag.poll.push(ctx.get('sessionQuery') !== undefined) } catch { diag.poll.push('threw') }
      }
      throw new Error(`required base-bundle services missing via ctx.get: ${missing.join(', ')} | DIAG ${JSON.stringify(diag)}`)
    }
    const { storageDomain, subagents, sessions, agents, sessionQuery } = services

    // Partial-data capture: each phase registers its own `data` object the
    // moment it exists, so a later failure still serializes everything
    // gathered up to the throw (phases assign owned leaf data only).
    const onPartial = (data) => { partial.data = data }

    // Race-free capture of the interrupted grandchild's turn/end. Once the
    // child's interrupted turn settles, the subagent system disposes the
    // child agent and the session DETACHES from the live store (cold-resume
    // design), so polling `sessions.get(...).events` can miss the turn/end
    // entirely. The store's `session/event` observer fires synchronously
    // inside the append — before any detach — and is the same seam the
    // upstream session-persistence/session-projection plugins consume.
    const interruptCapture = { grandEnd: null }
    ctx.on('session/event', (session, event) => {
      if (event.type !== 'turn/end') return
      if (String(session === undefined || session === null ? '' : session.id) !== ids.grand) return
      const reason = event.data === undefined || event.data === null ? undefined : event.data.reason
      interruptCapture.grandEnd = {
        seq: event.seq,
        reason: reason === undefined || reason === null
          ? null
          : {
            kind: reason.kind ?? null,
            reason: reason.reason === undefined || reason.reason === null ? null : reason.reason.kind ?? null,
          },
      }
    })

    if (directive.phase === 'seed') return finish(true, await seed({ d, ids, spec, descriptor, storageDomain, subagents, sessions, agents, sessionQuery, cwd: directive.cwd, onPartial, interruptCapture }))
    if (directive.phase === 'verify') return finish(true, await verify({ d, ids, spec, descriptor, storageDomain, subagents, sessions, sessionQuery, unknownId: ids.unknown, onPartial }))
    if (directive.phase === 'isolate') return finish(true, await isolate({ d, ids, spec, descriptor, storageDomain, subagents, sessions, sessionQuery, onPartial }))
    throw new Error(`unknown directive.phase: ${directive.phase}`)
  }

  // Lives in apply() scope so the .catch below can serialize whatever the
  // phase gathered before throwing.
  const partial = { data: undefined }
  Promise.resolve()
    .then(work)
    .catch((error) => {
      finish(false, partial.data, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    })
}

// --------------------------------------------------------------------------- seed

async function seed({ d, ids, spec, descriptor, storageDomain, subagents, sessions, agents, sessionQuery, cwd, onPartial, interruptCapture }) {
  const data = { domain: { descriptor, ids }, labels: { member1: ids.member1, member2: ids.member2, grand: ids.grand } }
  onPartial?.(data)

  // 1. Storage seam: write records + global, read them back in-instance,
  //    then prove the fail-loud double-open.
  const domain = await storageDomain.open(spec)
  const table = domain.table('records')
  for (const [key, value] of Object.entries(d.records)) await table.put(key, value)
  await domain.global.set(d.global)
  const readback = {}
  for (const key of Object.keys(d.records)) readback[key] = table.get(key)
  data.domain.readback = { records: readback, global: domain.global.get() }
  let doubleOpen = null
  try {
    await storageDomain.open(spec)
  } catch (error) {
    doubleOpen = { code: error.code ?? null, message: error.message }
  }
  data.domain.doubleOpen = doubleOpen
  await domain.close()

  // 2. Fixture: root agent + two continuable fork members + one grandchild.
  // The web bundle persona references {{model}}; an agent created without a
  // model dies in prompt assembly before any model call (characterized in
  // debug3: turn/end error "prompt variable {{model}} has no value"). The
  // public AgentOptions seam supplies the route; fork children inherit it
  // (resolveChildAgentOptions), and the request routes to the group's
  // llm-deepseek.baseURL override (blackhole), holding the turn in-flight.
  const model = { provider: 'deepseek-official', model: 'deepseek-v4-flash' }
  data.model = model
  const rootHandle = await agents.create({ sessionId: ids.root, meta: { cwd }, agentOptions: model })
  const rootAgent = rootHandle.agent
  const controller = new AbortController()
  const prompt = (label) => textPrompt(`P2-T5 fixture: ${label} — hold for interrupt probe.`)

  const startMember1 = await subagents.startContinuable({
    provider: 'fork',
    label: 'member-1',
    childId: ids.member1,
    request: { prompt: prompt('member one'), parent: rootAgent },
    signal: controller.signal,
  })
  const startMember2 = await subagents.startContinuable({
    provider: 'fork',
    label: 'member-2',
    childId: ids.member2,
    request: { prompt: prompt('member two'), parent: rootAgent },
    signal: controller.signal,
  })
  data.fixture = { startMember1, startMember2 }

  // 2a. Negative control (fail-loud): the same child id must be rejected as
  //     a duplicate before any second child can exist.
  let duplicateChild = null
  try {
    await subagents.startContinuable({
      provider: 'fork',
      label: 'member-1-dup',
      childId: ids.member1,
      request: { prompt: prompt('duplicate attempt'), parent: rootAgent },
      signal: controller.signal,
    })
  } catch (error) {
    duplicateChild = { code: error.code ?? null, message: error.message }
  }
  data.fixture.duplicateChild = duplicateChild

  // The descriptors are seeded into each child log, so the children must
  // appear in the descendant listing as soon as they are published; their
  // turns then run against the blackhole endpoint and hold at `running`.
  await waitFor(async () => {
    const entries = await subagents.listDescendants(ids.root)
    return entries.filter((entry) => entry.kind === 'child' && (entry.id === ids.member1 || entry.id === ids.member2)).length === 2
  }, 90_000, 500, 'both members listed under the root')

  const member1Agent = agents.get(ids.member1)
  if (member1Agent === undefined) throw new Error('public agents.get does not resolve the live member1 agent — grandchild fixture impossible')
  const startGrand = await subagents.startContinuable({
    provider: 'fork',
    label: 'grand-1',
    childId: ids.grand,
    request: { prompt: prompt('grandchild one'), parent: member1Agent },
    signal: controller.signal,
  })
  data.fixture.startGrand = startGrand
  await waitFor(async () => {
    const entries = await subagents.listDescendants(ids.root)
    return entries.filter((entry) => entry.kind === 'child').length === 3
  }, 90_000, 500, 'all three descendants listed')

  // 3. Enumeration + lineage snapshot while every descendant turn is held.
  await waitFor(async () => {
    const entries = await subagents.listDescendants(ids.root)
    return entries.every((entry) => entry.kind === 'child' && entry.activity === 'running')
  }, 90_000, 500, 'all descendants activity=running (held on the blackhole turn)')
  const entriesRunning = pickEntries(await subagents.listDescendants(ids.root))
  const headers = {}
  for (const key of ['root', 'member1', 'member2', 'grand']) {
    const session = sessions.get(ids[key])
    headers[key] = session === undefined ? 'missing' : pickHeader(session.header)
  }
  data.enumeration = { entries: entriesRunning, headers }

  // 3a. Negative control (no phantom rows): a PLAIN session fork of the root
  //     (no subagent origin) must remain a traversal node, never an entry.
  const plainFork = sessions.fork(ids.root, undefined, ids.plainFork)
  const entriesAfterPlainFork = pickEntries(await subagents.listDescendants(ids.root))
  data.plainFork = {
    id: ids.plainFork,
    forkedHeader: pickHeader(plainFork.header),
    entryCount: entriesAfterPlainFork.length,
    entryIds: entriesAfterPlainFork.map((entry) => entry.id),
  }

  // 4a. Negative control on interrupt authority, run FIRST while the
  //     grandchild's turn is still live: the authority check only fires for
  //     LIVE targets. An interrupt aimed at an absent (already settled /
  //     detached) target is an accepted silent no-op regardless of authority
  //     (see the S3.3 finding), so the wrong-parent attempt must happen
  //     before the successful interrupt below settles the turn.
  let wrongParent = null
  try {
    subagents.interrupt(ids.grand, { kind: 'user', parentSessionId: ids.member2 })
  } catch (error) {
    wrongParent = { code: error.code ?? null, message: error.message }
  }

  // 4. Interrupt seam: user authority, the grandchild's durable direct
  //    parent (member1). The held turn must end aborted/user and the entry
  //    must flip to inactive.
  //
  // The turn/end is observed through the `session/event` observer installed
  // in work() (interruptCapture), NOT by polling `sessions.get(ids.grand)`
  // here: the moment the interrupted turn settles, the subagent system
  // disposes the child agent and the session detaches from the live store,
  // so a poll can legitimately observe the session as already gone and miss
  // the turn/end. The observer fires synchronously inside the append,
  // before any detach.
  subagents.interrupt(ids.grand, { kind: 'user', parentSessionId: ids.member1 })
  await waitFor(async () => interruptCapture.grandEnd !== null, 30_000, 250, 'grandchild turn/end aborted(user)')
  const grandAfterInterrupt = (await subagents.listDescendants(ids.root)).find((entry) => entry.id === ids.grand)
  data.interrupt = {
    grandEnd: interruptCapture.grandEnd,
    grandActivityAfter: grandAfterInterrupt === undefined ? 'gone' : grandAfterInterrupt.activity,
    wrongParent,
  }

  // 4b. Negative controls on interrupt authority (absent / self-ancestor
  //     targets), after the turn has settled.
  let unknownTarget = { threw: true }
  try {
    subagents.interrupt(ids.unknown, { kind: 'user', parentSessionId: ids.root })
    unknownTarget = { threw: false }
  } catch (error) {
    unknownTarget = { threw: true, code: error.code ?? null, message: error.message }
  }
  data.interrupt.unknownTarget = unknownTarget
  let selfAncestor = null
  try {
    subagents.interrupt(ids.root, { kind: 'ancestor', agent: rootAgent })
  } catch (error) {
    selfAncestor = { code: error.code ?? null, message: error.message }
  }
  data.interrupt.selfAncestor = selfAncestor

  // 4c. The two members are still held mid-turn at this point (no turn/end
  //     yet) — the drain below must interrupt live turns, not settle idle
  //     ones.
  data.membersTurnEndBeforeDrain = {
    member1: lastTurnEndReason(sessions.get(ids.member1)),
    member2: lastTurnEndReason(sessions.get(ids.member2)),
  }

  // 5. Drain seam: stop every continuable descendant of the root. Must
  //    resolve; afterwards no descendant agent or live session remains.
  const drainStarted = Date.now()
  let drainError = null
  try {
    await subagents.drainContinuableDescendants([rootAgent])
  } catch (error) {
    drainError = { code: error.code ?? null, message: error.message }
  }
  const drainMs = Date.now() - drainStarted
  await waitFor(async () => agents.get(ids.member1) === undefined, 15_000, 200, 'member1 agent released after drain').catch(() => {})
  data.drain = {
    error: drainError,
    ms: drainMs,
    after: Object.fromEntries(
      ['member1', 'member2', 'grand'].map((key) => [
        key,
        { agentAlive: agents.get(ids[key]) !== undefined, sessionLive: sessions.get(ids[key]) !== undefined },
      ]),
    ),
  }

  // 6. Tear the fixture down through the public handle (root is not a
  //    descendant, so the drain left it standing).
  let rootDispose = null
  try {
    await rootHandle.dispose()
    rootDispose = { disposed: true, agentAlive: agents.get(ids.root) !== undefined, sessionLive: sessions.get(ids.root) !== undefined }
  } catch (error) {
    rootDispose = { disposed: false, message: error.message }
  }
  data.rootDispose = rootDispose

  // 7. Persistence gate: the JSONL backend must have materialized every
  //    fixture session log BEFORE the probe group stops the instance — the
  //    verify phase's durability claims only hold if this gate passed.
  //    plainFork is advisory: a zero-event fork may legitimately not
  //    materialize, and its value is still recorded.
  const corpusWait = 30_000
  const fixtureKeys = ['root', 'member1', 'member2', 'grand']
  const persistedSnapshot = {}
  const gate = await waitFor(async () => {
    const records = await sessionQuery.listSessions()
    for (const record of records) persistedSnapshot[record.header.id] = record.persisted
    return fixtureKeys.every((key) => persistedSnapshot[ids[key]] === true)
  }, corpusWait, 250, 'all fixture session logs materialized in the persistence backend')
    .catch(() => false)
  data.persistedGate = {
    passed: gate,
    waitedMs: corpusWait,
    snapshot: Object.fromEntries(fixtureKeys.map((key) => [key, persistedSnapshot[ids[key]] ?? false])),
    plainFork: persistedSnapshot[ids.plainFork] ?? false,
  }
  return data
}

// --------------------------------------------------------------------------- verify

function lastTurnEndReason(session) {
  const events = turnEvents(session)
  if (events === null) return 'missing-session'
  const lastEnd = [...events].reverse().find((event) => event.type === 'turn/end')
  return lastEnd === undefined ? null : lastEnd.data?.reason
}

function pickEntries(entries) {
  return entries.map(pickEntry)
}

// --------------------------------------------------------------------------- verify

async function verify({ d, ids, spec, descriptor, storageDomain, subagents, sessions, sessionQuery, unknownId, onPartial }) {
  const data = { domain: { descriptor } }
  onPartial?.(data)

  // 1. External persistence: the medium outlived the process. Every seeded
  //    record and the global must come back byte-equal (schema-validated on
  //    open — a corrupt record would fail loud here).
  const domain = await storageDomain.open(spec)
  const table = domain.table('records')
  const records = {}
  for (const key of Object.keys(d.records)) records[key] = table.get(key)
  data.domain.records = records
  data.domain.global = domain.global.get()
  data.domain.entryCount = [...table.entries()].length
  await domain.close()

  // 2. Durable lineage through the persisted corpus (sessionQuery): the
  //    live store is process-scoped — after a restart it is empty for the
  //    fixture ids, and the web UI re-materializes past sessions on demand
  //    (agents.resume). The durable facts must be readable from the medium:
  //    corpus records, replay-validated exact logs, and the recursive
  //    lineage trace.
  const corpus = await sessionQuery.listSessions()
  const recordOf = (key) => {
    const record = corpus.find((r) => r.header.id === ids[key])
    if (record === undefined) return { present: false }
    return { present: true, live: record.live, persisted: record.persisted, header: pickHeader(record.header) }
  }
  data.corpus = Object.fromEntries(['root', 'member1', 'member2', 'grand', 'plainFork'].map((key) => [key, recordOf(key)]))

  const logOf = async (key) => {
    try {
      const snapshot = await sessionQuery.readSession(ids[key])
      return {
        header: pickHeader(snapshot.session),
        turnEnds: snapshot.events
          .filter((event) => event.type === 'turn/end')
          .map((event) => ({ seq: event.seq, reason: event.data.reason })),
      }
    } catch (error) {
      return { error: { code: error.code ?? null, message: error.message } }
    }
  }
  data.logs = {}
  for (const key of ['root', 'member1', 'member2', 'grand']) data.logs[key] = await logOf(key)

  // 2a. Live store after restart: expected empty for every fixture id
  //     (documented process-scoped behavior, recorded not failed).
  data.liveStoreAfterRestart = Object.fromEntries(
    ['root', 'member1', 'member2', 'grand'].map((key) => [key, sessions.get(ids[key]) !== undefined]),
  )

  // 2b. Durable enumeration: the same three subagent-origin descendants,
  //     same parentId/depth/mode/label, now inactive (no live agents).
  data.entries = pickEntries(await subagents.listDescendants(ids.root))

  // 2c. Durable lineage trace: the recursive session tree rooted at the
  //     persisted root. plainFork must appear HERE (session-tree child, no
  //     subagent origin) while the entry listing above excludes it.
  let trace = null
  let traceError = null
  try {
    const t = await sessionQuery.traceSession(ids.root)
    trace = {
      complete: t.complete,
      rootId: t.complete === true ? t.root.header.id : null,
      ancestorIds: t.ancestors.map((record) => record.header.id),
      descendants: traceNodes(t.descendants),
    }
  } catch (error) {
    traceError = { code: error.code ?? null, message: error.message }
  }
  data.trace = trace
  data.traceError = traceError

  // 3. Negative controls: an unknown session id is absent from the corpus,
  //    and the exact read fails loud with a deterministic code.
  const unknown = { id: unknownId, inCorpus: corpus.some((r) => r.header.id === unknownId) }
  try {
    await sessionQuery.readSession(unknownId)
    unknown.readSession = { threw: false }
  } catch (error) {
    unknown.readSession = { threw: true, code: error.code ?? null }
  }
  data.unknownSession = unknown
  return data
}

/** Flatten one lineage trace node tree into plain leaf data. */
function traceNodes(nodes) {
  return nodes.map((node) => ({
    id: node.session.header.id,
    parentId: node.session.header.parentSession ?? null,
    origin: node.session.header.origin ?? null,
    children: traceNodes(node.descendants),
  }))
}

// --------------------------------------------------------------------------- isolate

async function isolate({ d, ids, spec, descriptor, storageDomain, subagents, sessions, sessionQuery, onPartial }) {
  const data = { domain: { descriptor } }
  onPartial?.(data)

  // 1. The same domain name/version on a FRESH home medium: opens clean,
  //    global serves `initial` (never written), the table is empty.
  const domain = await storageDomain.open(spec)
  const table = domain.table('records')
  data.domain.entries = [...table.entries()]
  data.domain.keys = [...table.keys()]
  data.domain.global = domain.global.get()
  await domain.close()

  // 2. The fixture lineage must not leak into this home: fixture ids are
  //    absent from the live store AND from the persisted corpus, and the
  //    descendant listing of the (absent) root resolves to [] — an unknown
  //    root is not an error.
  data.liveStore = Object.fromEntries(
    ['root', 'member1', 'member2', 'grand'].map((key) => [key, sessions.get(ids[key]) !== undefined]),
  )
  const corpus = await sessionQuery.listSessions()
  data.corpusFixtureIds = ['root', 'member1', 'member2', 'grand', 'plainFork'].filter(
    (key) => corpus.some((r) => r.header.id === ids[key]),
  )
  data.entries = pickEntries(await subagents.listDescendants(ids.root))
  let readMissing = { threw: true }
  try {
    await sessionQuery.readSession(ids.root)
    readMissing = { threw: false }
  } catch (error) {
    readMissing = { threw: true, code: error.code ?? null }
  }
  data.readMissingRoot = readMissing
  return data
}
