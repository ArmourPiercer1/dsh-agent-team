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
import type { ForkReconciliationInput, ForkReconciliationPorts, ForkReconciliationResult } from './types.js';
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
export declare function reconcileForkSidecar(input: ForkReconciliationInput, ports: ForkReconciliationPorts): Promise<ForkReconciliationResult>;
//# sourceMappingURL=reconciler.d.ts.map