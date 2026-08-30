/**
 * TeamAgentBinder — the single idempotent orchestration core of P5 (TaskDoc
 * §11.5 P5-T1; DevPlan §18.1).
 *
 * ONE class covers the FOUR bind paths:
 *
 * - {@link TeamAgentBinder.bindFreshRoot}       (bind fresh Root)
 * - {@link TeamAgentBinder.bindFreshMember}     (bind fresh Member)
 * - {@link TeamAgentBinder.rehydrateColdRoot}   (rehydrate cold Root)
 * - {@link TeamAgentBinder.rehydrateColdMember} (rehydrate cold Member)
 *
 * and is IDEMPOTENT (DevPlan §18.1 "且 idempotent"):
 *
 * - a repeated bind of an already-bound target on a live residency is a
 *   NO-OP: no duplicate install, no duplicate restore, no duplicate session
 *   event, and the returned identity is stable (deep-equal) across calls;
 * - the binder never records the same `(sessionId, name, detail)` event
 *   twice, even across a failed bind and its retry;
 * - fresh vs cold is a CALLER decision (the four explicit methods); the
 *   binder enforces the difference: the fresh path installs the overlay
 *   slots (the fresh-time effects, through the injected slots + surface),
 *   while the cold path ONLY restores the scope from the durable records
 *   (no slot `apply`, no `installOverlay`) — fresh-time side effects are
 *   never re-run on a cold rehydrate (DevPlan §18.5: Agent residency is
 *   ephemeral, TeamDomain is durable).
 *
 * Orchestration order (owned by the binder — ruling R28: "owns：编排顺序 +
 * overlay 槽位契约 + admission 决策点"):
 *
 * 1. Session-kind resolution (READ-ONLY durable lookup): unbound or
 *    `ordinary` → successful no-effect no-op; a kind mismatch (root path on
 *    a `team-member` session or vice versa) → fail-closed
 *    `BINDER_TARGET_KIND_MISMATCH`;
 * 2. Durable record load (READ-ONLY): the required record must exist
 *    (otherwise `BINDER_TARGET_NOT_FOUND` — the binder never creates
 *    TeamDomain records); member paths cross-check the binding against the
 *    MemberInstance record (`BINDER_RECORD_CONFLICT`) and refuse terminal
 *    `DISPOSED` members (`BINDER_MEMBER_DISPOSED`);
 * 3. Idempotency check: bound entry + live residency carrying the full
 *    slot set → no-op (`already-bound`);
 * 4. Fresh: per slot in {@link OVERLAY_SLOT_ORDER} — slot `apply`, surface
 *    `installOverlay`, `agent-setup/overlay-installed` event. Cold: surface
 *    `restoreScope`, `agent-setup/scope-restored` event. Any failure is
 *    FATAL before work (`BINDER_OVERLAY_FAILED`): no later step runs and
 *    the target is not registered;
 * 5. Admission decision (the binder's decision point BEFORE work,
 *    fail-closed): the injected guard decides; a throwing guard is a
 *    rejection with `ADMISSION_GUARD_ERROR`; `agent-setup/admission-decided`
 *    event. T2's persona `complete:true` FATAL gate runs in the persona
 *    slot's `apply` — i.e. BEFORE this admission decision;
 * 6. Finalize: register the bound entry (identity + admission state) and
 *    return the result. The caller gates any Team work on `admitted`.
 *
 * The binder NEVER writes the durable truth: it holds only the injected
 * READ-ONLY {@link TeamDomainReadHandle} (ruling R28; DevPlan §18.1 "binder
 * 负责安装 overlay，不拥有 TeamDomain truth"). It never emits any Team
 * SessionEvent vocabulary (vNext has no Team SessionEvents — the recorded
 * events are the public Agent setup/session events of
 * {@link AGENT_SETUP_EVENT_NAMES}).
 *
 * T1 is mock-first: the surface and (in tests) the read handle are fakes /
 * test seams; the real DSH public seam binding lands in T5/T6.
 *
 * @module @dsh-agent-team/runtime/agent-setup/binder/binder
 */

