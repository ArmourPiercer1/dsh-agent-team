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
export { CONTRIBUTION_SCHEMA_MAJOR, validateFamilyContribution, } from './contribution-schema.js';
export { createGovernedFamilyRegistry, } from './registry.js';
export { KERNEL_STATES, createGovernanceKernel, } from './kernel.js';
export { createHostSurfaceAdapter, } from './host-adapter.js';
import { createGovernedFamilyRegistry } from './registry.js';
import { createGovernanceKernel } from './kernel.js';
import { createHostSurfaceAdapter } from './host-adapter.js';
/**
 * Compose one center skeleton over injected ports. The registry exists
 * before the kernel (the kernel reads candidate provenance); the adapter is
 * optional because shadow may legitimately observe a surface without
 * registering anything on it.
 */
export function createCenterAssembly(deps) {
    const registry = createGovernedFamilyRegistry({ kernelManifest: deps.kernelManifest });
    const kernel = createGovernanceKernel({ registry, ports: deps.ports });
    const adapter = createHostSurfaceAdapter({ tools: deps.tools, on: deps.on, identityOf: deps.identityOf });
    return { registry, kernel, adapter };
}
//# sourceMappingURL=index.js.map