/**
 * client.mjs — G8 reviewer-2 e2e browser-less client (brief §5.3).
 *
 * A plain node:http client standing in for the (not-yet-built) vNext web
 * UI: it mints the session cookie through the launch URL, then drives the
 * REAL p8t4 test client (worktree `packages/remote/test/p8t4-test-client.ts`
 * over a real-HTTP RemotePushTransport) plus raw `client-request` POSTs
 * through the B2-characterized wire protocol:
 *
 *   GET  /?token=<launchToken>            → 302/303 + Set-Cookie dsh-auth-*
 *   POST /team-remote/<endpoint>          → 200 {type:'server-response',
 *        body {type:'client-request',             rpcId,
 *               rpcId, method, payload}           result:{ok,...}}
 *   negatives: no cookie 401 · wrong content-type 415 ·
 *              method≠endpoint 200 result.error.code 'bad-request'
 *
 * Scenarios (brief §5.3):
 *   E1 — projection round-trip: raw team.create (seeds the real TeamDomain),
 *        first pull applies gen 1; the raw getProjection value round-trips
 *        JSON.stringify → JSON.parse → parseTeamProjection (P8-T1 typed
 *        DTO); provenance intact (origin/method/contractVersion/
 *        projectionGeneration + requestToken semantics).
 *   E2 — round-trip after reconnect: (a) simulated channel loss →
 *        transport-loss verdict, reconnecting state, frozen backoff entry,
 *        deterministic advance() → duplicate (idempotent gen 1); (b) the
 *        connection is destroyed and a NEW client with a re-minted cookie
 *        re-pulls: apply gen 1, content deep-equal to the durable truth
 *        read over a second raw RPC, generation equal-or-advanced.
 *   E3 — stale response ignored: a gen-1 wire response is captured
 *        in-flight; a newer fact (member.create → durable gen 2) lands and
 *        is applied; then the stale-generation response is delivered
 *        (the harness row serves its cached gen-1 snapshot — a genuine
 *        over-the-wire stale payload) and the client REJECTS it: verdict
 *        `stale`, applied state untouched. Deterministic equivalent of the
 *        brief's in-flight race; the pure verdict path is additionally
 *        covered in-process by the p8t4 stale suites (P8-T1
 *        `decideFrameVerdict`).
 *   E4 — ledger pagination stable under growth (P8-T2 read-path contract):
 *        page (anchor 0, limit 3) + cursor 3; member.send appends; next
 *        page from the anchor; a raw re-read of anchor 0 returns the
 *        byte-identical first page with total only moved up; a
 *        tracker-level re-fetch of the older anchor is rejected
 *        (anchor-mismatch) without moving the cursor.
 *   E5 — typed errors + provenance: invalid id (closed mirrored P3 code),
 *        unsupported contract version, one admission-blocked action
 *        (duplicate member.create) — every one HTTP 200 `result.ok:false`
 *        with typed code+message, NO 500s, no raw exceptions; every
 *        success carries full provenance.
 *   E6 — wire negatives: no cookie 401; wrong content-type 415;
 *        method≠endpoint 200 bad-request.
 */
import { unlinkSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deepStrictEqual } from 'node:assert'
import { register } from 'node:module'

const HARNESSED_DIR = fileURLToPath(new URL('.', import.meta.url))
const WORKTREE_ROOT = join(HARNESSED_DIR, '..', '..', '..', '..', '..', '..')
const wtUrl = (p) => pathToFileURL(join(WORKTREE_ROOT, p)).href

/** P2-T6 fixture backoff (the exact config the p8t4 suites use). */
const BACKOFF = { baseMs: 20, factor: 2, maxMs: 1000 }
/** Cookie shape characterized in B2 (P2-T6). */
const COOKIE_SHAPE = /^dsh-auth-[A-Za-z0-9_-]{43}=v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
/** One team for the whole run (TeamSessionId = root DSH session id, invariant 9). */
const ID = 'root-g8r2-e1'

