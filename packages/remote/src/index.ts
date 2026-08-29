/**
 * @dsh-agent-team/remote — Team remote projection feeds.
 *
 * Responsibility (TaskDoc §11 package boundary): the Team remote surface —
 * durable, replayable projection feeds that external consumers and the Web
 * UI subscribe to, derived from TeamDomain (the sole control-plane
 * authority). The remote never writes team state; it projects it.
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker only; the real projection feeds land in the P8 remote work.
 * @module @dsh-agent-team/remote
 */

/**
 * Stable identity marker of the remote package.
 *
 * Placeholder until the P8 remote work replaces it; its value is asserted
 * by the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'remote'
