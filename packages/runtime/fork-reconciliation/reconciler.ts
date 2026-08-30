/**
 * reconcileForkSidecar — the lazy root-fork sidecar reconciliation
 * (P7-T4; DevPlan §20.4; Architecture §35.1/§35.2/§35.3).
 *
 * One observed native DSH Session fork (public lineage/parent information,
 * Architecture §35.2) is reconciled against the durable TeamDomain
 * sidecar (invariant 41). The orchestration (every step fail-closed; no
 * effect before the read-only recognition completes):
 *
 * 1. **Input validation** — both session ids parse through the frozen
 *    contracts parsers and parent !== child (a native fork always mints a
 *    NEW child session); otherwise `FORK_INVALID_INPUT`, no effect.
 * 2. **Recognition (READ ONLY)** — the parent's binding kind decides the
 *    branch, exactly the cold-hydration resolution (Architecture §36.1):
 *
 *    - **unbound / ordinary** → **ordinary fork**: the child is an
 *      ordinary independent session; the sidecar is untouched (0 writes).
 *      An existing child binding row is a contradiction
 *      (`FORK_STATE_CONFLICT`): a freshly minted fork child has no row.
 *    - **team-member** → **member fork**: the child stays an ordinary
 *      independent AgentSession — NOT a new MemberInstance, NOT a member
 *      of the original Team, NOT a new TeamSession, NOT a Leader
 *      (Architecture §35.3, invariant 62); no Team binding is inferred
 *      (0 writes). An existing child binding row is a contradiction.
 *    - **team-root** → **root fork** (the only branch that writes): the
 *      parent must carry its TeamSession record (a `team-root` binding
 *      without a record cannot honor invariants 9/10 and fails closed);
 *      then the child is reconciled:
 *
 *      - child has the sidecar already (record + `team-root` binding):
 *        the record must be the generation-1 record of the parent team's
 *        IMMUTABLE Blueprint snapshot (invariant 10) with EMPTY
 *        MemberInstances → `root-fork-already-reconciled` (0 writes; the
 *        idempotent re-run, Architecture §35.2);
 *      - child has a binding-less TeamSession record (the crash window
 *        of the crash-safe ordering below): the same identity checks
 *        apply, then the missing `team-root` binding is committed
 *        (1 write; roll-forward, Development Plan §17.3);
 *      - child is clean: the sidecar is created in the CRASH-SAFE ORDER —
 *        the TeamSession record FIRST (generation 1, the SAME immutable
 *        Blueprint snapshot as the parent team, the parent team's
 *        defaultWorkspace when present, the injected-clock createdAt),
 *        then the `team-root` binding (2 writes). A crash between the two
 *        writes leaves a binding-less record that step 2 of a re-run
 *        completes; a binding WITHOUT a record is corruption and fails
 *        closed.
 *
 *      In every root-fork sub-path a non-empty MemberInstance set under
 *      the child root is a contradiction (the frozen root fork ends in
 *      EMPTY MemberInstances — no runtime MemberInstances, no Policy
 *      runtime activity, no child execution trees are copied,
 *      Architecture §35.1): `FORK_STATE_CONFLICT`.
 *
 * Zero-core: `session.fork` is never patched — the native fork is DSH's;
 * this module only reads and writes the TeamDomain sidecar through the
 * injected port (the repositories' own validation/uniqueness discipline
 * is preserved: a rejected put propagates unwrapped, and no second write
 * is attempted after the first fails).
 *
 * @module @dsh-agent-team/runtime/fork-reconciliation/reconciler
 */

import {
  parseRootSessionId,
  parseSessionId,
  TEAM_CONTRACT_SCHEMA_VERSION,
} from '../../contracts/src/index.js'
import type {
  BlueprintSnapshotRef,
  SessionBindingTeamRoot,
  TeamSessionRecordInput,
} from '../../contracts/src/index.js'
import { FORK_RECONCILIATION_ERROR_CODES, ForkReconciliationError } from './errors.js'
import type {
  ForkReconciliationInput,
  ForkReconciliationPorts,
  ForkReconciliationResult,
} from './types.js'

/** The closed error codes (local alias for throw sites). */
const CODES = FORK_RECONCILIATION_ERROR_CODES

/**
 * Structural equality of two immutable Blueprint snapshot refs (invariant
 * 10: the fork child binds the SAME snapshot the parent team binds).
 */
