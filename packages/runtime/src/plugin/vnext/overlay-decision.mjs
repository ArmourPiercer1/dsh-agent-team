/**
 * overlay-decision.mjs — the durable permission overlay, as a per-call RESTRICTION beside the centre's
 * lane verdict.
 *
 * WHY THIS MODULE EXISTS. The retired Alpha.4 entry consulted the durable overlay through a
 * `tools/pre-execute` adapter of its own. The A1 cut retired that adapter WITH the execution route, so a
 * `grantInstance` deny persisted after a Member was bound lost its decision-side effect entirely. The
 * centre stays the ONE decision point; what it was missing was a supplier for the `overlayDecision` port
 * it already accepts. This is that supplier, and only that: it can REMOVE authority, never grant it.
 *
 * THE ASYNC/SYNC SPLIT, stated precisely (it is the whole design).
 * The port is synchronous (`admission-port.mjs` calls it while it holds the lane verdict), but both
 * inputs it needs are asynchronous:
 *
 *   - the durable row (`overlay.latest(...)`), and
 *   - the operation's canonical identity (`canonicalizeOperation`, which resolves file targets through
 *     the injected fs seam).
 *
 * So the work is SPLIT, not cached across a mutation: an async `prepare(exec)` runs in a listener that is
 * registered AHEAD of the centre's, resolves the row and the operation ONCE for that call, and stores
 * them under the call's argument object. The synchronous `decide(facts)` then reads that entry and calls
 * the FROZEN Alpha.2 resolver. Nothing canonicalizes inside the synchronous port.
 *
 * THE ROW IS READ PER CALL, THE RULE VIEW IS CACHED PER GENERATION. A durable mutation bumps the
 * overlay's generation, and a cache keyed on anything else (the binding's compiled revision included)
 * would keep serving the pre-mutation rules — exactly the stale authority this module exists to avoid.
 * Keying the parsed view on the generation read for THIS call cannot go stale: a later mutation produces
 * a generation the cache has never seen. Parsing is synchronous; the cache merely avoids re-deriving the
 * same immutable snapshot for every call of a generation.
 *
 * WHAT IT DOES NOT DO. It does not read a second store, build a second authority, or reinterpret the
 * overlay's carrier grammar: the row is decoded with the SAME `parsePermissionResourceText` the mutation
 * kernel renders it with, and the verdict is the SAME `resolveOperationPermission` the retired adapter
 * used. `ask` and `allow` overlay rules are not expressed here: the admission port's contract is
 * "deny | no-opinion | undefined" (a restriction, or an explicit abstention), so this supplier answers
 * `deny` only when a stored rule restricts a face it can express. A durable ALLOW can never widen the
 * compiled lane, and a durable ASK is not turned into a deny by this module.
 *
 * SHAPE B (CCR search-face, round 63): the overlay governs ONLY the faces inside the closed permission
 * vocabulary. For anything else (`grep`/`glob`/`web_fetch`/…) it answers `no-opinion` — never a deny and
 * never a fault — so the compiled lane alone judges the call. A canonicalization fault on a COVERED
 * tool is still a fault (and therefore still a refusal).
 *
 * @module packages/runtime/src/plugin/vnext/overlay-decision
 */

import { canonicalizeOperation, isPermissionToolName } from '../../../operation-permission/canonical-operation.js'
import { resolveOperationPermission } from '../../../operation-permission/permission-resolver.js'
import { parsePermissionResourceText } from '../../../governance/permission-mutation.js'

/** The resolver policy used for the overlay lane: no rule ⇒ no opinion (not a deny). */
const OVERLAY_POLICY = Object.freeze({ default: 'allow' })

/** The empty lane view of a Team that never carried an overlay. */
const EMPTY_VIEW = Object.freeze({ deny: Object.freeze([]) })

