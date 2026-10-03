/**
 * run-budget.mjs — the rc2 real-host smoke kit's progress budgets.
 *
 * WHY BUDGETS AND NOT ONLY A WALL CLOCK
 *
 * A wall-clock timeout cannot tell "slow but progressing" from "looping". Run
 * 4 of the 0.2.0-rc.2 round produced ~1 800 model calls inside one 180 s wait:
 * the scripted chain could not read the host's request shape, `decide` kept
 * answering with the same branch, and the wall clock only reported the failure
 * minutes later. Each budget below is a statement about PROGRESS; every one of
 * them FAILS the run (a violation can never produce a pass), and no threshold
 * sits anywhere near the passing path.
 *
 * THE INTERLEAVINGS THIS DESIGN HAS TO SURVIVE (review finding, 2026-10-03):
 * a single global "same reply" streak is bypassable — one title dispatch or a
 * second session's turn in between resets it — and a total that is only checked
 * when a wait succeeds is bypassed by a storm inside one wait. So counters are
 * PER STATE KEY, and observation happens at REQUEST ENTRY, before any reply or
 * hit is produced:
 *
 *   totalRequests        whole-run model-call ceiling, counted in `decide`;
 *   perSessionRequests   ceiling for one session/purpose (the state key);
 *   perScenarioRequests  ceiling on NEW calls attributed to the scenario step
 *                        currently being waited for;
 *   sameStateRepeats     the same (state key, reply) answered N times in a row
 *                        for THAT key — interleaved traffic cannot mask it;
 *   consecutiveMisses    N waits timing out back to back;
 *   childLifetimeMs      the spawned host may not outlive the run budget.
 *
 * SIZING (why these numbers): a healthy run is LEG 0 discovery (1 call +1
 * title), B chain ≈ 6 calls, member turns 2-4, C chain + member 4-6, plus
 * 4-8 title/compaction side calls — about 20-30 calls. Ceilings are ≈4× that
 * envelope, so retries cannot trip them while a thousand-call loop cannot hide.
 */

import { createHash } from 'node:crypto'

export const DEFAULT_BUDGET = Object.freeze({
  totalRequests: 120,
  perSessionRequests: 40,
  perScenarioRequests: 25,
  sameStateRepeats: 6,
  consecutiveMisses: 2,
  childLifetimeMs: 20 * 60_000,
})

/**
 * A stable key for the conversation STATE a request belongs to: the purpose
 * (agent / title / compaction) plus a hash of the instruction (system text),
 * which distinguishes leader A from leader B from a worker, plus the number of
 * tool results already replayed. Two requests with the same key and the same
 * reply are the same step repeating — regardless of what other sessions asked
 * for in between.
 */
export function stateKeyOf({ purpose = 'unknown', systemText = '', toolResults = 0 } = {}) {
  const hash = createHash('sha1').update(String(systemText)).digest('hex').slice(0, 10)
  return `${purpose}|${hash}|${toolResults}`
}

export function createRunBudget(overrides = {}) {
  const limits = { ...DEFAULT_BUDGET, ...overrides }
  const state = {
    totalRequests: 0,
    scenarioLabel: null,
    scenarioRequests: 0,
    perSession: new Map(),
    perState: new Map(),
    lastStateReply: new Map(),
    consecutiveMisses: 0,
    violation: null,
    history: [],
  }
  const bump = (map, key) => {
    const next = (map.get(key) ?? 0) + 1
    map.set(key, next)
    return next
  }
  const record = (kind, detail) => {
    const violation = {
      kind,
      detail,
      totals: {
        totalRequests: state.totalRequests,
        scenarioLabel: state.scenarioLabel,
        scenarioRequests: state.scenarioRequests,
        consecutiveMisses: state.consecutiveMisses,
      },
    }
    state.history.push(violation)
    // First cause wins: the run aborts on it and the first violation is the one
    // that explains the failure. Later ones must never overwrite the report.
    if (state.violation === null) state.violation = violation
    return violation
  }
  return {
    limits,
    state,
    /**
     * Observe one model request AT ENTRY (before any reply is produced and
     * before any wait can take it as a hit). Returns a violation or null.
     */
    observeRequest(stateKey) {
      state.totalRequests += 1
      const sessionKey = String(stateKey).split('|').slice(0, 2).join('|')
      const sessionCount = bump(state.perSession, sessionKey)
      if (state.scenarioLabel !== null) state.scenarioRequests += 1
      if (state.totalRequests > limits.totalRequests) {
        return record('total-requests', `${state.totalRequests} model requests exceeded the ${limits.totalRequests} ceiling (a healthy run is ~20-30)`)
      }
      if (sessionCount > limits.perSessionRequests) {
        return record('session-requests', `session/purpose "${sessionKey}" issued ${sessionCount} requests, above the ${limits.perSessionRequests} per-session ceiling`)
      }
      if (state.scenarioLabel !== null && state.scenarioRequests > limits.perScenarioRequests) {
        return record('scenario-requests', `${state.scenarioRequests} new requests while waiting for "${state.scenarioLabel}", above the ${limits.perScenarioRequests} per-scenario ceiling`)
      }
      return null
    },
    /** Mark which scenario step the following requests belong to. */
    beginScenario(label) {
      state.scenarioLabel = label
      state.scenarioRequests = 0
    },
    /** End attribution (between waits). */
    endScenario() {
      state.scenarioLabel = null
      state.scenarioRequests = 0
    },
    /**
     * The reply handed to the host for `stateKey`. Repetition is measured PER
     * STATE KEY, so an interleaved title or sibling session cannot reset it.
     */
    noteReply(stateKey, sig) {
      bump(state.perState, stateKey)
      const last = state.lastStateReply.get(stateKey)
      const streak = last !== undefined && last.sig === sig ? last.streak + 1 : 1
      state.lastStateReply.set(stateKey, { sig, streak })
      if (streak >= limits.sameStateRepeats) {
        return record('same-state-repeat', `state "${stateKey}" answered the same reply ${streak}× in a row (${String(sig).slice(0, 160)}) — that step is not advancing`)
      }
      return null
    },
    noteWaitMiss(label) {
      state.consecutiveMisses += 1
      if (state.consecutiveMisses >= limits.consecutiveMisses) {
        return record('consecutive-misses', `${state.consecutiveMisses} consecutive mock waits timed out (last: "${label}") — failing fast instead of spending the remaining legs' timeouts`)
      }
      return null
    },
    noteWaitHit() {
      state.consecutiveMisses = 0
    },
    /** The spawned child may not outlive the run's own budget. */
    noteChildLifetime(elapsedMs) {
      if (elapsedMs > limits.childLifetimeMs) {
        return record('child-lifetime', `host child alive ${Math.round(elapsedMs / 1000)}s, above the ${Math.round(limits.childLifetimeMs / 1000)}s run budget`)
      }
      return null
    },
    violation: () => state.violation,
    snapshot: () => ({
      totalRequests: state.totalRequests,
      scenarioLabel: state.scenarioLabel,
      scenarioRequests: state.scenarioRequests,
      consecutiveMisses: state.consecutiveMisses,
      perSession: Object.fromEntries(state.perSession),
      perState: Object.fromEntries(state.perState),
      history: state.history,
    }),
  }
}
