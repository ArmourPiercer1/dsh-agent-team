/**
 * jobs-background-producer.mjs — U7-4a (user ruling 2026-10-26, item 2): the
 * CREATION-LANE ATTRIBUTION PRODUCER for governed background bash.
 *
 * THE POSITION (authority law unchanged, CI-01…CI-12):
 *  - This module is the `background.accept` collaborator of the governed
 *    confined shell row (`packages/tools/process-family/confined-shell-executor`).
 *    It is reached ONLY from inside `runToolCall` — strictly AFTER the kernel
 *    `decide` fast-deny path and the PA edge (`admitCall` → real Control ask
 *    when required → issueApprovedGrant → one-shot `consumeOnce`). A refusal,
 *    a replay or an unresolved ask never reaches this file at all: the
 *    backend is not called, so `accept` is not called, so NOTHING here runs.
 *    The counters below instrument exactly that law: `attributions <=
 *    hostJobsCreated <= producerCalls`, and a call the kernel refused leaves
 *    every counter at zero (proven in `u74a-jobs-producer.test.ts`).
 *  - The spawn is the SAME confined provider the foreground arm rides (the
 *    row hands a `spawn()` thunk over its own `provider.spawnStreaming`,
 *    same probe, same launcher double gate, same lease law). This producer
 *    never spawns a process of its own.
 *  - The host job is created through the host's PUBLIC creation seam
 *    (`JobRegistry.start(spec)` @639ed01539 — the very call the host's own
 *    bash tool makes for `run_in_background`), owned by the mount's own
 *    session id, so the host caller fence (`exec.agent?.id`, the
 *    dispatch-provided caller) already belongs to this lane.
 *  - Attribution is the EXISTING gateway law, never a re-implementation:
 *    `ensureRegistered()` first (the creating-lane pin from the live
 *    placement feed — fail closed when no definition minted it), then
 *    `attributeBackgroundJob({hostJobId, owner, scopeKey, toolName:'bash'})`
 *    → `admitJob` (GATE 1 durable identity confirm, GATE 2 admit-time
 *    definition pin, frozen ownerKey from the AUTHORITY copy). Attribution
 *    happens ONLY after the host admitted the job (a real `hostJobId`), i.e.
 *    never before the authorized spawn, and never for a job the kernel did
 *    not authorize. No second ledger: the attribution ledger is the
 *    gateway's, the approval ledger remains the kernel's — this file holds
 *    NO approval state.
 *  - Fail closed: attribution refusal (unconfirmed identity, unminted pin,
 *    absent gateway row) never leaves an owner-less governed job running.
 *    The producer requests the job's cancellation through the same public
 *    face (`kill` answers 'requested' | 'already-finished' — a REQUEST,
 *    never a settlement) and reports the close honestly: a kill REQUEST is
 *    not a confirmation the payload stopped (CI-09 uncertainty honesty),
 *    and a throwing kill is reported as TERMINATION-UNCONFIRMED.
 *
 * NO INJECTED-AUTHORITY BYPASS: `ownerDurable` is an ADVISORY pre-check
 * that only ever REFUSES earlier (it can never admit — `admitJob` confirms
 * durably again inside the gateway). `viewer` is the routed mount's durable
 * member pair, `ownerSessionId` is the mount's own host session id; nothing
 * here accepts a caller-declared identity.
 *
 * @module runtime/plugin/live/jobs-background-producer
 */

/** Byte cap of each captured stream before the oldest bytes slide out
 *  (the ring itself is the host registry's; this cap bounds only the
 *  producer-side pull buffer the registry pumps). */
const CAPTURE_CAP_BYTES = 2 * 1024 * 1024

/**
 * A bounded, non-consuming byte capture with absolute-offset reads — the
 * structural twin of the host's `observed[channel].readFrom(fromByte)` the
 * registry pumps as a pull source (chunks arrive by event; readers never
 * consume). Past the cap the oldest whole chunks slide out and a read
 * below the retained window answers lossy (the whole retained tail),
 * never an error.
 */
