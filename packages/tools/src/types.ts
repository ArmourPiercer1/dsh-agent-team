/**
 * P6-T6 — @dsh-agent-team/tools types: the model-facing team tool surface.
 *
 * The closed vocabulary of the package:
 * - the structural tool definition (a mirror of the DSH host's public tool
 *   definition shape — this package deliberately imports NO upstream types,
 *   only its own sibling packages);
 * - the lossless-JSON result union every tool settles to;
 * - the factory options (the sanctioned runtime satellite set — the tool
 *   layer holds no team state of its own and performs no durable write).
 *
 * This module contains types only (no runtime code).
 *
 * @module @dsh-agent-team/tools/types
 */

import type {
  ActionCaller,
  RuntimeActionEffect,
  TeamRuntime,
} from '../../runtime/admission/index.js'
import type {
  ControlDecisionRecord,
  ControlGuardBlockReason,
  ControlRequestRecord,
  ControlService,
} from '../../runtime/control/index.js'
import type { MessagingCoordinator } from '../../runtime/messaging/index.js'
import type { ActivityFactRow, ActivityLedger } from '../../runtime/activity/index.js'

/**
 * The JSON-schema object the DSH tool registry accepts for tool parameters
 * (the public parameter shape: an object with named properties).
 */
export interface TeamToolParameterSchema {
  readonly type: 'object'
  readonly properties: Record<string, unknown>
  readonly required: readonly string[]
  readonly additionalProperties: boolean
}

/**
 * The execution context the host pipeline passes to a registered tool's
 * body (structural subset: only what the team tools read — the calling
 * agent's session id and the call identity).
 */
export interface TeamToolExecContext {
  readonly callId?: unknown
  readonly name?: string
  readonly arguments?: unknown
  /** The agent on whose behalf the call runs (its id is the session id). */
  readonly agent?: { readonly id?: unknown }
  readonly signal?: unknown
}

/**
 * One registered team tool definition (structural mirror of the host's
 * public tool definition: name, description, parameter schema, the
 * mandatory canonical output declaration, and the execution body).
 *
 * The body returns ONLY its canonical lossless-JSON value (a
 * {@link TeamToolsResult}); the host pipeline validates it against the
 * permissive output schema and renders it to model content.
 */
export interface TeamToolDefinition {
  readonly name: string
  readonly description: string
  readonly parameters: TeamToolParameterSchema
  readonly output: {
    /** Permissive by design: the result union varies per outcome. */
    readonly schema: Record<string, unknown>
    /** Pure projection from the validated value to model content. */
    render(
      args: unknown,
      value: unknown,
    ): readonly { readonly type: 'text'; readonly text: string }[]
  }
  execute(
    args: unknown,
    exec: TeamToolExecContext,
  ): Promise<TeamToolsResult>
}

/**
 * The closed lossless-JSON result union of every team tool:
 *
 * - `executed`            — one facade action ran (list/inspect/
 *                           follow-up/delegate/create-member); the durable
 *                           effect travels verbatim;
 * - `delivered`           — one team message was admitted AND delivered
 *                           (the messaging coordinator outcome);
 * - `progress-recorded`   — one activity progress row was durably
 *                           recorded (the ledger row travels verbatim);
 * - `control-requested`   — one durable control request row was recorded
 *                           (idempotent over the scope identity);
 * - `control-resolved`    — one durable control decision row was recorded;
 * - `blocked`             — the last-mile guard refused the guarded
 *                           operation (closed guard block reason; zero
 *                           side effects);
 * - `rejected`            — a typed business rejection (closed runtime /
 *                           control / messaging / activity / tool-layer
 *                           error code) or the caller could not be
 *                           resolved.
 *
 * Typed outcomes settle as RESULTS (the model sees them as normal control
 * flow); only unexpected errors throw (the host marks them tool errors).
 */
export type TeamToolsResult =
  | {
      readonly status: 'executed'
      readonly action: string
      readonly rootSessionId: string
      readonly callerRole: string
      readonly targetInstanceId?: string
      readonly effect: RuntimeActionEffect
      readonly requestToken: string
    }
  | {
      readonly status: 'delivered'
      readonly rootSessionId: string
      readonly action: 'send-message'
      readonly callerRole: string
      readonly recipientInstanceId: string
      readonly deliveryMode: string
      readonly deliveredToInstanceId: string
      readonly deliveredToSessionId: string
      readonly factSequence: number
      readonly deliveredSequence: number
      readonly requestToken: string
    }
  | {
      readonly status: 'progress-recorded'
      readonly rootSessionId: string
      readonly instanceId: string
      readonly row: ActivityFactRow
    }
  | {
      readonly status: 'control-requested'
      readonly request: ControlRequestRecord
    }
  | {
      readonly status: 'control-resolved'
      readonly decision: ControlDecisionRecord
    }
  | {
      readonly status: 'blocked'
      readonly toolName: string
      readonly correlation: string
      readonly reason: ControlGuardBlockReason
      readonly requestId?: string
      readonly decisionSequence?: number
    }
  | {
      readonly status: 'rejected'
      readonly code: string
      readonly message: string
      readonly details?: Record<string, unknown>
    }

/**
 * The factory ports (SD-DEPS): the "TeamRuntime public surface" the tool
 * layer delegates to — the facade plus the sanctioned satellites. Every
 * durable write flows through them; the tool layer itself writes nothing.
 */
export interface TeamToolsOptions {
  /** The unified runtime/control action facade (all facade actions). */
  readonly teamRuntime: TeamRuntime
  /** The durable control plane (request/resolve + the last-mile guard). */
  readonly controlService: ControlService
  /** The messaging coordinator (facade admission + delivery + confirmation). */
  readonly messaging: MessagingCoordinator
  /** The activity ledger (guarded progress writes + durable reads). */
  readonly activity: ActivityLedger
  /**
   * Resolves the calling authority from the calling session id (SD-CALLER,
   * injected mock-first). The tool layer never trusts the session id alone:
   * the runtime re-validates caller identity and role from the durable
   * domain on every call.
   * @throws when the session cannot be resolved to a team caller.
   */
  readonly resolveCaller: (sessionId: string) => Promise<ActionCaller>
}
