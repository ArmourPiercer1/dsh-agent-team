/**
 * g1fb-jobs-bridge.mjs — PoC-3 (ARC-C minimal, Jobs representative).
 *
 * PART 1 (below, byte-identical): the master PRODUCTION bridge function
 *   packages/runtime/src/plugin/live/plane-effect-backends.mjs lines 1579-1850
 *   @ master 3288567d36794394ce2af0401cee4fe218b11d03
 *   blob 331b21baa29b3d4323391e1353b6a51f3f0e8f28 (see README provenance),
 *   body-text sha256 71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f.
 * The whole module cannot be imported unmodified from a plugin (module-level
 * imports of lane TS sources), so this EXACT function text is extracted
 * verbatim; the runner preflight re-extracts `sed -n '1579,1850p'` from the
 * master tree and asserts byte equality — zero edits to the bridge itself.
 *
 * PART 2 (below): the PoC mount adapter — the minimal stand-ins for the
 * Team-side feeds the production bridge consumes (gateway live row with the
 * attribution table + owner fence, plane placement feed, host JobRegistry
 * thunk over the PUBLIC ctx.jobs face @639ed01539), plus a counting proxy
 * that proves the "team refusal never reaches the host layer" law. The
 * adapter injects facts ONLY; it contains NO approval state machine: every
 * governed call was already admitted by the ONE center ledger at the guard
 * edge (no second approval ledger — CI-06/§10.5-check-3).
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-jobs-bridge
 */

/* ── PART 1: byte-identical master bridge begin ─────────────────────────── */


