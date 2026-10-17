#!/usr/bin/env node
/**
 * a5rr-synth-poc.mjs — RA-REVIEW Tier-A PoC: the scoped-aware binding revision,
 * run through the REAL compiled closed-world Guard (read-only import of
 * packages/runtime/dist — zero production change), against a SYNTHETIC registry
 * that reproduces the pinned host's layer laws.
 *
 * SYNTHETIC WORLD (not production): a registry with the two planes the pinned
 * host (0.2.0-rc.2 @ 639ed01539) exposes to the public seams, law-for-law:
 *   L1 `get(name, scope)` = view(scope).visible.get(name) — own layer LAST,
 *     shadowing the global layer            (core/tools/src/index.ts:1180-1215)
 *   L2 `get(name)` (no scope) = the GLOBAL layer view only — the Guard's
 *     trusted read                          (index.ts:1239-1241)
 *   L3 `register` lands in the CALLING scope's own layer; duplicates within
 *     ONE layer throw                       (index.ts:1063-1090)
 *   L4 `restrict()` throws without a scoped ctx (proven live by glue4 G-runs)
 *   L5 `get(name, unknownScopeKey)` resolves the GLOBAL view only — an
 *     unowned scope key has no chain and no own layer (index.ts:1180-1184:
 *     `chainLayers(unknown)` = [], `peek(unknown)` = undefined)
 *   L6 execution runs `get(exec.name, exec.agent)` — the object the scoped
 *     read returns IS the body that executes (index.ts:1578-1581 via
 *     resolveExecution :1247-1252). The Guard's per-call probe reads the
 *     same seam with the same handle, so what it verifies IS what runs.
 *
 * WHAT IS REAL: every Guard verdict comes from the ACTUAL compiled
 * closed-world-guard.js (createGovernedSurface + bindInheritedSurface +
 * guardDecision) — the same artifact production ships. Only the registry and
 * the install-side definition probes are synthetic clones (definitionFingerprint
 * and readDefinition/readTrustedDefinition are copied from
 * packages/runtime/tool-dispatch/install.ts:97-105, 337-384 — instrumented,
 * read-only, no seam registered anywhere).
 *
 * SCENARIOS → CRITERIA:
 *  S1 (law re-pin, bind-diag shape): inherited native, no global face ⇒
 *     R-a fact-3 CANNOT be evaluated ⇒ `native-unreadable` ⇒ refused.
 *     (This is exactly today's GLUE-4 stop.)                        [R1]
 *  S2 (THE REVISION): the team assembly PLACES the reviewed body itself
 *     (scoped `register` into the agent's OWN layer — the public seam team
 *     tools already use) and binds it through the existing bindAll shape
 *     (origin team-own, verified, pinned by the object it placed). Per-call
 *     guardDecision re-reads the scoped seam and the object still matches ⇒
 *     abstain / `governed-and-verified`. VERIFIED HOLDS scoped-aware, and
 *     the global face STAYS EMPTY — no process-wide flip, no `minimal`
 *     expansion: non-team faces are byte-identical before/after.  [R2,R3]
 *  S3 NC-1 same-name cross-realm: a foreign same-layer registration placed
 *     FIRST ⇒ the assembly's own registration FAILS (L3 duplicate) ⇒ nothing
 *     is placed ⇒ refused; PLUS the falsification control that proves a
 *     DISCOVERY-style scoped-only pin (pin whatever the scoped read shows)
 *     would have VERIFIED the foreign body — i.e. the invariant must be
 *     placement attribution, not a scoped re-read.              [R4,R5]
 *  S4 NC-2 revocation/drift races: dispose ⇒ DEFINITION_UNREADABLE (no
 *     global beneath) / DEFINITION_DRIFT (a global same-name beneath — the
 *     ancestor body must never inherit the old verification); a fresh
 *     re-registration ⇒ DEFINITION_DRIFT.                        [R6a-C]
 *  S5 NC-3 forged scope label: an unowned/forged scope key reaches ONLY the
 *     global view (never the team's placement); a forged/absent exec
 *     identity is refused IDENTITY_FOREIGN / IDENTITY_ABSENT; and the
 *     revision adds NO scope label to the exec path (guardDecision's input
 *     is name + agentIdentity + the wrapper-read fingerprint).  [R7a,R7b]
 *
 * EXIT: 0 all criteria pass (GREEN) · 2 a criterion failed (RED) · 1 fatal.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..', '..')
const GUARD_URL = new URL(
  `file://${WORKTREE}/packages/runtime/dist/packages/runtime/tool-dispatch/closed-world-guard.js`,
)
const { createGovernedSurface, guardDecision, untestedAssurance } = await import(GUARD_URL)

const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const RUN_DIR = join(HERE, 'runs', RUN_STAMP)
mkdirSync(RUN_DIR, { recursive: true })

const CRITERIA = []
function check(id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}

// ── the synthetic registry (laws L1-L6 above) ───────────────────────────────
class SynthRegistry {
  constructor() {
    this.global = new Map()
    this.own = new WeakMap() // per-scope own layer (ScopeKey is an object identity — dsh-scope)
  }
  #ownLayer(scope) {
    if (scope === undefined) return undefined
    let layer = this.own.get(scope)
    if (layer === undefined) {
      layer = new Map()
      this.own.set(scope, layer)
    }
    return layer
  }
  /** L3: register into the CALLING scope's own layer; duplicate-in-layer fails. */
  register(callerScope, definition) {
    if (callerScope === undefined) {
      if (this.global.has(definition.name)) throw new Error(`duplicate global tool "${definition.name}"`)
      this.global.set(definition.name, definition)
      return () => this.global.delete(definition.name)
    }
    const layer = this.#ownLayer(callerScope)
    if (layer.has(definition.name)) {
      throw new Error(`tool "${definition.name}" is already registered in this agent scope`)
    }
    layer.set(definition.name, definition)
    return () => layer.delete(definition.name)
  }
  /** L4: restrict requires a scoped ctx. */
  restrict(callerScope, filter) {
    if (callerScope === undefined) {
      throw new Error('tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent')
    }
    throw new Error('synthetic: restrict semantics not needed for this PoC (fail-closed stub)')
  }
  /** L1+L2+L5: view(scope): global, then own LAST (shadowing); unknown key ⇒ global only. */
  get(name, scope) {
    const own = scope === undefined ? undefined : this.own.get(scope)
    const ownDef = own?.get(name)
    if (ownDef !== undefined) return ownDef
    return this.global.get(name)
  }
  schemas(scope) {
    const names = new Set(this.global.keys())
    const own = scope === undefined ? undefined : this.own.get(scope)
    if (own !== undefined) for (const n of own.keys()) names.add(n)
    return [...names].sort().map((name) => ({ name }))
  }
}

