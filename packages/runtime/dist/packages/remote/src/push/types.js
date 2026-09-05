/**
 * P8-T4 push model — shared wire/state types of the client-side sync engine.
 *
 * Push model (plan §21.4, "correctness first"): the server side is the
 * frozen P8-T3 contract v1 surface — `team.getProjection` (whole
 * generation: the full `RemoteProjectionValue` + `generation`) and
 * `team.getLedgerPage` (versioned paging). "Push" is therefore a
 * versioned state + deterministic pull: every projection the client
 * receives carries a monotonic generation, and the client applies a
 * frame only when it is strictly newer than the applied generation
 * (Gate G8: a new state must never be overwritten by a stale response).
 *
 * This module is the vocabulary shared by the pure engine modules
 * (`generation`, `pull`, `reconnect`, `ledger-page`) and by the test
 * client / fake server fixtures (`test/p8t4-*`). It defines no behavior.
 *
 * Frozen authorities mirrored here (no redefinition):
 *   - `RemoteResponse` / `RemoteProvenance` (contracts/response)
 *   - `RemoteProjectionValue` / `RemoteLedgerPageValue` (contracts/types)
 *   - stale rule: `isStaleTeamProjection` (packages/contracts, P8-T1)
 *   - reconnect state + backoff bounds (P2-T6 characterization R1–R2)
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions. Erasable TS only.
 * @module @dsh-agent-team/remote/push/types
 */
/**
 * The sentinel thrown by a transport when the seam channel is lost.
 * Carries no state, no stack-dependent detail: the engine maps it to the
 * `reconnecting` state + backoff (P2-T6 R1–R2). Never serialized, never
 * sent across the wire — transport failure is a channel property, not a
 * message.
 */
export class PushTransportLossError extends Error {
    constructor(message = 'remote push transport: seam channel lost') {
        super(message);
        this.name = 'PushTransportLossError';
    }
}
//# sourceMappingURL=types.js.map