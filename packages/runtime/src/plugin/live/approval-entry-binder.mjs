/**
 * u7-w0b S2 — the ONE approval-entry binder of the governed plane.
 *
 * Before this module the plane carried five near-copies
 * (`ensure{Read,FsMutation,Bash,Search,Jobs}ApprovalEntry`) that differed
 * ONLY in (1) a per-family gate flag, (2) where the native name came from,
 * (3) the latch shape, and (4) a caller-supplied `familyId` literal (see
 * `dev/agent-workflow/evidence/u7-w0b-20261026/S1-MAP.md` §2). This binder
 * is that law written once:
 *
 *   - CLAIM GATE: a name binds only if a family REGISTERED ON THIS MOUNT
 *     claims it. `claimOf(name)` answers the claiming familyId from the
 *     mount-time claim table (taken from the registered descriptors'
 *     `visibility.nativeNames` right after registration — never from the
 *     caller, never from a live registry lookup at consult time, so a
 *     revoke-then-re-register can not change who the mount says claims a
 *     name). No claim ⇒ null, NOT latched (the old per-family flag gate).
 *   - BIND ONCE per (scopeKey, name): the first consult that finds a placed,
 *     minted Definition latches the name and adds the entry; the latch is
 *     never cleared inside this mount.
 *   - PRE-MINT IS NOT LATCHED: a placed Definition whose identity is not yet
 *     minted answers null without latching — a later consult inside the
 *     same lookup window may still bind (the pb §6 lookup-time law).
 *   - INVALIDATION GOES SILENT: once latched, an entry the kernel no longer
 *     answers (revoke, re-registration, generation or digest drift) reads as
 *     null forever — a lookup never re-mints and a re-registration never
 *     resurrects; only the next reviewed mount (a fresh kernel) approves.
 *
 * The binder holds no authority of its own: it calls the kernel's
 * `approvalFor` / `addApprovalEntry` exactly as the copies did, with the
 * same arguments, in the same order.
 *
 * @module runtime/plugin/live/approval-entry-binder
 */

/**
 * @param {object} deps
 * @param {{ approvalFor(scopeKey: string, nativeName: string): object | undefined,
 *           addApprovalEntry(entry: { scopeKey: string, nativeName: string, definitionIdentity: string, familyId: string }): { ok: boolean } }} deps.kernel
 * @param {string} deps.scopeKey - the mount's scope (FIX-K K4)
 * @param {(name: string) => string | undefined} deps.claimOf - mount-time claim table
 * @param {(name: string) => object | undefined} deps.placedDefinition - the placed row for a name
 * @param {(definition: object) => string | null} deps.identityOf - the seam's identity mint
 * @returns {(name: string) => object | null}
 */
export function createApprovalEntryBinder({ kernel, scopeKey, claimOf, placedDefinition, identityOf }) {
  const attempted = new Map()
  return function ensureApprovalEntry(name) {
    if (typeof name !== 'string') return null
    const familyId = claimOf(name)
    if (typeof familyId !== 'string') return null
    const existing = kernel.approvalFor(scopeKey, name)
    if (existing !== undefined) return existing
    if (attempted.get(name) === true) return null // invalidated/failed — never rebound in this mount
    const d = placedDefinition(name)
    if (d === undefined) return null
    const identity = identityOf(d)
    // Not minted yet: NO entry and NO latch (see the module header).
    if (identity === null) return null
    attempted.set(name, true)
    const added = kernel.addApprovalEntry({
      scopeKey,
      nativeName: name,
      definitionIdentity: identity,
      familyId,
    })
    if (added.ok !== true) return null // no live claiming candidate / non-ACTIVE — fail closed
    return kernel.approvalFor(scopeKey, name) ?? null
  }
}

/**
 * The mount-time claim table: every native name each REGISTERED candidate's
 * descriptor claims, mapped to that candidate's familyId. Taken once, right
 * after the mount's registrations.
 *
 * @param {{ view(): { candidates: readonly { familyId: string, state: string, contribution: { visibility: { nativeNames: readonly string[] } } }[] } }} registry
 * @returns {ReadonlyMap<string, string>}
 */
export function claimTableOf(registry) {
  const table = new Map()
  for (const c of registry.view().candidates) {
    // Only a reviewed, live candidate claims (a dynamic-source candidate
    // lands NOT_VERIFIED and claims nothing here). Aliases are deliberately
    // not claim keys: no governed row has ever bound under an alias.
    if (c.state !== 'candidate') continue
    for (const n of c.contribution.visibility.nativeNames) table.set(n, c.familyId)
  }
  return table
}
