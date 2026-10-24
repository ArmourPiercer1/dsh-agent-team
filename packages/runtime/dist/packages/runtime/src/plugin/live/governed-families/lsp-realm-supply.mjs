/**
 * A5M2 G3 B-LSP — REALM SUPPLY + REALM-SCOPED DOCUMENT RESOLVER
 * (center LSP CONTINUATION 1, root 限施工裁决 same task; the consumer-side
 * integrator adapter the COMMITTED fsproc adapter names as the MISSING
 * capability at 639ed01539: g3-fsproc-adapters.mjs :2548-2551 forces
 * serviceFacts.documentRealm/documentScope as INTERFACE OBLIGATIONS, and the
 * adapter bytes stay ZERO-EDITED — this file supplies them.)
 *
 * THE ASSEMBLY IS NOT REIMPLEMENTED (root 限施工裁决 2026-10-24): the REAL
 * `createLspRealmAssembly` (R-2 realm destroy/rebuild over the R-1 public
 * `spawnStreaming`, 77ffb1874, sandbox-provider/lsp-assembly.ts) exists at
 * this base ON INT AND MASTER (measured: git ls-tree origin/feat/a5-m2-
 * integration + origin/master both carry the file; its tsc emit
 * dist/.../sandbox-provider/lsp-assembly.js node-imports clean — measured
 * DIRECT_IMPORT_OK), and the a5lsp2-assembly spec already consumes the TS
 * face through vitest's `.js`->`.ts` resolution. So the supply takes an
 * EXISTING assembly through its published shape (ensure / policyChange /
 * dispose / disposeAll / current / size — lsp-assembly.ts:94-107) and never
 * forks its semantics. The mount round builds the assembly itself (fake
 * transport through options.deps on the author side, production deps at the
 * Host round) and hands it here — one module, one law, no vendored copy.
 *
 * WHAT THIS FILE ADDS (the consumer-side facts, no new Core, no private
 * pools, no reflection, no global LSP replacement):
 *  · server  — LIVE existence only: the member's CURRENT assembled instance
 *    answers { binaryIdentity, generation }; binary identity is a POLICY
 *    fact (the integrator's serverIdentityOf reader over the (member x
 *    generation) policy map — the same map the assembly's policyFor owns)
 *    and is NEVER inferred from a handle. No live realm answers NOTHING —
 *    the arm refuses P_LSP_TARGET_UNRESOLVED, a bare-process reach never
 *    substitutes.
 *  · document — the realm-scoped canonical locator + revision law the
 *    77ffb187 host face left unnamed: a workspace-relative path lands
 *    kind 'workspace' with a POSIX-styled canonical locator under the
 *    call's workspace root; an absolute path lands kind 'absolute-path'
 *    resolved verbatim; a path that escapes its workspace by `..` is
 *    UNRESOLVABLE (null — the arm refuses, never navigates); the revision
 *    is the REAL file stat fact (`stat:v1:<size>:<mtimeMs>` — an edit
 *    moves it, which is exactly what the arm's approval-window recheck
 *    re-reads at the entry; a missing/unreadable file is null, never a
 *    guessed revision).
 *  · documentRealm — the locator->realm MAPPING: the member's live
 *    instance's OWN realmId (the assembly's `lsp:<memberId>:<generation>`
 *    spelling, lsp-assembly.ts:113-115 — never recomputed here except in
 *    the exported realmIdOf helper the mount round uses to NAME the arm's
 *    realmId at mount time; when the policy generation moves the realm
 *    spelling MOVES with it, and a mount still naming the old realm reads
 *    a mismatch -> the arm's P_LSP_REALM_SCOPE_ESCAPED before any body:
 *    a destroyed realm never answers navigation, by construction).
 *  · documentScope — the workspace CONTAINMENT law: 'inside' iff the
 *    resolved locator equals or sits under the resolved workspace root,
 *    'outside' otherwise (only 'inside' authorizes navigation; symlink
 *    escape remains the REALM's own confine law at the launcher — this is
 *    the control-plane scope answer the §5.2 obligation asks for, and it
 *    answers, it does not enforce).
 *
 * FOUR-TIER: author-side supply; the realm transport in the spec is CANNED
 * (options.deps.spawnStream per the a5lsp2-streaming precedent); nothing
 * here claims a Host round. 接线未测 until production supply + mount + a
 * real Host walk.
 */
import { isAbsolute, normalize, resolve, sep } from 'node:path'
import { statSync } from 'node:fs'

export const A5_LSP_REALM_SUPPLY_REVISION = 1

export const A5_LSP_SUPPLY_CODES = Object.freeze({
  INPUT_INVALID: 'P_LSP_SUPPLY_INPUT_INVALID',
})

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const refuseInput = (detail) => deepFreeze({ ok: false, code: A5_LSP_SUPPLY_CODES.INPUT_INVALID, detail })

/** THE realm spelling — the assembly's OWN law (lsp-assembly.ts:113-115),
 *  restated here ONLY for the mount round to name the arm's realmId; the
 *  facts below always read the instance's realmId, never this helper, so a
 *  spelling drift between the two is spec-pinned, never silently lived. */
export function a5LspRealmId (memberId, generation) {
  return `lsp:${String(memberId)}:${String(generation)}`
}

/**
 * Build the B-LSP realm supply for ONE member over an EXISTING assembly.
 * @param input - CLOSED key set:
 *   assembly          the published LspRealmAssembly face (REQUIRED — the
 *                     REAL createLspRealmAssembly product, whoever built it);
 *   memberId          the member whose realms these facts describe;
 *   serverIdentityOf  (memberId, generation) => string | null — the
 *                     integrator's POLICY reader for the server binary
 *                     identity (e.g. policy.argv[0]); null refuses.
 * Returns { ok: true, supply } or { ok: false, code, detail }. supply:
 *   facts / realmIdOf / ensure / policyChange / syncGeneration / drainAll.
 */