function createCapture() {
  let chunks = []
  let head = 0
  let total = 0
  let dropped = 0
  let errored = false
  return {
    push(text) {
      if (typeof text !== 'string' || text.length === 0) return
      const bytes = Buffer.byteLength(text, 'utf8')
      chunks.push({ at: total, text, bytes })
      total += bytes
      while (total - head > CAPTURE_CAP_BYTES && chunks.length > 1) {
        const first = chunks[0]
        if (first.at + first.bytes <= total - CAPTURE_CAP_BYTES) {
          dropped = first.at + first.bytes
          head = dropped
          chunks = chunks.slice(1)
        } else break
      }
    },
    markError() { errored = true },
    readFrom(fromByte) {
      if (fromByte >= total) return { text: '', nextOffset: total, lossy: fromByte < dropped }
      const start = fromByte <= head ? head : fromByte
      const out = []
      for (const c of chunks) {
        if (c.at >= total) break
        if (c.at + c.bytes <= start) continue
        if (c.at >= start) out.push(c.text)
        else out.push(c.text.slice(Math.min(c.text.length, start - c.at)))
      }
      return { text: out.join(''), nextOffset: total, lossy: fromByte < dropped || (errored && start === head) }
    },
  }
}

/**
 * Build the creation-lane producer for ONE governed member mount.
 *
 * @param {object} input
 * @param {string} input.scopeKey - the ONE bridge scope key (jobsBridgeScopeKey)
 *   of THIS mount — the same key the trio's rows are attributed under.
 * @param {{rootSessionId: string, instanceId: string}} input.viewer - the
 *   routed mount's durable member pair (attribution owner).
 * @param {string} input.ownerSessionId - the mount's own host session id: the
 *   `JobSpec.owner` and the caller the host fence answers for (the dispatch-
 *   provided `exec.agent?.id` of this agent's calls is this exact id).
 * @param {() => {attributeBackgroundJob: Function, checkManagementAccess: Function} | null} input.gatewayRow
 *   the live per-root gateway row face (the ci05-wrapped assembly) or null.
 * @param {() => number} input.ensureRegistered - the bridge's center-feed
 *   pass (fail-closed pin source; the producer never invents a pin).
 * @param {() => unknown} input.jobsService - lazy host JobRegistry accessor.
 * @param {() => boolean} input.ownerDurable - ADVISORY durable-row precheck
 *   (refuse earlier, never admit).
 * @param {(row: string) => void} [input.observe]
 * @param {() => string} [input.logLine] - optional shipped-style log echo
 *   (the C2 receipt channel); absent = no echo.
 */
