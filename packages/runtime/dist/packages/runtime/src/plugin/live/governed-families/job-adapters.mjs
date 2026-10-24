/**
 * governed-families/job-adapters.mjs — A5-M2 governed-adapter rows for the
 * FC-JOB census family B-JOB: record 18 job_output / 19 job_list / 20 job_kill
 * (frozen dispatch index M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json; family law
 * M0-B-FAMILY-TARGET-CONTRACTS.md#B-JOB). UNWIRED at this landing: NOTHING
 * here registers or mounts anything; the PAIRED registration writer feeds
 * `familyRegistrations()` entries at the mount moment exactly as the
 * B-SUBAGENT/B-SCHEDULE families do (registration keys stay placement-feed
 * minted, never hand-spelled). The mount (real-plane injection + agent-bindings
 * registration) is the paired follow-up slice — the same staged landing the
 * B-SUBAGENT controls lane used (adapter+wiring first, shared-plane mount next).
 *
 * ── THE REAL SURFACE THIS ROW ADAPTS (measured read-only) ──────────────────
 * The body is the LANDED governed jobs bridge (plane-effect-backends.mjs
 * `createGovernedJobsBridge`, the plane's fixed job_output/job_list/job_kill
 * takeover row), whose effect face is the host `JobRegistry` PUBLIC service
 * (`ctx.get('jobs')` @639ed01539; every management op is caller-scopable). The
 * bridge enforces the TWO-FENCE ORDER this row records but never re-implements:
 *  1. the gateway member-scope owner fence (`checkManagementAccess`) answers
 *     FIRST — a Team-layer refusal NEVER reaches the host layer;
 *  2. an un-attributed jobId passes `corded:false` — the host's caller fence
 *     (`exec.agent?.id`, exactly what the host tool passes) stays authoritative
 *     and the bridge never invents ownership;
 *  3. `kill` answers the host's two native forms — 'requested' marks the
 *     REQUEST (NAMED GAP KILL_REQUESTED_NOT_TERMINATED: settlement belongs to
 *     the producer; C3 restart-resumes-observation-only, never respawns).
 * The family records the FENCE ANSWER as the S-side truth; it adds NO authority
 * of its own and NO native fallback (the plane row IS the mount).
 *
 * CONTRACT FACE (M0-B-FAMILY-TARGET-CONTRACTS.md#B-JOB, verbatim): "目标S(真实
 * job owner+jobId+producer incarnation, read/list/cancel)，read 位置/limit入
 * manifest"; E JobRegistry start(spec.owner)/read/readAt/list/kill/wait — an
 * `owner()` and a `done()` method DO NOT EXIST, so no leaf claims them. The
 * read POSITION is the registry-owned since-last-read cursor (never
 * caller-declared) and the LIMIT is the producer-set outputLimitBytes ceiling;
 * both ride the manifest as LAW (`revision`/`budget` sentences), neither is
 * invented as a number here.
 *
 * ── CANONICAL LEAF LAW (this lane's own copy) ───────────────────────────────
 * argsCanonical/namedGapsCanonical are the mint's OWN `canonicalJson` — the
 * sorted-key JSON.stringify law (subagent-adapters :234-238) — a COMPLETE
 * reversible JSON, explicitly NOT a hash/digest: full job_id/reason text,
 * unknown legal args keys, null and '' survive the round-trip. KEY ORDER is
 * deterministically normalized by that helper; the leaf carries content.
 */

import { createHash } from 'node:crypto'

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The mint's own canonical law (sorted-key JSON; :234-238 verbatim copy). */
const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

const jsonClone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

function deepFreeze (v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v)
    for (const child of Object.values(v)) deepFreeze(child)
  }
  return v
}

export const A5_B_JOB_FAMILY_ID = 'B-JOB'
/** The frozen ADAPTER's own capture/classification revision. Reported as its
 *  own fact on the wiring surface; the FAMILY CLAIM revision the registration/
 *  plan/edge carry advances with the wiring (root 22:02 consistency law) —
 *  this constant is NOT reopened to do that. */
export const A5_B_JOB_ADAPTER_REVISION = 1

/** The three FC-JOB records (frozen dispatch index; the derived recordIndex,
 *  operation and effectDelta are PINNED against the index in the author spec,
 *  never hand-spelled from memory). */
