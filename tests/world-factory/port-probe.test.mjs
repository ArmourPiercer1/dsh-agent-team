/**
 * port-probe.test.mjs — negative controls for the port probe and the port
 * lease gate that consumes it (tests/characterization/lib/util.mjs
 * `portInUse` → tests/world-factory/lib/port-lease.mjs second guard).
 *
 * Run: node --test tests/world-factory/port-probe.test.mjs
 *
 * WHY THESE LEGS EXIST (dated 2026-10-30, real UTC). RCA-1
 * (dev/agent-workflow/evidence/a5w-portprobe-20261030/
 * rca1-portprobe-verification.md, which reproduces the upstream boot-wave
 * RCA-1 of branch task/a5w-bootwave-20261030)
 * measured two World-boot waves dying BEFORE any spawn: `portInUse` judged a
 * connect TIMEOUT as "in use", and on this executor (WSL mirrored networking)
 * a SYN to a closed loopback port is black-holed — no RST — so EVERY free
 * port in the sanctioned bands timed out, `acquirePortLease` refused the whole
 * mock band with EXTERNAL_BIND, and real boot consumption was zero. The fix
 * classifies a timeout as INCONCLUSIVE and resolves it with a one-shot bind
 * probe. These legs pin BOTH directions of that classification, because a
 * probe that only says "free" is not a fix, it is a new way to double-book a
 * port:
 *
 *   NC-1  a REAL listener must still read as in-use (the fast connect path —
 *         the classification may never become optimistic about listeners)
 *   NC-2  a CLOSED in-band port must read as free, within a bounded time —
 *         and on a black-holing box, the leg additionally proves the answer
 *         came from the bind tie-breaker, not from a lucky RST
 *   NC-3  lease round-trip over the MOCK band: three acquisitions, three
 *         DIFFERENT ports, every release clean, the slot reusable after
 *   NC-4  a foreign bind with NO lease must still be refused with
 *         EXTERNAL_BIND (the second guard stays armed after the fix), and the
 *         refusal must not leave our own claim behind
 *   NC-5  with a zero connect budget the classifier still answers BOTH ways
 *         and never fails closed on a free port — the environment-independent
 *         pin of the bind tie-breaker (NC-2 can only claim the tie-breaker was
 *         used when the box happens to black-hole a port)
 *
 * Touches: ZERO Host boots, ZERO worlds. It DOES bind — deliberately, only on
 * ports proven inside tests/paths.mjs TEST_PORT_RANGES (3080 and 3180 are
 * asserted absent), and every bind is closed again inside the leg. Unlike its
 * sibling C1 files this one is not "zero ports bound"; it is "zero ports
 * LEAKED", which NC-3/NC-4 assert explicitly.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createConnection, createServer } from 'node:net'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { portInUse } from '../characterization/lib/util.mjs'
import { acquireFirstFreeLease, readLease } from './lib/port-lease.mjs'
import { isSanctionedTestPort, MOCK_PORT_BANDS, STABLE_INSTANCE_PORT, portsOfBands } from '../paths.mjs'

/** Upper bound added on top of `timeoutMs` for the bind tie-breaker leg. */
const BIND_LEG_SLACK_MS = 2_000

/** Raw connect probe, independent of util.mjs, so the environment itself is
 *  measured rather than assumed: 'answered' | 'refused' | 'timed-out'. */
function rawConnectOutcome(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    let settled = false
    const finish = (value, detail) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve({ outcome: value, detail })
    }
    socket.once('connect', () => finish('answered'))
    socket.once('error', (error) => finish('refused', error.code))
    setTimeout(() => finish('timed-out'), timeoutMs)
  })
}

