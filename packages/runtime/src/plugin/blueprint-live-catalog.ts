/**
 * Live BlueprintCatalog facade (issue #2 blueprint-loading parallel
 * repair, plan BP5 preparation / BP4 §8 "live facade").
 *
 * The domain's `BlueprintCatalog` interface (packages/domain/blueprint
 * catalog.ts) describes a STATIC, build-once index. Production needs the
 * SAME surface over the LIVE authority state: the union of frozen
 * registry rows, the rescan-per-request saved sources, and the bootstrap
 * anchor. This facade implements the interface by delegating EVERY method
 * call to the authority (no install-lifetime directory snapshot — the
 * static catalog's construction-time freeze is precisely the defect the
 * repair removes):
 *
 *   - `blueprintIds` / `hasBlueprint` / `listRevisions` → the CURRENT
 *     identity union (identity-level only — plan §7.4: one logically
 *     broken saved Blueprint is still listed and only fails when
 *     RESOLVED);
 *   - `resolve` / `resolveLatest` / `snapshotOf` → the authority's
 *     resolve (registry precedence, then the current mutable source,
 *     strong-parsed on demand).
 *
 * Semantics stay pinned to the static catalog: the same not-found wording
 * (`MALFORMED_DTO` `blueprint-not-found`), the same revision order
 * (`compareBlueprintRevisions` — exported from the domain for exactly this
 * sharing), the same `snapshotOf` derivation (`toBlueprintSnapshotRef`).
 *
 * Read-only: the facade exposes NO write surface (freezing goes through
 * the authority's `freezeSnapshot`, owned by the BP6 barrier).
 *
 * @module @dsh-agent-team/runtime/src/plugin/blueprint-live-catalog
 */

import {
  blueprintNotFound,
  compareBlueprintRevisions,
  toBlueprintSnapshotRef,
} from '../../../domain/blueprint/src/index.js'
import type { BlueprintCatalog } from '../../../domain/blueprint/src/index.js'
import { parseBlueprintId } from '../../../contracts/src/index.js'

import type { BlueprintAuthority } from './blueprint-authority.js'

/**
 * Build the live `BlueprintCatalog` over one authority. Every access
 * observes the current state (fresh scan).
 */
export function createLiveBlueprintCatalog(authority: BlueprintAuthority): BlueprintCatalog {
  const identities = (): readonly import('./blueprint-authority.js').BlueprintIdentity[] =>
    authority.listIdentities()

  const revisionsOf = (blueprintId: string): string[] => {
    const revisions: string[] = []
    for (const identity of identities()) {
      if (identity.blueprintId === blueprintId) revisions.push(identity.revision)
    }
    return revisions
  }

  return {
    get blueprintIds() {
      const ids = new Set<string>()
      for (const identity of identities()) ids.add(identity.blueprintId)
      return Object.freeze([...ids].sort())
    },

    hasBlueprint: (rawId) => {
      const blueprintId = parseBlueprintId(rawId)
      for (const identity of identities()) {
        if (identity.blueprintId === blueprintId) return true
      }
      return false
    },

    listRevisions: (rawId) => {
      const blueprintId = parseBlueprintId(rawId)
      const revisions = revisionsOf(blueprintId)
      if (revisions.length === 0) blueprintNotFound(blueprintId)
      return Object.freeze(revisions.sort(compareBlueprintRevisions))
    },

    resolve: (rawId, rawRevision) => authority.resolve(rawId, rawRevision),

    resolveLatest: (rawId) => authority.resolve(rawId),

    snapshotOf: (rawId, rawRevision) => toBlueprintSnapshotRef(authority.resolve(rawId, rawRevision)),
  }
}
