/**
 * jobs-family-bridge.mjs — U6 PR4 (ARC-C): the governed JOBS bridge as a
 * named-bridge module on the governance kernel. Two faces live here, and
 * only here:
 *
 *  1. THE BRIDGE BODY — moved VERBATIM from
 *     `packages/runtime/src/plugin/live/plane-effect-backends.mjs` at master
 *     8337e52cf (the block that sat at :595-866; the sup-b PoC-3 proof
 *     extracted the SAME region at master 3288567d3 lines 1579-1850, body
 *     sha256 71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f
 *     — the region hashes IDENTICAL at both masters, re-pinned here, and the
 *     u6-pr4 test recomputes it from this file's bytes). Zero edits rode the
 *     move: the fence order, the laziness law, the revocation law, the
 *     cancel-requested law — all byte-preserved. `u6-pr4-jobs-bridge.test.ts`
 *     asserts the sha against BOTH the master blob (`git show`) and this
 *     file's copy; a content edit changes the digest and the test goes RED.
 *     The bridge imports NOTHING (the import header below serves the
 *     contribution face only) — so the body cannot even reach a second
 *     authority.
 *
 *  2. THE CENTER FACE (added below the moved region) — what the PR1 closed
 *     schema + Registry need to admit this lane: the fixed name list the
 *     plane quotes into the natexe ledger, the trio row DEFINITIONS (moved
 *     from the plane's inline block, verbatim text, the three free variables
 *     hoisted to parameters), and the contribution descriptor whose digests
 *     bind the bridge source, the placed rows, and the NAMED provider
 *     (`dsh.host/job-registry` — the host JobRegistry PUBLIC management face
 *     @639ed01539; CI-07 names it, the schema forces provider-backed
 *     execution through `via: 'named-bridge'` with this bridge's id).
 *
 * NO SECOND LEDGER (the ARC-C law): the trio rides the SAME center path as
 * read/bash — the same kernel instance, the same approval table (bind-once
 * entries keyed (scopeKey, name)), the same install.ts pre-body table gate
 * and post-success drift veto, the same one-shot consume edge. The bridge
 * body carries NO approval state: its only mutable map is the definition
 * identity feed cache (`registered`), and its only emissions are observe
 * rows. The gateway fence it consults is the durable ATTRIBUTION ledger
 * (who owns a job), never an approval ledger — `jobs-gateway-assembly.mjs`
 * stays untouched by this slice, and `pa-mount-registry.mjs` is imported
 * UNMODIFIED wherever mount identity is needed (the CI-08 mount law).
 *
 * @module packages/runtime/src/plugin/live/jobs-family-bridge
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../../contracts/src/index.js'

/* ── moved VERBATIM from plane-effect-backends.mjs (begin) ─────────────── */

/**
 * B-ACT-1-PR C2 — the governed jobs-management bridge (the effect body
 * behind the plane's fixed `job_output`/`job_list`/`job_kill` takeover
 * row). Adapter-first by construction: the effect face is the host
 * `JobRegistry` PUBLIC service (`ctx.get('jobs')` @639ed01539, every
 * management op caller-scopable); nothing is forked.
 *
 * THE FENCE ORDER IS THE LAW (pc-CONTRACT §1 jobs row, PR7):
 *  1. the gateway row (`checkManagementAccess`, member-scope owner fence over
 *     the durable attribution ledger) answers FIRST; a team-layer refusal
 *     NEVER reaches the host layer (the two fences answer only for
 *     themselves — the measured non-reach is pinned in
 *     test/a5p7-jobs-assembly-actuator.test.ts);
 *  2. an un-attributed jobId passes CORDed:false — the host's caller fence
 *     (`exec.agent?.id`, the dispatch-provided caller the host tool itself
 *     passes) stays authoritative and the bridge never invents ownership;
 *  3. `kill` answers the host's two native forms — 'requested' marks the
 *     REQUEST on the gateway (noteKillRequested), 'already-finished' settles
 *     nothing new. Cancel requested ≠ terminated (PR1 Gate R4).
 *
 * The gateway definition store is fed LAZILY at first use from the live
 * placement feed (the def#N identities mint only after the seam's install
 * pass — the pb §6 laziness law), and every refusal answers in the plane's
 * closed { text } envelope. A caller the dispatch did not name
 * (`exec.agent?.id` absent) is refused — an absent caller would query the
 * host UNFILTERED and this bridge never un-fences.
 */
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