/** Bind a server on an EXACT port (rejects unless it is genuinely ours). */
function bindExact(port) {
  return new Promise((resolve, reject) => {
    assert.equal(isSanctionedTestPort(port), true, `test must not bind ${String(port)} — outside TEST_PORT_RANGES`)
    assert.notEqual(port, STABLE_INSTANCE_PORT, 'the stable instance port is never touched')
    assert.notEqual(port, 3180, 'the hand-run test port is never bound by this suite')
    const server = createServer()
    server.once('error', (error) => {
      server.close()
      reject(error)
    })
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

const unbind = (server) => new Promise((resolve) => { server.close(() => resolve()) })

/**
 * Every port with a state-0A (LISTEN) entry in /proc/net/tcp{,6} — the SAME
 * census RCA-1 used to prove the bands empty. It is the only freeness proof
 * that does not contaminate what NC-2 measures: BINDING a port to check it is
 * exactly what makes this box stop black-holing it (measured twice: a
 * never-touched port answered our connect with a TIMEOUT, the same port after
 * one of our own bind+close answered with a fast ECONNREFUSED).
 * @returns {Set<number>|null} null when /proc is unreadable (non-Linux).
 */
function listeningPorts() {
  const out = new Set()
  let sawAny = false
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text = null
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    sawAny = true
    for (const line of text.split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/)
      if (fields.length < 4) continue
      if (fields[3] !== '0A') continue // LISTEN only
      const hex = (fields[1] ?? '').split(':')[1]
      const port = Number.parseInt(hex ?? '', 16)
      if (Number.isInteger(port)) out.add(port)
    }
  }
  return sawAny ? out : null
}

/**
 * A port this box is still BLACK-HOLING: no LISTEN entry in the /proc census
 * AND a raw connect that gets no answer at all. `provenFree` (we bound it and
 * gave it back) is the fallback for a box that answers every closed port with
 * a RST — the verdict must be false in BOTH shapes, that is the whole point.
 *
 * Scanning is cheap even over the whole band: a candidate answers (fast RST)
 * or times out, and the FIRST timeout ends the scan. Note the scan is not
 * free of consequence — the leg it feeds binds that port once (that is the
 * probe under test), which is exactly what teaches this box to answer the
 * port with a RST afterwards, so successive runs walk forward through the
 * band instead of reusing one port forever.
 */
async function findBlackHoledPort() {
  const band = portsOfBands(MOCK_PORT_BANDS)
  const census = listeningPorts()
  const firstProven = { port: null }
  const trail = []
  for (const port of band) {
    if (census !== null && census.has(port)) {
      trail.push(`${port}:listed-in-census`)
      continue // something listens: not a candidate
    }
    const { outcome, detail } = await rawConnectOutcome(port, 1500)
    trail.push(`${port}:${outcome}${detail === undefined ? '' : `/${detail}`}`)
    if (outcome === 'timed-out') {
      return { port, shape: 'black-holed', census: census === null ? 'unavailable' : 'clean', trail }
    }
    if (firstProven.port === null) firstProven.port = port
  }
  if (firstProven.port === null) throw new Error(`no candidate sanctioned mock-band port — the census says the whole band is listening; trail: ${trail.join(' ')}`)
  const server = await bindExact(firstProven.port)
  await unbind(server)
  return { port: firstProven.port, shape: 'rst-answering', census: census === null ? 'unavailable' : 'clean', trail }
}

/**
 * The next provably-free in-band port at or after `fromPort`: free means OUR
 * OWN bind succeeded and was closed again, not "a probe said so" — a
 * self-referential guarantee would make the free-side legs vacuous.
 */
async function findFreePort(fromPort, count = 40) {
  const band = portsOfBands(MOCK_PORT_BANDS)
  for (let i = 0; i < count; i += 1) {
    const port = band[(band.indexOf(fromPort) + i + band.length) % band.length] ?? band[i]
    let server = null
    try {
      server = await bindExact(port)
    } catch (error) {
      if (error?.code === 'EADDRINUSE') continue
      throw error
    }
    await unbind(server)
    return port
  }
  throw new Error(`no free sanctioned mock-band port found from ${String(fromPort)}`)
}

// ── NC-1 ────────────────────────────────────────────────────────────────────
test('NC-1 a real listener reads as IN USE (fast connect path, never optimistic)', async (t) => {
  const port = await findFreePort(3491)
  const server = await bindExact(port)
  try {
    const started = Date.now()
    const inUse = await portInUse(port, 1500)
    const elapsed = Date.now() - started
    t.diagnostic(`NC-1 port=${port} inUse=${String(inUse)} elapsed=${elapsed}ms`)
    assert.equal(inUse, true, `a listener we started ourselves on ${port} must read as in use`)
    // The listener answers, so this is the fast path: a probe that only gets
    // the right ANSWER by waiting for a timeout would still hide real
    // listeners behind slow classification, which is what NC-1 also pins.
    assert.ok(elapsed < 1500, `the connect fast path must answer, took ${elapsed}ms`)
  } finally {
    await unbind(server)
  }
  // and the same port must read free once the listener is gone
  assert.equal(await portInUse(port, 1500), false, `port ${port} must read free after close`)
})

// ── NC-2 ────────────────────────────────────────────────────────────────────
test('NC-2 a closed in-band port reads as FREE within the timeout bound (RCA-1 black hole)', async (t) => {
  const timeoutMs = 1500
  // Find a port the box is STILL black-holing (no LISTEN entry in the /proc
  // census, and a raw connect that gets no answer). Binding a candidate first
  // would teach the box to answer RST and silently turn this leg into a
  // fast-path test, so freeness here comes from the census, not from a bind.
  const candidate = await findBlackHoledPort()
  const started = Date.now()
  const inUse = await portInUse(candidate.port, timeoutMs)
  const elapsed = Date.now() - started
  t.diagnostic(`NC-2 port=${candidate.port} shape=${candidate.shape} connect-census=${candidate.census} portInUse=${String(inUse)} elapsed=${elapsed}ms`)
  t.diagnostic(`NC-2 raw connect trail (first 8): ${candidate.trail.slice(0, 8).join(' ')}`)
  assert.equal(inUse, false, `port ${candidate.port} has no listener (${candidate.shape}, /proc census ${candidate.census}) but the probe said in-use — this is the RCA-1 false positive that refused the whole mock band`)
  assert.ok(elapsed <= timeoutMs + BIND_LEG_SLACK_MS, `the verdict must arrive within timeoutMs + bind slack, took ${elapsed}ms`)
  if (candidate.shape === 'black-holed') {
    // The black hole is live in THIS run, so "free" can only have come from
    // the bind tie-breaker: the probe had to wait the inconclusive connect out
    // before answering. On a box that RSTs closed ports the fast path answers
    // instead, and the leg above is still the whole contract.
    assert.ok(elapsed >= timeoutMs, `on a black-holing box the inconclusive connect must be waited out before the bind verdict, took ${elapsed}ms`)
    t.diagnostic(`NC-2 verdict came from the bind tie-breaker (connect was inconclusive at ${timeoutMs}ms)`)
  } else {
    t.diagnostic('NC-2 box answered a closed port with RST — the inconclusive path was not exercised by this leg in this run')
  }
})

// ── NC-3 ────────────────────────────────────────────────────────────────────
test('NC-3 lease round-trip: three acquisitions in the mock band give three DIFFERENT ports and release clean', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'pp-lease-'))
  const leases = []
  try {
    for (let i = 0; i < 3; i += 1) {
      const lease = await acquireFirstFreeLease({ leaseRoot: root, world: `pp-nc3-${i}`, purpose: 'mock', include: portsOfBands(MOCK_PORT_BANDS) })
      leases.push(lease)
      assert.equal(isSanctionedTestPort(lease.port), true, `leased port ${lease.port} is sanctioned`)
      assert.equal(readLease(root, lease.port).state, 'held', `port ${lease.port} must read held while we hold it`)
    }
    const ports = leases.map((l) => l.port)
    assert.equal(new Set(ports).size, 3, `three live leases must name three different ports, got ${JSON.stringify(ports)}`)
    t.diagnostic(`NC-3 leased ${JSON.stringify(ports)}`)
  } finally {
    for (const lease of leases) lease.release()
  }
  // every released slot is inert again, and the first port is re-acquirable
  for (const lease of leases) assert.equal(readLease(root, lease.port).state, 'free', `port ${lease.port} must read free after release`)
  const root2 = mkdtempSync(join(tmpdir(), 'pp-lease2-'))
  try {
    const again = await acquireFirstFreeLease({ leaseRoot: root2, world: 'pp-nc3-again', purpose: 'mock', include: [leases[0].port] })
    assert.equal(again.port, leases[0].port)
    again.release()
    assert.equal(readLease(root2, again.port).state, 'free')
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(root2, { recursive: true, force: true })
  }
})

