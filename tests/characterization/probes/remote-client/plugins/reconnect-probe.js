// P2-T6 reconnect probe (TEAM_REMOTE: reconnect-basic).
// Host-side payload: runs inside the DSH instance child process (node 24 runs the
// imported .ts through --experimental-transform-types, set by the group index via
// NODE_OPTIONS before instance boot). Imports only the public ConnectionController
// from @deepseek-ai/dsh-client-connection and drives it with synthetic generation
// sources — the same source/sink contract the API Gateway uses in the browser.
//
// Scenarios (config: base 20ms, factor 2, cap 40ms, ready timeout 250ms unless noted):
//   R1 happy path: ready -> 'connected' (no pre-connect emission), host fact
//      round-trips, onConnected once; stop() -> no further events. Restarting
//      after stop re-fires onConnected WITHOUT a state event (lastState is
//      instance-persistent, so connected->connected is deduped) — recorded as a
//      contract observation.
//   R2 loss/backoff/reconnect x2: per-retry interval measured between the
//      'reconnecting' transition and the next 'connected'; attempt N cap =
//      min(40, 20 * 2^(N-1)) so retry 1 ∈ [10,20]ms, retry 2 ∈ [20,40]ms
//      (jittered cap/2..cap per the public contract).
//   R3 ready timeout: a source that never reports ready -> first state event is
//      'reconnecting' at ~250ms, zero onConnected ever.
//   R4 throwing sinks: both sinks throw on every call; the controller must still
//      complete three generations (sink isolation).
//   R5 stop during backoff: backoff stretched to [1000,2000]ms so stop() lands
//      inside the backoff sleep; no second generation may open, no events after stop.
// Writes obs-reconnect.json under $P2T6_OBS_DIR.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ConnectionController } from '@deepseek-ai/dsh-client-connection/src/client/connection.ts'

export const name = 'p2t6-reconnect-probe'
export const inject = []

const PROBE = 'p2t6-reconnect-probe'
const FAST = { backoffBaseMs: 20, backoffFactor: 2, backoffMaxMs: 40, generationReadyTimeoutMs: 250 }
const SLOW_BACKOFF = { backoffBaseMs: 2000, backoffFactor: 2, backoffMaxMs: 4000, generationReadyTimeoutMs: 250 }

const now = () => Date.now()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const until = async (fn, timeoutMs, label) => {
  const t0 = now()
  while (now() - t0 < timeoutMs) {
    if (fn()) return true
    await sleep(2)
  }
  throw new Error(`${PROBE}: timed out waiting for ${label}`)
}

