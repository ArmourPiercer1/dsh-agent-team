/**
 * P6-T6 — the model-facing team tools: the closed tool set and the factory
 * that wires it over the sanctioned runtime satellite set (SD-DEPS).
 *
 * EVERY tool delegates to the Runtime (the task-card rule — the tool layer
 * holds no team state and performs no durable write of its own):
 *
 * | tool                  | delegate to                                  |
 * | --------------------- | -------------------------------------------- |
 * | team_list_members     | facade `list-members`                        |
 * | team_list_templates   | facade `list-templates`                      |
 * | team_inspect_config   | facade `inspect-config` (instance-targeted)  |
 * | team_create_member    | facade `create-member` (SD-CREATE: unguarded)|
 * | team_delegate         | facade `delegate` (guarded on the target     |
 * |                       | instance for the continue form, SD-GUARD)    |
 * | team_follow_up        | facade `follow-up` (guarded, SD-GUARD)       |
 * | team_send_message     | messaging coordinator `sendTeamMessage`      |
 * |                       | (guarded on the recipient, SD-GUARD)         |
 * | team_report_progress  | activity ledger `recordProgress`             |
 * |                       | (guarded on the instance, SD-GUARD)          |
 * | team_request_control  | control service `requestControl` (the        |
 * |                       | approval-flow entry point: unguarded,        |
 * |                       | idempotent over the scope identity)          |
 * | team_resolve_control  | control service `resolveControl` (unguarded: |
 * |                       | the service's resolver role closure is the   |
 * |                       | authority; a member is never a resolver)     |
 *
 * The guarded work operations consult the last-mile guard IMMEDIATELY
 * before execution (see guard.ts, SD-GUARD); a blocked verdict returns the
 * closed reason with zero side effects and the runtime is never called.
 * The guard's scope key is the instance-identity namespace (guardOperation
 * parses targetInstanceId): well-formed instance ids ALWAYS consult the
 * guard and its verdict is final (SD-GUARD-NS). Tokens outside that
 * namespace (labels, template ids) are the runtime's addressing domain —
 * the tool passes them through untouched and the runtime's
 * instance-addressed resolution live-rejects them
 * (TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED, G6 E2), which never executes.
 *
 * Results are lossless JSON ({@link TeamToolsResult}): typed business
 * rejections and guard blocks settle as results (the model sees them as
 * normal control flow); only unexpected errors throw (the host pipeline
 * marks them as tool errors).
 *
 * @module @dsh-agent-team/tools/tools
 */

import {
  ACTION_NAMES,
  PROGRESS_VALUES,
  isTeamRuntimeError,
} from '../../runtime/admission/index.js'
import type { ProgressValue } from '../../runtime/admission/index.js'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_REQUEST_KIND_VALUES,
  isControlError,
} from '../../runtime/control/index.js'
import type { ControlRequestKind } from '../../runtime/control/index.js'
import { isMessagingError } from '../../runtime/messaging/index.js'
import {
  ACTIVITY_ERROR_CODES,
  isActivityError,
} from '../../runtime/activity/index.js'
import {
  isArgsRecord,
  isTeamToolArgsError,
  optionalStringField,
  requireStringField,
  validateRequestToken,
} from './tokens.js'
import {
  TEAM_TOOL_BAD_ARGUMENTS,
  TEAM_TOOL_CALLER_UNRESOLVED,
  TeamToolArgsError,
} from './tokens.js'
import { INSTANCE_ID_PATTERN } from '../../contracts/src/index.js'
import { consultGuard } from './guard.js'
import type {
  TeamToolDefinition,
  TeamToolExecContext,
  TeamToolsOptions,
  TeamToolsResult,
} from './types.js'
import type {
  ActionCaller,
  TeamRuntimeActionOutcome,
  TeamRuntimeActionRequest,
} from '../../runtime/admission/index.js'
import type { SendTeamMessageOutcome } from '../../runtime/messaging/index.js'

