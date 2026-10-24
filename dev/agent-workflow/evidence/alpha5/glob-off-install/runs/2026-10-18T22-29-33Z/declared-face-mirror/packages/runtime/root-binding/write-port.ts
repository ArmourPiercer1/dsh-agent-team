/**
 * The real `TeamDomainWritePort` adapter over the P4 `TeamDomain`
 * repositories (P5-T5; the mirror image of the binder's
 * `createTeamDomainReadHandle` projection, P5-T1).
 *
 * The repositories are the durable `team_domain` store of the frozen
 * contracts v1 DTOs (TaskDoc §11.5 P4): this adapter only projects them
 * onto the injected port interface — no new durable semantics, no
 * re-validation (the repositories validate and stamp), no bypass.
 *
 * Invariant 41 (TeamDomain is the sole durable control-plane authority):
 * every durable write of the root binding flows through exactly these
 * three repository methods (the P8-S2 LeaderInstance mint uses
 * `memberInstances.put`); the read side flows through
 * `createTeamDomainReadHandle` (P5-T1). Nothing else in the module
 * touches the durable layer.
 *
 * @module @dsh-agent-team/runtime/root-binding/write-port
 */

import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import type {
  LeaderInstanceRecordDto,
  LeaderInstanceRecordInput,
  MemberInstanceRecordDto,
  MemberInstanceRecordInput,
  SessionBindingDto,
  TeamSessionRecordDto,
  TeamSessionRecordInput,
} from '../../contracts/src/index.js'
import type { TeamDomainWritePort } from './types.js'

/**
 * Build the durable write port over one open `TeamDomain`'s repositories
 * (the fresh-root path's writer).
 *
 * @param repositories - the P4 TeamDomain repository bundle.
 * @returns the injected write port.
 */
export function createTeamDomainWritePort(
  repositories: TeamDomainRepositories,
): TeamDomainWritePort {
  return {
    putTeamSession(input: TeamSessionRecordInput): Promise<TeamSessionRecordDto> {
      return repositories.teamSessions.put(input)
    },
    putSessionBinding(binding: SessionBindingDto): Promise<SessionBindingDto> {
      return repositories.sessionBindings.put(binding)
    },
    putMemberInstance(
      input: MemberInstanceRecordInput | LeaderInstanceRecordInput,
    ): Promise<MemberInstanceRecordDto | LeaderInstanceRecordDto> {
      // Documented cast: the contracts factory (`createMemberInstanceRecord`)
      // branches on the input shape and mints EITHER the v1 member record
      // OR the honest v2 leader record — the repository stores exactly the
      // produced record. The repository's declared v1 input/return types
      // are the documented contracts type-lie for v2 rows.
      return repositories.memberInstances.put(input as MemberInstanceRecordInput)
    },
  }
}
