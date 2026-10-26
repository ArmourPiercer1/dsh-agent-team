/**
 * plane-effect-backends.mjs — GLUE-7: the PRODUCTION backend assembly for the
 * governed Team TOOL PLANE. This file is GLUE, nothing else: every backend
 * here rides an execution implementation this repository already ships and
 * has already proven live. No new executor architecture exists in this file —
 * it is the wiring the int-a5b README correction named as the delivery gap
 * (the production mount row never passed `backends`, so every live
 * read/search/shell dispatch landed on the typed shut face).
 *
 * THE INVENTORY (each backend -> the existing implementation it rides):
 *
 *  - `createConfinedShellBackend` (shell class) — SINCE U6 PR3 THIS CODE
 *    LIVES IN THE PROCESS-FAMILY LANE:
 *    `packages/tools/process-family/src/confined-shell-executor.mjs` (owner
 *    role: that lane's README; CI-07 names the reviewed provider it drives).
 *    This file IMPORTS and re-exports it unchanged — the mechanics it rides
 *    are untouched (and the provider MOUNT itself is booked THERE, in the
 *    `a5p4-lane-hygiene` named-mount ledger — this center file has not
 *    referenced the provider lane since U6 PR5 moved the search rows): the
 *    confined Process provider's P-LSP `spawnStreaming` ladder, the Landlock
 *    pre-launcher (`launcher/landlock-prelauncher.py`), the launcher
 *    byte-pin DOUBLE gate (pb-CONTRACT §1 `ProviderAssemblyConfig`), and the
 *    frozen lease/terminate law. The argv array is explicit (never a shell
 *    string on the provider's own face), the network dimension makes NO
 *    claim (the lane refuses a `deny` profile — PoC-4b honesty).
 *
 *  - `createAnchoredSearchBackend` (search, read-only) and the ARCHIVED
 *    `createAnchoredGlobBackend` CANDIDATE-A — SINCE U6 PR5 THIS CODE LIVES
 *    IN THE SEARCH-FAMILY LANE:
 *    `packages/tools/search-family/src/search-mechanics.mjs` (owner role:
 *    that lane's README). This file IMPORTS and re-exports them unchanged —
 *    the row law is untouched: TWO bodies picked by what the mount holds
 *    (with a confined provider the `./search-backend.mjs` delegate — the
 *    PR5 fixed-ripgrep row; without one the W5 grep(1) port, the RED
 *    control the parity suite pins R1–R5), both anchoring on the P-C
 *    controlled-fs INSTANCE root under the lane's own `isBeneath` law. The
 *    CANDIDATE-A glob row stays ARCHIVED (ships NOTHING; moved with its
 *    disclosures, never deleted, never re-wired — the PR5 row is the
 *    glob lane's production backend, `search-family/src/glob-backend.mjs`).
 *
 *  - `createGovernedReadExecutor` (fs class, the placed governed `read`)
 *    rides the SAME controlled-fs instance root: real bytes, anchored reads,
 *    deny-lane re-check BEFORE any read (the G1 law), template-default-deny
 *    honored (an effect the policy never names never runs), escapes refused.
 *
 * Fail-closed law (unchanged): a missing configuration never widens —
 * no `fsInstance` = no search/read row (the shut landing stays), no
 * `confinedProvider` = no shell row, an unavailable provider refuses typed,
 * `background: true` is refused BY NAME (never reinterpreted), and every
 * refusal is the closed `BackendFailure` triad (denied / hidden /
 * undetermined) — the plane pipeline renders them, this file never throws.
 *
 * @module packages/runtime/src/plugin/live/plane-effect-backends
 */

