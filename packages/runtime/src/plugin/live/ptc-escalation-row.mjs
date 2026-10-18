/**
 * alpha5 PTC fs half-arm — THE ESCALATION ADJUDICATION ROW (work order
 * 10:04Z; the row-shaped productization of the reviewed L2 demo line
 * `evidence/alpha5/w-ptc-outerfs/a5ptc4c-grantrow.mjs`, whose L1/L2 reviews
 * proved the semantics; the demo's assembler-private 0600 IPC channel and
 * HTTP faces DISAPPEAR here — the production row lives INSIDE the install
 * process, its roster is the Team lifecycle itself, and every face it opens
 * disposes through the existing `toolDisposers` drain (S5).
 *
 * SEMANTICS (six legs, per the read-only diagnostic):
 *  S1 the row listens to the host `approval/request` waterfall (public:
 *     api-catalog :3921 ON THE PINNED HOST (measured; the work order's
 *     ":3852" is that file's entry-field offset, not the line) —
 *     `Scoped<Agent>`, "return an outcome to claim,
 *     call next() to delegate"). A request this row does not OWN (no
 *     governed member, or a reason outside the escalation prefix) is
 *     delegated to `next()` UNTOUCHED — zero state written. The router
 *     installs ONCE, global+prepend, at host.ts install (the activation-
 *     fence line at :1115 is the precedent); the per-member `installOn`
 *     face exists for scoped installs and the synthetic leg.
 *  S2 the ask shape `{agent, toolName, callId, reason}` is the host
 *     escalation approver face; the reason carries the mode prefix,
 *     VERBATIM format `escalate sandbox to <mode>: …` (measured at the
 *     pinned host packages/sandbox/sandbox/lib/index.js:109 — the work
 *     order's "escalation.js:122" is the same site at a different source
 *     offset; cited as measured). The row adapts it to PR2 {@link
 *     MintInputs}: server-derived fields only, mode bound into the
 *     parametersFingerprint (a replay under a different mode is a
 *     fingerprint refusal, never a re-approval).
 *  S3 approval is the DURABLE ladder already in production — the row
 *     speaks the EXACT pre-execute-adapter.ts:1822-1868 request shape
 *     (`requestControl` kind `user-approval` for the leader,
 *     `leader-approval` for a member; `awaitControlDecision` is the
 *     liveness bridge over the durable rows). Only `decision === 'allow'`
 *     mints; abort is `cancelled`, anything else is `rejected`.
 *  S4 one assembly per owning team root (the pc-CONTRACT §3
 *     per-root live-assembly precedent);
 *     the boot census row (members, faces, adjudication counters, and the
 *     CONFIG-DECLARED selectedRunner/enforcement the glue passes from the
 *     row config — never an OS probe, never a guess) books after boot.
 *  S5 zero 0600 channel, zero HTTP: in-process registration, idempotent
 *     disposers on the caller's drain list; an unregistered member is not
 *     routable, and its unconsumed grants die with the roster entry.
 *     LIFECYCLE-FIX ROUND (live run live-2026-10-18T12-55-53): the drain
 *     is the ROW-STOP BACKSTOP only — the member lifecycle itself rides the
 *     RESIDENCY lifecycle: the router mirrors the host's public
 *     `agent/disposed` event (drop entry + revoke face, idempotent), every
 *     ask is gated on the member handle's routability (live + the injected
 *     residency oracle), and a same-session re-mount REPLACES the stale
 *     face instead of throwing (one LIVE face per session; the shipped
 *     "already registered" refusal made the production entry unrecoverable
 *     — U-2's 422).
 *  S6 the scope gate lives in the CALLER (agent-bindings :2412 — the
 *     `permissionPolicy !== undefined && config.teamToolPlane` face): a
 *     non-Team install never registers anything, the router is then an
 *     empty map, and every ask delegates verbatim — zero-diff by
 *     construction, not by a runtime branch.
 *
 * GRANT DISCIPLINE: minting goes through {@link mintOperationGrant} (the
 * frozen PR0 grammar re-parse) and consumption through {@link
 * createGrantLedger}.consume — validate-then-mark in ONE synchronous step,
 * the PR0 precedence untouched (identity → realm → generation → revision →
 * fingerprint → expiry → consumption LAST). This module adds NOTHING to
 * the kernel and re-spells no law: the five negative controls
 * (replay / expiry / other-team / revocation-before-use / mode binding)
 * all grade through the real ledger. The `grantsState` mirror is
 * OBSERVABILITY ONLY (never authority), same as every prior row's ledger.
 *
 * Purity: no module-level state; no timers; the clock is injected.
 *
 * @module runtime/plugin/live/ptc-escalation-row
 */
