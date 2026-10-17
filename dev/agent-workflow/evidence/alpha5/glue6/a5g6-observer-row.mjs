/**
 * a5g6-observer-row.mjs — the GLUE-6 READ-ONLY OBSERVER row.
 *
 * Public seams only (`tools.schemas()` / `tools.get(name[, agent])` /
 * `agents.list()/get()` / the `teamRoot` service the production entry
 * provides), the shape the GLUE-5 / INSTALL-ENTRY observers established. It
 * registers NOTHING, restricts NOTHING and grants NOTHING: its whole job is
 * to answer two questions from outside the assembly —
 *
 *   GET /__a5g6/health → { ok, applied }          (the plugin row applied)
 *   GET /__a5g6/facts  → registry face + per-agent scoped names + the
 *                        production entry's own observation stream
 *
 * so a kit can tell "the plane is mounted on this governed agent" apart from
 * "the row never applied", without reaching into any private state.
 *
 * @module evidence/alpha5/glue6/a5g6-observer-row
 */
export const name = 'a5g6-observer'
export const inject = ['webServer', 'tools', 'agents', 'teamRoot']

const PLANE_NAMES = ['team_grep', 'team_glob', 'team_bash']

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
      observations.push(`a5g6-observer: read '${label}' threw: ${String(error?.message ?? error).slice(0, 200)}`)
      return { ok: false }
    }
  }
  const namesOf = (read) => Array.isArray(read.value)
    ? read.value.map((row) => String(row?.name ?? '')).filter((n) => n !== '').sort()
    : null

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5g6/health',
    handler: (_req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, applied: true }))
    },
  }, 'a5g6 observer health'))

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5g6/facts',
    handler: (_req, res) => {
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
        for (const n of PLANE_NAMES) {
          const gDef = safe(`tools.get("${n}")`, () => tools.get(n)).value
          const sDef = safe(`tools.get("${n}", agent:${session})`, () => tools.get(n, agent)).value
          perName[n] = {
            globalPresent: gDef !== undefined && gDef !== null,
            scopedPresent: sDef !== undefined && sDef !== null,
            sameDefinition: (gDef !== undefined && gDef !== null) && gDef === sDef,
          }
        }
        agentsFacts.push({ session, scopedNames, perName })
      }
      const live = safe('teamRoot.live', () => teamRoot?.live)
      const allObs = live.ok && Array.isArray(live.value?.observations) ? live.value.observations : []
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        globalNames,
        agents: agentsFacts,
        planeObservations: allObs.filter((row) => /^(a5-plane|a5p7-live|a5p2prod):/.test(String(row))),
        observations: observations.slice(-10),
      }))
    },
  }, 'a5g6 observer facts'))
}
