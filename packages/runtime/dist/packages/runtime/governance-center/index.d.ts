/**
 * `@dsh-agent-team/runtime/governance-center` — the U6 PR1 center-assembly
 * lane (U6-SLICE-PLAN PR1; target architecture
 * `docs/plans/memo/alpha5-reset-20261025/center-assembly-architecture.md`
 * — three components: GovernedFamilyRegistry, GovernanceKernel,
 * HostSurfaceAdapter).
 *
 * STATE: INERT / SHADOW ONLY, NO AUTHORITY. This barrel ships the closed
 * contribution schema (§4 boundaries, §10.3 law), the read-only candidate
 * registry (collision + generation, non-authorizing), the §5 state-machine
 * kernel (center-owned approval table, one-shot consume THROUGH an injected
 * port over the existing tool-admission `consumeForExecution` face — grant
 * logic is composed, never re-implemented), and the public-seam-only Host
 * surface adapter. The single production consumer is the shadow mount in
 * `src/plugin/live/agent-bindings.mjs` (config
 * `teamToolPlane.centerAssembly`, default `'off'`); in `shadow` the kernel
 * computes its verdict into an audit-only ledger and ALWAYS takes `next()`
 * — zero behavior change. Enforcement arrives with PR2+ per the slice plan.
 *
 * LAYER LAW: no imports from the center files it will later replace
 * (`src/plugin/live/*`, `tool-dispatch`, `tool-admission`,
 * `operation-permission`, `control`) and no Host-internal imports — every
 * external force arrives through an injected port at the trusted assembly
 * point. See README.md for the protected-center-file posture.
 *
 * @module governance-center
 */
export { CONTRIBUTION_SCHEMA_MAJOR, validateFamilyContribution, type ContributionFailureCode, type ContributionValidation, type ContributionVersion, type FamilyContributionInput, type FrozenContribution, type KernelCapability, type KernelCapabilityManifest, } from './contribution-schema.js';
export { createGovernedFamilyRegistry, type CandidateState, type GovernedFamilyRegistry, type RegisteredCandidate, type RegistrationOrigin, type RegistryRefusalCode, type RegistryResult, type RegistryView, } from './registry.js';
export { KERNEL_STATES, createGovernanceKernel, type ApprovalEntry, type CallFacts, type DispatcherLifecyclePort, type FamilyFace, type GrantConsumePort, type GovernanceKernel, type KernelFailureCode, type KernelPorts, type KernelState, type KernelVerdict, type TransitionResult, } from './kernel.js';
export { createHostSurfaceAdapter, type DefinitionRead, type HostAdapterRefusalCode, type HostSurfaceAdapter, type HostToolsSurface, } from './host-adapter.js';
import { type GovernedFamilyRegistry } from './registry.js';
import { type GovernanceKernel, type KernelPorts } from './kernel.js';
import { type HostSurfaceAdapter, type HostToolsSurface } from './host-adapter.js';
import type { KernelCapabilityManifest } from './contribution-schema.js';
/**
 * Compose one center skeleton over injected ports. The registry exists
 * before the kernel (the kernel reads candidate provenance); the adapter is
 * optional because shadow may legitimately observe a surface without
 * registering anything on it.
 */
export declare function createCenterAssembly(deps: {
    readonly kernelManifest: KernelCapabilityManifest;
    readonly ports?: KernelPorts;
    readonly tools?: HostToolsSurface | undefined;
    readonly on?: (event: string, listener: (...args: never[]) => unknown) => () => void;
    readonly identityOf: (target: unknown) => string | null;
}): {
    readonly registry: GovernedFamilyRegistry;
    readonly kernel: GovernanceKernel;
    readonly adapter: HostSurfaceAdapter;
};
//# sourceMappingURL=index.d.ts.map