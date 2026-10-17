/**
 * `runtime/jobs-gateway` shared types — Alpha.5 PR7 (Lane F), DORMANT.
 *
 * This lane is the ADAPTATION SURFACE between the dispatch plane (PR1 +
 * PR1r: the Scoped Dispatcher and its pending-call cancellation mechanism)
 * and the Web/Jobs view of the same work. It decides nothing that the
 * dispatch plane has not already decided: it ADAPTS the plane's event faces
 * into job-level facts and refuses to invent facts the plane did not emit.
 *
 * AUTHORITATIVE STACK for the cancellation shapes consumed here:
 * `origin/alpha5-pr1r-residual-boundaries` @ **bd6310ca** (contains the
 * B3(ii) fix `cf299383`). Until that branch merges, these types are a
 * documented contract fixture per INTERFACES-v1 §集成规则: verified against
 * the stack, NOT a claim that the whole chain is verified end-to-end. The
 * real stdio provider arrives with PR4; this lane develops against the
 * C-PROC-shaped fixture (stage closed set probe→prepare→execute→terminate,
 * terminate ≠ cancel) rather than waiting.
 *
 * The local owner/identity shapes below are the lane's contract stub for
 * `contracts/identity.ts` (`MemberIdentity`, `memberIdentityKey`): same two
 * components, same canonical-key idea, kept structurally so the DORMANT
 * lane imports no live glue. The integration owner replaces the stub with
 * the frozen contracts import at splice time.
 *
 * The production assembly contract (which sources the HOST injects at the
 * gateway's instantiation point — durable identity, the lease window, the
 * definition reader) is pinned in
 * `dev/agent-workflow/evidence/alpha5/prod/pc-CONTRACT.md`; the seams are
 * on this module's types (`GatewayIdentitySource`, the `createJobsGateway`
 * options). The lane stays DORMANT: injection points are a READY surface,
 * not a live edge — the live row lands with its GLUE owner.
 *
 * @module runtime/jobs-gateway/types
 */

/**
 * A member scope: the composite runtime identity of one MemberInstance
 * (root session id + instance id). `JobOwner` identity IS member scope
 * (INTERFACES-v1 C-GW): a job is never owned by a label, a template, or a
 * bare session — only by the member that admitted it.
 */
export interface JobOwner {
  /** TeamSession id (= root session id; the team is named by it). */
  readonly rootSessionId: string
  /** Instance id, unique within that TeamSession. */
  readonly instanceId: string
}

/**
 * The host-injected identity authority (assembly contract, PR7 production
 * wiring round). The kit legs (W7 / W7M / W7M-2) proved the owner-fence law
 * against identities READ BACK from durable host state — durable
 * `MemberInstance` rows, never caller-claimed constants. This interface
 * moves that authority INSIDE the gateway: when an assembly injects an
 * identity source, a claimed member scope that the source cannot confirm
 * from durable host state is refused BEFORE any lease is taken — the
 * veto-side zero-registration law the legs measured, now enforced by the
 * production class instead of by the row's discipline.
 *
 * CONTRACT for implementations (pc-CONTRACT.md §2):
 *  - `resolve` answers from the HOST's durable state only (e.g. the
 *    production assembly's `memberInstances` repository);
 *  - it returns the durable owner ONLY when a row exists with EXACTLY the
 *    claimed two components; anything else (no such member, a row whose
 *    components differ, an unreadable repository) returns `null` — an
 *    unreadable read confirms nothing, and the closed world credits no read
 *    it cannot make;
 *  - the returned object is the AUTHORITY COPY the gateway freezes; the
 *    caller's claim object is never stored when a source confirmed the
 *    admission.
 */
export interface GatewayIdentitySource {
  /** Confirm one claimed member scope against durable host state. */
  readonly resolve: (claimed: JobOwner) => JobOwner | null
}

