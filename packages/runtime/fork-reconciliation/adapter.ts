/**
 * The real `ForkReconciliationTeamDomain` adapter over the P4 `TeamDomain`
 * repositories (P7-T4; the mirror of the P5-T5 root-binding
 * `createTeamDomainWritePort` and the P5-T1 read handle).
 *
 * The repositories are the durable `team_domain` store of the frozen
 * contracts v1 DTOs (TaskDoc §11.5 P4): this adapter only projects them
 * onto the injected port interface — no new durable semantics, no
 * re-validation (the repositories validate and stamp), no bypass.
 *
 * Invariant 41 (TeamDomain is the sole durable control-plane authority):
 * the root-fork sidecar's two durable writes flow through exactly these
 * two repository methods; the recognition reads flow through the read
 * projections of the same bundle. Nothing else in the module touches the
 * durable layer.
 *
 * @module @dsh-agent-team/runtime/fork-reconciliation/adapter
 */

import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import type {
  MemberInstanceRecordDto,
  SessionBindingDto,
  TeamSessionRecordDto,
  TeamSessionRecordInput,
} from '../../contracts/src/index.js'
import type { ForkReconciliationTeamDomain } from './types.js'

/**
 * Build the fork-reconciliation TeamDomain port over one open `TeamDomain`'s
 * repositories.
 *
 * @param repositories - the P4 TeamDomain repository bundle.
 * @returns the injected port (recognition reads + the two sidecar writes).
 */
export function createTeamDomainForkPort(
  repositories: TeamDomainRepositories,
): ForkReconciliationTeamDomain {
  return {
    getSessionBinding(sessionId: string): SessionBindingDto | undefined {
      return repositories.sessionBindings.get(sessionId)
    },
    getTeamSession(rootSessionId: string): TeamSessionRecordDto | undefined {
      return repositories.teamSessions.get(rootSessionId)
    },
    listMemberInstances(rootSessionId: string): readonly MemberInstanceRecordDto[] {
      return repositories.memberInstances.list(rootSessionId)
    },
    putTeamSession(input: TeamSessionRecordInput): Promise<TeamSessionRecordDto> {
      return repositories.teamSessions.put(input)
    },
    putSessionBinding(binding: SessionBindingDto): Promise<SessionBindingDto> {
      return repositories.sessionBindings.put(binding)
    },
  }
}
