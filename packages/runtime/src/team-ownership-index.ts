/**
 * D1 (Team D1-D6 repair v2) — the pure durable ownership / root-identity
 * index of the TeamDomain.
 *
 * This module answers ONE question from durable rows only: "which Team
 * roots exist, and for each, what is its blueprint identity, generation,
 * creation time, and member/child-session attribution?" It is the
 * production backing of the remote contract v3-only `team.listRoots`
 * method (host wiring in `plugin/s6-remote.ts`; the client feed of the
 * Team UI zero state).
 *
 * **Purity**: the module reads through an already-open
 * {@link TeamDomainRepositories} facade (`teamSessions`,
 * `memberInstances`, `sessionBindings` only). It performs NO repository
 * writes, NO agent effects, NO host-backend I/O, NO clock or random
 * reads — the output is a pure function of the durable rows.
 *
 * **Determinism (rebuild-identical)**: roots come from
 * `teamSessions.list()` (sorted by root session id, repository contract)
 * and attribution entries are re-sorted by instance id (the repository's
 * own sort order). Rebuilding the index twice over the same rows —
 * including after closing and re-opening the domain — yields
 * byte-identical output (`JSON.stringify` of the row array).
 *
 * **Fail-closed contract (exact conditions, pinned by
 * `test/d1-team-ownership-index.test.ts`)** — the index NEVER degrades
 * to a silent empty or partial list; every inconsistency is a typed
 * {@link TeamOwnershipIndexError} whose string `code` is a member of the
 * closed remote backing vocabulary (`REMOTE_BACKING_ERROR_CODE_SET` in
 * `packages/remote/src/handlers/dispatch.ts`) and therefore survives
 * both dispatchers unchanged (invariant 4b):
 *
 * 1. **Corrupt / undecodable row** — a row that fails repository parsing
 *    (malformed JSON, unknown fields, bad ids) raises the storage layer's
 *    own typed error (`RECORD_INVALID` / `MALFORMED_DTO` / …) from the
 *    read itself; the index propagates it as-is (never swallowed).
 * 2. **`TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH`** — a root's
 *    `sessionBindings` row EXISTS but its `kind` is not `team-root`
 *    (e.g. `ordinary` or `team-member`): the root identity is
 *    contradicted by the binding layer.
 * 3. **`TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH`** — a member's
 *    child-session binding row EXISTS but its `kind` is not
 *    `team-member` (e.g. `ordinary` or `team-root`); or a v1 member
 *    record somehow lacks its required `childSessionId` (unreachable
 *    through the validated repositories — the guard is defensive and
 *    still fails closed).
 * 4. **`TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT`** — a `team-member`
 *    binding row exists for a member's child session but does NOT agree
 *    with the member record: `binding.rootSessionId !== record.rootSessionId`,
 *    `binding.instanceId !== record.instanceId`, or
 *    `binding.sessionId !== record.childSessionId` (the composite member
 *    identity, invariant 18, is the reconciliation key).
 *
 * **Documented NON-failures** (legitimate intermediate states, NOT
 * inconsistencies):
 * - a root record WITHOUT a `team-root` binding row: the fresh-root
 *   write order commits the TeamSession record FIRST and puts the
 *   binding row after (a crash between the two leaves exactly this
 *   state — see `root-binding/fresh-root.ts` step 4);
 * - a member child session WITHOUT a binding row: the per-session kind
 *   is optional in the index output (`kind` absent) — the member record
 *   still carries its `childSessionId` (invariant 23) and the
 *   attribution row is emitted with `kind` undefined.
 *
 * **Leader exclusion**: `memberCount` and `attribution` EXCLUDE the
 * Leader row (`instanceId === 'inst-leader'`) in BOTH its v2 form
 * (`schemaVersion: 2`, no `childSessionId`/`lifecycle` — the Leader IS
 * the Root Session, invariant 13) and its legacy v1 harness form
 * (`instanceId: 'inst-leader'` WITH a `childSessionId`).
 *
 * **Wire shape (frozen by D1, consumed by D2/D3)**: the remote-safe row
 * of the v3 `team.listRoots` response is exactly
 * `{ rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt,
 * generation, memberCount }` — produced by {@link toTeamRootWireRow}
 * (the full in-memory row additionally carries `attribution`, which the
 * wire row deliberately omits).
 *
 * Pure module: no I/O, no host backend, no runtime environment
 * assumptions. @module @dsh-agent-team/runtime/team-ownership-index
 */

