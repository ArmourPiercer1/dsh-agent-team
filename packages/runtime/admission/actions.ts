/**
 * P6-T2 — the closed TeamRuntime action vocabulary.
 *
 * The registry maps every runtime/control action to (a) its category, (b)
 * the mutation operation(s) of the caller's mutation envelope it requires
 * (reads carry no op — they are not mutations and are open to every LIVE
 * caller; documented ruling), and (c) its durable effect.
 *
 * Action vocabulary basis: Development Plan §19.6 first-round tool contract
 * ("authority must go through the Runtime uniformly"): list_team_members /
 * list_team_templates, create/delegate instance, follow_up_instance,
 * send_team_message, report_progress, request_control, resolve_control,
 * archive/restore/dispose where authorized, inspect effective config.
 *
 * The MUTATION OPERATION vocabulary (the envelope op names) is closed for
 * P6-T2: `assign-task`, `create-member`, `send-message`, `report-progress`,
 * `request-control`, `resolve-control`, `archive-member`, `restore-member`,
 * `dispose-member`. Blueprint envelopes allow/deny EXACTLY these op names.
 *
 * Addressing: instance-first everywhere (invariant 18/19). The two
 * delegation fields of the request are the ActivationProvider's own
 * addressing protocol (DevPlan §24.1 M1-M5) for the creation actions —
 * not a second action-addressing vocabulary.
 *
 * Durable fact families (kebab-case, no slashes — p4t6 scanner safe):
 * - `team-work-admitted`        (follow-up / delegate-continue)
 * - `member-lifecycle-changed`  (archive / restore / dispose)
 * - `team-coordination-recorded`(send-message / report-progress /
 *                               request-control / resolve-control)
 * Provider-routed creations carry their OWN provider ledger facts.
 */

import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from './errors.js'
import { CALLER_ROLES } from './types.js'
import type { CallerRole, TeamRuntimeActionRequest } from './types.js'

/** The closed action names. */
export const ACTION_NAMES = {
  /** List the team's member instances (read, team-scoped). */
  LIST_MEMBERS: 'list-members',
  /** List the bound blueprint's member templates (read, team-scoped). */
  LIST_TEMPLATES: 'list-templates',
  /** Inspect one instance's effective capability policy (read). */
  INSPECT_CONFIG: 'inspect-config',
  /** Admit NEW WORK on an existing instance; the SAME child session is
   *  kept (invariant 24); CREATED/SETTLED targets transition to RUNNING
   *  (invariant 55). */
  FOLLOW_UP: 'follow-up',
  /** Delegate work (leader only): the provider resolves M1-M5 — continue
   *  an active instance (fresh_per_delegation templates and no-active
   *  instances create a NEW one, invariant 25) or create through the
   *  ActivationProvider (invariant 26). Requires BOTH `assign-task` and
   *  `create-member` envelope ops (a delegation MAY create — fail closed). */
  DELEGATE: 'delegate',
  /** Explicit member creation (leader `leader-explicit` or human
   *  `human-ui` source; template-level delegation naming REQUIRED). */
  CREATE_MEMBER: 'create-member',
  /** Send a team message to a member instance (coordination fact). */
  SEND_MESSAGE: 'send-message',
  /** Report progress on the target instance (coordination fact). */
  REPORT_PROGRESS: 'report-progress',
  /** Request a control decision on the target instance (coordination fact). */
  REQUEST_CONTROL: 'request-control',
  /** Resolve a control request on the target instance (coordination fact). */
  RESOLVE_CONTROL: 'resolve-control',
  /** Archive the target member (lifecycle ARCHIVED; closes admission and
   *  quiesces, invariant 52). */
  ARCHIVE_MEMBER: 'archive-member',
  /** Restore the target member ARCHIVED -> SETTLED (invariant 53; no Agent
   *  resume). */
  RESTORE_MEMBER: 'restore-member',
  /** Dispose the target member (lifecycle DISPOSED; terminal). */
  DISPOSE_MEMBER: 'dispose-member',
} as const

/** One of the closed action names. */
export type ActionName = (typeof ACTION_NAMES)[keyof typeof ACTION_NAMES]

/** Every action name value, for membership checks. */
export const ACTION_NAME_VALUES: readonly string[] = Object.values(ACTION_NAMES)

