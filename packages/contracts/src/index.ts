/**
 * @dsh-agent-team/contracts — frozen cross-package contract vocabulary.
 *
 * Responsibility (TaskDoc §11 package boundary): the single source for the
 * vNext contract shapes every other package consumes — TeamBlueprint /
 * TeamSession / MemberInstance record structures and the payload vocabulary
 * with `templateId` / `instanceId` addressing. Team control-plane facts are
 * never expressed as DSH SessionEvents, and no legacy vocabulary is carried
 * over (legacy is reference-only, see `docs/migration`).
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker only; the real contract types land in the P3 contracts work.
 * @module @dsh-agent-team/contracts
 */

/**
 * Stable identity marker of the contracts package.
 *
 * Placeholder until the P3 contract types replace it; its value is asserted
 * by the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'contracts'