export const A5_B_JOB_RECORD_SPECS = Object.freeze({
  job_output: Object.freeze({ recordIndex: 18, operation: 'job-output', effectDelta: 'durable-state-read', jobIdRequired: true }),
  job_list: Object.freeze({ recordIndex: 19, operation: 'job-list', effectDelta: 'durable-state-read', jobIdRequired: false }),
  job_kill: Object.freeze({ recordIndex: 20, operation: 'job-kill', effectDelta: 'job-control-durable-write', jobIdRequired: true }),
})

/** Honest whole-family boundary (NAMED GAPS), carried verbatim on every
 *  minted manifest as namedGapsCanonical — the family does not hide what it
 *  does not close. */
export const A5_B_JOB_NAMED_GAPS = Object.freeze({
  KILL_REQUESTED_NOT_TERMINATED: 'job_kill answers the host forms "requested" | "already-finished"; a REQUEST is recorded (noteKillRequested) and NEVER settles the job — settlement belongs to the producer hooks.done + real resource termination (PR1 Gate R4; C3 restart-resumes-observation-only, never respawns).',
  RESTART_RECOVERY_OPEN: 'restart recovery is OPEN on the census lifecycle (route-records job_kill: "kill-requested-not-terminated;restart-recovery-OPEN"); this row observes it, it does not claim it closed.',
  PRODUCER_INCARNATION_FACE: 'the contract names the producer INCARNATION as target-S; the honest seat is the JobRegistry read of the job projection (kind + startedAt) via the pure view probe — an absent job answers "unobserved", never an invented incarnation. The contract names NO owner()/done() method and no leaf claims one.',
  UNATTRIBUTED_CORDED_FALSE_PASSTHROUGH: 'a jobId the Team lane never attributed passes corded:false — the host caller fence (exec.agent?.id) stays authoritative; this row records the fence answer, it never invents ownership and never answers for the host layer.',
  MOUNT_UNWIRED: 'this landing is the adapter+wiring; the real-plane injection + agent-bindings family registration is the paired follow-up slice. No Host, no C2/C3 claim from this module — tier 接线未测 holds until the mount lands and runs on a real Host.',
})

export const A5_B_JOB_ADAPTER_CODES = Object.freeze({
  INPUT_INVALID: 'JOB_ADAPTER_INPUT_INVALID',
  ARGS_UNTYPED: 'JOB_ADAPTER_ARGS_UNTYPED',
  JOB_ID_REQUIRED: 'JOB_ADAPTER_JOB_ID_REQUIRED',
  BRIDGE_DRIFT: 'JOB_ADAPTER_BRIDGE_DRIFT',
  PLACEMENT_KEY_ABSENT: 'JOB_ADAPTER_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'JOB_ADAPTER_PLACEMENT_KEY_MOVED',
})

function refuse (code, detail) { return Object.freeze({ ok: false, refused: true, code, detail }) }

/** THE WALK-PAIRING VALUES: the frozen parameter law per operation, verbatim
 *  from the real 639 host surface (tool-jobs index.ts @639ed01539 :311-400 —
 *  the same spellings the plane row mirrors at team-tool-plane :3049-3086).
 *  The fingerprint is sha256 over this frozen face under the mint's OWN
 *  canonical law (the same law the canonical leaves ride) — pairing the walk
 *  with the DEFINITION the model was shown, never a minted constant. */
export const A5_B_JOB_PARAM_LAWS = Object.freeze({
  job_output: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      job_id: Object.freeze({ type: 'string', description: 'Job id returned by the tool that started the background work.' }),
      wait: Object.freeze({ type: 'boolean', description: 'Block until the job finishes or the timeout expires; a timed-out wait leaves the job running. Defaults to false.' }),
      timeout_ms: Object.freeze({ type: 'number', description: 'Max wait in milliseconds with wait: true.' }),
    }),
    required: Object.freeze(['job_id']),
  }),
  job_list: Object.freeze({ type: 'object', properties: Object.freeze({}) }),
  job_kill: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      job_id: Object.freeze({ type: 'string', description: 'Job id returned by the tool that started the background work.' }),
      reason: Object.freeze({ type: 'string', description: 'Optional short reason, recorded in the log and forwarded to the job.' }),
    }),
    required: Object.freeze(['job_id']),
  }),
})

export const A5_B_JOB_PARAM_FINGERPRINTS = Object.freeze(Object.fromEntries(
  Object.entries(A5_B_JOB_PARAM_LAWS).map(([name, law]) => [name, `sha256:${createHash('sha256').update(canonicalJson(law)).digest('hex')}`]),
))