function sameSnapshot(a: BlueprintSnapshotRef, b: BlueprintSnapshotRef): boolean {
  return (
    a.blueprintId === b.blueprintId &&
    a.revision === b.revision &&
    a.contentHash === b.contentHash
  )
}

/**
 * The fork-reconciliation typed error (fail-closed; no effect before the
 * throw — every throw site precedes the first durable write of the call).
 */
function stateConflict(
  message: string,
  details: Record<string, unknown>,
): ForkReconciliationError {
  return new ForkReconciliationError(CODES.FORK_STATE_CONFLICT, message, details)
}

/**
 * Reconcile one observed native DSH Session fork against the durable
 * TeamDomain sidecar (DevPlan §20.4; Architecture §35).
 *
 * @param input - the native-fork fact (public lineage/parent information).
 * @param ports - the injected TeamDomain port and deterministic clock.
 * @returns the frozen outcome (the closed vocabulary, with the exact
 *   durable-write count of this call).
 * @throws `FORK_INVALID_INPUT` for a structurally invalid fork fact
 *   (no effect); `FORK_STATE_CONFLICT` when the durable state
 *   contradicts the fork fact (no effect); the unwrapped
 *   repository/seam error when a durable put is rejected (crash-safe
 *   ordering: no second write after a failed first).
 */
