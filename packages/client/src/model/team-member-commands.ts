/**
 * P9-T7 (S5-B) — pure model for the member command flows (plan P9-S5
 * S5-B + Gate P9-G5; UI doc §17/§23/§40): the per-lifecycle action set
 * (the UI §40 matrix), the frozen Remote param builders (`member.create` /
 * `member.send` / `member.followup` / `member.archive` / `member.restore` /
 * `member.dispose`), the typed-outcome parser (the remote typed result is
 * preserved verbatim — `code`, `message`, and the `requestToken` echo —
 * and no optimistic authority patch is ever applied), and a local
 * request-token generator.
 *
 * Caller convention (host test convention): the human caller is
 * `{ kind: 'human', humanId: <teamSessionId> }` — humanId is the
 * TeamSession id, which IS the root DSH session id (invariant 9).
 *
 * Pure module: no React, no I/O, no crypto. Erasable TS only.
 * @module @dsh-agent-team/client/model/team-member-commands
 */

import type {
  RemoteCaller,
  RemoteMemberCreateParams,
  RemoteMemberFollowupParams,
  RemoteMemberLifecycleParams,
  RemoteMemberSendParams,
  RemoteResponse,
} from '../../../remote/src/index.js'

/** The member command kinds (S5-B flows + the §23 lifecycle actions). */
export type MemberCommandKind =
  | 'create'
  | 'send'
  | 'followup'
  | 'archive'
  | 'restore'
  | 'dispose'

/**
 * The row-level command kinds (everything but `create`): the §40 matrix
 * governs the instance rows; `create` is the group-row "+" entry.
 */
export type MemberInstanceCommand = Exclude<MemberCommandKind, 'create'>

/** The five closed lifecycle states (wire spelling, UI §40 matrix rows). */
export type MemberLifecycle =
  | 'CREATED'
  | 'RUNNING'
  | 'SETTLED'
  | 'ARCHIVED'
  | 'DISPOSED'

/**
 * The §40 action matrix: the commands allowed per lifecycle (`Yes` in the
 * matrix = lifecycle-allowed; policy may still block at admission).
 * Send work / follow-up / message are exposed on the three live states;
 * archive and dispose everywhere except DISPOSED; restore only from
 * ARCHIVED.
 */
const MEMBER_ACTIONS: Record<MemberLifecycle, readonly MemberInstanceCommand[]> = {
  CREATED: ['send', 'followup', 'archive', 'dispose'],
  RUNNING: ['send', 'followup', 'archive', 'dispose'],
  SETTLED: ['send', 'followup', 'archive', 'dispose'],
  ARCHIVED: ['restore', 'dispose'],
  DISPOSED: [],
}

/**
 * The commands the §40 matrix allows for one lifecycle.
 * @param lifecycle - the instance's closed lifecycle state.
 * @returns the allowed row command kinds (empty for DISPOSED; never `create`).
 */
export function memberActionsForLifecycle(lifecycle: MemberLifecycle): readonly MemberInstanceCommand[] {
  return MEMBER_ACTIONS[lifecycle]
}

/**
 * The display token for one command in one lifecycle (UI §40 matrix
 * labels): CREATED "Send work…", RUNNING "Send follow-up", SETTLED
 * "Resume…" (the follow-up that opens the send-new-work interaction);
 * `send` reads "Send work…" on CREATED and "Message…" on the other two
 * live states.
 */
export type MemberActionLabel =
  | 'sendWork'
  | 'followup'
  | 'resume'
  | 'message'
  | 'archive'
  | 'restore'
  | 'dispose'

/**
 * The label token for one command in one lifecycle.
 * @param kind - the command kind (never `create` — that has its own entry).
 * @param lifecycle - the instance's closed lifecycle state.
 * @returns the label token.
 */
export function memberActionLabel(
  kind: Exclude<MemberCommandKind, 'create'>,
  lifecycle: MemberLifecycle,
): MemberActionLabel {
  switch (kind) {
    case 'send':
      return lifecycle === 'CREATED' ? 'sendWork' : 'message'
    case 'followup':
      return lifecycle === 'SETTLED' ? 'resume' : 'followup'
    case 'archive':
      return 'archive'
    case 'restore':
      return 'restore'
    case 'dispose':
      return 'dispose'
  }
}

/**
 * The human caller for a team (the host test convention): humanId is the
 * TeamSession id (the root DSH session id, invariant 9).
 * @param teamSessionId - the TeamSession id.
 * @returns the frozen caller object.
 */
export function humanCaller(teamSessionId: string): RemoteCaller {
  return { kind: 'human', humanId: teamSessionId }
}