// ── instrumented CLONES of the install.ts read sites (read-only) ────────────
// fingerprint: WeakMap object identity — install.ts:97-105 (verbatim shape).
const definitionIds = new WeakMap()
let definitionIdCounter = 0
function definitionFingerprint(target) {
  if (target === null || (typeof target !== 'object' && typeof target !== 'function')) return null
  const existing = definitionIds.get(target)
  if (existing !== undefined) return existing
  definitionIdCounter += 1
  const id = `def#${definitionIdCounter}`
  definitionIds.set(target, id)
  return id
}
/** readDefinition: tools.get(name, runtimeAgent) — install.ts:337-350. */
const readDefinition = (registry, name, runtimeAgent) => {
  const definition = registry.get(name, runtimeAgent)
  if (definition === undefined || definition === null) return { ok: false, detail: `tools.get("${name}") resolved to no definition on this scope` }
  const id = definitionFingerprint(definition.execute ?? definition)
  return id === null ? { ok: false, detail: 'no pinnable Body' } : { ok: true, fingerprint: id }
}
/** readTrustedDefinition: tools.get(name) NO scope — install.ts:368-384. */
const readTrustedDefinition = (registry, name) => {
  const definition = registry.get(name)
  if (definition === undefined || definition === null) return { ok: false, detail: `tools.get("${name}") (global view) resolved to no definition` }
  const id = definitionFingerprint(definition.execute ?? definition)
  return id === null ? { ok: false, detail: 'no pinnable Body' } : { ok: true, fingerprint: id }
}
/** bindAll shape — install.ts:987-1024 (the EXISTING production team-own path). */
function bindTeamOwn(surface, agentScopeKey, name, probe) {
  const inForce = surface.entryOf(name)
  const binding = {
    bindingId: `team-own:${agentScopeKey}:${name}`,
    agentScopeKey,
    toolName: name,
    definitionIdentity: probe.fingerprint,
    providerId: 'dsh-agent-team',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: (inForce?.revision ?? 0) + 1,
    status: 'ACTIVE',
  }
  return surface.bind({ name, origin: 'team-own', binding, verified: true })
}