function isRecord (value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Decode ONE immutable overlay snapshot into the deny-lane descriptions this module can judge.
 * Throws on a carrier the kernel's own grammar cannot decode: dropping a durable deny rule would
 * silently retire it, which is the one failure direction this module must never take.
 */
function viewOf (snapshot) {
  if (snapshot === undefined || snapshot === null) return EMPTY_VIEW
  const rules = snapshot.state?.rules
  if (!Array.isArray(rules)) {
    throw new Error('overlay-decision: the durable overlay row carries no rule array')
  }
  const deny = []
  for (const rule of rules) {
    if (!isRecord(rule) || typeof rule.operation !== 'string' || rule.effect !== 'deny') continue
    const matcher = parsePermissionResourceText(String(rule.resource))
    if (matcher === undefined) {
      throw new Error(
        `overlay-decision: the durable overlay deny for ${JSON.stringify(rule.operation)} carries a resource ${JSON.stringify(rule.resource)} outside the carrier grammar; dropping it would retire a stored restriction`,
      )
    }
    deny.push(Object.freeze({ operation: rule.operation, matcher: Object.freeze(matcher) }))
  }
  return Object.freeze({ deny: Object.freeze(deny) })
}

/** Read the generation the snapshot was written at (the cache key, never a verdict). */
function generationOf (snapshot) {
  if (snapshot === undefined || snapshot === null) return 0
  const generation = Number(snapshot.metadata?.generation)
  if (!Number.isFinite(generation) || generation < 0) {
    throw new Error(
      `overlay-decision: the durable overlay answered a non-generation (${JSON.stringify(snapshot.metadata?.generation)}); a row whose generation cannot be read is never treated as generation 0`,
    )
  }
  return generation
}

/**
 * Materialize one call's `CanonicalRules` from the generation's decoded view.
 *
 * `subtree` containment is per-operation by contract (the A5 seam's `FileSystem.contains` is the only
 * legal authority). It is computed by `prepare`, which alone may await the seam, and arrives here as
 * the frozen `contained` map (rootKey -> boolean). A `subtree` whose containment could not be judged
 * was recorded as MATCHING: the lane asymmetry is that a deny that cannot be judged is never dropped.
 */
function canonicalRulesOf (view, operation, contained) {
  const deny = []
  for (const entry of view.deny) {
    const { kind, resource } = entry.matcher
    if (kind === 'exact') {
      deny.push(Object.freeze({ tool: entry.operation, resource: Object.freeze({ kind: 'exact', key: resource }) }))
    } else if (kind === 'subtree') {
      deny.push(
        Object.freeze({
          tool: entry.operation,
          resource: Object.freeze({
            kind: 'subtree',
            rootKey: resource,
            containsOperation: contained.get(resource) === true,
          }),
        }),
      )
    }
    // `fingerprint` is judged directly by `denyFingerprint` below; the frozen resolver cannot express it.
  }
  return Object.freeze({ allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze(deny) })
}

/** `true` when a stored exec (fingerprint) deny names this operation's exact impact identity. */
function denyFingerprint (view, operation) {
  if (operation.resource.kind !== 'tool') return false
  return view.deny.some(
    (entry) =>
      entry.matcher.kind === 'fingerprint' &&
      entry.matcher.resource === operation.fingerprint &&
      entry.operation === operation.tool,
  )
}

/**
 * Build the overlay supplier for ONE Member bind.
 *
 * @param {object} input
 * @param {{latest: (identity: object) => Promise<object|undefined>}} input.overlay -
 *   the SAME durable port the mutation lane appends through (`root.ts`'s `permissionOverlay`).
 * @param {string} input.teamSessionId - the durable overlay identity's team session.
 * @param {string} input.memberInstanceId - the durable overlay identity's Member instance.
 * @param {string|undefined} input.workspaceRoot - the canonicalization cwd (the Member's real workspace).
 * @param {() => {resolve: Function, contains?: Function}|undefined} input.fsOf - the lazy per-call fs seam;
 *   `contains` is the pinned public `FileSystem.contains`, the ONE legal subtree authority.
 * @returns {{prepare: (exec: object) => Promise<void>, decide: (facts: object) => 'deny'|'no-opinion'|undefined}}
 */
export function createOverlayDecisionProvider ({ overlay, teamSessionId, memberInstanceId, workspaceRoot, fsOf }) {
  if (overlay === undefined || overlay === null || typeof overlay.latest !== 'function') {
    throw new TypeError('overlay-decision: a supplier needs the durable overlay port (latest)')
  }
  if (typeof fsOf !== 'function') {
    throw new TypeError('overlay-decision: a supplier needs the lazy fs seam (the canonicalization basis)')
  }
  /** Per-call prepared state, keyed by the execution's argument object (the object the port receives). */
  const prepared = new WeakMap()
  /** generation -> decoded view (immutable; a new generation is a new key). */
  const views = new Map()

  const resolveTarget = (fs, handles) => async (path) => {
    if (fs === undefined) {
      throw new Error('overlay-decision: the fs seam is absent, so a file operation cannot be canonicalized')
    }
    const resolved = await fs.resolve(path, workspaceRoot === undefined ? {} : { cwd: workspaceRoot })
    const key = typeof resolved === 'string' ? resolved : resolved?.targetKey
    if (typeof key !== 'string' || key === '') {
      throw new Error(`overlay-decision: the fs seam resolved ${JSON.stringify(path)} to no canonical key`)
    }
    const display = typeof resolved === 'string' ? path : resolved?.displayPath ?? path
    // The A2 resolver seam contract: `{ key, display }`, key opaque and authoritative, display UI-only.
    // The opaque handle rides along for the ONE legal containment authority; the canonicalizer ignores it.
    if (typeof resolved === 'object' && resolved !== null) handles.set(key, resolved)
    return { key, display, ...(typeof resolved === 'object' && resolved !== null ? { handle: resolved } : {}) }
  }

  /**
   * Judge every stored `subtree` deny against THIS operation. Asynchronous by nature (the seam may be),
   * so it runs here — never in `decide`. Undeterminable ⇒ MATCHING, because a deny that cannot be judged
   * must never be dropped; a tool-level operation (no file key) has no file containment to judge, so a
   * file `subtree` rule does not match it.
   */
  const containedOf = async (view, operation, handles, fs) => {
    const contained = new Map()
    for (const entry of view.deny) {
      if (entry.matcher.kind !== 'subtree') continue
      const rootKey = entry.matcher.resource
      if (operation.resource.kind !== 'file') {
        contained.set(rootKey, false)
        continue
      }
      const operationHandle = handles.get(operation.resource.key)
      if (operationHandle === undefined || fs === undefined || typeof fs?.contains !== 'function') {
        contained.set(rootKey, true)
        continue
      }
      try {
        // The pinned public seam: both sides are targets of the SAME provider. The stored root is a
        // canonical key, and the host's own plane presents canonical keys to this seam the same way
        // (`fsContainsKeys` in host.ts), so the key is wrapped rather than parsed.
        const verdict = await fs.contains({ targetKey: rootKey }, operationHandle)
        contained.set(rootKey, verdict === true)
      } catch {
        contained.set(rootKey, true)
      }
    }
    return contained
  }

  const prepare = async (exec) => {
    const args = exec?.arguments
    if (!isRecord(args)) return
    // SHAPE B (CCR search-face, round 63). The durable overlay governs ONLY the faces its closed
    // permission vocabulary can express (read/read_image/write/edit + bash/pwsh). A tool it cannot
    // classify — `grep`, `glob`, `web_fetch`, … — is NOT a fault: the overlay has NO OPINION about
    // it, and the compiled LANE alone judges the call. Turning `tool-unsupported` into a fault made
    // the overlay refuse calls the lane allowed; answering `no-opinion` keeps the lane's verdict and
    // makes the durable fact say WHY the overlay abstained. This is checked by vocabulary membership
    // (the same closed set `canonicalizeOperation` throws from), BEFORE any canonicalization, and it
    // deliberately applies ONLY to such tools: a covered tool whose canonicalization fails still
    // records a fault below and is still refused with ADMISSION_OVERLAY_FAULT.
    if (!isPermissionToolName(exec.name)) {
      prepared.set(args, { noOpinion: true })
      return
    }
    try {
      // The seam is read lazily: a tool-level call (the shell class) needs no file resolution, so an
      // absent fs must not turn a shell call into a fault. A FILE call that needs it throws below, and
      // `prepare` stores that fault (=> ADMISSION_OVERLAY_FAULT, a refusal).
      let fs
      try {
        fs = fsOf()
      } catch {
        fs = undefined
      }
      if (fs === null || typeof fs?.resolve !== 'function') fs = undefined
      const handles = new Map()
      const operation = await canonicalizeOperation({
        name: exec.name,
        arguments: args,
        resolveTarget: resolveTarget(fs, handles),
      })
      const snapshot = await overlay.latest({ teamSessionId, memberInstanceId })
      const generation = generationOf(snapshot)
      let view = views.get(generation)
      if (view === undefined) {
        view = viewOf(snapshot)
        views.set(generation, view)
      }
      const contained = await containedOf(view, operation, handles, fs)
      prepared.set(args, { operation, view, contained })
    } catch (error) {
      // A fault is stored, not thrown out of the host's waterfall: the synchronous port turns it into
      // the admission contract's OWN fault refusal (ADMISSION_OVERLAY_FAULT), which is a deny.
      prepared.set(args, { fault: error instanceof Error ? error : new Error(String(error)) })
    }
  }

  const decide = (facts) => {
    const args = facts?.arguments
    const entry = isRecord(args) ? prepared.get(args) : undefined
    if (entry === undefined) {
      throw new Error(
        'overlay-decision: the durable overlay was consulted for a call this supplier never prepared; an unsurveyed call is a fault, never a silent absence of opinion',
      )
    }
    if (entry.fault !== undefined) throw entry.fault
    // The overlay cannot express this face, so it never DENIES and never faults: the lane's verdict
    // stands. `no-opinion` (not `undefined`) is the recorded answer, so the durable fact can tell
    // "outside the vocabulary" from "consulted and not restricted".
    if (entry.noOpinion === true) return 'no-opinion'
    if (entry.operation.tool !== facts.toolName) {
      throw new Error(
        `overlay-decision: the prepared operation is for tool ${JSON.stringify(entry.operation.tool)}, not ${JSON.stringify(facts.toolName)}`,
      )
    }
    if (denyFingerprint(entry.view, entry.operation)) return 'deny'
    const decision = resolveOperationPermission(
      OVERLAY_POLICY,
      entry.operation,
      canonicalRulesOf(entry.view, entry.operation, entry.contained),
    )
    return decision.decision === 'deny' ? 'deny' : undefined
  }

  return Object.freeze({ prepare, decide })
}