export function createGovernedJobsBridge({ scopeKey, viewer, gatewayRow, planeRow, jobsService, observe = () => {}, waitDefaultMs = 30_000, waitCapMs = 600_000 }) {
  // scopeKey = the BRIDGE-SPECIFIC opaque definition key, produced ONLY by
  // the lane's single derivation helper (jobsBridgeScopeKey, re-exported by
  // the live assembly row this bridge is handed): the member dimension rides
  // the key, the root dimension rides the per-root live assembly - two
  // member bridges can no longer share a definition row.
  if (typeof scopeKey !== 'string' || scopeKey === '') throw new Error('jobs bridge: scopeKey is required')
  if (viewer === undefined || typeof viewer.rootSessionId !== 'string' || typeof viewer.instanceId !== 'string') {
    throw new Error('jobs bridge: viewer must carry the durable member pair {rootSessionId, instanceId}')
  }
  // ROOT③ (review, round B): name -> LAST REGISTERED identity. A one-way
  // Set pinned the FIRST feed identity forever, so a REPLACED lane (a
  // definition swap / remount that mints a new def identity) left a stale
  // pin behind for every later admit. The row-local store is last-write-
  // wins, so the honest shape is: register whenever the feed identity
  // MOVED (the laziness law stands: an identity that has not minted is
  // still never registered as undefined).
  const registered = new Map()
  const refuse = (code, detail) => {
    observe(`a5jobs: refused ${code}`)
    return { text: `refused: ${code} — ${String(detail).slice(0, 200)}` }
  }
  // ROOT residual order (round E): the WHOLE feed disappearing (planeRow null
  // or the placementFeed field gone) is the SAME revocation law as one entry
  // going missing - it invalidates EVERY name this scope had registered
  // (same store + local-pin machinery, no new gateway semantics, no API
  // growth). A silent early return used to KEEP the stale identities alive,
  // so admission after a teardown answered on pins of a plane that no longer
  // exists; fail-closed until the feed returns is the honest shape.
  const invalidateAll = (asm) => {
    for (const name of registered.keys()) {
      if (typeof asm.definitions.unregister === 'function') {
        asm.definitions.unregister(scopeKey, name)
        observe(`a5jobs: definition-invalidated name=${name} scope=${scopeKey}`)
      }
    }
    registered.clear()
  }
  const ensureDefinitions = (asm) => {
    const plane = typeof planeRow === 'function' ? planeRow() : null
    if (plane === null || plane === undefined || typeof plane.placementFeed !== 'function') {
      invalidateAll(asm)
      return
    }
    for (const name of ['bash', 'job_output', 'job_list', 'job_kill']) {
      const entry = plane.placementFeed(name)
      // Not minted yet: retry on the next call — never register an
      // undefined identity (the closed world has no guessed pins).
      // ROOT checklist (1): a WITHDRAWN or unreadable definition that this
      // scope had ALREADY registered invalidates that exact member scope's
      // row (store + local pin) - a stale pin never masquerades as a closed
      // revocation; the next admit fail-closes at 'never-registered'.
      if (entry === undefined || entry === null || entry.definitionIdentity === undefined) {
        if (registered.delete(name) && typeof asm.definitions.unregister === 'function') {
          asm.definitions.unregister(scopeKey, name)
          observe(`a5jobs: definition-invalidated name=${name} scope=${scopeKey}`)
        }
        continue
      }
      const identity = String(entry.definitionIdentity)
      if (registered.get(name) === identity) continue
      const moved = registered.has(name)
      asm.definitions.register(scopeKey, name, identity)
      registered.set(name, identity)
      observe(`a5jobs: ${moved ? 'definition-re-registered' : 'definition-registered'} name=${name} scope=${scopeKey}`)
    }
  }
  const resolve = () => {
    const asm = typeof gatewayRow === 'function' ? gatewayRow() : null
    if (asm === null || asm === undefined) {
      return { refusal: refuse('gateway-not-active', 'the Team jobs gateway live row is not mounted for this root') }
    }
    let svc
    try {
      svc = typeof jobsService === 'function' ? jobsService() : undefined
    } catch (error) {
      return { refusal: refuse('jobs-service-unavailable', error?.message ?? error) }
    }
    if (svc === undefined || svc === null) {
      return { refusal: refuse('jobs-service-unavailable', 'the host jobs registry service is absent from the global store') }
    }
    ensureDefinitions(asm)
    return { asm, svc }
  }
  const checked = (jobId, r) => {
    const gate = r.asm.checkManagementAccess({ jobId, viewer })
    return gate.ok === true ? null : refuse(gate.code, gate.detail)
  }
  return {
    bridgeId: 'a5-jobs-bridge',
    /** Attribution-producer hook: feed the gateway definition store from
     *  the live placement feed BEFORE any `attributeBackgroundJob` admit,
     *  so a receipt born before the first management call still finds its
     *  creating-lane pin (the laziness law holds: an identity that has not
     *  minted is never registered as undefined). */
    ensureRegistered: () => {
      const asm = typeof gatewayRow === 'function' ? gatewayRow() : null
      if (asm !== null && asm !== undefined) ensureDefinitions(asm)
    },
    /** job_output: gate -> (wait, ROOT④b abort-aware) -> svc.read(caller);
     *  the delta composition mirrors the host readBody (chunks in offset
     *  order, the lossy notice, the once-only result tail) in the plane's
     *  text envelope. ROOT④b (root ruling option a — minimal forwarding, no
     *  recorded divergence, zero core): the dispatch's `exec?.signal`
     *  cancels the WAIT on the host's OWN public surface
     *  (`wait(id, timeoutMs, caller?, signal?)` @639ed01539). Three ordered
     *  arms, each MEASURED: a pre-aborted signal never touches svc.wait; a
     *  mid-wait abort is caught by the local race leg (the service also
     *  honours the forwarded signal — belt AND braces); an abort landing as
     *  wait settles — or one the service swallows — is caught by the
     *  re-check BEFORE any read. The typed `wait-aborted` return carries a
     *  BOUNDED slice of the abort reason's message/string form (the plane
     *  envelope's 200-char cap applies) - stated at that honest strength,
     *  NOT as full-reason-object identity fidelity (root wording ruling).
     *  The host read is never reached on an abort (call count zero, zero
     *  output leak). Un-aborted calls are untouched in BOTH arms:
     *  timed-out-then-read and killed-then-readable keep their positive
     *  controls, and the no-wait read path is unchanged. */
    async jobOutput(args, caller, signal) {
      if (typeof args?.job_id !== 'string' || args.job_id === '') return refuse('job-id-required', 'job_id is required')
      if (typeof caller !== 'string' || caller === '') return refuse('caller-unresolved', 'dispatch did not name the calling agent; the bridge never queries unfiltered')
      const r = resolve()
      if (r.refusal !== undefined) return r.refusal
      const denied = checked(args.job_id, r)
      if (denied !== null) return denied
      const abortReason = () => {
        const raw = signal?.reason
        if (typeof raw === 'string' && raw !== '') return raw
        if (raw?.message !== undefined && raw.message !== '') return String(raw.message)
        return signal?.aborted === true ? 'aborted' : 'not-aborted'
      }
      const abortReturn = () => refuse('wait-aborted', `the call was cancelled: ${abortReason()}`)
      // ROOT-close(2) (root, round-B addendum): the SAME cancellation contract
      // governs the NO-wait arm too - a pre-cancelled call never reaches
      // svc.read. The entry check is arm-independent; in the no-wait path
      // there is no await between entry and read, so it doubles as the
      // pre-read re-check the structural allowance permits.
      if (signal?.aborted === true) return abortReturn()
      try {
        if (args.wait === true) {
          if (signal?.aborted === true) return abortReturn() // a dead signal never touches the service
          const ms = typeof args.timeout_ms === 'number' ? args.timeout_ms : waitDefaultMs
          if (signal !== null && signal !== undefined && typeof signal.addEventListener === 'function') {
            let onAbort
            try {
              // ROOT-close(1) (root, round-B addendum) NO-LOST-EVENT shape:
              // the abort listener goes in BEFORE svc.wait is even called,
              // and a re-check runs AFTER the call - so an abort that fires
              // SYNCHRONOUSLY during the service call (and a service that
              // returns a never-settling promise) can neither outrun the
              // listener nor hang the race. The service ALSO honours the
              // forwarded signal (public surface) - belt AND braces.
              const abortPromise = new Promise((_resolve, reject) => {
                onAbort = () => reject(new Error('wait aborted'))
                signal.addEventListener('abort', onAbort, { once: true })
              })
              // ROOT-close(3) (root 10:0xZ risk order): a REJECTED promise
              // that no path consumes is a process-level unhandledRejection.
              // Every early return below (sync abort during the service
              // call, the catch arm) can leave abortPromise/waitPromise
              // rejected-but-unconsumed, so BOTH are pre-consumed with a
              // no-op handler AT CONSTRUCTION - race keeps its own
              // subscription and still sees the rejection. The listener is
              // removed on EVERY exit: the finally covers the early
              // returns, and the pre-construction returns own no listener.
              abortPromise.catch(() => {})
              const waitPromise = r.svc.wait(args.job_id, Math.min(ms, waitCapMs), caller, signal)
              waitPromise.catch(() => {}) // same law for the service promise on the early-return paths
              if (signal.aborted === true) return abortReturn() // fired DURING the service call: listener armed first, the re-check catches it
              await Promise.race([waitPromise, abortPromise])
            } catch (error) {
              if (signal.aborted === true) return abortReturn() // the abort owns the outcome, whatever the wait rejected with
              throw error
            } finally {
              if (typeof onAbort === 'function') signal.removeEventListener('abort', onAbort)
            }
          } else {
            await r.svc.wait(args.job_id, Math.min(ms, waitCapMs), caller, signal)
          }
          if (signal?.aborted === true) return abortReturn() // race/re-check BEFORE any read: an abort as wait settles still never reads
        }
        const read = await r.svc.read(args.job_id, caller)
        // ROOT final contract, ALIGNED TO THE PINNED HOST (tool-jobs
        // render.ts:75-84 + index.ts:330-335): `log` chunks are OBSERVER-ONLY
        // producer narration and NEVER reach the model; stdout (+ unlabelled)
        // in order, then every stderr chunk in ONE [stderr] section; a lossy
        // read or a model-visible gapBefore ends the delta with the
        // dropped-output notice naming the spill - SCOPED: the host carries
        // absolute spill paths, this governed face presents the file name
        // only (a Team member must not read the host's world layout); then
        // the ONE-TIME result tail (the service hands it out on the first
        // post-settlement read only); then the status line LAST - the host's
        // statusLine(publicJob(job)) semantics (detail = progress ?? detail).
        // With the status line, a timed-out wait on a RUNNING job and a
        // finished job with no new bytes are DISTINGUISHABLE - the collapse
        // the root BLOCK named (and native wait settlement suppresses a
        // follow-up completion notice, so this is substance, not cosmetics).
        const visible = (read.chunks ?? []).filter((c) => c?.channel !== 'log')
        const out = visible.filter((c) => c?.channel !== 'stderr').map((c) => String(c?.text ?? '')).join('')
        const err = visible.filter((c) => c?.channel === 'stderr').map((c) => String(c?.text ?? '')).join('')
        const errSep = out.length > 0 && !out.endsWith('\n') ? '\n' : ''
        let delta = out + (err.length > 0 ? `${errSep}[stderr]\n${err}` : '')
        if (read.lossy === true || visible.some((c) => c?.gapBefore === true)) {
          const spill = (read.job?.output?.spillPaths ?? []).map((p) => String(p).split(/[\\/]/).pop() ?? String(p))
          const notice = `[some output was dropped from memory; full output: ${spill.length > 0 ? `job spill file(s): ${spill.join(', ')}` : '(unavailable)'}]`
          delta = `${delta}${delta.length > 0 && !delta.endsWith('\n') ? '\n' : ''}${notice}`
        }
        const joined = read.result === undefined
          ? delta
          : `${delta}${delta.length > 0 && !delta.endsWith('\n') ? '\n' : ''}${read.result}`
        const body = joined.length > 0 ? joined : '(no new output)'
        const job = read.job
        // A read whose service carries no job view (a thinner face than the
        // host JobRead contract) keeps the OLD body verbatim - the status
        // line is added exactly when the read offers a host-shaped job view.
        const statusLine = job === undefined || job === null || typeof job.status !== 'string'
          ? ''
          : `\n[status: ${job.status}${(() => { const d = job.progress ?? job.detail; return d === undefined || d === null ? '' : `, ${String(d)}` })()}]`
        return { text: `${body}${statusLine}` }
      } catch (error) {
        return refuse('host-jobs-refused', error?.message ?? error)
      }
    },
    /** job_list: ROOT① (review, round B) — the host caller fence scopes the
     *  rows to the DISPATCH caller, but the caller is dispatch-provided: a
     *  routing shape that ever presents the SAME caller to two governed
     *  members must NOT let the Team layer surface rows ALREADY attributed
     *  to a foreign member scope. So the list consults the gateway PER ROW:
     *  attributed rows follow the same owner fence job_output/job_kill
     *  answer to (a foreign row is HIDDEN — the layer that knows, declines
     *  silently and echoes no identity, C-GW law); rows with no team record
     *  pass as the disclosed corded:false host jurisdiction — the fence
     *  still invents nothing. */
    async jobList(caller) {
      if (typeof caller !== 'string' || caller === '') return refuse('caller-unresolved', 'dispatch did not name the calling agent; the bridge never queries unfiltered')
      const r = resolve()
      if (r.refusal !== undefined) return r.refusal
      try {
        const jobs = await r.svc.list(caller)
        const visible = jobs.filter((j) => r.asm.checkManagementAccess({ jobId: j.id, viewer }).ok === true)
        return { text: visible.length === 0 ? '(no background jobs)' : visible.map((j) => `${j.id} [${j.kind}] ${j.status} — ${j.label}`).join('\n') }
      } catch (error) {
        return refuse('host-jobs-refused', error?.message ?? error)
      }
    },
    /** The mount's computed definition scope (helper output, read-only): the
     *  future creation producer consumes THIS - it never recomputes the tuple. */
    get scopeKey() {
      return scopeKey
    },
    /** job_kill: gate -> svc.kill(caller, reason); 'requested' marks the
     *  gateway REQUEST (never a settlement), the two forms never collapse. */
    async jobKill(args, caller) {
      if (typeof args?.job_id !== 'string' || args.job_id === '') return refuse('job-id-required', 'job_id is required')
      if (typeof caller !== 'string' || caller === '') return refuse('caller-unresolved', 'dispatch did not name the calling agent; the bridge never queries unfiltered')
      const r = resolve()
      if (r.refusal !== undefined) return r.refusal
      const denied = checked(args.job_id, r)
      if (denied !== null) return denied
      try {
        const outcome = await r.svc.kill(args.job_id, caller, typeof args.reason === 'string' ? args.reason : undefined)
        if (outcome === 'requested') {
          r.asm.noteKillRequested(args.job_id)
          return { text: `requested cancellation of job ${args.job_id}` }
        }
        return { text: `job ${args.job_id} had already finished` }
      } catch (error) {
        return refuse('host-jobs-refused', error?.message ?? error)
      }
    },
  }
}
/* ── PART 1 end (byte-identical master bridge above; verify: sed -n '1579,1850p'
      packages/runtime/src/plugin/live/plane-effect-backends.mjs @3288567d) ── */