const mkTool = (name, tag) => ({ name, description: `synthetic ${name}`, parameters: {}, execute: function execute() { return tag }, output: { schema: {}, render: (x) => String(x) } })
const decide = (surface, name, opts = {}) =>
  guardDecision({
    exec: { name, ...(opts.identity === undefined ? {} : { agentIdentity: opts.identity }) },
    scope: { agentScopeKey: 'session-team', trustedIdentities: ['session-team'] },
    surface,
    active: true,
    policyGeneration: 0,
    authorityGeneration: 0,
    definition: opts.definition,
  })

const facts = { run: RUN_STAMP, guard: 'packages/runtime/dist (tracked, @' + '01df26ca' + ')' }

// ── S1: the CURRENT law, bind-diag shape (the GLUE-4 stop, re-pinned) ───────
{
  const reg = new SynthRegistry()
  const teamScope = { id: 'team-agent' } // host-issued Agent handle (synthetic)
  // a preset-realm copy registered into the agent's OWN layer (law 2 of glue4):
  const presetCopy = mkTool('read', 'preset-realm-copy')
  reg.register(teamScope, presetCopy)
  const surface = createGovernedSurface({ agentScopeKey: 'session-team', nativeNames: ['read'] })
  // publish, CURRENT reading (install.ts:1052-1064):
  const surfaceNames = reg.schemas(teamScope).map((r) => r.name)
  const identities = {}
  const trusted = {}
  for (const n of surfaceNames) {
    const p = readDefinition(reg, n, teamScope)
    if (p.ok) identities[n] = p.fingerprint
    const t = readTrustedDefinition(reg, n)
    if (t.ok) trusted[n] = t.fingerprint
  }
  const inherited = surface.bindInheritedSurface(surfaceNames, identities, trusted)
  const probe = readDefinition(reg, 'read', teamScope)
  const verdict = decide(surface, 'read', { identity: 'session-team', definition: probe })
  facts.S1 = { inherited: JSON.parse(JSON.stringify(inherited)), verdictKind: verdict.kind, verdictReason: verdict.reason }
  check('R1', 'CURRENT fact-3 refuses the preset-realm native (native-unreadable) — the GLUE-4 stop re-pinned synthetically',
    verdict.kind === 'deny' && verdict.reason === 'native-unreadable', `${verdict.kind}/${verdict.reason}`)
}

