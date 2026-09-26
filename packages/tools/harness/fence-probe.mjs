/**
 * fence-probe.mjs — Phase 0 characterization probe row for the 0.1.7-rc.1
 * Team Session Activation Fence spike (restart-recovery guide §9).
 *
 * PURPOSE (characterization only — NOT production code, NOT part of the
 * product install surface):
 *
 *   1. Record every `agent/created` (source, session, agentId) and
 *      `agent/disposed` (session, agentId) on the GLOBAL event bus — the
 *      exact events the C1 fence would see (one EventsService instance is
 *      shared by every context; `{ global: true }` listeners bypass the
 *      per-fiber context filter — cordis vendor events.ts dispatch()).
 *
 *   2. Simulate the C1 fence veto: when `config.reject === true` AND the
 *      row is ARMED (runtime flag or `config.autoArm`) AND the activating
 *      session is one of `config.teamSessions`, the `agent/created`
 *      listener REJECTS with the production error wording. By cordis serial
 *      semantics + AgentRegistry.announce(), a listener rejection rejects
 *      the whole create/resume and triggers the stock AgentLoop rollback
 *      (write handle close + registry detach + `agent/disposed`).
 *
 *   `autoArm: true` arms the fence at row load — BEFORE the stock host's
 *   boot-time session re-adoption (run 8: the stock host re-adopts every
 *   previously-live session at boot, source=resume — the writer steal is
 *   a boot-time event, not only a browser-follow event).
 *
 *   The one-shot permit (`POST /__fence/permit`) mirrors the production
 *   owned-guard pass-through: the Team glue's own activation (ensureRootLive
 *   / its boot re-adoption) consumes exactly one pass for its session.
 *
 *   3. Record every `api-session/error` remote event (the SessionController
 *      promote() error surface) — the wire-level payload the browser
 *      receives through the $events stream.
 *
 * Control plane (browser-facing, cookie-gated like every web route):
 *   GET  /__fence/health          → { ok, reject, armed, teamSessions, events }
 *   GET  /__fence/events          → the recorded event log
 *   POST /__fence/armed           → body { armed: boolean }
 *
 * Every event is also appended to `<config.reportDir>/fence-probe-events.jsonl`
 * for post-mortem evidence.
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const name = 'team-restart-fence-probe'
export const inject = ['webServer']

/** Read a bounded JSON body off a node http request. */
function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1024 * 1024) { req.destroy(); return }
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', () => resolve(data))
  })
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(body)
}

export async function apply(ctx, config) {
  const rejectEnabled = config?.reject === true
  const teamSessions = new Set(Array.isArray(config?.teamSessions) ? config.teamSessions : [])
  const reportDir = typeof config?.reportDir === 'string' ? config.reportDir : undefined
  if (reportDir !== undefined) mkdirSync(reportDir, { recursive: true })

  // autoArm arms at row load — before the stock host's boot-time re-adoption.
  const state = { armed: config?.autoArm === true, permits: new Set(), events: [] }
  const record = (event) => {
    const row = { t: new Date().toISOString(), ...event }
    state.events.push(row)
    if (state.events.length > 500) state.events.shift()
    if (reportDir !== undefined) {
      try {
        appendFileSync(join(reportDir, 'fence-probe-events.jsonl'), JSON.stringify(row) + '\n')
      } catch { /* evidence is best-effort */ }
    }
  }
  if (state.armed) record({ kind: 'armed', armed: true, source: 'autoArm' })

  // The C1-shaped guard: awaited serial listener on the agent carrier.
  ctx.on('agent/created', async (payload) => {
    const agent = payload?.agent
    const sessionId = typeof agent?.id === 'string' ? agent.id : null
    const source = payload?.source
    // The 0.1.7 Agent exposes `id` (the session id) — not `agentId`; fall
    // back so the generation identity is recorded (run-5 events had
    // agentId: null because only `agentId` was read).
    const agentId = typeof agent?.agentId === 'string' ? agent.agentId : (typeof agent?.id === 'string' ? agent.id : null)
    // One-shot pass for the session (the production owned-guard emulation):
    // consumed by the next activation of that session only.
    const permitted = sessionId !== null && state.permits.has(sessionId)
    if (permitted) state.permits.delete(sessionId)
    const veto = rejectEnabled && state.armed && !permitted && sessionId !== null && teamSessions.has(sessionId)
    record({ kind: 'agent/created', sessionId, source, agentId, veto, permitted })
    if (veto) {
      // Production wording (guide §8.1) — stable and greppable.
      throw new Error(`dsh-agent-team: intercepted foreign Agent activation for Team-managed session "${sessionId}"`)
    }
  }, { global: true })

  // Rollback completion signal (the C1 rollback barrier).
  ctx.on('agent/disposed', (payload) => {
    const agent = payload?.agent
    record({
      kind: 'agent/disposed',
      sessionId: typeof agent?.id === 'string' ? agent.id : null,
      agentId: typeof agent?.agentId === 'string' ? agent.agentId : (typeof agent?.id === 'string' ? agent.id : null),
    })
  }, { global: true })

  // The SessionController promote() error surface (wire payload the
  // browser receives on the $events stream).
  ctx.on('api-session/error', (sessionId, message) => {
    record({ kind: 'api-session/error', sessionId: String(sessionId), message: String(message) })
  }, { global: true })

  const webServer = ctx.get('webServer')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__fence/health',
    handler: (req, res) => {
      sendJson(res, 200, {
        ok: true,
        reject: rejectEnabled,
        armed: state.armed,
        teamSessions: [...teamSessions],
        permits: [...state.permits],
        events: state.events.length,
      })
    },
  }), 'fence-probe health route')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__fence/events',
    handler: (req, res) => {
      sendJson(res, 200, { ok: true, events: state.events })
    },
  }), 'fence-probe events route')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__fence/permit',
    handler: async (req, res) => {
      try {
        const body = JSON.parse((await readBody(req)) || '{}')
        if (typeof body.sessionId === 'string') state.permits.add(body.sessionId)
        record({ kind: 'permit', sessionId: typeof body.sessionId === 'string' ? body.sessionId : null })
        sendJson(res, 200, { ok: true, permits: [...state.permits] })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
      }
    },
  }), 'fence-probe permit route')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__fence/armed',
    handler: async (req, res) => {
      try {
        const body = JSON.parse((await readBody(req)) || '{}')
        state.armed = body.armed === true
        record({ kind: 'armed', armed: state.armed })
        sendJson(res, 200, { ok: true, armed: state.armed })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
      }
    },
  }), 'fence-probe armed route')
}
