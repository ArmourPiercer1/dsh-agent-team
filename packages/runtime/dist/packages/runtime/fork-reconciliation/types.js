/**
 * ForkReconciliation types (P7-T4): the native-fork fact, the injected
 * TeamDomain port, and the frozen outcome vocabulary.
 *
 * The module reconciles ONE observed native DSH Session fork (Architecture
 * §35) against the durable TeamDomain sidecar (invariant 41) and writes the
 * lazy root-fork sidecar when — and only when — the frozen semantics
 * require it:
 *
 * - **Root fork** (DevPlan §20.4, Architecture §35.1/§35.2): the parent is
 *   a Team root → a NEW TeamSession is recorded for the child with the SAME
 *   immutable Blueprint snapshot and EMPTY MemberInstances (no runtime
 *   MemberInstances, no Policy runtime activity, no child execution trees
 *   are copied);
 * - **Member fork** (DevPlan §20.4, Architecture §35.3, invariant 62): the
 *   parent is a member child session → the child stays an ordinary
 *   independent session; no Team binding is ever inferred;
 * - **Ordinary fork**: the parent carries no Team binding → the child has
 *   no team to reconcile; the sidecar stays untouched.
 *
 * `session.fork` is never patched (zero-core): the native fork itself is
 * performed by DSH; this module only performs the idempotent sidecar
 * recognition/reconciliation over the public TeamDomain binding surface,
 * fed by the public Session lineage/parent information (Architecture
 * §35.2). If that lineage were not observable, the blocker would be
 * `CORE_SEAM_BLOCKER: FORK_LINEAGE_VISIBILITY` — not an upstream change.
 *
 * @module @dsh-agent-team/runtime/fork-reconciliation/types
 */
export {};
//# sourceMappingURL=types.js.map