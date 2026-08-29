/**
 * @dsh-agent-team/testkit — shared test infrastructure.
 *
 * Responsibility (TaskDoc §11 package boundary): fixtures and helpers the
 * other packages' tests share — fault-injection / restart fixtures, golden
 * fixtures, shared assertions. Testkit is consumed by tests only; no
 * production package may depend on it.
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker only; the real fixtures land in the P4-T5 testkit work.
 * @module @dsh-agent-team/testkit
 */

/**
 * Stable identity marker of the testkit package.
 *
 * Placeholder until the P4-T5 testkit work replaces it; its value is
 * asserted by the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'testkit'