/** The closed action categories. */
export const ACTION_CATEGORIES = {
  /** No mutation: open to every live caller (no envelope op). */
  READ: 'read',
  /** New work on an existing instance (the compatibility gate applies). */
  WORK: 'work',
  /** New instance creation (routed through the ActivationProvider). */
  CREATION: 'creation',
  /** Team coordination (message / control / progress facts). */
  COORDINATION: 'coordination',
  /** Member lifecycle operations. */
  LIFECYCLE: 'lifecycle',
} as const

/** One of the closed action categories. */
export type ActionCategory = (typeof ACTION_CATEGORIES)[keyof typeof ACTION_CATEGORIES]

/** The closed mutation-operation vocabulary (envelope op names). */
export const RUNTIME_OPS = {
  ASSIGN_TASK: 'assign-task',
  CREATE_MEMBER: 'create-member',
  SEND_MESSAGE: 'send-message',
  REPORT_PROGRESS: 'report-progress',
  REQUEST_CONTROL: 'request-control',
  RESOLVE_CONTROL: 'resolve-control',
  ARCHIVE_MEMBER: 'archive-member',
  RESTORE_MEMBER: 'restore-member',
  DISPOSE_MEMBER: 'dispose-member',
} as const

/** One of the closed runtime mutation operations. */
export type RuntimeOp = (typeof RUNTIME_OPS)[keyof typeof RUNTIME_OPS]

/** The closed coordination payload discriminators. */
export const PROGRESS_VALUES = ['in-progress', 'completed', 'blocked'] as const
export type ProgressValue = (typeof PROGRESS_VALUES)[number]
export const CONTROL_DECISION_VALUES = ['approved', 'denied'] as const
export type ControlDecision = (typeof CONTROL_DECISION_VALUES)[number]

/** One action's admission contract (the closed registry entry). */
export interface ActionSpec {
  /** The action name. */
  readonly name: ActionName
  /** The action category (gates the compatibility/work state checks). */
  readonly category: ActionCategory
  /**
   * The mutation operations the caller's envelope must ALL allow
   * (fail closed). ABSENT for reads (open to every live caller).
   */
  readonly ops?: readonly RuntimeOp[]
  /** Instance-targeted: `targetInstanceId` is REQUIRED and must resolve to
   *  an existing member record. */
  readonly instanceTargeted: boolean
  /**
   * The closed caller roles allowed to act (ABSENT = every live caller role
   * may act, subject to the envelope). A MEMBER caller is never in a
   * creation/delegation role set (invariant 37: no self-escalation).
   */
  readonly roles?: readonly CallerRole[]
  /** Routed through the ActivationProvider (the sole creation path). */
  readonly creates?: boolean
  /** The durable fact family of the effect (absent for reads and for the
   *  provider-routed creation results — the provider owns those facts). */
  readonly factType?: string
}

