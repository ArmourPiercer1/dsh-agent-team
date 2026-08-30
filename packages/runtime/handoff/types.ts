/**
 * Start Team from Here — the handoff contract (TaskDoc §11.8 P7-T5;
 * DevPlan §20.5; Architecture §34).
 *
 * Frozen spec, verbatim (the authority for every semantic below):
 *
 * DevPlan §20.5:
 *
 * ```text
 * ordinary Session A
 * → freeze canonical surface
 * → one-shot summary
 * → new TeamIntent
 * → new Root B
 * ```
 *
 * "B 不获得 A live history/search." (B gains no live history/search on A.)
 *
 * Architecture §34.2 (one-shot handoff):
 *
 * ```text
 * Source Session A
 * ↓
 * read frozen current canonical surface
 * ↓
 * one-shot summarize/compress
 * ↓
 * frozen sourced handoff context
 * ↓
 * TeamIntent / new TeamSession B
 * ```
 *
 * Architecture §34.3 (live link explicitly forbidden), after creation:
 *
 * ```text
 * B cannot history_read(A)
 * B cannot search A
 * B does not share A live memory
 * B does not reread A later
 * changes in A do not mutate B handoff
 * ```
 *
 * "`sourceSessionId` 可以作为 provenance/navigation metadata，但不是读取
 * 授权。" (sourceSessionId may serve as provenance/navigation metadata,
 * but it is NOT a read grant.)
 *
 * Architecture §34.4 (handoff summarizer): the summarization route must
 * not depend on the Blueprint Leader model or any Member model — it is a
 * Host/Team creation auxiliary capability. A failure must be surfaced
 * explicitly (Retry / Continue without handoff / Cancel); it must never
 * be silently pretended as a successful handoff.
 *
 * Module rules this file encodes:
 *
 * - the handoff module owns NO MemberInstance/TeamSession creation path
 *   of its own: team creation is delegated to the injected
 *   {@link HandoffTeamCreationPort} (the public Team creation entry; in
 *   production the P6-T1 ActivationProvider public entry — the committed
 *   static scan `packages/runtime/test/p7t5-no-creation-scan.mjs` proves
 *   the module source never imports a creation path);
 * - the source is read through the injected {@link HandoffSourceSurfacePort}
 *   (the public session query/read surface) EXACTLY ONCE per operation
 *   (snapshot once); nothing in the module re-reads the source later
 *   (B does not reread A later);
 * - the frozen handoff context is DETACHED (a deep lossless-JSON copy)
 *   and deep-frozen: later changes in the source do not mutate the
 *   handoff (§34.3);
 * - the handoff context is PURE DATA (lossless JSON, no functions, no
 *   live handles): the target receives NO read grant on the source —
 *   `sourceSessionId` is provenance/navigation metadata only (§34.3);
 * - the one-shot summarization route is an injected
 *   {@link HandoffSummarizerPort} (never the Leader/Member model —
 *   §34.4), and its failure is surfaced with the explicit triad
 *   Retry / Continue without handoff / Cancel (§34.4).
 *
 * Pure contracts module: no I/O, no `node:` builtins, no live Agent,
 * no host environment assumptions.
 * @module @dsh-agent-team/runtime/handoff/types
 */

import type { RemoteSafeRecord } from '../../contracts/src/index.js'

/**
 * One message of the source session's canonical surface (the
 * lossless-JSON wire shape delivered by the public session
 * query/read surface).
 */
export interface SourceCanonicalMessage {
  /** The authoring role of the message (e.g. `user` / `assistant`). */
  readonly role: string
  /** The message text. */
  readonly text: string
}

/**
 * The frozen current canonical surface of one ordinary (non-team) DSH
 * session — the single value read exactly once per handoff operation
 * (Architecture §34.2, first stage).
 *
 * It must be a lossless-JSON (remote-safe) value: it crosses into the
 * frozen handoff context as pure data, never as a live handle.
 */
export interface SourceCanonicalSurface {
  /** The source session id (the canonical surface is self-describing). */
  readonly sessionId: string
  /** The session title, or `null` when the source carries none. */
  readonly title: string | null
  /** The session creation timestamp (ISO-8601 string). */
  readonly createdAt: string
  /** The canonical message list of the source at capture time. */
  readonly messages: readonly SourceCanonicalMessage[]
  /** Any additional canonical-surface metadata (opaque passthrough). */
  readonly metadata: RemoteSafeRecord
}

/**
 * The one-shot summary of a frozen source surface (Architecture §34.2
 * stage 2, §34.4). Produced by the Host/Team creation auxiliary
 * capability — NOT the Blueprint Leader model and NOT any Member model.
 */
export interface HandoffSummary {
  /** The one-line handoff title. */
  readonly title: string
  /** The compressed context bullets. */
  readonly bullets: readonly string[]
}

/**
 * The public session query/read surface for the source (ordinary,
 * non-team) DSH session — the handoff module's ONLY source-side port.
 *
 * Called EXACTLY ONCE per operation (snapshot once); the module never
 * reads the source again after the snapshot is frozen (B does not
 * reread A later, §34.3).
 */
