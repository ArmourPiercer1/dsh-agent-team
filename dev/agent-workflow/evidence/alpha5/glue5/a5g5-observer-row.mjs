/**
 * a5g5-observer-row.mjs — the GLUE-5 READ-ONLY OBSERVER row.
 *
 * Public seams only (the a5g4/a5bd row shape): `tools.schemas()` /
 * `tools.get(name[, agent])` / `agents.list()/get()` — plus the `teamRoot`
 * service the production entry provides (the p6t6 row reads the same
 * facade). NO governance logic: never registers, restricts, grants, guards.
 *
 * Routes:
 *   GET /__a5g5/health  → { ok, applied }
 *   GET /__a5g5/facts   → { globalNames, agents: [{session, scopedNames, perName}],
 *                           observations, planeObservations, liveJobsGateway }
 *
 * @module evidence/alpha5/glue5/a5g5-observer-row
 */
export const name = 'a5g5-observer'
export const inject = ['webServer', 'tools', 'agents', 'teamRoot']

const DEFAULT_NAMES = ['team_grep', 'team_glob', 'team_bash']

export async function apply(ctx) {
  const webServer = ctx.get('webServer')
  const tools = ctx.get('tools')
  const agents = ctx.get('agents')
  const teamRoot = ctx.get('teamRoot')
  const observations = []

  const safe = (label, read) => {
    try {
      return { ok: true, value: read() }
    } catch (error) {
      const detail = String(error?.message ?? error).slice(0, 200)
      observations.push(`a5g5-observer: read '${label}' threw: ${detail}`)
      return { ok: false, detail }
    }
  }
  const namesOf = (read) => {
    if (!read.ok || !Array.isArray(read.value)) return null
    return read.value.map((row) => String(row?.name ?? '')).filter((n) => n !== '').sort()
  }

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5g5/health',
    handler: (_req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, applied: true }))
    },
  }, 'a5g5 observer health'))

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5g5/facts',
    handler: (req, res) => {
      const url = new URL(req.url, 'http://x')
      const names = (url.searchParams.get('names') ?? DEFAULT_NAMES.join(',')).split(',').map((s) => s.trim()).filter((s) => s !== '')
      const roots = (url.searchParams.get('roots') ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '')

      const globalNames = namesOf(safe('tools.schemas()', () => tools.schemas()))
      const list = safe('agents.list()', () => agents?.list?.() ?? [])
      const agentsFacts = []
      for (const row of list.ok ? (list.value ?? []) : []) {
        const session = String(row?.id ?? row?.session ?? '')
        if (session === '') continue
        const handle = safe(`agents.get("${session}")`, () => agents?.get?.(session) ?? row)
        const agent = handle.ok ? handle.value : row
        if (agent === undefined || agent === null) continue
        const scopedNames = namesOf(safe(`tools.schemas(agent:${session})`, () => tools.schemas(agent)))
        const perName = {}
        for (const n of names) {
          const g = safe(`tools.get("${n}")`, () => tools.get(n))
          const s = safe(`tools.get("${n}", agent:${session})`, () => tools.get(n, agent))
          const gDef = g.ok ? g.value : undefined
          const sDef = s.ok ? s.value : undefined
          perName[n] = {
            globalPresent: gDef !== undefined && gDef !== null,
            scopedPresent: sDef !== undefined && sDef !== null,
            sameDefinition: (gDef !== undefined && gDef !== null) && gDef === sDef,
          }
        }
        agentsFacts.push({ session, scopedNames, perName })
      }

      // The production entry's own observation stream (public `teamRoot`
      // facade, the p6t6 precedent) filtered to the GLUE-5 rows, and the
      // NON-AUTHORITY live-jobs-gateway witness for the requested roots.
      const live = safe('teamRoot.live', () => teamRoot?.live)
      const allObs = live.ok && Array.isArray(live.value?.observations) ? live.value.observations : []
      const planeObservations = allObs.filter((row) => /^(a5-plane|a5p7-live|a5p2prod):/.test(String(row)))
      const liveJobsGateway = {}
      for (const root of roots) {
        const probe = safe(`liveJobsGatewayFor("${root}")`, () => live.value?.liveJobsGatewayFor?.(root))
        const assembly = probe.ok ? probe.value : undefined
        liveJobsGateway[root] = {
          present: assembly !== undefined && assembly !== null,
          hasGateway: typeof assembly?.gateway?.admitJob === 'function',
          hasLease: typeof assembly?.drain === 'function' && typeof assembly?.release === 'function',
        }
      }

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ globalNames, agents: agentsFacts, planeObservations, liveJobsGateway, observations: observations.slice(-10) }))
    },
  }, 'a5g5 observer facts'))
}