import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import type {
  MemberInstanceRecordDto,
  SessionBindingDto,
} from '../../contracts/src/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import type { RemoteSafeRecord } from '../../remote/src/contracts/remote-safe.js'

/**
 * The closed vocabulary of the index's typed integrity failures. Every
 * code is a member of `REMOTE_BACKING_ERROR_CODE_SET` (closed remote
 * backing vocabulary) so the error passes both dispatchers unchanged
 * (invariant 4b). Corrupt (undecodable) rows are NOT re-coded here: the
 * storage layer's `RECORD_INVALID` / `MALFORMED_DTO` vocabulary already
 * covers them and passes through unchanged.
 */
export const TEAM_OWNERSHIP_INDEX_ERROR_CODES = {
  /** A root's binding row exists with a kind other than `team-root`. */
  ROOT_BINDING_MISMATCH: 'TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH',
  /** A member's child binding row exists with a kind other than `team-member`. */
  MEMBER_BINDING_MISMATCH: 'TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH',
  /** A `team-member` binding row contradicts the member record identity. */
  MEMBER_BINDING_CONFLICT: 'TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT',
} as const

/** The frozen error-code type of {@link TeamOwnershipIndexError}. */
export type TeamOwnershipIndexErrorCode =
  (typeof TEAM_OWNERSHIP_INDEX_ERROR_CODES)[keyof typeof TEAM_OWNERSHIP_INDEX_ERROR_CODES]

/**
 * The typed fail-closed integrity error of the ownership index. Carries
 * the closed-vocabulary string `code` (invariant 4b pass-through) plus a
 * remote-safe `details` record naming the offending rows.
 */
export class TeamOwnershipIndexError extends Error {
  /** The closed backing-vocabulary code (never re-mapped by the dispatchers). */
  readonly code: TeamOwnershipIndexErrorCode
  /** Remote-safe failure details (offending rows), lossless-JSON-checked upstream. */
  readonly details: RemoteSafeRecord

  constructor(code: TeamOwnershipIndexErrorCode, message: string, details: RemoteSafeRecord) {
    super(message)
    this.name = 'TeamOwnershipIndexError'
    this.code = code
    this.details = details
  }
}

/** One member's child-session attribution (the per-session kind is optional). */
export interface TeamRootMemberAttribution {
  /** The member's stable instance id (composite identity, invariant 18). */
  readonly instanceId: string
  /** The durable child session bound to the instance (invariant 23). */
  readonly childSessionId: string
  /**
   * The child session's binding kind, from the `sessionBindings` row —
   * `'team-member'` when the row exists and agrees; ABSENT (undefined)
   * when no binding row exists for the child (documented non-failure).
   */
  readonly kind?: string
}

/** One durable Team root, as read from the TeamDomain (in-memory row). */
export interface TeamRootOwnershipRow {
  /** The root DSH session id — which is the TeamSessionId (invariant 9). */
  readonly rootSessionId: string
  /** The immutable blueprint identity (invariant 10). */
  readonly blueprintId: string
  /** The blueprint revision of the snapshot binding (human-readable, e.g. `17`). */
  readonly revision: string
  /** The team default workspace (absent when not set, §21.2). */
  readonly defaultWorkspace?: string
  /** Creation timestamp, ISO-8601. */
  readonly createdAt: string
  /** The TeamSession record generation (starts at 1). */
  readonly generation: number
  /**
   * The number of member instances of the root, EXCLUDING the Leader row
   * (`inst-leader`) in both its v2 and legacy v1 forms.
   */
  readonly memberCount: number
  /** The per-member child-session attribution, sorted by instance id. */
  readonly attribution: readonly TeamRootMemberAttribution[]
}

