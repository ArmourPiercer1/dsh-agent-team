/**
 * PD-34 (MEMBER-STOP) — the per-Member STOP sequence, as a pure model.
 *
 * WHY THIS FILE EXISTS. PD-30 measured that the Stop MECHANISM is real (the
 * Member's own durable log shows 0 rounds / 0 calls / 0 model requests after
 * an explicit stop), but the team view had no first-class "stop THIS Member"
 * entry: the only per-Member controls were the §40 lifecycle actions
 * (`archive` / `dispose`), which end the Member instead of stopping its goal.
 * This module owns the ONE stop sequence the UI emits, so the click, the
 * tests and the live evidence all exercise the same calls.
 *
 * WHAT IT CALLS (public client seams, the SAME RPCs the goal bar uses):
 *
 *   1. `goals.get(memberSessionId)`      — POST /api/goals/get   (durable read)
 *   2. `goals.pause(memberSessionId,{id,revision})` — POST /api/goals/pause
 *      (the durable CAS the goal bar's own Pause performs; the activation is
 *      disarmed by the service, and the host goal-round driver aborts the
 *      live turn of a host-initiated pause)
 *   3. `session.cancel({sessionId})`     — POST /api/session/cancel
 *      (the same abort the goal bar's Stop and the S5-B member commands use;
 *      a no-op when the Member is idle — upstream contract)
 *   4. `goals.get(memberSessionId)` again — the DURABLE OBSERVATION, which is
 *      the outcome the UI reports; a 200 from step 2/3 is never the oracle.
 *
 * WHY BOTH 2 AND 3, in this order: `pause` withdraws continuation authority
 * (so no NEXT round can start) and the driver aborts a host-paused live turn;
 * `cancel` is the explicit turn abort the product already ships and covers the
 * window in which the round is between the service's own abort and the
 * driver's idle transition. Pausing FIRST closes the "next round starts
 * between the cancel and the pause" race; cancelling second cannot undo the
 * durable pause.
 *
 * NOTHING is optimistically patched: the model performs no local state
 * mutation, and the returned outcome carries the phase RE-READ from the goal
 * service (or the typed refusal). A front end may render that observation but
 * must not invent one.
 *
 * PD-35 (STOP-OUTCOME): the SECOND read is the ONLY oracle for "stopped".
 * Before PD-35 the model collected `observedPhase` and then returned
 * `kind:'stopped'` whatever it read, so a re-read of `active` rendered
 * "已停止：目标 phase=active" (self-contradictory) and a failed re-read
 * rendered "已停止" from the pause's own phase. The three cases are now
 * separate values, and only a re-read of `paused` means `stopped`.
 *
 * Pure module: no React, no I/O, no node: builtins, no DSH internal API.
 * @module @dsh-agent-team/client/model/member-stop
 */

/** The closed goal phase vocabulary (upstream `GoalPhase`, wire spelling). */
export type MemberGoalPhase = 'active' | 'paused' | 'blocked' | 'complete'

/** The durable goal reference (`{id, revision}`) the CAS takes. */
export interface MemberGoalRef {
  readonly id: string
  readonly revision: number
}

/**
 * The goal view fields this model reads. The upstream `GoalView` carries
 * more (objective, rounds, limits); the stop decision needs the identity,
 * the CAS revision and the phase.
 */
export interface MemberGoalView extends MemberGoalRef {
  readonly phase: MemberGoalPhase
}

/** One carrier result (structurally `RemoteResult<T>` from the public seam). */
export type MemberStopRemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: { readonly code: string; readonly message: string }
    }

/**
 * The `ctx.remote.goals` face this model consumes (upstream public client
 * namespace `goals`, the SAME proxy the goal bar injects).
 */
export interface MemberStopGoalSeam {
  /** Read the current goal of one live Member session (`goals/get`). */
  get(memberSessionId: string): Promise<MemberStopRemoteResult<MemberGoalView | undefined>>
  /** Durably pause an active goal with an exact CAS reference (`goals/pause`). */
  pause(memberSessionId: string, ref: MemberGoalRef): Promise<MemberStopRemoteResult<MemberGoalView>>
}

/**
 * The `ctx.remote.session` face this model consumes (upstream public client
 * namespace `session`; only the one command is read).
 */
export interface MemberStopSessionSeam {
  /** Abort one live turn, retaining pending inbox work (`session/cancel`). */
  cancel(request: { readonly sessionId: string }): Promise<MemberStopRemoteResult<{ readonly accepted: boolean }>>
}

