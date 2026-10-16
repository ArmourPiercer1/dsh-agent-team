/**
 * Alpha.5 PR4 — Linux Confined Process provider/launcher lane (C Lane,
 * `ConfinedProcessProvider` freeze point). DORMANT: zero production
 * consumers, zero wiring; the lane develops against the frozen PR0 contract
 * via the LOCAL structural stub (`contract-stub.ts`, pinned element-for-element
 * by `a5p4-lane-hygiene`).
 *
 * Surface: C-PROC phase closed set (probe → prepare → execute → terminate,
 * terminate ≠ cancel), the FD-inheritance declaration set with the fixed
 * close-all-undeclared default, the network-dimension closed set at PoC-4b
 * honesty, the trusted pre-launcher interface with the AUTHORITATIVE probe
 * surface (bare syscall GET_VERSION + real enforcement double evidence,
 * PoC4), the realm/trustRoot evidence gate (negative controls only;
 * `HARD_PROFILE_ENABLED` false), and the provider seam with the no-fallback
 * law.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider
 */

export * from './contract-stub.js'
export * from './phases.js'
export * from './fd-inheritance.js'
export * from './network.js'
export * from './probe-abi.js'
export * from './realm-evidence.js'
export * from './provider.js'
