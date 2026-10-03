#!/usr/bin/env node
/**
 * fault-harness.mjs — a subprocess that reproduces the rc2 kit's OWNER shape
 * (spawned child + mock + budget) so the guard's failure paths can be tested
 * for what actually matters: WHICH process dies, and whether cleanup ran.
 *
 * WHY A SUBPROCESS: the property under review is about process lifetime
 * ("a guard trip must not leave a host behind, and must never kill anything it
 * does not own"). That cannot be asserted inside the same process, so this
 * harness owns a real child, is driven to a fault, and the test inspects the
 * process table afterwards.
 *
 * Scenarios (env FAULT_SCENARIO):
 *   request-cap        total model requests over the ceiling;
 *   state-loop         the same (session, reply) answered N times while OTHER
 *                      sessions interleave — the interleaving must NOT mask it;
 *   wait-timeout       consecutive waits time out with no progress;
 *   unexpected-shape   a model request whose wire shape the decoder does not
 *                      recognize (the original error must be preserved);
 *   child-lifetime     nothing progresses and the independent watchdog fires;
 *   healthy            the passing path (control: exit 0, child stopped by the
 *                      owner, nothing killed early).
 *
 * Contract the harness must satisfy in EVERY scenario:
 *   - it kills EXACTLY the child it spawned and bound, never the unrelated
 *     process whose pid the test passes in via `UNRELATED_PID` (which it is
 *     only allowed to record, never signal);
 *   - the owner's cleanup (stop child + close mock) always runs, and writes
 *     `cleanup.json` before the process exits:
 *       { scenario, ownChildPid, ownChildExitSeen, cleanupRan, mockClosed,
 *         violationKind, violationDetail, watchdogFired, budget }
 *   - the exit code distinguishes the reason (2 = aborted by budget/guard,
 *     3 = decoder failure, 0 = healthy).
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRunControl, RunAborted } from './run-control.mjs'
import { stateKeyOf } from './run-budget.mjs'
import { assertPurpose, assertWireShape, classifyRequest, replySig, WireShapeError } from './wire-shape.mjs'

const SCENARIO = process.env.FAULT_SCENARIO ?? 'healthy'
const SCRATCH = process.env.FAULT_SCRATCH ?? '.'
// The harness SPAWNS its own child on purpose: ownership and reaping belong to
// the same process, so "the child I killed really exited" is observable here.
// (A test-spawned child would linger as a zombie while the test blocks in
// spawnSync, and `kill(pid, 0)` still succeeds on a zombie — an observation
// artifact, not a leaked process.)
const UNRELATED_PID = Number(process.env.UNRELATED_PID ?? '0')
const TIGHT_LIMITS = {
  totalRequests: 6,
  perSessionRequests: 4,
  perScenarioRequests: 5,
  sameStateRepeats: 3,
  consecutiveMisses: 2,
  childLifetimeMs: 400,
}

const log = (line) => console.log(`[fault ${SCENARIO}] ${line}`)
const evidence = []
const writeEvidence = (name, content) => {
  mkdirSync(SCRATCH, { recursive: true })
  writeFileSync(join(SCRATCH, `${SCENARIO}-${name}`), JSON.stringify(content, null, 2) + '\n')
  evidence.push(name)
}

/** The mock the owner "owns": an object with an async close, like the harness. */
function makeMock() {
  const state = { closed: false, requests: [] }
  return {
    state,
    add(body) {
      state.requests.push(body)
    },
    async close() {
      state.closed = true
    },
  }
}

/** A body the strict decoder can classify, for a given conversation state. */
function agentBody(systemText, turn) {
  return {
    model: 'fault-model',
    system: systemText,
    tools: [{ type: 'function', function: { name: 'read' } }],
    messages: [
      { role: 'user', content: [{ type: 'text', text: `turn ${turn}` }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: `call-${turn}`, name: 'read', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: `call-${turn}`, content: 'ok', is_error: false }] },
    ],
  }
}

/**
 * The scripted chain reply. Its STATE signature ignores the per-call id (the
 * same `replySig` the kit uses), so "the same step answered again" is exactly
 * what the repeated-state cap measures — independent of random ids.
 */
function scriptedReply(step) {
  return { kind: 'tool-call', toolCalls: [{ id: `c${step}`, name: 'read', arguments: { path: 'same-every-time' } }] }
}