export async function reconcileForkSidecar(
  input: ForkReconciliationInput,
  ports: ForkReconciliationPorts,
): Promise<ForkReconciliationResult> {
  // --- 1. input validation (no effect) -----------------------------------
  let parent: string
  try {
    parent = String(parseSessionId(input.parentSessionId))
  } catch {
    throw new ForkReconciliationError(
      CODES.FORK_INVALID_INPUT,
      'fork parent session id is structurally invalid',
      { field: 'parentSessionId', value: input.parentSessionId },
    )
  }
  let child: string
  try {
    child = String(parseSessionId(input.childSessionId))
  } catch {
    throw new ForkReconciliationError(
      CODES.FORK_INVALID_INPUT,
      'fork child session id is structurally invalid',
      { field: 'childSessionId', value: input.childSessionId },
    )
  }
  if (parent === child) {
    throw new ForkReconciliationError(
      CODES.FORK_INVALID_INPUT,
      'a native fork always mints a NEW child session id; parent === child is not a fork',
      { parentSessionId: parent, childSessionId: child },
    )
  }

  const teamDomain = ports.teamDomain

  // --- 2. recognition (READ ONLY, before any effect) ---------------------
  const parentBinding = teamDomain.getSessionBinding(parent)
  const childBinding = teamDomain.getSessionBinding(child)

  // --- 2a. ordinary fork: parent carries no Team binding ------------------
  if (parentBinding === undefined || parentBinding.kind === 'ordinary') {
    if (childBinding !== undefined) {
      throw stateConflict(
        `ordinary fork child '${child}' already carries a binding row of kind '${childBinding.kind}'; a freshly minted fork child has no row`,
        { parentSessionId: parent, childSessionId: child, childBindingKind: childBinding.kind },
      )
    }
    return {
      outcome: 'ordinary-fork',
      parentBinding: parentBinding === undefined ? 'unbound' : 'ordinary',
      durableWrites: 0,
    }
  }

  // --- 2b. member fork: parent is a member child session ------------------
  if (parentBinding.kind === 'team-member') {
    if (childBinding !== undefined) {
      throw stateConflict(
        `member fork child '${child}' already carries a binding row of kind '${childBinding.kind}'; no Team binding is ever inferred for a fork child (invariant 62)`,
        {
          parentSessionId: parent,
          parentRootSessionId: parentBinding.rootSessionId,
          childSessionId: child,
          childBindingKind: childBinding.kind,
        },
      )
    }
    return {
      outcome: 'member-fork',
      parentRootSessionId: parentBinding.rootSessionId,
      durableWrites: 0,
    }
  }

  // --- 2c. root fork: parent is a Team root --------------------------------
  // parentBinding.kind === 'team-root' (the only remaining kind).
  const parentRecord = teamDomain.getTeamSession(parent)
  if (parentRecord === undefined) {
    throw stateConflict(
      `root-fork parent '${parent}' has a team-root binding without its TeamSession record; the child snapshot cannot be established (invariants 9/10)`,
      { parentSessionId: parent },
    )
  }

  const childRecord = teamDomain.getTeamSession(child)
  const childMemberCount = teamDomain.listMemberInstances(child).length
  if (childMemberCount > 0) {
    throw stateConflict(
      `fork child root '${child}' already carries ${childMemberCount} MemberInstance record(s); a root fork ends in EMPTY MemberInstances (Architecture §35.1)`,
      { parentSessionId: parent, childSessionId: child, memberCount: childMemberCount },
    )
  }

  if (childBinding !== undefined) {
    if (childBinding.kind !== 'team-root') {
      throw stateConflict(
        `fork child '${child}' already carries a binding row of kind '${childBinding.kind}'; the fork child of a Team root becomes a team-root, never another kind (invariants 8/23/24)`,
        { parentSessionId: parent, childSessionId: child, childBindingKind: childBinding.kind },
      )
    }
    // child is bound team-root: the record must exist (a binding without a
    // record is never produced by this module's ordering — corruption).
    if (childRecord === undefined) {
      throw stateConflict(
        `fork child '${child}' has a team-root binding without its TeamSession record (corruption; not produced by the fork-reconciliation ordering)`,
        { parentSessionId: parent, childSessionId: child },
      )
    }
    if (childRecord.generation !== 1) {
      throw stateConflict(
        `fork child TeamSession '${child}' is at generation ${childRecord.generation}; the fork-established TeamSession is a generation-1 record`,
        { parentSessionId: parent, childSessionId: child, generation: childRecord.generation },
      )
    }
    if (!sameSnapshot(childRecord.blueprint, parentRecord.blueprint)) {
      throw stateConflict(
        `fork child TeamSession '${child}' binds a different Blueprint snapshot than the parent team '${parent}' (invariant 10: the fork keeps the SAME immutable snapshot)`,
        {
          parentSessionId: parent,
          childSessionId: child,
          parentSnapshot: parentRecord.blueprint,
          childSnapshot: childRecord.blueprint,
        },
      )
    }
    return {
      outcome: 'root-fork-already-reconciled',
      parentRootSessionId: parent,
      childTeamSession: childRecord,
      blueprintSnapshot: parentRecord.blueprint,
      durableWrites: 0,
    }
  }

  // No child binding row:
  if (childRecord !== undefined) {
    // Crash window: the record committed, the binding write never did.
    if (childRecord.generation !== 1) {
      throw stateConflict(
        `fork child TeamSession '${child}' is at generation ${childRecord.generation}; the fork-established TeamSession is a generation-1 record`,
        { parentSessionId: parent, childSessionId: child, generation: childRecord.generation },
      )
    }
    if (!sameSnapshot(childRecord.blueprint, parentRecord.blueprint)) {
      throw stateConflict(
        `fork child TeamSession record '${child}' (binding-less, crash window) binds a different Blueprint snapshot than the parent team '${parent}' (invariant 10)`,
        {
          parentSessionId: parent,
          childSessionId: child,
          parentSnapshot: parentRecord.blueprint,
          childSnapshot: childRecord.blueprint,
        },
      )
    }
    // Roll forward: commit the missing binding (1 write).
    const childRootId = parseRootSessionId(child)
    const binding: SessionBindingTeamRoot = {
      schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
      kind: 'team-root',
      sessionId: childRootId,
    }
    const committed = await teamDomain.putSessionBinding(binding)
    return {
      outcome: 'root-fork-reconciled',
      parentRootSessionId: parent,
      childTeamSession: childRecord,
      childBinding: committed,
      blueprintSnapshot: parentRecord.blueprint,
      memberCount: 0,
      durableWrites: 1,
    }
  }

  // Fresh sidecar creation — CRASH-SAFE ORDER: record first, binding second.
  const recordInput: TeamSessionRecordInput = {
    rootSessionId: parseRootSessionId(child),
    blueprint: parentRecord.blueprint,
    ...(parentRecord.defaultWorkspace !== undefined
      ? { defaultWorkspace: parentRecord.defaultWorkspace }
      : {}),
    createdAt: ports.now(),
    generation: 1,
  }
  const freshRecord = await teamDomain.putTeamSession(recordInput)
  const childRootId = parseRootSessionId(child)
  const binding: SessionBindingTeamRoot = {
    schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
    kind: 'team-root',
    sessionId: childRootId,
  }
  const committedBinding = await teamDomain.putSessionBinding(binding)
  return {
    outcome: 'root-fork-reconciled',
    parentRootSessionId: parent,
    childTeamSession: freshRecord,
    childBinding: committedBinding,
    blueprintSnapshot: parentRecord.blueprint,
    memberCount: 0,
    durableWrites: 2,
  }
}