import {
  ADMISSION_GUARD_ERROR_CODE,
  ADMISSION_OPEN_CODE,
  defaultAdmissionGuard,
  defaultOverlaySlots,
} from './defaults.js'
import { TEAM_AGENT_BINDER_ERROR_CODES as CODES, TeamAgentBinderError } from './errors.js'
import { AGENT_SETUP_EVENT_NAMES, OVERLAY_SLOT_ORDER } from './types.js'
import type {
  AdmissionDecision,
  AdmissionGuard,
  AgentSetupEventRecord,
  OverlaySlot,
  OverlaySlotName,
  RestoredScope,
  TeamAgentBindIdentity,
  TeamAgentBindPath,
  TeamAgentBindResult,
  TeamAgentBinderOptions,
  TeamAgentSetupSurface,
  TeamAgentStepContext,
  TeamDomainReadHandle,
} from './types.js'
import type { MemberInstanceRecordDto, TeamSessionRecordDto } from '../../../contracts/src/index.js'

/** The origin of a failed overlay effect (the `BINDER_OVERLAY_FAILED` detail). */
export type OverlayFailureOrigin = OverlaySlotName | 'restore' | 'event-recording'

/** One pending bind request (the internal form of the four public methods). */
interface PendingBind {
  readonly path: TeamAgentBindPath
  readonly sessionId: string
  readonly expected: 'root' | 'member'
}

/** The binder's in-process bound-target entry (identity + admission state). */
interface BindEntry {
  readonly target: TeamAgentBindIdentity
  readonly admitted: boolean
  readonly admissionCode: string
}

/**
 * The single TeamAgentBinder class (DevPlan §18.1). See the module docs
 * for the orchestration order, the idempotency contract, and the
 * fail-closed error semantics.
 */
export class TeamAgentBinder {
  private readonly surface: TeamAgentSetupSurface
  private readonly teamDomain: TeamDomainReadHandle
  private readonly slots: Record<OverlaySlotName, OverlaySlot>
  private readonly admissionGuard: AdmissionGuard
  private readonly bound = new Map<string, BindEntry>()
  private readonly emittedEvents = new Map<string, Set<string>>()

  /**
   * @param options - the injected surface, read-only TeamDomain handle,
   *   optional slot overrides (identity defaults fill the rest), and
   *   optional admission guard (the default admitting guard fills the
   *   rest). Construction is fail-fast: a malformed option throws a
   *   `TypeError` (a programming error, not a bind-time contract error).
   */
  constructor(options: TeamAgentBinderOptions) {
    if (options === null || typeof options !== 'object') {
      throw new TypeError('TeamAgentBinderOptions must be an object')
    }
    const surface = options.surface
    if (!isSetupSurface(surface)) {
      throw new TypeError(
        'TeamAgentBinderOptions.surface must implement TeamAgentSetupSurface ' +
          '(getInstalledSlots / installOverlay / restoreScope / recordSessionEvent)',
      )
    }
    const teamDomain = options.teamDomain
    if (!isReadHandle(teamDomain)) {
      throw new TypeError(
        'TeamAgentBinderOptions.teamDomain must implement TeamDomainReadHandle ' +
          '(getTeamSession / getMemberInstance / getSessionBinding)',
      )
    }
    this.surface = surface
    this.teamDomain = teamDomain

    this.slots = defaultOverlaySlots()
    const overrides = options.slots
    if (overrides !== undefined) {
      if (overrides === null || typeof overrides !== 'object') {
        throw new TypeError('TeamAgentBinderOptions.slots must be an object')
      }
      for (const slotName of OVERLAY_SLOT_ORDER) {
        const override = overrides[slotName]
        if (override === undefined) continue
        if (override.name !== slotName) {
          throw new TypeError(
            `overlay slot override for key '${slotName}' must have name '${slotName}' (got '${override.name}')`,
          )
        }
        if (typeof override.apply !== 'function') {
          throw new TypeError(`overlay slot '${slotName}' must provide an apply function`)
        }
        this.slots[slotName] = override
      }
      for (const key of Object.keys(overrides)) {
        if (!(OVERLAY_SLOT_ORDER as readonly string[]).includes(key)) {
          throw new TypeError(
            `unknown overlay slot key '${key}' (expected one of: ${OVERLAY_SLOT_ORDER.join(', ')})`,
          )
        }
      }
    }

    const guard = options.admissionGuard
    if (guard === undefined) {
      this.admissionGuard = defaultAdmissionGuard
    } else {
      if (guard === null || typeof guard !== 'object' || typeof guard.decide !== 'function') {
        throw new TypeError('TeamAgentBinderOptions.admissionGuard must provide a decide function')
      }
      this.admissionGuard = guard
    }
  }