// ── S2: the REVISION — assembly placement + the EXISTING team-own lane ───────
const S2 = {}
{
  const reg = new SynthRegistry()
  const teamScope = { id: 'team-agent' }
  const minimalScope = { id: 'minimal-agent' } // an ordinary non-team session
  const before = { minimalFace: reg.schemas(minimalScope).map((r) => r.name), globalFace: reg.schemas().map((r) => r.name) }
  // Team assembly places the reviewed body itself (public scoped register —
  // the very seam agent-bindings uses for team tools):
  const reviewedBody = mkTool('read', 'reviewed-pinned-package')
  let disposer
  try {
    disposer = reg.register(teamScope, reviewedBody)
  } catch { /* placement failed ⇒ fail closed, S3 covers this shape */ }
  const surface = createGovernedSurface({ agentScopeKey: 'session-team', nativeNames: [] }) // owned names are NOT native names
  const probe = readDefinition(reg, 'read', teamScope)
  const bound = bindTeamOwn(surface, 'session-team', 'read', probe)
  // publish: bindInheritedSurface still runs — with the production owned-filter
  // (install.ts:1062) the placed name is not a native claim; nothing flips it back.
  const surfaceNames = reg.schemas(teamScope).map((r) => r.name)
  const owned = new Set(['read'])
  const nativeNames = [] // trusted global list is EMPTY (web bundle) — no fact-3 claim for 'read'
  const identities = {}
  const trusted = {}
  for (const n of surfaceNames) {
    const p = readDefinition(reg, n, teamScope)
    if (p.ok) identities[n] = p.fingerprint
    const t = readTrustedDefinition(reg, n)
    if (t.ok) trusted[n] = t.fingerprint
  }
  const inherited = surface.bindInheritedSurface(
    surfaceNames.filter((n) => !owned.has(n)), identities, trusted,
  )
  const verdict = decide(surface, 'read', { identity: 'session-team', definition: readDefinition(reg, 'read', teamScope) })
  const after = { minimalFace: reg.schemas(minimalScope).map((r) => r.name), globalFace: reg.schemas().map((r) => r.name) }
  facts.S2 = { boundOk: bound.ok === true, inheritedVerified: inherited.verifiedBound, verdictKind: verdict.kind, verdictReason: verdict.reason, before, after }
  check('R2', 'REVISED reading: team-placed body VERIFIES scoped-aware (governed-and-verified) with an EMPTY trusted global face',
    bound.ok === true && verdict.kind === 'abstain' && verdict.reason === 'governed-and-verified', `${verdict.kind}/${verdict.reason}`)
  check('R3', 'minimal non-team zero change: its face and the global face are byte-identical before/after the team assembly',
    JSON.stringify(before) === JSON.stringify(after) && after.globalFace.length === 0, `global=${JSON.stringify(after.globalFace)} minimal=${JSON.stringify(after.minimalFace)}`)
  S2.disposer = disposer
  S2.reg = reg
  S2.teamScope = teamScope
  S2.surface = surface
}

