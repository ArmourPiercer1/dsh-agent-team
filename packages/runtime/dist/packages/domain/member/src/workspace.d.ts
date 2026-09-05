/**
 * Workspace creation semantics (P3-T3).
 *
 * Authority (Architecture §21.2, frozen):
 *
 * ```text
 * workspace default:
 *   creation-mutable
 *   immutable after first RUNNING
 *
 * 未指定时继承: TeamSession.defaultWorkspace
 *
 * 一旦 instance 已经在 workspace A 建立 conversation/context，就不能简单把
 * filesystem 根切到 B 并宣称仍是同一干净执行身份。
 * 需要新路线时创建新 MemberInstance。
 * ```
 *
 * Domain rules (this module):
 *
 * - **W1** — Effective workspace resolution: an instance with an explicit
 *   `workspace` uses it; an instance without one inherits
 *   `TeamSession.defaultWorkspace`; when the team has no default either, the
 *   effective workspace is `undefined` (no workspace is a valid configuration
 *   — the field is optional in both frozen DTOs).
 * - **W2** — The workspace field is mutable only while the instance has NOT
 *   yet entered RUNNING (the "creation phase"). The lock is for life, not
 *   until the next settle: an instance that ran in workspace A may never be
 *   re-rooted to B, in any later state (§21.2 — re-rooting would break the
 *   continuation identity of the conversation already established in A).
 *   The "first RUNNING" fact is the durable `hasEnteredRunning` flag carried
 *   by the {@link MemberInstance} wrapper (roster rule R4), because the v1
 *   DTO alone cannot distinguish "never ran" from "ran and settled".
 * - **W3** — A new route (different workspace) means a NEW MemberInstance
 *   (roster `createMemberInstance`), never a re-root of an existing one
 *   (§21.2 last paragraph, §41.2 route example).
 * - **W4** — Like every durable record change (lifecycle rule D3), a
 *   creation-phase workspace change bumps `activityVersion` by exactly 1.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/member/workspace
 */
import type { MemberInstanceRecordDto, TeamSessionRecordDto } from '../../../contracts/src/index.js';
import type { MemberInstance } from './roster.js';
/**
 * Resolve the effective workspace of a member record (W1).
 *
 * @param record - the member record (`workspace?` may be absent = inherited).
 * @param teamSession - the TeamSession record the member belongs to
 *   (must carry the same `rootSessionId`; the caller owns that scoping).
 * @returns the explicit workspace, else the team default, else `undefined`.
 */
export declare function resolveEffectiveWorkspace(record: MemberInstanceRecordDto, teamSession: TeamSessionRecordDto): string | undefined;
/**
 * Change the workspace of a member during its creation phase (W2).
 *
 * Legal while `hasEnteredRunning === false` (state CREATED before any work
 * was admitted). Passing `undefined` clears the explicit workspace, reverting
 * the instance to team-default inheritance (§21.2).
 *
 * @param instance - the current member instance (never mutated).
 * @param workspace - the new explicit workspace, or `undefined` to clear.
 * @returns a NEW frozen {@link MemberInstance} with the updated record
 *   (`activityVersion + 1`, W4).
 * @throws `TeamContractError` `MALFORMED_DTO` when the workspace value is
 *   structurally invalid; {@link MemberDomainError}
 *   `WORKSPACE_MUTATION_FORBIDDEN` when the instance already entered RUNNING
 *   — for a new route, create a new MemberInstance instead (W3, §21.2).
 */
export declare function setWorkspace(instance: MemberInstance, workspace: unknown): MemberInstance;
//# sourceMappingURL=workspace.d.ts.map