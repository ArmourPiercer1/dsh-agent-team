/**
 * @dsh-agent-team/domain policy resolver (P3-T4).
 *
 * The pure resolver for Team policy: Blueprint envelope → PolicyState →
 * template/instance/human override → external hard intersection
 * (Architecture §19.6 two-stage resolution), with the provenance of every
 * effective value as first-class output data.
 *
 * This sub-module is self-contained under `packages/domain/policy/**`
 * (P3-T4 owned path). Final package wiring (re-export from
 * `packages/domain/src/index.ts`) is P3-T6's job; imports in this phase go
 * through the relative source path `packages/domain/policy/src/index.js`.
 *
 * Public API:
 * - the contracts-v1 identity surface as a local mirror (id types,
 *   parsers, member identity, deep-freeze) — see {@link ./contracts-mirror.js}
 *   for why the package mirrors instead of importing contracts sources;
 * - {@link resolveEffectivePolicy} — the resolver (pure, deterministic);
 * - the closed vocabulary (capabilities, layers, origins, error codes);
 * - the input/output types (effective policy, cells, provenance records);
 * - {@link PolicyResolutionError} — the typed policy-semantic error
 *   (escalation failures are typed errors, never silent).
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 * @module @dsh-agent-team/domain/policy
 */

export * from './contracts-mirror.js'
export * from './types.js'
export * from './errors.js'
export { validatePolicyInput } from './validate.js'
export type { ValidatedPolicyInput } from './validate.js'
export { resolveEffectivePolicy } from './resolve.js'