// ── NC-4 ────────────────────────────────────────────────────────────────────
test('NC-4 a foreign bind with no lease is still refused with EXTERNAL_BIND and leaves no claim behind', async (t) => {
  const port = await findFreePort(13080)
  const server = await bindExact(port)
  const root = mkdtempSync(join(tmpdir(), 'pp-external-'))
  try {
    await assert.rejects(
      acquireFirstFreeLease({ leaseRoot: root, world: 'pp-nc4', purpose: 'mock', include: [port] }),
      (error) => error?.code === 'EXTERNAL_BIND',
      `port ${port} is bound by us with NO lease file — the second guard must refuse it`,
    )
    t.diagnostic(`NC-4 refused port=${port} as EXTERNAL_BIND while a leaseless listener held it`)
    const state = readLease(root, port)
    assert.equal(state.state, 'free', 'the refusal must release our own claim — a held claim on a port we refused would wedge the band')
    // The guard is armed by the LISTENER, not by the environment: drop the
    // listener and the very same port acquires cleanly.
    await unbind(server)
    const lease = await acquireFirstFreeLease({ leaseRoot: root, world: 'pp-nc4-after', purpose: 'mock', include: [port] })
    assert.equal(lease.port, port)
    lease.release()
    assert.equal(readLease(root, port).state, 'free')
  } finally {
    try {
      await unbind(server)
    } catch {
      /* already closed on the happy path */
    }
    rmSync(root, { recursive: true, force: true })
  }
})

