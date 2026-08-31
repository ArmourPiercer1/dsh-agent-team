/**
 * e2e-client.mjs — G8-REVIEW reviewer-5 (R61) §5: browser-less remote e2e
 * scenario driver. Binds the frozen P8-T4 deterministic client (the real
 * push engine from packages/remote, no fake server) to real HTTP against
 * the booted pristine-host instance whose g8r5 world is mounted by the
 * companion host plugin (plugin.mjs / world-worker.mjs / world-build.mjs).
 *
 * Loaded by run.mjs AFTER boot + world health. The remote package sources
 * are imported through the ts-loader registered by run.mjs (Node 24 native
 * type-stripping; no NODE_OPTIONS, no transform).
 *
 * Scenarios (brief §5, in order):
 *   E1   provisioning (team.create) + whole-projection round-trip
 *   E2   transport loss → reconnect (backoff) + fresh-client frame parity
 *   E3   stale response is rejected (never overwrites newer state)
 *   E4   ledger pagination stability (frozen head page, cursor advance)
 *   E5   typed errors (malformed / unknown-team / version / authority)
 *        + full provenance on every ok:true + zero 5xx
 *   E6   transport-level negatives (401 / 415 / method mismatch /
 *        unknown endpoint / malformed request envelope payload)
 *   EXTRA-1  read-surface extras (catalog.list, intent.probe,
 *        legacy.inspect, compatibility.reprobe — a REAL probe over the wire)
 *   EXTRA-2  idempotent same-token replay (no new durable writes)
 *
 * Untracked evidence by design (harness-output/*.json dumps).
 * Plain ESM; node: builtins + the in-repo remote package only.
 */