/** Canonical key of a {@link JobOwner}: same member ⇒ same key, always. */
export function jobOwnerKey(owner: JobOwner): string {
  // Canonical (fixed-field-order, JSON-escaped) two-field key, mirroring the
  // frozen contracts' memberIdentityKey: field order in source objects cannot
  // split one owner into two keys, and a different rootSessionId always
  // changes the key (cross-TeamSession confusion impossible at string level).
  return `{"instanceId":${JSON.stringify(owner.instanceId)},"rootSessionId":${JSON.stringify(owner.rootSessionId)}}`
}

/**
 * The input side of this lane: observations on the dispatch plane's event
 * faces, exactly as the PR1/PR1r stack emits them (names verbatim from
 * `tool-dispatch/install.ts` @ cf299383 — the two cancellation shapes are
 * the whole point, so the names are NOT renamed here).
 */
export type DispatchEventName =
  /** Body never resolved / never invoked, and the LANE raised it (abort-before-exec form). */
  | 'dispatcher-call-cancelled-before-body'
  /** Before-dispatch cancellation this lane did not issue (caller / outer wrapper). */
  | 'dispatcher-call-cancelled-by-others'
  /** Body was invoked, then superseded: TERMINATED, never un-executed (terminate form). */
  | 'dispatcher-call-terminated-after-body-start'
  /** A lane abort lost the race: the Body ran to an ordinary outcome (EXECUTED). */
  | 'dispatcher-call-completed-after-abort'
  /** A cancel was issued and the outcome code cannot be read: say NEITHER form. */
  | 'dispatcher-call-outcome-unreadable'
  /** Integrity alarm: the channel was accepted-but-silent; a call ran unvalidated. */
  | 'dispatcher-call-executed-unvalidated'

/** One observation as it crosses the plane boundary into the gateway. */
export interface DispatchEvent {
  readonly event: DispatchEventName
  readonly callId: string
  readonly tool?: string
  readonly sideEffectPossible?: boolean
  readonly abortIssuedBy?: 'lane-definition-move' | 'none' | string
  readonly severity?: string
  /** Whatever the plane attached (values preserved, never rewritten here). */
  readonly [rest: string]: unknown
}

/**
 * The job-level outcome closed set. The set is deliberately SKEW to the
 * event names: two different event faces must map to it without ever
 * collapsing "started" into "not started", and an unreadable outcome is
 * its own member — never silently "completed", never "cancelled".
 */
export type JobOutcomeKind =
  /** The Body never started (only ever set off a before-dispatch face). */
  | 'not-started'
  /** The Body started and was superseded: side effects real, value preserved. */
  | 'terminated-after-start'
  /** The Body ran despite a cancellation: reported EXECUTED. */
  | 'executed-despite-cancel'
  /** Unreadable / unvalidated: the gateway declines to say either way. */
  | 'unresolved'

export interface JobOutcome {
  readonly kind: JobOutcomeKind
  /** Whether side effects may have happened; NEVER false for a started Body. */
  readonly sideEffectPossible: boolean
  /** Which face of the event plane this outcome was read off (evidence). */
  readonly evidenceEvent: DispatchEventName
  /** Who cancelled, when the plane said so; 'none' when it said none. */
  readonly abortIssuedBy: string | 'unknown'
}

/** Lane-local typed refusal codes (no second authorization algebra). */
export type GatewayRefusalCode =
  | 'gateway-not-active'
  | 'duplicate-job'
  | 'owner-mismatch'
  /**
   * The injected {@link GatewayIdentitySource} could not confirm the claimed
   * member scope from durable host state. Veto-side zero-registration: this
   * refusal is raised BEFORE any lease token exists — a refusal at this
   * gate leaves no job record, no lease, no state delta (the W7M-2 law).
   */
  | 'owner-not-durable'
  | 'unknown-job'
  | 'late-settle-across-boundary'
  | 'release-with-outstanding'
  | 'drain-given-up'
  | 'mapping-rejected'

export interface GatewayRefusal {
  readonly ok: false
  readonly code: GatewayRefusalCode
  readonly detail: string
}

export function gatewayRefusal(code: GatewayRefusalCode, detail: string): GatewayRefusal {
  return { ok: false, code, detail }
}
