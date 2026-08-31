/**
 * G8-R4 reviewer-4 — browser-less remote e2e scenarios E1–E6.
 *
 * Real HTTP transport against the booted test instance (port 3184):
 * cookie mint via `GET /?token=<launchToken>` (303 + Set-Cookie, captured
 * manually because undici fetch keeps no cookie jar), then POST
 * `/team-remote/<endpoint>` with the pinned host RPC wire envelope
 * (`{type:'client-request', rpcId:<string>, method, payload:{version, params}}`).
 *
 * The P8-T4 deterministic test client (`packages/remote/test`) drives E2/E3/E4
 * through the same transport, so the seam frames the client consumes are the
 * real wire frames the frozen dispatcher produced.
 *
 * Scenario order is deliberate (state on the seeded root `g8-root-1`):
 *   E1 fresh-root team.create (`g8-e1-root`) + projection round-trip
 *   E6 host fence + dispatcher bad-request (no mutation)
 *   E2 reconnect/re-mint, projection consistent with durable truth (gen 6)
 *   E3 in-flight stale response rejected after a gen-7 member.create
 *   E4 ledger page prefix stability across a member.send append (gen 8)
 *   E5 typed error codes + provenance on every success
 */
import { register } from 'node:module'
import { strict as assert } from 'node:assert'
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL as p2u } from 'node:url'
import { existsSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))

// The same ts-loader the row uses: rewrites `.js` specifiers to sibling `.ts`
// inside the worktree's packages/ and maps bare `yaml` to the test-use store.
register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

// --- Worktree root discovery (walk up until the remote package exists) -------
function findWorktreeRoot(start) {
  let dir = start
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'packages', 'remote', 'src', 'index.ts'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('g8r4 e2e: worktree root not found above ' + start)
}

const ROOT = findWorktreeRoot(HERE)
const url = (rel) => p2u(join(ROOT, rel)).href

const C = await import(url('packages/contracts/src/index.ts'))
const RM = await import(url('packages/remote/src/index.ts'))
const P8T4 = await import(url('packages/remote/test/p8t4-test-client.ts'))

const BP_ID = 'team.g8research'
const SEED = 'g8-root-1'
const E1_ROOT = 'g8-e1-root'
const HUMAN = { kind: 'human', humanId: 'g8r4-reviewer' }
const BACKOFF = { baseMs: 20, factor: 2, maxMs: 1000 }

// ---------------------------------------------------------------------------
// Wire primitives
// ---------------------------------------------------------------------------

let rpcSeq = 0

/**
 * One raw RPC round trip over real HTTP.
 * @returns {{status:number, body:object|null, text:string}}
 */
async function rawRpc(base, method, params, cookie, payloadOverride, rpcIdOverride) {
  const rpcId = rpcIdOverride ?? String(++rpcSeq)
  const payload = payloadOverride ?? { version: 1, params }
  const res = await fetch(`${base}/team-remote/${method}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie !== undefined ? { cookie } : {}),
    },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
  })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }
  return { status: res.status, body, text }
}

/** Mint a browser-session cookie from the launch token (303 + Set-Cookie). */
async function mintCookie(base, token) {
  const res = await fetch(`${base}/?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    redirect: 'manual',
  })
  const status = res.status
  const setCookie = res.headers.getSetCookie?.() ?? []
  const single = res.headers.get('set-cookie')
  const header = setCookie[0] ?? single ?? null
  await res.arrayBuffer()
  if (status !== 303 || header === null) {
    throw new Error(`cookie mint failed: HTTP ${status}, set-cookie=${header}`)
  }
  const pair = header.split(';')[0].trim()
  if (!pair.includes('=')) throw new Error(`cookie mint: no name=value in '${header}'`)
  return pair
}

/**
 * The P8-T4 transport over real HTTP.
 * `hold` (optional): {armed, current} — parks one `team.getProjection`
 * request: the real HTTP round trip completes and is captured, but the
 * client-visible promise stays pending until `release()`.
 */