// ── S3 NC-1: same-name cross-realm — placement first-writer + falsification ──
{
  const reg = new SynthRegistry()
  const teamScope = { id: 'team-agent' }
  // A foreign same-layer registration placed FIRST (e.g. a preset row the
  // team never reviewed, registering into the same agent scope):
  const foreign = mkTool('read', 'foreign-same-layer')
  reg.register(teamScope, foreign)
  // The team assembly now tries to place its reviewed body ⇒ L3 duplicate FAIL:
  let placementFailed = false
  try { reg.register(teamScope, mkTool('read', 'reviewed')) } catch { placementFailed = true }
  const surface = createGovernedSurface({ agentScopeKey: 'session-team', nativeNames: ['read'] })
  // assembly fail-closed: nothing placed ⇒ the name is only a DISCOVERED
  // surface name; CURRENT reading binds it (global absent ⇒ native-unreadable):
  const identities = {}
  const trusted = {}
  const p = readDefinition(reg, 'read', teamScope)
  if (p.ok) identities.read = p.fingerprint
  const t = readTrustedDefinition(reg, 'read')
  if (t.ok) trusted.read = t.fingerprint
  surface.bindInheritedSurface(['read'], identities, trusted)
  const verdict = decide(surface, 'read', { identity: 'session-team', definition: readDefinition(reg, 'read', teamScope) })
  facts.S3 = { placementFailed, verdictKind: verdict.kind, verdictReason: verdict.reason }
  check('R4', 'NC-1 same-name cross-realm: foreign placement blocks team placement (L3) and the foreign body stays REFUSED',
    placementFailed && verdict.kind === 'deny', `placementFailed=${placementFailed} ${verdict.kind}/${verdict.reason}`)
  // FALSIFICATION CONTROL: a DISCOVERY-style scoped-only fact-3′ (pin whatever
  // the scoped read shows, verified=true) would have VERIFIED the foreign body
  // — proving the load-bearing invariant is PLACEMENT ATTRIBUTION, not the
  // scope of the read. This is exactly the attack R-a was created for.
  const naive = createGovernedSurface({ agentScopeKey: 'session-team', nativeNames: ['read'] })
  bindTeamOwn(naive, 'session-team', 'read', readDefinition(reg, 'read', teamScope)) // discovery-style: pins the FOREIGN object
  const naiveVerdict = decide(naive, 'read', { identity: 'session-team', definition: readDefinition(reg, 'read', teamScope) })
  facts.S3_naiveControl = { naiveVerdictKind: naiveVerdict.kind, naiveVerdictReason: naiveVerdict.reason, pinnedTag: 'foreign-same-layer' }
  check('R5', 'falsification control PASSES (by design): a discovery-style scoped pin verifies the foreign body — the revision must be placement-based, discovery-based scoped fact-3′ is UNSOUND',
    naiveVerdict.kind === 'abstain', `${naiveVerdict.kind}/${naiveVerdict.reason} on the FOREIGN body — exactly the R-a attack`)
}

// ── S4 NC-2: revocation / re-generation races (on S2's verified state) ──────
{
  const { disposer, reg, teamScope, surface } = S2
  disposer() // the assembly's own registration is disposed (revocation / drain race)
  const probeBeneath = readDefinition(reg, 'read', teamScope)
  const v1 = decide(surface, 'read', { identity: 'session-team', definition: probeBeneath })
  check('R6a', 'NC-2 revocation with nothing beneath: per-call probe unreadable ⇒ DEFINITION_UNREADABLE refusal',
    v1.kind === 'deny' && v1.reason === 'definition-unreadable', `${v1.kind}/${v1.reason}`)
  facts.S4a = { kind: v1.kind, reason: v1.reason }
  // Re-registration after revocation = a NEW object ⇒ DEFINITION_DRIFT:
  reg.register(teamScope, mkTool('read', 'regeneration-v2'))
  const v2 = decide(surface, 'read', { identity: 'session-team', definition: readDefinition(reg, 'read', teamScope) })
  check('R6b', 'NC-2 re-registration race: a regenerated Body never inherits the old verification ⇒ DEFINITION_DRIFT refusal',
    v2.kind === 'deny' && v2.reason === 'definition-drift', `${v2.kind}/${v2.reason}`)
  facts.S4b = { kind: v2.kind, reason: v2.reason }
  // A global same-name BENEATH a disposed placement must not inherit standing:
  const reg2 = new SynthRegistry()
  const globalRead = mkTool('read', 'global-operator-body')
  reg2.register(undefined, globalRead) // global plane
  const teamScope2 = { id: 'team-agent-2' }
  const placed = mkTool('read', 'reviewed-placed')
  const d2 = reg2.register(teamScope2, placed)
  const surface2 = createGovernedSurface({ agentScopeKey: 'session-team-2', nativeNames: [] })
  bindTeamOwn(surface2, 'session-team-2', 'read', readDefinition(reg2, 'read', teamScope2))
  d2() // revoke the placement: the scoped read now falls through to the GLOBAL body
  const v3 = guardDecision({
    exec: { name: 'read', agentIdentity: 'session-team-2' },
    scope: { agentScopeKey: 'session-team-2', trustedIdentities: ['session-team-2'] },
    surface: surface2,
    active: true,
    policyGeneration: 0,
    authorityGeneration: 0,
    definition: readDefinition(reg2, 'read', teamScope2),
  })
  check('R6c', 'NC-2 fall-through race: after revocation the ANCESTOR (global) body does not inherit the verification ⇒ DEFINITION_DRIFT refusal',
    v3.kind === 'deny' && v3.reason === 'definition-drift', `${v3.kind}/${v3.reason}`)
  facts.S4c = { kind: v3.kind, reason: v3.reason }
}

