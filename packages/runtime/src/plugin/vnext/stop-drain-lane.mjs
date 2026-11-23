/**
 * stop-drain-lane.mjs — the Member stop lane: interrupt + goal disarm, the recursive descendant drain,
 * and the live-residency port.
 *
 * EXTRACTED VERBATIM FROM agent-bindings.mjs (2026-11-23, behaviour-preserving decomposition round;
 * no byte of the moved text changed). One factory per row instance.
 *
 * WHAT IT OWNS:
 *  - `interrupt` — the public Agent cancel PLUS the PD-29 goal withdrawal (a Team stop is not human
 *    input: the cancel carries the hook cause, the durable goal transition is `pause`, the
 *    process-local activation is disarmed);
 *  - `disarmStoppedGoal` — that withdrawal, including the "no goals service / no current goal" paths;
 *  - `recursiveDrainUnavailable` / `drainDescendants` — the REAL recursive drain (whenIdle + the
 *    subagents service, honest descendant count, typed fail-closed when quiescence cannot be
 *    established);
 *  - `residency` — the live-handle map port (has / hasResidency / dropResidency).
 *
 * The two `*BaseToolsUnavailable` refusals that sit between these functions in the original file
 * belong to the agent-setup lane and STAY in agent-bindings.mjs.
 *
 * @module packages/runtime/src/plugin/vnext/stop-drain-lane
 */

/**
 * Create the stop/drain lane over one row instance.
 * @param {object} input
 * @param {object} input.domain - the open TeamDomain (member rows are read from its repositories).
 * @param {string} input.rootSid - this row's boot root session id.
 * @param {Function} input.childSessionIdFor - the durable child-id derivation.
 * @param {Map<string, object>} input.liveAgents - the row's live handle map (mutated through it).
 * @param {string[]} input.observations - the row's observation log (pushed to, never replaced).
 * @param {object} input.deps - the row deps (`goals`, `subagents`).
 * @returns {object} the stop/drain/residency port.
 */