export function createA5LspRealmSupply (input = {}) {
  const known = new Set(['assembly', 'memberId', 'serverIdentityOf'])
  for (const key of Object.keys(input)) {
    if (!known.has(key)) return refuseInput(`unknown input key '${key}' — the supply surface is closed`)
  }
  const { assembly, memberId, serverIdentityOf } = input
  if (!isRecord(assembly) || typeof assembly.current !== 'function' || typeof assembly.ensure !== 'function'
    || typeof assembly.policyChange !== 'function' || typeof assembly.disposeAll !== 'function') {
    return refuseInput('assembly must be the published LspRealmAssembly face {ensure, policyChange, dispose?, disposeAll, current, size} (the REAL lsp-assembly product; the supply never forks its semantics)')
  }
  if (typeof memberId !== 'string' || memberId.length === 0) return refuseInput('memberId is REQUIRED (the supply is the member-scoped face of the realm assembly)')
  if (typeof serverIdentityOf !== 'function') return refuseInput('serverIdentityOf (memberId, generation) => string | null is REQUIRED — the server binary identity is a POLICY fact (the realm policy map); it is never inferred from a live handle')

  // ---- the canonical locator law (document/documentRealm/documentScope share it)
  const canonicalOf = (filePath, workspaceRoot) => {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) return null
    if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0) return null
    if (isAbsolute(filePath)) {
      const abs = resolve(filePath)
      return { kind: 'absolute-path', locator: abs, abs }
    }
    const norm = normalize(filePath)
    if (isAbsolute(norm) || norm === '..' || norm.startsWith(`..${sep}`)) return null // escapes the workspace before it resolves: unresolvable, never navigated
    const abs = resolve(workspaceRoot, norm)
    return { kind: 'workspace', locator: norm.split(sep).join('/'), abs }
  }
  const insideRoot = (abs, workspaceRoot) => {
    const ws = resolve(workspaceRoot)
    return abs === ws || abs.startsWith(ws.endsWith(sep) ? ws : `${ws}${sep}`)
  }
  const revisionOf = (abs) => {
    try {
      const st = statSync(abs)
      if (!st.isFile()) return null
      return `stat:v1:${String(st.size)}:${String(Math.trunc(st.mtimeMs))}`
    } catch {
      return null
    }
  }

  const facts = Object.freeze({
    server: () => {
      let instance
      try {
        instance = assembly.current(memberId)
      } catch {
        return null
      }
      if (!isRecord(instance) || typeof instance.generation !== 'string') return null
      let identity
      try {
        identity = serverIdentityOf(memberId, instance.generation)
      } catch {
        return null
      }
      if (typeof identity !== 'string' || identity.length === 0) return null
      return Object.freeze({ binaryIdentity: identity, generation: instance.generation })
    },
    document: (filePath, workspaceRoot) => {
      const c = canonicalOf(filePath, workspaceRoot)
      if (c === null) return null
      const revision = revisionOf(c.abs)
      if (revision === null) return null
      return Object.freeze({ kind: c.kind, canonicalLocator: c.locator, revision })
    },
    documentRealm: (canonicalLocator, workspaceRoot) => {
      // the mapping RIDES the live realm: a member with no assembled realm
      // answers NOTHING (the arm refuses unresolved), an out-of-scope
      // document answers nothing either (the scope obligation owns that
      // refusal; a realm never vouches for a document outside its root).
      const c = canonicalOf(canonicalLocator, workspaceRoot)
      if (c === null) return null
      if (!insideRoot(c.abs, workspaceRoot)) return null
      let instance
      try {
        instance = assembly.current(memberId)
      } catch {
        return null
      }
      if (!isRecord(instance) || typeof instance.realmId !== 'string') return null
      return instance.realmId
    },
    documentScope: (canonicalLocator, workspaceRoot) => {
      const c = canonicalOf(canonicalLocator, workspaceRoot)
      if (c === null) return 'outside'
      return insideRoot(c.abs, workspaceRoot) ? 'inside' : 'outside'
    },
  })

  const supply = Object.freeze({
    ok: true,
    revision: A5_LSP_REALM_SUPPLY_REVISION,
    memberId,
    facts,
    realmIdOf: (generation) => a5LspRealmId(memberId, generation),
    /** R-2 discipline passthroughs — the mount round drives these from the
     *  CURRENT dispatcher generation; the supply adds NO law of its own. */
    ensure: (generation) => assembly.ensure(memberId, generation),
    policyChange: (generation) => assembly.policyChange(memberId, generation),
    /** One call: HOT reuse when the live generation already answers; the
     *  R-2 destroy/rebuild when the generation MOVED; first assembly when
     *  nothing is live. A refusal rides the assembly's own ProviderResult. */
    syncGeneration: async (generation) => {
      const current = assembly.current(memberId)
      if (isRecord(current) && current.generation === generation) return Object.freeze({ ok: true, status: 'hot-reuse', instance: current })
      if (isRecord(current)) {
        const changed = await assembly.policyChange(memberId, generation)
        return Object.freeze({ ok: changed.ok === true, status: changed.ok === true ? 'policy-changed' : 'policy-change-REFUSED', result: changed })
      }
      const created = await assembly.ensure(memberId, generation)
      return Object.freeze({ ok: created.ok === true, status: created.ok === true ? 'assembled' : 'assemble-REFUSED', result: created })
    },
    /** Teardown word for the mount leg: net-zero through the assembly's own
     *  disposeAll (terminate + settle, never a silent drop). */
    drainAll: () => assembly.disposeAll(),
  })
  return supply
}