/** The per-operation typed argument law, measured from the real host tool
 *  surface (tool-jobs index.ts @639ed01539). NO coercion (581-1 FIX 1): a
 *  non-record is refused, never folded into {}. Unknown keys are NOT refused
 *  here — they ride WHOLE in argsCanonical (the completeness law); the host
 *  schema is the enforcement face, this mirror only refuses the MALFORMED. */
function classifyArgs (name, rawArgs) {
  if (!isRecord(rawArgs)) {
    return refuse(A5_B_JOB_ADAPTER_CODES.ARGS_UNTYPED, `${name}: args must be a plain record — null/undefined are never coerced into {}`)
  }
  const spec = A5_B_JOB_RECORD_SPECS[name]
  if (spec === undefined) return refuse(A5_B_JOB_ADAPTER_CODES.ARGS_UNTYPED, `${name}: not a B-JOB operation`)
  if (spec.jobIdRequired) {
    if (typeof rawArgs.job_id !== 'string' || rawArgs.job_id.length === 0) {
      return refuse(A5_B_JOB_ADAPTER_CODES.JOB_ID_REQUIRED, `${name}: job_id must be a non-empty string BEFORE any registry entry (the host validateJobId law)`)
    }
  }
  if (name === 'job_output') {
    if (rawArgs.wait !== undefined && typeof rawArgs.wait !== 'boolean') return refuse(A5_B_JOB_ADAPTER_CODES.ARGS_UNTYPED, 'job_output: wait must be a boolean when present')
    if (rawArgs.timeout_ms !== undefined && !(typeof rawArgs.timeout_ms === 'number' && Number.isFinite(rawArgs.timeout_ms))) return refuse(A5_B_JOB_ADAPTER_CODES.ARGS_UNTYPED, 'job_output: timeout_ms must be a finite number when present')
  }
  if (name === 'job_kill' && rawArgs.reason !== undefined && typeof rawArgs.reason !== 'string') {
    return refuse(A5_B_JOB_ADAPTER_CODES.ARGS_UNTYPED, 'job_kill: reason must be a string when present')
  }
  return Object.freeze({ ok: true, snapshot: deepFreeze(jsonClone(rawArgs)), parametersFingerprint: A5_B_JOB_PARAM_FINGERPRINTS[name] })
}

/**
 * The pure S-side TARGET the plan carries. The fence answer and the job
 * projection are handed in by the CALLER (the wiring, over the pure gateway /
 * view probes) — this seat is pure over (name, snapshot, probe answers) and
 * invents nothing: absent probe answers become the honest 'probe-unavailable'
 * / 'unobserved' words, never a fabricated relation or incarnation.
 */
export function mintBJobTarget (name, snapshot, facts = {}) {
  const spec = A5_B_JOB_RECORD_SPECS[name]
  const jobIdClaim = spec.jobIdRequired ? String(snapshot.job_id) : null
  return Object.freeze({
    contract: 'dsh.pa/family/b-job/v1',
    revision: 'v1 — no revision carrier: kill is a REQUEST (requested≠terminated); reads are registry-owned since-last-read cursors (the read位置 law, never caller-declared); the limit is the producer-set outputLimitBytes ceiling (the limit law) — neither is invented here',
    effect: spec.effectDelta,
    depth: spec.jobIdRequired ? 'one addressed job per call (a foreign/unowned job answers through the two-fence order, this row adds no authority)' : 'the caller-scoped job set in one answer (the host caller fence scopes the list)',
    action: spec.operation,
    caller: typeof facts.caller === 'string' && facts.caller.length > 0 ? facts.caller : '',
    address: Object.freeze({
      claim: jobIdClaim,
      relation: typeof facts.ownerRelation === 'string' && facts.ownerRelation.length > 0 ? facts.ownerRelation : 'probe-unavailable',
      adjudication: typeof facts.ownerAdjudication === 'string' && facts.ownerAdjudication.length > 0 ? facts.ownerAdjudication : 'probe-unavailable',
    }),
    producerIncarnation: typeof facts.producerIncarnation === 'string' && facts.producerIncarnation.length > 0
      ? facts.producerIncarnation
      : (spec.jobIdRequired ? 'unobserved' : 'caller-scoped-sweep'),
    budget: name === 'job_output'
      ? `wait=${snapshot.wait === true ? 'true' : 'false'}, timeoutClaim=${typeof snapshot.timeout_ms === 'number' ? String(snapshot.timeout_ms) : 'default'}; limit=registry-owned outputLimitBytes ceiling`
      : 'none (single management request; settlement and any wait belong to the producer, never here)',
  })
}

