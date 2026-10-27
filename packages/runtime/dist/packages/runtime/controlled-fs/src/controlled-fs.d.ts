/**
 * ControlledFs — the trusted-Host FS mediator (A5-PR3, Lane B).
 *
 * Implements the frozen PR0 `ControlledFs` interface against the REAL
 * `node:fs` behind registered instance roots, plus two lane extensions
 * (`resolveDescriptor`, `readDescriptor`) for the C-FS {fs,path,fd?}
 * descriptor surface. DORMANT by construction: nothing here is wired into
 * the live composition (no barrel/registry/tsconfig touched — the
 * integration owner wires after C-ADM freeze, README §4).
 *
 * ORDER OF LAW (every operation, checks BEFORE the open):
 *   clock finite → realm + anchor containment → grant re-validation
 *   (expiry/generation/consumption via PR0 validateGrantForCall + the
 *   lane's subtree scope law) → exec-time admission recheck SEAM →
 *   observation policy (hidden is typed here, never silent) → window law
 *   → alias walk (lstat per segment, symlinks refused before any open) →
 *   [probe-seam hook] → open with O_NOFOLLOW → fd registry + ledger →
 *   EXEC-TIME OBJECT RE-READ (proc path under anchor; fstat identity equals
 *   the snapshot) → only then read/write bytes → close fd (no standing fd
 *   across calls).
 *
 * @module packages/runtime/controlled-fs/src/controlled-fs
 */
import { type ControlledFs, type FsReadWindow, type FsTextContent, type GovernanceResult, type MemberRef, type OperationGrant, type ResourceRef } from '../../../domain/tool-governance/src/index.js';
import type { SubtreeContains } from '../../../domain/authority-envelope/src/index.js';
import { type FsResourceDescriptor } from './cf-descriptor.js';
import { type AdmissionRecheck } from './open-at-exec.js';
export interface ControlledFsInstance {
    readonly fs: string;
    readonly rootDir: string;
    readonly realmId: string;
    readonly kind: 'absolute-path';
}
export interface LaneHooks {
    /**
     * PoC3 PROBE SEAM (test-only): fires after the check-time snapshot and
     * BEFORE the open — the fixture's deterministic "attacker window".
     */
    readonly onAfterPreCheckBeforeOpen?: (info: {
        readonly op: string;
        readonly locator: string;
    }) => void | Promise<void>;
    /** Fires with the kernel fd of every successful lane-internal open. */
    readonly onFdOpened?: (info: {
        readonly op: string;
        readonly fd: number;
        readonly locator: string;
    }) => void;
    /**
     * u7-r4091 PROBE SEAM (test-only): fires on the VERIFIED write fd of
     * `writeText` between the exec-time re-read and the first write — the
     * fixture's deterministic second attacker window (R-409-1 re-check). No
     * sanctioned wiring passes hooks at all; the seam itself changes no law.
     */
    readonly onAfterVerifiedBeforeWrite?: (info: {
        readonly op: string;
        readonly fd: number;
        readonly locator: string;
    }) => void | Promise<void>;
}
export interface ControlledFsLaneConfig {
    readonly instances: readonly ControlledFsInstance[];
    /** Injected clock (the lane owns no clock). Non-finite ⇒ typed refusal. */
    readonly now?: () => number;
    readonly currentAuthorityGeneration?: number;
    /** PR2 ledger VIEW (read-only; consumption stays PR2's durable law). */
    readonly consumed?: (grantId: string) => boolean;
    /** Observation policy seam: what this member may even see. */
    readonly visibility?: (member: MemberRef, desc: FsResourceDescriptor) => 'visible' | 'hidden';
    /** Exec-time admission recheck seam (default = honest no-recheck pre-freeze;
     *  the WIRED face never uses this default — see `admission-binding.ts`). */
    readonly recheck?: AdmissionRecheck;
    /**
     * G-d C1 (integration wiring): when the consumer wires the planes together
     * it injects the authority-envelope `SubtreeContains` here, and directory
     * coverage is decided by the planes' OWN containment law. Absent, the lane
     * keeps its deliberately narrower identity + prefix rule (zero behaviour
     * change for lane-local consumers).
     */
    readonly subtreeContains?: SubtreeContains;
    readonly hooks?: LaneHooks;
}
export interface LedgerEntry {
    readonly seq: number;
    readonly op: string;
    readonly member: string;
    readonly locator: string;
    readonly stage: string;
    readonly diagnostic?: string;
}
export interface TrustedControlledFs extends ControlledFs {
    /** Lane extension: the C-FS descriptor view (never carries a standing fd). */
    readonly resolveDescriptor: (grant: OperationGrant, ref: ResourceRef) => Promise<GovernanceResult<FsResourceDescriptor>>;
    /** Lane extension: fd-carrying descriptor read — the fd is verified, never trusted. */
    readonly readDescriptor: (grant: OperationGrant, desc: FsResourceDescriptor, window: FsReadWindow) => Promise<GovernanceResult<FsTextContent>>;
}
export interface ControlledFsLane {
    readonly fs: TrustedControlledFs;
    /** Append-only decision ledger (open-issued/refused/withheld/fd lines). */
    readonly ledger: readonly LedgerEntry[];
}
export declare function createControlledFsLane(config: ControlledFsLaneConfig): ControlledFsLane;
//# sourceMappingURL=controlled-fs.d.ts.map