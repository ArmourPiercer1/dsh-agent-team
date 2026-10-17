/**
 * a5g4-observer-row.mjs — the GLUE-4 READ-ONLY OBSERVER row.
 *
 * Mounted through the PUBLIC profile-patch seam (the same seam bind-diag's
 * a5bd-diag-row uses; the shape is copied from it, the reads are the same
 * public seams the production A5 guard glue reads, agent-bindings.mjs).
 * NO governance logic: never registers, restricts, grants, or guards. It
 * answers ONE question per read:
 *
 *   FACE 1 — `tools.schemas()` with NO scope (the trusted GLOBAL view the
 *            Guard's `nativeNames` is derived from) — which names does it show;
 *   FACE 2 — `tools.schemas(agent)` for EVERY live session Agent in the
 *            process — the exact model-facing catalog of that Agent, team or
 *            not (the same scoped read the Guard performs at bind time).
 *
 * The Agent handles come from the public `agents` service
 * (`ctx.agents.list()` / `ctx.agents.get(sessionId)` — the same public seam
 * the C-04/05 row reads); no derivation, no wake.
 *
 * Routes:
 *   GET /__a5g4/health  → { ok, applied, tools, agents }
 *   GET /__a5g4/facts   → { globalNames, globalPresent, agents: [{session, scopedNames, perName}] }
 *
 * @module evidence/alpha5/wiring/glue4-prodentry/a5g4-observer-row
 */
export const name = 'a5g4-observer'
export const inject = ['webServer', 'tools', 'agents']

const DEFAULT_NAMES = ['bash', 'edit', 'read', 'read_image', 'write']

export async function apply(ctx) {
  const webServer = ctx.get('webServer')
  const tools = ctx.get('tools')
  const agents = ctx.get('agents')
  const observations = []

  const safe = (label, read) => {
    try {
      return { ok: true, value: read() }
    } catch (error) {
      const detail = String(error?.message ?? error).slice(0, 200)
      observations.push(`a5g4-observer: read '${label}' threw: ${detail}`)
      return { ok: false, detail }
    }
  }

  const namesOf = (read) => {
    if (!read.ok || !Array.isArray(read.value)) return null
    return read.value.map((row) => String(row?.name ?? '')).filter((n) => n !== '').sort()
  }

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5g4/health',
    handler: (_req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        ok: true,
        applied: true,
        tools: typeof tools?.schemas === 'function' ? 'resolved' : 'MISSING',
        agents: typeof agents?.list === 'function' ? 'resolved' : 'MISSING',
        observations: observations.slice(-20),
      }))
    },
  }, 'a5g4 observer health'))

  ctx.effect(() => webServer.register({
    method: 'GET',
    path: '/__a5g4/facts',
    handler: (req, res) => {
      const url = new URL(req.url, 'http://x')
      const names = (url.searchParams.get('names') ?? DEFAULT_NAMES.join(',')).split(',').map((n) => n.trim()).filter((n) => n !== '')

      // FACE 1 — the GLOBAL view (the exact read `nativeNames` is derived from).
      const globalNames = namesOf(safe('tools.schemas()', () => tools.schemas()))
      const globalPresent = {}
      for (const n of names) {
        const r = safe(`tools.get("${n}")`, () => tools.get(n))
        globalPresent[n] = r.ok && r.value !== undefined && r.value !== null
      }

      // FACE 2 — the model-facing catalog of EVERY live Agent, via the public
      // agents service only. Handles are used as the scope key exactly as the
      // Guard's scoped read uses them.
      const list = safe('agents.list()', () => agents?.list?.() ?? [])
      const rows = list.ok ? (list.value ?? []) : []
      const agentsFacts = []
      for (const row of rows) {
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
            sameDefinition: (gDef !== undefined && gDef !== null) && (gDef === sDef),
          }
        }
        agentsFacts.push({ session, scopedNames, perName })
      }

      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ globalNames, globalPresent, agents: agentsFacts, observations: observations.slice(-20) }))
    },
  }, 'a5g4 observer facts'))
}
