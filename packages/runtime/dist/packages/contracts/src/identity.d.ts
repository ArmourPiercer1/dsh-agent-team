/**
 * Member identity: the composite runtime identity of a MemberInstance.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **Member runtime identity = `(rootSessionId, instanceId)`** (invariant
 *   18, §10.2). `instanceId` is unique within one TeamSession; the
 *   composite key prevents cross-TeamSession confusion.
 * - **TeamSessionId = RootSessionId** (invariant 9), so the first component
 *   of the key IS the TeamSession id: a member identity names its team
 *   without a separate team id.
 * - **label / templateId / groupId are NOT runtime identities**
 *   (invariant 19): the same templateId + label under two instanceIds are
 *   two different members (§10.2 example).
 * - **LeaderInstance** is the only special member (invariant 14): the Root
 *   Agent/Session of the TeamSession, with no childSessionId (§9.2). It
 *   participates in the unified identity model with a RESERVED instance id
 *   (`LEADER_INSTANCE_ID`) so instance-first message addressing (§24.1)
 *   and ledger actor identity work for the leader without a second
 *   vocabulary.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/identity
 */
import type { InstanceId } from './ids/instance-id.js';
import type { RootSessionId, TeamSessionId } from './ids/session-id.js';
/**
 * The composite runtime identity of one MemberInstance, including the
 * (special) LeaderInstance.
 */
export interface MemberIdentity {
    /** The TeamSession the member belongs to (its root session id, invariant 9). */
    readonly rootSessionId: RootSessionId;
    /** The member's stable instance id, unique within that TeamSession. */
    readonly instanceId: InstanceId;
}
/** Reserved instance id of the LeaderInstance of a TeamSession (see module docs). */
export declare const LEADER_INSTANCE_ID: InstanceId;
/**
 * The stable serialization key of a member identity: the canonical (sorted-
 * key) JSON of the two components. Two identities produce the same key iff
 * they are the same member; a different rootSessionId always changes the
 * key, which is what makes cross-TeamSession confusion impossible at the
 * string level.
 * @param identity - the member identity.
 * @returns the canonical JSON key, e.g. `{"instanceId":"inst-a","rootSessionId":"session-1"}`.
 */
export declare function memberIdentityKey(identity: MemberIdentity): string;
/**
 * Parse a member identity key produced by {@link memberIdentityKey}.
 *
 * Strict: the input must be exactly the canonical encoding of two valid
 * components (extra or missing fields, malformed ids, or a different key
 * order are all rejected).
 * @param key - the identity key string.
 * @returns the parsed member identity.
 * @throws `MALFORMED_DTO` when the key is not canonical encoding of a
 *   member identity, and the id-specific code when a component is malformed.
 */
export declare function parseMemberIdentityKey(key: string): MemberIdentity;
/**
 * Build a member identity from its two components.
 *
 * Both inputs must already be branded (use the `parse*` functions first).
 * The result is deeply frozen: identities are immutable values.
 * @param rootSessionId - the TeamSession (root session) the member belongs to.
 * @param instanceId - the member's stable instance id.
 * @returns the frozen composite identity.
 */
export declare function createMemberIdentity(rootSessionId: RootSessionId, instanceId: InstanceId): MemberIdentity;
/**
 * Build the member identity of the (special) LeaderInstance of a TeamSession.
 * @param teamSessionId - the TeamSession id (which is its root session id, invariant 9).
 * @returns the leader's composite identity under the reserved `inst-leader` id.
 */
export declare function leaderMemberIdentityOf(teamSessionId: TeamSessionId): MemberIdentity;
/**
 * Are two member identities the same member (same TeamSession, same instance)?
 * @param a - first identity.
 * @param b - second identity.
 * @returns `true` iff both components are equal.
 */
export declare function memberIdentitiesEqual(a: MemberIdentity, b: MemberIdentity): boolean;
/**
 * Assert that a member identity belongs to the given TeamSession.
 *
 * This is the guard against the cross-TeamSession confusion the composite
 * key exists to prevent (invariant 18): an identity minted under root A
 * must never be accepted in the context of root B, even when the
 * `instanceId` values collide.
 * @param identity - the member identity to check.
 * @param teamSessionId - the TeamSession context (its root session id).
 * @throws `IDENTITY_SCOPE_MISMATCH` when `identity.rootSessionId` differs from `teamSessionId`.
 */
export declare function assertMemberIdentityInTeam(identity: MemberIdentity, teamSessionId: TeamSessionId): void;
//# sourceMappingURL=identity.d.ts.map