/** The closed action registry (deterministic iteration order). */
export const ACTION_SPECS: readonly ActionSpec[] = [
  { name: ACTION_NAMES.LIST_MEMBERS, category: ACTION_CATEGORIES.READ, instanceTargeted: false },
  { name: ACTION_NAMES.LIST_TEMPLATES, category: ACTION_CATEGORIES.READ, instanceTargeted: false },
  { name: ACTION_NAMES.INSPECT_CONFIG, category: ACTION_CATEGORIES.READ, instanceTargeted: true },
  {
    name: ACTION_NAMES.FOLLOW_UP,
    category: ACTION_CATEGORIES.WORK,
    ops: [RUNTIME_OPS.ASSIGN_TASK],
    instanceTargeted: true,
    factType: 'team-work-admitted',
  },
  {
    name: ACTION_NAMES.DELEGATE,
    category: ACTION_CATEGORIES.WORK,
    ops: [RUNTIME_OPS.ASSIGN_TASK, RUNTIME_OPS.CREATE_MEMBER],
    instanceTargeted: false,
    roles: [CALLER_ROLES.LEADER],
    creates: true,
  },
  {
    name: ACTION_NAMES.CREATE_MEMBER,
    category: ACTION_CATEGORIES.CREATION,
    ops: [RUNTIME_OPS.CREATE_MEMBER],
    instanceTargeted: false,
    roles: [CALLER_ROLES.HUMAN, CALLER_ROLES.LEADER],
    creates: true,
  },
  {
    name: ACTION_NAMES.SEND_MESSAGE,
    category: ACTION_CATEGORIES.COORDINATION,
    ops: [RUNTIME_OPS.SEND_MESSAGE],
    instanceTargeted: true,
    factType: 'team-coordination-recorded',
  },
  {
    name: ACTION_NAMES.REPORT_PROGRESS,
    category: ACTION_CATEGORIES.COORDINATION,
    ops: [RUNTIME_OPS.REPORT_PROGRESS],
    instanceTargeted: true,
    factType: 'team-coordination-recorded',
  },
  {
    name: ACTION_NAMES.REQUEST_CONTROL,
    category: ACTION_CATEGORIES.COORDINATION,
    ops: [RUNTIME_OPS.REQUEST_CONTROL],
    instanceTargeted: true,
    factType: 'team-coordination-recorded',
  },
  {
    name: ACTION_NAMES.RESOLVE_CONTROL,
    category: ACTION_CATEGORIES.COORDINATION,
    ops: [RUNTIME_OPS.RESOLVE_CONTROL],
    instanceTargeted: true,
    factType: 'team-coordination-recorded',
  },
  {
    name: ACTION_NAMES.ARCHIVE_MEMBER,
    category: ACTION_CATEGORIES.LIFECYCLE,
    ops: [RUNTIME_OPS.ARCHIVE_MEMBER],
    instanceTargeted: true,
    factType: 'member-lifecycle-changed',
  },
  {
    name: ACTION_NAMES.RESTORE_MEMBER,
    category: ACTION_CATEGORIES.LIFECYCLE,
    ops: [RUNTIME_OPS.RESTORE_MEMBER],
    instanceTargeted: true,
    factType: 'member-lifecycle-changed',
  },
  {
    name: ACTION_NAMES.DISPOSE_MEMBER,
    category: ACTION_CATEGORIES.LIFECYCLE,
    ops: [RUNTIME_OPS.DISPOSE_MEMBER],
    instanceTargeted: true,
    factType: 'member-lifecycle-changed',
  },
] as const

/** The action spec by name (undefined for names outside the closed set). */
export function actionSpecOf(name: string): ActionSpec | undefined {
  for (const spec of ACTION_SPECS) {
    if (spec.name === name) return spec
  }
  return undefined
}

/**
 * Step 0 — request validation (closed vocabulary + per-action shape).
 *
 * Pure: no repository access. Throws {@link TeamRuntimeError} with
 * REQUEST_MALFORMED or ACTION_UNKNOWN. Zero durable side effects by
 * construction.
 *
 * @param request - the raw action request.
 * @returns the resolved action spec (name guaranteed closed).
 */