export function createStopDrainLane ({ domain, rootSid, childSessionIdFor, liveAgents, observations, deps }) {
  // The P7-T3 lifecycle bindings over the REAL production surfaces: close-
  // admission stays with the production row (no separate in-process
  // admission gate — the router's per-team lock serializes the whole
  // procedure); interrupt is the public Agent cancel (upstream contract:
  // no-op when the phase is idle); drain is the REAL recursive descendant
  // drain (T12-M3: whenIdle + the subagents service, honest count, typed
  // fail-closed); residency is the live-agent handle map (drop = forget the
  // resident handle, the durable session stays on disk under DSH_HOME).
  //
  // PD-29 (2026-11-14, goal-stop): "interrupt" must ALSO withdraw the
  // Member's goal-continuation authority, and it must do so even when the
  // upstream cancel is a no-op. Upstream's own contract is explicit —
  // `Agent.cancel` with no active activity "is a no-op and does not arm
  // later work" — so a Member that is between two goal rounds (idle, goal
  // still `active`+`armed`) would be left with an armed goal after the Team
  // stop and the goal-round driver could start the NEXT round. The upstream
  // goal service publishes exactly the seam for this (GoalService.disarm:
  // "Lifecycle owners use this before unloading a driver"), so the Team
  // withdraws the process-local activation on the SAME stop that closes
  // admission. The DURABLE transition is `pause` — the very transition the
  // user's `/goal pause` performs — because a member that the Leader just
  // archived must not keep reporting `phase: active` while nothing can run
  // (a label without a mechanism). Pause keeps the goal readable, bumps its
  // revision, and a later human `resume`/`/goal resume` stays the legal
  // re-arm. No second policy source, no round budget, no core change; a goal
  // already in a terminal or paused phase cannot be paused, so the disarm
  // below still withdraws activation in that case.
  async function interrupt(target) {
    const row = domain.repositories.memberInstances.list(rootSid).find(
      (m) => String(m.instanceId) === String(target.instanceId),
    )
    // The durable row may not carry `childSessionId` yet (the id is DERIVED
    // from root+instance and only some writers persist it), so fall back to
    // the same derivation `childSessionIdFor` uses. Looking the handle up by
    // the row alone silently missed every member whose row was written by a
    // path that leaves the column empty — exactly the "interrupt returned,
    // nothing happened" shape this lane exists to catch.
    const childSid = row?.childSessionId === undefined || row?.childSessionId === null
      ? childSessionIdFor(String(target.rootSessionId ?? rootSid), String(target.instanceId))
      : String(row.childSessionId)
    const handle = liveAgents.get(childSid)
    if (handle === undefined) {
      observations.push(`pd29: Team interrupt of '${String(target?.instanceId ?? '<unknown>')}' found NO live agent (childSessionId=${childSid}); nothing to cancel or disarm`)
      return // no activity in flight: no-op by contract
    }
    // A6 provenance: a Team machine stop is NOT human input, so it carries the
    // hook cause and cannot clear a human Sticky Stop. The durable pause below
    // is what withdraws continuation; the human Stop button reaches the host
    // through its own client RPC and does not pass through this function.
    handle.agent.cancel({ kind: 'hook', reason: 'team-member-interrupt' })
    disarmStoppedGoal(handle.agent, target)
  }

  /** Withdraw goal-continuation authority on a Team stop (PD-29). */
  function disarmStoppedGoal(agent, target) {
    let goals
    try {
      goals = typeof deps.goals === 'function' ? deps.goals() : undefined
    } catch (error) {
      goals = undefined
      observations.push(`pd29: goal service accessor threw on stop of '${String(target?.instanceId ?? '<unknown>')}': ${String(error?.message ?? error)}`)
    }
    if (goals === undefined || goals === null || typeof goals.disarm !== 'function') {
      observations.push(`pd29: no goals service on this host; stop of '${String(target?.instanceId ?? '<unknown>')}' disarmed nothing (no goal continuation can exist without it)`)
      return
    }
    let before
    try {
      before = typeof goals.get === 'function' ? goals.get(agent) : undefined
    } catch {
      before = undefined
    }
    if (before === undefined || before === null) {
      observations.push(`pd29: stop of '${String(target?.instanceId ?? '<unknown>')}' found no current goal; nothing to disarm`)
      return
    }
    // The durable pause FIRST (the same CAS the goal bar uses), then the
    // process-local withdrawal. A pause that the service refuses (the goal was
    // already paused/complete/blocked) is not an error: there is nothing to
    // pause, and the disarm below is still required.
    let paused = null
    if (typeof goals.pause === 'function' && before.phase === 'active') {
      try {
        paused = goals.pause(agent, { id: before.id, revision: before.revision })
      } catch (error) {
        observations.push(`pd29: durable pause refused on stop of '${String(target?.instanceId ?? '<unknown>')}' (phase=${String(before.phase)}): ${String(error?.message ?? error)}`)
      }
    }
    try {
      const after = goals.disarm(agent)
      observations.push(`pd29: goal stopped on Team interrupt of '${String(target?.instanceId ?? '<unknown>')}': id=${String(after?.id)} revision=${String(after?.revision)} phase=${String(after?.phase)} paused=${String(paused === null ? '<refused>' : `${String(paused.phase)}@${String(paused.revision)}`)} activation ${String(before?.activation)}->${String(after?.activation)}`)
    } catch (error) {
      observations.push(`pd29: goal disarm FAILED on stop of '${String(target?.instanceId ?? '<unknown>')}': ${String(error?.message ?? error)}`)
    }
  }

  // T12-M3: the typed fail-closed error for a drain that cannot ESTABLISH
  // quiescence (no live agent, subagents service absent/unusable,
  // infrastructural rejection). Carries code 'recursive-drain-unavailable';
  // the lifecycle layer (lifecycle/quiesce.ts) maps the REJECTION to a
  // live-effect failure and the archive/dispose procedure REFUSES
  // completion — quiescence is never faked.
  function recursiveDrainUnavailable(sessionId, reason) {
    const error = new Error(`agent-bindings: recursive drain unavailable for '${sessionId}': ${reason} (code: recursive-drain-unavailable)`)
    error.code = 'recursive-drain-unavailable'
    observations.push(`p6t6: recursive-drain-unavailable for ${sessionId}: ${reason}`)
    return error
  }

  /**
   * T12-M3: the REAL recursive descendant drain (stop + quiesce).
   *
   * Cancel semantics: this is invoked BEFORE any dropResidency /
   * handle.dispose (a disposed agent cannot be quiesced — the durable
   * session on disk is not quiescence). The sequence:
   *   (a) `await handle.agent.whenIdle()` — the member's own in-flight turn
   *       settles first (a rejection PROPAGATES as a fault: a rejected
   *       settle is not quiescence);
   *   (b) `await subagents.drainContinuableDescendants([handle.agent])` —
   *       the SubagentRuntime closes admission below the member, stops its
   *       visible descendant Activations, and awaits them; it REJECTS with
   *       an aggregate AFTER ALL BRANCHES SETTLE when any failed — that
   *       rejection is a DRAIN FAILURE: the report is
   *       `{drained: <count>, quiescent: false}`, never `quiescent: true`;
   *   (c) `await subagents.listDescendants(handle.agent.session.id)` — the
   *       HONEST descendant count (the complete tree after the drain).
   *
   * `quiescent: true` is returned ONLY when (a) and (b) settled without
   * rejection and (c) listed successfully.
   *
   * Throws the typed `recursive-drain-unavailable` error (the lifecycle
   * maps the rejection to LIFECYCLE_LIVE_EFFECT_FAILED; the procedure
   * refuses before any commit) when:
   *   - there is no live agent for the session (quiescence cannot be
   *     established for a member that has no resident agent);
   *   - the subagents service is absent or structurally unusable (the
   *     production host seam is not wired yet — integrator note: host.ts
   *     must pass `subagents: ctx.get('subagents')` into the glue deps for
   *     this drain to be active in production);
   *   - the drain or the listing fails for an infrastructural reason (as
   *     opposed to the (b) aggregate drain FAILURE, which reports
   *     `quiescent: false` with the best-effort count).
   *
   * @param {string} childSessionId
   * @returns {Promise<{drained: number, quiescent: boolean}>}
   */
  async function drainDescendants(childSessionId) {
    const sid = String(childSessionId)
    const handle = liveAgents.get(sid)
    if (handle === undefined) {
      throw recursiveDrainUnavailable(sid, 'no live agent (quiescence cannot be established)')
    }
    // (a) the member's own turn settles first.
    await handle.agent.whenIdle()
    // (b) the real recursive drain of every continuable descendant.
    const subagents = deps.subagents
    if (
      subagents === undefined ||
      typeof subagents.drainContinuableDescendants !== 'function' ||
      typeof subagents.listDescendants !== 'function'
    ) {
      throw recursiveDrainUnavailable(sid, 'the subagents service is absent or unusable')
    }
    let drainFailed = false
    try {
      await subagents.drainContinuableDescendants([handle.agent])
    } catch {
      // The aggregate settles only AFTER all branches: a rejection here is
      // a DRAIN FAILURE (residual descendant activity), not a fault — it
      // reports quiescent: false, never a throw and never quiescent: true.
      drainFailed = true
    }
    // (c) the honest descendant count (the tree after the drain).
    let drained
    try {
      const entries = await subagents.listDescendants(handle.agent.session.id)
      drained = entries.length
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw recursiveDrainUnavailable(
        sid,
        drainFailed ? `the drain failed and the descendant listing rejected: ${detail}` : `the descendant listing rejected: ${detail}`,
      )
    }
    if (drainFailed) return { drained, quiescent: false }
    return { drained, quiescent: true }
  }

  const residency = {
    has(sessionId) { return liveAgents.has(String(sessionId)) },
    // alias: the frozen port name
    hasResidency(sessionId) { return liveAgents.has(String(sessionId)) },
    dropResidency(sessionId) {
      const sid = String(sessionId)
      const handle = liveAgents.get(sid)
      if (handle === undefined) return false // the handle may be absent: no-op by contract
      liveAgents.delete(sid)
      // The sync port cannot await: the public handle dispose (stop the
      // loop, unregister, remove the session from the store) proceeds
      // in flight. Quiescence was already observed at the previous step,
      // so no model-visible write can follow the unregister.
      handle.dispose().catch((error) => {
        observations.push(`p6t6: residency dispose failed for '${sid}': ${error instanceof Error ? error.message : String(error)}`)
      })
      return true
    },
  }

  return {
    interrupt,
    drainDescendants,
    residency,
  }
}
