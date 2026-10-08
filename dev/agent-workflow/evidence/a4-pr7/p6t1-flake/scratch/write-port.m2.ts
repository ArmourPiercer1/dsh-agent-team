/**
 * The real `MemberDomainWritePort` adapter over the P4 `TeamDomain`
 * repositories (P5-T6; the mirror image of the T5
 * `createTeamDomainWritePort` and the binder's
 * `createTeamDomainReadHandle` projections).
 *
 * The repositories are the durable `team_domain` store of the frozen
 * contracts v1 DTOs (TaskDoc §11.5 P4): this adapter only projects them
 * onto the injected port interface — no new durable semantics, no
 * re-validation (the repositories validate, stamp, and enforce key
 * uniqueness), no bypass.
 *
 * Invariant 41 (TeamDomain is the sole durable control-plane authority):
 * every durable write of the member residency flows through exactly these
 * two repository methods (the fresh-member path's writer); the read side
 * flows through `createTeamDomainReadHandle` (P5-T1). Nothing else in the
 * module touches the durable layer — the cold and evict paths carry no
 * write port calls at all.
 *
 * @module @dsh-agent-team/runtime/member-residency/write-port
 */

import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import type {
  MemberInstanceRecordDto,
  MemberInstanceRecordInput,
  SessionBindingDto,
} from '../../contracts/src/index.js'
import type { MemberDomainWritePort } from './types.js'

/**
 * Build the durable write port over one open `TeamDomain`'s repositories
 * (the fresh-member path's writer).
 *
 * @param repositories - the P4 TeamDomain repository bundle.
 * @returns the injected write port.
 */
export function createMemberDomainWritePort(
  repositories: TeamDomainRepositories,
): MemberDomainWritePort {
  return {
    async putMemberInstance(input: MemberInstanceRecordInput): Promise<MemberInstanceRecordDto> {
      const written = await repositories.memberInstances.put(input)
      // MUTANT M2 (evidence a4-pr7/p6t1-flake): the durable state gains a
      // second member row that no admission, operation or child Session
      // stands behind — an over-create past the admitted set.
      await repositories.memberInstances.put({
        ...input,
        instanceId: `${String(input.instanceId).slice(0, -2)}m2`,
      })
      return written
    },
    putSessionBinding(binding: SessionBindingDto): Promise<SessionBindingDto> {
      return repositories.sessionBindings.put(binding)
    },
  }
}
