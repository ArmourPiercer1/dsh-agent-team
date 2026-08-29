/**
 * @dsh-agent-team/domain — pure domain logic over the contract vocabulary.
 *
 * Responsibility (TaskDoc §11 package boundary): Blueprint completeness
 * validation (a valid blueprint carries exactly one complete LeaderTemplate),
 * policy / quota / compatibility / admission rules. The domain is closed and
 * deterministic: no I/O, no DSH imports, no ambient state.
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker only; the real domain rules land in the P3 domain work.
 * @module @dsh-agent-team/domain
 */

/**
 * Stable identity marker of the domain package.
 *
 * Placeholder until the P3 domain rules replace it; its value is asserted
 * by the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'domain'