import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deepStrictEqual } from 'node:assert'
import { writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const HERE = import.meta.dirname
const PKG = resolve(HERE, '..', '..', '..', '..', '..', '..', 'packages')
const P = (rel) => pathToFileURL(join(PKG, rel)).href

// The real in-repo engine + frozen contract surface (loader rewrites .js → .ts).
const { createP8T4TestClient } = await import(P('remote/test/p8t4-test-client.js'))
const { PushTransportLossError } = await import(P('remote/src/push/index.js'))
const { REMOTE_PROJECTION_FIELDS } = await import(P('remote/src/contracts/types.js'))
const { REMOTE_CONTRACT_VERSION } = await import(P('remote/src/index.js'))

const TEAM = 'session-root-g8r5'
const BLUEPRINT = 'P6T2-BP'
const HUMAN = { kind: 'human', humanId: 'human-g8r5-owner' }
const BACKOFF = { baseMs: 100, factor: 2, maxMs: 1000 }
const PROVENANCE_KEYS = [
  'contractVersion',
  'effectSequence',
  'endpoint',
  'method',
  'origin',
  'projectionGeneration',
  'requestToken',
]

export async function runE2E({ base, launchToken, launchCookie, cookieName, dshHome, outDir, log }) {
  const s1 = { cookie: launchCookie, name: cookieName }
  const results = []
  const stats = {
    requests: 0,
    http5xx: 0,
    expected4xx: 0,
    okTrueWithoutFullProvenance: [],
  }
  const ctx = {
    worker1: null,
    worker2: null,
    sendSequence: null,
    totalT1: null,
    badIdCode: null,
    session2: null,
  }
  let rpcCounter = 0
  let transportCounter = 0

  function record(id, name, pass, detail) {
    results.push({ id, name, pass, detail })
    log(`[${id}] ${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}`)
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(`assertion failed: ${msg}`)
  }

  function assertEq(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(
        `assertion failed: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      )
    }
  }

  function dump(name, value) {
    try {
      writeFileSync(join(outDir, `${name}.json`), JSON.stringify(value, null, 2))
    } catch {
      log(`dump ${name} failed (non-fatal)`)
    }
  }

  /** Global criterion-5 tracker: every ok:true carries the full 7-key provenance. */
  function checkProvenance(prov, endpoint) {
    if (prov === null || typeof prov !== 'object') {
      stats.okTrueWithoutFullProvenance.push({ endpoint, problem: 'provenance missing' })
      return
    }
    const missing = PROVENANCE_KEYS.filter((k) => !(k in prov))
    const extra = Object.keys(prov).filter((k) => !PROVENANCE_KEYS.includes(k))
    const bad = []
    if (prov.origin !== 'team-remote') bad.push(`origin=${JSON.stringify(prov.origin)}`)
    if (typeof prov.method !== 'string' || prov.method.length === 0) bad.push('method not a non-empty string')
    if (typeof prov.endpoint !== 'string' || prov.endpoint !== endpoint) {
      bad.push(`endpoint=${JSON.stringify(prov.endpoint)} != called ${endpoint}`)
    }
    if (prov.contractVersion !== REMOTE_CONTRACT_VERSION) bad.push(`contractVersion=${JSON.stringify(prov.contractVersion)}`)
    if (prov.requestToken !== null && typeof prov.requestToken !== 'string') bad.push('requestToken not string|null')
    if (prov.projectionGeneration !== null && !Number.isSafeInteger(prov.projectionGeneration)) {
      bad.push('projectionGeneration not number|null')
    }
    if (prov.effectSequence !== null && !Number.isSafeInteger(prov.effectSequence)) bad.push('effectSequence not number|null')
    if (missing.length > 0 || extra.length > 0 || bad.length > 0) {
      stats.okTrueWithoutFullProvenance.push({ endpoint, missing, extra, bad })
    }
  }

  /** One direct wire call (the raw seam surface, no engine). */
  async function rpc(endpoint, opts = {}) {
    const { method = endpoint, payload, cookie = null, contentType = 'application/json', rawBody = null } = opts
    const body =
      rawBody !== null
        ? rawBody
        : JSON.stringify({ type: 'client-request', rpcId: `g8r5-r${++rpcCounter}`, method, payload })
    const headers = {}
    if (contentType !== null) headers['content-type'] = contentType
    if (cookie !== null) headers.cookie = cookie
    let res
    try {
      res = await fetch(`${base}/team-remote/${endpoint}`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(130_000),
      })
    } catch (error) {
      return { status: null, body: null, text: `fetch error: ${error instanceof Error ? error.message : String(error)}` }
    }
    const text = await res.text()
    let parsed = null
    try {
      parsed = text === '' ? null : JSON.parse(text)
    } catch {
      parsed = null
    }
    stats.requests += 1
    if (res.status >= 500) stats.http5xx += 1
    else if (res.status >= 400) stats.expected4xx += 1
    if (parsed !== null && typeof parsed === 'object' && parsed.result !== undefined && parsed.result.ok === true) {
      checkProvenance(parsed.result.value !== undefined ? parsed.result.value.provenance : undefined, endpoint)
    }
    return { status: res.status, body: parsed, text }
  }

  /** Mint a fresh session cookie from the launch token (wire contract: 302/303 + Set-Cookie). */
  async function mintSession(token) {
    const res = await fetch(`${base}/?token=${encodeURIComponent(token)}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
    const auth = res.headers.getSetCookie().find((c) => c.startsWith('dsh-auth-'))
    if (res.status !== 302 && res.status !== 303) throw new Error(`session mint status ${res.status}`)
    if (auth === undefined) throw new Error('session mint without a dsh-auth- Set-Cookie')
    if (!/HttpOnly/i.test(auth) || !/SameSite=Strict/i.test(auth)) {
      throw new Error(`session mint cookie flags not HttpOnly+SameSite=Strict: ${auth.slice(0, 120)}`)
    }
    const cookie = auth.split(';')[0].trim()
    return { cookie, name: cookie.split('=')[0] }
  }

  /** One direct whole-projection pull (returns the RemoteResponse). */
  async function rawPull(cookie) {
    const r = await rpc('team.getProjection', {
      cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: TEAM } },
    })
    if (r.status !== 200 || r.body === null || r.body.result === undefined || r.body.result.ok !== true) {
      throw new Error(`rawPull failed: status=${r.status} body=${JSON.stringify(r.body).slice(0, 300)}`)
    }
    return r.body.result
  }

  /**
   * A real HTTP transport bound to the engine (RemotePushTransport). The
   * wire rpcId is transport-internal (the host echoes it); the seam-level
   * correlation id the engine owns is passed through unchanged. Network
   * failures / non-200 / malformed envelopes reject with the ONLY
   * loss sentinel the engine special-cases (PushTransportLossError).
   * `queue` holds canned RemoteResponse results for deterministic
   * stale-replay injection (shifted per send, rpcId rewritten to the
   * engine's id).
   */
  function makeRealTransport(label, cookieRef) {
    const t = {
      label,
      queue: [],
      setCookie(next) {
        cookieRef.cookie = next
      },
      send(request) {
        const canned = t.queue.length > 0 ? t.queue.shift() : null
        if (canned !== null) return Promise.resolve({ rpcId: request.rpcId, result: canned.result })
        const body = JSON.stringify({
          type: 'client-request',
          rpcId: `g8r5-t${++transportCounter}`,
          method: request.method,
          payload: request.payload,
        })
        return (async () => {
          let res
          try {
            res = await fetch(`${base}/team-remote/${request.method}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', cookie: cookieRef.cookie },
              body,
              signal: AbortSignal.timeout(130_000),
            })
          } catch (error) {
            throw new PushTransportLossError(
              `transport ${label}: network failure ${error instanceof Error ? error.message : String(error)}`,
            )
          }
          const text = await res.text()
          if (res.status !== 200) throw new PushTransportLossError(`transport ${label}: HTTP ${res.status}`)
          let parsed
          try {
            parsed = JSON.parse(text)
          } catch {
            throw new PushTransportLossError(`transport ${label}: non-JSON body`)
          }
          if (parsed === null || typeof parsed !== 'object' || parsed.result === undefined) {
            throw new PushTransportLossError(`transport ${label}: malformed envelope`)
          }
          if (parsed.result.ok === true) checkProvenance(parsed.result.value?.provenance, request.method)
          return { rpcId: request.rpcId, result: parsed.result }
        })()
      },
    }
    return t
  }

  function makeClient(transport) {
    return createP8T4TestClient({ teamSessionId: TEAM, transport, backoff: BACKOFF })
  }

  async function scenario(id, name, fn) {
    try {
      const detail = await fn()
      record(id, name, true, detail)
    } catch (error) {
      record(id, name, false, error instanceof Error ? error.message : String(error))
    }
  }

  // ── E1: provisioning + whole-projection round-trip ────────────────────────
  async function scenarioE1() {
    const created = await rpc('team.create', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { rootSessionId: TEAM, blueprintId: BLUEPRINT } },
    })
    assertEq(created.status, 200, 'team.create HTTP status')
    const cr = created.body?.result
    assertEq(cr?.ok, true, 'team.create ok')
    const data = cr.value.data
    assertEq(data.path, 'fresh-root', 'team.create path is fresh-root')
    assert(data.durable !== null && typeof data.durable === 'object', 'team.create durable is a non-null object')
    assertEq(data.bind?.bound, true, 'team.create bind.bound')
    assertEq(data.bind?.installed, true, 'team.create bind.installed')
    deepStrictEqual(
      cr.value.provenance,
      {
        origin: 'team-remote',
        method: 'team.create',
        endpoint: 'team.create',
        contractVersion: REMOTE_CONTRACT_VERSION,
        requestToken: null,
        projectionGeneration: null,
        effectSequence: null,
      },
      'team.create provenance must be EXACTLY the null-cell form',
    )
    const projRes = await rawPull(s1.cookie)
    const proj = projRes.value.data.projection
    deepStrictEqual(
      Object.keys(proj).sort(),
      [...REMOTE_PROJECTION_FIELDS].sort(),
      'projection top-level field set must be exactly REMOTE_PROJECTION_FIELDS',
    )
    assertEq(proj.schemaVersion, 1, 'projection schemaVersion')
    assertEq(proj.generation, 1, 'fresh projection generation')
    assertEq(proj.teamSessionId, TEAM, 'projection teamSessionId')
    // Frozen projection invariant 14: the members array ALWAYS carries
    // exactly one LeaderInstance (contracts/src/projection/projection.ts
    // L221-225) — a fresh team therefore projects exactly the leader row
    // (no childSessionId on the leader row, invariant 14).
    assertEq(proj.members.length, 1, 'fresh projection carries exactly the LeaderInstance row (invariant 14)')
    assertEq(proj.members[0].instanceId, 'inst-leader', 'fresh projection leader instanceId')
    assertEq(proj.members[0].childSessionId, undefined, 'leader row carries no childSessionId (invariant 14)')
    assertEq(proj.templates.length, 3, 'fresh projection carries the 3 P6T2 templates')
    assertEq(projRes.value.provenance.projectionGeneration, 1, 'getProjection provenance.projectionGeneration')
    dump('e1', { created: created.body, projection: proj })
    return (
      `team.create path=fresh-root durable+bind; provenance exact; projection gen=1 schema=1 ` +
      `fields=9 members=1(leader) templates=3; provenance.projectionGeneration=1`
    )
  }

  // ── E2: transport loss → reconnect + fresh-client frame parity ────────────
  async function scenarioE2() {
    const s2 = await mintSession(launchToken)
    ctx.session2 = s2
    const ref2a = { cookie: s1.cookie }
    const c2a = makeClient(makeRealTransport('t2a', ref2a))
    const startA = await c2a.start()
    assertEq(startA.status, 'apply', 'c2a start assessment')
    assertEq(c2a.state(), 'connected', 'c2a state after start')
    assertEq(c2a.lastAppliedGeneration(), 1, 'c2a applied generation after start')
    // Force a channel loss: a garbage cookie makes the server answer 401.
    ref2a.cookie = `${cookieName}-garbage=invalid-token`
    const lossA = await c2a.sync()
    assertEq(lossA.status, 'transport-loss', 'c2a sync verdict after cookie loss')
    assertEq(c2a.state(), 'reconnecting', 'c2a state after loss')
    assert(c2a.stats().transportLosses >= 1, 'c2a stats.transportLosses >= 1')
    // Restore a valid session (freshly minted), then drive the backoff.
    ref2a.cookie = s2.cookie
    let guard = 0
    for (;;) {
      const pending = c2a.pendingBackoffMs()
      await c2a.advance(pending !== null ? pending : 50)
      if (c2a.state() === 'connected') break
      guard += 1
      if (guard > 25) throw new Error(`c2a did not reconnect after ${guard} backoff advances`)
      await sleep(200)
    }
    assertEq(c2a.lastAppliedGeneration(), 1, 'c2a generation after reconnect (no mutation yet)')
    assert(c2a.stats().transportLosses >= 1, 'c2a transportLosses survive reconnect')
    // A brand-new client on the new session must see the same world.
    const ref2b = { cookie: s2.cookie }
    const c2b = makeClient(makeRealTransport('t2b', ref2b))
    const startB = await c2b.start()
    assertEq(startB.status, 'apply', 'c2b start assessment')
    assert(c2b.lastAppliedGeneration() >= 1, 'c2b applied generation >= 1')
    const raw = await rawPull(s2.cookie)
    deepStrictEqual(c2b.appliedFrame().projection, raw.value.data.projection, 'fresh-client frame === raw pull')
    dump('e2', { startA, lossA, stats2a: c2a.stats(), stats2b: c2b.stats(), session2: s2.name })
    return (
      `loss→reconnecting (transportLosses=${c2a.stats().transportLosses})→backoff→connected gen=1; ` +
      `fresh client on session-2 frame deep-equal to a raw pull`
    )
  }

  // ── E3: stale response is rejected (G8 core rule) ─────────────────────────
  async function scenarioE3() {
    const ref1 = { cookie: s1.cookie }
    const t1 = makeRealTransport('t1', ref1)
    const c1 = makeClient(t1)
    const startC = await c1.start()
    assertEq(startC.status, 'apply', 'c1 start assessment')
    assertEq(c1.lastAppliedGeneration(), 1, 'c1 generation before mutation')
    const stale = await rawPull(s1.cookie) // REAL server gen=1, captured pre-mutation
    assertEq(stale.value.data.projection.generation, 1, 'stale capture is gen 1')
    const created = await rpc('member.create', {
      cookie: s1.cookie,
      payload: {
        version: REMOTE_CONTRACT_VERSION,
        params: {
          teamSessionId: TEAM,
          caller: HUMAN,
          requestToken: 'tok-g8r5-e3c',
          delegationTemplateId: 'worker',
          payload: { label: 'worker-e3' },
        },
      },
    })
    assertEq(created.status, 200, 'member.create HTTP status')
    const cr = created.body?.result
    assertEq(cr?.ok, true, 'member.create ok')
    const outcome = cr.value.data.outcome
    assertEq(outcome.status, 'executed', 'create outcome status')
    assertEq(outcome.effect?.kind, 'member-activated', 'create effect kind')
    assertEq(outcome.effect?.replayed, false, 'create is not a replay')
    ctx.worker1 = outcome.effect.instanceId
    assert(typeof ctx.worker1 === 'string' && ctx.worker1.length > 0, 'worker1 instanceId present')
    const syncA = await c1.sync()
    assertEq(syncA.status, 'apply', 'c1 sync verdict after mutation')
    assertEq(c1.lastAppliedGeneration(), 2, 'c1 generation after mutation')
    assertEq(c1.stats().framesStale, 0, 'no stale frame applied yet')
    const frameGen2 = c1.appliedFrame().projection
    assertEq(frameGen2.generation, 2, 'applied frame generation')
    assertEq(frameGen2.members.length, 2, 'applied frame carries leader + worker1 rows')
    assert(frameGen2.members.some((m) => m.instanceId === ctx.worker1), 'applied frame carries the new worker1 row')
    // Replay the captured gen-1 frame through the transport: it must be
    // rejected as stale and never overwrite the applied gen-2 state.
    t1.queue.push({ result: stale })
    const syncStale = await c1.sync()
    assertEq(syncStale.status, 'stale', 'replayed gen-1 frame verdict is stale')
    assertEq(c1.stats().framesStale, 1, 'framesStale incremented exactly once')
    assertEq(c1.lastAppliedGeneration(), 2, 'generation unchanged by the stale frame')
    deepStrictEqual(c1.appliedFrame().projection, frameGen2, 'applied state unchanged by the stale frame')
    dump('e3', { created: created.body, syncA, syncStale, stats: c1.stats(), staleGeneration: 1 })
    return (
      `mutation gen 1→2 (worker1=${ctx.worker1}); replayed gen-1 frame verdict=stale ` +
      `(framesStale=1, applied state byte-identical)`
    )
  }

  // ── E4: ledger pagination stability ───────────────────────────────────────
  async function scenarioE4() {
    if (ctx.worker1 === null) throw new Error('prerequisite missing: E3 worker1')
    const created2 = await rpc('member.create', {
      cookie: s1.cookie,
      payload: {
        version: REMOTE_CONTRACT_VERSION,
        params: {
          teamSessionId: TEAM,
          caller: HUMAN,
          requestToken: 'tok-g8r5-e4c',
          delegationTemplateId: 'worker',
          payload: { label: 'worker-e4' },
        },
      },
    })
    const c2 = created2.body?.result
    assertEq(c2?.ok, true, 'worker2 create ok')
    ctx.worker2 = c2.value.data.outcome.effect.instanceId
    // Frozen cursor rule (remote/src/handlers/team.ts L193-216 + push/ledger-page.ts
    // L6-7): `nextAfterSequence` = last included sequence IFF more entries remain
    // after the slice; the LAST page carries a null cursor. page1 (limit 1 over 2
    // entries) is a FULL page with one left → non-null cursor; page2 (limit 50)
    // exhausts the ledger → null cursor. Both branches of the IFF are exercised.
    const page1 = await rpc('team.getLedgerPage', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: TEAM, limit: 1 } },
    })
    assertEq(page1.status, 200, 'page1 HTTP status')
    const p1 = page1.body?.result
    assertEq(p1?.ok, true, 'page1 ok')
    const d1 = p1.value.data
    assertEq(d1.entries.length, 1, 'page1 (limit 1) returns exactly 1 entry')
    const seqs1 = d1.entries.map((e) => e.sequence)
    for (let i = 1; i < seqs1.length; i++) {
      assert(seqs1[i] > seqs1[i - 1], `page1 sequences strictly increasing (got ${JSON.stringify(seqs1)})`)
    }
    assertEq(d1.nextAfterSequence, seqs1[seqs1.length - 1], 'page1 (full page, more remain) nextAfterSequence = last included sequence')
    ctx.totalT1 = d1.total
    // LIVE-VERIFIED (run #7): exactly 2 member.create calls (team.create never
    // calls performAction) produced exactly 2 ledger entries, seq 1..2 — each
    // activation commits one durable fact via the provider's fact-commit dep
    // (activation/provider.ts L361/L516 ledgerSequence; SEND_MESSAGE commits
    // FACT_COORDINATION once, action-router/effects.ts L180-190).
    assertEq(d1.total, 2, `page1 total = the two member.create facts (got ${d1.total})`)
    const sent = await rpc('member.send', {
      cookie: s1.cookie,
      payload: {
        version: REMOTE_CONTRACT_VERSION,
        params: {
          teamSessionId: TEAM,
          caller: { kind: 'instance', instanceId: ctx.worker1 },
          recipientInstanceId: ctx.worker2,
          body: 'g8r5 e2e: coordination fact',
          subject: 'g8r5-e4',
          requestToken: 'tok-g8r5-e4s',
        },
      },
    })
    const sr = sent.body?.result
    assertEq(sr?.ok, true, 'member.send ok')
    assertEq(sr.value.data.outcome.effect?.kind, 'fact-recorded', 'send effect kind')
    ctx.sendSequence = sr.value.data.outcome.effect.sequence
    const page2 = await rpc('team.getLedgerPage', {
      cookie: s1.cookie,
      payload: {
        version: REMOTE_CONTRACT_VERSION,
        params: { teamSessionId: TEAM, afterSequence: d1.nextAfterSequence, limit: 50 },
      },
    })
    const p2 = page2.body?.result
    assertEq(p2?.ok, true, 'page2 ok')
    const d2 = p2.value.data
    assert(d2.entries.length > 0, 'page2 is non-empty')
    assert(d2.entries.every((e) => e.sequence > d1.nextAfterSequence), 'page2 entries all strictly after the anchor')
    assertEq(d2.total, ctx.totalT1 + 1, 'total grew by exactly the one send fact')
    assert(d2.entries.some((e) => e.sequence === ctx.sendSequence), 'page2 contains the send fact sequence')
    assertEq(d2.nextAfterSequence, null, 'page2 exhausted the ledger → null cursor (IFF null branch, team.ts L202-209)')
    const page1re = await rpc('team.getLedgerPage', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: TEAM, limit: 1 } },
    })
    deepStrictEqual(page1re.body?.result?.value?.data?.entries, d1.entries, 'head page is frozen (stable pagination)')
    dump('e4', { page1: d1, page2: d2, sent: sent.body?.result, worker1: ctx.worker1, worker2: ctx.worker2 })
    return (
      `page(limit=1): seqs=[${seqs1}] total=${ctx.totalT1}; send fact seq=${ctx.sendSequence}; ` +
      `page2 first-seq>anchor total=${d2.total}=T1+1; head page deep-equal on re-read`
    )
  }

  // ── E5: typed errors + provenance completeness + zero 5xx ─────────────────
  async function scenarioE5() {
    if (ctx.worker1 === null) throw new Error('prerequisite missing: E3 worker1')
    // (a) missing required param → malformed-params with details.field
    const missingField = await rpc('team.getProjection', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: {} },
    })
    assertEq(missingField.status, 200, 'missing-field HTTP status')
    assertEq(missingField.body?.result?.error?.code, 'malformed-params', 'missing-field code')
    assertEq(missingField.body?.result?.error?.details?.field, 'teamSessionId', 'missing-field details.field')
    // (b) structurally-valid but unknown team id → typed domain pass-through
    const badId = await rpc('team.getProjection', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: 'not-a-valid-id' } },
    })
    assertEq(badId.status, 200, 'unknown-team HTTP status (typed error, not 5xx)')
    const b1 = badId.body?.result
    assertEq(b1?.ok, false, 'unknown-team typed error')
    assert(typeof b1?.error?.code === 'string' && b1.error.code.length > 0, 'unknown-team non-empty code')
    ctx.badIdCode = b1.error.code
    // (c) unsupported contract version
    const badVer = await rpc('team.getProjection', {
      cookie: s1.cookie,
      payload: { version: 99, params: { teamSessionId: TEAM } },
    })
    assertEq(badVer.body?.result?.error?.code, 'contract-version-unsupported', 'version-99 code')
    // (d) a member caller attempting create-member → authority denial
    const denied = await rpc('member.create', {
      cookie: s1.cookie,
      payload: {
        version: REMOTE_CONTRACT_VERSION,
        params: {
          teamSessionId: TEAM,
          caller: { kind: 'instance', instanceId: ctx.worker1 },
          requestToken: 'tok-g8r5-e5m',
          delegationTemplateId: 'worker',
          payload: { label: 'worker-e5' },
        },
      },
    })
    assertEq(denied.status, 200, 'denied HTTP status')
    assertEq(denied.body?.result?.error?.code, 'TEAM_RUNTIME_CALLER_AUTHORITY_DENIED', 'member-caller authority code')
    assertEq(stats.http5xx, 0, 'zero 5xx responses across every request so far')
    assertEq(stats.okTrueWithoutFullProvenance.length, 0, 'every ok:true carried the full 7-key provenance')
    dump('e5', { missingField: missingField.body, badId: badId.body, badVer: badVer.body, denied: denied.body })
    return (
      `malformed-params(field=teamSessionId); unknown-team code=${ctx.badIdCode}; ` +
      `contract-version-unsupported; TEAM_RUNTIME_CALLER_AUTHORITY_DENIED; ` +
      `0x 5xx in ${stats.requests} requests; provenance complete on all ok:true`
    )
  }

  // ── E6: transport-level negatives (connection layer + envelope) ───────────
  async function scenarioE6() {
    // (a) no cookie → 401 unauthorized
    const noAuth = await rpc('team.getProjection', {
      cookie: null,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: TEAM } },
    })
    assertEq(noAuth.status, 401, 'no-cookie status')
    assert(/unauthorized/i.test(noAuth.text ?? ''), `no-cookie body says unauthorized (got: ${(noAuth.text ?? '').slice(0, 80)})`)
    // (b) wrong content type → 415
    const wrongCt = await rpc('team.getProjection', {
      cookie: s1.cookie,
      contentType: 'text/plain',
      payload: { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: TEAM } },
    })
    assertEq(wrongCt.status, 415, 'wrong-content-type status')
    assert(/content type must be application\/json/.test(wrongCt.text ?? ''), '415 body names the required content type')
    // (c) method ≠ endpoint → 200 typed bad-request (connection layer)
    const mismatch = await rpc('team.getProjection', {
      cookie: s1.cookie,
      method: 'member.send',
      payload: { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: TEAM } },
    })
    assertEq(mismatch.status, 200, 'method-mismatch HTTP status')
    assertEq(mismatch.body?.result?.error?.code, 'bad-request', 'method-mismatch code')
    assert(/does not match endpoint/.test(mismatch.body?.result?.error?.message ?? ''), 'method-mismatch message')
    // (d) unknown endpoint (channel-routed, dispatcher invariant 1) → typed
    const unknown = await rpc('nope.nothere', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: {} },
    })
    assertEq(unknown.status, 200, 'unknown-endpoint HTTP status')
    assertEq(unknown.body?.result?.error?.code, 'unknown-method', 'unknown-endpoint code')
    // (e) valid envelope, garbage payload → malformed-request (dispatcher)
    const garbage = await rpc('team.getProjection', {
      cookie: s1.cookie,
      payload: 'garbage-payload',
    })
    assertEq(garbage.status, 200, 'garbage-payload HTTP status')
    assertEq(garbage.body?.result?.error?.code, 'malformed-request', 'garbage-payload code')
    dump('e6', {
      noAuth: { status: noAuth.status, text: (noAuth.text ?? '').slice(0, 200) },
      wrongCt: { status: wrongCt.status, text: (wrongCt.text ?? '').slice(0, 200) },
      mismatch: mismatch.body,
      unknown: unknown.body,
      garbage: garbage.body,
    })
    return '401 /unauthorized/; 415 content-type; 200 bad-request (method≠endpoint); 200 unknown-method; 200 malformed-request'
  }

  // ── EXTRA-1: read-surface extras (non-mandated coverage) ──────────────────
  async function scenarioExtra1() {
    const cat = await rpc('catalog.list', { cookie: s1.cookie, payload: { version: REMOTE_CONTRACT_VERSION, params: {} } })
    const cd = cat.body?.result
    assertEq(cd?.ok, true, 'catalog.list ok')
    assert(Array.isArray(cd.value.data.blueprints) && cd.value.data.blueprints.length >= 1, 'catalog.list has blueprints')
    assert(JSON.stringify(cd.value.data.blueprints).includes(BLUEPRINT), 'catalog.list contains P6T2-BP')
    const probe = await rpc('intent.probe', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { blueprintId: BLUEPRINT, environmentFacts: [] } },
    })
    const pd = probe.body?.result
    assertEq(pd?.ok, true, 'intent.probe ok')
    assert(pd.value.data.compatibility !== null && typeof pd.value.data.compatibility === 'object', 'intent.probe compatibility record')
    const legacy = await rpc('legacy.inspect', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { dshHome } },
    })
    const ld = legacy.body?.result
    assertEq(ld?.ok, true, 'legacy.inspect ok')
    const legacyStatus = ld.value.data.inspection?.status
    assert(['legacy-team', 'native-fallback'].includes(legacyStatus), `legacy.inspect status closed (got ${legacyStatus})`)
    const reprobe = await rpc('compatibility.reprobe', {
      cookie: s1.cookie,
      payload: { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: TEAM, trigger: 'NEW_ACTIVATION' } },
    })
    const rd = reprobe.body?.result
    assertEq(rd?.ok, true, 'compatibility.reprobe ok (a REAL probe over the wire)')
    dump('extras1', { catalog: cat.body, intentProbe: probe.body, legacy: legacy.body, reprobe: reprobe.body })
    return `catalog.list(${cd.value.data.blueprints.length} bp); intent.probe ok; legacy.inspect status=${legacyStatus}; compatibility.reprobe NEW_ACTIVATION ok`
  }

  // ── EXTRA-2: idempotent same-token replay ─────────────────────────────────
  async function scenarioExtra2() {
    if (ctx.worker1 === null) throw new Error('prerequisite missing: E3 token')
    const genBefore = (await rawPull(s1.cookie)).value.data.projection.generation
    const replay = await rpc('member.create', {
      cookie: s1.cookie,
      payload: {
        version: REMOTE_CONTRACT_VERSION,
        params: {
          teamSessionId: TEAM,
          caller: HUMAN,
          requestToken: 'tok-g8r5-e3c',
          delegationTemplateId: 'worker',
          payload: { label: 'worker-e3' },
        },
      },
    })
    const rr = replay.body?.result
    assertEq(rr?.ok, true, 'replay ok:true')
    const outcome = rr.value.data.outcome
    assertEq(outcome.status, 'executed', 'replay outcome status')
    assertEq(outcome.effect?.kind, 'member-activated', 'replay effect kind')
    assertEq(outcome.effect?.replayed, true, 'replay marked replayed')
    assertEq(outcome.effect?.instanceId, ctx.worker1, 'replay returns the SAME instance id')
    assertEq(outcome.requestToken, 'tok-g8r5-e3c', 'replay echoes the request token')
    const genAfter = (await rawPull(s1.cookie)).value.data.projection.generation
    assertEq(genAfter, genBefore, 'replay performs no new durable writes (generation unchanged)')
    dump('extras2', { replay: replay.body, genBefore, genAfter })
    return `replay of tok-g8r5-e3c: ok + effect.replayed=true + same instanceId + generation ${genBefore} unchanged`
  }

  // ── run all scenarios (order per brief §5) ────────────────────────────────
  log('e2e: starting scenario run (E1 → E6 → EXTRA-1 → EXTRA-2)')
  await scenario('E1', 'provisioning + projection round-trip', scenarioE1)
  await scenario('E2', 'transport loss → reconnect + frame parity', scenarioE2)
  await scenario('E3', 'stale response rejected (G8 core rule)', scenarioE3)
  await scenario('E4', 'ledger pagination stability', scenarioE4)
  await scenario('E5', 'typed errors + provenance + zero 5xx', scenarioE5)
  await scenario('E6', 'transport-level negatives', scenarioE6)
  await scenario('EXTRA-1', 'read-surface extras (non-mandated)', scenarioExtra1)
  await scenario('EXTRA-2', 'idempotent same-token replay (non-mandated)', scenarioExtra2)

  const pass = results.every((r) => r.pass)
  log(`e2e: ${pass ? 'ALL PASS' : 'FAILURES PRESENT'} (${results.filter((r) => r.pass).length}/${results.length})`)
  return {
    pass,
    results,
    failures: results.filter((r) => !r.pass).map((r) => `${r.id} ${r.name}: ${r.detail}`),
    stats,
  }
}
