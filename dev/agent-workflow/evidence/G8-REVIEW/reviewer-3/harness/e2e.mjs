// G8-R3 reviewer-3 e2e — the E1-E6 scenario driver.
//
// Drives the REAL p8t4 test client (packages/remote/test/p8t4-test-client.ts,
// loaded through the ts-loader hook) over a REAL-HTTP transport against the
// real DSH web instance carrying the g8r3-remote-e2e row. Raw node:http
// calls (no cookie / wrong content-type / method-mismatch) cover the seam
// negatives (E6) and the raw cross-checks.
//
// Scenario map (brief §5 E1-E6):
//   E1 initial projection + provenance over real HTTP (+ raw cross-check)
//   E2 reconnect (fresh client) + transport loss -> reconnecting + capped
//      backoff (20ms @ attempt 1) -> advance -> connected
//   E3 stale response ignored: real mutation (gen 2), sync applies it,
//      transport replays the cached gen-1 response -> verdict 'stale',
//      applied state untouched
//   E4 ledger pagination stable across a mid-walk mutation: pages
//      [seq 1,2] then [seq 3,4], strict monotonic, no dup/gap
//   E5 typed errors + provenance: unknown-method /
//      contract-version-unsupported / INVALID_ROOT_SESSION_ID /
//      malformed-params (field detail) / TEAM_RUNTIME quota rejection
//      (zero durable side effects)
//   E6 seam negatives: no cookie 401, text/plain 415, method!=endpoint
//      200 bad-request
//
// All mutations go over the real wire as `member.create` with a human
// caller; growth is the real TeamRuntime (journal CAS bumps the
// generation and appends the ledger fact).
import { pathToFileURL } from 'node:url'