/* ── PART 2: PoC mount adapter (facts ONLY — no approval state) ─────────── */
import { createHash } from 'node:crypto'
import { record } from './g1fb-lib.mjs'

const viewerKeyOf = (viewer) => `${viewer?.rootSessionId}|${viewer?.instanceId}`

/**
 * One PoC jobs mount per governed agent, mirroring the production shape
 * (bridge per member scope). Everything the bridge answers on:
 *  - jobsService: the HOST PUBLIC JobRegistry face (ctx.jobs @639ed01539),
 *    wrapped in a COUNTING proxy — the "team refusal never reaches the host
 *    layer" cell asserts zero svc.* calls for gateway-refused job ids;
 *  - gatewayRow: minimal Team-gateway stand-in: attribution table
 *    (jobId -> viewer) + owner fence + definitions store (attribution
 *    feed), noteKillRequested per the master law;
 *  - planeRow: placement feed = the CENTER's approved definition identities.
 * NO approval/ledger state lives here: admission already happened at the
 * guard's single ledger edge before this bridge was entered.
 */
export function createPocJobsMount({ ctx, center }) {
  const attribution = new Map()   // jobId -> viewerKey (producer attribution)
  const killRequested = new Set()
  const svcCalls = []             // [{method, jobId?, caller?}] — the count oracle
  const defStore = new Map()      // scopeKey|name -> identity (gateway definition store)
  const bridges = new Map()

  const countingSvc = () => {
    const svc = ctx.jobs ?? ctx.get?.('jobs')
    if (svc === undefined || svc === null) return undefined
    const count = (method) => (...callArgs) => {
      svcCalls.push({ method, jobId: typeof callArgs[0] === 'string' ? callArgs[0] : undefined, at: Date.now() })
      return svc[method](...callArgs)
    }
    return {
      read: count('read'), wait: count('wait'), kill: count('kill'), list: count('list'),
      // producer face (used by the background bash arm, not by the bridge):
      start: (spec) => svc.start(spec),
      remove: count('remove'), get: count('get'),
    }
  }

  const gatewayRow = () => ({
    definitions: {
      register: (scopeKey, name, identity) => { defStore.set(`${scopeKey}|${name}`, identity); record({ leg: 'bridge', phase: 'definition-register', scopeKey, name }) },
      unregister: (scopeKey, name) => { defStore.delete(`${scopeKey}|${name}`); record({ leg: 'bridge', phase: 'definition-unregister', scopeKey, name }) },
    },
    checkManagementAccess: ({ jobId, viewer }) => {
      const owner = attribution.get(jobId)
      if (owner === undefined) return { ok: true, corded: false } // host caller fence stays authoritative (master law)
      if (owner === viewerKeyOf(viewer)) return { ok: true }
      return { ok: false, code: 'foreign-attribution', detail: `job ${jobId} attributed to another viewer` }
    },
    noteKillRequested: (jobId) => { killRequested.add(jobId); record({ leg: 'bridge', phase: 'kill-requested', jobId }) },
  })

  const planeRow = () => ({
    placementFeed: (name) => {
      const held = center.approved.get(name)
      if (held === undefined) return undefined // laziness law: never register undefined
      return { definitionIdentity: createHash('sha256').update(`${name}:${String(held.generation)}:${String(held.familyId)}`).digest('hex').slice(0, 16) }
    },
  })

  /** One bridge per governed agent (per-member-scope production shape). */
  const bridgeFor = (agentId) => {
    const key = String(agentId ?? 'unknown')
    let b = bridges.get(key)
    if (b === undefined) {
      b = createGovernedJobsBridge({
        scopeKey: `g1fb-jobs-${key}`,
        viewer: { rootSessionId: key, instanceId: 'g1fb-inst' },
        gatewayRow,
        planeRow,
        jobsService: countingSvc,
        observe: (msg) => record({ leg: 'bridge', phase: 'observe', msg }),
      })
      bridges.set(key, b)
    }
    return b
  }

  return {
    bridgeFor,
    /** Producer attribution hook (the shell row calls it when a background
     *  job is born in a governed lane — the attribution-producer law). */
    attribute: (jobId, agentId) => {
      attribution.set(String(jobId), viewerKeyOf({ rootSessionId: String(agentId), instanceId: 'g1fb-inst' }))
      record({ leg: 'bridge', phase: 'attributed', jobId: String(jobId), viewer: String(agentId) })
      bridgeFor(agentId).ensureRegistered()
    },
    svcCalls: () => svcCalls.slice(),
    attributionDump: () => [...attribution.entries()].map(([jobId, viewer]) => ({ jobId, viewer })),
  }
}
