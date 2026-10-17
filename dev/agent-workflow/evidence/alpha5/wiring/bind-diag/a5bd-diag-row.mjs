/**
 * a5bd-diag-row.mjs — the BIND-DIAG kit's READ-ONLY OBSERVER row.
 *
 * Mounted as a plain plugin row through the public profile-patch seam (the
 * same seam the p6t6 observer uses). It contains NO governance logic: it never
 * calls `tools.guard`, never registers or restricts a tool, never grants
 * anything. It answers ONE question with host facts, read at the SAME public
 * seams the production A5 assembly reads:
 *
 *   which names does `tools.schemas()` (NO scope — the trusted GLOBAL native
 *   view the Guard's `nativeNames` is derived from, agent-bindings.mjs) show,
 *   which names does `tools.schemas(agent)` show for one governed Agent, and
 *   does `tools.get(name)` (global) resolve to the SAME definition object as
 *   `tools.get(name, agent)` — the exact R-a comparison the closed-world Guard
 *   performs at bind time (tool-dispatch/install.ts publish()).
 *
 * The agent handle for the scoped reads comes from the production row's OWN
 * durable-facts face (`teamRoot.live.permissionNoticeReceipt.liveHandle` —
 * read-only, pair→agent, no wake, no derivation), so the scoped view measured
 * here is the governed Agent's real scope chain, not a substitute.
 *
 * Routes:
 *   GET /__a5bd/health                          → { ok, tools: 'resolved' }
 *   GET /__a5bd/facts?names=a,b&team=..&member=.. → the three-face facts
 *
 * @module evidence/alpha5/wiring/bind-diag/a5bd-diag-row
 */
export const name = 'a5bd-diag'

/** Parking: the fiber stays INACTIVE until all three exist (verified Cordis
 *  semantics — an absent inject target never half-applies this row). */
export const inject = ['webServer', 'teamRoot', 'tools']

const DEFAULT_NAMES = ['bash', 'read', 'write', 'edit', 'read_image', 'job_list', 'job_output', 'job_kill']

export async function apply(ctx) {
  const webServer = ctx.get('webServer')
  const teamRoot = ctx.get('teamRoot')
  const tools = ctx.get('tools')
  const observations = []

  const safe = (label, read) => {
    try {
      return { ok: true, value: read() }
    } catch (error) {
      const detail = String(error?.message ?? error).slice(0, 200)
      observations.push(`a5bd-diag: read '${label}' threw: ${detail}`)
      return { ok: false, detail }
    }
  }

  const namesOf = (schemasRead) => {
    if (!schemasRead.ok || !Array.isArray(schemasRead.value)) return null
    return schemasRead.value.map((row) => String(row?.name ?? '')).filter((n) => n !== '').sort()
  }

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5bd/health',
    handler: (_req, res) => {
      let liveSessions = null
      try { liveSessions = teamRoot?.live?.listLiveSessions?.() ?? null } catch { /* observer never throws */ }
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, tools: typeof tools?.schemas === 'function' ? 'resolved' : 'MISSING', liveSessions, observations: observations.slice(-20) }))
    },
  }, 'a5bd diag health'))

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5bd/members',
    handler: (req, res) => {
      // The durable member rows of ANY addressed team, read through the SAME
      // public repositories face the p6t6 harness reads (its own state route is
      // keyed to the boot anchor's root session only). Read-only projection.
      const url = new URL(req.url, 'http://x')
      const team = url.searchParams.get('team') ?? ''
      const r = safe('memberInstances.list', () => teamRoot?.domain?.repositories?.memberInstances?.list?.(team) ?? [])
      const members = r.ok ? (r.value ?? []).map((m) => ({
        instanceId: String(m.instanceId),
        templateId: String(m.templateId),
        label: String(m.label),
        childSessionId: String(m.childSessionId),
        lifecycle: String(m.lifecycle),
      })) : []
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ team, members, readOk: r.ok }))
    },
  }, 'a5bd diag members'))

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5bd/facts',
    handler: (req, res) => {
      const url = new URL(req.url, 'http://x')
      const names = (url.searchParams.get('names') ?? DEFAULT_NAMES.join(',')).split(',').map((n) => n.trim()).filter((n) => n !== '')
      const team = url.searchParams.get('team')
      const member = url.searchParams.get('member')

      // FACE 1 — the GLOBAL view: the exact read `nativeNames` is derived from
      // (agent-bindings.mjs: `agentCtx.tools.schemas()` with NO scope).
      const globalNames = namesOf(safe('tools.schemas()', () => tools.schemas()))
      const globalDefs = {}
      for (const n of names) {
        const r = safe(`tools.get("${n}")`, () => tools.get(n))
        globalDefs[n] = r.ok && r.value !== undefined && r.value !== null
      }

      // FACE 2/3 — the AGENT-scoped view + the R-a identity comparison, for the
      // durable pair the kit addressed (leader = ('inst-leader'), members by
      // their durable instanceId). The handle comes ONLY from the production
      // row's durable-facts receipt face; absent/cold reads null (never wakes).
      let scoped = null
      if (typeof team === 'string' && typeof member === 'string' && team.length > 0 && member.length > 0) {
        const handleRead = safe('liveHandle', () => teamRoot?.live?.permissionNoticeReceipt?.liveHandle?.({
          teamSessionId: team, memberInstanceId: member,
        }))
        const agent = handleRead.ok ? handleRead.value?.agent : undefined
        if (agent !== undefined) {
          const scopedNames = namesOf(safe('tools.schemas(agent)', () => tools.schemas(agent)))
          const perName = {}
          for (const n of names) {
            const g = safe(`tools.get("${n}")`, () => tools.get(n))
            const s = safe(`tools.get("${n}", agent)`, () => tools.get(n, agent))
            const gDef = g.ok ? g.value : undefined
            const sDef = s.ok ? s.value : undefined
            perName[n] = {
              globalPresent: gDef !== undefined && gDef !== null,
              scopedPresent: sDef !== undefined && sDef !== null,
              // SAME definition object? — the fact `trustedIdentity === pinned`
              // encodes inside the Guard (WeakMap fingerprint over this object).
              sameDefinition: (gDef !== undefined && gDef !== null) && (gDef === sDef),
            }
          }
          scoped = { agentResolved: true, scopedNames, perName }
        } else {
          scoped = { agentResolved: false }
        }
      }

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ globalNames, globalPresent: globalDefs, scoped, observations: observations.slice(-20) }))
    },
  }, 'a5bd diag facts'))
}