export interface HandoffSourceSurfacePort {
  /**
   * Read the frozen current canonical surface of the source session.
   * @param sourceSessionId - the ordinary source DSH session id.
   * @returns the canonical surface (lossless JSON).
   */
  readCanonicalSurface(sourceSessionId: string): Promise<SourceCanonicalSurface>
}

/**
 * The one-shot summarize/compress capability (Architecture §34.4).
 *
 * The implementation is a Host/Team creation auxiliary capability and
 * must NOT be the Blueprint Leader model or any Member model — the port
 * injection is the enforceable boundary for that rule.
 */
export interface HandoffSummarizerPort {
  /**
   * Summarize/compress one frozen source surface.
   * @param surface - the detached, already-frozen source surface.
   * @returns the one-shot summary (lossless JSON).
   * @throws any error: the service surfaces it with the explicit
   *   Retry / Continue without handoff / Cancel triad (§34.4) — never
   *   silently.
   */
  summarize(surface: SourceCanonicalSurface): Promise<HandoffSummary>
}

/**
 * The public Team creation entry (DevPlan §20.5 final stage: the new
 * TeamIntent → new TeamSession B / new Root B).
 *
 * The handoff module delegates team creation HERE. It owns no
 * MemberInstance/TeamSession creation path of its own: the module
 * source imports no storage repository, no provisioning coordinator,
 * no root-binding, and no ActivationProvider (the committed static
 * scan `p7t5-no-creation-scan.mjs` proves this on every run).
 *
 * Idempotency contract: a call with a repeated `intentToken` must be
 * idempotent (the stable operation identity of Architecture §18.2).
 */
export interface HandoffTeamCreationPort {
  /**
   * Create the new team from one staged TeamIntent.
   * @param intent - the staged TeamIntent (opaque staged fields plus the
   *   optional handoff provenance).
   * @returns the committed identity of the new team.
   */
  createTeam(intent: HandoffTeamIntent): Promise<TeamCreationOutcome>
}

/**
 * The committed identity of the new team. Invariant 9 (Architecture):
 * TeamSessionId = RootSessionId — the two fields carry the same value.
 */
export interface TeamCreationOutcome {
  /** The new TeamSession id (= the new Root session id, invariant 9). */
  readonly teamSessionId: string
  /** The new Root session id. */
  readonly rootSessionId: string
}

/**
 * The one-shot handoff provenance (Architecture §7.2: a TeamIntent may
 * carry "optional Start-Team-from-Here handoff provenance"; §34.3:
 * `sourceSessionId` is provenance/navigation metadata — NOT a read
 * grant).
 */
export interface HandoffProvenance {
  /** The source session id — provenance/navigation metadata ONLY. */
  readonly sourceSessionId: string
  /** The token of the frozen one-shot handoff context it describes. */
  readonly contextToken: string
  /** When the source canonical surface was captured (ISO-8601). */
  readonly capturedAt: string
}

/**
 * The pre-creation TeamIntent staging object the handoff hands to the
 * public Team creation entry (Architecture §7: the Team plugin's own
 * pre-creation staging object — never the TeamSession/Root identity
 * itself, never a durable authority).
 */
export interface HandoffTeamIntent {
  /** The stable operation identity of the creation (the creation
   *  entry's idempotency contract). */
  readonly intentToken: string
  /** The caller's staged TeamIntent fields (selected Blueprint
   *  revision, selected AgentPreset, default workspace, staged
   *  runtime/user configuration, ...) — an opaque lossless-JSON
   *  passthrough the handoff module never interprets. */
  readonly staged: RemoteSafeRecord
  /** Present exactly when the one-shot handoff context is attached;
   *  absent on the explicit "continue without handoff" decision
   *  (Architecture §7.2: OPTIONAL handoff provenance). */
  readonly handoff?: HandoffProvenance
}

/**
 * The frozen sourced handoff context (Architecture §34.2 final stage):
 * the one-shot context carried into the new team.
 *
 * - **one-shot**: materialized exactly once per operation — the service
 *   registry refuses to materialize it again;
 * - **detached**: a deep lossless-JSON copy of the frozen canonical
 *   surface — later changes in the source do not mutate it (§34.3);
 * - **pure data**: lossless JSON with no functions and no live handles —
 *   the target receives NO read grant on the source (§34.3);
 * - **frozen**: deep `Object.freeze` (via the contracts `deepFreeze`).
 */
export interface HandoffContext {
  /** The stable token of this one-shot context. */
  readonly contextToken: string
  /** The source session id — provenance/navigation metadata ONLY
   *  (§34.3: NOT a read grant). */
  readonly sourceSessionId: string
  /** When the source canonical surface was captured (ISO-8601). */
  readonly capturedAt: string
  /** The detached frozen canonical surface (the snapshot). */
  readonly surface: SourceCanonicalSurface
  /** The one-shot summary of the frozen surface. */
  readonly summary: HandoffSummary
}