/** The maximum root-session-id length accepted by the tool layer. */
const ROOT_SESSION_MAX_LENGTH = 255
/** The maximum message-body length accepted by the tool layer. */
const BODY_MAX_LENGTH = 8192
/** The maximum subject / summary / last-action lengths (durable bounds). */
const SUBJECT_MAX_LENGTH = 256
const SUMMARY_MAX_LENGTH = 512
const LAST_ACTION_MAX_LENGTH = 256
const CORRELATION_MAX_LENGTH = 128
const TASK_SUMMARY_MAX_LENGTH = 512
const WORK_PROMPT_MAX_LENGTH = 16384
const ATTACHED_CONTEXT_MAX_LENGTH = 32768
const LABEL_MAX_LENGTH = 256
const TEMPLATE_ID_MAX_LENGTH = 256
const INSTANCE_ID_MAX_LENGTH = 256
const ACTION_NAME_MAX_LENGTH = 128
const TOOL_NAME_MAX_LENGTH = 128
const REQUEST_ID_MAX_LENGTH = 128
const NOTE_MAX_LENGTH = 256

// --- shared argument descriptions (model-facing) ---------------------------------

const ROOT_SESSION_ID_ARG = {
  type: 'string',
  description:
    'The TeamSession (root session) id this operation belongs to.',
}
const REQUEST_TOKEN_ARG = {
  type: 'string',
  description:
    'A token unique to THIS logical operation (non-empty, max 128 chars). Reuse the exact same token only when retrying the same logical operation; never reuse it for a different one.',
}
const TARGET_INSTANCE_ARG = {
  type: 'string',
  description: 'The member INSTANCE id the operation is addressed to (labels and template ids are rejected).',
}
const LABEL_ARG = {
  type: 'string',
  description: 'A short human-readable label for the new member instance (non-empty).',
}

// --- error mapping ----------------------------------------------------------------

/**
 * Map one typed runtime/control/messaging/activity/tool-layer error to the
 * `rejected` result; return `undefined` for anything else (the caller
 * rethrows unexpected errors).
 */
function rejectFromError(error: unknown): TeamToolsResult | undefined {
  if (isTeamRuntimeError(error)) {
    return {
      status: 'rejected',
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }
  }
  if (isControlError(error)) {
    return {
      status: 'rejected',
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }
  }
  if (isMessagingError(error)) {
    return {
      status: 'rejected',
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }
  }
  if (isActivityError(error)) {
    return {
      status: 'rejected',
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }
  }
  if (isTeamToolArgsError(error)) {
    return {
      status: 'rejected',
      code: TEAM_TOOL_BAD_ARGUMENTS,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }
  }
  return undefined
}

// --- caller resolution -------------------------------------------------------------

type CallerResolution =
  | { readonly ok: true; readonly caller: ActionCaller }
  | { readonly ok: false; readonly result: TeamToolsResult }

/**
 * Resolve the calling authority from the execution context (SD-CALLER):
 * the calling agent's session id through the injected resolver; any
 * failure settles as a `rejected` result (the runtime is never called).
 */
