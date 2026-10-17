/**
 * a5rr-probe-row.mjs — RA-REVIEW read-only identity probe row (Tier B).
 *
 * Mounted through the PUBLIC profile-patch seam (same shape as glue4's
 * observer). NO governance logic, NO registration, NO restriction, NO guard
 * seam: it only READS the public `tools` / `agents` seams and answers the
 * ① question on the REAL pinned host:
 *
 *   "in a scoped ctx, can the CALLING code obtain the identity of the very
 *    Definition that will execute — and any id/version/generation label?"
 *
 *   IDENTITY   — `tools.get(name, agent)` twice must return the SAME object
 *                reference (the executor performs the same read), so object
 *                identity is observable through the public scoped seam.
 *   GENERATION — enumerate the resolved definition's own keys: does any
 *                id/uuid/version/generation/revision/definitionId field exist
 *                to be read? (expected measured answer: NONE — object identity
 *                + per-call re-read is the only generation proxy on this host.)
 *   GLOBAL     — `tools.get(name)` with NO scope (the Guard's fact-3 trusted
 *                side): expected EMPTY on the web bundle (bind-diag law).
 *   FORGERY    — `tools.get(name, plainObject)` with a non-host scope key
 *                resolves the GLOBAL view only (dsh-scope keys are opaque
 *                object identities; an unowned key has no chain and no own
 *                layer) — the team's scoped view is unreachable through a
 *                forged handle.
 *
 * Routes: GET /__a5rr/health · GET /__a5rr/facts?names=a,b,c
 * @module evidence/alpha5/wiring/ra-review/a5rr-probe-row
 */
export const name = 'a5rr-probe'
export const inject = ['webServer', 'tools', 'agents']

const DEFAULT_NAMES = ['bash', 'edit', 'read', 'read_image', 'write']
const ID_FIELD = /^(id|uuid|guid|version|generation|revision|definitionId|defId)$/i
const IDENTITY_FIELDS_EXEMPT = [] // measured verbatim — nothing exempted

export async function apply(ctx) {
  const webServer = ctx.get('webServer')
  const tools = ctx.get('tools')
  const agents = ctx.get('agents')
  const observations = []

  const safe = (label, read) => {
    try { return { ok: true, value: read() } } catch (error) {
      const detail = String(error?.message ?? error).slice(0, 200)
      observations.push(`a5rr-probe: '${label}' threw: ${detail}`)
      return { ok: false, detail }
    }
  }

  ctx.effect(() => webServer.register({
    method: 'GET', path: '/__a5rr/health',
    handler: (_req, res) => { res.statusCode = 200; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, applied: true, observations: observations.slice(-20) })) },
  }, 'a5rr health'))

  ctx.effect(() => webServer.register({
    method: 'GET', path: '/__a5rr/facts',
    handler: (req, res) => {
      const url = new URL(req.url, 'http://x')
      const names = (url.searchParams.get('names') ?? DEFAULT_NAMES.join(',')).split(',').map((n) => n.trim()).filter(Boolean)

      const globalSchemas = safe('tools.schemas()', () => tools.schemas())
      const globalNames = globalSchemas.ok && Array.isArray(globalSchemas.value)
        ? globalSchemas.value.map((r) => String(r?.name ?? '')).filter(Boolean).sort() : null

      const list = safe('agents.list()', () => agents?.list?.() ?? [])
      const rows = []
      for (const row of (list.ok ? list.value : [])) {
        const session = String(row?.id ?? row?.session ?? '')
        if (session === '') continue
        const handle = safe(`agents.get(${session})`, () => agents?.get?.(session) ?? row)
        const agent = handle.ok ? handle.value : row
        if (agent == null) continue
        const scopedNames = (() => {
          const s = safe(`tools.schemas(agent:${session})`, () => tools.schemas(agent))
          return s.ok && Array.isArray(s.value) ? s.value.map((r) => String(r?.name ?? '')).filter(Boolean).sort() : null
        })()
        const perName = {}
        for (const n of names) {
          const g = safe(`get(${n})`, () => tools.get(n))
          const s1 = safe(`get1(${n})`, () => tools.get(n, agent))
          const s2 = safe(`get2(${n})`, () => tools.get(n, agent))
          const def = s1.ok ? s1.value : undefined
          const forged = safe(`forged(${n})`, () => tools.get(n, { id: 'a5rr-forged-scope' }))
          perName[n] = {
            globalPresent: g.ok && g.value != null,
            scopedPresent: def != null,
            scopedIdentityStable: def != null && s1.ok && s2.ok && s1.value === s2.value, // SAME object across reads
            sameDefinitionAsGlobal: g.value != null && g.value === def,
            forgedScopeResolves: forged.ok && forged.value != null, // expected: false for scoped-only names
            definitionKeyCount: def != null ? Object.keys(def).length : null,
            identityLikeFields: def != null
              ? Object.keys(def).filter((k) => ID_FIELD.test(k) && !IDENTITY_FIELDS_EXEMPT.includes(k))
              : null,
            exposesExecuteBody: def != null && typeof def.execute === 'function',
          }
        }
        // schemas() is a per-call CLONE — prove the identity seam is get(), not schemas().
        const sc1 = safe('schemas-clone1', () => tools.schemas(agent))
        const sc2 = safe('schemas-clone2', () => tools.schemas(agent))
        const schemasAreClones = sc1.ok && sc2.ok && Array.isArray(sc1.value) && sc1.value.length > 0 && sc1.value[0] !== sc2.value[0]
        rows.push({ session, scopedNames, perName, schemasAreClones })
      }
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ globalNames, agents: rows, observations: observations.slice(-20) }))
    },
  }, 'a5rr facts'))
}
