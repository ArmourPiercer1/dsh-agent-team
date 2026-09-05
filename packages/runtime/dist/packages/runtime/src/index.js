/**
 * @dsh-agent-team/runtime — runtime orchestration + host plugin half.
 *
 * Responsibility (TaskDoc §11 package boundary): Binder / Activation /
 * Projection over the public DSH seams, the MemberInstance lifecycle
 * (CREATED / RUNNING / SETTLED / ARCHIVED / DISPOSED; Restore =
 * ARCHIVED → SETTLED — durable availability only, no Agent resume), and the
 * host half of the dsh-agent-team Cordis plugin (see ./plugin/host.ts).
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker; the plugin entrypoints are already present as empty,
 * side-effect-free modules verified by `scripts/composition-smoke.mjs`.
 * @module @dsh-agent-team/runtime
 */
/**
 * Stable identity marker of the runtime package.
 *
 * Placeholder until the P5/P6 runtime work replaces it; its value is
 * asserted by the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'runtime';
//# sourceMappingURL=index.js.map