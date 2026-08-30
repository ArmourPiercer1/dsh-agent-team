/**
 * P6-T2 — step 3 of the documented enforcement order: caller authority +
 * mutation envelope.
 *
 * The mutation envelope is the operation-level allow/deny boundary of the
 * caller's authority (Architecture §5.4/§19.3). The P6-T1
 * `computeOverlayBounds` semantics are REUSED, not forked: an operation is
 * in-bounds only when every applicable allow-set allows it and no
 * applicable deny-set denies it — an absent envelope or an absent operation
 * is OUT OF BOUNDS, the boundary fails closed.
 *
 * Per-role envelope (documented):
 * - `human`: NOT bounded by the team autonomy envelope (invariant 34: the
 *   human override may exceed team autonomy). The External Hard Policy is
 *   per-CAPABILITY (ExternalPolicyFacts.hard), enforced by the policy
 *   resolver at the capability level; the v1 contracts carry no op-level
 *   external hard deny, so every closed op is human-allowed. (Documented
 *   ruling — no invented op-level external vocabulary.)
 * - `leader`: the team autonomy envelope — `blueprint.teamEnvelope`
 *   (invariant 36: the leader never exceeds it). When the blueprint also
 *   carries a member-envelope entry for the leader template, that entry is
 *   additionally intersected (it only tightens).
 * - `member`: the team envelope ∩ the member template's envelope ∩ the
 *   member's instance autonomy overlay (when stored). The overlay's
 *   operation-level bounds live under the `envelope` key of the record's
 *   free-form `values` field (P6-T2 convention for the storage schema's
 *   `values: RemoteSafeRecord`; the policy-domain cell interpretation of
 *   the same field is untouched and orthogonal). An overlay WITHOUT an
 *   `envelope` key constrains no operations (capability-cell overlays).
 *
 * Self-escalation (invariant 37): a member's envelope is the
 * INTERSECTION of team + template (+ overlay) — a member cannot grant
 * itself an operation none of its three allow-sets contains. There is no
 * self-grant path in the facade (overlays are written by other authority,
 * never by the member being bounded).
 */

import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from './errors.js'
import type { ActionSpec } from './actions.js'
import type { ResolvedCaller } from './resolve.js'

/**
 * Extract the operation-level envelope from one durable override record's
 * free-form `values` (the P6-T2 convention). Returns undefined when the
 * record carries no op-level envelope (capability-cell overlays).
 */
export function overlayEnvelopeOf(record: GovernanceOverrideRecord):
  | { readonly allow?: readonly string[]; readonly deny?: readonly string[] }
  | undefined {
  const values = record.values
  if (values === null || typeof values !== 'object') return undefined
  const envelope = values['envelope']
  if (
    envelope === null ||
    typeof envelope !== 'object' ||
    Array.isArray(envelope)
  ) {
    return undefined
  }
  const allow = envelope['allow']
  const deny = envelope['deny']
  if (
    allow !== undefined &&
    (!Array.isArray(allow) || !allow.every((item) => typeof item === 'string'))
  ) {
    return undefined
  }
  if (deny !== undefined && (!Array.isArray(deny) || !deny.every((item) => typeof item === 'string'))) {
    return undefined
  }
  return {
    ...(allow !== undefined ? { allow: allow as readonly string[] } : {}),
    ...(deny !== undefined ? { deny: deny as readonly string[] } : {}),
  }
}

/**
 * The caller's effective mutation envelope (the in-bounds op set,
 * deterministic order, fail closed).
 *
 * @param blueprint - the resolved bound blueprint.
 * @param caller - the resolved caller.
 * @param overrides - the team's durable governance override records.
 * @returns the in-bounds mutation operations.
 */
export function callerEnvelope(
  blueprint: TeamBlueprint,
  caller: ResolvedCaller,
  overrides: readonly GovernanceOverrideRecord[],
): readonly string[] {
  if (caller.role === 'human') {
    // Invariant 34: the human is not team-envelope-bound; the closed op
    // vocabulary is the ceiling (the resolver's capability-level external
    // facts are the hard boundary, applied per capability).
    return ALL_MUTATION_OPS
  }
  const teamDeny = new Set(blueprint.teamEnvelope?.deny ?? [])
  const templateId = caller.callerMember?.templateId
  const memberEntry =
    templateId !== undefined
      ? blueprint.memberEnvelopes.find((entry) => String(entry.templateId) === templateId)
      : undefined
  const templateAllow = new Set(memberEntry?.envelope.allow ?? [])
  const templateDeny = new Set(memberEntry?.envelope.deny ?? [])
  // Start from the team allow list; intersect the template allow set for
  // members (and for a leader when a leader template entry exists).
  const bounds: string[] = []
  for (const operation of blueprint.teamEnvelope?.allow ?? []) {
    if (teamDeny.has(operation) || templateDeny.has(operation)) continue
    if (caller.role === 'member' && !templateAllow.has(operation)) continue
    if (caller.role === 'leader' && memberEntry !== undefined && !templateAllow.has(operation)) {
      continue
    }
    bounds.push(operation)
  }
  // The member's instance autonomy overlay (when stored) further narrows.
  if (caller.role === 'member' && caller.callerMember !== undefined) {
    const instanceId = caller.callerMember.instanceId
    const overlayRecords = overrides
      .filter(
        (record) =>
          record.kind === 'autonomy-overlay' &&
          record.scope === 'instance' &&
          record.instanceId === instanceId,
      )
      .sort((a, b) => (a.generation < b.generation ? 1 : a.generation > b.generation ? -1 : 0))
    const overlay = overlayRecords[0]
    if (overlay !== undefined) {
      const envelope = overlayEnvelopeOf(overlay)
      if (envelope !== undefined) {
        const overlayDeny = new Set(envelope.deny ?? [])
        const overlayAllowPresent = envelope.allow !== undefined
        const overlayAllow = new Set(envelope.allow ?? [])
        return bounds.filter(
          (operation) => !overlayDeny.has(operation) && (!overlayAllowPresent || overlayAllow.has(operation)),
        )
      }
    }
  }
  return bounds
}

/**
 * The complete closed mutation-operation vocabulary (the human ceiling and
 * the envelope-check reference).
 */
export const ALL_MUTATION_OPS: readonly string[] = [
  'assign-task',
  'create-member',
  'send-message',
  'report-progress',
  'request-control',
  'resolve-control',
  'archive-member',
  'restore-member',
  'dispose-member',
]

/**
 * Step 3 — enforce the action's required ops against the caller's
 * effective envelope (fail closed).
 *
 * @param spec - the action spec.
 * @param envelope - the caller's effective envelope (in-bounds ops).
 * @throws {@link TeamRuntimeError} ENVELOPE_OUT_OF_BOUNDS.
 */
export function enforceEnvelope(spec: ActionSpec, envelope: readonly string[]): void {
  if (spec.ops === undefined || spec.ops.length === 0) return
  const inBounds = new Set(envelope)
  for (const op of spec.ops) {
    if (!inBounds.has(op)) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
        `TeamRuntime: operation '${op}' (action '${spec.name}') is outside the caller's mutation envelope — the boundary fails closed`,
        { action: spec.name, op, requiredOps: [...spec.ops], inBounds: [...inBounds] },
      )
    }
  }
}

// Re-export the leader id so callers need one import point for step 3.
export { LEADER_INSTANCE_ID }
