/**
 * Blueprint identity contract: the stable identity of a TeamBlueprint and
 * of the immutable snapshot a TeamSession binds.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **Blueprint identity** (§5.2): `blueprintId` (stable logical identity)
 *   + `revision` (human-readable) + `contentHash` (machine content
 *   identity). Filesystem path, workspace path, cwd, displayName, and
 *   AgentPreset id must NOT define blueprint identity; moving a blueprint
 *   file or renaming its display name must not change `blueprintId`.
 * - **One TeamSession binds exactly one immutable Blueprint snapshot**
 *   (invariant 10, §8.4): the binding cannot be replaced in place —
 *   `AIUED-ALGO@17` cannot become `AIEO@4` (the `blueprintId@revision`
 *   display form used in the architecture text).
 * - **A valid blueprint contains exactly one complete LeaderTemplate**
 *   (invariant 13) — that validation is the P3-T2 domain's job; this module
 *   freezes only the identity fields.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/ids/blueprint-id
 */

import type { Brand } from './brand.js'
import { assertIsString, assertStringRules } from './common.js'
import { teamContractError } from '../errors.js'

/** Structural max length of a blueprint id. */
export const BLUEPRINT_ID_MAX_LENGTH = 128
/** Structural max length of a human-readable blueprint revision. */
export const BLUEPRINT_REVISION_MAX_LENGTH = 64
/** Structural max length of a blueprint content hash. */
export const BLUEPRINT_CONTENT_HASH_MAX_LENGTH = 256

/**
 * The stable logical identity of a TeamBlueprint.
 *
 * Not a filesystem path, not a display name, not an AgentPreset id
 * (Architecture §5.2). `@` is reserved (it delimits the
 * `blueprintId@revision` snapshot display form, §8.4) and is forbidden.
 */
export type BlueprintId = string & Brand<'BlueprintId'>

/** Human-readable blueprint revision (e.g. `17` in `AIUED-ALGO@17`). */
export type BlueprintRevision = string

/** Machine content identity of the blueprint content. */
export type BlueprintContentHash = string

/**
 * Parse and validate a blueprint id.
 * @param raw - the unknown input.
 * @returns the branded `BlueprintId`.
 * @throws `INVALID_BLUEPRINT_ID` when the value is empty, over 128 chars,
 *   contains control characters or whitespace, or contains the reserved `@`.
 */
export function parseBlueprintId(raw: unknown): BlueprintId {
  const value = assertIsString(raw, 'blueprintId', 'INVALID_BLUEPRINT_ID')
  assertStringRules(value, {
    field: 'blueprintId',
    code: 'INVALID_BLUEPRINT_ID',
    maxLength: BLUEPRINT_ID_MAX_LENGTH,
  })
  if (value.includes('@')) {
    throw teamContractError(
      'INVALID_BLUEPRINT_ID',
      `blueprintId must not contain '@' (reserved for the blueprintId@revision form), got ${JSON.stringify(value)}`,
      { field: 'blueprintId' },
    )
  }
  return value as BlueprintId
}

/**
 * Parse and validate a human-readable blueprint revision.
 * @param raw - the unknown input.
 * @returns the revision string.
 * @throws `INVALID_BLUEPRINT_REVISION` when the value is empty, over 64
 *   chars, contains control characters or whitespace, or contains `@`.
 */
export function parseBlueprintRevision(raw: unknown): BlueprintRevision {
  const value = assertIsString(raw, 'revision', 'INVALID_BLUEPRINT_REVISION')
  assertStringRules(value, {
    field: 'revision',
    code: 'INVALID_BLUEPRINT_REVISION',
    maxLength: BLUEPRINT_REVISION_MAX_LENGTH,
  })
  if (value.includes('@')) {
    throw teamContractError(
      'INVALID_BLUEPRINT_REVISION',
      `revision must not contain '@', got ${JSON.stringify(value)}`,
      { field: 'revision' },
    )
  }
  return value
}

/**
 * Parse and validate a blueprint content hash.
 * @param raw - the unknown input.
 * @returns the content hash string.
 * @throws `INVALID_BLUEPRINT_CONTENT_HASH` when the value is empty, over
 *   256 chars, or contains control characters or whitespace.
 */
export function parseBlueprintContentHash(raw: unknown): BlueprintContentHash {
  const value = assertIsString(raw, 'contentHash', 'INVALID_BLUEPRINT_CONTENT_HASH')
  assertStringRules(value, {
    field: 'contentHash',
    code: 'INVALID_BLUEPRINT_CONTENT_HASH',
    maxLength: BLUEPRINT_CONTENT_HASH_MAX_LENGTH,
  })
  return value
}

/** Type guard for the blueprint id rule. */
export function isBlueprintId(raw: unknown): raw is BlueprintId {
  try {
    parseBlueprintId(raw)
    return true
  } catch {
    return false
  }
}
