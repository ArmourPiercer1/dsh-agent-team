/**
 * `runtime/jobs-gateway` shared types — Alpha.5 PR7 (Lane F), DORMANT.
 *
 * This lane is the ADAPTATION SURFACE between the dispatch plane (PR1 +
 * PR1r: the Scoped Dispatcher and its pending-call cancellation mechanism)
 * and the Web/Jobs view of the same work. It decides nothing that the
 * dispatch plane has not already decided: it ADAPTS the plane's event faces
 * into job-level facts and refuses to invent facts the plane did not emit.
 *
 * AUTHORITATIVE STACK for the cancellation shapes consumed here:
 * `origin/alpha5-pr1r-residual-boundaries` @ **bd6310ca** (contains the
 * B3(ii) fix `cf299383`). Until that branch merges, these types are a
 * documented contract fixture per INTERFACES-v1 §集成规则: verified against
 * the stack, NOT a claim that the whole chain is verified end-to-end. The
 * real stdio provider arrives with PR4; this lane develops against the
 * C-PROC-shaped fixture (stage closed set probe→prepare→execute→terminate,
 * terminate ≠ cancel) rather than waiting.
 *
 * The local owner/identity shapes below are the lane's contract stub for
 * `contracts/identity.ts` (`MemberIdentity`, `memberIdentityKey`): same two
 * components, same canonical-key idea, kept structurally so the DORMANT
 * lane imports no live glue. The integration owner replaces the stub with
 * the frozen contracts import at splice time.
 *
 * The production assembly contract (which sources the HOST injects at the
 * gateway's instantiation point — durable identity, the lease window, the
 * definition reader) is pinned in
 * `dev/agent-workflow/evidence/alpha5/prod/pc-CONTRACT.md`; the seams are
 * on this module's types (`GatewayIdentitySource`, the `createJobsGateway`
 * options). The lane stays DORMANT: injection points are a READY surface,
 * not a live edge — the live row lands with its GLUE owner.
 *
 * @module runtime/jobs-gateway/types
 */
/** Canonical key of a {@link JobOwner}: same member ⇒ same key, always. */
export function jobOwnerKey(owner) {
    // Canonical (fixed-field-order, JSON-escaped) two-field key, mirroring the
    // frozen contracts' memberIdentityKey: field order in source objects cannot
    // split one owner into two keys, and a different rootSessionId always
    // changes the key (cross-TeamSession confusion impossible at string level).
    return `{"instanceId":${JSON.stringify(owner.instanceId)},"rootSessionId":${JSON.stringify(owner.rootSessionId)}}`;
}
export function gatewayRefusal(code, detail) {
    return { ok: false, code, detail };
}
//# sourceMappingURL=types.js.map