export async function run({ port, launchUrl, dshHome, outputDir, log }) {
  // The repo ts-loader, then the worktree TS under test (native type-stripping).
  register(pathToFileURL(join(WORKTREE_ROOT, 'packages/legacy/session-reader/e2e/ts-loader.mjs')).href, import.meta.url)
  const [remote, pushTypes, testClient, projectionMod] = await Promise.all([
    import(wtUrl('packages/remote/src/index.ts')),
    import(wtUrl('packages/remote/src/push/types.ts')),
    import(wtUrl('packages/remote/test/p8t4-test-client.ts')),
    import(wtUrl('packages/contracts/src/projection/projection.ts')),
  ])
  const { PushTransportLossError, REMOTE_PROJECTION_FIELDS, createP8T4TestClient, parseTeamProjection } =
    { ...remote, ...pushTypes, ...testClient, ...projectionMod }

  const CTRL = join(dshHome, 'g8r2-control.json')
  const allResponses = []
  const wireSamples = []
  let rpcCounter = 0

  // ── wire plumbing ────────────────────────────────────────────────────────
  function sample(label, res) {
    wireSamples.push({
      label,
      at: new Date().toISOString(),
      status: res.status,
      body: res.parsed !== null ? res.parsed : { rawHead: res.raw.slice(0, 500) },
    })
  }

  function rawPost({ path, method = 'POST', cookie, contentType = 'application/json', body, timeoutMs = 15_000 }) {
    return new Promise((resolve) => {
      const payload = typeof body === 'string' ? body : JSON.stringify(body)
      const headers = { 'content-length': Buffer.byteLength(payload) }
      if (contentType !== null) headers['content-type'] = contentType
      if (cookie !== undefined) headers.cookie = cookie
      const req = http.request({ host: '127.0.0.1', port, path, method, headers, timeout: timeoutMs }, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let parsed = null
          try {
            parsed = JSON.parse(raw)
          } catch {
            /* non-JSON body (negatives) */
          }
          allResponses.push({ path, status: res.statusCode, rawLen: raw.length, parsed })
          resolve({ status: res.statusCode, parsed, raw })
        })
      })
      req.on('timeout', () => {
        req.destroy()
        resolve({ status: 0, parsed: null, raw: '', error: 'client timeout' })
      })
      req.on('error', (error) => resolve({ status: 0, parsed: null, raw: '', error: error.message }))
      req.write(payload)
      req.end()
    })
  }

  async function mintCookie() {
    return new Promise((resolve, reject) => {
      const req = http.get(launchUrl, { timeout: 10_000 }, (res) => {
        res.resume()
        res.on('end', () => {
          const setCookie = res.headers['set-cookie']
          const first = Array.isArray(setCookie) ? setCookie[0] : setCookie
          const cookie = first ? String(first).split(';')[0].trim() : undefined
          resolve({ status: res.statusCode, cookie })
        })
      })
      req.on('timeout', () => req.destroy(new Error('cookie mint timeout')))
      req.on('error', reject)
    })
  }

  /**
   * Direct wire request. rpcId must be a STRING per the upstream connection
   * seam's wire schema (rpc-schema.ts clientRequestSchema: rpcId z.string());
   * the initiator mints it, the responder echoes it.
   */
  function rpc(endpoint, params, { version = 1, wireMethod, cookie, contentType } = {}) {
    const rpcId = `g8r2-rpc-${++rpcCounter}`
    const body = { type: 'client-request', rpcId, method: wireMethod ?? endpoint, payload: { version, params } }
    return rawPost({ path: `/team-remote/${endpoint}`, cookie: cookie ?? COOKIE, contentType, body }).then((res) => ({ ...res, rpcId }))
  }

  /**
   * The real-HTTP transport the p8t4 test client pushes over. The engine
   * correlates with in-process NUMERIC rpcIds (p8t4-test-client.ts rpcCounter);
   * the wire seam requires STRING rpcIds (upstream rpc-schema.ts). This
   * transport, standing in for the browser Connection, mints the wire id per
   * request (`g8r2-<engineId>`) and maps the echoed wire id back to the
   * engine's numeric id before returning.
   */
  function makeTransport(cookie) {
    const t = { lost: false, lossCount: 0 }
    t.send = async (request) => {
      if (t.lost) {
        t.lossCount += 1
        throw new PushTransportLossError(`g8r2 simulated channel loss #${t.lossCount}`)
      }
      const wireRpcId = `g8r2-${request.rpcId}`
      const res = await rawPost({
        path: `/team-remote/${request.method}`,
        cookie,
        body: { type: 'client-request', rpcId: wireRpcId, method: request.method, payload: request.payload },
      })
      if (res.status !== 200) {
        throw new PushTransportLossError(`g8r2 channel loss: HTTP ${res.status}${res.error ? ` (${res.error})` : ''}`)
      }
      const body = res.parsed
      if (body === null || body.type !== 'server-response' || body.rpcId !== wireRpcId || body.result === undefined) {
        throw new PushTransportLossError('g8r2 channel loss: malformed or uncorrelated server frame')
      }
      return { rpcId: request.rpcId, result: body.result }
    }
    return t
  }

  function deepEqual(a, b) {
    if (typeof deepStrictEqual !== 'function') {
      throw new Error('harness: deepStrictEqual is not a function (import regression — fail loudly, do not swallow)')
    }
    try {
      deepStrictEqual(a, b)
      return true
    } catch {
      return false
    }
  }

  // First-divergence reporter for deepEqual failures: JSON-string both sides,
  // locate the first differing character, print ±45 chars of context around it.
  function diffDetail(a, b) {
    const ja = JSON.stringify(a)
    const jb = JSON.stringify(b)
    if (ja === jb) return 'json-strings-equal (deepStrictEqual still failed — shape/prototype difference)'
    let i = 0
    const m = Math.min(ja.length, jb.length)
    while (i < m && ja.charCodeAt(i) === jb.charCodeAt(i)) i++
    const s = Math.max(0, i - 45)
    const e = Math.min(m, i + 45)
    return `lenA=${ja.length} lenB=${jb.length} firstDiff@${i}\n  A: ...${ja.slice(s, e)}...\n  B: ...${jb.slice(s, e)}...`
  }

  // ── scenario runner ──────────────────────────────────────────────────────
  const scenarios = []
  async function runScenario(name, fn) {
    const checks = []
    const check = (label, cond, extra) => {
      const ok = !!cond
      checks.push(ok ? `PASS ${label}` : `FAIL ${label}${extra ? ` (${extra})` : ''}`)
      log(`  [${name}] ${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`)
      return ok
    }
    let error = null
    try {
      await fn(check)
    } catch (e) {
      error = e
      log(`  [${name}] ERROR — ${e.stack ?? e.message}`)
    }
    const pass = error === null && checks.length > 0 && checks.every((c) => c.startsWith('PASS'))
    scenarios.push({ name, pass, detail: checks.join(' | ') })
    return { check, error }
  }

  // ── E0 precondition: cookie mint (B2 launch flow) ────────────────────────
  const minted = await mintCookie()
  if (!(minted.status === 302 || minted.status === 303) || typeof minted.cookie !== 'string' || !COOKIE_SHAPE.test(minted.cookie)) {
    throw new Error(`cookie mint failed: status=${minted.status} cookie=${minted.cookie === undefined ? 'undefined' : minted.cookie.slice(0, 32) + '…'}`)
  }
  let COOKIE = minted.cookie
  log(`cookie: minted via launch URL (HTTP ${minted.status}; shape verified against B2)`)

  // ── E1 — projection round-trip ───────────────────────────────────────────
  let e3Provenance = null
  let e4Provenance = null
  await runScenario('E1', async (check) => {
    const createRes = await rpc('team.create', { rootSessionId: ID, blueprintId: 'BP-G8R2', blueprintRevision: 17 })
    sample('E1 team.create (raw)', createRes)
    const result = createRes.parsed?.result
    check('E1.1 team.create → 200 typed server-response envelope', createRes.status === 200 && createRes.parsed?.type === 'server-response' && createRes.parsed?.rpcId === createRes.rpcId, `status=${createRes.status}`)
    check('E1.2 result.ok true (fresh root seeded in real TeamDomain)', result?.ok === true, JSON.stringify(result?.error ?? null))
    const data = result?.value?.data
    check('E1.3 path === fresh-root', data?.path === 'fresh-root', JSON.stringify(data?.path))
    check('E1.4 bind.teamSessionId === rootSessionId (invariant 9)', data?.bind?.teamSessionId === ID, JSON.stringify(data?.bind ?? null))
    const prov = result?.value?.provenance
    check('E1.5 create success carries provenance (origin/method/contractVersion; no token for this method)', prov?.origin === 'team-remote' && prov?.method === 'team.create' && prov?.endpoint === 'team.create' && prov?.contractVersion === 1 && prov?.requestToken === null, JSON.stringify(prov ?? null))

    const transport = makeTransport(COOKIE)
    const client = createP8T4TestClient({
      teamSessionId: ID,
      transport,
      backoff: BACKOFF,
      sinks: { onStateChange: (s) => log(`  [E1] sink onStateChange: ${s}`) },
    })
    const a1 = await client.start()
    check('E1.6 first pull verdict apply (gen 1)', a1.status === 'apply' && a1.receivedGeneration === 1, JSON.stringify(a1))
    check('E1.7 applied generation is 1', client.lastAppliedGeneration() === 1)
    const frame = client.appliedFrame()
    check('E1.8 applied frame is this team (teamSessionId round-trips)', frame?.projection?.teamSessionId === ID)
    const fprov = frame?.provenance
    check('E1.9 frame provenance (getProjection, projectionGeneration 1, requestToken null)', fprov?.origin === 'team-remote' && fprov?.method === 'team.getProjection' && fprov?.contractVersion === 1 && fprov?.projectionGeneration === 1 && fprov?.requestToken === null, JSON.stringify(fprov ?? null))

    const rawGet = await rpc('team.getProjection', { teamSessionId: ID })
    sample('E1 team.getProjection (raw, gen 1)', rawGet)
    const gprov = rawGet.parsed?.result?.value?.provenance
    const projection = rawGet.parsed?.result?.value?.data?.projection
    check('E1.10 raw getProjection 200 ok, projectionGeneration 1', rawGet.status === 200 && rawGet.parsed?.result?.ok === true && gprov?.projectionGeneration === 1, JSON.stringify(gprov ?? null))
    let roundTripped = null
    let roundTripFailure = null
    if (projection === undefined) {
      roundTripFailure = 'projection absent (see E1.10)'
    } else {
      try {
        roundTripped = parseTeamProjection(JSON.parse(JSON.stringify(projection)))
      } catch (err) {
        roundTripFailure = err instanceof Error ? err.message : String(err)
      }
    }
    check('E1.11 lossless JSON round-trip → typed P8-T1 TeamProjectionDto', roundTripped !== null && roundTripped.teamSessionId === ID && roundTripped.generation === 1 && roundTripped.schemaVersion === 1, roundTripFailure ?? JSON.stringify(projection === undefined ? null : Object.keys(projection)))
    check('E1.12 all nine frozen top-level fields present', roundTripped !== null && REMOTE_PROJECTION_FIELDS.every((f) => f in roundTripped), roundTripped === null ? (roundTripFailure ?? 'no round-trip') : REMOTE_PROJECTION_FIELDS.join(','))
  })

  // ── E2 — round-trip after reconnect ──────────────────────────────────────
  let clientB = null
  await runScenario('E2', async (check) => {
    // (a) channel loss + frozen backoff on a fresh client of the same team.
    const transportA = makeTransport(COOKIE)
    const clientA = createP8T4TestClient({ teamSessionId: ID, transport: transportA, backoff: BACKOFF })
    await clientA.start()
    transportA.lost = true
    const a2a = await clientA.sync()
    const stateAfterLoss = clientA.state()
    const backoffEntry = clientA.backoffLog()[0]
    transportA.lost = false
    await clientA.advance(20)
    const statsAfterRetry = { ...clientA.stats() }
    const stateAfterRetry = clientA.state()
    check('E2.1 loss → verdict transport-loss', a2a.status === 'transport-loss', a2a.status)
    check('E2.2 state moved to reconnecting', stateAfterLoss === 'reconnecting', stateAfterLoss)
    check('E2.3 frozen backoff entry (attempt 1, cap 20ms, delay within [cap/2, cap])', backoffEntry?.attempt === 1 && backoffEntry?.capMs === 20 && backoffEntry?.delayMs >= 10 && backoffEntry?.delayMs <= 20, JSON.stringify(backoffEntry ?? null))
    check('E2.4 deterministic advance → reconnect, gen 1 duplicate (idempotent)', stateAfterRetry === 'connected' && statsAfterRetry.framesDuplicate === 1 && statsAfterRetry.transportLosses === 1 && statsAfterRetry.unexpectedRejections === 0, JSON.stringify({ stats: statsAfterRetry, state: stateAfterRetry }))
    clientA.stop()

    // (b) the connection is destroyed; a NEW client with a RE-MINTED cookie.
    const mint2 = await mintCookie()
    check('E2.5 re-minted cookie (fresh session, B2 shape)', (mint2.status === 302 || mint2.status === 303) && typeof mint2.cookie === 'string' && COOKIE_SHAPE.test(mint2.cookie))
    COOKIE = mint2.cookie
    const transportB = makeTransport(COOKIE)
    clientB = createP8T4TestClient({ teamSessionId: ID, transport: transportB, backoff: BACKOFF })
    const a2b = await clientB.start()
    check('E2.6 reconnect re-pull applies the durable generation', a2b.status === 'apply' && a2b.receivedGeneration === 1, JSON.stringify(a2b))
    const rawTruth = await rpc('team.getProjection', { teamSessionId: ID }, { cookie: COOKIE })
    sample('E2 team.getProjection (durable truth, second cookie)', rawTruth)
    const truth = rawTruth.parsed?.result?.value?.data?.projection
    check('E2.7 applied content deep-equal to durable truth (over a second raw RPC)', deepEqual(clientB.appliedFrame()?.projection, truth), `appliedType=${typeof clientB.appliedFrame()?.projection} truthType=${typeof truth} ${diffDetail(clientB.appliedFrame()?.projection, truth)}`)
    check('E2.8 generation equal-or-advanced across reconnect', clientB.lastAppliedGeneration() >= clientA.lastAppliedGeneration())
  })

  // ── E3 — stale response ignored ──────────────────────────────────────────
  await runScenario('E3', async (check) => {
    const client = clientB
    // The in-flight stale response: a gen-1 wire reply captured BEFORE the
    // newer fact lands (deterministic equivalent of a delayed in-flight
    // response — the payload it carries is exactly what late arrival would
    // deliver; the delivery below is a real over-the-wire RPC).
    const oldInFlight = await rpc('team.getProjection', { teamSessionId: ID })
    check('E3.1 captured in-flight response carries generation 1', oldInFlight.parsed?.result?.value?.provenance?.projectionGeneration === 1, JSON.stringify(oldInFlight.parsed?.result?.value?.provenance ?? null))
    // The newer fact lands server-side (durable generation 1 → 2).
    const e3 = await rpc('member.create', {
      teamSessionId: ID,
      caller: { kind: 'human', humanId: 'human-g8r2' },
      requestToken: 'tok-g8r2-e3',
      payload: { instanceId: 'inst-g8r2charlie', label: 'Charlie' },
    })
    sample('E3 member.create (raw, advances durable gen to 2)', e3)
    e3Provenance = e3.parsed?.result?.value?.provenance ?? null
    check('E3.2 member.create → 200 ok (new member durably committed)', e3.status === 200 && e3.parsed?.result?.ok === true, JSON.stringify(e3.parsed?.result?.error ?? null))
    check('E3.3 effectSequence 4 (fourth durable ledger fact) + requestToken echo', e3Provenance?.effectSequence === 4 && e3Provenance?.requestToken === 'tok-g8r2-e3', JSON.stringify(e3Provenance ?? null))
    const a3a = await client.sync()
    check('E3.4 client applies the newer generation (2)', a3a.status === 'apply' && a3a.receivedGeneration === 2, JSON.stringify(a3a))
    // Snapshot the applied state NOW (gen 2), before the stale response
    // arrives: "pre-stale" = the moment just before the delayed gen-1 reply.
    const preStaleFrame = JSON.parse(JSON.stringify(client.appliedFrame()))
    // Now the stale response arrives: the harness row serves its cached
    // gen-1 snapshot through a genuine HTTP response.
    writeFileSync(CTRL, JSON.stringify({ pin: 1 }))
    let a3b = { status: 'uninitialized' }
    let stats = null
    let postFrame = null
    try {
      a3b = await client.sync()
      stats = { ...client.stats() }
      postFrame = JSON.parse(JSON.stringify(client.appliedFrame()))
    } finally {
      unlinkSync(CTRL, { force: true })
    }
    check('E3.5 stale frame REJECTED (verdict stale, receivedGeneration 1)', a3b.status === 'stale' && a3b.receivedGeneration === 1, JSON.stringify(a3b))
    check('E3.6 stats.framesStale === 1', stats?.framesStale === 1, JSON.stringify(stats))
    check('E3.7 applied state untouched (still gen 2, deep-equal pre-stale frame)', client.lastAppliedGeneration() === 2 && deepEqual(postFrame, preStaleFrame), `gen=${client.lastAppliedGeneration()} preType=${typeof preStaleFrame} postType=${typeof postFrame} ${diffDetail(postFrame, preStaleFrame)}`)
  })

  // ── E4 — ledger pagination stable under growth ───────────────────────────
  await runScenario('E4', async (check) => {
    const client = clientB
    const p1 = await client.fetchPage(0, 3)
    sample('E4 first page (anchor 0, limit 3) — via test client', { status: 200, parsed: { result: { ok: p1.ok, data: p1.page } } })
    check('E4.1 first page accepted: seq 1-3, cursor 3 (non-terminal), total 4', p1.ok === true && deepEqual(p1.page?.entries?.map((e) => e.sequence), [1, 2, 3]) && p1.page?.nextAfterSequence === 3 && p1.page?.total === 4, JSON.stringify({ ok: p1.ok, reason: p1.reason, total: p1.page?.total, cursor: p1.page?.nextAfterSequence }))
    check('E4.2 tracker anchor advanced to 3', client.pageAnchor() === 3, String(client.pageAnchor()))
    const send = await rpc('member.send', {
      teamSessionId: ID,
      recipientInstanceId: 'inst-leader',
      body: 'g8r2 e4 ledger growth message',
      caller: { kind: 'human', humanId: 'human-g8r2' },
      requestToken: 'tok-g8r2-e4',
    })
    sample('E4 member.send (raw, appends seq 5)', send)
    e4Provenance = send.parsed?.result?.value?.provenance ?? null
    check('E4.3 member.send → 200 ok, effectSequence 5, token echo', send.status === 200 && send.parsed?.result?.ok === true && e4Provenance?.effectSequence === 5 && e4Provenance?.requestToken === 'tok-g8r2-e4', JSON.stringify(send.parsed?.result?.error ?? null))
    const p2 = await client.fetchPage() // from the current anchor (3), default limit 50
    check('E4.4 next page from the anchor: seq 4-5, terminal, total 5', p2.ok === true && deepEqual(p2.page?.entries?.map((e) => e.sequence), [4, 5]) && p2.page?.nextAfterSequence === null && p2.page?.total === 5, JSON.stringify({ ok: p2.ok, reason: p2.reason, total: p2.page?.total }))
    // Stability under growth (P8-T2 read-path contract: "re-reading an
    // anchor yields the same page, and the total only moves up").
    const rawPage = await rpc('team.getLedgerPage', { teamSessionId: ID, afterSequence: 0, limit: 3 })
    sample('E4 raw re-read of anchor 0 (stability proof)', rawPage)
    check('E4.5 raw re-read of anchor 0 → byte-identical first page', rawPage.status === 200 && rawPage.parsed?.result?.ok === true && deepEqual(rawPage.parsed?.result?.value?.data?.entries, p1.page?.entries), `status=${rawPage.status} rawEntriesType=${typeof rawPage.parsed?.result?.value?.data?.entries} p1EntriesType=${typeof p1.page?.entries} ${diffDetail(rawPage.parsed?.result?.value?.data?.entries, p1.page?.entries)}`)
    check('E4.6 total only moved up (4 → 5)', rawPage.parsed?.result?.value?.data?.total === 5, String(rawPage.parsed?.result?.value?.data?.total))
    // Correlation guard: a page answering an OLDER anchor cannot move the cursor.
    const stale = await client.fetchPage(0, 3)
    check('E4.7 tracker rejects the stale-anchor re-fetch (anchor-mismatch); cursor stays 3', stale.ok === false && stale.reason === 'anchor-mismatch' && client.pageAnchor() === 3 && client.stats().pagesRejected === 1, JSON.stringify({ ok: stale.ok, reason: stale.reason, anchor: client.pageAnchor() }))
    check('E4.8 pagesApplied === 2 (both accepted pages honored)', client.stats().pagesApplied === 2, String(client.stats().pagesApplied))
  })

  // ── E5 — typed errors + provenance ───────────────────────────────────────
  await runScenario('E5', async (check) => {
    const e5a = await rpc('team.getProjection', { teamSessionId: 'bad id!' })
    sample('E5 invalid teamSessionId (typed error)', e5a)
    const errA = e5a.parsed?.result?.error
    check('E5.1 invalid id → HTTP 200, result.ok false (no 500, no raw exception)', e5a.status === 200 && e5a.parsed?.result?.ok === false, `status=${e5a.status}`)
    check('E5.2 code is a closed mirrored P3 id code', ['INVALID_SESSION_ID', 'INVALID_ROOT_SESSION_ID'].includes(errA?.code), `code=${errA?.code}`)
    check('E5.3 typed error carries message + method/endpoint details', typeof errA?.message === 'string' && errA.message.length > 0 && errA?.details?.method === 'team.getProjection' && errA?.details?.endpoint === 'team.getProjection', JSON.stringify(errA ?? null))
    const e5b = await rpc('team.getProjection', { teamSessionId: ID }, { version: 2 })
    sample('E5 unsupported contract version 2', e5b)
    check('E5.4 version 2 → contract-version-unsupported (closed registry)', e5b.status === 200 && e5b.parsed?.result?.ok === false && e5b.parsed?.result?.error?.code === 'contract-version-unsupported', JSON.stringify(e5b.parsed?.result?.error ?? null))
    const e5c = await rpc('member.create', {
      teamSessionId: ID,
      caller: { kind: 'human', humanId: 'human-g8r2' },
      requestToken: 'tok-g8r2-e5',
      payload: { instanceId: 'inst-g8r2charlie' },
    })
    sample('E5 admission-blocked duplicate member.create', e5c)
    const errC = e5c.parsed?.result?.error
    check('E5.5 duplicate member.create → 200 ok:false member-already-exists (typed domain error pass-through)', e5c.status === 200 && e5c.parsed?.result?.ok === false && errC?.code === 'member-already-exists', JSON.stringify(errC ?? null))
    check('E5.6 error details carry reason domain-error + cause {code,message}', errC?.details?.reason === 'domain-error' && errC?.details?.cause?.code === 'member-already-exists' && typeof errC?.details?.cause?.message === 'string', JSON.stringify(errC?.details ?? null))
    check('E5.7 every prior SUCCESS carried full provenance (create/getProjection/member.create/member.send)', (e3Provenance?.origin === 'team-remote') && (e4Provenance?.origin === 'team-remote') && (e3Provenance?.contractVersion === 1) && (e4Provenance?.contractVersion === 1), JSON.stringify({ e3: e3Provenance, e4: e4Provenance }))
    check('E5.8 no HTTP 500 anywhere in the whole run', !allResponses.some((r) => r.status === 500), JSON.stringify([...new Set(allResponses.map((r) => r.status))]))
    check('E5.9 every 200 body is a typed server-response envelope (no raw exceptions on the wire)', allResponses.filter((r) => r.status === 200).every((r) => r.parsed !== null && r.parsed.type === 'server-response' && r.parsed.result !== undefined))
  })

  // ── E6 — wire negatives ──────────────────────────────────────────────────
  await runScenario('E6', async (check) => {
    const e6a = await rawPost({
      path: '/team-remote/team.getProjection',
      cookie: undefined,
      body: { type: 'client-request', rpcId: `g8r2-neg-${++rpcCounter}`, method: 'team.getProjection', payload: { version: 1, params: { teamSessionId: ID } } },
    })
    sample('E6 no cookie (401)', e6a)
    check('E6.1 no cookie → 401', e6a.status === 401, `status=${e6a.status}`)
    check('E6.2 401 body indicates unauthorized', /unauthorized/i.test(e6a.raw), e6a.raw.slice(0, 80))
    const e6b = await rawPost({
      path: '/team-remote/team.getProjection',
      cookie: COOKIE,
      contentType: 'text/plain',
      body: JSON.stringify({ type: 'client-request', rpcId: `g8r2-neg-${++rpcCounter}`, method: 'team.getProjection', payload: { version: 1, params: { teamSessionId: ID } } }),
    })
    sample('E6 wrong content-type (415)', e6b)
    check('E6.3 wrong content-type → 415', e6b.status === 415, `status=${e6b.status}`)
    const e6c = await rpc('team.getProjection', { teamSessionId: ID }, { wireMethod: 'team.create' })
    sample('E6 method != endpoint (bad-request)', e6c)
    check('E6.4 method≠endpoint → 200, result.ok false, code bad-request (endpoint check precedes the envelope)', e6c.status === 200 && e6c.parsed?.result?.ok === false && e6c.parsed?.result?.error?.code === 'bad-request', JSON.stringify(e6c.parsed?.result ?? null))
  })

  writeFileSync(join(outputDir, 'wire-samples.json'), JSON.stringify(wireSamples, null, 2))
  const allPass = scenarios.every((s) => s.pass)
  log(`client: allPass=${allPass} wireSamples=${wireSamples.length} trackedResponses=${allResponses.length}`)
  return { scenarios, allPass, wireSampleCount: wireSamples.length }
}