  /**
   * Bind a FRESH Root: the first-time overlay installation on the root
   * agent residency (DevPlan §18.1 "bind fresh Root").
   * @param rootSessionId - the root DSH session id (= TeamSessionId,
   *   invariant 9).
   * @returns the bind result (ordinary session → no-effect no-op; team root
   *   → full fresh install + admission decision).
   * @throws {@link TeamAgentBinderError} on kind mismatch, missing or
   *   conflicting durable records, or a failed overlay effect (fail-closed).
   */
  bindFreshRoot(rootSessionId: string): TeamAgentBindResult {
    return this.bind({ path: 'fresh-root', sessionId: String(rootSessionId), expected: 'root' })
  }

  /**
   * Bind a FRESH Member: the first-time overlay installation on the member
   * child agent residency (DevPlan §18.1 "bind fresh Member").
   * @param childSessionId - the member's durable child DSH session id
   *   (invariant 23).
   * @returns the bind result (ordinary session → no-effect no-op).
   * @throws {@link TeamAgentBinderError} as in {@link bindFreshRoot}, plus
   *   `BINDER_MEMBER_DISPOSED` for a terminal member.
   */
  bindFreshMember(childSessionId: string): TeamAgentBindResult {
    return this.bind({ path: 'fresh-member', sessionId: String(childSessionId), expected: 'member' })
  }

  /**
   * Rehydrate a COLD Root: restore the root scope from the durable
   * TeamSession record onto a (re)created agent residency WITHOUT re-running
   * fresh-time side effects (DevPlan §18.1 "rehydrate cold Root"; DevPlan
   * §18.5 residency is ephemeral).
   * @param rootSessionId - the root DSH session id (= TeamSessionId).
   * @returns the bind result (ordinary session → no-effect no-op; a cold
   *   rehydrate re-decides admission).
   * @throws {@link TeamAgentBinderError} as in {@link bindFreshRoot}.
   */
  rehydrateColdRoot(rootSessionId: string): TeamAgentBindResult {
    return this.bind({ path: 'cold-root', sessionId: String(rootSessionId), expected: 'root' })
  }

  /**
   * Rehydrate a COLD Member: restore the member scope from the durable
   * MemberInstance record + session binding onto a (re)created agent
   * residency WITHOUT re-running fresh-time side effects (DevPlan §18.1
   * "rehydrate cold Member").
   * @param childSessionId - the member's durable child DSH session id.
   * @returns the bind result (ordinary session → no-effect no-op).
   * @throws {@link TeamAgentBinderError} as in {@link bindFreshMember}.
   */
  rehydrateColdMember(childSessionId: string): TeamAgentBindResult {
    return this.bind({ path: 'cold-member', sessionId: String(childSessionId), expected: 'member' })
  }