/**
 * The remote-safe row of the v3 `team.listRoots` response — the closed
 * wire shape frozen by D1 (D2/D3 consume exactly this shape):
 * `{ rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt,
 * generation, memberCount }`.
 */
export interface TeamRootWireRow {
  readonly rootSessionId: string
  readonly blueprintId: string
  /** The blueprint revision of the snapshot binding (human-readable string). */
  readonly revision: string
  readonly defaultWorkspace?: string
  readonly createdAt: string
  readonly generation: number
  readonly memberCount: number
}

/**
 * A member record read through the repositories: the validated v1 shape
 * (with its required `childSessionId`), the v2 leader shape (no
 * `childSessionId` key), or the legacy v1 harness leader row (with a
 * `childSessionId`). The declared repository type is the v1 DTO (the
 * documented type lie of `parseMemberInstanceRecord`); the absent keys of
 * a v2 leader row stay absent at runtime.
 */
type MemberRecordRow = MemberInstanceRecordDto & {
  readonly childSessionId?: string
  readonly lifecycle?: string
}

/**
 * Build the durable ownership index over the TeamDomain.
 *
 * @param repositories - the open TeamDomain repositories (only
 *   `teamSessions`, `memberInstances`, and `sessionBindings` are read).
 * @returns the root rows, sorted by root session id (the repository's
 *   own `teamSessions.list()` order), each with its member attribution
 *   sorted by instance id.
 * @throws {@link TeamOwnershipIndexError} on the three integrity
 *   conditions (see the module docstring); or the storage layer's typed
 *   errors (`RECORD_INVALID`, …) on a corrupt/undecodable row — every
 *   failure propagates, the index never returns a silent empty list.
 */