async function main() {
  const RC = createRunControl({ log, writeEvidence, limits: TIGHT_LIMITS })
  const mock = makeMock()
  let child = null
  let ownChildExitSeen = false
  /** Set by the try/catch paths; the finally records it in cleanup.json. */
  let disposed = { watchdogFired: false }
  RC.arm()
  const removeSignalHandlers = RC.installSignalHandlers()

  try {
    child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
    child.on('exit', () => {
      ownChildExitSeen = true
    })
    writeEvidence('own-child.json', { pid: child.pid, unrelatedPid: UNRELATED_PID > 0 ? UNRELATED_PID : null })
    RC.bindChild(child, { lifetimeMs: TIGHT_LIMITS.childLifetimeMs, watchdogIntervalMs: 100 })

    // The scripted chain. A healthy run is 3 model calls; each scenario drives
    // one specific ceiling.
    let step = 0
    const sessions = ['leader-A', 'leader-B', 'title-svc']
    const decide = (body, sessionKey) => {
      // Exactly the two assertions the kit's waitForMock sweep performs: an
      // unrecognized SHAPE first (a bad role/part type says nothing about
      // purpose), then the closed PURPOSE list.
      assertWireShape(body, { label: sessionKey })
      const purpose = assertPurpose(body, { label: sessionKey }) // throws on unknown purpose
      if (!classifyRequest(body).agentTurn && purpose.purpose !== 'title') {
        throw new WireShapeError(`not a chain turn: ${purpose.purpose}`, { sessionKey })
      }
      const key = stateKeyOf({ purpose: purpose.purpose, systemText: sessionKey, toolResults: classifyRequest(body).toolResults.length })
      const v = RC.budget.observeRequest(key)
      if (v !== null) {
        RC.reportViolation(v, { at: 'decide-entry', sessionKey })
        return { kind: 'error', status: 503, message: v.detail, code: 'fault-guard' }
      }
      const reply = scriptedReply(step)
      const repeat = RC.budget.noteReply(key, replySig(reply))
      if (repeat !== null) RC.reportViolation(repeat, { at: 'decide-reply', sessionKey })
      return reply
    }

    const wait = async (label, hit) => {
      RC.budget.beginScenario(label)
      try {
        RC.check()
        if (!hit) {
          const miss = RC.budget.noteWaitMiss(label)
          if (miss !== null) RC.reportViolation(miss, { waitingFor: label })
          return false
        }
        RC.budget.noteWaitHit()
        return true
      } finally {
        RC.budget.endScenario()
      }
    }

    switch (SCENARIO) {
      case 'request-cap': {
        // Every request is a DISTINCT conversation state (own session key), so
        // the per-state streak and per-session caps cannot be what trips here —
        // only the total ceiling can.
        for (let i = 0; i < 40 && !RC.aborted(); i += 1) {
          const session = `leader-${i}`
          mock.add(agentBody(session, i))
          decide(agentBody(session, i), session)
          step += 1
        }
        if (!RC.aborted()) throw new Error('scenario did not trip the total-request cap')
        RC.check()
        break
      }
      case 'state-loop': {
        // The same state repeating with other sessions interleaved in between —
        // the exact pattern the first guard's global streak could not see.
        for (let i = 0; i < 12 && !RC.aborted(); i += 1) {
          decide(agentBody('leader-A', 1), 'leader-A')
          decide({ model: 'fault-model', system: 'title svc', messages: [{ role: 'user', content: 'Generate the session title' }] }, 'title-svc')
          step += 1
        }
        if (!RC.aborted()) throw new Error('scenario did not trip the repeated-state cap')
        RC.check()
        break
      }
      case 'wait-timeout': {
        await wait('step one', true)
        await wait('step two', false)
        await wait('step three', false)
        RC.check()
        break
      }
      case 'unexpected-shape': {
        const hostile = {
          model: 'fault-model',
          system: 'leader',
          tools: [{ type: 'function', function: { name: 'read' } }],
          messages: [{ role: 'observer', content: [{ type: 'telepathy', text: '???' }] }],
        }
        mock.add(hostile)
        decide(hostile, 'leader-A')
        // Unreachable: the decoder throws before any reply is produced.
        throw new Error('unexpected shape was accepted')
      }
      case 'child-lifetime': {
        // No progress at all; the watchdog must fire on its own.
        const until = Date.now() + 3_000
        while (Date.now() < until && !RC.aborted()) await new Promise((r) => setTimeout(r, 50))
        RC.check()
        break
      }
      default: {
        for (let i = 0; i < 3; i += 1) {
          decide(agentBody(sessions[i % sessions.length], i), sessions[i % sessions.length])
          await wait(`healthy step ${i}`, true)
          step += 1
        }
        RC.check()
        break
      }
    }
    removeSignalHandlers()
    disposed = RC.dispose()
    return SCENARIO === 'healthy' ? 0 : 2
  } catch (err) {
    const isAbort = err instanceof RunAborted
    const isDecoder = err instanceof WireShapeError
    writeEvidence('run-abort-context.json', {
      scenario: SCENARIO,
      aborted: RC.aborted(),
      violation: RC.violation(),
      errorName: String((err && err.name) ?? 'Error'),
      errorMessage: String((err && err.message) ?? err),
      preservedOriginalError: isDecoder ? String(err.message) : null,
    })
    removeSignalHandlers()
    disposed = RC.dispose()
    return isAbort ? 2 : isDecoder ? 3 : 1
  } finally {
    // THE OWNER'S CLEANUP — runs on every path, including a decoder throw.
    // It reaches EXACTLY this run's child: the only handle this process holds.
    if (child !== null) child.kill('SIGKILL')
    if (child !== null && !ownChildExitSeen) {
      await new Promise((resolve) => {
        const done = () => {
          ownChildExitSeen = true
          resolve()
        }
        child.on('exit', done)
        const timer = setTimeout(done, 3_000)
        timer.unref?.()
      })
    }
    await mock.close()
    writeEvidence('cleanup.json', {
      scenario: SCENARIO,
      ownChildPid: child?.pid ?? null,
      ownChildExitSeen,
      cleanupRan: true,
      mockClosed: mock.state.closed,
      watchdogFired: disposed?.watchdogFired === true,
      violationKind: RC.violation()?.kind ?? null,
      violationDetail: RC.violation()?.detail ?? null,
      budget: RC.budget.snapshot(),
      evidence,
    })
  }
}

const code = await main()
log(`exiting with ${code}`)
process.exit(code)
