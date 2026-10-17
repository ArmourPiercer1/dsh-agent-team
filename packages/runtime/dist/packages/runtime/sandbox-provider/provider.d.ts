/**
 * THE CONFINED PROCESS PROVIDER — the lane's implementation of the frozen
 * `ConfinedProcessProvider` seam shape (probe / spawn / requestCancellation /
 * settleTermination) over the C-PROC phase closed set, the Linux P1 posture
 * (the trusted launcher self-locks at child entry, THEN execs the untrusted
 * argv — the DSH host process never calls `landlock_restrict_self`), and the
 * NO-FALLBACK law: when the launcher is absent, the ABI does not answer, or
 * a hard-required dimension lacks its double evidence, the refusal is typed
 * and happens BEFORE any process exists. "Sandbox unavailable → run naked"
 * cannot be expressed through this seam.
 *
 * DORMANT: this provider is wired to nothing. `prepare`/`execute` are exposed
 * as a real split (plan PoC-4c: async launch may hold prepare aside from
 * execute; a plan is ONE-SHOT — consuming it twice is a second spawn without
 * a second grant, so the second execute is refused). Cancellation settles
 * through the lease law (`settleTermination` is the only path to
 * `terminated`; an unconfirmed settlement keeps its `sideEffectUnknown`).
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/provider
 */
import { type AssuranceDimension, type ProcessCapabilityRow, type ProviderResult } from './contract-stub.js';
import { type FdPlan } from './fd-inheritance.js';
import { type AvailabilityRow, type LegName, type LegVerdict, type RunResult } from './probe-abi.js';
/** One path allow-entry with the named access bits the launcher maps. */
export interface AllowPathEntry {
    readonly path: string;
    readonly accessBits: {
        readonly execute?: boolean;
        readonly writeFile?: boolean;
        readonly readFile?: boolean;
        readonly readDir?: boolean;
        readonly removeFile?: boolean;
        readonly makeReg?: boolean;
        readonly truncate?: boolean;
    };
}
/** One confined-spawn request (argv is an explicit array — never a shell string). */
export interface SpawnRequest {
    readonly grantFingerprint: string;
    readonly realmId: string;
    readonly bindingId: string;
    readonly memberScope: string;
    readonly argv: readonly string[];
    readonly cwd: string;
    readonly env: readonly (readonly [string, string])[];
    readonly networkProfile?: 'deny' | 'restricted';
    readonly allowPaths?: readonly AllowPathEntry[];
    readonly declaredFds?: readonly {
        fd: number;
        purpose: 'stdin' | 'stdout' | 'stderr' | 'delivery';
        resourceFingerprint: string;
    }[];
}
/** The lease the provider issues (mirror of the frozen lease vocabulary). */
export interface ProviderLease {
    readonly leaseId: string;
    readonly grantFingerprint: string;
    readonly realmId: string;
    readonly bindingId: string;
    readonly memberScope: string;
    readonly executionKind: 'process';
    readonly status: 'active' | 'cancelling' | 'termination-unconfirmed' | 'terminated';
}
/** The compiled, ONE-SHOT execution plan (prepare output, execute input). */
export interface SpawnPlan {
    readonly planId: string;
    readonly phase: 'prepared';
    readonly request: SpawnRequest;
    readonly policyPath: string;
    readonly outDir: string;
    readonly fdPlan: FdPlan;
}
/** The bounded output of one confined run. */
export interface RunOutput {
    readonly stdout: string;
    readonly stderr: string;
    readonly combined: string;
}
/** Spawn receipt: the process identity AND the lease that scopes it. */
export interface SpawnReceipt {
    readonly lease: ProviderLease;
    readonly processIdentity: string;
}
/** The injected world (tests inject a counting fake to watch ZERO calls). */
export interface ProviderDeps {
    readonly availability: () => {
        readonly rows: readonly AvailabilityRow[];
    };
    readonly run: (argv: readonly string[], timeoutMs?: number) => RunResult;
    readonly probeFacts: () => {
        readonly abiVersion: number | null;
        readonly legs: Partial<Record<LegName, LegVerdict>>;
    };
}
/** Provider construction options. */
export interface ProviderOptions {
    readonly realmId: string;
    readonly trustRoot: string | null;
    readonly scratchRoot: string;
    readonly deps?: ProviderDeps;
    readonly hardDimensions?: readonly AssuranceDimension[];
    readonly runnerCommand?: string | null;
}
/** Create one provider instance for one realm. Probes are captured ONCE per instance. */
export declare function createConfinedProcessProvider(opts: ProviderOptions): Readonly<{
    probe: () => Promise<ProviderResult<readonly ProcessCapabilityRow[]>>;
    prepare: (request: SpawnRequest) => Promise<ProviderResult<SpawnPlan>>;
    execute: (plan: SpawnPlan) => Promise<ProviderResult<{
        receipt: SpawnReceipt;
        output: RunOutput;
        lease: ProviderLease;
    }>>;
    spawn: (request: SpawnRequest) => Promise<ProviderResult<{
        receipt: SpawnReceipt;
        output: RunOutput;
        lease: ProviderLease;
    }>>;
    requestCancellation: (lease: ProviderLease) => Promise<ProviderResult<ProviderLease>>;
    settleTermination: (lease: ProviderLease, confirmed?: boolean) => Promise<ProviderResult<ProviderLease>>;
}>;
//# sourceMappingURL=provider.d.ts.map