/** The `member.create` input (the §17 dialog fields). */
export interface MemberCreateInput {
  readonly teamSessionId: string
  /** The delegation template the new instance binds to. */
  readonly templateId: string
  readonly requestToken: string
  /** Required by host admission; the instance label. */
  readonly label: string
  /** Optional group id (the §17 "Group" field). */
  readonly groupId?: string
  /** Optional workspace (the §17 "Workspace" field; the host stores the string). */
  readonly workspace?: string
}

/**
 * Build the `member.create` params: the template delegation (exactly one
 * of the two delegation fields) plus the host-consumed payload fields
 * (`label` required; `groupId` / `workspace` when given).
 * @param input - the dialog input.
 * @returns the frozen param object.
 */
export function buildMemberCreateParams(input: MemberCreateInput): RemoteMemberCreateParams {
  const payload: Record<string, string> = { label: input.label }
  if (input.groupId !== undefined) payload['groupId'] = input.groupId
  if (input.workspace !== undefined) payload['workspace'] = input.workspace
  return {
    teamSessionId: input.teamSessionId,
    caller: humanCaller(input.teamSessionId),
    requestToken: input.requestToken,
    delegationTemplateId: input.templateId,
    payload,
  }
}

/** The `member.followup` input (the work prompt dialog). */
export interface MemberFollowupInput {
  readonly teamSessionId: string
  readonly targetInstanceId: string
  readonly requestToken: string
  /** The work prompt — required, non-empty (host admission validates it). */
  readonly prompt: string
}

/**
 * Build the `member.followup` params: the prompt rides the `payload`
 * (`payload.prompt`, host admission) — the frozen follow-up channel.
 * @param input - the dialog input.
 * @returns the frozen param object.
 */
export function buildMemberFollowupParams(input: MemberFollowupInput): RemoteMemberFollowupParams {
  return {
    teamSessionId: input.teamSessionId,
    caller: humanCaller(input.teamSessionId),
    targetInstanceId: input.targetInstanceId,
    requestToken: input.requestToken,
    payload: { prompt: input.prompt },
  }
}

/** The `member.send` input (the member Chat message). */
export interface MemberSendInput {
  readonly teamSessionId: string
  readonly recipientInstanceId: string
  readonly requestToken: string
  /** Free-form body, 1..200000 chars (frozen bound). */
  readonly body: string
  /** Optional subject line. */
  readonly subject?: string
}

/**
 * Build the `member.send` params: a coordination message to the member's
 * Chat (UI §28: relays in the Member Chat, correlated in the TeamLedger).
 * @param input - the dialog input.
 * @returns the frozen param object.
 */
export function buildMemberSendParams(input: MemberSendInput): RemoteMemberSendParams {
  return input.subject === undefined
    ? {
        teamSessionId: input.teamSessionId,
        caller: humanCaller(input.teamSessionId),
        recipientInstanceId: input.recipientInstanceId,
        body: input.body,
        requestToken: input.requestToken,
      }
    : {
        teamSessionId: input.teamSessionId,
        caller: humanCaller(input.teamSessionId),
        recipientInstanceId: input.recipientInstanceId,
        body: input.body,
        subject: input.subject,
        requestToken: input.requestToken,
      }
}

/**
 * Build the `member.archive` / `member.restore` / `member.dispose` params
 * (the frozen lifecycle pair — no token, no payload).
 * @param teamSessionId - the TeamSession id.
 * @param instanceId - the target instance id.
 * @returns the frozen param object.
 */
export function buildMemberLifecycleParams(
  teamSessionId: string,
  instanceId: string,
): RemoteMemberLifecycleParams {
  return { teamSessionId, instanceId }
}

/** The preserved typed outcome of one member command (Gate P9-G5). */
export type MemberCommandOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false
      /** The wire error code, verbatim (never reworded). */
      readonly code: string
      /** The wire message, verbatim (never reworded). */
      readonly message: string
      /** The host-stamped token echo from `details.requestToken`. */
      readonly requestToken: string | null
    }

/**
 * Parse a member command's raw `RemoteResponse`, preserving the remote
 * typed result verbatim (Gate P9-G5). A success carries no further UI
 * state — the post-success projection pull is the authority, and no
 * optimistic authority patch is applied before the response lands.
 * @param response - the raw remote response for the command.
 * @returns the preserved outcome.
 */
export function parseMemberCommandOutcome(response: RemoteResponse): MemberCommandOutcome {
  if (response.ok) return { ok: true }
  const details = response.error.details
  return {
    ok: false,
    code: response.error.code,
    message: response.error.message,
    requestToken: details.requestToken,
  }
}

/**
 * Create a local request-token generator: `prefix-<n>` per call (a pure
 * counter — no crypto dependency; the host treats the token as an opaque
 * echo idempotency marker).
 * @param prefix - the token prefix (e.g. the command kind).
 * @returns a function yielding the next token.
 */
export function createRequestTokenGenerator(prefix: string): () => string {
  let next = 0
  return () => {
    next += 1
    return `${prefix}-${next}`
  }
}