/* ── U6 PR4: the bridge's CENTER FACE (contribution + placed rows) ─────── */

/**
 * The fixed management trio (name list C6). The plane quotes THIS list into
 * its natexe ledger and into the kernel-ownership set; the contribution
 * below names the same list as its native visibility. One list, one place —
 * a fourth copy of these three strings anywhere else is the dual-list bug
 * this export exists to prevent.
 */
export const JOBS_MANAGEMENT_NAMES = Object.freeze(['job_output', 'job_list', 'job_kill'])

/** The bridge identity the contribution's `execution.bridgeId` names. */
export const JOBS_BRIDGE_ID = 'a5-jobs-bridge'

/**
 * The trio row DEFINITIONS — moved from the plane's inline block (master
 * 8337e52cf team-tool-plane.mjs :1654-1692), text VERBATIM; the three free
 * variables (`jobsBridge`, `shutJobsText`, `PLANE_PRESENTATION_FACE`) are
 * hoisted to parameters, which is the only structural difference. The
 * closed `jobsEnabled` gate stays the PLANE's law (absent key = this
 * builder is never called = zero rows, byte-for-byte zero flip).
 */
export function buildJobsManagementRowDefs({ jobsBridge, shutJobsText, PLANE_PRESENTATION_FACE }) {
  return [
    Object.freeze({
      name: 'job_output',
      description: 'Read a background job: output since the previous read for stream jobs, or the result of a finished final-output job.',
      parameters: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'Job id returned by the tool that started the background work.' },
          wait: { type: 'boolean', description: 'Block until the job finishes or the timeout expires; a timed-out wait leaves the job running. Defaults to false.' },
          timeout_ms: { type: 'number', description: 'Max wait in milliseconds with wait: true.' },
        },
        required: ['job_id'],
      },
      execute: async (args, exec) => (jobsBridge !== null ? jobsBridge.jobOutput(args ?? {}, exec?.agent?.id, exec?.signal) : await shutJobsText()),
      output: PLANE_PRESENTATION_FACE,
    }),
    Object.freeze({
      name: 'job_list',
      description: 'List your background jobs (running and finished) with their ids, kinds, and statuses.',
      parameters: { type: 'object', properties: {} },
      execute: async (_args, exec) => (jobsBridge !== null ? jobsBridge.jobList(exec?.agent?.id) : await shutJobsText()),
      output: PLANE_PRESENTATION_FACE,
    }),
    Object.freeze({
      name: 'job_kill',
      description: 'Request cancellation of a running background job.',
      parameters: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'Job id returned by the tool that started the background work.' },
          reason: { type: 'string', description: 'Optional short reason, recorded in the log and forwarded to the job.' },
        },
        required: ['job_id'],
      },
      execute: async (args, exec) => (jobsBridge !== null ? jobsBridge.jobKill(args ?? {}, exec?.agent?.id) : await shutJobsText()),
      output: PLANE_PRESENTATION_FACE,
    }),
  ]
}

