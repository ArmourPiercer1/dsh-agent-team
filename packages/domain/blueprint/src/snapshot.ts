/**
 * Blueprint snapshot ref helpers (Architecture §5.2, §5.6, §8.4).
 *
 * The snapshot ref is the contracts-frozen identity triple
 * `{ blueprintId, revision, contentHash }`; its display form is
 * `blueprintId@revision`. Both derive from a parsed, validated, hashed
 * `TeamBlueprint` — never from raw source text, so the ref can only be
 * built for content this module already trusts.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/blueprint/snapshot
 */

import {
  blueprintSnapshotKey,
  createBlueprintSnapshotRef,
} from '../../../contracts/src/index.js'
import type { BlueprintSnapshotRef } from '../../../contracts/src/index.js'

import type { TeamBlueprint } from './types.js'

/**
 * The immutable (deep-frozen) snapshot ref of a parsed blueprint.
 * @param blueprint - a fully parsed blueprint (carries the derived contentHash).
 * @returns the frozen `{ blueprintId, revision, contentHash }` triple.
 */
export function toBlueprintSnapshotRef(blueprint: TeamBlueprint): BlueprintSnapshotRef {
  return createBlueprintSnapshotRef({
    blueprintId: blueprint.blueprintId,
    revision: blueprint.revision,
    contentHash: blueprint.contentHash,
  })
}

/**
 * The `blueprintId@revision` display key of a parsed blueprint.
 * @param blueprint - a fully parsed blueprint.
 * @returns the display key, e.g. `team.alpha@2`.
 */
export function blueprintSnapshotKeyOf(blueprint: TeamBlueprint): string {
  return blueprintSnapshotKey(toBlueprintSnapshotRef(blueprint))
}