/**
 * The governed B-JOB assembly. It classifies + mints + builds the
 * familyRegistrations face; the DELEGATE invokes the injected bridge through
 * the VERIFIED handle only (no fresh property read may reach a drifted bridge;
 * there is no native fallback — the plane row IS the mount).
 *
 * @param {object} input closed keys
 *   providerId       : the family entry's provider identity (verbatim)
 *   bridge           : the landed jobs bridge record { jobOutput, jobList, jobKill }
 *   liveBridge       : () => the CURRENT bridge record (drift re-read)
 *   probe            : async (name, callerId, snapshot) =>
 *                        { caller, ownerRelation, ownerAdjudication, producerIncarnation }
 *                      — the wiring's pure gateway/view probe seat (absent
 *                        answers degrade to the honest 'probe-unavailable'/
 *                        'unobserved' words via mintBJobTarget)
 *   placementFeed    : (name) => { definitionIdentity } | undefined
 */
export function createBJobGovernedAssembly (input = {}) {
  const providerId = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : null
  const bridge = isRecord(input.bridge) ? input.bridge : null
  if (providerId === null) return refuse(A5_B_JOB_ADAPTER_CODES.INPUT_INVALID, 'providerId is required (the family entry carries the provider identity verbatim)')
  if (bridge === null || typeof input.liveBridge !== 'function') return refuse(A5_B_JOB_ADAPTER_CODES.INPUT_INVALID, 'the jobs bridge + liveBridge (drift re-read) are required — the plane row IS the mount, there is no native fallback')
  const bound = Object.freeze({ bridge, jobOutput: bridge.jobOutput, jobList: bridge.jobList, jobKill: bridge.jobKill })

  const verifyBridge = (name) => {
    const live = input.liveBridge()
    if (!isRecord(live) || live !== bound.bridge) {
      return refuse(A5_B_JOB_ADAPTER_CODES.BRIDGE_DRIFT, `${name}: the CURRENT jobs bridge read is not the bound bridge object — a replaced bridge underneath this mount is drift, full stop`)
    }
    for (const [key, fn] of [['jobOutput', bound.jobOutput], ['jobList', bound.jobList], ['jobKill', bound.jobKill]]) {
      if (live[key] !== fn) return refuse(A5_B_JOB_ADAPTER_CODES.BRIDGE_DRIFT, `${name}: the bridge method '${key}' was rebound underneath the frozen bind — the delegate rides the VERIFIED handle, never a fresh property read`)
    }
    return Object.freeze({ ok: true, methods: bound })
  }

  // THE MOUNT-MOMENT REGISTRATION (sibling law): placement-feed keys only.
  const mountedKeys = new Map()
  const familyRegistrations = () => Object.freeze(Object.entries(A5_B_JOB_RECORD_SPECS).map(([name, spec]) => {
    const fed = typeof input.placementFeed === 'function' ? input.placementFeed(name) : undefined
    const key = isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0 ? fed.definitionIdentity : null
    if (key === null) {
      throw new Error(`${A5_B_JOB_ADAPTER_CODES.PLACEMENT_KEY_ABSENT}: the placed row '${name}' answered no definition identity through the placement feed — the family registration has no trusted key; a guessed key is forbidden`)
    }
    const seen = mountedKeys.get(name)
    if (seen !== undefined && seen !== key) {
      throw new Error(`${A5_B_JOB_ADAPTER_CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${name}' moved between mount reads (${seen} -> ${key}) — the mount is broken and re-registers nothing`)
    }
    mountedKeys.set(name, key)
    return Object.freeze({
      name,
      recordIndex: spec.recordIndex,
      definitionIdentity: key,
      entry: Object.freeze({ familyId: A5_B_JOB_FAMILY_ID, adapterRevision: A5_B_JOB_ADAPTER_REVISION, providerIdentity: providerId }),
    })
  }))

  return Object.freeze({
    ok: true,
    familyId: A5_B_JOB_FAMILY_ID,
    revision: A5_B_JOB_ADAPTER_REVISION,
    providerId,
    placementNames: Object.freeze(['job_kill', 'job_list', 'job_output']),
    classifyArgs,
    mintTarget: (name, snapshot, facts) => mintBJobTarget(name, snapshot, facts),
    canonicalJson,
    namedGaps: A5_B_JOB_NAMED_GAPS,
    verifyBridge,
    familyRegistrations,
  })
}