export function createGovernedBackgroundProducer(input) {
  const { scopeKey, viewer, ownerSessionId, gatewayRow, ensureRegistered, jobsService, ownerDurable } = input
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  const logLine = typeof input.logLine === 'function' ? input.logLine : () => {}
  if (typeof scopeKey !== 'string' || scopeKey === '') throw new TypeError('U74A_BG_SCOPE_KEY_REQUIRED')
  if (viewer === null || typeof viewer !== 'object') throw new TypeError('U74A_BG_VIEWER_REQUIRED')
  if (typeof ownerSessionId !== 'string' || ownerSessionId === '') throw new TypeError('U74A_BG_OWNER_SESSION_REQUIRED')

  // The instrumented ordering law (tested): producerCalls only counts calls
  // the kernel already authorized (the funnel cannot reach `accept` any other
  // way), hostJobsCreated counts REAL host receipts, attributions counts
  // accepted attributions. Invariant asserted at every attribution:
  // attributions <= hostJobsCreated <= producerCalls.
  const stats = {
    producerCalls: 0,
    hostJobsCreated: 0,
    attributions: 0,
    attributionRefusals: 0,
    closes: { requested: 0, alreadyFinished: 0, uncertain: 0 },
  }

  const typedRefusal = (code, detail) => ({
    ok: false,
    failure: { class: 'denied', code, detail: String(detail).slice(0, 320) },
  })

  const receipt = (hostJobId) => ({
    ok: true,
    outcome: {
      // The CALL's honest fact: the process is running detached under the
      // host registry — no exit is observed by this call (the renderer
      // prints `exit=not-observed`), and the captured-stream channel carries
      // the Team-authored receipt line, NOT payload bytes (the payload's
      // bytes land in the host ring and are read through `job_output` — the
      // server-side face). Mirrors the host's own acknowledgment phrase.
      exitCode: null,
      stdout: `started background job ${hostJobId} (governed: manage it with the job_list / job_output / job_kill trio)`,
      stderr: '',
      timedOut: false,
      cancelled: false,
      truncated: false,
    },
    settlement: { kind: 'completed' },
  })

  /** Ask the host to cancel the job and report the close HONESTLY (a kill
   *  is a REQUEST; only the host settles). Returns the wording fragment. */
  const closeJob = (svc, hostJobId) => {
    try {
      const r = svc.kill(hostJobId, ownerSessionId, 'governed-attribution-refused')
      if (r === 'already-finished') {
        stats.closes.alreadyFinished += 1
        return 'close: job already finished'
      }
      stats.closes.requested += 1
      return 'close: cancellation REQUESTED (host-owned settlement; termination NOT confirmed by this call)'
    } catch {
      stats.closes.uncertain += 1
      return 'close: kill refused — TERMINATION-UNCONFIRMED'
    }
  }

  /**
   * The accept leg. Reached only after the kernel consumed the grant for
   * THIS call; performs: jobs service → advisory owner precheck → pin feed
   * → `svc.start` (host preflight BEFORE the starter runs, so a controller/
   * limit refusal spawns NOTHING) → the spawn INSIDE the starter → pin feed
   * re-run → gateway attribution → receipt or honest close.
   *
   * @param {{call: object, request: object, spawn: () => Promise<object>}} ctx
   *   `spawn` runs the SAME confined provider's `spawnStreaming(request)`.
   */
  const accept = async (ctx) => {
    stats.producerCalls += 1
    const svc = typeof jobsService === 'function' ? jobsService() : undefined
    if (svc === null || svc === undefined || typeof svc.start !== 'function' || typeof svc.kill !== 'function') {
      observe(`a5bg: refused jobs-service-unavailable (no host JobRegistry composed — a background job that can never be born managed is never born at all)`)
      return typedRefusal('background-jobs-service-unavailable',
        'the host jobs registry is not composed — a governed background job that no trio could ever manage is refused BEFORE any spawn')
    }
    if (typeof ownerDurable === 'function' && ownerDurable() !== true) {
      // Advisory-only: the gateway would fail closed at admit anyway; the
      // precheck refuses BEFORE the spawn so a non-durable scope bears no
      // side effect at all (the stricter reading of "no attribution without
      // a durable owner", zero host reach).
      observe('a5bg: refused owner-not-durable (advisory precheck; zero spawn, zero attribution)')
      return typedRefusal('background-owner-not-durable',
        'the routed member scope has no durable MemberInstance row under this team root (advisory precheck refused before any spawn; the gateway confirms durably again at admit)')
    }
    if (typeof ensureRegistered === 'function') {
      try { ensureRegistered() } catch { /* the second run before attribution re-picks a late mint */ }
    }

    // The already-spawned-handle adaptation (host pattern mirrored from
    // packages/shell/tool-bash/src/background.ts @639ed01539: the process
    // spawns INSIDE the starter, after the registry preflight admitted the
    // job; hooks.cancel is synchronous, idempotent, and done settles after
    // the resources release).
    let handle = null
    let spawnFailure = null
    let killReason = null
    let terminateKicked = null
    const out = createCapture()
    const err = createCapture()
    const kickTerminate = () => {
      // Nothing to terminate until the handle exists — and a kick that
      // arrives BEFORE it must NOT be cached as "done": `wire` re-kicks
      // when the handle lands (the kill racing the spawn still terminates).
      if (handle === null) return Promise.resolve({ ok: false, late: true })
      if (terminateKicked === null) {
        terminateKicked = Promise.resolve(handle.terminate()).catch(() => ({ ok: false }))
      }
      return terminateKicked
    }
    const wire = (h) => {
      handle = h
      h.stdout.on('data', (d) => { out.push(typeof d === 'string' ? d : String(d)) })
      h.stderr.on('data', (d) => { err.push(typeof d === 'string' ? d : String(d)) })
      h.stdout.on?.('error', () => { out.markError() })
      h.stderr.on?.('error', () => { err.markError() })
      if (killReason !== null) void kickTerminate() // a kill that raced the spawn
    }

    let hostJobId
    try {
      hostJobId = svc.start({
        kind: 'bash',
        label: String(ctx.request.command ?? '').slice(0, 512) || 'governed background bash',
        owner: ownerSessionId,
        output: [
          { channel: 'stdout', read: (fromByte) => out.readFrom(fromByte) },
          { channel: 'stderr', read: (fromByte) => err.readFrom(fromByte) },
        ],
        run: () => {
          const spawned = Promise.resolve().then(() => ctx.spawn())
          spawned.then((r) => {
            if (r === null || typeof r !== 'object' || r.ok !== true) {
              // ProviderResult failure shape: { ok: false, error: { code, message } }.
              spawnFailure = `${r?.error?.code ?? r?.code ?? 'confined-refused'}`
              out.push(`[governed background] confined spawn refused: ${spawnFailure}\n`)
              return
            }
            wire(r.value)
          }).catch((error) => {
            spawnFailure = String(error?.message ?? error).slice(0, 200)
            out.push(`[governed background] confined spawn failed: ${spawnFailure}\n`)
          })
          const done = (async () => {
            try {
              await spawned
              if (handle === null) {
                // The spawn never produced a handle (confined refusal or a
                // throw): the job settles as failed WITH the honest ring
                // note already appended; no process existed, so there is
                // nothing to terminate.

                return { status: 'failed', detail: `spawn refused: ${spawnFailure ?? 'unknown'}` }
              }
              const exit = await handle.exited
              await kickTerminate() // provider's own close/supervision path

              if (killReason !== null) {
                return { status: 'killed', detail: `${killReason}; ${exit.signal !== null && exit.signal !== undefined ? `signal: ${exit.signal}` : `exit code: ${String(exit.code)}`}` }
              }
              return { status: 'completed', detail: `exit code: ${String(exit.code)}` }
            } catch (error) {

              return { status: killReason !== null ? 'killed' : 'failed', detail: String(error?.message ?? error).slice(0, 200) }
            }
          })()
          return {
            cancel: (reason) => {
              killReason = String(reason ?? 'killed')
              void kickTerminate()
            },
            // JobHooks.done must never reject — the chain above only
            // resolves. It also must not hang: every await terminates on
            // handle death or terminate completion.
            done,
          }
        },
      })
    } catch (error) {
      // The host preflight refused BEFORE the starter ran (no controller
      // serves this agent, the owner has no live Agent, or the per-owner
      // concurrency limit answered): NOTHING spawned, NOTHING attributed.
      observe(`a5bg: refused start by host precheck (${String(error?.message ?? error).slice(0, 160)})`)
      return typedRefusal('background-start-refused',
        `the host registry refused the registration before any spawn (${String(error?.message ?? error).slice(0, 200)})`)
    }
    stats.hostJobsCreated += 1

    // Attribution: pin feed first (fail closed when no definition minted a
    // pin), then the gateway's admitJob through the live row face.
    if (typeof ensureRegistered === 'function') {
      try { ensureRegistered() } catch { /* the gateway fail-closes on an unminted pin */ }
    }
    const asm = typeof gatewayRow === 'function' ? gatewayRow() : null
    if (asm === null || asm === undefined || typeof asm.attributeBackgroundJob !== 'function') {
      const close = closeJob(svc, hostJobId)
      stats.attributionRefusals += 1
      observe(`a5bg: attribution-refused hostJobId=${hostJobId} reason=no-gateway-row (${close})`)
      logLine(`a5bg: attribution-REFUSED hostJobId=${hostJobId} reason=no-gateway-row`)
      return typedRefusal('background-attribution-refused',
        `no live gateway row for this team root — the job ${String(hostJobId)} was never attributed to a member scope and stays unmanageable by design; ${close}`)
    }
    const res = asm.attributeBackgroundJob({ hostJobId, owner: viewer, scopeKey, toolName: 'bash' })
    if (res !== null && typeof res === 'object' && res.ok === true) {
      if (!(stats.attributions <= stats.hostJobsCreated && stats.hostJobsCreated <= stats.producerCalls)) {
        // Fail loud, never silent: the ordering law is this module's spine.
        throw new Error(`U74A_BG_ORDER_VIOLATION attributions=${String(stats.attributions)} hostJobsCreated=${String(stats.hostJobsCreated)} producerCalls=${String(stats.producerCalls)}`)
      }
      stats.attributions += 1
      observe(`a5bg: attributed hostJobId=${hostJobId} owner=${String(viewer.rootSessionId)}/${String(viewer.instanceId)} tool=bash`)
      logLine(`a5bg: attributed hostJobId=${hostJobId} instance=${String(viewer.instanceId)} tool=bash`)
      return receipt(hostJobId)
    }
    const close = closeJob(svc, hostJobId)
    stats.attributionRefusals += 1
    observe(`a5bg: attribution-refused hostJobId=${hostJobId} code=${String(res?.code ?? 'unknown')} (${close})`)
    logLine(`a5bg: attribution-REFUSED hostJobId=${hostJobId} code=${String(res?.code ?? 'unknown')}`)
    return typedRefusal('background-attribution-refused',
      `the gateway refused attribution (${String(res?.code ?? 'unknown')}: ${String(res?.detail ?? '').slice(0, 160)}) — an unattributed governed job is never exposed; ${close}`)
  }

  return { enabled: true, accept, stats }
}
