/**
 * THE LSP REALM ASSEMBLY — the R-2 approved production arm (user ruling
 * 07:53Z): "policy change ⇒ destroy and rebuild the member's isolated LSP
 * instance", implemented as the Team-side ASSEMBLY DISCIPLINE API.
 *
 * Granularity (verbatim from `LSP-rulings-brief.md` R-2 §2, as approved):
 * one isolated instance per (member × policy generation) = its own provider
 * instance (realm) + its own confined OS process through the R-1 streaming
 * arm. This is ASSEMBLY DISCIPLINE, not OS enforcement of sub-realm policy:
 * the host pool key upstream stays a pure path, and sharing it under another
 * name would masquerade as policy isolation (forbidden by the brief). The
 * claims this module may support are exactly "realm-granularity isolation is
 * real; policy-granularity eviction is NOT claimed".
 *
 * Lifecycle laws (pinned by `a5lsp2-assembly`):
 *  - EVERY provider instance is created from the SAME `ProviderAssemblyConfig`
 *    the P-B install round froze (launcher path + sha byte gate + ABI floor):
 *    the double gate guards every realm, every spawn, unchanged.
 *  - `policyChange(member, generation)` = probe-gate the NEW realm FIRST (a
 *    gated assembly never disposes a healthy old one — no self-inflicted
 *    outage), then dispose the OLD instance (terminate + BOUNDED,
 *    OS-confirmed pid exit), then assemble the NEW one (spawnStreaming +
 *    readiness). A mid-change failure leaves ZERO residual handles/pids:
 *    a half-built instance is terminated and settled before the typed
 *    refusal returns; the member is left with NO instance (honest, never a
 *    dead handle).
 *  - `ensure` is HOT reuse or first assembly only; a generation mismatch is
 *    refused — `policyChange` is the single discipline entry for changes.
 *  - Disposal is per-member and net-zero: sibling members are never touched.
 *
 * Purity: imports within the lane only (contract-stub + provider); no
 * `node:*` — the OS facts flow through the provider's seams.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/lsp-assembly
 */
import { type ProviderResult } from './contract-stub.js';
import { type AllowPathEntry, type ProviderAssemblyConfig, type ProviderDeps, type StreamingSpawnHandle } from './provider.js';
/** One member's policy for one generation: exactly what a confined streaming spawn needs. */
export interface LspRealmPolicy {
    readonly grantFingerprint: string;
    readonly bindingId: string;
    readonly argv: readonly string[];
    readonly cwd: string;
    readonly env: readonly (readonly [string, string])[];
    readonly allowPaths?: readonly AllowPathEntry[];
    readonly networkProfile?: 'deny' | 'restricted';
}
/** The observable lifecycle ledger of one assembly (the W-LSP-DR journal shape). */
export type LspAssemblyEvent = {
    readonly kind: 'policy-change-begin';
    readonly memberId: string;
    readonly from: string | null;
    readonly to: string;
} | {
    readonly kind: 'realm-disposed';
    readonly memberId: string;
    readonly generation: string;
    readonly lastPid: number;
    readonly disposeMs: number;
} | {
    readonly kind: 'realm-assembled';
    readonly memberId: string;
    readonly generation: string;
    readonly pid: number;
} | {
    readonly kind: 'policy-change-complete';
    readonly memberId: string;
    readonly from: string | null;
    readonly to: string;
} | {
    readonly kind: 'assemble-failed';
    readonly memberId: string;
    readonly generation: string;
    readonly stage: 'pre-gate' | 'dispose' | 'spawn' | 'ready' | 'policy';
    readonly detail: string;
};
/** One LIVE isolated instance: (member × generation) bound to its realm and process. */
export interface LspInstance {
    readonly memberId: string;
    readonly generation: string;
    readonly realmId: string;
    /** The confined payload's OS pid (handshake-reported). */
    readonly pid: number;
    readonly handle: StreamingSpawnHandle;
}
export interface LspAssemblyOptions {
    /** THE P-B assembly parameter surface — reused verbatim for every realm. */
    readonly assembly: ProviderAssemblyConfig;
    readonly trustRoot: string | null;
    readonly scratchRoot: string;
    readonly hardDimensions?: readonly string[];
    readonly deps?: ProviderDeps;
    /** The (member × generation) → policy map. Calling it is itself the discipline: generations are explicit. */
    readonly policyFor: (memberId: string, generation: string) => LspRealmPolicy;
    /** Readiness over the live pipes: default = one line-JSON ping must answer with the payload pid. */
    readonly ready?: (instance: LspInstance) => Promise<boolean>;
    readonly readyTimeoutMs?: number;
    readonly terminateGraceMs?: number;
    readonly terminateDeadlineMs?: number;
    readonly journal?: (event: LspAssemblyEvent) => void;
}
/** What the assembly exposes: the discipline API, nothing more. */
export interface LspRealmAssembly {
    /** HOT reuse (same generation) or first assembly. A generation mismatch REFUSES — use policyChange. */
    ensure(memberId: string, generation: string): Promise<ProviderResult<LspInstance>>;
    /** The approved semantics, one call: dispose the old realm (bounded, OS-confirmed) → new isolate. */
    policyChange(memberId: string, generation: string): Promise<ProviderResult<LspInstance>>;
    /** Dispose one member's instance (terminate + settle). Idempotent. */
    dispose(memberId: string): Promise<ProviderResult<{
        readonly generation: string;
        readonly lastPid: number;
        readonly disposeMs: number;
    } | null>>;
    /** Teardown: every instance, net-zero. */
    disposeAll(): Promise<ProviderResult<{
        readonly disposed: readonly {
            readonly memberId: string;
            readonly generation: string;
            readonly lastPid: number;
        }[];
    }>>;
    /** The current live instance of a member, if any. */
    current(memberId: string): LspInstance | undefined;
    /** Live instance count (teardown proof surface). */
    size(): number;
}
export declare function createLspRealmAssembly(options: LspAssemblyOptions): LspRealmAssembly;
//# sourceMappingURL=lsp-assembly.d.ts.map