// U6 PR2 (U6 slice plan, PR2 of 6): the governed `read` row's mechanics,
// window/presentation law, effect executor and row DEFINITION moved VERBATIM
// to the FS family lane (`packages/tools/fs-family/`, owner role: see that
// lane's README). This center file keeps the OLD export surface as a
// re-export so every pinned consumer — the shipped read suites, the adjacent
// .d.mts typings, team-tool-plane — resolves UNCHANGED; the family lane is
// now the single home of the read-slice logic. (U6 PR5: `resolveAnchored`'s
// center-internal consumers — the search/glob rows' anchor law — moved with
// the search slice into the search-family lane, which rides the fs-family
// PUBLIC face for it; what remains here is the pure re-export surface the
// pinned consumers resolve against.)
import {
  createGovernedReadExecutor,
  lexicalAnchor,
  MAX_READ_BYTES,
  READ_ROW_CHUNK_BYTES,
  READ_ROW_LINE_CAP,
  READ_ROW_MAX_LINE_LENGTH,
  READ_ROW_MAX_OUTPUT_BYTES,
  resolveAnchored,
  resolveAnchoredPath,
} from '../../../../tools/fs-family/src/index.mjs'
export {
  createGovernedReadExecutor,
  lexicalAnchor,
  MAX_READ_BYTES,
  READ_ROW_CHUNK_BYTES,
  READ_ROW_LINE_CAP,
  READ_ROW_MAX_LINE_LENGTH,
  READ_ROW_MAX_OUTPUT_BYTES,
  resolveAnchored,
  resolveAnchoredPath,
}

// ── U6 PR5 (U6 slice plan, PR5 of 6): the governed search/glob rows'
// mechanics — the ONE grepArgv builder, the fd-view/sink helpers, the
// TWO-body `createAnchoredSearchBackend`, the ARCHIVED CANDIDATE-A
// `createAnchoredGlobBackend`, the fixed-rg search row, the production
// confined-rg glob row, and their shared cancel leg — moved VERBATIM to the
// SEARCH family lane (`packages/tools/search-family/`, owner role: see that
// lane's README). This center file keeps the OLD export surface as a
// re-export so every pinned consumer — the shipped search/glob/cancel
// suites, the adjacent .d.mts typings, team-tool-plane — resolves UNCHANGED
// (the PR2 read / PR3 shell precedents); the family lane is now the single
// home of the search-slice logic. `createAnchoredGlobBackend` here is the
// ARCHIVED candidate the glue7 suite pins (ships NOTHING); the PRODUCTION
// glob row's factory re-exports below under its lane truth.
import {
  grepArgv,
  createAnchoredSearchBackend,
  createAnchoredGlobBackend,
} from '../../../../tools/search-family/src/search-mechanics.mjs'
export {
  grepArgv,
  createAnchoredSearchBackend,
  createAnchoredGlobBackend,
}
export { createAnchoredRgSearchBackend } from '../../../../tools/search-family/src/search-backend.mjs'
export {
  GLOB_BACKEND_ID,
  GLOB_WALK_TIMEOUT_MS,
  GLOB_MAX_RESULTS_CEILING,
  GLOB_MAX_WALK_BYTES,
  GLOB_STDERR_DRAIN_MS,
  GLOB_MAX_STDERR_BYTES,
  GLOB_REFUSAL_TEXT,
  GLOB_REFUSAL_FAMILIES,
  GLOB_PLACEMENTS,
  globIsBeneath,
  openAnchoredWalkRoot,
  verifyGlobResultsBeneath,
  globArgv,
  GLOB_OUTPUT_PROTOCOL_ARGV,
  parseWalkOutput,
  createAnchoredGlobBackend as createProductionGlobBackend,
} from '../../../../tools/search-family/src/glob-backend.mjs'
export {
  CANCEL_CODE_ABORTED,
  CANCEL_CODE_UNCONFIRMED,
  callAborted,
  createOwnedStop,
  raceConfinedSettle,
} from '../../../../tools/search-family/src/cancel-leg.mjs'

// ── U6 PR3: the shell-class mechanics + the confined shell EXECUTOR moved
// VERBATIM to the process family lane (`packages/tools/process-family/`,
// owner role: see that lane's README). This center file keeps the OLD export
// surface as a re-export so every pinned consumer — a5b2-exit-code-fidelity,
// a5b3-cancel-leg, alpha5-glue7-plane-backends, team-tool-plane — resolves
// UNCHANGED (the PR2 fs-family precedent); the family lane is now the single
// home of the shell-slice logic. (U6 PR5: SYSTEM_RX's one center consumer
// was the archived glob row's provider grant builder — it moved with the
// row; the symbol never had a center export to keep.)
import {
  raceShellSettle,
  shellCancelled,
  SHELL_STREAM_DRAIN_MS,
  drainShellStdio,
  createConfinedShellBackend,
} from '../../../../tools/process-family/src/index.mjs'
export {
  raceShellSettle,
  shellCancelled,
  SHELL_STREAM_DRAIN_MS,
  drainShellStdio,
  createConfinedShellBackend,
}

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
