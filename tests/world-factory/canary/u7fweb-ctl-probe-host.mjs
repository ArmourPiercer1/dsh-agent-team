/**
 * u7fweb-ctl-probe-host.mjs — the U7-f C2 read-only Control-lane probe row
 * (test-only, zero authority). Cloned from the proven u74a probe: same
 * forward, same caps; only the route prefix differs.
 *
 * The U7-f web-Family World needs a SECOND, INDEPENDENT public read
 * of the durable Control lane while the runner (playing the Human-User role)
 * drives `team.resolveControl` from the outside: the p6t6 observer is one
 * such face, this row is the second — if the two ever disagree, the
 * discrepancy is itself evidence. The row registers TWO routes through the
 * public `webServer` seam and NOTHING else:
 *
 *   GET /__u7fweb/health                  → { ok: true }
 *   GET /__u7fweb/controls?session=<sid>  → { ok, requests: [
 *       { requestId, kind, status, summary(<=180 chars) } ] }
 *
 * The controls route is a THIN forward over the production control service
 * (`teamRoot.control.listControlState(session)`), the same face the p6t6
 * /__p6t6/state route consumes; a missing service or an unreadable session
 * answers `{ ok: false, code }` (never a throw, never a raw 500). The row
 * mutates NOTHING, resolves NOTHING, and handles NO tokens — the summary is
 * truncated text only (the lane carries no secrets, but the row keeps the
 * byte cap anyway; a probe that can grow its own output is not a probe).
 *
 * Registration form mirrors tests/world-factory/canary/u6-arc-d-probe-host.mjs
 * exactly: named exports `name`/`inject`, `apply(ctx)` with every route
 * inside `ctx.effect(...)` so the routes die with the row. The `inject`
 * names follow the p6t6 precedent (packages/tools/harness/plugin.mjs): the
 * fiber parks while `webServer` or the production row's `teamRoot` facade is
 * absent, so this row can never apply before the services it forwards exist.
 * The row mounts by file URL through the profile-patch row face (the
 * production `dsh-agent-team` row is the precedent) — see assembly
 * teamRows(); no factory edit, no profileDir copy.
 *
 * @module tests/world-factory/canary/u7fweb-ctl-probe-host
 */

/** Cordis row identity (function-plugin protocol: named exports, no default). */
export const name = 'u7fweb-ctl-probe-host'

/**
 * Dependency parking (the p6t6-measured law): the apply body runs only once
 * BOTH the host's `webServer` and the production row's `teamRoot` facade
 * exist — this probe forwards to the latter, so it waits for it.
 */
export const inject = ['webServer', 'teamRoot']

const SUMMARY_CAP = 180

/** @param {import('node:http').ServerResponse} res @param {number} status @param {object} body */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

/** The control-service face this row forwards to; null = absent/not-a-function. */
function controlFace(teamRoot) {
  const fn = teamRoot?.control?.listControlState
  return typeof fn === 'function' ? fn.bind(teamRoot.control) : null
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    throw new Error('u7fweb-ctl-probe: the webServer service is missing despite the inject declaration (realm isolation or a malformed row config)')
  }
  const teamRoot = ctx.get('teamRoot')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__u7fweb/health',
    handler: (req, res) => {
      sendJson(res, 200, { ok: true })
    },
  }, 'u7fweb health route'))

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__u7fweb/controls',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, code: 'GET-only', requests: [] })
        return
      }
      const list = controlFace(teamRoot)
      if (list === null) {
        // service absent → {ok:false,code} (the health route stays truthful:
        // the row is up, the control face is not).
        sendJson(res, 200, { ok: false, code: 'team-root-service-absent', requests: [] })
        return
      }
      let session = null
      try {
        session = new URL(req.url ?? '/', 'http://u7fweb-probe.invalid').searchParams.get('session')
      } catch {
        session = null
      }
      if (typeof session !== 'string' || session === '') {
        sendJson(res, 200, { ok: false, code: 'session-required', requests: [] })
        return
      }
      try {
        const state = await list(session)
        // Row identities + status ONLY (never tokens, never payload bodies):
        // exactly what the runner needs to find pending ask rows and settle
        // them OUTSIDE this row through the public v4 seam.
        const requests = (state?.requests ?? []).map((r) => ({
          requestId: String(r?.requestId ?? ''),
          kind: r?.kind ?? null,
          status: String(r?.status ?? ''),
          summary: String(r?.summary ?? '').slice(0, SUMMARY_CAP),
        }))
        sendJson(res, 200, { ok: true, requests })
      } catch (error) {
        // Absent/unreadable session (TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND and
        // friends) is an honest {ok:false,code} answer, never a throw.
        sendJson(res, 200, {
          ok: false,
          code: String(error?.code ?? error?.name ?? error?.message ?? 'control-list-failed').slice(0, 80),
          requests: [],
        })
      }
    },
  }, 'u7fweb controls route'))
}