  /** The shared orchestration of the four bind paths (see module docs). */
  private bind(request: PendingBind): TeamAgentBindResult {
    const { path, sessionId, expected } = request

    // Step 1 — session-kind resolution (read-only). Unbound or ordinary:
    // the successful no-effect no-op (TaskDoc §11.5 must-test "ordinary
    // agent no-op"). A kind mismatch (checked per branch below, before any
    // effect) fails closed with BINDER_TARGET_KIND_MISMATCH.
    const binding = this.teamDomain.getSessionBinding(sessionId)
    if (binding === undefined || binding.kind === 'ordinary') {
      return {
        requested: path,
        bound: false,
        installed: false,
        noopReason: 'ordinary',
        emittedEvents: [],
      }
    }

    // Step 2 — durable record load (read-only). The binder never creates
    // TeamDomain records: a missing record is a provisioning defect,
    // surfaced fail-closed.
    let target: TeamAgentBindIdentity
    let record: TeamSessionRecordDto | MemberInstanceRecordDto
    if (expected === 'root') {
      if (binding.kind !== 'team-root') {
        throw new TeamAgentBinderError(
          CODES.BINDER_TARGET_KIND_MISMATCH,
          `bind path '${path}' expects a 'team-root' session but session '${sessionId}' is '${binding.kind}'`,
          { path, sessionId, expectedKind: 'team-root', foundKind: binding.kind },
        )
      }
      const teamSession = this.teamDomain.getTeamSession(sessionId)
      if (teamSession === undefined) {
        throw new TeamAgentBinderError(
          CODES.BINDER_TARGET_NOT_FOUND,
          `bind path '${path}' requires the TeamSession record of root session '${sessionId}' but it is absent`,
          { path, sessionId, rootSessionId: sessionId },
        )
      }
      record = teamSession
      target = { kind: 'root', sessionId, rootSessionId: String(teamSession.rootSessionId) }
    } else {
      if (binding.kind !== 'team-member') {
        throw new TeamAgentBinderError(
          CODES.BINDER_TARGET_KIND_MISMATCH,
          `bind path '${path}' expects a 'team-member' session but session '${sessionId}' is '${binding.kind}'`,
          { path, sessionId, expectedKind: 'team-member', foundKind: binding.kind },
        )
      }
      const rootSessionId = String(binding.rootSessionId)
      const instanceId = String(binding.instanceId)
      const member = this.teamDomain.getMemberInstance(rootSessionId, instanceId)
      if (member === undefined) {
        throw new TeamAgentBinderError(
          CODES.BINDER_TARGET_NOT_FOUND,
          `bind path '${path}' requires the MemberInstance record of member ('${rootSessionId}', '${instanceId}') but it is absent`,
          { path, sessionId, rootSessionId, instanceId },
        )
      }
      if (String(member.childSessionId) !== sessionId) {
        throw new TeamAgentBinderError(
          CODES.BINDER_RECORD_CONFLICT,
          `the session binding of child session '${sessionId}' (member '${instanceId}' of root '${rootSessionId}') conflicts with the MemberInstance record (childSessionId '${String(member.childSessionId)}')`,
          {
            path,
            sessionId,
            rootSessionId,
            instanceId,
            bindingChildSessionId: sessionId,
            recordChildSessionId: String(member.childSessionId),
          },
        )
      }
      if (member.lifecycle === 'DISPOSED') {
        throw new TeamAgentBinderError(
          CODES.BINDER_MEMBER_DISPOSED,
          `member ('${rootSessionId}', '${instanceId}') is terminal (lifecycle 'DISPOSED'); a disposed Member can never gain a residency`,
          { path, sessionId, rootSessionId, instanceId, lifecycle: 'DISPOSED' },
        )
      }
      record = member
      target = { kind: 'member', sessionId, rootSessionId, instanceId }
    }

    // Step 3 — idempotency: an already-bound target on a live residency is
    // a no-op (no duplicate install / restore / event; stable identity).
    const entry = this.bound.get(sessionId)
    if (entry !== undefined && sameTarget(entry.target, target)) {
      const residencySlots = this.surface.getInstalledSlots(sessionId)
      if (OVERLAY_SLOT_ORDER.every((slot) => residencySlots.includes(slot))) {
        return {
          requested: path,
          bound: true,
          installed: false,
          noopReason: 'already-bound',
          identity: entry.target,
          admitted: entry.admitted,
          admissionCode: entry.admissionCode,
          emittedEvents: [],
        }
      }
    }

    const context: TeamAgentStepContext = { target, record, path }
    const emitted: AgentSetupEventRecord[] = []
    const isFresh = path === 'fresh-root' || path === 'fresh-member'

    // Step 4 — overlay installation (fresh) or scope restoration (cold).
    // Any failure is FATAL before work: no later slot, no admission
    // decision, no registration.
    if (isFresh) {
      for (const slotName of OVERLAY_SLOT_ORDER) {
        const slot = this.slots[slotName]
        try {
          slot.apply(context)
        } catch (error) {
          throw this.overlayFailure(slotName, path, sessionId, error)
        }
        try {
          this.surface.installOverlay(sessionId, slotName)
        } catch (error) {
          throw this.overlayFailure(slotName, path, sessionId, error)
        }
        this.emit(sessionId, path, { name: AGENT_SETUP_EVENT_NAMES.overlayInstalled, detail: slotName }, emitted)
      }
    } else {
      const scope: RestoredScope =
        target.kind === 'member' && target.instanceId !== undefined
          ? { kind: 'member', rootSessionId: target.rootSessionId, instanceId: target.instanceId, slots: OVERLAY_SLOT_ORDER }
          : { kind: 'root', rootSessionId: target.rootSessionId, slots: OVERLAY_SLOT_ORDER }
      try {
        this.surface.restoreScope(sessionId, scope)
      } catch (error) {
        throw this.overlayFailure('restore', path, sessionId, error)
      }
      this.emit(sessionId, path, { name: AGENT_SETUP_EVENT_NAMES.scopeRestored, detail: target.kind }, emitted)
    }

    // Step 5 — the admission decision point BEFORE work (fail-closed). A
    // guard fault is a rejection with ADMISSION_GUARD_ERROR: a guard fault
    // NEVER admits.
    let decision: AdmissionDecision
    try {
      decision = this.admissionGuard.decide(context)
    } catch (error) {
      decision = { status: 'rejected', code: ADMISSION_GUARD_ERROR_CODE, detail: errorMessage(error) }
    }
    const admitted = decision.status === 'admitted'
    const admissionCode = decision.status === 'admitted' ? ADMISSION_OPEN_CODE : decision.code
    this.emit(sessionId, path, { name: AGENT_SETUP_EVENT_NAMES.admissionDecided, detail: admissionCode }, emitted)

    // Step 6 — finalize: register the bound entry (identity + admission
    // state) and return the result. The caller gates any Team work on
    // `admitted`.
    this.bound.set(sessionId, { target, admitted, admissionCode })
    return {
      requested: path,
      bound: true,
      installed: true,
      identity: target,
      admitted,
      admissionCode,
      emittedEvents: emitted,
    }
  }