// ── NC-5 ────────────────────────────────────────────────────────────────────
test('NC-5 with ZERO connect budget the classifier still answers both ways and never fails closed on a free port', async (t) => {
  // timeoutMs=0 leaves the connect attempt no budget at all. On THIS box the
  // 0ms timer always wins (a black-holed SYN could not answer in time anyway),
  // so both verdicts below are produced by the bind tie-breaker alone — which
  // is how this leg pins the new classification rule independently of the
  // environment NC-2 depends on. On a healthy box that RSTs closed ports the
  // fast path may answer first instead; the contract asserted here is the same
  // either way. A probe that failed closed when its own bind leg was cut off
  // would answer `true` for the closed port and fail this leg.
  const port = await findFreePort(3494)
  const server = await bindExact(port)
  const busyStarted = Date.now()
  const busy = await portInUse(port, 0)
  const busyElapsed = Date.now() - busyStarted
  await unbind(server)
  const freeStarted = Date.now()
  const free = await portInUse(port, 0)
  const freeElapsed = Date.now() - freeStarted
  t.diagnostic(`NC-5 port=${port} listener: inUse=${String(busy)} elapsed=${busyElapsed}ms | closed: inUse=${String(free)} elapsed=${freeElapsed}ms`)
  assert.equal(busy, true, `the bind leg must see EADDRINUSE on our own listener at ${port} and report in-use`)
  assert.equal(free, false, `the bind leg must bind the same port once closed and report free`)
  // The bind leg gets its own floor (Math.max(timeoutMs, 1000)) precisely so a
  // tiny caller budget cannot preempt it; if that floor ever regressed, this
  // leg fails closed on the free port and says true here.
  assert.ok(busyElapsed < 1000 && freeElapsed < 1000, `the bind leg must ANSWER inside its floor, not be cut off by its watchdog (busy=${busyElapsed}ms free=${freeElapsed}ms)`)
})
