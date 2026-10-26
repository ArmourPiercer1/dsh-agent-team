/**
 * census/reconcile — the EB2-A three-way diff
 * (`AuthoritativeToolSources → ExpectedToolObligations ↔ ObservedRuntimeInventory`).
 *
 * OUTPUT CLASSES (execution-plan U7 / EB2-A):
 *  - MISSING  — a REQUIRED named obligation expected in an observed scope
 *               class is not observed there;
 *  - UNKNOWN  — an observation with no reviewed obligation entry, a dynamic
 *               class instance without an admission record, or a test-row
 *               tool. UNKNOWN is ONLY EVER REPORTED: every row is written
 *               with the constant `authorized: false` minted HERE (it is
 *               not a data field — no input can set it true). CI-11/§10.4:
 *               discovery never authorizes.
 *  - DRIFT    — a name present in both the observed inventory and the
 *               pinned baseline snapshot whose model-facing shape digest,
 *               source attribution, in-boot placement identity, or in-boot
 *               change generation moved.
 * Plus a `scope_gaps` side-list: obligations whose scope CLASS was not
 * observed in this snapshot (e.g. team-lane obligations against a non-Team
 * world) — never silently MISSING, never silently OK.
 *
 * The three-way column: every MISSING/UNKNOWN/DRIFT row also carries the
 * authoritative-source presence (`in_authoritative_sources`) so a reader
 * sees WHICH side disagrees.
 *
 * The whole verdict carries `verdict_digest` (canonical), and the diff is
 * deterministic: same three inputs, byte-identical output.
 *
 * @module census/reconcile
 */
import { canonicalDigest } from './json-canonical.mjs'
import { inventoryViolations, OBSERVED_SCHEMA } from './inventory.mjs'

/** Pattern predicates for the dynamic classes (name-shape only; classes
 *  without a name pattern — client-plugin "any name" — deliberately match
 *  NOTHING: an unmatched observation stays UNKNOWN/not-in-obligations,
 *  which is the safe direction — over-matching would under-report). */
const DYNAMIC_PATTERNS = [
  { class: 'mcp__<server>__<tool>', test: (n) => n.startsWith('mcp__') },
  { class: 'cua_driver_native__<tool>', test: (n) => n.startsWith('cua_driver_native__') },
]

/**
 * @param {object} input
 * @param {any} input.expected  ExpectedToolObligations artifact (must carry schema u7-0/expected-tool-obligations/v1)
 * @param {any} input.sources   AuthoritativeToolSources artifact
 * @param {any} input.observed  ObservedRuntimeInventory (validated)
 * @param {any} [input.baseline] pinned baseline ObservedRuntimeInventory (for DRIFT)
 * @param {string[]} [input.testRowNames] test-only row names (reported UNKNOWN/test-row, never authorized)
 * @returns {{ ok: boolean, violations?: string[], result?: any }}
 */
