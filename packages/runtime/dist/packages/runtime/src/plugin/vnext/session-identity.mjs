/**
 * session-identity.mjs — who a session IS, and whether it may be brought back.
 *
 * EXTRACTED FROM agent-bindings.mjs (2026-11-22, external architecture review, plan S1). This is the
 * glue's A4 region plus the two maps it kept beside it. It is a leaf: it reads the open domain and the
 * session-persistence seam and answers questions. It never touches live handles, consumption state,
 * persona, MCP, delivery or the row-stop gate.
 *
 * WHAT IT OWNS (and nothing else may write):
 *  - the derived child session id (the idempotency contract: same root+instance pair -> same child,
 *    across restarts);
 *  - durable existence, instance and owner resolution over the public repositories;
 *  - the DURABLE LIFECYCLE gate at every resurrection seam (ARCHIVED/DISPOSED is refused: an explicit
 *    restore is required; residency is volatile and cannot answer this);
 *  - the in-process ADMISSION CLOSE (the drop->commit window in which the durable row still reads
 *    SETTLED, so only an in-process close can refuse);
 *  - the boot-publish marker recorded when a lifecycle procedure reopens a child that went terminal in
 *    this process, which buys exactly ONE durable read at the boot publish seam.
 *
 * All five questions are about ONE session, and getting any of them wrong resurrects a member that was
 * meant to be gone - which is why they are one component instead of nine functions in a 5,000-line
 * closure. Error messages keep their `session-identity:` prefix (they read `agent-bindings:` before);
 * the message TEXT is otherwise unchanged and the codes are the frozen vocabulary.
 *
 * @module packages/runtime/src/plugin/vnext/session-identity
 */

import { createHash } from 'node:crypto'
import { resolveOwningTeamRoot } from '../team-session-ownership.js'

/**
 * @param {object} input
 * @param {object} input.domain - the open TeamDomain (member rows are read from its repositories).
 * @param {string} input.bootRootSessionId - this row's boot root (`config.rootSessionId`).
 * @param {{exists?: (id: string) => Promise<boolean>}} input.sessionPersistence - the public
 *   session-persistence seam (a missing `exists` is a typed refusal, never a silent "not durable").
 * @param {string} [input.leaderInstanceId] - the leader instance id (contracts' LEADER_INSTANCE_ID).
 * @returns {object} the nine session questions plus the two boot-marker accessors.
 */