/** The injected public seams; absent faces mean "this host cannot stop". */
export interface MemberStopSeams {
  readonly goals?: MemberStopGoalSeam | undefined
  readonly session?: MemberStopSessionSeam | undefined
}

/** The outcome of the explicit turn abort (step 3). */
export type MemberStopCancelOutcome =
  | { readonly kind: 'accepted' }
  /** `session/not-found`: no live Agent is attached; the durable pause still decided. */
  | { readonly kind: 'not-attached' }
  | { readonly kind: 'refused'; readonly code: string; readonly message: string }
  /** The host exposes no `session` namespace (older composition). */
  | { readonly kind: 'unavailable' }

/**
 * The settled outcome of "stop this Member".
 *
 * The DURABLE re-read (step 4) decides which of three "pause was written"
 * outcomes is reported — the pause's own 200 is never the oracle:
 *
 *   - `stopped`             the last read confirmed `paused` (the ONLY success);
 *   - `pause-contradicted`  the pause was written, but the last read still
 *                           reports a non-`paused` phase (e.g. `active`);
 *   - `pause-unverified`    the pause was written, but the last read failed or
 *                           returned no goal, so the final state is unknown.
 *
 * `unavailable` / `read-refused` / `pause-refused` are typed failures
 * (rendered verbatim; never smoothed into a success). The `cancel` outcome is
 * a FIELD on each pause-written result, not a failure: a detached Agent is not
 * a failed stop.
 */
export type MemberStopOutcome =
  | {
      readonly kind: 'stopped'
      readonly goalId: string
      /** The revision the CAS wrote (the paused view's revision). */
      readonly revision: number
      /** The phase the pause itself reported (contract: `paused`). */
      readonly phase: MemberGoalPhase
      /** The phase re-read from the goal service AFTER the cancel: the oracle. */
      readonly observedPhase: 'paused'
      readonly cancel: MemberStopCancelOutcome
    }
  | {
      /**
       * The pause is durable, but the latest read still says something other
       * than `paused`. Rendered as "not confirmed", NEVER as "stopped".
       */
      readonly kind: 'pause-contradicted'
      readonly goalId: string
      readonly revision: number
      /** The phase the pause itself reported (contract: `paused`). */
      readonly phase: MemberGoalPhase
      /** The non-`paused` phase the last read observed (the contradiction). */
      readonly observedPhase: Exclude<MemberGoalPhase, 'paused'>
      readonly cancel: MemberStopCancelOutcome
    }
  | {
      /**
       * The pause is durable, but the final state could not be read: the
       * re-read was refused, threw, or returned no goal. Missing observation is
       * `undefined`, never `active` and never `paused`.
       */
      readonly kind: 'pause-unverified'
      readonly goalId: string
      readonly revision: number
      /** The phase the pause itself reported (contract: `paused`). */
      readonly phase: MemberGoalPhase
      readonly observedPhase: undefined
      readonly cancel: MemberStopCancelOutcome
    }
  | {
      readonly kind: 'no-goal'
      readonly cancel: MemberStopCancelOutcome
    }
  | {
      readonly kind: 'already-inactive'
      readonly phase: Exclude<MemberGoalPhase, 'active'>
      readonly revision: number
      readonly cancel: MemberStopCancelOutcome
    }
  | {
      readonly kind: 'read-refused'
      readonly code: string
      readonly message: string
    }
  | {
      readonly kind: 'pause-refused'
      readonly code: string
      readonly message: string
      readonly phase: MemberGoalPhase
      readonly revision: number
    }
  | { readonly kind: 'unavailable' }

/**
 * Abort one live turn through the public `session/cancel` command.
 * `session/not-found` is not an error here: it means no Agent is attached,
 * and the durable pause (already written) is what actually decided the stop.
 * @param seams - the injected public seams.
 * @param sessionId - the Member's child session id.
 * @returns the typed cancel outcome (never throws on a typed refusal).
 */