/**
 * The JOBS-family contribution (PR1 closed schema, §4 six boundaries +
 * §10.3). ARC-C shape: the source is PROVIDER-BACKED — the execution body
 * drives the host JobRegistry PUBLIC management face (`ctx.get('jobs')`,
 * the same service the host's own job_* tools call @639ed01539) — and the
 * schema law forces such a family through a NAMED bridge
 * (`execution.via='named-bridge'`, this bridge's id): no self-attested
 * family body exists for these names. The digests bind the bridge source
 * text, the row-builder source text, the three placed definitions
 * (name/parameters/execute/description), and the mount's host pin: a
 * change to ANY of them is a different contribution, STALE against
 * inherited approvals — never a silently inherited grant.
 */
export function buildJobsBridgeContribution({ bridge, definitions, hostPin, cancelBoundary }) {
  // Wiring honesty BEFORE any digest: the contribution names the bridge it
  // was built beside — a mismatched or absent bridge is a wiring bug and
  // mounts NOTHING (the schema would still validate a forged descriptor;
  // this check is what keeps the descriptor attached to a real body).
  if (bridge === null || bridge === undefined || bridge.bridgeId !== JOBS_BRIDGE_ID) {
    throw new TypeError('buildJobsBridgeContribution: a live ' + JOBS_BRIDGE_ID + ' bridge is required')
  }
  const trio = [...JOBS_MANAGEMENT_NAMES]
  if (definitions.length !== trio.length || definitions.some((d, i) => d.name !== trio[i])) {
    throw new TypeError('buildJobsBridgeContribution: definitions must be exactly the fixed management trio, in order')
  }
  const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
  const rows = definitions.map((d) => ({
    name: d.name,
    description: d.description,
    parameters: d.parameters,
    execute: d.execute?.toString?.() ?? null,
  }))
  const sourceDocument = canonicalJsonStringify({
    bridgeId: JOBS_BRIDGE_ID,
    names: JOBS_MANAGEMENT_NAMES,
    bridge: createGovernedJobsBridge.toString(),
    rowDefs: buildJobsManagementRowDefs.toString(),
    rows,
    hostPin: hostPin ?? null,
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.jobs-family',
    familyVersion: '0.1.0',
    source: {
      // PROVIDER-BACKED, honestly: the effect body drives the host's jobs
      // service; this bridge adds the Team fences, it does not own the
      // job mechanism. CI-07 names the provider; NAMED_BRIDGE_REQUIRED is
      // why `execution` below can only be 'named-bridge'.
      kind: 'provider-backed',
      selector: 'packages/runtime/src/plugin/live/jobs-family-bridge.mjs',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      id: 'dsh.host/job-registry',
      digest: sha256Hex(canonicalJsonStringify({
        provider: 'dsh.host/job-registry',
        face: 'JobRegistry PUBLIC management ops list/read/kill/wait(caller-scoped)',
        hostPin: hostPin ?? null,
      })),
    },
    requiredCapabilities: ['jobs-management'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The trio mount at FIXED native spellings (the natexe ledger's
      // `jobs` row quotes this same list; Gate 0b's same-name same-meaning
      // law is what the moved descriptions satisfy).
      nativeNames: [...JOBS_MANAGEMENT_NAMES],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      inputContractDigest: sha256Hex(canonicalJsonStringify(rows.map((r) => ({
        name: r.name,
        parameters: r.parameters,
      })))),
      outputContractDigest: sha256Hex(canonicalJsonStringify(rows.map((r) => ({
        name: r.name,
        presentation: r.name === 'job_list' ? 'text-rings' : 'text-body',
      })))),
      normalization: 'pure',
    },
    effects: {
      declared: true,
      kinds: ['tool-invoke', 'jobs-management'],
      targets: ['host-job-registry'],
    },
    execution: {
      declared: true,
      via: 'named-bridge',
      bridgeId: JOBS_BRIDGE_ID,
    },
    lifecycle: {
      owner: 'kernel',
      drain: 'kernel-owned',
      cancelBoundary,
    },
    result: {
      envelope: 'host',
      correlation: 'kernel',
    },
    obligations: {
      admission: 'kernel',
      grantMint: 'kernel',
      grantConsume: 'kernel',
    },
  }
}