/**
 * The stable request identity of one start-team-from-here operation
 * (the stable operation identity pattern of Architecture §18.2: the
 * same `(sourceSessionId, requestToken)` pair identifies the same
 * operation; a replay is idempotent and re-reads nothing).
 */
export interface StartTeamFromHereRequest {
  /** The stable operation identity (idempotent replay key together
   *  with the source session id). */
  readonly requestToken: string
  /** The ordinary (non-team) source DSH session to hand off from. */
  readonly sourceSessionId: string
  /** The caller's staged TeamIntent fields (opaque lossless-JSON
   *  passthrough; `{}` when absent). */
  readonly staged?: RemoteSafeRecord
}

/** A minimal reference to one started operation (the decision and the
 *  target-side guard address operations/contexts by identity). */
export interface HandoffOperationRef {
  readonly sourceSessionId: string
  readonly requestToken: string
}

/**
 * The explicit failure record surfaced by the handoff service (the
 * §34.4 rule: a failure is NEVER silently pretended as a successful
 * handoff — it is carried on the observable operation state).
 */
export interface HandoffFailure {
  /** The closed handoff error code of the failure. */
  readonly code: string
  /** The human-readable failure message. */
  readonly message: string
}

/**
 * The explicit decision options of a failed one-shot summarization
 * (Architecture §34.4, the verbatim triad: Retry / Continue without
 * handoff / Cancel).
 */
export const HANDOFF_DECISION_OPTIONS = {
  /** Re-run the one-shot summarization from the FROZEN snapshot (the
   *  source is NOT re-read — snapshot once). */
  RETRY: 'retry',
  /** Create the new team WITHOUT the handoff context (the TeamIntent
   *  carries no handoff provenance — §7.2 optional provenance). */
  CONTINUE_WITHOUT_HANDOFF: 'continue-without-handoff',
  /** Abandon the operation; no team is created. */
  CANCEL: 'cancel',
} as const

/** One decision option of a failed summarization. */
export type HandoffDecisionOption =
  (typeof HANDOFF_DECISION_OPTIONS)[keyof typeof HANDOFF_DECISION_OPTIONS]

/**
 * The observable state of one handoff operation (the service exposes
 * it after every start/resolve call).
 *
 * The underlying registry is IN-MEMORY and process-lifetime: the
 * module owns no durable state — TeamDomain remains the only durable
 * boundary (Architecture §42 invariant 41).
 */
export type HandoffOperationState =
  /** The handoff context is frozen AND the new team is created. */
  | {
      readonly kind: 'completed'
      readonly replayed: boolean
      readonly context: HandoffContext
      readonly team: TeamCreationOutcome
    }
  /** The explicit "continue without handoff" decision was taken: the
   *  new team is created WITHOUT the handoff context. */
  | {
      readonly kind: 'completed-without-handoff'
      readonly replayed: boolean
      readonly team: TeamCreationOutcome
    }
  /** The explicit "cancel" decision was taken: no team is created. */
  | {
      readonly kind: 'canceled'
      readonly replayed: boolean
    }
  /** The one-shot summarization failed: the explicit §34.4 triad is
   *  surfaced; NO team is created yet. */
  | {
      readonly kind: 'awaiting-decision'
      readonly replayed: boolean
      readonly failure: HandoffFailure
      readonly options: readonly HandoffDecisionOption[]
    }
  /** The team creation entry failed AFTER the context was frozen (or,
   *  on the "continue without handoff" path, before any context was
   *  materialized): the frozen context stays as-is when present; NO
   *  team exists yet; a re-invocation retries the creation idempotently
   *  (same stable intentToken). */
  | {
      readonly kind: 'creation-failed'
      readonly replayed: boolean
      readonly context?: HandoffContext
      readonly failure: HandoffFailure
    }

/**
 * The source-side query the target team might attempt against the
 * source session (mode `history-read` or `search`). Any such query is
 * ALWAYS rejected (Architecture §34.3: B cannot history_read(A); B
 * cannot search A) — the handoff boundary carries no read path to the
 * source at all.
 */
export interface SourceHistoryQuery {
  /** The attempted query mode. */
  readonly mode: 'history-read' | 'search'
  /** The query target text (recorded on the rejection detail only). */
  readonly target: string
}

/**
 * The ports the handoff service is built with (mock-first per ruling
 * R28; the production wiring uses the public session query/read
 * surface for `sourceSurface`, the Host/Team creation auxiliary
 * capability for `summarizer`, and the P6-T1 ActivationProvider public
 * entry for `teamCreation`).
 */
export interface HandoffPorts {
  /** The public session query/read surface of the source session. */
  readonly sourceSurface: HandoffSourceSurfacePort
  /** The one-shot summarize/compress auxiliary capability (§34.4). */
  readonly summarizer: HandoffSummarizerPort
  /** The public Team creation entry (§20.5 final stage). */
  readonly teamCreation: HandoffTeamCreationPort
  /** The deterministic clock (ISO-8601 string); injected so tests are
   *  reproducible and the module assumes no host global. */
  readonly clock: () => string
}
