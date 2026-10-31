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
  ControlEscalationOutcome,
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
      readonly status: 'permission-mutated'
      readonly rootSessionId: string
      readonly targetInstanceId: string
      /** Which governance verb ran (grant_instance / revoke_instance). */
      readonly verb: 'grant' | 'revoke'
      /** Durable effect (the governance lane's dedupe-aware answer). */
      readonly changed: boolean
      /** Governance lane code when the settled result carries one. */
      readonly code?: string
      readonly reason?: string
    }
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
  // A4-PR5 (rebase round, PR4 hand-off duty b): the reviewer ESCALATED the
  // leg. This arm is the closed-union admission PR4 named as its seam — the
  // durable escalation is a leg fact + terminal `deny(reason escalated)` +
  // the risen leg (A5-5/A1-12), which is NOT a `ControlDecisionRecord` and
  // must not be laundered into `control-resolved`.
  | {
      readonly status: 'control-escalated'
      readonly outcome: ControlEscalationOutcome
    }
  | {
      readonly status: 'pending-control-listed'
      readonly rootSessionId: string
      readonly pending: readonly ControlRequestRecord[]
      readonly count: number
      readonly truncated: boolean
    }
  | {
      /**
       * Alpha.6 PR4': the answer of `team_review_defer`, for all three of its verbs. `accepted` is the fact
       * the caller acts on; a refusal is a RESULT (the model sees why), not a thrown surprise, because a
       * refused quiet is an ordinary outcome of an ordinary call. `defers` is bounded: the store itself is
       * capped, and a tool that dumped unbounded state would spend the context it is meant to save.
       */
      readonly status: 'review-defer'
      readonly rootSessionId: string
      readonly verb: 'set' | 'lift' | 'list'
      readonly accepted: boolean
      readonly code?: string
      readonly reason?: string
      readonly defers: readonly TeamReviewDeferEntry[]
      readonly count: number
      readonly truncated: boolean
      readonly requestToken: string
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
 * P0 (caller-root binding): the resolved tool caller — the caller
 * identity AND the owning team root the calling session actually
 * belongs to. The owning root comes from the durable domain (the
 * session's team-root binding / membership row), NEVER from the tool
 * arguments and never inferred by a tool body. The tool layer enforces
 * `rootSessionId === the requested rootSessionId` at the common entry
 * (a cross-root caller is rejected with
 * `TEAM_TOOL_CALLER_ROOT_MISMATCH` before any downstream effect) —
 * otherwise every Team's leader shares `inst-leader` and a Leader of
 * Team A could address Team B's ledger as Team B's leader.
 */
export interface ResolvedTeamToolCaller {
  readonly caller: ActionCaller
  readonly rootSessionId: string
}

/**
 * The factory ports (SD-DEPS): the "TeamRuntime public surface" the tool
 * layer delegates to — the facade plus the sanctioned satellites. Every
 * durable write flows through them; the tool layer itself writes nothing.
 */
/**
 * The CLOSED structured exec intent (round 7, parent item 3): the ONLY
 * way an entry expresses exec (shell-class) scope. The server canonicalizes
 * it into the exact execution fingerprint via the SAME semantics the
 * execution plane uses at pre-execute (`canonicalizeShellOperation`:
 * tool + command hash + canonical workdir KEY + background flag + explicit
 * timeout + sandbox mode) — arbitrary client strings can never self-label
 * as canonical. Field names mirror the shell tool's OWN argument names so
 * the canonicalization is the identity mapping onto the real exec shape.
 */
export interface TeamPermissionExecIntent {
  /** The closed shell-class tool (the resource key IS the tool name). */
  readonly tool: 'bash' | 'pwsh'
  /** The exact command string the exec fingerprint hashes. */
  readonly command: string
  /** Workdir input (absent = the tool's own default '.'). */
  readonly workdir?: string
  readonly run_in_background?: boolean
  /** EXPLICIT timeout only — never a deployment default (plan §4.4). */
  readonly timeoutMs?: number
  /** Requested sandbox mode string only; legality is decided at exec. */
  readonly sandbox_permissions?: string
}

/**
 * Alpha.6 PR4' (Lane 2) — the review-wake defer port, as the tool layer sees it.
 *
 * Declared STRUCTURALLY here, with no import from `packages/runtime/review-defer`, for two reasons that are
 * both load-bearing. The dependency direction: the tool layer is given its authorities, it does not reach
 * into a runtime lane to make one. And the single-store law: the port is injected with the very store the wake
 * gate reads, so a tool that built its own state would be a switch connected to nothing — the worst kind of
 * model-facing surface, one whose success message is true about itself and false about the plane.
 *
 * `reasonCode` and `refusal` are widened to `string` here because the closed lists belong to the lane; the
 * schema narrows the input to the four codes the lane knows, and the lane refuses anything else, so the
 * widening is a typing convenience and not a policy relaxation.
 */
export interface TeamReviewDeferKey {
  readonly rootSessionId: string
  readonly approvalCaseId: string
  readonly legOrdinal: number
}

export interface TeamReviewDeferEntry {
  readonly key: TeamReviewDeferKey
  /** The instant until which Leader wakes for this leg are held. */
  readonly notBeforeIso: string
  readonly reasonCode: string
  /** The instant the quiet was filed at, recorded rather than read. */
  readonly setAtIso: string
}

export type TeamReviewDeferOutcome =
  | { readonly ok: true; readonly value: TeamReviewDeferEntry }
  | { readonly ok: false; readonly refusal: string; readonly detail: string }

export interface TeamReviewDeferPort {
  set(input: {
    readonly rootSessionId: string
    readonly approvalCaseId: string
    readonly legOrdinal: number
    readonly notBeforeIso: string
    readonly reasonCode: string
  }): TeamReviewDeferOutcome
  cancel(key: TeamReviewDeferKey): TeamReviewDeferOutcome
  list(): readonly TeamReviewDeferEntry[]
}

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
   * Resolves the calling authority + its OWNING team root from the
   * calling session id (SD-CALLER, injected mock-first). The tool layer
   * never trusts the session id alone: the runtime re-validates caller
   * identity and role from the durable domain on every call, and the
   * returned `rootSessionId` must be the session's real team ownership
   * (the gate against a cross-root addressing — a tool argument can
   * name any root, the caller can only own one).
   * @throws when the session cannot be resolved to a team caller.
   */
  readonly resolveCaller: (sessionId: string) => Promise<ResolvedTeamToolCaller>
  /**
   * pre-alpha3 PR4 ROUND 5 (FIX-2a) — the Leader's permission grant/revoke
   * entries over the ONE governance mutation authority (the SAME service the
   * human RPC lane reaches). ABSENT by default: the two permission tools
   * then reject typed (`TEAM_TOOL_PERMISSION_UNWIRED`, zero write).
   * SERVER-SIDE everything: the authority rides the caller identity the
   * host resolved (Leader-gated), and file-rule PATHS canonicalize through
   * `canonicalizeFile` at the TARGET member's durable effective workspace —
   * a client-supplied key is never authorization input.
   */
  readonly permission?: {
    /** Routes one closed permission mutation (grant_instance /
     *  revoke_permission) through the SHARED lifecycle mutation lane onto the
     *  governance service; typed refusals THROW errors carrying `code`
     *  (the tool forwards the code verbatim). */
    readonly mutatePermission: (
      mutationArgs: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>
    /** Canonicalizes one file-rule path at the ADDRESSED team's TARGET member
     *  effective workspace through the host's fs provider (throws on any
     *  fault — the tool maps it to a typed rejection, never a raw-path
     *  authority). ROUND 7 (parent BLOCK-2): the TEAM is the per-call
     *  addressed ctx.rootSessionId — never a boot-row capture. */
    readonly canonicalizeFile: (
      teamSessionId: string,
      targetInstanceId: string,
      path: string,
    ) => Promise<string>
    /** Canonicalizes one CLOSED structured exec intent (bash|pwsh + command +
     *  exec params) into the EXACT execution fingerprint the execution plane
     *  itself computes (server-side canonicalizeShellOperation semantics).
     *  ROUND 7 (parent item 3): a client-supplied fingerprint string is NEVER
     *  accepted — the only way to express exec scope through an entry is a
     *  structured intent this seam canonicalizes. Throws on any fault. */
    readonly canonicalizeExecIntent: (
      teamSessionId: string,
      targetInstanceId: string,
      intent: TeamPermissionExecIntent,
    ) => Promise<string>
  }
  /**
   * Alpha.6 PR4' (Lane 2): the Leader's review-wake quiet, for one leg of one approval case.
   *
   * ABSENT by default, and its absence is the whole dormancy story: `team_review_defer` is not registered at
   * all when this port is missing, so a Team that has not switched the plane on has fifteen tools and no new
   * code path. The port is present exactly when the SAME plane flag also wrapped the Leader notification port
   * with the defer gate — one read of one config key decides both, which is what keeps "the switch is on"
   * and "the switch is connected" from ever being different answers.
   */
  readonly reviewDefer?: TeamReviewDeferPort | undefined
}