// ── S5 NC-3: forged scope labels / forged identities ────────────────────────
{
  const { reg, teamScope } = S2
  // L5: an unowned/forged scope key resolves ONLY the global view — the team's
  // own-layer placement is unreachable through a handle the assembly does not
  // hold. (The revision adds NO scope parameter to the exec path: the wrapper
  // reads with the closure-captured runtimeAgent, so there is no label to
  // forge. This measures what a forged handle could see.)
  const forgedScope = { id: 'attacker-claims-to-be-team' }
  const seenThroughForged = reg.get('read', forgedScope)
  check('R7a', 'NC-3 forged scope key cannot reach the team placement (unowned key ⇒ global view only); the revision adds no forgeable scope label to dispatch',
    seenThroughForged === undefined, `get("read", forged) ⇒ ${seenThroughForged === undefined ? 'undefined (global view only)' : 'LEAK'}`)
  // exec identity: foreign and absent are both typed refusals:
  const surface = createGovernedSurface({ agentScopeKey: 'session-team', nativeNames: [] })
  bindTeamOwn(surface, 'session-team', 'read', { fingerprint: 'def#anything' })
  const foreignId = decide(surface, 'read', { identity: 'session-somebody-else', definition: { ok: true, fingerprint: 'def#anything' } })
  const absentId = decide(surface, 'read', { definition: { ok: true, fingerprint: 'def#anything' } })
  check('R7b', 'NC-3 forged/absent exec identity ⇒ IDENTITY_FOREIGN / IDENTITY_ABSENT refusals (identity is exec-scoped, not a claimable label)',
    foreignId.reason === 'agent-identity-foreign' && absentId.reason === 'agent-identity-absent',
    `${foreignId.reason} / ${absentId.reason}`)
  facts.S5 = { seenThroughForged: seenThroughForged === undefined ? 'undefined' : 'LEAK', foreignId: foreignId.reason, absentId: absentId.reason }
}

// ── the identity read itself (① measured on the synthetic world) ────────────
{
  const reg = new SynthRegistry()
  const scope = { id: 'a' }
  const def = mkTool('read', 'body')
  reg.register(scope, def)
  const r1 = reg.get('read', scope)
  const r2 = reg.get('read', scope)
  const executes = reg.get('read', scope) // L6: the executor performs THE SAME read
  const idFields = Object.keys(def).filter((k) => /^(id|uuid|version|generation|revision|definitionId)$/i.test(k))
  facts.identityRead = {
    stableAcrossReads: r1 === r2,
    sameObjectThatExecutes: r1 === executes,
    publicIdFieldsOnDefinition: idFields, // expected: [] — NO id/version/generation field exists
    fingerprintProxy: definitionFingerprint(def.execute),
  }
  check('R8', 'the public scoped seam returns the SAME object the executor resolves (identity IS readable); the Definition carries NO public id/version/generation field — object identity + per-call drift is the only generation proxy',
    r1 === r2 && r1 === executes && idFields.length === 0, `stable=${r1 === r2} executes=${r1 === executes} idFields=${JSON.stringify(idFields)}`)
}

writeFileSync(join(RUN_DIR, 'synth-facts.json'), JSON.stringify({ run: RUN_STAMP, criteria: CRITERIA, facts }, null, 2) + '\n')
const failed = CRITERIA.filter((c) => !c.pass)
console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'} ${CRITERIA.filter((c) => c.pass).length}/${CRITERIA.length} (${failed.map((c) => c.id).join(',') || 'all passed'})`)
process.exit(failed.length === 0 ? 0 : failed.length > 0 ? 2 : 1)
