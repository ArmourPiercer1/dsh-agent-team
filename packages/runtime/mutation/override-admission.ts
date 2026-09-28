/**
 * P8-S4B (demoted by pre-alpha3 PR-A, ADR-03) — the NARROW persistence
 * primitive of the durable governance overrides: full-slot re-issue +
 * the optimistic generation guard + the durable `put`, with the storage
 * layer as the final SHAPE arbiter.
 *
 * PR-A demotion: this module is NO LONGER a production authority. The
 * production write paths (remote `override.set` / `override.reset`, the
 * dev-harness row) go through the GOVERNANCE MUTATION AUTHORITY
 * (packages/runtime/governance) — the single service that closes the
 * slot by authority, runs the write-time envelope + external-hard
 * checks, serializes on the shared per-team chain, and commits before
 * the ack. This primitive keeps only what a persistence layer owns:
 *
 * - the identity + scope shape rules,
 * - the closed capability vocabulary + `PolicyEntry` shapes,
 * - the slot load (winner selection, frozen `selectPolicyOverrides`
 *   rule) + the identity-conflict + optimistic-generation guards,
 * - the full slot value re-issue (v1 one-record-per-slot) + the durable
 *   `put` (storage re-parses; identical bytes idempotent, different
 *   bytes at the same identity -> `RECORD_DUPLICATE`).
 *
 * What is NOT here (moved to the governance service / slot kernel): the
 * authority -> record mapping and scope closure (the member team-scope
 * / foreign-instance rules), the write-time envelope, the write-time
 * external hard facts, the chain serialization, and the reset path (the
 * service issues the tombstone through the same `put`).
 *
 * Authority vocabulary (kept for the service's port typing):
 *
 * - `leader`  -> `autonomy-overlay` with `origin: 'leader'`;
 * - `member`  -> `autonomy-overlay` with `origin: 'member'`;
 * - `operator`-> `human-override` (never `origin`); the authenticated /
 *   host-known client principal channel.
 *
 * Slot ruling (frozen `selectPolicyOverrides`, P8-S3): exactly ONE record
 * wins per policy slot — team-scope `autonomy-overlay` (templateOverlay),
 * instance-scope `autonomy-overlay` (instanceOverlay), `human-override`
 * (instance beats team at read time) — winner = highest `generation`,
 * ties -> lexicographically smallest `recordId`. Consequence: a
 * cumulative mutation must RE-ISSUE the full slot value set. This
 * primitive merges the current slot winner's `values` with the requested
 * cell changes and persists a NEW record (new `recordId`,
 * `generation = winner + 1`). The store key carries no generation, so
 * the same `recordId` can never be re-put: every mutation needs a fresh
 * identity.
 *
 * Cell semantics are NOT decided here: `values` are lossless JSON per
 * the storage contract; the frozen resolver fails closed on any value it
 * cannot interpret (P8-S3 stage-2 semantics). This primitive validates
 * only the closed capability vocabulary and the `PolicyEntry` value
 * shape.
 *
 * @module @dsh-agent-team/runtime/mutation/override-admission
 */

import {
  CAPABILITY_NAME_VALUES,
  type CapabilityName,
  type PolicyEntry,
} from '../../domain/policy/src/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/index.js'
import { MUTATION_ERROR_CODES, MutationError } from './errors.js'

/** The closed governance override record kinds (storage contract). */
export type GovernanceOverrideKindView = 'autonomy-overlay' | 'human-override'

/** The closed governance override scopes (storage contract). */
export type GovernanceOverrideScopeView = 'team' | 'instance'

/** The closed autonomy-overlay origins (storage contract). */
export type OverlayOriginView = 'leader' | 'member'

/**
 * One persisted governance override as the admission layer reads it —
 * the storage record's field surface, with `values` kept opaque (the
 * storage contract admits any lossless-JSON record; semantic validation
 * belongs to the frozen policy domain at resolution time).
 */
