/**
 * census/inventory — the ObservedRuntimeInventory contract (U7-0 / EB2-A).
 *
 * WHAT THIS IS: the closed shape of one RUNTIME OBSERVATION — every tool
 * visible in every scope the probe row reached inside ONE live Host boot,
 * each row carrying the live Definition's placement identity (the shared
 * tool-dispatch WeakMap algebra via `definitionIdentityOf`), the digest of
 * its model-facing shape, the observed registration-generation counter, and
 * the comparison of its identity against the same name's identity in the
 * GLOBAL scope (`identity_vs_global`) — the public, name-free signal the
 * reconciler uses to see a governed same-name takeover row in a Team lane.
 *
 * DIGEST LAW (pinned by schema + tests): `snapshot_digest` covers ONLY the
 * cross-boot-stable facts — scope kind/team_lane plus, per tool, name /
 * schema_digest / identity_vs_global / observed_in. The in-process fields
 * (`definition_identity`, `change_seq`, `observed_change_seq`) are recorded
 * for IN-BOOT comparisons (a swap between two same-boot snapshots is the
 * live DRIFT plant) but NEVER enter the digest, because `def#N` numbers are
 * per-boot counter values — hashing them would make the "fixed snapshot
 * digest" move on every restart and stop being a baseline.
 *
 * @module census/inventory
 */
import { canonicalDigest } from './json-canonical.mjs'

export const OBSERVED_SCHEMA = 'u7-0/observed-runtime-inventory/v1'

/** The fields whose canonical form the snapshot digest covers. */
export function digestEligibleView(inventory) {
  return {
    schema: inventory.schema,
    world_kind: inventory.world.kind,
    host_sha: inventory.world.host_sha,
    scopes: inventory.scopes.map((s) => ({
      scope_id: s.scope_id,
      kind: s.kind,
      team_lane: s.team_lane === true,
      tools: [...s.tools]
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .map((t) => ({
          name: t.name,
          schema_digest: t.schema_digest,
          identity_vs_global: t.identity_vs_global,
          source_class: typeof t.source_class === 'string' ? t.source_class : 'unattributed',
        })),
    })).sort((a, b) => {
      const ka = `${a.scope_id}|${a.kind}|${String(a.team_lane)}|${a.tools.map((t) => t.name).join(',')}`
      const kb = `${b.scope_id}|${b.kind}|${String(b.team_lane)}|${b.tools.map((t) => t.name).join(',')}`
      return ka < kb ? -1 : ka > kb ? 1 : 0
    }),
  }
}

/**
 * Validate the OBSERVED_INVENTORY subset this module owns (closed; the
 * full machine schema lives in `observed-runtime-inventory.schema.json` and
 * the C1 test validates fixtures against it — this function is the cheap
 * runtime guard used by the assembly and the reconciler).
 * @param {any} inv
 * @returns {string[]} violations (empty = ok)
 */
export function inventoryViolations(inv) {
  const bad = []
  if (inv?.schema !== OBSERVED_SCHEMA) bad.push(`schema must be ${OBSERVED_SCHEMA}`)
  if (typeof inv?.world?.host_sha !== 'string' || !/^[0-9a-f]{40}$/.test(inv.world.host_sha)) bad.push('world.host_sha must be 40-hex')
  if (inv?.world?.kind !== 'non-team' && inv?.world?.kind !== 'governed-team') bad.push("world.kind must be 'non-team' | 'governed-team'")
  if (!Array.isArray(inv?.scopes) || inv.scopes.length === 0) bad.push('scopes must be a non-empty array')
  const seenScope = new Set()
  for (const s of inv?.scopes ?? []) {
    if (typeof s?.scope_id !== 'string' || s.scope_id === '') bad.push('scope.scope_id missing')
    else if (seenScope.has(s.scope_id)) bad.push(`duplicate scope_id ${s.scope_id}`)
    else seenScope.add(s.scope_id)
    if (s?.kind !== 'global' && s?.kind !== 'agent') bad.push(`scope ${String(s?.scope_id)}: kind must be global|agent`)
    if (typeof s?.team_lane !== 'boolean') bad.push(`scope ${String(s?.scope_id)}: team_lane must be boolean`)
    if (!Array.isArray(s?.tools)) bad.push(`scope ${String(s?.scope_id)}: tools must be an array`)
    const seenTool = new Set()
    for (const t of s?.tools ?? []) {
      if (typeof t?.name !== 'string' || t.name === '') bad.push(`scope ${String(s?.scope_id)}: tool name missing`)
      else if (seenTool.has(t.name)) bad.push(`scope ${String(s?.scope_id)}: duplicate tool ${t.name}`)
      else seenTool.add(t.name)
      if (typeof t?.schema_digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(t.schema_digest ?? '')) bad.push(`scope ${String(s?.scope_id)} tool ${String(t?.name)}: schema_digest must be sha256:<hex>`)
      if (t?.definition_identity !== null && typeof t?.definition_identity !== 'string') bad.push(`scope ${String(s?.scope_id)} tool ${String(t?.name)}: definition_identity must be string|null`)
      if (!['same', 'differs', 'n/a'].includes(t?.identity_vs_global)) bad.push(`scope ${String(s?.scope_id)} tool ${String(t?.name)}: identity_vs_global must be same|differs|n/a`)
      if (t?.change_seq !== null && !Number.isInteger(t?.change_seq)) bad.push(`scope ${String(s?.scope_id)} tool ${String(t?.name)}: change_seq must be int|null`)
      if (t?.provider_identity !== undefined && typeof t.provider_identity !== 'string') bad.push(`scope ${String(s?.scope_id)} tool ${String(t?.name)}: provider_identity must be a string when present (NOT_OBSERVABLE is the honest public-seam value)`)
    }
  }
  return bad
}

/**
 * Attach the digest fields. Pure: returns a NEW inventory whose
 * `snapshot_digest` is the canonical digest of the digest-eligible view and
 * whose `full_digest` covers every recorded byte (audit binding; it moves
 * across boots by design and is never the baseline digest).
 * @param {any} inventory
 */
export function withDigests(inventory) {
  return {
    ...inventory,
    snapshot_digest: canonicalDigest(digestEligibleView(inventory)),
    full_digest: canonicalDigest(inventory),
  }
}

/** Names observed in at least one scope of this inventory (dedup set). */
export function observedNames(inventory) {
  const names = new Set()
  for (const s of inventory.scopes) for (const t of s.tools) names.add(t.name)
  return names
}

/**
 * The first (deterministic order: scope_id then name) row for `name`.
 * @param {any} inventory
 * @param {string} name
 */
export function findRow(inventory, name) {
  const scopes = [...inventory.scopes].sort((a, b) => (a.scope_id < b.scope_id ? -1 : 1))
  for (const s of scopes) for (const t of s.tools) if (t.name === name) return { scope: s, tool: t }
  return null
}