export function apply(ctx) {
  void ctx
  const obsDir = process.env.P2T6_OBS_DIR
  if (typeof obsDir !== 'string' || obsDir === '') {
    throw new Error(`${PROBE}: P2T6_OBS_DIR is not set`)
  }
  const out = { probe: PROBE, node: process.version, done: false, scenarios: {} }
  const checks = []
  const add = (id, expected, actual) => {
    const pass = JSON.stringify(expected) === JSON.stringify(actual)
    checks.push({ id, expected, actual, pass })
    return pass
  }

  const timeline = () => {
    const events = []
    const sinks = {
      onStateChange: (state) => events.push({ kind: 'state', state, t: now() }),
      onConnected: (host) => events.push({ kind: 'connected', home: host.home, t: now() }),
    }
    return { events, sinks }
  }
  const statesOf = (events) => events.filter((e) => e.kind === 'state').map((e) => e.state)
  const connectedOf = (events) => events.filter((e) => e.kind === 'connected')

  // A source that reports ready after `readyMs`, then (when `loseAfterMs` is set)
  // ends the generation that long after opening; generation 3 onward stays up
  // until the controller aborts it.
  const makeSource = ({ gens, readyMs = 5, loseAfterMs = null }) => (signal, ready) => {
    gens.calls += 1
    const n = gens.calls
    let settled = false
    let resolveEnd
    const readyTimer = setTimeout(() => ready({ home: `p2t6-home-${n}` }), readyMs)
    const end = () => {
      if (settled) return
      settled = true
      clearTimeout(readyTimer)
      signal.removeEventListener('abort', onAbort)
      resolveEnd()
    }
    const onAbort = () => end()
    signal.addEventListener('abort', onAbort, { once: true })
    if (loseAfterMs !== null && n <= 2) setTimeout(end, loseAfterMs)
    return new Promise((resolve) => {
      resolveEnd = resolve
    })
  }

  async function r1() {
    const { events, sinks } = timeline()
    const gens = { calls: 0 }
    const cc = new ConnectionController(makeSource({ gens }), sinks, FAST)
    const t0 = now()
    cc.start()
    await until(() => connectedOf(events).length === 1, 3000, 'R1 connect')
    const stopT = now()
    cc.stop()
    await sleep(80)
    const afterStopBeforeRestart = events.filter((e) => e.t > stopT)
    // Restart after stop: the generation re-opens and onConnected fires again,
    // but no state event (lastState persists across stop, 'connected' dedupes).
    cc.start()
    await until(() => connectedOf(events).length === 2, 3000, 'R1 restart onConnected')
    cc.stop()
    const r = {
      connectedCount: connectedOf(events).length,
      homes: connectedOf(events).map((e) => e.home),
      states: statesOf(events),
      connectLatencyMs: connectedOf(events)[0].t - t0,
      eventsBetweenStopAndRestart: afterStopBeforeRestart.length,
      statesAfterRestart: events.filter((e) => e.t > stopT && e.kind === 'state').length,
      restartGenCall: gens.calls,
    }
    add('R1-single-connect', 1, connectedOf(events).filter((e) => e.t <= stopT).length)
    add('R1-home-fact', ['p2t6-home-1', 'p2t6-home-2'], r.homes)
    add('R1-state-sequence', ['connected'], r.states)
    add('R1-no-events-after-stop', 0, r.eventsBetweenStopAndRestart)
    add('R1-restart-refires-onconnected', 2, r.connectedCount)
    add('R1-restart-no-state-event', 0, r.statesAfterRestart)
    return r
  }

  async function r2() {
    const { events, sinks } = timeline()
    const gens = { calls: 0 }
    const cc = new ConnectionController(makeSource({ gens, readyMs: 5, loseAfterMs: 25 }), sinks, FAST)
    const t0 = now()
    cc.start()
    await until(() => connectedOf(events).length === 3, 5000, 'R2 third connect')
    await sleep(50)
    cc.stop()
    const states = statesOf(events)
    const reconnects = events.filter((e) => e.kind === 'state' && e.state === 'reconnecting')
    const connects = connectedOf(events)
    const i1 = connects[1].t - reconnects[0].t
    const i2 = connects[2].t - reconnects[1].t
    const r = {
      connectedCount: connects.length,
      homes: connects.map((e) => e.home),
      states,
      retryIntervalsMs: [i1, i2],
      genCalls: gens.calls,
      firstConnectMs: connects[0].t - t0,
    }
    add('R2-three-connects', 3, r.connectedCount)
    add('R2-homes', ['p2t6-home-1', 'p2t6-home-2', 'p2t6-home-3'], r.homes)
    add('R2-state-sequence', ['connected', 'reconnecting', 'connected', 'reconnecting', 'connected'], r.states)
    // Retry 1 cap 20ms (jittered 10..20), retry 2 cap 40ms (jittered 20..40).
    add('R2-interval1-lower', true, i1 >= 10 - 5)
    add('R2-interval1-upper', true, i1 <= 20 + 100)
    add('R2-interval2-lower', true, i2 >= 20 - 5)
    add('R2-interval2-upper', true, i2 <= 40 + 100)
    return r
  }

  async function r3() {
    const { events, sinks } = timeline()
    const gens = { calls: 0 }
    // A source that never reports ready; it settles on abort per the source contract.
    const neverReady = (signal, ready) => {
      void ready
      gens.calls += 1
      return new Promise((resolve) => {
        const onAbort = () => resolve()
        signal.addEventListener('abort', onAbort, { once: true })
      })
    }
    const cc = new ConnectionController(neverReady, sinks, FAST)
    const t0 = now()
    cc.start()
    await until(() => statesOf(events)[0] === 'reconnecting', 2000, 'R3 first reconnecting')
    const stopT = now()
    cc.stop()
    await sleep(120)
    const first = events[0]
    const r = {
      firstState: first?.state ?? null,
      firstStateMs: first?.t - t0 ?? null,
      connectedCount: connectedOf(events).length,
      eventsAfterStop: events.filter((e) => e.t > stopT).length,
      sourceGenerations: gens.calls,
    }
    add('R3-first-state-reconnecting', 'reconnecting', r.firstState)
    add('R3-ready-timeout-lower', true, r.firstStateMs >= 250 - 15)
    add('R3-ready-timeout-upper', true, r.firstStateMs <= 250 + 200)
    add('R3-zero-connects', 0, r.connectedCount)
    add('R3-no-events-after-stop', 0, r.eventsAfterStop)
    return r
  }

  async function r4() {
    const sinkCalls = { onStateChange: 0, onConnected: 0 }
    const sinks = {
      onStateChange: (state) => {
        sinkCalls.onStateChange += 1
        void state
        throw new Error('p2t6-deliberate-sink-failure')
      },
      onConnected: (host) => {
        sinkCalls.onConnected += 1
        void host
        throw new Error('p2t6-deliberate-sink-failure')
      },
    }
    const gens = { calls: 0 }
    const cc = new ConnectionController(makeSource({ gens, readyMs: 5, loseAfterMs: 25 }), sinks, FAST)
    cc.start()
    await until(() => gens.calls === 3, 6000, 'R4 third generation')
    await sleep(30)
    cc.stop()
    const r = { sinkCalls: { ...sinkCalls }, genCalls: gens.calls, controllerSurvived: gens.calls >= 3 }
    add('R4-three-generations', true, r.controllerSurvived)
    add('R4-state-sink-threw', true, sinkCalls.onStateChange >= 4)
    add('R4-connected-sink-threw', true, sinkCalls.onConnected >= 2)
    return r
  }

  async function r5() {
    const { events, sinks } = timeline()
    const gens = { calls: 0 }
    const cc = new ConnectionController(makeSource({ gens, readyMs: 5, loseAfterMs: 25 }), sinks, SLOW_BACKOFF)
    cc.start()
    await until(() => statesOf(events).includes('reconnecting'), 2000, 'R5 loss detected')
    const stopT = now()
    cc.stop() // backoff sleep is in [1000,2000]ms, so this lands inside it
    await sleep(300)
    const r = {
      states: statesOf(events),
      genCalls: gens.calls,
      eventsAfterStop: events.filter((e) => e.t > stopT).length,
    }
    await sleep(300)
    r.genCallsAfterQuiescence = gens.calls
    add('R5-exactly-one-generation', 1, r.genCalls)
    add('R5-state-sequence', ['connected', 'reconnecting'], r.states)
    add('R5-no-events-after-stop', 0, r.eventsAfterStop)
    add('R5-no-generation-after-quiescence', 1, r.genCallsAfterQuiescence)
    return r
  }

  void (async () => {
    try {
      out.scenarios.R1_happyPath = await r1()
      out.scenarios.R2_lossBackoffReconnect = await r2()
      out.scenarios.R3_readyTimeout = await r3()
      out.scenarios.R4_throwingSinks = await r4()
      out.scenarios.R5_stopDuringBackoff = await r5()
    } catch (error) {
      out.fatal = String(error?.message ?? error) + '\n' + String(error?.stack ?? '')
    } finally {
      out.checkSummary = {
        total: checks.length,
        passed: checks.filter((c) => c.pass).length,
        failedIds: checks.filter((c) => !c.pass).map((c) => c.id),
      }
      out.checks = checks
      out.done = true
      try {
        writeFileSync(join(obsDir, 'obs-reconnect.json'), JSON.stringify(out, null, 2))
      } catch (error) {
        out.fatal = (out.fatal ? out.fatal + '\n' : '') + `obs write failed: ${String(error)}`
      }
    }
  })()
}