export interface OverrideRecordView {
  /** The stable record identity (one recordId per slot per generation). */
  readonly recordId: string
  /** autonomy-overlay vs explicit human-override. */
  readonly kind: GovernanceOverrideKindView
  /** team-scope vs instance-scope (one slot each, plus the human slots). */
  readonly scope: GovernanceOverrideScopeView
  /** The owning TeamSession. */
  readonly rootSessionId: string
  /** Present exactly when scope is 'instance'. */
  readonly instanceId?: string
  /** Present exactly when kind is 'autonomy-overlay'. */
  readonly origin?: OverlayOriginView
  /** The full slot value set (capability -> PolicyEntry), lossless JSON. */
  readonly values: Record<string, unknown>
  /** The slot generation; starts at 1 and increments per re-issue. */
  readonly generation: number
  /** ISO-8601 write timestamp (injected clock). */
  readonly updatedAt: string
}

/**
 * The async persistence port admission writes through. The real
 * `OverridesRepository` (team_domain store `overrides`) satisfies it via
 * its sync `list` + async `put` (the row wiring adapts); direct tests
 * inject an in-memory port. `put` re-parses the record through the
 * storage schema: identical bytes are idempotent, different bytes at the
 * same identity raise `RECORD_DUPLICATE` (problem `duplicate-override`).
 */
export interface OverrideStorePort {
  /** Every durable override of the TeamSession (any kind/scope). */
  list(rootSessionId: string): Promise<readonly OverrideRecordView[]>
  /** Durably put one record (unknown input; storage re-validates). */
  put(record: unknown): Promise<unknown>
}

/**
 * Who is acting — the §20.3/§20.4 authority channels. The remote / row
 * layer derives this from the authenticated principal (bound Session +
 * TeamDomain identity), never from request-payload claims.
 */
export type MutationAuthority =
  | { readonly kind: 'leader' }
  | { readonly kind: 'member'; readonly instanceId: string }
  | { readonly kind: 'operator' }

/** The identity of one policy slot (the merge / winner domain). */
export interface SlotIdentity {
  readonly kind: GovernanceOverrideKindView
  readonly scope: GovernanceOverrideScopeView
  readonly rootSessionId: string
  /** Present exactly when scope is 'instance'. */
  readonly instanceId?: string
}

/** PersistGovernanceOverrideArgs — one requested durable override re-issue. */
export interface PersistGovernanceOverrideArgs {
  /** The record kind (closed by the CALLING authority upstream). */
  readonly kind: GovernanceOverrideKindView
  /** The traceability origin (required exactly for autonomy-overlay). */
  readonly origin?: OverlayOriginView
  /** The owning TeamSession (clean id). */
  readonly rootSessionId: string
  /** The NEW record identity (clean id, <= 128 chars, no whitespace). */
  readonly recordId: string
  /** The target scope. */
  readonly scope: GovernanceOverrideScopeView
  /** Required exactly when scope is 'instance' (clean id). */
  readonly instanceId?: string
  /**
   * The cell changes for this mutation: a non-empty partial map of
   * CAPABILITY_NAMES keys to a PolicyEntry ({kind:'allow',items:[...]}
   * or {kind:'deny'}). Unmentioned capabilities keep the slot winner's
   * current values (full slot re-issue).
   */
  readonly cells: Record<string, unknown>
  /**
   * Optional optimistic-concurrency guard: the generation the caller
   * believes is the current slot winner. Mismatch (including a stale
   * 0 against an existing winner) -> OVERRIDE_GENERATION_CONFLICT.
   */
  readonly expectedGeneration?: number
  /** The write clock (injected; ISO-8601 strings). */
  readonly now: () => string
}

/** The admitted (persisted) override, as the backend truth. */
export interface AdmittedGovernanceOverride {
  readonly recordId: string
  readonly kind: GovernanceOverrideKindView
  readonly scope: GovernanceOverrideScopeView
  readonly rootSessionId: string
  readonly instanceId?: string
  readonly origin?: OverlayOriginView
  /** The FULL slot value set after this mutation (winner merged with cells). */
  readonly values: Record<string, PolicyEntry>
  /** The new slot generation (winner + 1, or 1 for a fresh slot). */
  readonly generation: number
  readonly updatedAt: string
  /** The previous slot winner's recordId, or null when the slot was empty. */
  readonly supersededRecordId: string | null
}

/** The storage duplicate code string (mirrors TEAM_DOMAIN_ERROR_CODES). */
const STORAGE_RECORD_DUPLICATE = 'RECORD_DUPLICATE'

