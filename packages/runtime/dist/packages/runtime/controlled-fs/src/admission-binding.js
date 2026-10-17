/**
 * A5 integration wiring (Scope-2) — the PR2-admission GATED consumption face
 * of the ControlledFs lane. Landing point of the G-d Lane-B C1 wiring notes
 * (INTEGRATION-PLAN §4; Lane B README §4; INTERFACES-v1 C-FS + C-ADM).
 *
 * THE WIRING LAWS (each pinned, RED-first, by
 * `packages/runtime/test/a5w-integration-wiring.test.ts`):
 *
 *  1. UNBOUND = TYPED REFUSAL. This face NEVER inherits the lane's pre-freeze
 *     `NO_RECHECK` default (that deviation is lane-internal history, README
 *     §2.1). A gated lane constructed without a PR2 admission binding answers
 *     every operation with the typed C-FS `denied` refusal carrying
 *     `admission-unbound`, on the frozen §5 code the lane's own
 *     recheck-refused mapping uses — no new §5 code, no second authorization
 *     fact, no silence.
 *
 *  2. FINGERPRINT BINDING (C1). `bindAdmissionRecheck` pins the PR1 canonical
 *     `parametersFingerprint` of THIS call — the same one the Guard saw
 *     pre-call (the PR1 fingerprint law re-attached at the exec-time seam).
 *     The recheck presents the BOUND fingerprint to the port; an intent whose
 *     presented fingerprint diverges from the bound one (or is null) is
 *     refused with `fingerprint-divergence` BEFORE the port is consulted: a
 *     re-resolved definition can never exec under another call's fingerprint.
 *
 *  3. SUBTREE LAW (C1). When the wiring consumer injects the
 *     authority-envelope `SubtreeContains`, directory-effect coverage runs
 *     through it (the planes' own containment, not a lane guess). Absent the
 *     injection the lane keeps its deliberately narrower identity+prefix rule
 *     — wiring a consumer changes nothing for consumers that do not wire.
 *
 *  4. NO ARBITRARY-TREE PUBLICATION (C1). Until an `OpenAtPort` (openat2
 *     RESOLVE_BENEATH / RESOLVE_IN_ROOT on a trusted dir FD) lands, the
 *     fully-untrusted mutable-tree profile stays unpublished as Supported —
 *     the lane's node fallback carries a documented residual window (README
 *     §2.3). `ARBITRARY_TREE_PROFILE_PUBLISHED` is pinned false, this module
 *     exports no OpenAtPort implementation, and PR8 matrix rows update only
 *     via their pending_update channel.
 *
 * Boundary (G-g): this module makes NO claim about silent-subscription
 * channels; that exclusion gate remains G-g OPEN (PENDING-GATES). Nothing
 * here is a whole-chain verification claim — fixture-level only, per the
 * INTERFACES integration rule.
 *
 * @module packages/runtime/controlled-fs/src/admission-binding
 */
import { createControlledFsLane } from './controlled-fs.js';
/**
 * The refusal side of law 1: an unbound gated lane's exec-time recheck. It
 * refuses, by name, so the ledger line and the typed error both say WHY (no
 * silence — the C-FS triad's `denied` class rides the lane's own mapping).
 */
export const UNBOUND_ADMISSION_RECHECK = Object.freeze({
    recheck: async () => ({ ok: false, reason: 'admission-unbound' }),
});
/**
 * Bind the exec-time recheck to one call's admission (law 2). The returned
 * recheck: (a) refuses `fingerprint-divergence` when the presented
 * fingerprint is not the bound one — before consulting the port; (b) presents
 * the BOUND fingerprint verbatim when consulting it.
 */
export function bindAdmissionRecheck(bound) {
    const pinned = bound.parametersFingerprint;
    if (typeof pinned !== 'string' || pinned.length === 0) {
        throw new TypeError('admission-binding: the bound parametersFingerprint must be a non-empty string (law 2)');
    }
    return Object.freeze({
        recheck: async (intent) => {
            if (intent.parametersFingerprint === null || intent.parametersFingerprint !== pinned) {
                return { ok: false, reason: 'fingerprint-divergence' };
            }
            return bound.admission.recheckCall({
                op: intent.op,
                canonicalLocator: intent.canonicalLocator,
                parametersFingerprint: pinned,
            });
        },
    });
}
/**
 * The gated lane factory — the ONLY sanctioned wiring entry. Unbound means
 * refused, never `NO_RECHECK`-passed (law 1); bound means the C1 fingerprint
 * law is enforced at the seam (law 2); `subtreeContains` injection routes the
 * subtree decision through the planes (law 3).
 */
export function createAdmissionGatedControlledFs(config) {
    const { admission, subtreeContains, ...laneConfig } = config;
    const recheck = admission === undefined ? UNBOUND_ADMISSION_RECHECK : bindAdmissionRecheck(admission);
    return createControlledFsLane({
        ...laneConfig,
        recheck,
        ...(subtreeContains === undefined ? {} : { subtreeContains }),
    });
}
/**
 * Law 4 pin: the arbitrary mutable-tree profile is NOT published as Supported
 * while `OpenAtPort` (the openat2 native helper) is unlanded. Flipping this
 * requires the native helper AND the PR8 matrix publication round — neither
 * is a code convenience in this wiring slice.
 */
export const ARBITRARY_TREE_PROFILE_PUBLISHED = false;
//# sourceMappingURL=admission-binding.js.map