export function createSessionIdentity ({
  domain,
  bootRootSessionId,
  sessionPersistence,
  leaderInstanceId = 'inst-leader',
}) {
  if (domain === null || typeof domain !== 'object' || typeof domain.repositories?.memberInstances?.list !== 'function') {
    throw new TypeError('session-identity: the open domain must expose repositories.memberInstances.list')
  }
  const rootSid = bootRootSessionId

  /**
   * @type {Map<string, {instanceId: string, rootSessionId: string}>} the
   * per-member ADMISSION CLOSE (the archive/dispose race close, row 6).
   *
   * The lifecycle Archive/Dispose procedure is: close admission → interrupt →
   * drain → wait quiescence → release residency → COMMIT the durable
   * transition (quiesce.ts:143-152; archive.ts:141-151). Its quiesce drops
   * residency BEFORE the commit, so the drop→commit window is a real interval
   * in which the durable row still reads SETTLED and a dispatch would be
   * legally cold-resumed — the in-process half of that window is what this map
   * closes (DevPlan §20.3 step 1: "no new work may be admitted"). Keyed by the
   * member's child session id, the same key `liveAgents` uses.
   *
   * Lifetime = the procedure, not the durable state: the procedure's caller
   * reopens it on EVERY exit (quiesce.ts `reopenAdmission`), and the durable
   * lifecycle gate (SEAM 1) then refuses the ARCHIVED/DISPOSED member. A
   * restore is a durable transition that happens while nothing is closed.
   */
  const newWorkClosed = new Map()
  /**
   * SEAM 6 (the boot PUBLISH window): the durable lifecycle state a lifecycle
   * procedure last OBSERVED when it reopened this child's admission.
   *
   * Why the admission close alone is not enough at a boot publish. The
   * procedure reopens admission in its `finally`, i.e. AFTER the durable
   * commit and after the post-commit residency re-drop. A boot resume that
   * resolves after that point therefore sees an OPEN admission map while the
   * durable row is already ARCHIVED — the exact interval in which the old
   * SEAM 5 passed and published a resident handle for an archived member
   * (`ensureLiveAgent`'s fast path then serves it BEFORE any gate, and
   * `executeTool`'s last-moment check consults only this map, never the
   * durable row: a mid-boot dispatch executed a tool on an ARCHIVED member —
   * BS4). `reopenAdmission` already enumerates the row to find the child, so
   * it records that row's lifecycle here for free; a terminal state leaves a
   * marker, a restore (or an aborted procedure) clears it.
   *
   * Cost: the marker itself is in-memory (zero durable reads). A marker HIT
   * buys exactly ONE durable read at the boot publish seam — the member is
   * already known to have gone terminal once in this process, and only the
   * durable row can tell whether a restore has since re-admitted it. Normal
   * boots (no marker) pay nothing, so the boot budget stays "one member-set
   * enumeration + at most one sweep".
   *
   * Lifetime: until a lifecycle procedure observes a non-terminal row (or the
   * binding closes). A stale marker is safe in both directions — it can only
   * cause one extra durable read, and the read is the authority.
   */
  const terminalAtReopen = new Map()

  // ── the durable-mutation consumption boundary (ported) ─────────────────

  /**
   * The deterministic child session id for one (root session, instance)
   * pair — the factory idempotency contract: same pair -> same child id,
   * across restarts (the derivation is stateless; a re-driven activation
   * re-derives the SAME id, never a second child). T12-B2: the identity
   * input is the PAIR, never the instance id alone — the same instanceId
   * under a different root gets a different child.
   *
   * Canonical tuple `${rootSessionId}\u0000${instanceId}` -> SHA-256 ->
   * first 32 hex chars: fixed-length, stable, no random UUID. The NUL
   * separator removes the concatenation ambiguity.
   * @param {string} rootSessionId - the team root session id.
   * @param {string} instanceId - an `inst-`-prefixed instance id.
   * @returns {string} the derived child session id.
   */
  function childSessionIdFor(rootSessionId, instanceId) {
    const digest = createHash('sha256')
      .update(`${String(rootSessionId)}\u0000${String(instanceId)}`, 'utf8')
      .digest('hex')
    return `session-team-child-${digest.slice(0, 32)}`
  }

  /**
   * C1 (restart-recovery, guide §5.2): whether a session has a durable
   * existence — the cold-resume eligibility check, read through the PUBLIC
   * session-persistence seam (`sessionPersistence.exists`) INSTEAD of the
   * pre-C1 physical `DSH_HOME` layout probe (which is deleted: it guessed
   * on disk — env-dependent, backend-layout-dependent, and blind to the
   * backend's own view). `exists` is the host wrapper's
   * `stat(id) !== undefined` (guide §5.1 — no ownership claim, no backend
   * assumption; the upstream backend is the single authority on whether
   * the session is resumable).
   *
   * FAIL-CLOSED discipline (guide §5.2 + test D4): if the seam is ABSENT
   * (a world without the host's sessionPersistence wrapper) this throws a
   * TYPED error — it never silently degrades to "not durable", and a
   * backend FAULT (stat throwing) PROPAGATES unchanged — a fault must
   * never be misread as a nonexistent session (test D4).
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async function durableSessionExists(sessionId) {
    if (typeof sessionPersistence?.exists !== 'function') {
      throw new Error(
        'agent-bindings: sessionPersistence.exists public seam is unavailable',
      )
    }
    return await sessionPersistence.exists(String(sessionId))
  }

  /**
   * The durable instance binding for one session (the root embodies the
   * leader instance; every other live session is a bound member child).
   * @param {string} sessionId
   * @param {string} [teamRootSid] - the team root the session belongs to
   *   (T12-GLUE: the row's domain hosts every team root of the row — the
   *   handoff target is a NEW team root; absent = this row's boot root, as
   *   before).
   * @returns {string} the clean instance id.
   */
  function instanceIdForSession(sessionId, teamRootSid) {
    const teamRoot = teamRootSid !== undefined ? String(teamRootSid) : rootSid
    if (sessionId === teamRoot) return String(leaderInstanceId)
    const members = domain.repositories.memberInstances.list(teamRoot)
    for (const member of members) {
      if (String(member.childSessionId) === sessionId) return String(member.instanceId)
    }
    throw new Error(`p6t6 consumption: no team instance for session '${sessionId}'`)
  }

  /**
   * TCM-D4: the team root that OWNS one session of this row's domain —
   * resolved from the public durable repositories (never a caller claim,
   * never the boot root by default):
   *
   *   1. the boot root owns itself;
   *   2. a session that carries its own durable TeamSession row IS a team
   *      root of this row (a freshly created TeamSession / team-root
   *      binding — the row's domain hosts every team root, T12-GLUE) and
   *      owns itself;
   *   3. a bound member child is owned by the root whose member list
   *      carries it — the boot root first (its TeamSession row may be
   *      absent in older worlds), then the other team roots of the domain.
   *
   * `undefined` when no ownership can be established: the callers then
   * fail closed exactly as before (the boot root is NOT a fallback for
   * unknown sessions).
   * @param {string} sessionId
   * @returns {string|undefined} the owning root session id
   */
  function teamRootOfSession(sessionId) {
    // C1 (restart-recovery, guide §3.2): a THIN WRAPPER over the ONE
    // ownership authority (the same pure function the host-side
    // activation fence consumes — no second traversal of the durable
    // repositories; the semantics are preserved verbatim:
    //   1. the boot root owns itself;
    //   2. a session with its own durable TeamSession row IS a team root
    //      of this domain and owns itself;
    //   3. a bound member child is owned by the root whose member list
    //      carries it (the boot root first, then the other team roots);
    //   4. unresolved -> undefined (the boot root is NOT a fallback).
    return resolveOwningTeamRoot(domain, rootSid, sessionId)
  }

  /**
   * THE one durable MEMBER-ROW ENUMERATION of a boot (SEAM 4, the boot-race
   * fix): the boot resume loop reads the whole member set once here, and the
   * post-loop sweep re-enumerates it once here. Naming the read is what keeps
   * the budget checkable — `boot-seam-arms.test.mjs` BS3 counts the calls and
   * requires TWO for any member count, so a future per-member re-read breaks
   * the test instead of silently rotting the property.
   * @param {string} teamRoot the boot root whose member rows are enumerated.
   * @returns {object[]} the durable rows (the open domain's in-memory view).
   */
  function listMemberRows(teamRoot) {
    return domain.repositories.memberInstances.list(String(teamRoot))
  }

  /**
   * The DURABLE-LIFECYCLE gate at every resurrection seam (row 6 / BL-16).
   *
   * The frozen Architecture is the authority, not residency:
   *   - §41.6: the ONLY edge out of ARCHIVED is Restore; a cold resume
   *     follows a NEW follow-up in SETTLED, never a resume while ARCHIVED;
   *   - §30.2: Restore returns ARCHIVED → SETTLED and must NOT
   *     create/resume live Agent residency merely for restore;
   *   - §29.4: ARCHIVED leaves the active work set while retaining the
   *     child Session/transcript and the restore capability.
   * The archive quiesce drops process-local residency (`quiesce.ts` step 5 →
   * `residency.dropResidency`), so residency cannot answer this question: a
   * later `ensureLiveAgent`/boot resume would simply materialize the durable
   * session again (the measured row-6 defect). The durable MemberInstance row
   * is read here instead, at the seam, before any resume.
   *
   * Scope: every Member, permission-governed or not — "the durable lifecycle
   * binds every resurrection seam, for every Member" (the ruling). The leader
   * / team-root path is untouched: a root owns itself and has no
   * MemberInstance row (archive/dispose never address it).
   *
   * Cost: this read is NOT on the steady-state tool path — `ensureLiveAgent`
   * returns the resident handle before `ensureLiveAgentOnce` runs, so a live
   * Agent pays nothing. The read happens once per COLD RESUME (and once per
   * member per boot), which already loads the session; `list()` is the
   * in-memory durable-domain snapshot (`StorageKvTable.get` reads memory), so
   * no new durable I/O is added. `memberRows` lets the boot loop reuse the
   * list it already holds.
   *
   * @param {string} sessionId - the session a seam is about to resurrect.
   * @param {string|undefined} teamRoot - its owning team root (undefined =
   *   unowned: that seam keeps its own fail-closed error).
   * @param {object[]} [memberRows] - the already-read rows of `teamRoot`.
   * @returns {Error|null} the typed refusal, or null when the resume may run.
   */
  function memberResumeRefusal(sessionId, teamRoot, memberRows) {
    const sid = String(sessionId)
    if (teamRoot === undefined || teamRoot === null || String(teamRoot) === sid) return null
    const rows = memberRows !== undefined
      ? memberRows
      : domain.repositories.memberInstances.list(String(teamRoot))
    const row = rows.find((member) => String(member?.childSessionId) === sid)
    const state = String(row?.lifecycle ?? '')
    if (state !== 'ARCHIVED' && state !== 'DISPOSED') return null
    const refusal = new Error(
      `session-identity: session '${sid}' belongs to a ${state} MemberInstance — an explicit restore is required before any cold resume (the durable lifecycle is the authority; residency is volatile; Architecture §41.6/§30.2/§29.4)`,
    )
    refusal.code = state === 'ARCHIVED'
      ? 'PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED'
      : 'PERMISSION_LIFECYCLE_EXECUTION_TERMINAL'
    return refusal
  }

  /**
   * Is new-work admission CLOSED for this session (a lifecycle quiesce is in
   * progress)? The in-process half of the archive/dispose boundary.
   *
   * Ordering (why this exists on top of the durable gate): the durable gate
   * reads the row, and during the drop→commit window the row still says
   * SETTLED — the durable write has not happened yet. Refusing a dispatch
   * there is not the durable transition's job; it is the admission close's
   * (DevPlan §20.3 step 1, Architecture §30.1). Without it a dispatch can
   * cold-resume inside the window and the handle then outlives the commit
   * (`liveAgents` is consulted before the durable gate).
   *
   * The typed code is deliberately NOT a member of the frozen
   * `PERMISSION_LIFECYCLE_ERROR_CODES` vocabulary: that vocabulary describes
   * overlay/mutation refusals over a durable lifecycle state, and this refusal
   * is about a transient in-process procedure. `executeTool` maps it to the
   * route's NO_LIVE_AGENT/422 like every other ensure-live refusal.
   * @param {string} sessionId - the session a live handle would be made for.
   * @returns {Error|null} the typed refusal, or null when admission is open.
   */
  function admissionCloseRefusal(sessionId) {
    const sid = String(sessionId)
    const closed = newWorkClosed.get(sid)
    if (closed === undefined) return null
    const refusal = new Error(
      `session-identity: new-work admission is CLOSED for session '${sid}' — instance '${closed.instanceId}' of team '${closed.rootSessionId}' is being archived/disposed in this process (close-admission → interrupt → drain → quiesce → release residency → commit; Architecture §30.1), so no live handle may be created or used until the transition has committed`,
    )
    refusal.code = 'LIFECYCLE_ADMISSION_CLOSED'
    return refusal
  }

  /**
   * Close new-work admission for one member (the real in-process binding of
   * the lifecycle `AdmissionClosePort` step 1; the production root wires it as
   * `admission.closeNewWork`). The child session is resolved from the DURABLE
   * row — never from the request — so the close lands on exactly the key
   * `liveAgents` uses.
   * @param {{rootSessionId?: unknown, instanceId?: unknown}} target
   * @returns {boolean} whether a live key was closed (false = no durable row).
   */
  function closeAdmission(target) {
    const instanceId = String(target?.instanceId ?? '')
    const rootSessionId = target?.rootSessionId
    if (instanceId === '' || rootSessionId === undefined || rootSessionId === null) return false
    const row = domain.repositories.memberInstances
      .list(String(rootSessionId))
      .find((member) => String(member?.instanceId) === instanceId)
    const child = row?.childSessionId
    if (typeof child !== 'string' || child.length === 0) return false
    newWorkClosed.set(child, Object.freeze({ instanceId, rootSessionId: String(rootSessionId) }))
    return true
  }

  /**
   * Reopen new-work admission after the lifecycle procedure exits (its
   * counterpart in `quiesce.ts`). Idempotent: an unknown/never-closed member
   * is a no-op. The durable state is the authority from here on — an ARCHIVED
   * / DISPOSED row is refused by {@link memberResumeRefusal}, a restored row
   * resumes normally.
   * @param {{rootSessionId?: unknown, instanceId?: unknown}} target
   * @returns {boolean} whether a previously closed key was reopened.
   */
  function reopenAdmission(target) {
    const instanceId = String(target?.instanceId ?? '')
    const rootSessionId = target?.rootSessionId
    if (instanceId === '' || rootSessionId === undefined || rootSessionId === null) return false
    const row = domain.repositories.memberInstances
      .list(String(rootSessionId))
      .find((member) => String(member?.instanceId) === instanceId)
    const child = row?.childSessionId
    if (typeof child !== 'string' || child.length === 0) return false
    // SEAM 6: the procedure's exit is the ONE moment the row's post-transition
    // lifecycle is already enumerated here for free. A terminal state becomes
    // the boot-publish marker; anything else (an aborted procedure, a restore)
    // clears it.
    const state = String(row?.lifecycle ?? '')
    if (state === 'ARCHIVED' || state === 'DISPOSED') terminalAtReopen.set(child, state)
    else terminalAtReopen.delete(child)
    return newWorkClosed.delete(child)
  }


  /** The boot-publish marker for one child (undefined = no lifecycle procedure closed it). */
  function terminalMarkerOf (childSessionId) {
    return terminalAtReopen.get(String(childSessionId))
  }

  /** Drop the boot-publish marker for one child (a restore, or an aborted procedure). */
  function clearTerminalMarker (childSessionId) {
    return terminalAtReopen.delete(String(childSessionId))
  }

  return {
    childSessionIdFor,
    durableSessionExists,
    instanceIdForSession,
    teamRootOfSession,
    listMemberRows,
    memberResumeRefusal,
    admissionCloseRefusal,
    closeAdmission,
    reopenAdmission,
    terminalMarkerOf,
    clearTerminalMarker,
  }
}