/** The storage id length cap (mirrors FIELD_ID_MAX_LENGTH). */
const ID_MAX_LENGTH = 128

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function malformed(field: string, problem: string, extra?: Record<string, unknown>): MutationError {
  return new MutationError(
    MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
    `Malformed governance override mutation: ${problem}`,
    { field, problem, ...extra },
  )
}

/** Assert a clean id: non-empty, <= 128 chars, no whitespace. */
function assertCleanId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > ID_MAX_LENGTH || /\s/.test(value)) {
    throw malformed(
      field,
      `must be a non-empty whitespace-free string of at most ${ID_MAX_LENGTH} characters`,
    )
  }
  return value
}

/** Validate one PolicyEntry (closed shape; deny carries nothing else). */
function assertPolicyEntry(capability: string, value: unknown): PolicyEntry {
  if (!isPlainRecord(value)) {
    throw malformed(capability, 'value must be a plain record', { capability })
  }
  if (value['kind'] === 'deny') {
    if (Object.keys(value).length !== 1) {
      throw malformed(capability, "a 'deny' entry carries no other fields", { capability })
    }
    return { kind: 'deny' }
  }
  if (value['kind'] === 'allow') {
    const items = value['items']
    if (!Array.isArray(items) || items.length === 0) {
      throw malformed(capability, "an 'allow' entry requires a non-empty items array", { capability })
    }
    for (const item of items) {
      if (typeof item !== 'string' || item.length === 0) {
        throw malformed(capability, 'every allow item must be a non-empty string', { capability })
      }
    }
    return { kind: 'allow', items: [...items] }
  }
  throw malformed(capability, "kind must be 'allow' or 'deny'", { capability, kind: value['kind'] })
}

function inSlot(record: OverrideRecordView, slot: SlotIdentity): boolean {
  if (record.kind !== slot.kind || record.scope !== slot.scope || record.rootSessionId !== slot.rootSessionId) {
    return false
  }
  if (slot.scope === 'instance') return record.instanceId === slot.instanceId
  return record.instanceId === undefined
}

/**
 * Select the frozen slot winner: the record of the slot with the
 * HIGHEST generation; ties -> lexicographically smallest recordId.
 * Mirrors the frozen `selectPolicyOverrides` slot rule exactly.
 * @param overrides - every durable override of the TeamSession.
 * @param slot - the slot identity.
 * @returns the winning record, or null when the slot is empty.
 */
export function selectSlotWinner(
  overrides: readonly OverrideRecordView[],
  slot: SlotIdentity,
): OverrideRecordView | null {
  let winner: OverrideRecordView | null = null
  for (const record of overrides) {
    if (!inSlot(record, slot)) continue
    if (
      winner === null ||
      record.generation > winner.generation ||
      (record.generation === winner.generation && record.recordId < winner.recordId)
    ) {
      winner = record
    }
  }
  return winner
}