import { createHash } from 'node:crypto'
import { mintOperationGrant, createGrantLedger } from '../../../tool-admission/grant-mint.js'
import { parseRequestedEffectSet } from '../../../../domain/tool-governance/src/index.js'

/** The pinned-host escalation vocabulary (SandboxMode, index.d.ts:19). */
export const PTC_ESCALATION_MODES = Object.freeze(['read-only', 'workspace-write', 'danger-full-access'])
const ESCALATION_PREFIX = 'escalate sandbox to '
/** The durable approval action name — the SAME constant the pre-execute
 *  adapter registers ('parameter-permission', pre-execute-adapter.ts:685). */
const ACTION_NAME = 'parameter-permission'

/** The host reason face measured at lib/index.js:109. Pure; exported for
 *  the router/tests; returns the mode or null (never a guess). */
export function parseEscalationReason(reason) {
  if (typeof reason !== 'string' || !reason.startsWith(ESCALATION_PREFIX)) return null
  const colon = reason.indexOf(':', ESCALATION_PREFIX.length)
  if (colon < 0) return null
  const mode = reason.slice(ESCALATION_PREFIX.length, colon).trim()
  return PTC_ESCALATION_MODES.includes(mode) ? mode : null
}

function fingerprintOf(member, callId, toolName, mode, reason) {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify([member.teamSessionId, member.instanceId, callId, toolName, mode, reason ?? '']))
    .digest('hex')}`
}

/**
 * The router: the host-level install line installs this ONCE (global +
 * prepend, the activation-fence precedent at host.ts:1115); the
 * agent-bindings gate registers/unregisters AGENT identities into it.
 * An empty router (the non-Team world, S6) delegates EVERY request to
 * next() without touching state.
 *
 * LIFECYCLE-FIX ROUND (live run live-2026-10-18T12-55-53, U-1/U-1b/U-2):
 * the member lifecycle rides the RESIDENCY lifecycle, not the row-stop
 * drain. (a) {@link onAgentDisposed} mirrors the host's public
 * `agent/disposed` event (the same fire-and-forget face the activation
 * fence consumes, host.ts :1164): the disposed Agent's routing entry dies
 * with it AND its member face is revoked — idempotent, entry-identity
 * guarded (a late event for a replaced generation drops ONLY the stale
 * entry). (b) {@link route} asks the registered member HANDLE whether it
 * is still routable (live + resident) BEFORE adjudicating: a residency
 * drop is synchronous at the port (liveAgents.delete precedes the async
 * dispose), so the very next ask delegates through next() with zero state
 * — the pre-round host chain owns it (the measured fail-closed landing).
 * The entries key on the member HANDLE (the registerMember result), not
 * the shared memberKey, so a re-mounted session's stale Agent can never
 * route into the new generation.
 */
export function createPtcEscalationRouter() {
  const byAgent = new Map()
  const byAgentId = new Map()
  /** Drop one EXACT entry from every key that still maps to it (identity-
   *  guarded: an id re-registered by a newer generation is never touched). */
  const dropEntry = (entry) => {
    if (entry.agent !== null && byAgent.get(entry.agent) === entry) byAgent.delete(entry.agent)
    if (entry.id !== null && byAgentId.get(entry.id) === entry) byAgentId.delete(entry.id)
  }
  return {
    /** Register one governed member's agent identity → its row. `member` is
     *  the {@link createPtcEscalationRowAssembly} registerMember HANDLE (the
     *  identity carrier: memberKey + revoke + isRoutable). Returns an
     *  IDEMPOTENT unregister. Identity joins on the Agent object AND its id
     *  (when the host supplies one); an agent neither key knows is NOT us. */
    registerAgent(agent, member, assembly) {
      const hasAgent = agent !== null && typeof agent === 'object'
      const entry = {
        member,
        assembly,
        agent: hasAgent ? agent : null,
        id: hasAgent && agent.id !== undefined ? String(agent.id) : null,
      }
      if (entry.agent !== null) byAgent.set(entry.agent, entry)
      if (entry.id !== null) byAgentId.set(entry.id, entry)
      let done = false
      return () => {
        if (done) return
        done = true
        dropEntry(entry)
      }
    },
    resolve(reqAgent) {
      if (reqAgent !== null && typeof reqAgent === 'object') {
        const direct = byAgent.get(reqAgent)
        if (direct !== undefined) return direct
        if (reqAgent.id !== undefined) return byAgentId.get(String(reqAgent.id)) ?? null
      }
      return null
    },
    /** The waterfall listener body. Never throws: any adjudication crash
     *  fails CLOSED as 'unavailable' (a governed ask must never fall
     *  through to a UI answerer because the row broke). A member that is
     *  not routable (torn-down face, dropped residency) is NOT owned: the
     *  ask delegates through next() UNTOUCHED — zero state, zero durable
     *  request, exactly the pre-round chain's territory (U-1/U-1b). */
    async route(req, next) {
      const hit = this.resolve(req?.agent)
      if (hit === null) return await next()
      try {
        if (typeof hit.member.isRoutable === 'function' && hit.member.isRoutable() !== true) return await next()
        return await hit.assembly.adjudicate(hit.member.memberKey, req, next)
      } catch {
        return 'unavailable'
      }
    },
    /** The public `agent/disposed` mirror (host.ts installs the listener,
     *  the activation-fence :1164 precedent; fire-and-forget — this face
     *  NEVER throws outward). Drops the disposed Agent's entry and revokes
     *  its member face (unconsumed grants die with it, the census stays
     *  honest). Returns true only when THIS agent's own entry was dropped;
     *  every repeat is a false no-op (idempotent by entry identity). */
    onAgentDisposed(agent) {
      try {
        if (agent === null || typeof agent !== 'object') return false
        const entry = byAgent.get(agent)
        if (entry === undefined || entry.agent !== agent) return false
        dropEntry(entry)
        try {
          if (typeof entry.member.revoke === 'function') entry.member.revoke()
        } catch {
          /* the disposal mirror never fails the host's teardown */
        }
        return true
      } catch {
        return false
      }
    },
    liveCount: () => byAgent.size,
  }
}

/**
 * Create ONE escalation assembly for ONE team root.
 * `deps`: `{ rootSessionId, getControlService, ttlMs?, now, nextGrantId?,
 * onObserve? }` — the clock and the grant-id source are injected (the row
 * owns no clock; ids come from the caller's durable sequence when present).
 */
export function createPtcEscalationRowAssembly(deps) {
  const rootSessionId = String(deps?.rootSessionId ?? '')
  if (rootSessionId === '') throw new TypeError('createPtcEscalationRowAssembly: rootSessionId is required')
  const getControlService = deps.getControlService
  const now = typeof deps.now === 'function' ? deps.now : () => Date.now()
  const ttlMs = deps.ttlMs === null || deps.ttlMs === undefined ? 60_000 : Number(deps.ttlMs)
  const onObserve = typeof deps.onObserve === 'function' ? deps.onObserve : () => {}
  let seq = 0
  const nextGrantId = typeof deps.nextGrantId === 'function'
    ? deps.nextGrantId
    : () => `a5ptcesc:${rootSessionId}:${String(++seq)}`

  const ledger = createGrantLedger()
  const members = new Map()
  const byKey = new Map() // `${instanceId}\u0000${callId}` -> minted grant fact
  const grantStates = new Map() // observability mirror ONLY
  const adjudications = { asks: 0, allowedOnce: 0, refused: 0, passthrough: 0 }
  let boot = null

  const callContext = (member, fact, mode, reason) => ({
    now: now(),
    currentAuthorityGeneration: 1,
    member: member.ref,
    callId: fact.callId,
    realmId: member.realmId,
    bindingId: fact.bindingId,
    bindingRevision: 1,
    parametersFingerprint: fingerprintOf(member.ref, fact.callId, fact.toolName, mode, reason),
    requestedEffects: fact.effects,
  })

  return {
    /**
     * Register one governed member's face for this root.
     * LIFECYCLE-FIX ROUND (U-2): the same (root, session) re-entering is a
     * RESIDENCY re-entry (cold resume / re-mount after a teardown), and it
     * REPLACES the stale face instead of throwing — the invariant
     * "one face per session" means one LIVE face per session at every
     * instant, never a permanent lock-out of a recoverable member. The
     * stale face dies first through its own idempotent revoke (roster entry
     * gone, minted-but-unused grants marked revoked-before-use).
     * `isResident` (optional): the injected residency oracle — the glue
     * passes the SYNC `residency.has` port, the synchronous fact behind
     * dropResidency (the sync port / the archive quiesce step do not await
     * the Agent dispose, so the ask-time gate, not the disposed event, is
     * what makes the drop race-free). Absent = pure row, always resident.
     */
    registerMember({ sessionId, instanceId, realmId, isLeader, isResident }) {
      const memberKey = `${rootSessionId}\u0000${String(sessionId)}`
      const previous = members.get(memberKey)
      if (previous !== undefined && typeof previous.revoke === 'function') {
        previous.revoke()
        onObserve({ event: 'member-replaced', root: rootSessionId, session: String(sessionId) })
      }
      const member = {
        memberKey,
        ref: Object.freeze({ teamSessionId: rootSessionId, instanceId: String(instanceId) }),
        realmId: String(realmId),
        isLeader: isLeader === true,
        live: true,
      }
      members.set(memberKey, member)
      onObserve({ event: 'member-registered', root: rootSessionId, session: String(sessionId) })
      const revoke = () => {
        if (!member.live) return
        member.live = false
        // IDENTITY-guarded (lifecycle-fix round): a LATE revoke for a
        // replaced generation must never evict the NEW member under the
        // shared key — only the member that still OWNS the key is deleted.
        if (members.get(memberKey) === member) members.delete(memberKey)
        // S5: an unregistered member's unconsumed grants die with it — the
        // mirror records the death; the ledger keeps its one durable fact.
        // Facts die by GENERATION identity (same instanceId across resumes
        // shares the byKey spelling; the generations do not share fates).
        for (const [k, fact] of byKey.entries()) {
          if (fact.memberGeneration === member && grantStates.get(fact.grantId) === 'minted') {
            grantStates.set(fact.grantId, 'revoked-before-use')
            byKey.delete(k)
          }
        }
        onObserve({ event: 'member-revoked', root: rootSessionId, session: String(sessionId) })
      }
      // The roster entry carries its own revoke (the replace path of a
      // re-mount reaches the stale GENERATION's closure through the map;
      // the closure itself stays identity-guarded, so a late revoke of a
      // replaced face can never evict the new one).
      member.revoke = revoke
      return {
        memberKey,
        revoke,
        /** ROUTABILITY (lifecycle-fix round, the U-1/U-1b gate): this face
         *  routes only while it is the live generation AND the injected
         *  residency oracle still claims the session. Read-only, never
         *  writes state. */
        isRoutable() {
          if (!member.live) return false
          if (typeof isResident === 'function' && isResident() !== true) return false
          return true
        },
        /** Scoped install face: `ctxLike.on('approval/request', h)` must
         *  return a disposer; production installs through the global
         *  router — this face serves scoped hosts and the synthetic leg. */
        installOn(ctxLike) {
          if (ctxLike === null || typeof ctxLike?.on !== 'function') {
            throw new TypeError('ptc-escalation-row.installOn: the ctx face requires on(event, listener)')
          }
          const off = ctxLike.on('approval/request', (req, next) => this.adjudicate(memberKey, req, next))
          let done = false
          return () => {
            if (done) return
            done = true
            if (typeof off === 'function') off()
            revoke()
          }
        },
      }
    },

    async adjudicate(memberKey, req, next) {
      const member = members.get(memberKey)
      if (member === undefined) throw new TypeError(`ptc-escalation-row: unknown memberKey '${String(memberKey)}' (unroutable = never adjudicate)`)
      adjudications.asks++
      const mode = parseEscalationReason(req?.reason)
      if (mode === null) {
        // S1 untouched delegation — this is not an escalation ask.
        adjudications.passthrough++
        return await next()
      }
      const callId = req?.callId === undefined || req?.callId === null || req?.callId === '' ? null : String(req.callId)
      const toolName = String(req?.toolName ?? '')
      if (callId === null || toolName === '') {
        // An escalation WITHOUT its one-shot identity cannot be bound —
        // claim it and fail closed; delegating would hand a governed
        // escalation to an answerer with no grant story.
        adjudications.refused++
        onObserve({ event: 'ask-unbound', root: rootSessionId, memberKey })
        return 'unavailable'
      }
      const key = `${member.ref.instanceId}\u0000${callId}`
      const fact = byKey.get(key)
      if (fact !== undefined) {
        // one-shot edge: the grant exists for this (member, callId). The
        // ONLY lawful consumption is the kernel's — replay hits the
        // CONSUMED mark, mode drift hits the fingerprint, late hits
        // expiry (the frozen precedence does the grading, not this row).
        const out = ledger.consume(fact.grantId, callContext(member, fact, mode, req?.reason))
        const okOnce = out.ok === true
        // The mirror never DOWNGRADES a consumed fact: the durable truth
        // (this grant was consumed once) stays readable; the refusal rides
        // the observation, never the state.
        if (okOnce) grantStates.set(fact.grantId, 'consumed')
        else if (grantStates.get(fact.grantId) !== 'consumed') grantStates.set(fact.grantId, `refused:${String(out.reason)}`)
        // The fact STAYS (no delete): after its single use the entry is the
        // replay-detection face — a re-ask meets the ledger's CONSUMED mark
        // here instead of opening a fresh durable approval.
        if (okOnce) adjudications.allowedOnce++
        else adjudications.refused++
        onObserve({ event: okOnce ? 'allowed-once' : 'refused', root: rootSessionId, memberKey, callId, mode, reason: okOnce ? null : String(out.reason) })
        return okOnce ? 'allowed-once' : 'rejected'
      }
      const svc = typeof getControlService === 'function' ? getControlService() : undefined
      if (
        svc === undefined || svc === null ||
        typeof svc.requestControl !== 'function' ||
        typeof svc.awaitControlDecision !== 'function'
      ) {
        // Fail CLOSED: a governed escalation with no durable approval path
        // is answered 'unavailable' (host callers fail closed on it) —
        // never a silent next() past the row.
        adjudications.refused++
        onObserve({ event: 'no-control-service', root: rootSessionId, memberKey })
        return 'unavailable'
      }
      const fingerprint = fingerprintOf(member.ref, callId, toolName, mode, req?.reason)
      let record
      try {
        record = await svc.requestControl({
          rootSessionId,
          caller: { kind: 'instance', instanceId: member.ref.instanceId },
          kind: member.isLeader ? 'user-approval' : 'leader-approval',
          targetInstanceId: member.ref.instanceId,
          actionName: ACTION_NAME,
          toolName,
          correlation: callId,
          operationFingerprint: fingerprint,
          summary: `a5ptc escalation: ${toolName} -> ${mode} (call ${callId})`,
        })
      } catch (error) {
        adjudications.refused++
        onObserve({ event: 'request-failed', root: rootSessionId, memberKey, callId, detail: String(error?.message ?? error).slice(0, 160) })
        return 'rejected'
      }
      let decisionRecord
      try {
        decisionRecord = await svc.awaitControlDecision({ rootSessionId, requestId: record.requestId, signal: req?.signal })
      } catch (error) {
        const aborted = String(error?.code ?? '') === 'CONTROL_WAIT_ABORTED'
        if (aborted) {
          adjudications.refused++
          onObserve({ event: 'ask-cancelled', root: rootSessionId, memberKey, callId })
          return 'cancelled'
        }
        adjudications.refused++
        onObserve({ event: 'wait-failed', root: rootSessionId, memberKey, callId, detail: String(error?.message ?? error).slice(0, 160) })
        return 'rejected'
      }
      if (decisionRecord?.decision !== 'allow') {
        // NC-4: a denied/anything-but-allow durable decision mints NOTHING.
        adjudications.refused++
        onObserve({ event: 'decision-not-allow', root: rootSessionId, memberKey, callId, decision: String(decisionRecord?.decision ?? 'absent') })
        return 'rejected'
      }
      const effects = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName, resource: null }])
      if (effects.ok !== true) {
        adjudications.refused++
        onObserve({ event: 'effects-unparsable', root: rootSessionId, memberKey, callId })
        return 'rejected'
      }
      const grantId = nextGrantId()
      const minted = mintOperationGrant({
        grantId,
        member: member.ref,
        callId,
        realmId: member.realmId,
        bindingId: `a5ptc-esc:${member.ref.instanceId}`,
        bindingRevision: 1,
        authorityGeneration: 1,
        parametersFingerprint: fingerprint,
        effects: effects.value,
        issuedAt: now(),
        expiresAt: Number.isFinite(ttlMs) ? now() + ttlMs : null,
      })
      if (minted.ok !== true) {
        adjudications.refused++
        onObserve({ event: 'mint-refused', root: rootSessionId, memberKey, callId, detail: String(minted.error?.message ?? '').slice(0, 160) })
        return 'rejected'
      }
      const registered = ledger.register(minted.value)
      if (registered.ok !== true) {
        adjudications.refused++
        grantStates.set(grantId, 'register-refused')
        onObserve({ event: 'register-refused', root: rootSessionId, memberKey, callId })
        return 'rejected'
      }
      grantStates.set(grantId, 'minted')
      byKey.set(key, { grantId, memberKey, memberGeneration: member, callId, toolName, bindingId: `a5ptc-esc:${member.ref.instanceId}`, effects: effects.value })
      // the approval in hand is consumed by THIS ask exactly once:
      const out = ledger.consume(grantId, callContext(member, { callId, toolName, bindingId: `a5ptc-esc:${member.ref.instanceId}`, effects: effects.value }, mode, req?.reason))
      const okOnce = out.ok === true
      grantStates.set(grantId, okOnce ? 'consumed' : `refused:${String(out.reason)}`)
      // NO delete here either — the consumed fact is what a replay meets.
      if (okOnce) adjudications.allowedOnce++
      else adjudications.refused++
      onObserve({ event: okOnce ? 'allowed-once' : 'refused', root: rootSessionId, memberKey, callId, mode, reason: okOnce ? null : String(out.reason) })
      // (the fact stays in byKey for the same replay-detection reason)
      return okOnce ? 'allowed-once' : 'rejected'
    },

    setBootCensus(b) {
      if (boot !== null) return // one boot row per assembly, first write wins
      boot = Object.freeze({ selectedRunner: String(b?.selectedRunner ?? 'unset'), enforcement: String(b?.enforcement ?? 'unset') })
      onObserve({ event: 'census-boot', root: rootSessionId, ...boot })
    },

    census() {
      return {
        rootSessionId,
        membersLive: members.size,
        adjudications: { ...adjudications },
        boot,
      }
    },
    /** OBSERVABILITY MIRROR ONLY — the ledger stays the one durable fact. */
    grantsState: () => [...grantStates.entries()].map(([grantId, state]) => ({ grantId, state })),
    ledgerConsumedCount: () => ledger.consumedCount(),
  }
}