export async function runE2E(env) {
  const { host, port, launchUrl, teamSessionId: SID, log, wtRoot, here } = env
  const remoteMod = await import(pathToFileURL(wtRoot + '/packages/remote/src/index.js').href)
  const clientMod = await import(pathToFileURL(wtRoot + '/packages/remote/test/p8t4-test-client.js').href)
  const transportMod = await import(pathToFileURL(here + '/http-transport.mjs').href)

  const BACKOFF = { baseMs: 20, factor: 2, maxMs: 1000 }
  const HUMAN = { kind: 'human', humanId: 'g8r3-reviewer' }

  const scenarios = []
  const ctx = { cache: {}, clients: {} }

  const scenario = async (id, title, fn) => {
    const checks = []
    let error = null
    const assert = (cond, label, extra) => {
      const ok = !!cond
      checks.push({ label, ok, extra: extra === undefined ? undefined : safeString(extra) })
      if (!ok) throw new Error('ASSERT FAILED: ' + label + (extra !== undefined ? ' :: ' + safeString(extra) : ''))
    }
    try {
      await fn(assert)
    } catch (e) {
      error = e && e.message ? e.message : String(e)
    }
    const result = { id, title, pass: error === null, checks, error }
    scenarios.push(result)
    log('[' + id + '] ' + title + ' -> ' + (error === null ? 'PASS' : 'FAIL') + ' (' + checks.length + ' checks)')
    if (error !== null) log('      ' + error)
    return result
  }

  function safeString(v) {
    try {
      if (v instanceof Error) return v.name + ': ' + v.message
      const s = JSON.stringify(v)
      return s === undefined ? String(v) : s.slice(0, 400)
    } catch {
      return String(v)
    }
  }

  const raw = (endpoint, payload, rpcId, extra) =>
    transportMod.rawRpc({ host, port, cookie: ctx.cookie, endpoint, payload, rpcId, ...extra })

  const createMember = async (templateId, token, rpcId) => {
    // The real TeamRuntime create-member contract requires payload.label
    // (non-empty string) — run-4 finding (TEAM_RUNTIME_REQUEST_MALFORMED).
    const res = await raw(
      'member.create',
      {
        version: 1,
        params: {
          teamSessionId: SID,
          caller: HUMAN,
          requestToken: token,
          delegationTemplateId: templateId,
          payload: { label: 'g8r3 ' + token },
        },
      },
      rpcId,
    )
    return res.json
  }

  // ------------------------------------------------------------------ E1
  await scenario('E1', 'initial projection + provenance over real HTTP', async (assert) => {
    const minted = await transportMod.mintCookie({ host, port, launchUrl })
    log('cookie minted: ' + minted.name + ' (HttpOnly=' + minted.httpOnly + ', SameSite=Strict=' + minted.sameSiteStrict + ')')
    assert(minted.httpOnly, 'cookie is HttpOnly', minted.raw)
    assert(minted.sameSiteStrict, 'cookie is SameSite=Strict', minted.raw)
    ctx.cookie = minted.cookie

    const t1 = new transportMod.RealHttpTransport({ host, port, cookie: ctx.cookie, lossErrorFactory: () => new remoteMod.PushTransportLossError(), log })
    const c1 = clientMod.createP8T4TestClient({ teamSessionId: SID, transport: t1, backoff: BACKOFF, pageLimit: 2 })
    ctx.clients.c1 = c1
    ctx.transports = { t1 }
    const assessment = await c1.start()
    assert(assessment && assessment.status === 'apply', 'start() assessment apply', assessment)
    assert(c1.lastAppliedGeneration() === 1, 'applied generation is 1', c1.lastAppliedGeneration())
    const frame = c1.appliedFrame()
    const proj = frame && frame.projection
    assert(proj !== null && typeof proj === 'object', 'frame carries a projection', frame && Object.keys(frame))
    for (const f of remoteMod.REMOTE_PROJECTION_FIELDS) {
      assert(f in proj, 'projection field present: ' + f, Object.keys(proj))
    }
    const prov = frame.provenance
    assert(prov !== null && typeof prov === 'object', 'frame carries provenance', Object.keys(frame))
    assert(prov.origin === remoteMod.REMOTE_ORIGIN, 'provenance.origin is team-remote', prov.origin)
    assert(prov.method === 'team.getProjection', 'provenance.method', prov.method)
    assert(prov.endpoint === 'team.getProjection', 'provenance.endpoint', prov.endpoint)
    assert(prov.contractVersion === 1, 'provenance.contractVersion 1', prov.contractVersion)
    assert(prov.projectionGeneration === 1, 'provenance.projectionGeneration 1', prov.projectionGeneration)
    assert(prov.effectSequence === null, 'provenance.effectSequence null on pull', prov.effectSequence)
    assert(prov.requestToken === null || typeof prov.requestToken === 'string', 'provenance.requestToken shape', prov.requestToken)

    // Raw cross-check with an independent connection (same auth cookie).
    const res = await raw('team.getProjection', { version: 1, params: { teamSessionId: SID } }, 9001)
    assert(res.status === 200, 'raw getProjection HTTP 200', res.status)
    const rw = res.json
    assert(rw.type === 'server-response' && rw.rpcId === '9001', 'raw wire echo (string rpcId)', rw && rw.type)
    assert(rw.result.ok === true, 'raw getProjection ok', rw.result && rw.result.error)
    assert(
      JSON.stringify(rw.result.value.data.projection) === JSON.stringify(proj),
      'raw projection deep-equals client projection',
    )
    assert(rw.result.value.provenance.projectionGeneration === 1, 'raw provenance generation 1', rw.result.value.provenance)
    ctx.cache.rawGen1 = rw.result
    ctx.cache.proj1 = proj
  })

  // ------------------------------------------------------------------ E2
  await scenario('E2', 'reconnect + transport loss -> capped backoff -> connected', async (assert) => {
    const t2 = new transportMod.RealHttpTransport({ host, port, cookie: ctx.cookie, lossErrorFactory: () => new remoteMod.PushTransportLossError(), log })
    const c2 = clientMod.createP8T4TestClient({ teamSessionId: SID, transport: t2, backoff: BACKOFF, pageLimit: 2 })
    const a2 = await c2.start()
    assert(a2 && a2.status === 'apply', 'fresh client start apply', a2)
    assert(c2.lastAppliedGeneration() === 1, 'fresh client gen 1', c2.lastAppliedGeneration())
    c2.stop()

    const t3 = new transportMod.RealHttpTransport({ host, port, cookie: ctx.cookie, lossErrorFactory: () => new remoteMod.PushTransportLossError(), log })
    const c3 = clientMod.createP8T4TestClient({ teamSessionId: SID, transport: t3, backoff: BACKOFF, pageLimit: 2 })
    t3.script({ type: 'loss' })
    let startError = null
    let a3 = null
    try {
      a3 = await c3.start()
    } catch (e) {
      startError = e
    }
    log('E2 c3 start(): ' + (startError ? 'rejected with ' + startError.name : 'assessment ' + safeString(a3)))
    assert(c3.state() === 'reconnecting', 'c3 state reconnecting after loss', c3.state())
    assert(c3.stats().transportLosses === 1, 'transportLosses 1', c3.stats())
    const entries = c3.backoffLog()
    assert(entries.length === 1, 'one backoff scheduled', entries)
    assert(entries[0].attempt === 1, 'backoff attempt 1', entries[0])
    assert(entries[0].capMs === 20, 'backoff cap 20ms (baseMs)', entries[0])
    assert(entries[0].delayMs >= 10 && entries[0].delayMs <= 20, 'delay in [cap/2, cap]', entries[0])
    const pending = c3.pendingBackoffMs()
    assert(pending === entries[0].delayMs, 'pending backoff equals scheduled delay', pending)
    await c3.advance(entries[0].delayMs)
    assert(c3.state() === 'connected', 'connected after advance', c3.state())
    assert(c3.lastAppliedGeneration() === 1, 'gen 1 after reconnect', c3.lastAppliedGeneration())
    assert(c3.stats().framesApplied === 1, 'framesApplied 1', c3.stats())
    assert(c3.stats().transportLosses === 1, 'losses still 1 (no retry loss)', c3.stats())
    c3.stop()
  })

  // ------------------------------------------------------------------ E3
  // Stale frames must be ignored (criterion 3). Two legs:
  //   (i)  the real-mutation leg: member.create appends ledger fact 1, but
  //        the product NEVER advances the whole-projection stamp
  //        (FINDING F3 — no P5/P6 write path writes team_sessions.generation)
  //        so the re-pull of the same stamp is assessed 'duplicate' and the
  //        client keeps its old frame while the server truth has 4 members;
  //   (ii) the stale-guard fixture leg (P8-T4 task card: "client stale
  //        guard fixture"): the transport injects a synthetic gen-2 frame
  //        (a rewrite of the cached real response); the client advances;
  //        then the replayed cached real gen-1 frame must be assessed
  //        'stale' and must not re-apply.
  await scenario('E3', 'stale frame ignored: duplicate on constant stamp + fixture stale guard', async (assert) => {
    const c1 = ctx.clients.c1
    assert(c1.lastAppliedGeneration() === 1, 'precondition: c1 at gen 1', c1.lastAppliedGeneration())
    const created = await createMember('worker', 'g8r3-tk-w1', 9101)
    assert(created.result.ok === true, 'member.create w1 ok', created.result && created.result.error)
    const v = created.result.value
    assert(v.provenance.method === 'member.create', 'mutation provenance method', v.provenance)
    assert(v.provenance.requestToken === 'g8r3-tk-w1', 'mutation provenance token echo', v.provenance.requestToken)
    assert(v.provenance.projectionGeneration === null, 'mutation provenance gen null', v.provenance)
    assert(v.provenance.effectSequence === 1, 'mutation provenance effectSequence 1', v.provenance)
    assert(v.data.outcome.status === 'executed', 'outcome executed', v.data.outcome)

    // (i) Same-stamp re-pull after a real mutation: the product holds the
    // stamp at 1 (F3) — the client assesses 'duplicate' and keeps the old
    // frame; the server-side truth is 4 members at stamp 1.
    const a = await c1.sync()
    assert(a && a.status === 'duplicate', 'same-stamp re-pull assessed duplicate (F3: stamp constant under mutation)', a)
    assert(c1.lastAppliedGeneration() === 1, 'c1 still at gen 1 after duplicate', c1.lastAppliedGeneration())
    assert(c1.stats().framesDuplicate === 1, 'framesDuplicate 1', c1.stats())
    const wireAfterW1 = await raw('team.getProjection', { version: 1, params: { teamSessionId: SID } }, 9102)
    assert(wireAfterW1.json.result.value.provenance.projectionGeneration === 1, 'server stamp still 1 after w1 (F3)', wireAfterW1.json.result.value.provenance)
    assert(wireAfterW1.json.result.value.data.projection.members.length === 4, 'server truth: 4 members after w1', wireAfterW1.json.result.value.data.projection.members)

    // (ii) Fixture leg: the transport injects a synthetic gen-2 frame
    // (the cached real gen-1 response rewritten to stamp 2).
    const synthetic = JSON.parse(JSON.stringify(ctx.cache.rawGen1))
    synthetic.value.data.projection.generation = 2
    synthetic.value.provenance.projectionGeneration = 2
    ctx.transports.t1.script(() => ({ type: 'replay', response: { result: synthetic } }))
    const a2 = await c1.sync()
    assert(a2 && a2.status === 'apply', 'synthetic gen-2 frame applied', a2)
    assert(c1.lastAppliedGeneration() === 2, 'c1 at gen 2 (fixture)', c1.lastAppliedGeneration())
    assert(c1.stats().framesApplied === 2, 'framesApplied 2 (gen1 + fixture gen2)', c1.stats())

    // The cached real gen-1 response is replayed: assessed 'stale', must
    // not overwrite the gen-2 frame.
    ctx.transports.t1.script(() => ({ type: 'replay', response: { result: ctx.cache.rawGen1 } }))
    const b = await c1.sync()
    assert(b && b.status === 'stale', 'replayed gen-1 assessed stale', b)
    assert(c1.lastAppliedGeneration() === 2, 'applied generation unchanged (2)', c1.lastAppliedGeneration())
    assert(c1.stats().framesStale === 1, 'framesStale 1', c1.stats())
    assert(c1.stats().framesApplied === 2, 'framesApplied still 2 (stale frame not applied)', c1.stats())
  })

  // ------------------------------------------------------------------ E4
  await scenario('E4', 'ledger pagination stable across a mid-walk mutation', async (assert) => {
    const c1 = ctx.clients.c1
    const c2m = await createMember('worker', 'g8r3-tk-w2', 9201)
    assert(c2m.result.ok === true, 'member.create w2 ok', c2m.result && c2m.result.error)
    assert(c2m.result.value.provenance.effectSequence === 2, 'w2 effectSequence 2', c2m.result.value.provenance)
    const c3m = await createMember('scout', 'g8r3-tk-s1', 9202)
    assert(c3m.result.ok === true, 'member.create s1 ok', c3m.result && c3m.result.error)
    assert(c3m.result.value.provenance.effectSequence === 3, 's1 effectSequence 3', c3m.result.value.provenance)

    const p1 = await c1.fetchPage(0, 2)
    assert(p1.ok === true, 'page 1 ok', p1.reason)
    const seq1 = p1.page.entries.map((e) => e.sequence)
    assert(JSON.stringify(seq1) === JSON.stringify([1, 2]), 'page 1 seq [1,2]', seq1)
    assert(p1.page.nextAfterSequence === 2, 'page 1 nextAfterSequence 2', p1.page.nextAfterSequence)
    assert(p1.page.total === 3, 'page 1 total 3', p1.page.total)
    for (const e of p1.page.entries) {
      for (const f of remoteMod.REMOTE_LEDGER_ENTRY_FIELDS) {
        assert(f in e, 'ledger entry field ' + f, Object.keys(e))
      }
    }

    // Mid-walk mutation (a new fact lands between the two page pulls).
    const c4m = await createMember('scout', 'g8r3-tk-s2', 9203)
    assert(c4m.result.ok === true, 'member.create s2 ok', c4m.result && c4m.result.error)
    assert(c4m.result.value.provenance.effectSequence === 4, 's2 effectSequence 4', c4m.result.value.provenance)

    const p2 = await c1.fetchPage(undefined, 2)
    assert(p2.ok === true, 'page 2 ok (continues from tracker anchor 2)', p2.reason)
    const seq2 = p2.page.entries.map((e) => e.sequence)
    assert(JSON.stringify(seq2) === JSON.stringify([3, 4]), 'page 2 seq [3,4]', seq2)
    assert(p2.page.nextAfterSequence === null, 'page 2 nextAfterSequence null (exhausted)', p2.page.nextAfterSequence)
    assert(p2.page.total === 4, 'page 2 total 4 (append-only: 3 -> 4)', p2.page.total)
    // Frozen anchor rule (ledger-page.ts): a terminal page carries no
    // cursor, so the tracker's anchor stays at the last applied cursor (2).
    assert(c1.pageAnchor() === 2, 'anchor stays at 2 (terminal page carries no cursor)', c1.pageAnchor())
    // Stability under growth: re-reading the same anchor yields the same
    // page and a non-decreasing total (invariant 5).
    const p3 = await c1.fetchPage(2, 2)
    assert(p3.ok === true, 'anchor re-read ok', p3.reason)
    assert(JSON.stringify(p3.page.entries.map((e) => e.sequence)) === JSON.stringify([3, 4]), 're-read of anchor 2 reproduces [3,4]', p3.page.entries)
    assert(p3.page.total === 4, 're-read total 4 (never decreases)', p3.page.total)
    const walked = seq1.concat(seq2)
    assert(JSON.stringify(walked) === JSON.stringify([1, 2, 3, 4]), 'walk strictly monotonic, no dup/gap', walked)
    assert(c1.stats().pagesApplied === 3, 'pagesApplied 3', c1.stats())
    assert(c1.stats().pagesRejected === 0, 'pagesRejected 0', c1.stats())
  })

  // ------------------------------------------------------------------ E5
  await scenario('E5', 'typed errors + provenance on the wire', async (assert) => {
    // (a) unknown method (checked before the envelope — frozen invariant 1)
    const a = await raw('does.notexist', { version: 1, params: {} }, 9301)
    assert(a.status === 200, '5a HTTP 200', a.status)
    assert(a.json.result.ok === false, '5a not ok', a.json.result)
    assert(a.json.result.error.code === 'unknown-method', '5a code unknown-method', a.json.result.error)
    assert(a.json.result.error.details.method === 'does.notexist', '5a details.method', a.json.result.error.details)

    // (b) unsupported contract version
    const b = await raw('team.getProjection', { version: 99, params: { teamSessionId: SID } }, 9302)
    assert(b.json.result.ok === false, '5b not ok', b.json.result)
    assert(b.json.result.error.code === 'contract-version-unsupported', '5b code', b.json.result.error)
    assert(b.json.result.error.details.contractVersion === 1, '5b details.contractVersion 1', b.json.result.error.details)

    // (c) invalid root session id (mirrored frozen P3 code)
    const c = await raw('team.getProjection', { version: 1, params: { teamSessionId: 'bad id with spaces' } }, 9303)
    assert(c.json.result.ok === false, '5c not ok', c.json.result)
    assert(c.json.result.error.code === 'INVALID_ROOT_SESSION_ID', '5c code', c.json.result.error)
    assert(c.json.result.error.details.field === 'teamSessionId', '5c details.field', c.json.result.error.details)

    // (d) closed enum violation with field detail
    const d = await raw('override.get', { version: 1, params: { teamSessionId: SID, capability: 'quantum' } }, 9304)
    assert(d.json.result.ok === false, '5d not ok', d.json.result)
    assert(d.json.result.error.code === 'malformed-params', '5d code malformed-params', d.json.result.error)
    assert(d.json.result.error.details.field === 'capability', '5d details.field capability', d.json.result.error.details)
    assert(typeof d.json.result.error.details.reason === 'string' && d.json.result.error.details.reason.length > 0, '5d details.reason', d.json.result.error.details)

    // (e) quota rejection from the real TeamRuntime (typed pass-through)
    const e = await createMember('worker', 'g8r3-tk-q', 9305)
    assert(e.result.ok === false, '5e not ok', e.result)
    assert(e.result.error.code === 'TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES', '5e typed code', e.result.error)
    assert(e.result.error.details.reason === 'domain-error', '5e details.reason domain-error', e.result.error.details)
    assert(
      e.result.error.details.cause && e.result.error.details.cause.code === 'TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES',
      '5e details.cause identity',
      e.result.error.details.cause,
    )
    assert(e.result.error.details.method === 'member.create', '5e provenance in details', e.result.error.details.method)
    assert(e.result.error.details.contractVersion === 1, '5e details.contractVersion', e.result.error.details)

    // Zero durable side effects from the rejected create. (Product
    // behavior F3: the whole-projection stamp is constant under mutations,
    // so 'unchanged' is asserted against the seed stamp 1 — and the member
    // roster must be exactly the 7 admitted before the rejected 4th worker.)
    const g = await raw('team.getProjection', { version: 1, params: { teamSessionId: SID } }, 9306)
    assert(g.json.result.value.provenance.projectionGeneration === 1, 'generation unchanged (still 1 — F3 constant stamp) after rejected create', g.json.result.value.provenance)
    assert(g.json.result.value.data.projection.members.length === 7, 'roster unchanged (7) after rejected create', g.json.result.value.data.projection.members)
    const l = await raw('team.getLedgerPage', { version: 1, params: { teamSessionId: SID, afterSequence: 0, limit: 50 } }, 9307)
    assert(l.json.result.ok === true, 'ledger page ok', l.json.result)
    assert(l.json.result.value.data.total === 4, 'ledger total still 4 after rejected create', l.json.result.value.data)
  })

  // ------------------------------------------------------------------ E6
  await scenario('E6', 'seam negatives (no cookie / wrong content-type / method mismatch)', async (assert) => {
    const noco = await transportMod.httpRequest({
      host,
      port,
      method: 'POST',
      pathAndQuery: '/team-remote/team.getProjection',
      body: JSON.stringify({ type: 'client-request', rpcId: '9401', method: 'team.getProjection', payload: { version: 1, params: { teamSessionId: SID } } }),
    })
    assert(noco.status === 401, '6a no cookie -> 401', noco.status)
    assert(/unauthorized/i.test(noco.raw), '6a body mentions unauthorized', noco.raw.slice(0, 200))

    // The auth middleware runs BEFORE the content-type check (run-3
    // finding: no cookie + wrong CT -> 401, not 415), so 6b must carry the
    // cookie to reach the content-type gate.
    const wrongCt = await transportMod.httpRequest({
      host,
      port,
      method: 'POST',
      pathAndQuery: '/team-remote/team.getProjection',
      headers: { cookie: ctx.cookie, 'content-type': 'text/plain' },
      body: JSON.stringify({ type: 'client-request', rpcId: '9402', method: 'team.getProjection', payload: { version: 1, params: { teamSessionId: SID } } }) + ' ',
    })
    assert(wrongCt.status === 415, '6b text/plain -> 415', wrongCt.status)
    assert(/content type must be application\/json/i.test(wrongCt.raw), '6b body names the content type', wrongCt.raw.slice(0, 200))

    const mismatch = await transportMod.httpRequest({
      host,
      port,
      method: 'POST',
      pathAndQuery: '/team-remote/team.getProjection',
      headers: { cookie: ctx.cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: '9403', method: 'member.create', payload: { version: 1, params: {} } }),
    })
    assert(mismatch.status === 200, '6c method mismatch -> 200 typed error', mismatch.status)
    assert(mismatch.json && mismatch.json.type === 'server-response', '6c wire shape', mismatch.json)
    assert(mismatch.json.result.ok === false, '6c not ok', mismatch.json.result)
    assert(mismatch.json.result.error.code === 'bad-request', '6c code bad-request', mismatch.json.result.error)
  })

  // ------------------------------------------------------------------ final state
  await scenario('FINAL', 'terminal state: constant stamp 1 (F3), ledger seq 1..4, 7 members', async (assert) => {
    const g = await raw('team.getProjection', { version: 1, params: { teamSessionId: SID } }, 9501)
    assert(g.json.result.value.provenance.projectionGeneration === 1, 'terminal stamp 1 (F3: no product write path advances team_sessions.generation)', g.json.result.value.provenance)
    const proj = g.json.result.value.data.projection
    assert(proj.members.length === 7, '7 members', proj.members.map((m) => m.instanceId))
    const byTemplate = {}
    for (const m of proj.members) byTemplate[m.templateId] = (byTemplate[m.templateId] || 0) + 1
    assert(byTemplate.leader === 1 && byTemplate.worker === 3 && byTemplate.scout === 3, 'template split 1/3/3', byTemplate)
    const leader = proj.members.find((m) => m.instanceId === 'inst-leader')
    assert(leader !== undefined, 'leader present', proj.members.map((m) => m.instanceId))
    assert(leader.childSessionId === undefined, 'leader projection row omits childSessionId (invariant 14)', leader)

    const l = await raw('team.getLedgerPage', { version: 1, params: { teamSessionId: SID, afterSequence: 0, limit: 50 } }, 9502)
    assert(l.json.result.ok === true, 'terminal ledger page ok', l.json.result)
    const seqs = l.json.result.value.data.entries.map((e) => e.sequence)
    assert(JSON.stringify(seqs) === JSON.stringify([1, 2, 3, 4]), 'terminal ledger seq [1,2,3,4]', seqs)
    assert(l.json.result.value.data.nextAfterSequence === null, 'terminal page exhausted', l.json.result.value.data.nextAfterSequence)
    assert(l.json.result.value.data.total === 4, 'terminal total 4', l.json.result.value.data.total)
  })

  const allPass = scenarios.every((s) => s.pass)
  log('E2E RESULT: ' + (allPass ? 'ALL PASS' : 'FAILURES PRESENT') + ' (' + scenarios.filter((s) => s.pass).length + '/' + scenarios.length + ' scenarios)')
  return { allPass, scenarios }
}