export function validateActionRequest(request: TeamRuntimeActionRequest): ActionSpec {
  const fail = (message: string, details?: Record<string, unknown>): never => {
    throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED, message, details)
  }
  if (request === null || typeof request !== 'object') {
    fail('action request must be an object')
  }
  if (typeof request.action !== 'string' || request.action.length === 0) {
    fail('action: a non-empty action name is required')
  }
  const spec = actionSpecOf(request.action)
  if (spec === undefined) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.ACTION_UNKNOWN,
      `action '${request.action}' is outside the closed TeamRuntime action vocabulary`,
      { action: request.action, allowed: ACTION_NAME_VALUES },
    )
  }
  if (typeof request.rootSessionId !== 'string' || request.rootSessionId.length === 0) {
    fail('action: a non-empty rootSessionId is required', { action: spec.name })
  }
  if (typeof request.requestToken !== 'string' || request.requestToken.length === 0) {
    fail('action: a non-empty requestToken is required', { action: spec.name })
  }
  const caller = request.caller
  if (caller === null || typeof caller !== 'object') {
    fail('action: a caller is required', { action: spec.name })
  }
  if (caller.kind === 'human') {
    if (typeof caller.humanId !== 'string' || caller.humanId.length === 0) {
      fail('action: the human caller requires a non-empty humanId', { action: spec.name })
    }
  } else if (caller.kind === 'instance') {
    if (typeof caller.instanceId !== 'string' || caller.instanceId.length === 0) {
      fail('action: the instance caller requires a non-empty instanceId', { action: spec.name })
    }
  } else {
    fail('action: the caller kind must be "human" or "instance"', { action: spec.name })
  }
  if (spec.instanceTargeted) {
    if (typeof request.targetInstanceId !== 'string' || request.targetInstanceId.length === 0) {
      fail('action: an instance-targeted action requires targetInstanceId', { action: spec.name })
    }
  } else if (request.targetInstanceId !== undefined) {
    fail('action: a team-scoped action does not accept a targetInstanceId', { action: spec.name })
  }
  const hasTemplate = request.delegationTemplateId !== undefined
  const hasInstance = request.delegationInstanceId !== undefined
  if (spec.name === ACTION_NAMES.CREATE_MEMBER) {
    if (!hasTemplate || hasInstance) {
      fail('create-member: delegationTemplateId is required (exactly one delegation field)', {
        action: spec.name,
      })
    }
    const label = request.payload?.['label']
    if (typeof label !== 'string' || label.length === 0) {
      fail('create-member: payload.label (a non-empty string) is required', { action: spec.name })
    }
  } else if (spec.name === ACTION_NAMES.DELEGATE) {
    if (!hasTemplate && !hasInstance) {
      fail('delegate: exactly one of delegationTemplateId / delegationInstanceId is required', {
        action: spec.name,
      })
    }
    if (hasTemplate && hasInstance) {
      fail('delegate: exactly one of delegationTemplateId / delegationInstanceId is required', {
        action: spec.name,
      })
    }
    if (hasTemplate && typeof request.delegationTemplateId !== 'string') {
      fail('delegate: delegationTemplateId must be a string', { action: spec.name })
    }
    if (hasInstance && typeof request.delegationInstanceId !== 'string') {
      fail('delegate: delegationInstanceId must be a string', { action: spec.name })
    }
    // A delegation that CREATES needs a label for the new instance (the
    // provider protocol requires one); a delegation that CONTINUES carries
    // the label through harmlessly.
    const label = request.payload?.['label']
    if (typeof label !== 'string' || label.length === 0) {
      fail('delegate: payload.label (a non-empty string) is required', { action: spec.name })
    }
  } else if (hasTemplate || hasInstance) {
    fail('action: delegation fields are only accepted by delegate / create-member', {
      action: spec.name,
    })
  }
  // Per-action payload contracts (closed, minimal; the payload is stored
  // verbatim in the durable fact — downstream P6-T3/T4/T5 may extend their
  // own payload fields within these same closed actions).
  if (spec.name === ACTION_NAMES.FOLLOW_UP || spec.name === ACTION_NAMES.DELEGATE) {
    // P8-S3 R2: a work request MUST explicitly carry the model-visible
    // prompt; work requests have NO default transcript context (no
    // Leader/sibling/group transcript inheritance — the closure plan
    // §16.3 minimum semantics). `attachedContext`, when present, is the
    // one explicit context channel and must be a non-empty string.
    const prompt = request.payload?.['prompt']
    if (typeof prompt !== 'string' || prompt.length === 0) {
      fail(`${spec.name}: payload.prompt (a non-empty string) is required`, { action: spec.name })
    }
    const attachedContext = request.payload?.['attachedContext']
    if (attachedContext !== undefined && (typeof attachedContext !== 'string' || attachedContext.length === 0)) {
      fail(`${spec.name}: payload.attachedContext, when present, must be a non-empty string`, { action: spec.name })
    }
  } else if (spec.name === ACTION_NAMES.SEND_MESSAGE) {
    const recipient = request.payload?.['recipientInstanceId']
    if (typeof recipient !== 'string' || recipient.length === 0) {
      fail('send-message: payload.recipientInstanceId is required', { action: spec.name })
    }
  } else if (spec.name === ACTION_NAMES.REPORT_PROGRESS) {
    const progress = request.payload?.['progress']
    if (typeof progress !== 'string' || !(PROGRESS_VALUES as readonly string[]).includes(progress)) {
      fail('report-progress: payload.progress must be one of in-progress | completed | blocked', {
        action: spec.name,
      })
    }
  } else if (spec.name === ACTION_NAMES.RESOLVE_CONTROL) {
    const decision = request.payload?.['decision']
    if (typeof decision !== 'string' || !(CONTROL_DECISION_VALUES as readonly string[]).includes(decision)) {
      fail('resolve-control: payload.decision must be one of approved | denied', { action: spec.name })
    }
  }
  return spec
}
