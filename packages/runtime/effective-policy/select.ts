/**
 * The deterministic overlay/override selection from the durable `overrides`
 * store into the policy resolver's overlay slots (step 8 input half) — the
 * frozen P8-S4B selection, relocated verbatim (pre-alpha3 PR-B) from
 * `activation/checks.ts` into the canonical read plane so the ONE assembly
 * entry imports its building blocks without a module cycle. The
 * `activation` package re-exports it unchanged (API surface intact).
 *
 * Mapping (closed, documented ruling):
 * - `kind: 'autonomy-overlay'`, `scope: 'team'` → the `templateOverlay`
 *   slot;
 * - `kind: 'autonomy-overlay'`, `scope: 'instance'` (this instance) → the
 *   `instanceOverlay` slot;
 * - `kind: 'human-override'` → the `humanOverride` slot (the instance-
 *   scoped record wins over the team-scoped one, per the policy contract);
 * - multiple candidates for one slot: the HIGHEST `generation` wins, ties
 *   broken by the LEXICOGRAPHICALLY SMALLEST `recordId` (deterministic;
 *   multi-overlay composition is owned by the later governance work).
 *
 * The stored `values` payload passes through UNTOUCHED: the policy resolver
 * re-validates it (a malformed stored payload fails closed in step 8).
 *
 * @param overrides - the durable governance override records (all teams).
 * @param rootSessionId - the team (root) session id.
 * @param instanceId - the instance being activated.
 * @returns the selected overlay slots (absent when no candidate exists).
 */

import { parseRootSessionId } from '../../contracts/src/index.js'
import type {
  AutonomyOverlayRecord,
  HumanOverrideRecord,
  PolicyEntry,
} from '../../domain/policy/src/index.js'
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js'

export function selectPolicyOverrides(
  overrides: readonly GovernanceOverrideRecord[],
  rootSessionId: string,
  instanceId: string,
): {
  readonly templateOverlay?: AutonomyOverlayRecord
  readonly instanceOverlay?: AutonomyOverlayRecord
  readonly humanOverride?: HumanOverrideRecord
} {
  const root = parseRootSessionId(rootSessionId)
  const inTeam = (record: GovernanceOverrideRecord): boolean => record.rootSessionId === root
  const candidates = (
    records: readonly GovernanceOverrideRecord[],
  ): readonly GovernanceOverrideRecord[] =>
    records.slice().sort((a, b) => {
      if (a.generation !== b.generation) return a.generation < b.generation ? 1 : -1
      return a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0
    })
  const templateCandidates = candidates(
    overrides.filter((record) => inTeam(record) && record.scope === 'team' && record.kind === 'autonomy-overlay'),
  )
  const instanceCandidates = candidates(
    overrides.filter(
      (record) =>
        inTeam(record) && record.scope === 'instance' && record.instanceId === instanceId && record.kind === 'autonomy-overlay',
    ),
  )
  const humanTeam = candidates(
    overrides.filter((record) => inTeam(record) && record.scope === 'team' && record.kind === 'human-override'),
  )
  const humanInstance = candidates(
    overrides.filter(
      (record) => inTeam(record) && record.scope === 'instance' && record.instanceId === instanceId && record.kind === 'human-override',
    ),
  )
  const result: {
    templateOverlay?: AutonomyOverlayRecord
    instanceOverlay?: AutonomyOverlayRecord
    humanOverride?: HumanOverrideRecord
  } = {}
  const template = templateCandidates[0]
  if (template !== undefined && template.origin !== undefined) {
    result.templateOverlay = {
      overlayId: template.recordId,
      kind: 'template',
      origin: template.origin,
      values: template.values as Partial<Record<string, PolicyEntry>>,
    }
  }
  const instance = instanceCandidates[0]
  if (instance !== undefined && instance.origin !== undefined) {
    result.instanceOverlay = {
      overlayId: instance.recordId,
      kind: 'instance',
      origin: instance.origin,
      values: instance.values as Partial<Record<string, PolicyEntry>>,
    }
  }
  const human = humanInstance[0] !== undefined ? humanInstance[0] : humanTeam[0]
  if (human !== undefined) {
    result.humanOverride = {
      overrideId: human.recordId,
      scope: human.scope,
      values: human.values as Partial<Record<string, PolicyEntry>>,
    }
  }
  return result
}
