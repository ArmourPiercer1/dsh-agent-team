/**
 * U6 ARC-A — the PROBE family's mount point (TEST-ONLY lane; see the lane
 * README). The whole point of this file is what it DOES NOT import: no
 * center file, no plane, no product assembly. The family is an ASSEMBLY
 * POINT — it builds its own governance-center faces through the public
 * factory (`createCenterAssembly`), registers its own contribution through
 * the registry's closed origin law, binds its own approval entry, and runs
 * the full walk (plan → one-shot consume → marker-write body → settle) on
 * ITS OWN kernel. If this file could only work by importing the center's
 * private wiring, ARC-A's zero-center-diff claim would be theater.
 *
 * The effect: a marker file `markerDir/<fileName>` containing the call's
 * nonce. THE MARKER FILESYSTEM IS THE ORACLE — refusals must leave it
 * untouched, and every refusal leg of the walk test reads the DIRECTORY,
 * never this module's return value.
 * @module tests/u6-arc-a-probe-family/probe-assembly
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// Seam-resolution law: see probe-contribution.mjs (U6ARC_CENTER_URL /
// U6ARC_CONTRACTS_URL — vitest world = TS sources, Host world = dist).
const CENTER_URL = process.env['U6ARC_CENTER_URL']
  ?? new URL('../../../packages/runtime/governance-center/index.js', import.meta.url).href
const { createCenterAssembly, validateFamilyContribution } = await import(CENTER_URL)
import { buildU6ProbeContribution, PROBE_NAME } from './probe-contribution.mjs'

export const PROBE_FAMILY_ID = 'dsh.u6-probe-family'

/** The family body: the ONE effect this family is declared to have. */
function probeMarkerBody({ markerDir, callId, nonce }) {
  mkdirSync(markerDir, { recursive: true })
  const file = join(markerDir, `${callId}-marker.txt`)
  writeFileSync(file, `${nonce}\n`, 'utf8')
  return file
}

/**
 * Mount the probe family. Returns the family's own faces + the walk.
 * @param {object} input
 * @param {string} input.markerDir        where the effect may write (oracle dir)
 * @param {string} input.scopeKey         the (scopeKey, name) approval scope
 * @param {string} input.definitionIdentity  the definition identity to bind
 * @param {'enforcing'|'shadow'} [input.mode]
 */
export function createU6ProbeAssembly({ markerDir, scopeKey, definitionIdentity = 'def#probe-1', mode = 'enforcing' }) {
  if (typeof markerDir !== 'string' || markerDir.length === 0) throw new Error('U6_PROBE_MARKER_DIR_REQUIRED')
  if (typeof scopeKey !== 'string' || scopeKey.length === 0) throw new Error('U6_PROBE_SCOPE_REQUIRED')

  const definition = {
    name: PROBE_NAME,
    parameters: {
      type: 'object',
      properties: { callId: { type: 'string' }, nonce: { type: 'string' } },
      required: ['callId', 'nonce'],
    },
  }
  const contribution = buildU6ProbeContribution({
    definition,
    cancelBoundary: 'the probe body is synchronous single-write: cancellation can only land before the walk starts',
  })
  const kernelManifest = { capabilities: { 'marker-write': { backsExecution: 'family-body' } } }
  const validated = validateFamilyContribution(contribution, kernelManifest)
  if (validated.ok !== true) {
    throw new Error(`U6_PROBE_CONTRIBUTION_INVALID: ${JSON.stringify(validated)}`)
  }

  // The family's OWN governance center faces — public factory, public API.
  const inFlight = { n: 0 }
  const { registry, kernel } = createCenterAssembly({
    kernelManifest,
    // K3: an enforcing kernel counts REAL in-flight work — the probe
    // assembly supplies the port from its own bookkeeping (this family has
    // no dispatcher: its walk is the body call itself).
    ports: {
      lifecycle: { inflight: () => inFlight.n },
      // The family's own one-shot grant ledger: the PR1 kernel carries no
      // grant authority of its own, so the reviewed family supplies the
      // consume port — the grant here is a marker-ledger fact, bound to
      // (scope, name, callId) and minted once per callId by THIS mount.
      grantConsume: {
        consumeForExecution: (grant, facts) => {
          if (grant?.kind !== 'u6arc-probe-grant' || typeof grant.callId !== 'string') {
            return { ok: false, reason: 'PROBE_GRANT_FOREIGN' }
          }
          if (facts?.definitionIdentity !== undefined && facts.definitionIdentity !== definitionIdentity) {
            return { ok: false, reason: 'PROBE_GRANT_IDENTITY_DRIFT' }
          }
          return { ok: true }
        },
      },
    },
    mode,
    identityOf: () => definitionIdentity,
  })

  const registered = registry.register(contribution, { origin: 'reviewed-manifest' })
  if (registered.ok !== true) {
    throw new Error(`U6_PROBE_REGISTER_REFUSED: ${registered.code} ${registered.detail ?? ''}`)
  }
  const published = kernel.publish()
  if (published.ok !== true) throw new Error(`U6_PROBE_PUBLISH_REFUSED: ${published.code}`)

  /** Bind the approval entry ONCE (the bind-ONCE law, family side). */
  let entryBound = false
  function bindApproval() {
    if (entryBound) return { ok: true, already: true }
    const added = kernel.addApprovalEntry({
      scopeKey,
      nativeName: PROBE_NAME,
      definitionIdentity,
      familyId: PROBE_FAMILY_ID,
    })
    if (added.ok === true) entryBound = true
    return added
  }

  /** The full walk: plan → one-shot consume → body → settle. Every
   *  refusal returns BEFORE the body: the oracle dir stays untouched. */
  async function walk({ callId, nonce, scopeKey: callScope = scopeKey, identity = definitionIdentity, grantId = `grant-${callId}` }) {
    const planned = kernel.decide({ nativeName: PROBE_NAME, scopeKey: callScope, definitionIdentity: identity })
    if (planned.outcome !== 'allow') {
      return { ok: false, stage: 'plan', code: planned.code, detail: planned.detail }
    }
    const grant = { kind: 'u6arc-probe-grant', callId, scopeKey: callScope }
    inFlight.n += 1
    try {
      const consumed = await kernel.consumeOnce(grant, grantId, { definitionIdentity: identity })
      if (consumed.ok !== true) {
        return { ok: false, stage: 'consume', code: consumed.code ?? 'CONSUME_REFUSED', detail: consumed.detail ?? '' }
      }
      const markerFile = probeMarkerBody({ markerDir, callId, nonce })
      return { ok: true, stage: 'executed', markerFile, generation: planned.generation }
    } finally {
      inFlight.n -= 1
    }
  }

  /** Family teardown: drain → tombstone → revoke + drop → release. */
  function teardown() {
    if (kernel.state() === 'RELEASED') return { ok: true, already: true }
    try {
      kernel.beginDrain()
      kernel.tombstone()
      registry.revoke(PROBE_FAMILY_ID, 'the probe family mount was disposed')
      kernel.dropApprovalsForFamily(PROBE_FAMILY_ID)
      return kernel.release()
    } catch (error) {
      return { ok: false, code: 'TEARDOWN_THREW', detail: String(error) }
    }
  }

  return {
    definition,
    contribution,
    registry,
    kernel,
    bindApproval,
    walk,
    teardown,
    faces: () => ({
      state: kernel.state(),
      familyIds: registry.familyIds?.() ?? [],
      generation: registry.generation(),
      approval: kernel.approvalFor(scopeKey, PROBE_NAME) ?? null,
    }),
  }
}
