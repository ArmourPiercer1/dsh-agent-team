/**
 * g1fb-registry.mjs — the ONE generic governed-family registration function
 * (PoC-1, ARC-A minimal). ZERO per-tool center code: adding a family means
 * adding ONE family-owned declaration module; this file never mentions a tool
 * name, family id, or provider (statically verified in the run preflight:
 * zero occurrences of any governed name here).
 *
 * Master reuse (UNMODIFIED, imported at runtime by file URL):
 *   packages/runtime/src/plugin/live/pa-mount-registry.mjs — publishPaMount /
 *   revokePaMount / resolvePaMount. That module is import-free plain JS on
 *   master, and its mount law is exactly CI-08's "an old disposer must not
 *   delete the newer mount for the same pair" (its own header, :30-34):
 *   publish returns an OPAQUE identity the matching revoke must present.
 *   The master plane files themselves (team-tool-plane.mjs,
 *   plane-effect-backends.mjs) are NOT importable unmodified from a plugin
 *   (they import lane TS sources), so the plane ROW SHAPE is re-implemented
 *   minimally here while the mount identity law is REUSED, not rewritten.
 *
 * Collision law: a second contribution claiming a name this center already
 * approved is REFUSED before anything touches the Host store. A pre-existing
 * NATIVE binding is a TAKEOVER (the master plane's native-name route,
 * agent-scoped), recorded as such — never silently overwritten.
 *
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-registry
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { record, sha256 } from './g1fb-lib.mjs'

const SELF_SHA = sha256(readFileSync(fileURLToPath(import.meta.url), 'utf8'))

const DECLARATION_FIELDS = Object.freeze(['familyId', 'version', 'name', 'description', 'parameters', 'outputSchema', 'policy', 'execute'])

/** Closed-world declaration validation (memo §10.3 fail-closed shape). */
function validateDeclaration(decl) {
  const keys = Object.keys(decl ?? {})
  const unknown = keys.filter((k) => !DECLARATION_FIELDS.includes(k))
  const missing = DECLARATION_FIELDS.filter((k) => !(k in (decl ?? {})))
  if (unknown.length > 0) return `unknown-field:${unknown.join(',')}`
  if (missing.length > 0) return `missing-field:${missing.join(',')}`
  if (typeof decl.familyId !== 'string' || decl.familyId === '') return 'bad-familyId'
  if (typeof decl.name !== 'string' || decl.name === '') return 'bad-name'
  if (decl.parameters?.type !== 'object') return 'bad-parameters'
  if (decl.outputSchema?.type !== 'object') return 'bad-outputSchema'
  if (typeof decl.policy !== 'function' || typeof decl.execute !== 'function') return 'bad-hooks'
  return null
}

