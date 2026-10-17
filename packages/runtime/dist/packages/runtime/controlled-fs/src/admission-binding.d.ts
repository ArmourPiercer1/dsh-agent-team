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
import type { SubtreeContains } from '../../../domain/authority-envelope/src/index.js';
import { type ControlledFsLane, type ControlledFsLaneConfig } from './controlled-fs.js';
import type { AdmissionRecheck } from './open-at-exec.js';
/**
 * The read-only PR2-admission port this face consumes. The consumer adapter
 * maps it onto the frozen admission kernel (e.g. `AdmissionKernel`'s
 * execution-edge validation); this module never re-implements admission and
 * never mints, consumes or widens anything — it re-ASKS and obeys.
 */
export interface FsAdmissionPort {
    /** Re-ask admission for the exact call about to effect, under the fingerprint the binding pinned. */
    readonly recheckCall: (intent: {
        readonly op: string;
        readonly canonicalLocator: string;
        readonly parametersFingerprint: string;
    }) => Promise<{
        readonly ok: true;
    } | {
        readonly ok: false;
        readonly reason: string;
    }>;
}
/** One call's admission binding: the port plus the PR1 canonical fingerprint of THIS call. */
export interface AdmissionBoundFsCall {
    readonly admission: FsAdmissionPort;
    /**
     * C1: the canonical `parametersFingerprint` the Guard saw PRE-CALL for this
     * exact invocation. The exec-time recheck presents this value — never a
     * value re-derived from the re-resolved definition or the presented grant.
     */
    readonly parametersFingerprint: string;
}
/** The wiring config: the lane config minus its pre-freeze recheck default. */
export interface AdmissionGatedControlledFsConfig extends Omit<ControlledFsLaneConfig, 'recheck'> {
    /** Absent ⇒ every operation is a typed `admission-unbound` refusal (law 1). */
    readonly admission?: AdmissionBoundFsCall;
    /** C1 subtree law injection; absent keeps the narrow lane rule (law 3). */
    readonly subtreeContains?: SubtreeContains;
}
/**
 * The refusal side of law 1: an unbound gated lane's exec-time recheck. It
 * refuses, by name, so the ledger line and the typed error both say WHY (no
 * silence — the C-FS triad's `denied` class rides the lane's own mapping).
 */
export declare const UNBOUND_ADMISSION_RECHECK: AdmissionRecheck;
/**
 * Bind the exec-time recheck to one call's admission (law 2). The returned
 * recheck: (a) refuses `fingerprint-divergence` when the presented
 * fingerprint is not the bound one — before consulting the port; (b) presents
 * the BOUND fingerprint verbatim when consulting it.
 */
export declare function bindAdmissionRecheck(bound: AdmissionBoundFsCall): AdmissionRecheck;
/**
 * The gated lane factory — the ONLY sanctioned wiring entry. Unbound means
 * refused, never `NO_RECHECK`-passed (law 1); bound means the C1 fingerprint
 * law is enforced at the seam (law 2); `subtreeContains` injection routes the
 * subtree decision through the planes (law 3).
 */
export declare function createAdmissionGatedControlledFs(config: AdmissionGatedControlledFsConfig): ControlledFsLane;
/**
 * Law 4 pin: the arbitrary mutable-tree profile is NOT published as Supported
 * while `OpenAtPort` (the openat2 native helper) is unlanded. Flipping this
 * requires the native helper AND the PR8 matrix publication round — neither
 * is a code convenience in this wiring slice.
 */
export declare const ARBITRARY_TREE_PROFILE_PUBLISHED = false;
//# sourceMappingURL=admission-binding.d.ts.map