function makeTransport(base, cookie, hold) {
  const send = async (request) => {
    if (hold !== null && hold.armed && request.method === 'team.getProjection') {
      const response = await wireSend(request) // real round trip, captured
      const parked = { response, resolve: null }
      hold.current = parked
      return new Promise((resolve) => {
        parked.resolve = resolve
      })
    }
    return wireSend(request)
  }
  const wireSend = async (request) => {
    // The client's own rpcId must ride the wire (string on the wire, Number
    // on the client side) so the correlation guard passes.
    const { status, body, text } = await rawRpc(
      base,
      request.method,
      request.payload.params,
      cookie,
      request.payload,
      String(request.rpcId),
    )
    if (status !== 200 || body === null || body.type !== 'server-response') {
      throw new RM.PushTransportLossError(
        `transport loss: HTTP ${status} for ${request.method} (${text.slice(0, 120)})`,
      )
    }
    return { rpcId: Number(body.rpcId), result: body.result }
  }
  return { send }
}

/** Assert a RemoteResponse success carries full, correct provenance. */
function checkProvenance(result, method, tokenSent, log, label) {
  assert.ok(result.ok === true, `${label}: expected ok:true, got ${JSON.stringify(result.error ?? null)}`)
  const p = result.value.provenance
  assert.ok(p !== null && typeof p === 'object', `${label}: provenance missing`)
  assert.equal(p.origin, 'team-remote', `${label}: provenance.origin`)
  assert.equal(p.method, method, `${label}: provenance.method`)
  assert.equal(p.endpoint, method, `${label}: provenance.endpoint`)
  assert.equal(p.contractVersion, 1, `${label}: provenance.contractVersion`)
  assert.equal(p.requestToken, tokenSent, `${label}: provenance.requestToken echo`)
  for (const field of ['projectionGeneration', 'effectSequence']) {
    assert.ok(
      p[field] === null || (typeof p[field] === 'number' && Number.isSafeInteger(p[field])),
      `${label}: provenance.${field} must be null or a safe integer, got ${JSON.stringify(p[field])}`,
    )
  }
  log(`  provenance ok for ${method} (origin=${p.origin}, gen=${p.projectionGeneration}, effect=${p.effectSequence})`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitFor(predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await sleep(25)
  }
  throw new Error(`timed out waiting for ${what}`)
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export async function runE2e({ base, token, log }) {
  const results = []
  const record = (id, ok, detail) => {
    results.push({ id, ok, detail: detail ?? null })
    log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`)
  }
  const runScenario = async (id, what, fn) => {
    try {
      const detail = await fn()
      record(id, true, detail)
    } catch (error) {
      record(id, false, error instanceof Error ? error.message : String(error))
    }
  }

  // --- Health + first cookie --------------------------------------------------
  const health = await (await fetch(`${base}/__g8r4/health`)).json()
  log(`health: ready=${health.ready} ok=${health.ok} seedGen=${health.generation} seeded=${health.seeded}`)
  assert.ok(health.ready === true, `harness row not ready: ${JSON.stringify(health)}`)
  let cookie = await mintCookie(base, token)
  log(`cookie minted: ${cookie.slice(0, 24)}...`)

  const transport = () => makeTransport(base, cookie, null)

  // --- E1 — fresh root + lossless typed projection round-trip ------------------
  await runScenario('E1', 'team.create fresh root + typed projection round-trip', async () => {
    const created = await rawRpc(base, 'team.create', { rootSessionId: E1_ROOT, blueprintId: BP_ID, blueprintRevision: 1 }, cookie)
    assert.equal(created.status, 200, `team.create HTTP ${created.status}: ${created.text.slice(0, 200)}`)
    assert.ok(created.body.type === 'server-response', 'team.create envelope')
    checkProvenance(created.body.result, 'team.create', null, log, 'E1 team.create')
    assert.equal(created.body.result.value.data.path, 'fresh-root', 'E1 path')
    assert.equal(created.body.result.value.data.durable.wrote, true, 'E1 durable.wrote')

    const pulled = await rawRpc(base, 'team.getProjection', { teamSessionId: E1_ROOT }, cookie)
    assert.equal(pulled.status, 200, `team.getProjection HTTP ${pulled.status}`)
    checkProvenance(pulled.body.result, 'team.getProjection', null, log, 'E1 team.getProjection')
    const rawProjection = pulled.body.result.value.data.projection
    assert.equal(pulled.body.result.value.provenance.projectionGeneration, rawProjection.generation, 'E1 provenance/data generation agreement')
    const dto = C.parseTeamProjection(rawProjection) // typed P8-T1 deserialization
    const roundTrip = JSON.parse(JSON.stringify(rawProjection))
    assert.deepEqual(roundTrip, rawProjection, 'E1 lossless JSON round-trip')
    // Fresh root: team record (gen 1) + the leader's member.created
    // fact (gen 2) — a structurally complete team with its leader.
    assert.equal(dto.generation, 2, 'E1 fresh root generation 2 (record + leader fact)')
    assert.equal(dto.teamSessionId, E1_ROOT, 'E1 teamSessionId')
    // The ledger sequence space is GLOBAL across teams (one counter
    // row — documented seam decision 5): the seed consumed seq 1-5, so
    // this fresh team's single leader fact carries seq 6 even though it
    // is the team's first entry.
    assert.equal(dto.ledger.latestSequence, 6, 'E1 fresh root ledger latestSequence (global counter)')
    assert.equal(dto.ledger.totalEntries, 1, 'E1 fresh root ledger totalEntries')
    assert.equal(dto.ledger.byCategory.member, 1, 'E1 ledger byCategory.member')
    assert.equal(dto.members.length, 1, 'E1 exactly one member row')
    assert.equal(dto.members[0].instanceId, C.LEADER_INSTANCE_ID, 'E1 member row is the leader')
    return `path=fresh-root, gen=${dto.generation}, lossless=true, typed=TeamProjectionDto`
  })

  // --- E6 — host fence + dispatcher bad-request (no mutation) ------------------
  await runScenario('E6', 'fence: 401 no-cookie / 415 content-type / 200 method-mismatch', async () => {
    const envelope = (method) => JSON.stringify({
      type: 'client-request',
      rpcId: String(++rpcSeq),
      method,
      payload: { version: 1, params: { teamSessionId: SEED } },
    })
    // (a) no cookie
    const noCookie = await fetch(`${base}/team-remote/team.getProjection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: envelope('team.getProjection'),
    })
    const noCookieText = await noCookie.text()
    assert.equal(noCookie.status, 401, `E6a expected 401, got ${noCookie.status} (${noCookieText.slice(0, 80)})`)
    // (b) wrong content-type (cookie present)
    const badCt = await fetch(`${base}/team-remote/team.getProjection`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', cookie },
      body: envelope('team.getProjection'),
    })
    const badCtText = await badCt.text()
    assert.equal(badCt.status, 415, `E6b expected 415, got ${badCt.status} (${badCtText.slice(0, 80)})`)
    // (c) method != endpoint (cookie present, JSON content-type)
    const mismatch = await fetch(`${base}/team-remote/team.getProjection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: envelope('member.send'),
    })
    const mismatchText = await mismatch.text()
    assert.equal(mismatch.status, 200, `E6c expected 200, got ${mismatch.status} (${mismatchText.slice(0, 120)})`)
    const mismatchBody = JSON.parse(mismatchText)
    assert.equal(mismatchBody.type, 'server-response', 'E6c envelope type')
    assert.equal(mismatchBody.result.ok, false, 'E6c ok:false')
    assert.match(mismatchBody.result.error.message, /does not match endpoint/, `E6c message: ${mismatchBody.result.error.message}`)
    return '401 no-cookie; 415 text/plain; 200 bad-request method-mismatch'
  })

  // --- E2 — reconnect + re-mint, consistent with durable truth -----------------
  await runScenario('E2', 'reconnect: new client + re-minted cookie, projection consistent', async () => {
    const clientA = P8T4.createP8T4TestClient({ teamSessionId: SEED, transport: transport(), backoff: BACKOFF })
    const startA = await clientA.start()
    assert.equal(startA.status, 'apply', `E2 startA ${startA.status}`)
    const frameA = clientA.appliedFrame()
    clientA.stop() // destroy the connection; cookie below is discarded
    cookie = await mintCookie(base, token) // re-mint a fresh browser session
    log('  E2: connection destroyed, cookie re-minted')
    const clientB = P8T4.createP8T4TestClient({ teamSessionId: SEED, transport: transport(), backoff: BACKOFF })
    const startB = await clientB.start()
    assert.equal(startB.status, 'apply', `E2 startB ${startB.status}`)
    const frameB = clientB.appliedFrame()
    clientB.stop()
    assert.ok(frameB.projection.generation >= frameA.projection.generation, 'E2 generation equal-or-advanced')
    // generatedAt is the fold's wall-clock stamp (clock()) — it
    // legitimately differs between the two pulls; every structural
    // field of the projection must agree.
    const stripClock = (p) => {
      const c = { ...p }
      delete c.generatedAt
      return c
    }
    const projA = stripClock(frameA.projection)
    const projB = stripClock(frameB.projection)
    try {
      assert.deepEqual(projB, projA, 'E2 content matches across reconnect (generatedAt clock stamp excluded)')
    } catch (err) {
      throw new Error(`E2 content mismatch (generatedAt excluded):\nA=${JSON.stringify(projA)}\nB=${JSON.stringify(projB)}`)
    }
    // Consistent with durable truth: ledger summary vs the real ledger read path.
    const page = await rawRpc(base, 'team.getLedgerPage', { teamSessionId: SEED }, cookie)
    const pageValue = page.body.result.value.data
    assert.equal(pageValue.total, frameB.projection.ledger.totalEntries, 'E2 projection ledger total == durable total')
    assert.equal(pageValue.total, frameB.projection.ledger.latestSequence, 'E2 no gaps: total == latestSequence')
    assert.equal(health.generation, frameB.projection.generation, 'E2 seed generation matches harness health')
    return `gen ${frameA.projection.generation} -> ${frameB.projection.generation}, entries=${pageValue.total}, content identical`
  })

  // --- E3 — in-flight stale response rejected ----------------------------------
  await runScenario('E3', 'stale in-flight response rejected after newer projection applied', async () => {
    const hold = { armed: false, current: null }
    const client = P8T4.createP8T4TestClient({
      teamSessionId: SEED,
      transport: makeTransport(base, cookie, hold),
      backoff: BACKOFF,
    })
    const start = await client.start()
    assert.equal(start.status, 'apply', `E3 start ${start.status}`)
    const genBefore = client.lastAppliedGeneration()

    hold.armed = true
    const pending = client.sync() // in flight; parked after the real round trip
    await waitFor(() => hold.current !== null, 5000, 'E3 hold capture')
    const heldResponse = hold.current.response
    assert.ok(heldResponse.result.ok, 'E3 held response is a success frame')
    const heldGeneration = heldResponse.result.value.data.projection.generation
    assert.equal(heldGeneration, genBefore, 'E3 held frame carries the pre-mutation generation')

    // Mutating action while the old response is still undelivered.
    const created = await rawRpc(base, 'member.create', {
      teamSessionId: SEED,
      caller: HUMAN,
      requestToken: 'g8r4-e3-req-token',
      delegationTemplateId: 'writer',
    }, cookie)
    assert.equal(created.status, 200, `E3 member.create HTTP ${created.status}`)
    assert.ok(created.body.result.ok === true, `E3 member.create failed: ${JSON.stringify(created.body.result.error)}`)
    checkProvenance(created.body.result, 'member.create', 'g8r4-e3-req-token', log, 'E3 member.create')
    const newInstanceId = created.body.result.value.data.outcome.targetInstanceId

    // The newer durable truth (one fact appended -> generation +1, hook A).
    const newerRaw = await rawRpc(base, 'team.getProjection', { teamSessionId: SEED }, cookie)
    assert.ok(newerRaw.body.result.ok === true, `E3 post-create pull failed: ${JSON.stringify(newerRaw.body.result.error)}`)
    const genAfter = newerRaw.body.result.value.data.projection.generation
    assert.equal(genAfter, genBefore + 1, `E3 generation advanced ${genBefore} -> ${genAfter}`)

    // Disarm so the next pull passes through; only the first sync is held.
    hold.armed = false
    const newer = await client.sync() // passthrough: applies the newer projection
    assert.equal(newer.status, 'apply', `E3 newer sync ${newer.status}`)
    assert.equal(newer.receivedGeneration, genAfter, 'E3 newer generation applied')

    // Release the held (older) response now.
    hold.current.resolve(hold.current.response)
    const staleAssessment = await pending
    assert.equal(staleAssessment.status, 'stale', `E3 held response verdict: ${staleAssessment.status}`)
    assert.equal(staleAssessment.receivedGeneration, heldGeneration, 'E3 stale receivedGeneration')
    assert.equal(client.lastAppliedGeneration(), genAfter, 'E3 applied state untouched by stale frame')
    assert.equal(client.appliedFrame().projection.generation, genAfter, 'E3 applied frame generation')
    const stats = client.stats()
    assert.ok(stats.framesStale >= 1, `E3 stats.framesStale=${stats.framesStale}`)
    client.stop()
    return `held gen ${heldGeneration} rejected stale after gen ${genAfter} applied (instance ${newInstanceId})`
  })

  // --- E4 — ledger page prefix stability across an append ----------------------
  await runScenario('E4', 'ledger page: same anchor stable after member.send append', async () => {
    const pageA = await rawRpc(base, 'team.getLedgerPage', { teamSessionId: SEED, afterSequence: 0, limit: 50 }, cookie)
    assert.equal(pageA.status, 200, `E4 pageA HTTP ${pageA.status}`)
    checkProvenance(pageA.body.result, 'team.getLedgerPage', null, log, 'E4 pageA')
    const valueA = pageA.body.result.value.data
    assert.ok(Array.isArray(valueA.entries) && valueA.entries.length > 0, 'E4 pageA non-empty')

    // Pagination walk with an explicit small limit (real slicing).
    const pageC = await rawRpc(base, 'team.getLedgerPage', { teamSessionId: SEED, afterSequence: 0, limit: 2 }, cookie)
    const valueC = pageC.body.result.value.data
    assert.equal(valueC.entries.length, 2, 'E4 limit slice')
    assert.equal(valueC.nextAfterSequence, valueC.entries[1].sequence, 'E4 cursor = last sequence')
    const pageD = await rawRpc(base, 'team.getLedgerPage', { teamSessionId: SEED, afterSequence: valueC.nextAfterSequence, limit: 2 }, cookie)
    const valueD = pageD.body.result.value.data
    assert.equal(valueD.entries[0].sequence, valueC.entries[1].sequence + 1, 'E4 cursor resumes after last')
    assert.notEqual(valueD.entries[0].sequence, valueC.entries[0].sequence, 'E4 no overlap')

    // Append ledger activity.
    const send = await rawRpc(base, 'member.send', {
      teamSessionId: SEED,
      caller: HUMAN,
      recipientInstanceId: 'inst-alpha',
      body: 'g8-r4 e4 probe message',
      requestToken: 'g8r4-e4-req-token',
    }, cookie)
    assert.ok(send.body.result.ok === true, `E4 member.send failed: ${JSON.stringify(send.body.result.error)}`)
    checkProvenance(send.body.result, 'member.send', 'g8r4-e4-req-token', log, 'E4 member.send')
    const appendedSequence = send.body.result.value.data.outcome.effect.sequence

    // Re-fetch the SAME anchor.
    const pageB = await rawRpc(base, 'team.getLedgerPage', { teamSessionId: SEED, afterSequence: 0, limit: 50 }, cookie)
    const valueB = pageB.body.result.value.data
    assert.equal(valueB.total, valueA.total + 1, 'E4 total advanced by exactly one')
    assert.equal(valueB.entries.length, valueA.entries.length + 1, 'E4 page grew by one')
    assert.deepEqual(valueB.entries.slice(0, valueA.entries.length), valueA.entries, 'E4 prefix identical (append-only)')
    assert.equal(valueB.entries[valueA.entries.length].sequence, appendedSequence, 'E4 appended entry is the new fact')
    assert.equal(valueB.entries[valueA.entries.length].factType, 'message.sent', 'E4 appended fact type')
    // A page holding every entry has NO cursor (D-5: nextAfterSequence is
    // set iff more entries remain) — both full pages must carry null.
    assert.equal(valueB.nextAfterSequence, null, 'E4 cursor null when the page holds all entries')
    assert.equal(valueA.nextAfterSequence, null, 'E4 old cursor null when the page holds all entries')

    // Client page path against the real read path (P8-T4 fetchPage): walk
    // with a small limit so the cursor mechanism (tracker anchor advance)
    // is exercised, not just the no-cursor fast path.
    const client = P8T4.createP8T4TestClient({ teamSessionId: SEED, transport: transport(), backoff: BACKOFF })
    await client.start()
    const report1 = await client.fetchPage(0, 2)
    assert.equal(report1.ok, true, `E4 client fetchPage(0,2) ${report1.reason ?? ''}`)
    assert.equal(report1.page.entries.length, 2, 'E4 client page slice')
    assert.equal(report1.page.total, valueB.total, 'E4 client page total matches raw')
    assert.equal(report1.page.nextAfterSequence, 2, 'E4 client page cursor = last sequence')
    assert.equal(client.pageAnchor(), 2, 'E4 client anchor advanced by cursor')
    assert.equal(client.stats().pagesApplied, 1, 'E4 client page applied')
    const report2 = await client.fetchPage(2, 2)
    assert.equal(report2.ok, true, `E4 client fetchPage(2,2) ${report2.reason ?? ''}`)
    assert.equal(report2.page.entries[0].sequence, 3, 'E4 client page 2 resumes after cursor')
    assert.equal(client.pageAnchor(), 4, 'E4 client anchor advanced again')
    assert.equal(client.stats().pagesApplied, 2, 'E4 client pages applied')
    client.stop()
    return `anchor 0: ${valueA.total} -> ${valueB.total} entries, prefix stable, appended seq ${appendedSequence}; client cursor walk 0->2->4`
  })

  // --- E5 — typed error codes (no 500s) ----------------------------------------
  await runScenario('E5', 'typed errors: INVALID_ROOT_SESSION_ID / contract-version-unsupported / INSTANCE_NOT_FOUND', async () => {
    // (a) invalid ID (whitespace) — frozen P3 mirrored code.
    const badId = await rawRpc(base, 'team.getProjection', { teamSessionId: 'bad id with whitespace' }, cookie)
    assert.equal(badId.status, 200, `E5a HTTP ${badId.status}`)
    assert.equal(badId.body.result.ok, false, 'E5a ok:false')
    assert.equal(badId.body.result.error.code, 'INVALID_ROOT_SESSION_ID', `E5a code: ${badId.body.result.error.code}`)
    assert.ok(typeof badId.body.result.error.message === 'string' && badId.body.result.error.message.length > 0, 'E5a message')
    assert.equal(badId.body.result.error.details.method, 'team.getProjection', 'E5a details.method')
    // (b) unsupported contract version.
    const badVersion = await rawRpc(base, 'team.getProjection', { teamSessionId: SEED }, cookie, { version: 2, params: { teamSessionId: SEED } })
    assert.equal(badVersion.status, 200, `E5b HTTP ${badVersion.status}`)
    assert.equal(badVersion.body.result.ok, false, 'E5b ok:false')
    assert.equal(badVersion.body.result.error.code, 'contract-version-unsupported', `E5b code: ${badVersion.body.result.error.code}`)
    // (c) admission-blocked action: valid-format instance id, unknown target.
    const blocked = await rawRpc(base, 'member.send', {
      teamSessionId: SEED,
      caller: HUMAN,
      recipientInstanceId: 'inst-ghost',
      body: 'nobody home',
      requestToken: 'g8r4-e5-req-token',
    }, cookie)
    assert.equal(blocked.status, 200, `E5c HTTP ${blocked.status}`)
    assert.equal(blocked.body.result.ok, false, 'E5c ok:false')
    assert.equal(blocked.body.result.error.code, 'INSTANCE_NOT_FOUND', `E5c code: ${blocked.body.result.error.code}`)
    assert.equal(blocked.body.result.error.details.reason, 'domain-error', 'E5c typed domain error reason')
    assert.ok(blocked.body.result.error.details.cause !== undefined, 'E5c cause recorded')
    return 'all three typed codes returned with 200 envelopes (no 500s, no raw exceptions)'
  })

  const allPassed = results.every((r) => r.ok)
  return { results, allPassed }
}