  /** Wrap one failed overlay effect as the closed `BINDER_OVERLAY_FAILED`. */
  private overlayFailure(
    origin: OverlayFailureOrigin,
    path: TeamAgentBindPath,
    sessionId: string,
    error: unknown,
  ): TeamAgentBinderError {
    return new TeamAgentBinderError(
      CODES.BINDER_OVERLAY_FAILED,
      `binder overlay effect '${origin}' failed during '${path}' bind of session '${sessionId}': ${errorMessage(error)}`,
      { origin, path, sessionId, causeMessage: errorMessage(error) },
      error,
    )
  }

  /**
   * Record one event through the surface, deduplicated per session on the
   * full event record `(name, detail)`: the binder never records the same
   * event record twice for one session (even across a failed bind and its
   * retry).
   */
  private emit(
    sessionId: string,
    path: TeamAgentBindPath,
    event: AgentSetupEventRecord,
    out: AgentSessionEventAccumulator,
  ): void {
    const key = eventKey(event)
    let known = this.emittedEvents.get(sessionId)
    if (known === undefined) {
      known = new Set<string>()
      this.emittedEvents.set(sessionId, known)
    }
    if (known.has(key)) return
    try {
      this.surface.recordSessionEvent(sessionId, event)
    } catch (error) {
      throw this.overlayFailure('event-recording', path, sessionId, error)
    }
    known.add(key)
    out.push(event)
  }
}

/** The accumulated emitted events of one bind call (type alias for clarity). */
type AgentSessionEventAccumulator = AgentSetupEventRecord[]

/** The identity key of one event record (deduplication contract). */
function eventKey(event: AgentSetupEventRecord): string {
  return event.name + '\u0000' + (event.detail ?? '')
}

/** Whether two resolved targets are the same team agent identity. */
function sameTarget(a: TeamAgentBindIdentity, b: TeamAgentBindIdentity): boolean {
  return (
    a.kind === b.kind &&
    a.sessionId === b.sessionId &&
    a.rootSessionId === b.rootSessionId &&
    (a.instanceId ?? '') === (b.instanceId ?? '')
  )
}

/** The human-readable message of one unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Structural guard for the injected setup surface (fail-fast at construction). */
function isSetupSurface(value: unknown): value is TeamAgentSetupSurface {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate['getInstalledSlots'] === 'function' &&
    typeof candidate['installOverlay'] === 'function' &&
    typeof candidate['restoreScope'] === 'function' &&
    typeof candidate['recordSessionEvent'] === 'function'
  )
}

/** Structural guard for the injected read-only TeamDomain handle. */
function isReadHandle(value: unknown): value is TeamDomainReadHandle {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate['getTeamSession'] === 'function' &&
    typeof candidate['getMemberInstance'] === 'function' &&
    typeof candidate['getSessionBinding'] === 'function'
  )
}