export function createGovernedFamilyRegistry({ center, ledger, mountRegistry }) {
  /** mounts: name -> { identity, generation, familyId, hostDisposer, def } */
  const mounts = new Map()
  /** PLANT-ONLY naive store (sensitivity plant for the mount identity law). */
  const naive = new Map()

  /**
   * registerGovernedFamily(contribution, toolsFace, deps) ->
   *   { ok:true, def, generation, dispose } | { ok:false, refusal }
   * toolsFace: the Host PUBLIC tools face this generation registers through
   * (agent-scoped for takeovers: exec.agent.ctx.tools — the master plane's
   * mount path, agent-bindings.mjs:2553/:2697).
   */
  function register(decl, toolsFace, deps = {}) {
    const bad = validateDeclaration(decl)
    if (bad !== null) {
      record({ leg: 'family-register', phase: 'refused', reason: `declaration-invalid:${bad}`, family: decl?.familyId, name: decl?.name })
      return { ok: false, refusal: `declaration-invalid:${bad}` }
    }
    const held = center.approved.get(decl.name)
    if (held !== undefined && held.familyId !== decl.familyId) {
      // Same-name collision between two CENTER contributions: refuse.
      record({ leg: 'family-register', phase: 'refused', reason: 'name-collision', name: decl.name, by: decl.familyId, owner: held.familyId })
      return { ok: false, refusal: `name-collision:${decl.name}:owner=${held.familyId},claimant=${decl.familyId}` }
    }
    const preexisting = (() => { try { return toolsFace.get?.(decl.name) } catch { return undefined } })()
    const takeover = preexisting !== undefined && (held === undefined || held.def !== preexisting)
    const def = {
      name: decl.name,
      description: decl.description,
      parameters: decl.parameters,
      output: {
        schema: decl.outputSchema,
        render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      execute: async (args, exec) => {
        // The kernel-owned edge (ledger admit) runs INSIDE the approved body
        // path the guard dispatched — families never hold the decision,
        // only the declarative policy (CI-06).
        const admit = ledger.admit(decl.name, args, { callId: String(exec?.rootCallId ?? 'unknown') })
        if (admit.decision !== 'execute') {
          record({ leg: 'refused-before-body', name: decl.name, decision: admit.decision, requestId: admit.requestId, tag: String(args?.tag ?? '') })
          // Typed pre-body refusal: the body (and every effect it carries) is
          // never entered; the error settles as an isError result Host-side.
          throw new Error(`G1F pre-body refusal ${String(admit.decision)} (${decl.name}${admit.requestId === undefined ? '' : ` ${admit.requestId}`})`)
        }
        return decl.execute(args, exec, deps)
      },
    }
    const generation = (mounts.get(decl.name)?.generation ?? 0) + 1
    const hostDisposer = toolsFace.register(def)
    // Mount identity law: REUSED master pa-mount-registry, unmodified.
    const identity = mountRegistry.publishPaMount('g1fb-center', decl.name, { familyId: decl.familyId, generation, def })
    center.approved.set(decl.name, { def, familyId: decl.familyId, generation })
    // Policy may read the center flags bag through deps (the sensitivity-plant
    // switches model governance ABSENCE); the ENGINE stays center-owned.
    if (!ledger.registerPolicy(decl.name, decl.familyId, (a) => decl.policy(a, deps))) {
      // policy collision (same name registered twice on the ledger): unwind.
      try { hostDisposer() } catch { /* best effort unwind */ }
      mountRegistry.revokePaMount('g1fb-center', decl.name, identity)
      center.approved.delete(decl.name)
      record({ leg: 'family-register', phase: 'refused', reason: 'policy-collision-unwound', name: decl.name, by: decl.familyId })
      return { ok: false, refusal: `policy-collision:${decl.name}` }
    }
    const entry = { identity, generation, familyId: decl.familyId, hostDisposer, def }
    mounts.set(decl.name, entry)
    naive.set(decl.name, entry)
    record({
      leg: 'family-register', phase: 'registered', family: decl.familyId, name: decl.name, generation,
      takeover: takeover === true, registrySelfSha: SELF_SHA, ledger: ledger.instanceId,
    })
    return { ok: true, def, generation, identity, dispose: () => dispose(decl.name, identity) }
  }

  /** Identity-guarded dispose (law) vs naive key dispose (plant). */
  function dispose(name, identity) {
    const entry = mounts.get(name)
    if (entry === undefined) return { ok: false, detail: 'no-mount' }
    if (center.flags.identityLawEnabled === false) {
      // SENSITIVITY PLANT: the naive center shape — a disposer keyed by NAME,
      // no identity. An OLD disposer now tears down whatever CURRENT mount
      // holds the name (the CI-08 failure the master law prevents).
      const cur = naive.get(name)
      naive.delete(name)
      center.approved.delete(name)
      try { cur?.hostDisposer?.() } catch { /* torn down by design in the plant */ }
      if (cur === entry) mounts.delete(name)
      record({ leg: 'mount-dispose', phase: 'PLANT-naive', name, generation: entry.generation })
      return { ok: true, detail: 'PLANT-naive-dispose' }
    }
    const revoked = mountRegistry.revokePaMount('g1fb-center', name, identity)
    if (revoked !== true) {
      // A stale disposer (identity moved) may NOT remove the newer mount.
      record({ leg: 'mount-dispose', phase: 'refused-stale', name, generation: entry.generation })
      return { ok: false, detail: 'stale-identity-refused (mount kept)' }
    }
    try { entry.hostDisposer() } catch { /* already gone */ }
    center.approved.delete(name)
    mounts.delete(name)
    naive.delete(name)
    record({ leg: 'mount-dispose', phase: 'disposed', name, generation: entry.generation })
    return { ok: true, detail: `disposed:gen${String(entry.generation)}` }
  }

  return {
    register,
    dispose,
    mounts: () => [...mounts.entries()].map(([n, e]) => ({ name: n, generation: e.generation, familyId: e.familyId })),
    SELF_SHA,
  }
}
