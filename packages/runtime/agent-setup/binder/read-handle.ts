/**
 * The read-only TeamDomain handle adapter (TaskDoc §11.5 P5-T1; ruling
 * R28: "binder 只持注入的只读 handle").
 *
 * The P4 storage repositories are the durable TeamDomain authority
 * (invariant 41). The binder consumes exactly THREE of the eight
 * repositories — all read methods, no writes — through the narrow
 * {@link TeamDomainReadHandle} contract (./types.js). This adapter builds
 * that contract from the real repository facades:
 *
 * - `teamSessions.get`      → `getTeamSession`
 * - `memberInstances.get`   → `getMemberInstance`
 * - `sessionBindings.get`   → `getSessionBinding`
 *
 * The write surface of the repositories (`put` / `delete`) is deliberately
 * NOT projected: the binder can only READ the durable truth. The import is
 * TYPE-ONLY — the binder module carries no runtime dependency on the
 * storage package; the repositories are injected at the adapter call site
 * (production: T5/T6 over the real StorageDomain seam; tests: the P4
 * repositories over the testkit file seam or an in-memory seam).
 *
 * Pure module: no I/O, no `node:` builtin, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/binder/read-handle
 */

import type { TeamDomainRepositories } from '../../../storage/repositories/index.js'
import type { TeamDomainReadHandle } from './types.js'

/**
 * The three read-only repository facades the binder consumes (a view over
 * the P4 `TeamDomainRepositories`; the write methods are out of scope by
 * construction).
 */
export type TeamDomainReadRepositories = Pick<
  TeamDomainRepositories,
  'teamSessions' | 'memberInstances' | 'sessionBindings'
>

/**
 * Build the read-only TeamDomain handle over the three repositories.
 * @param repositories - the P4 repository facades (any object exposing the
 *   three `get`-only facades; the real `TeamDomainRepositories` qualifies).
 * @returns the read-only handle the binder consumes.
 */
export function createTeamDomainReadHandle(
  repositories: TeamDomainReadRepositories,
): TeamDomainReadHandle {
  return {
    getTeamSession(rootSessionId: string) {
      return repositories.teamSessions.get(rootSessionId)
    },
    getMemberInstance(rootSessionId: string, instanceId: string) {
      return repositories.memberInstances.get(rootSessionId, instanceId)
    },
    getSessionBinding(sessionId: string) {
      return repositories.sessionBindings.get(sessionId)
    },
  }
}
