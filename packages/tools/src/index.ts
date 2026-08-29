/**
 * @dsh-agent-team/tools — model-callable team tools.
 *
 * Responsibility (TaskDoc §11 package boundary): the team tools the model
 * invokes (roster, progress, messaging), redesigned against the contracts
 * package. Tool state flows through TeamDomain (the sole control-plane
 * authority) — never through DSH SessionEvent writes.
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker only; the real tool surface lands in the P5/P6 tool work.
 * @module @dsh-agent-team/tools
 */

/**
 * Stable identity marker of the tools package.
 *
 * Placeholder until the P5/P6 tool work replaces it; its value is asserted
 * by the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'tools'