async function cancelTurn(
  seams: MemberStopSeams,
  sessionId: string,
): Promise<MemberStopCancelOutcome> {
  const session = seams.session
  if (session === undefined) return { kind: 'unavailable' }
  try {
    const result = await session.cancel({ sessionId })
    if (result.ok) return { kind: 'accepted' }
    return result.error.code === 'session/not-found'
      ? { kind: 'not-attached' }
      : { kind: 'refused', code: result.error.code, message: result.error.message }
  } catch (error: unknown) {
    // A carrier throw is a real outcome (connection loss), never a stop.
    return {
      kind: 'refused',
      code: 'transport-loss',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Stop ONE Member: withdraw its goal continuation durably, then abort its
 * current turn, then re-read the durable phase.
 *
 * The sequence is `goals.get` → (`goals.pause` when active) →
 * `session.cancel` → `goals.get`. A Member with no current goal still gets
 * its turn aborted (the button means "stop this Member", not "pause a
 * record"); the outcome says `no-goal` so the UI does not claim a pause.
 *
 * After the pause the outcome is classified by the LAST read alone: `stopped`
 * only when it says `paused`; `pause-contradicted` when it says anything else;
 * `pause-unverified` when it fails or returns no goal. The cancel outcome is a
 * field on all three, never a reason to downgrade the stop result.
 *
 * @param seams - the injected public seams (`ctx.remote.goals` / `ctx.remote.session`).
 * @param memberSessionId - the Member's child session id (the durable projection row's `childSessionId`).
 * @returns the observed outcome; typed refusals are values, not exceptions.
 */
export async function stopMember(
  seams: MemberStopSeams,
  memberSessionId: string,
): Promise<MemberStopOutcome> {
  const goals = seams.goals
  if (goals === undefined) return { kind: 'unavailable' }

  let current: MemberGoalView | undefined
  try {
    const read = await goals.get(memberSessionId)
    if (!read.ok) {
      return { kind: 'read-refused', code: read.error.code, message: read.error.message }
    }
    current = read.value
  } catch (error: unknown) {
    return {
      kind: 'read-refused',
      code: 'transport-loss',
      message: error instanceof Error ? error.message : String(error),
    }
  }

  if (current === undefined) {
    return { kind: 'no-goal', cancel: await cancelTurn(seams, memberSessionId) }
  }
  if (current.phase !== 'active') {
    return {
      kind: 'already-inactive',
      phase: current.phase,
      revision: current.revision,
      cancel: await cancelTurn(seams, memberSessionId),
    }
  }

  let paused: MemberGoalView
  try {
    const result = await goals.pause(memberSessionId, { id: current.id, revision: current.revision })
    if (!result.ok) {
      return {
        kind: 'pause-refused',
        code: result.error.code,
        message: result.error.message,
        phase: current.phase,
        revision: current.revision,
      }
    }
    paused = result.value
  } catch (error: unknown) {
    return {
      kind: 'pause-refused',
      code: 'transport-loss',
      message: error instanceof Error ? error.message : String(error),
      phase: current.phase,
      revision: current.revision,
    }
  }

  // The pause is durable and already withdrew continuation; the cancel is the
  // explicit turn abort, and its refusal must not be reported as a failed stop.
  const cancel = await cancelTurn(seams, memberSessionId)

  // The DURABLE observation (step 4) is the ONLY oracle for "stopped".
  // `ok:false` and `value:undefined` both mean "the final state is unknown":
  // a missing observation is `pause-unverified`, never smoothed into either a
  // success or the pause's own phase (PD-35).
  let observedPhase: MemberGoalPhase | undefined
  try {
    const reread = await goals.get(memberSessionId)
    if (reread.ok) observedPhase = reread.value?.phase
  } catch {
    observedPhase = undefined
  }

  const base = {
    goalId: paused.id,
    revision: paused.revision,
    phase: paused.phase,
    cancel,
  } as const

  if (observedPhase === undefined) {
    // The re-read was refused/threw or returned no goal: the pause is written,
    // but its final state could not be confirmed.
    return { kind: 'pause-unverified', ...base, observedPhase: undefined }
  }
  if (observedPhase !== 'paused') {
    // The pause was acknowledged but the latest durable read says otherwise.
    // Reporting `stopped` here is the PD-35 defect: the UI would print
    // "已停止：目标 phase=active". Keep the contradiction explicit.
    return { kind: 'pause-contradicted', ...base, observedPhase }
  }
  return { kind: 'stopped', ...base, observedPhase }
}

/**
 * Stop the LEADER's current turn only.
 *
 * This is deliberately NOT the Member stop: Preview's Stop semantics are
 * per-Member, and cancelling the Leader's turn does not cancel work it has
 * already delegated to asynchronous Members (measured — PD-30 S5). The UI
 * entry that calls this says so; it never pauses the Leader's goal, because
 * the Leader's turn and a Member's goal continuation are different things.
 *
 * @param seams - the injected public seams.
 * @param rootSessionId - the team root (Leader) session id.
 * @returns the typed cancel outcome.
 */
export async function stopLeaderTurn(
  seams: MemberStopSeams,
  rootSessionId: string,
): Promise<MemberStopCancelOutcome> {
  return cancelTurn(seams, rootSessionId)
}
