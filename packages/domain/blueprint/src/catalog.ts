/**
 * Blueprint catalog: an in-memory, read-only index of parsed blueprints,
 * keyed by the `(blueprintId, revision)` pair.
 *
 * The domain package owns no I/O: a catalog is built from already-parsed
 * blueprints (`createBlueprintCatalog`) or from a caller-supplied
 * `BlueprintCatalogSource` seam (`createBlueprintCatalogFromSource`), which
 * keeps all file/network access outside this package.
 *
 * Revision ordering (catalog "latest" rule): all-digit revisions first,
 * ascending numerically; then non-digit revisions, ascending
 * lexicographically. `resolveLatest` returns the last revision under this
 * order. Duplicates of a `(blueprintId, revision)` pair fail loudly at
 * construction; resolving a missing id/revision fails loudly at query time.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/blueprint/catalog
 */

import {
  parseBlueprintId,
  parseBlueprintRevision,
  teamContractError,
  TeamContractError,
} from '../../../contracts/src/index.js'
import type { BlueprintSnapshotRef } from '../../../contracts/src/index.js'

import { parseBlueprint } from './validate.js'
import { toBlueprintSnapshotRef } from './snapshot.js'
import type { TeamBlueprint } from './types.js'

/**
 * A read-only source of blueprint source documents. This is the only seam
 * the catalog crosses to reach raw text; it performs no I/O itself.
 */
export interface BlueprintCatalogSource {
  /** The names of all available sources (order not significant). */
  listSources(): readonly string[]
  /** The raw source text of one source. */
  readSource(name: string): string
}

/**
 * A read-only catalog of parsed blueprints.
 */
export interface BlueprintCatalog {
  /** Every blueprint id in the catalog, sorted lexicographically. */
  readonly blueprintIds: readonly string[]
  /** Whether a blueprint id is present in the catalog. */
  hasBlueprint(blueprintId: string): boolean
  /** The revisions of one blueprint, oldest to latest under the catalog order. */
  listRevisions(blueprintId: string): readonly string[]
  /** Resolve one exact `(blueprintId, revision)` pair. */
  resolve(blueprintId: string, revision: string): TeamBlueprint
  /** Resolve the latest revision under the catalog order. */
  resolveLatest(blueprintId: string): TeamBlueprint
  /** The snapshot ref of one exact `(blueprintId, revision)` pair. */
  snapshotOf(blueprintId: string, revision: string): BlueprintSnapshotRef
}

/** A revision that is exactly one or more ASCII digits. */
const DIGIT_REVISION = /^\d+$/

/**
 * The catalog revision order: digit revisions numerically ascending
 * (compared by length, then lexicographically — exact for arbitrary-length
 * digit strings, no `Number` precision loss), then non-digit revisions
 * lexicographically ascending.
 */
function compareRevisions(a: string, b: string): number {
  const aNumeric = DIGIT_REVISION.test(a)
  const bNumeric = DIGIT_REVISION.test(b)
  if (aNumeric && bNumeric) {
    if (a.length !== b.length) return a.length - b.length
    return a < b ? -1 : a > b ? 1 : 0
  }
  if (aNumeric) return -1
  if (bNumeric) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

function notFound(blueprintId: string): never {
  throw teamContractError(
    'MALFORMED_DTO',
    `blueprint not found in catalog: ${blueprintId}`,
    { blueprintId, reason: 'blueprint-not-found' },
  )
}

function buildCatalog(entries: readonly TeamBlueprint[]): BlueprintCatalog {
  const byId = new Map<string, Map<string, TeamBlueprint>>()
  for (const blueprint of entries) {
    const id = blueprint.blueprintId
    let revisions = byId.get(id)
    if (revisions === undefined) {
      revisions = new Map()
      byId.set(id, revisions)
    }
    if (revisions.has(blueprint.revision)) {
      throw teamContractError(
        'MALFORMED_DTO',
        `catalog contains duplicate (blueprintId, revision) pair: ${id}@${blueprint.revision}`,
        {
          blueprintId: id,
          revision: blueprint.revision,
          reason: 'duplicate-blueprint-revision',
        },
      )
    }
    revisions.set(blueprint.revision, blueprint)
  }

  const resolvePair = (rawId: string, rawRevision: string): TeamBlueprint => {
    const id = parseBlueprintId(rawId)
    const revision = parseBlueprintRevision(rawRevision)
    const blueprint = byId.get(id)?.get(revision)
    if (blueprint === undefined) notFound(id)
    return blueprint
  }

  const catalog: BlueprintCatalog = {
    blueprintIds: Object.freeze([...byId.keys()].sort()),
    hasBlueprint: (rawId) => byId.has(parseBlueprintId(rawId)),
    listRevisions: (rawId) => {
      const id = parseBlueprintId(rawId)
      const revisions = byId.get(id)
      if (revisions === undefined) notFound(id)
      return Object.freeze([...revisions.keys()].sort(compareRevisions))
    },
    resolve: resolvePair,
    resolveLatest: (rawId) => {
      const id = parseBlueprintId(rawId)
      const revisions = byId.get(id)
      if (revisions === undefined) notFound(id)
      const ordered = [...revisions.keys()].sort(compareRevisions)
      const latest = ordered[ordered.length - 1]
      if (latest === undefined) notFound(id)
      return resolvePair(id, latest)
    },
    snapshotOf: (rawId, rawRevision) => toBlueprintSnapshotRef(resolvePair(rawId, rawRevision)),
  }
  return Object.freeze(catalog)
}

/**
 * Build a read-only catalog from already-parsed blueprints.
 * @throws `MALFORMED_DTO` (`reason: duplicate-blueprint-revision`) when the
 *   same `(blueprintId, revision)` pair appears twice.
 */
export function createBlueprintCatalog(entries: readonly TeamBlueprint[]): BlueprintCatalog {
  return buildCatalog(entries)
}

/**
 * Parse one named source document, annotating any contract error with the
 * source name so multi-source catalogs stay diagnosable.
 */
function parseNamedSource(source: BlueprintCatalogSource, name: string): TeamBlueprint {
  const text = source.readSource(name)
  try {
    return parseBlueprint(text)
  } catch (error) {
    if (error instanceof TeamContractError) {
      throw teamContractError(error.code, `${error.message} (source: ${name})`, {
        ...(error.details ?? {}),
        sourceName: name,
      })
    }
    throw error
  }
}

/**
 * Build a read-only catalog by reading and parsing every source from a
 * `BlueprintCatalogSource`.
 * @throws `TeamContractError` — the parse error of the offending source
 *   (annotated with `details.sourceName`), or `duplicate-blueprint-revision`
 *   when two sources declare the same `(blueprintId, revision)` pair.
 */
export function createBlueprintCatalogFromSource(
  source: BlueprintCatalogSource,
): BlueprintCatalog {
  const entries = source.listSources().map((name) => parseNamedSource(source, name))
  return buildCatalog(entries)
}
