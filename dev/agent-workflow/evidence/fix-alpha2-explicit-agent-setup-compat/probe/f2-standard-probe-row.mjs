/**
 * F2 — standard-preset A/B/C surface probe ROW (PR #17 review follow-up,
 * instruction F2; memo in
 * evidence/fix-alpha2-explicit-agent-setup-compat/
 * pr17-review-followup-instructions.md).
 *
 * A PURE OBSERVER cordis row, mounted through the public profile-patch
 * seam on the real 0.1.5-rc.2 host (the same seam the F1 probe row and
 * the a2x smoke kit use — CORE PATCH BUDGET = 0). It:
 *
 *   - writes a ready marker file when its apply settles (the runner's
 *     boot gate — the row is live before any team agent is composed);
 *
 *   - listens for the PUBLIC `agent/created` and `tools/change` events.
 *     Listener eligibility: dsh-scope's carrier filter admits UNTAGGED
 *     listener contexts globally (`scopeOf(ctx) === undefined -> true`),
 *     and this row's context carries no scope tag — so the row receives
 *     every agent's creation event regardless of the agent's scope key
 *     (the same delivery path the shipped dsh-tool-subagent deferred
 *     installer relies on, dsh-tool-subagent lib/index.js
 *     `ctx.on("agent/created", ...)`);
 *
 *   - snapshots the agent-scoped tool surface through the public
 *     `tools.schemas(agent)` seam — the SAME seam the alpha.2 Permission
 *     Coverage Gate reads (agent-bindings.mjs `coverageSurfaceNames`) —
 *     at, per created agent:
 *       `created-sync`     — synchronously inside the announce dispatch,
 *                            BEFORE the shipped subagent row's deferred
 *                            own-layer install runs later in the same
 *                            synchronous dispatch (listener order: this
 *                            row registered at host boot, before any
 *                            per-agent preset composition);
 *       `created-microtask`— one microtask after the dispatch (the
 *                            deferred installs are plain-function
 *                            effects — synchronous within the dispatch);
 *       `created-250ms` / `created-2s` — settling windows;
 *       `tools/change-N`  — re-snapshot on every public tools change;
 *       `rescan-N`        — a 1s-interval `agents.list()` re-scan for
 *                            the first 60s (catches an install that
 *                            fires no event).
 *
 *   - appends one JSON line per snapshot to `config.outputPath`.
 *
 * The row NEVER grants, registers, restricts, or mutates anything: no
 * service provides beyond the row identity, no `tools.*` call beyond the
 * read-only `schemas()`, no webServer reads, no property reads it cannot
 * resolve through the strict `ctx.get` seam.
 *
 * Note on the A moment: the Coverage Gate reads `tools.schemas(agent)`
 * DURING agent composition (the AgentSetup callback), which precedes the
 * `publish()` -> `agents.announce(agent)` step that dispatches
 * `agent/created` (dsh-agent-loop `publish` callback). This row
 * therefore cannot snapshot the exact gate instant — the gate's outcome
 * (pass vs the typed KNOWN_SENSITIVE_UNMANAGED failure) is the A
 * evidence; `created-sync` is the closest observable proxy (the surface
 * right before any post-announce own-layer install).
 */
import { appendFileSync, writeFileSync } from 'node:fs'

export const name = 'f2-standard-probe'
export const inject = []

export function apply(ctx, config) {
  const outputPath = String(config?.outputPath ?? '')
  const readyPath = String(config?.readyPath ?? '')
  const rescanMs = Number(config?.rescanMs ?? 1000)
  const rescanCount = Number(config?.rescanCount ?? 60)
  if (outputPath === '') throw new Error('f2-standard-probe: config.outputPath is required')

  // Strict gets (no inject declarations — the F1 probe established the
  // strict read is topology-independent on 0.1.5-rc.2). LAZY by design:
  // a sibling row's service may not be provided yet when THIS row's apply
  // runs (row fibers apply in parallel) — every snapshot re-reads.
  const getTools = () => ctx.get('tools')
  const getAgents = () => ctx.get('agents')

  const line = (obj) => {
    try {
      appendFileSync(outputPath, JSON.stringify(obj) + '\n')
    } catch { /* evidence best-effort — never break the host */ }
  }
  const now = () => Date.now()

  /** Snapshot one agent's agent-scoped surface through the public seam. */
  const record = (label, agent) => {
    let surface
    try {
      const tools = getTools()
      if (tools === null || tools === undefined || typeof tools.schemas !== 'function') {
        surface = { error: 'tools service unavailable (or no schemas seam) at snapshot time' }
      } else {
        const schemas = tools.schemas(agent)
        surface = {
          tools: (Array.isArray(schemas) ? schemas : [])
            .map((s) => (s === null || typeof s !== 'object' ? undefined : s.name))
            .filter((n) => typeof n === 'string')
            .sort(),
        }
      }
    } catch (error) {
      surface = { error: String(error?.message ?? error) }
    }
    const agentId = agent === null || typeof agent !== 'object' ? null : agent.id
    const sessionId = agent === null || typeof agent !== 'object'
      ? null
      : (agent.session === null || typeof agent.session !== 'object' ? null : agent.session.id)
    line({
      t: now(),
      label,
      agentId: agentId === undefined ? null : String(agentId),
      sessionId: sessionId === undefined ? null : String(sessionId),
      ...surface,
    })
  }

  const known = new Set()

  ctx.on('agent/created', ({ agent }) => {
    known.add(agent)
    record('created-sync', agent)
    queueMicrotask(() => record('created-microtask', agent))
    const t250 = setTimeout(() => record('created-250ms', agent), 250)
    if (typeof t250.unref === 'function') t250.unref()
    const t2s = setTimeout(() => record('created-2s', agent), 2000)
    if (typeof t2s.unref === 'function') t2s.unref()
  })

  let changeSeq = 0
  ctx.on('tools/change', () => {
    changeSeq += 1
    for (const agent of known) record(`tools/change-${changeSeq}`, agent)
  })

  // The 1s-interval re-scan window (public agents.list() — the same seam
  // the shipped subagent reconciler uses). LAZY `agents` for the same
  // reason as `tools` (a sibling row's service may postdate this apply).
  // Every scan writes a heartbeat line so silence in the timeline means
  // the timer died, not that the scan was empty.
  let scan = 0
  const timer = setInterval(() => {
    scan += 1
    let list = []
    let agentsState = 'ok'
    try {
      const agents = getAgents()
      if (agents === null || agents === undefined || typeof agents.list !== 'function') {
        agentsState = 'unavailable'
      } else {
        list = agents.list()
      }
    } catch (error) {
      agentsState = `error: ${String(error?.message ?? error)}`
    }
    for (const agent of Array.isArray(list) ? list : []) {
      const isNew = !known.has(agent)
      if (isNew) known.add(agent)
      record(isNew ? 'rescan-new-agent' : `rescan-${scan}`, agent)
    }
    line({
      t: now(),
      label: `rescan-heartbeat-${scan}`,
      agentsState,
      listed: Array.isArray(list) ? list.length : 0,
    })
    if (scan >= rescanCount) clearInterval(timer)
  }, rescanMs)
  if (typeof timer.unref === 'function') timer.unref()

  line({ t: now(), label: 'row-applied', rescanMs, rescanCount })
  if (readyPath !== '') {
    try {
      writeFileSync(readyPath, JSON.stringify({ t: now(), name }) + '\n')
    } catch { /* evidence best-effort */ }
  }
}