async function resolveToolCaller(
  options: TeamToolsOptions,
  exec: TeamToolExecContext,
): Promise<CallerResolution> {
  const agent = exec.agent
  const agentId = agent === undefined ? undefined : agent.id
  const sessionId =
    agentId === undefined ? undefined : typeof agentId === 'string' ? agentId : String(agentId)
  if (sessionId === undefined || sessionId.length === 0) {
    return {
      ok: false,
      result: {
        status: 'rejected',
        code: TEAM_TOOL_CALLER_UNRESOLVED,
        message:
          'team-tools: the tool execution carries no calling agent session; a team caller cannot be resolved',
      },
    }
  }
  try {
    const caller = await options.resolveCaller(sessionId)
    return { ok: true, caller }
  } catch (error) {
    return {
      ok: false,
      result: {
        status: 'rejected',
        code: TEAM_TOOL_CALLER_UNRESOLVED,
        message: `team-tools: cannot resolve a team caller for session '${sessionId}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    }
  }
}

// --- execution core -----------------------------------------------------------------

/** One validated call in flight (common fields shared by every tool). */
interface ToolCallContext {
  readonly options: TeamToolsOptions
  readonly toolName: string
  readonly rootSessionId: string
  readonly requestToken: string
  readonly caller: ActionCaller
}

/**
 * Run one GUARDED work operation (SD-GUARD / SD-GUARD-NS):
 *
 * - a well-formed instance id ALWAYS consults the last-mile guard for the
 *   exact scope first; a blocked verdict returns the closed reason and the
 *   runtime/satellite is never called;
 * - a token outside the instance-identity namespace (a label, a template
 *   id, anything parseInstanceId rejects) cannot form a guard scope — the
 *   guard would throw CONTROL_GUARD_MALFORMED. It is routed straight to
 *   the delegate, whose instance-addressed resolution live-rejects it
 *   (ACTION_ADDRESSING_REJECTED); such a target can never execute.
 */
async function executeGuarded(
  ctx: ToolCallContext,
  targetInstanceId: string,
  actionName: string,
  execute: () => Promise<TeamToolsResult>,
): Promise<TeamToolsResult> {
  if (INSTANCE_ID_PATTERN.test(targetInstanceId)) {
    const decision = await consultGuard(ctx.options.controlService, {
      rootSessionId: ctx.rootSessionId,
      targetInstanceId,
      actionName,
      toolName: ctx.toolName,
      correlation: ctx.requestToken,
    })
    if (!decision.proceed) {
      return {
        status: 'blocked',
        toolName: ctx.toolName,
        correlation: ctx.requestToken,
        reason: decision.reason,
        ...(decision.requestId !== undefined ? { requestId: decision.requestId } : {}),
        ...(decision.decisionSequence !== undefined
          ? { decisionSequence: decision.decisionSequence }
          : {}),
      }
    }
  }
  return execute()
}

/** Project one facade outcome to the `executed` result (lossless). */
function toExecutedResult(outcome: TeamRuntimeActionOutcome): TeamToolsResult {
  return {
    status: 'executed',
    action: outcome.action,
    rootSessionId: outcome.rootSessionId,
    callerRole: outcome.callerRole,
    ...(outcome.targetInstanceId !== undefined
      ? { targetInstanceId: outcome.targetInstanceId }
      : {}),
    effect: outcome.effect,
    requestToken: outcome.requestToken,
  }
}

/** Project one messaging outcome to the `delivered` result (lossless). */
function toDeliveredResult(outcome: SendTeamMessageOutcome): TeamToolsResult {
  return {
    status: 'delivered',
    rootSessionId: outcome.rootSessionId,
    action: outcome.action,
    callerRole: outcome.callerRole,
    recipientInstanceId: outcome.recipientInstanceId,
    deliveryMode: outcome.deliveryMode,
    deliveredToInstanceId: outcome.deliveredToInstanceId,
    deliveredToSessionId: outcome.deliveredToSessionId,
    factSequence: outcome.factSequence,
    deliveredSequence: outcome.deliveredSequence,
    requestToken: outcome.requestToken,
  }
}

// --- the tool specs -----------------------------------------------------------------

interface ToolSpec {
  readonly name: string
  readonly description: string
  readonly properties: Record<string, unknown>
  readonly required: readonly string[]
  readonly run: (ctx: ToolCallContext, args: Record<string, unknown>) => Promise<TeamToolsResult>
}

/**
 * Wrap one spec in the registered definition: the common validation
 * (arguments object, rootSessionId, requestToken), the caller resolution,
 * and the typed-error mapping.
 */
function makeDefinition(
  options: TeamToolsOptions,
  spec: ToolSpec,
): TeamToolDefinition {
  return {
    name: spec.name,
    description: spec.description,
    parameters: {
      type: 'object',
      properties: spec.properties,
      required: [...spec.required],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render(_args, value) {
        return [{ type: 'text', text: JSON.stringify(value) }]
      },
    },
    async execute(args: unknown, exec: TeamToolExecContext): Promise<TeamToolsResult> {
      try {
        if (!isArgsRecord(args)) {
          throw new TeamToolArgsError('team-tools: the tool arguments must be a JSON object')
        }
        const rootSessionId = requireStringField(
          args,
          'rootSessionId',
          ROOT_SESSION_MAX_LENGTH,
        )
        const requestToken = validateRequestToken(args)
        const callerResolution = await resolveToolCaller(options, exec)
        if (!callerResolution.ok) return callerResolution.result
        const ctx: ToolCallContext = {
          options,
          toolName: spec.name,
          rootSessionId,
          requestToken,
          caller: callerResolution.caller,
        }
        return await spec.run(ctx, args)
      } catch (error) {
        const mapped = rejectFromError(error)
        if (mapped !== undefined) return mapped
        throw error
      }
    },
  }
}

// --- the ten closed tools -------------------------------------------------------------

function listMembersSpec(): ToolSpec {
  return {
    name: 'team_list_members',
    description:
      'List every member instance of the team with its template id, label, lifecycle state, and bound child session id.',
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
    },
    required: ['rootSessionId', 'requestToken'],
    async run(ctx) {
      const outcome = await ctx.options.teamRuntime.performAction({
        rootSessionId: ctx.rootSessionId,
        action: ACTION_NAMES.LIST_MEMBERS,
        caller: ctx.caller,
        requestToken: ctx.requestToken,
      })
      return toExecutedResult(outcome)
    },
  }
}

function listTemplatesSpec(): ToolSpec {
  return {
    name: 'team_list_templates',
    description:
      "List the member templates of the team's bound blueprint (template id, display name, context policy).",
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
    },
    required: ['rootSessionId', 'requestToken'],
    async run(ctx) {
      const outcome = await ctx.options.teamRuntime.performAction({
        rootSessionId: ctx.rootSessionId,
        action: ACTION_NAMES.LIST_TEMPLATES,
        caller: ctx.caller,
        requestToken: ctx.requestToken,
      })
      return toExecutedResult(outcome)
    },
  }
}

function inspectConfigSpec(): ToolSpec {
  return {
    name: 'team_inspect_config',
    description:
      'Inspect the effective policy configuration of ONE member instance (the per-capability effective values after overlay and external facts).',
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
      targetInstanceId: TARGET_INSTANCE_ARG,
    },
    required: ['rootSessionId', 'requestToken', 'targetInstanceId'],
    async run(ctx, args) {
      const targetInstanceId = requireStringField(args, 'targetInstanceId', INSTANCE_ID_MAX_LENGTH)
      const outcome = await ctx.options.teamRuntime.performAction({
        rootSessionId: ctx.rootSessionId,
        action: ACTION_NAMES.INSPECT_CONFIG,
        caller: ctx.caller,
        targetInstanceId,
        requestToken: ctx.requestToken,
      })
      return toExecutedResult(outcome)
    },
  }
}

function createMemberSpec(): ToolSpec {
  return {
    name: 'team_create_member',
    description:
      'Create a NEW member instance from a blueprint template (explicit creation; the activation authority enforces quota, envelope, and gates).',
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
      delegationTemplateId: {
        type: 'string',
        description: 'The blueprint template id the new member is created from.',
      },
      label: LABEL_ARG,
      groupId: { type: 'string', description: 'Optional group id for the new member.' },
      workspace: {
        type: 'string',
        description: 'Optional workspace path override for the new member.',
      },
    },
    required: ['rootSessionId', 'requestToken', 'delegationTemplateId', 'label'],
    async run(ctx, args) {
      const delegationTemplateId = requireStringField(args, 'delegationTemplateId', TEMPLATE_ID_MAX_LENGTH)
      const label = requireStringField(args, 'label', LABEL_MAX_LENGTH)
      const payload: Record<string, unknown> = { label }
      const groupId = optionalStringField(args, 'groupId', 256)
      if (groupId !== undefined) payload.groupId = groupId
      const workspace = optionalStringField(args, 'workspace', 512)
      if (workspace !== undefined) payload.workspace = workspace
      const request: TeamRuntimeActionRequest = {
        rootSessionId: ctx.rootSessionId,
        action: ACTION_NAMES.CREATE_MEMBER,
        caller: ctx.caller,
        delegationTemplateId,
        requestToken: ctx.requestToken,
        payload,
      }
      const outcome = await ctx.options.teamRuntime.performAction(request)
      return toExecutedResult(outcome)
    },
  }
}

function delegateSpec(): ToolSpec {
  return {
    name: 'team_delegate',
    description:
      'Delegate work: either create a NEW member from a template and admit the work on it, or admit new work on an EXISTING member instance. Provide exactly one of delegationTemplateId / delegationInstanceId.',
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
      delegationTemplateId: {
        type: 'string',
        description: 'Present: create a new member from this template and delegate to it.',
      },
      delegationInstanceId: {
        type: 'string',
        description: 'Present: delegate new work to this existing member instance (its persistent context is kept).',
      },
      label: LABEL_ARG,
      groupId: { type: 'string', description: 'Optional group id for a new member.' },
      workspace: {
        type: 'string',
        description: 'Optional workspace path override for a new member.',
      },
      taskSummary: {
        type: 'string',
        description: 'Optional short summary of the delegated work unit (audit context).',
      },
      prompt: {
        type: 'string',
        description:
          "REQUIRED: the exact work prompt delivered (model-visible) to the member's bound child session. No default inheritance from the caller or sibling transcripts.",
      },
      attachedContext: {
        type: 'string',
        description: 'Optional explicit context attached to the work unit and delivered with the prompt.',
      },
    },
    required: ['rootSessionId', 'requestToken', 'label', 'prompt'],
    async run(ctx, args) {
      const label = requireStringField(args, 'label', LABEL_MAX_LENGTH)
      const prompt = requireStringField(args, 'prompt', WORK_PROMPT_MAX_LENGTH)
      const templateId = optionalStringField(args, 'delegationTemplateId', TEMPLATE_ID_MAX_LENGTH)
      const instanceId = optionalStringField(args, 'delegationInstanceId', INSTANCE_ID_MAX_LENGTH)
      if (templateId === undefined && instanceId === undefined) {
        throw new TeamToolArgsError(
          "team-tools: delegate requires exactly one of delegationTemplateId / delegationInstanceId",
        )
      }
      if (templateId !== undefined && instanceId !== undefined) {
        throw new TeamToolArgsError(
          "team-tools: delegate accepts exactly one of delegationTemplateId / delegationInstanceId, not both",
        )
      }
      const payload: Record<string, unknown> = { label, prompt }
      const groupId = optionalStringField(args, 'groupId', 256)
      if (groupId !== undefined) payload.groupId = groupId
      const workspace = optionalStringField(args, 'workspace', 512)
      if (workspace !== undefined) payload.workspace = workspace
      const taskSummary = optionalStringField(args, 'taskSummary', TASK_SUMMARY_MAX_LENGTH)
      if (taskSummary !== undefined) payload.taskSummary = taskSummary
      const attachedContext = optionalStringField(
        args,
        'attachedContext',
        ATTACHED_CONTEXT_MAX_LENGTH,
      )
      if (attachedContext !== undefined) payload.attachedContext = attachedContext
      const request: TeamRuntimeActionRequest = {
        rootSessionId: ctx.rootSessionId,
        action: ACTION_NAMES.DELEGATE,
        caller: ctx.caller,
        requestToken: ctx.requestToken,
        payload,
        ...(templateId !== undefined ? { delegationTemplateId: templateId } : {}),
        ...(instanceId !== undefined ? { delegationInstanceId: instanceId } : {}),
      }
      const execute = async (): Promise<TeamToolsResult> =>
        toExecutedResult(await ctx.options.teamRuntime.performAction(request))
      // The continue form admits work on an EXISTING instance: it is guarded
      // on that target (SD-GUARD); the create form has no existing target
      // (SD-CREATE: the activation authority is the gate).
      if (instanceId !== undefined) {
        return executeGuarded(ctx, instanceId, ACTION_NAMES.DELEGATE, execute)
      }
      return execute()
    },
  }
}

function followUpSpec(): ToolSpec {
  return {
    name: 'team_follow_up',
    description:
      'Admit a follow-up work unit on an EXISTING member instance (persistent delegation: the same bound child session is kept).',
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
      targetInstanceId: TARGET_INSTANCE_ARG,
      taskSummary: {
        type: 'string',
        description: 'Optional short summary of the follow-up work unit (audit context).',
      },
      prompt: {
        type: 'string',
        description:
          "REQUIRED: the exact follow-up work prompt delivered (model-visible) to the member's bound child session. No default inheritance from the caller or sibling transcripts.",
      },
      attachedContext: {
        type: 'string',
        description: 'Optional explicit context attached to the work unit and delivered with the prompt.',
      },
    },
    required: ['rootSessionId', 'requestToken', 'targetInstanceId', 'prompt'],
    async run(ctx, args) {
      const targetInstanceId = requireStringField(args, 'targetInstanceId', INSTANCE_ID_MAX_LENGTH)
      const prompt = requireStringField(args, 'prompt', WORK_PROMPT_MAX_LENGTH)
      const payload: Record<string, unknown> = { prompt }
      const taskSummary = optionalStringField(args, 'taskSummary', TASK_SUMMARY_MAX_LENGTH)
      if (taskSummary !== undefined) payload.taskSummary = taskSummary
      const attachedContext = optionalStringField(
        args,
        'attachedContext',
        ATTACHED_CONTEXT_MAX_LENGTH,
      )
      if (attachedContext !== undefined) payload.attachedContext = attachedContext
      return executeGuarded(ctx, targetInstanceId, ACTION_NAMES.FOLLOW_UP, async () =>
        toExecutedResult(
          await ctx.options.teamRuntime.performAction({
            rootSessionId: ctx.rootSessionId,
            action: ACTION_NAMES.FOLLOW_UP,
            caller: ctx.caller,
            targetInstanceId,
            requestToken: ctx.requestToken,
            payload,
          }),
        ),
      )
    },
  }
}

function sendMessageSpec(): ToolSpec {
  return {
    name: 'team_send_message',
    description:
      'Send one message to a member instance (instance-addressed; the relay policy mediates through the leader where required). The recipient receives ordinary attributed input on its bound session.',
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
      recipientInstanceId: TARGET_INSTANCE_ARG,
      body: {
        type: 'string',
        description: 'The message body (non-empty, max 8192 chars; stored verbatim).',
      },
      subject: {
        type: 'string',
        description: 'Optional subject (non-empty, max 256 chars).',
      },
    },
    required: ['rootSessionId', 'requestToken', 'recipientInstanceId', 'body'],
    async run(ctx, args) {
      const recipientInstanceId = requireStringField(args, 'recipientInstanceId', INSTANCE_ID_MAX_LENGTH)
      const body = requireStringField(args, 'body', BODY_MAX_LENGTH)
      const subject = optionalStringField(args, 'subject', SUBJECT_MAX_LENGTH)
      return executeGuarded(ctx, recipientInstanceId, ACTION_NAMES.SEND_MESSAGE, async () =>
        toDeliveredResult(
          await ctx.options.messaging.sendTeamMessage({
            rootSessionId: ctx.rootSessionId,
            caller: ctx.caller,
            recipientInstanceId,
            body,
            ...(subject !== undefined ? { subject } : {}),
            requestToken: ctx.requestToken,
          }),
        ),
      )
    },
  }
}

function reportProgressSpec(): ToolSpec {
  return {
    name: 'team_report_progress',
    description:
      'Report progress on one work subject of a member instance (in-progress | completed | blocked; the per-subject sequence is derived from the durable ledger, with one bounded retry on a stale sequence).',
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
      instanceId: TARGET_INSTANCE_ARG,
      subject: {
        type: 'string',
        description: 'The telemetry subject (the work lane within the instance; max 256 chars).',
      },
      progress: {
        type: 'string',
        enum: [...PROGRESS_VALUES],
        description: 'The closed status: in-progress | completed | blocked.',
      },
      summary: {
        type: 'string',
        description: 'Optional progress summary (max 512 chars).',
      },
      lastAction: {
        type: 'string',
        description: 'Optional last-action label (max 256 chars).',
      },
      correlation: {
        type: 'string',
        description: 'Optional work-unit tag (max 128 chars).',
      },
    },
    required: ['rootSessionId', 'requestToken', 'instanceId', 'subject', 'progress'],
    async run(ctx, args) {
      const instanceId = requireStringField(args, 'instanceId', INSTANCE_ID_MAX_LENGTH)
      const subject = requireStringField(args, 'subject', SUBJECT_MAX_LENGTH)
      const progress = requireStringField(args, 'progress', 32)
      if (!isProgressValue(progress)) {
        throw new TeamToolArgsError(
          "team-tools: argument 'progress' must be one of in-progress | completed | blocked",
          { progress },
        )
      }
      const summary = optionalStringField(args, 'summary', SUMMARY_MAX_LENGTH)
      const lastAction = optionalStringField(args, 'lastAction', LAST_ACTION_MAX_LENGTH)
      const correlation = optionalStringField(args, 'correlation', CORRELATION_MAX_LENGTH)
      const ledger = ctx.options.activity
      const nextSequence = (): number =>
        ledger
          .listActivityFacts({
            rootSessionId: ctx.rootSessionId,
            instanceId,
            subject,
          })
          .reduce((max, row) => Math.max(max, row.sequence), 0) + 1
      const base = {
        rootSessionId: ctx.rootSessionId,
        caller: ctx.caller,
        instanceId,
        subject,
        progress,
        requestToken: ctx.requestToken,
        ...(summary !== undefined ? { summary } : {}),
        ...(lastAction !== undefined ? { lastAction } : {}),
        ...(correlation !== undefined ? { correlation } : {}),
      }
      const recorded = async (): Promise<TeamToolsResult> => {
        const row = await ledger.recordProgress({ ...base, sequence: nextSequence() })
        return {
          status: 'progress-recorded',
          rootSessionId: ctx.rootSessionId,
          instanceId,
          row,
        }
      }
      return executeGuarded(ctx, instanceId, ACTION_NAMES.REPORT_PROGRESS, async () => {
        try {
          return await recorded()
        } catch (error) {
          // One bounded retry on a stale per-subject sequence (another
          // reporter advanced the lane between read and write); a fresh
          // head read is the recovery. Anything else rethrows typed.
          if (
            isActivityError(error) &&
            error.code === ACTIVITY_ERROR_CODES.ACTIVITY_SEQUENCE_STALE
          ) {
            return recorded()
          }
          throw error
        }
      })
    },
  }
}

/** Type guard over the control request kind vocabulary. */
function isControlRequestKind(value: string): value is ControlRequestKind {
  return (CONTROL_REQUEST_KIND_VALUES as readonly string[]).includes(value)
}

/** Type guard over the progress value vocabulary. */
function isProgressValue(value: string): value is ProgressValue {
  return (PROGRESS_VALUES as readonly string[]).includes(value)
}

function requestControlSpec(): ToolSpec {
  return {
    name: 'team_request_control',
    description:
      'Request approval for one operation scope (kind: leader-approval | user-approval | envelope-mutation). The operation stays blocked until a resolver (leader/human per kind — never a member) records a decision. Idempotent over the scope identity: retrying with the same token returns the existing request.',
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
      kind: {
        type: 'string',
        enum: [...CONTROL_REQUEST_KIND_VALUES],
        description: 'The request kind: leader-approval | user-approval | envelope-mutation.',
      },
      targetInstanceId: TARGET_INSTANCE_ARG,
      actionName: {
        type: 'string',
        description: 'The logical operation name the approval gates (max 128 chars).',
      },
      toolName: {
        type: 'string',
        description: 'Optional: the tool name the operation runs through (max 128 chars).',
      },
      summary: {
        type: 'string',
        description: 'Optional one-line summary for the resolver (max 512 chars).',
      },
    },
    required: ['rootSessionId', 'requestToken', 'kind', 'targetInstanceId', 'actionName'],
    async run(ctx, args) {
      const kind = requireStringField(args, 'kind', 64)
      if (!isControlRequestKind(kind)) {
        throw new TeamToolArgsError(
          'team-tools: argument \'kind\' must be one of leader-approval | user-approval | envelope-mutation',
          { kind },
        )
      }
      const targetInstanceId = requireStringField(args, 'targetInstanceId', INSTANCE_ID_MAX_LENGTH)
      const actionName = requireStringField(args, 'actionName', ACTION_NAME_MAX_LENGTH)
      const toolName = optionalStringField(args, 'toolName', TOOL_NAME_MAX_LENGTH)
      const summary = optionalStringField(args, 'summary', SUMMARY_MAX_LENGTH)
      // The request token IS the correlation: it ties the request, the
      // decision, and the later guarded execution to ONE logical operation.
      const record = await ctx.options.controlService.requestControl({
        rootSessionId: ctx.rootSessionId,
        caller: ctx.caller,
        kind,
        targetInstanceId,
        actionName,
        ...(toolName !== undefined ? { toolName } : {}),
        correlation: ctx.requestToken,
        ...(summary !== undefined ? { summary } : {}),
      })
      return { status: 'control-requested', request: record }
    },
  }
}

function resolveControlSpec(): ToolSpec {
  return {
    name: 'team_resolve_control',
    description:
      "Record an allow/deny decision on a pending control request (resolver roles per kind: leader-approval -> leader|human, user-approval -> human only, envelope-mutation -> leader|human; a member is never a resolver). An allow authorizes the exact scope exactly once, consumed by the last-mile guard.",
    properties: {
      rootSessionId: ROOT_SESSION_ID_ARG,
      requestToken: REQUEST_TOKEN_ARG,
      requestId: {
        type: 'string',
        description: 'The durable control request id to decide (max 128 chars).',
      },
      decision: {
        type: 'string',
        enum: [CONTROL_DECISION_VALUES.ALLOW, CONTROL_DECISION_VALUES.DENY],
        description: 'The decision: allow | deny.',
      },
      note: {
        type: 'string',
        description: 'Optional decision note (max 256 chars).',
      },
    },
    required: ['rootSessionId', 'requestToken', 'requestId', 'decision'],
    async run(ctx, args) {
      const requestId = requireStringField(args, 'requestId', REQUEST_ID_MAX_LENGTH)
      const decision = requireStringField(args, 'decision', 16)
      if (
        decision !== CONTROL_DECISION_VALUES.ALLOW &&
        decision !== CONTROL_DECISION_VALUES.DENY
      ) {
        throw new TeamToolArgsError("team-tools: argument 'decision' must be allow | deny", {
          decision,
        })
      }
      const note = optionalStringField(args, 'note', NOTE_MAX_LENGTH)
      const record = await ctx.options.controlService.resolveControl({
        rootSessionId: ctx.rootSessionId,
        caller: ctx.caller,
        requestId,
        decision,
        ...(note !== undefined ? { note } : {}),
      })
      return { status: 'control-resolved', decision: record }
    },
  }
}

// --- the factory -----------------------------------------------------------------------

/** The registered team tool set. */
export interface TeamToolSet {
  /** The ten closed tool definitions (registration order). */
  readonly tools: readonly TeamToolDefinition[]
}

/**
 * Build the model-facing team tool set over one runtime satellite wiring.
 *
 * @param options - the sanctioned runtime ports (facade, control service,
 *   messaging coordinator, activity ledger, caller resolver — SD-DEPS).
 * @returns the ten tool definitions, ready for the host's public tool
 *   registration (each returns a disposer on register; the caller owns
 *   the effect lifetime).
 */
export function createTeamTools(options: TeamToolsOptions): TeamToolSet {
  const specs: readonly ToolSpec[] = [
    listMembersSpec(),
    listTemplatesSpec(),
    inspectConfigSpec(),
    createMemberSpec(),
    delegateSpec(),
    followUpSpec(),
    sendMessageSpec(),
    reportProgressSpec(),
    requestControlSpec(),
    resolveControlSpec(),
  ]
  return {
    tools: specs.map((spec) => makeDefinition(options, spec)),
  }
}