export function buildTeamRootOwnershipIndex(
  repositories: TeamDomainRepositories,
): readonly TeamRootOwnershipRow[] {
  // Root ordering: the repository lists TeamSession records sorted by
  // root session id (byte order) — the index preserves that order.
  const teamSessions = repositories.teamSessions.list()
  const rows: TeamRootOwnershipRow[] = []

  for (const teamSession of teamSessions) {
    const rootSessionId = teamSession.rootSessionId

    // --- root binding consistency (fail-closed) -------------------------
    // A corrupt root-binding row raises the storage typed error from
    // `get` itself and propagates (condition 1).
    const rootBinding: SessionBindingDto | undefined = repositories.sessionBindings.get(rootSessionId)
    if (rootBinding !== undefined && rootBinding.kind !== 'team-root') {
      throw new TeamOwnershipIndexError(
        TEAM_OWNERSHIP_INDEX_ERROR_CODES.ROOT_BINDING_MISMATCH,
        `root '${rootSessionId}' is bound as kind '${rootBinding.kind}' but its TeamSession record requires the 'team-root' binding`,
        {
          rootSessionId,
          foundKind: rootBinding.kind,
          expectedKind: 'team-root',
        },
      )
    }
    // Absent root binding: the legitimate fresh-root crash window (the
    // record is committed before the binding row) — a documented
    // non-failure.

    // --- member attribution (fail-closed) --------------------------------
    // The repository lists member records sorted by instance id; the
    // attribution list preserves that order (re-sorted defensively below).
    const members: readonly MemberRecordRow[] = repositories.memberInstances.list(rootSessionId)
    let memberCount = 0
    const attribution: TeamRootMemberAttribution[] = []

    for (const member of members) {
      // Leader exclusion: the Leader is the Root Session itself
      // (invariant 13) — neither a counted member nor an attributed
      // child. Covers BOTH the v2 leader record (no childSessionId key)
      // and the legacy v1 harness leader row (childSessionId = root).
      if (member.instanceId === LEADER_INSTANCE_ID) continue

      const childSessionId: string | undefined = member.childSessionId
      if (childSessionId === undefined) {
        // Unreachable through the validated repositories (v1 member
        // records require childSessionId; v2 leader rows are excluded
        // above) — fail closed rather than guess (condition 3).
        throw new TeamOwnershipIndexError(
          TEAM_OWNERSHIP_INDEX_ERROR_CODES.MEMBER_BINDING_MISMATCH,
          `member '${member.instanceId}' of root '${rootSessionId}' carries no childSessionId (every non-leader MemberInstance binds exactly one durable child session, invariant 23)`,
          { rootSessionId, instanceId: member.instanceId, reason: 'member-record-without-child-session' },
        )
      }

      memberCount += 1

      // The per-session kind (OPTIONAL): read the child's binding row.
      // A corrupt child-binding row raises the storage typed error from
      // `get` itself and propagates (condition 1).
      const childBinding: SessionBindingDto | undefined =
        repositories.sessionBindings.get(childSessionId)
      if (childBinding === undefined) {
        // Documented non-failure: no binding row for the child yet —
        // the attribution row is emitted with `kind` absent.
        attribution.push({ instanceId: member.instanceId, childSessionId })
        continue
      }
      if (childBinding.kind !== 'team-member') {
        // Condition 3: the child session is bound, but as something
        // other than a team member.
        throw new TeamOwnershipIndexError(
          TEAM_OWNERSHIP_INDEX_ERROR_CODES.MEMBER_BINDING_MISMATCH,
          `child session '${childSessionId}' of member '${member.instanceId}' (root '${rootSessionId}') is bound as kind '${childBinding.kind}' but its member record requires the 'team-member' binding`,
          {
            rootSessionId,
            instanceId: member.instanceId,
            childSessionId,
            foundKind: childBinding.kind,
            expectedKind: 'team-member',
          },
        )
      }
      // Condition 4: a team-member binding must agree with the member
      // record on the composite identity (invariant 18) and on the bound
      // child session itself.
      if (
        childBinding.rootSessionId !== rootSessionId ||
        childBinding.instanceId !== member.instanceId ||
        childBinding.sessionId !== childSessionId
      ) {
        throw new TeamOwnershipIndexError(
          TEAM_OWNERSHIP_INDEX_ERROR_CODES.MEMBER_BINDING_CONFLICT,
          `the 'team-member' binding of child session '${childSessionId}' conflicts with the member record of '${member.instanceId}' (root '${rootSessionId}')`,
          {
            rootSessionId,
            instanceId: member.instanceId,
            childSessionId,
            bindingRootSessionId: childBinding.rootSessionId,
            bindingInstanceId: childBinding.instanceId,
            bindingSessionId: childBinding.sessionId,
          },
        )
      }
      attribution.push({
        instanceId: member.instanceId,
        childSessionId,
        kind: childBinding.kind,
      })
    }

    // Determinism: the repository sorts by instance id; re-sort defensively
    // so the index output never depends on a future ordering change.
    attribution.sort((a, b) => (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0))

    rows.push({
      rootSessionId,
      blueprintId: teamSession.blueprint.blueprintId,
      revision: teamSession.blueprint.revision,
      ...(teamSession.defaultWorkspace === undefined ? {} : { defaultWorkspace: teamSession.defaultWorkspace }),
      createdAt: teamSession.createdAt,
      generation: teamSession.generation,
      memberCount,
      attribution,
    })
  }

  return rows
}

/**
 * Map one in-memory ownership row to the closed v3 wire row of the
 * `team.listRoots` response (frozen by D1): the remote-safe subset —
 * NO attribution (child session ids stay host-side in D1), NO handoff
 * provenance, NO record internals.
 *
 * @param row - one {@link TeamRootOwnershipRow}.
 * @returns the fresh wire row (a plain lossless-JSON record; the
 *   `defaultWorkspace` key is ABSENT, not undefined, when unset).
 */
export function toTeamRootWireRow(row: TeamRootOwnershipRow): TeamRootWireRow {
  return {
    rootSessionId: row.rootSessionId,
    blueprintId: row.blueprintId,
    revision: row.revision,
    ...(row.defaultWorkspace === undefined ? {} : { defaultWorkspace: row.defaultWorkspace }),
    createdAt: row.createdAt,
    generation: row.generation,
    memberCount: row.memberCount,
  }
}