function storageErrorCode(error: unknown): string | undefined {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

/**
 * Persist one durable governance override re-issue (the narrow
 * persistence primitive — see the module doc for what moved to the
 * governance authority in PR-A).
 *
 * Order: kind/origin consistency -> identity/scope shape -> closed cell
 * vocabulary + PolicyEntry shapes -> load durable state -> identity
 * conflict -> optimistic generation -> full slot re-issue (merge winner
 * + cells) -> persist through the store port.
 *
 * @param args - the re-issue request (the kind/origin are closed by the
 *   calling authority upstream — this primitive does not know who acts).
 * @param store - the persistence port (team_domain overrides store).
 * @returns the persisted record view (full slot values, new generation).
 * @throws {@link MutationError} `MALFORMED_MUTATION_INPUT` (bad
 *   id/scope/cell shapes), `OVERRIDE_IDENTITY_CONFLICT` (identity
 *   already occupied, including the storage `RECORD_DUPLICATE` race),
 *   `OVERRIDE_GENERATION_CONFLICT` (stale expectedGeneration).
 */
export async function persistGovernanceOverride(
  args: PersistGovernanceOverrideArgs,
  store: OverrideStorePort,
): Promise<AdmittedGovernanceOverride> {
  // 1. Kind / origin consistency (the storage cross-field rules, typed
  //    here — the calling authority closed them; the storage layer
  //    re-checks on put).
  const kind: GovernanceOverrideKindView = args.kind
  const origin: OverlayOriginView | undefined = args.origin
  if (kind === 'autonomy-overlay' && (origin !== 'leader' && origin !== 'member')) {
    throw malformed('origin', "an autonomy-overlay requires an origin ('leader' | 'member')")
  }
  if (kind === 'human-override' && origin !== undefined) {
    throw malformed('origin', 'a human-override must not carry an origin')
  }

  // 2. Identity + scope shape.
  const rootSessionId = assertCleanId(args.rootSessionId, 'rootSessionId')
  const recordId = assertCleanId(args.recordId, 'recordId')
  const scope: GovernanceOverrideScopeView = args.scope
  if (scope !== 'team' && scope !== 'instance') {
    throw malformed('scope', `must be 'team' or 'instance'`, { scope: args.scope })
  }
  let instanceId: string | undefined
  if (scope === 'instance') {
    instanceId = assertCleanId(args.instanceId, 'instanceId')
  } else if (args.instanceId !== undefined) {
    throw malformed('instanceId', "team scope must not carry instanceId")
  }

  // 3. Closed capability vocabulary + PolicyEntry shapes.
  if (!isPlainRecord(args.cells) || Object.keys(args.cells).length === 0) {
    throw malformed('cells', 'cells must be a non-empty record of capability entries')
  }
  const cells: Record<string, PolicyEntry> = {}
  for (const [capability, entry] of Object.entries(args.cells)) {
    if (!(CAPABILITY_NAME_VALUES as readonly string[]).includes(capability)) {
      throw malformed('cells', `unknown capability (closed vocabulary: ${CAPABILITY_NAME_VALUES.join(', ')})`, {
        capability,
      })
    }
    cells[capability as CapabilityName] = assertPolicyEntry(capability, entry)
  }

  // 4. Load the durable truth, check identity conflict, find the slot winner.
  const existing = await store.list(rootSessionId)
  const slot: SlotIdentity = { kind, scope, rootSessionId, ...(instanceId !== undefined ? { instanceId } : {}) }
  const conflict = existing.find((record) => inSlot(record, slot) && record.recordId === recordId)
  if (conflict !== undefined) {
    throw new MutationError(
      MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT,
      `a governance override already exists at recordId ${recordId} (generation ${conflict.generation})`,
      { recordId, existingGeneration: conflict.generation },
    )
  }
  const winner = selectSlotWinner(existing, slot)

  // 5. Optimistic generation guard (stale readers must not clobber).
  const actualGeneration = winner === null ? 0 : winner.generation
  if (args.expectedGeneration !== undefined && args.expectedGeneration !== actualGeneration) {
    throw new MutationError(
      MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT,
      'the slot winner moved since the caller read it',
      { expectedGeneration: args.expectedGeneration, actualGeneration },
    )
  }

  // 6. Re-issue the FULL slot value set (v1 one-record-per-slot ruling).
  const winnerValues: Record<string, PolicyEntry> =
    winner === null ? {} : (winner.values as Record<string, PolicyEntry>)
  const values: Record<string, PolicyEntry> = { ...winnerValues, ...cells }

  // 7. Build the storage record (the storage layer re-validates the shape).
  const updatedAt = args.now()
  const record: Record<string, unknown> = {
    schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
    kind,
    recordId,
    scope,
    rootSessionId,
    values,
    generation: actualGeneration + 1,
    updatedAt,
  }
  if (instanceId !== undefined) record['instanceId'] = instanceId
  if (origin !== undefined) record['origin'] = origin

  // 8. Persist (storage is the final shape arbiter + idempotency gate).
  try {
    await store.put(record)
  } catch (error) {
    if (storageErrorCode(error) === STORAGE_RECORD_DUPLICATE) {
      throw new MutationError(
        MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT,
        `the governance override identity ${recordId} is already occupied`,
        { recordId, problem: 'duplicate-override' },
      )
    }
    throw error
  }

  return {
    recordId,
    kind,
    scope,
    rootSessionId,
    ...(instanceId !== undefined ? { instanceId } : {}),
    ...(origin !== undefined ? { origin } : {}),
    values,
    generation: actualGeneration + 1,
    updatedAt,
    supersededRecordId: winner === null ? null : winner.recordId,
  }
}