export function reconcile({ expected, sources, observed, baseline = null, testRowNames = [] }) {
  const violations = []
  if (expected?.schema !== 'u7-0/expected-tool-obligations/v1') violations.push(`expected artifact schema wrong: ${String(expected?.schema)}`)
  if (sources?.schema !== 'u7-0/authoritative-tool-sources/v1') violations.push(`sources artifact schema wrong: ${String(sources?.schema)}`)
  if (observed?.schema !== OBSERVED_SCHEMA) violations.push(`observed inventory schema wrong: ${String(observed?.schema)}`)
  else violations.push(...inventoryViolations(observed).map((v) => `observed: ${v}`))
  if (baseline !== null && baseline?.schema !== OBSERVED_SCHEMA) violations.push(`baseline inventory schema wrong: ${String(baseline?.schema)}`)
  if (violations.length > 0) return { ok: false, violations }

  const obligationByName = new Map(expected.obligations.filter((o) => o.kind === 'named').map((o) => [o.name, o]))
  const hostNames = new Set(sources.static_sources.host.map((t) => t.name))
  const teamNames = new Set(sources.static_sources.team.map((t) => t.name))
  const testRows = new Set(testRowNames)

  const inAuthoritative = (name) => hostNames.has(name) || teamNames.has(name)
  const dynamicClassOf = (name) => DYNAMIC_PATTERNS.find((p) => p.test(name))?.class ?? null

  const sourceClassOf = (name) => {
    if (dynamicClassOf(name) !== null) return 'dynamic-source'
    if (testRows.has(name)) return 'test-row'
    if (hostNames.has(name)) return 'host-static'
    if (teamNames.has(name)) return 'team-native'
    return 'unattributed'
  }

  // ---- scope-class partition of the observation ----------------------------
  const nativeScopes = observed.scopes.filter((s) => s.team_lane !== true)
  const teamScopes = observed.scopes.filter((s) => s.team_lane === true)
  const scopeClassObserved = { native: nativeScopes.length > 0, teamLane: teamScopes.length > 0 }
  const presentIn = (name, scopes) => scopes.some((s) => s.tools.some((t) => t.name === name))

  /** @type {any[]} */ const missing = []
  /** @type {any[]} */ const unknown = []
  /** @type {any[]} */ const outOfScopeObserved = []
  /** @type {any[]} */ const scopeGaps = []
  /** @type {any[]} */ const notes = []

  // ---- expected side: MISSING / scope gaps ---------------------------------
  for (const o of expected.obligations) {
    if (o.kind === 'surface') {
      notes.push({ kind: 'surface-obligation', name: o.name, detail: 'family obligation with no enumerable names; the census never name-matches it (U4 reviewed)' })
      continue
    }
    if (o.kind === 'dynamic-class') {
      notes.push({ kind: 'dynamic-class', name: o.name, detail: 'dynamic source recorded as a CLASS; instances observed at runtime are always UNKNOWN until an admission record exists (§10.4)' })
      continue
    }
    if (o.obligation !== 'REQUIRED') continue
    const cls = o.expected_in === 'team-lane' ? 'teamLane' : 'native'
    if (!scopeClassObserved[cls]) {
      scopeGaps.push({ name: o.name, expected_in: o.expected_in, reason: `scope class ${JSON.stringify(cls)} not observed in this snapshot (not MISSING, not OK)` })
      continue
    }
    const scopes = cls === 'teamLane' ? teamScopes : nativeScopes
    if (!presentIn(o.name, scopes)) {
      missing.push({
        name: o.name,
        expected_in: o.expected_in,
        in_authoritative_sources: inAuthoritative(o.name),
        source_class: sourceClassOf(o.name),
        effect_class: o.effect_class,
        candidate_route: o.candidate_route,
        reason: presentIn(o.name, cls === 'teamLane' ? nativeScopes : teamScopes)
          ? 'required obligation present only in the OTHER scope class'
          : 'required obligation observed in NO scope of this snapshot',
      })
    }
  }

  // ---- observed side: UNKNOWN / out-of-scope-observed ----------------------
  const obsRowsByName = new Map()
  for (const s of observed.scopes) {
    for (const t of s.tools) {
      if (!obsRowsByName.has(t.name)) obsRowsByName.set(t.name, [])
      obsRowsByName.get(t.name).push({ scope_id: s.scope_id, team_lane: s.team_lane === true, row: t })
    }
  }
  for (const [name, hits] of [...obsRowsByName.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const o = obligationByName.get(name)
    if (o === undefined) {
      const dyn = dynamicClassOf(name)
      unknown.push({
        name,
        scope_ids: hits.map((h) => h.scope_id).sort(),
        source_class: sourceClassOf(name),
        classification: dyn !== null ? 'dynamic-instance-unadmitted' : testRows.has(name) ? 'test-row' : 'not-in-obligations',
        dynamic_class: dyn,
        in_authoritative_sources: inAuthoritative(name),
        // The constant below IS the law (CI-11 / §10.4 / governance-center
        // not_verified): an UNKNOWN is reported, never authorized. It is a
        // literal here, not a passed-through field.
        authorized: false,
        reason: dyn !== null
          ? `instance of dynamic class ${dyn}; no DynamicSourceAdmissionRecord exists in Alpha.5 — NOT_VERIFIED`
          : testRows.has(name)
            ? 'test-only row tool (census/canary surface), never a product tool'
            : 'observed name has no ExpectedToolObligations entry — a NEW SOURCE is auto-UNKNOWN, never auto-authorized',
      })
      continue
    }
    if (o.obligation === 'OUT_OF_SCOPE') {
      outOfScopeObserved.push({
        name,
        scope_ids: hits.map((h) => h.scope_id).sort(),
        source_class: sourceClassOf(name),
        in_authoritative_sources: inAuthoritative(name),
        authorized: false,
        reason: 'observed although reviewed OUT_OF_SCOPE — the obligation RE-ATTACHES (U4 seed PB15 rule); not authorized by this census',
      })
    }
  }

  // ---- DRIFT vs the pinned baseline ----------------------------------------
  /** @type {any[]} */ const drift = []
  if (baseline !== null) {
    const sameBoot = baseline.world?.boot_id !== undefined && baseline.world.boot_id === observed.world?.boot_id
    const byClass = (inv) => {
      const native = inv.scopes.filter((s) => s.team_lane !== true)
      const team = inv.scopes.filter((s) => s.team_lane === true)
      const digestsIn = (name, scopes) => {
        const set = new Set()
        for (const s of scopes) for (const t of s.tools) if (t.name === name) set.add(`${t.schema_digest}|${t.identity_vs_global}`)
        return [...set].sort().join(';')
      }
      const identities = new Map()
      for (const s of inv.scopes) for (const t of s.tools) if (!identities.has(t.name)) identities.set(t.name, t.definition_identity)
      const seqs = new Map()
      for (const s of inv.scopes) for (const t of s.tools) if (Number.isInteger(t.change_seq) && !seqs.has(t.name)) seqs.set(t.name, t.change_seq)
      return { native, team, digestsIn, identities, seqs }
    }
    const B = byClass(baseline)
    const O = byClass(observed)
    const names = new Set([...(B.identities?.keys() ?? []), ...O.identities.keys()])
    for (const name of [...names].sort()) {
      for (const cls of ['native', 'team']) {
        const scopesB = cls === 'native' ? B.native : B.team
        const scopesO = cls === 'native' ? O.native : O.team
        const inB = scopesB.some((s) => s.tools.some((t) => t.name === name))
        const inO = scopesO.some((s) => s.tools.some((t) => t.name === name))
        if (!inB || !inO) continue // add/remove is MISSING/UNKNOWN territory, not DRIFT
        const dB = B.digestsIn(name, scopesB)
        const dO = O.digestsIn(name, scopesO)
        let shapeMoved = false
        if (dB !== dO) {
          shapeMoved = dB.split(';').map((x) => x.split('|')[0]).join(';') !== dO.split(';').map((x) => x.split('|')[0]).join(';')
          drift.push({
            name,
            scope_class: cls,
            kind: shapeMoved ? 'definition-shape' : 'placement-identity-signal',
            baseline: dB,
            observed: dO,
            detail: shapeMoved
              ? 'model-facing shape digest moved between the pinned baseline and this snapshot'
              : 'the identity_vs_global signal moved (a same-name row replaced/undid its placement) while the shape held',
          })
        }
        if (sameBoot) {
          const idB = B.identities.get(name)
          const idO = O.identities.get(name)
          if (typeof idB === 'string' && typeof idO === 'string' && idB !== idO) {
            drift.push({ name, scope_class: cls, kind: 'definition-identity', baseline: idB, observed: idO, detail: 'same boot: the placement identity (tool-dispatch WeakMap algebra) moved — the Definition Body was replaced' })
          }
          const qB = B.seqs.get(name)
          const qO = O.seqs.get(name)
          if (Number.isInteger(qB) && Number.isInteger(qO) && qB !== qO && !shapeMoved) {
            drift.push({ name, scope_class: cls, kind: 'revision', baseline: qB, observed: qO, detail: 'same boot: registration-generation moved with an unchanged shape (a re-registration of the identical definition)' })
          }
        }
      }
      const scB = sourceClassOf(name)
      const bRow = baseline.scopes.flatMap((s) => s.tools).find((t) => t.name === name)
      if (typeof bRow?.source_class === 'string' && bRow.source_class !== scB) {
        drift.push({ name, scope_class: 'any', kind: 'source', baseline: bRow.source_class, observed: scB, detail: 'the authoritative attribution of the name moved between baseline and observation' })
      }
    }
  }

  const counts = {
    missing: missing.length,
    unknown: unknown.length,
    out_of_scope_observed: outOfScopeObserved.length,
    drift: drift.length,
    scope_gaps: scopeGaps.length,
  }
  const core = {
    schema: 'u7-0/census-reconcile/v1',
    inputs: {
      expected_digest: expected.__digest ?? null,
      observed_snapshot_digest: observed.snapshot_digest ?? null,
      baseline_snapshot_digest: baseline?.snapshot_digest ?? null,
      scope_classes_observed: scopeClassObserved,
    },
    // Authorization can NEVER arrive through this module: rows are built
    // here with authorized:false as a literal; nothing downstream flips it.
    missing: missing.sort((a, b) => (a.name < b.name ? -1 : 1)),
    unknown: unknown.sort((a, b) => (a.name < b.name ? -1 : 1)),
    out_of_scope_observed: outOfScopeObserved,
    drift: drift.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : (a.kind < b.kind ? -1 : 1))),
    scope_gaps: scopeGaps,
    notes,
    counts,
  }
  const result = { ...core, verdict_digest: canonicalDigest(core) }
  return { ok: true, result }
}
