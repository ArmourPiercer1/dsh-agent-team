/**
 * a5sf-acceptance-preflight.mjs — the HOST-FREE contract of the P2-01 six-row
 * live acceptance (the run after `evidence/a5sf-acceptance/`, PR #575).
 *
 * WHY THIS MODULE EXISTS. The #575 boot spent the last budgeted P2-01 Host
 * start and every one of the six rows came back `NOT_REACHED`, but the run
 * record still printed numbers (`FAIL:6 NOT_REACHED:1`). Three defects made
 * that possible, and none of them needed a Host to find:
 *
 *   1. **CREATE-ROOT ≠ OBSERVE-ROOT.** The acceptance Team was created under
 *      `session-a5sf-acceptance-team` while `GET /__p6t6/state` and
 *      `POST /__p6t6/tool` read `directive.rootSessionId`
 *      (`session-a5sf-acceptance-root`). The row oracle therefore inspected
 *      the ANCHOR team — a different Team — and rows 5/6 were unanswerable
 *      before any product behaviour was considered.
 *   2. **DISPOSE-FAULT FILTER MATCHED A SESSION NAME.** Observations are free
 *      text (`a5p1-guard: guard-installed agent=session-a5sf-acceptance-team`),
 *      so a `/a5sf/i` filter counted EVERY observation in the world as a
 *      dispose fault. The replacement in #575 matched fault *phrases* but still
 *      had no notion of the managed identity.
 *   3. **THE 320-CHAR RESULT CLIP.** The activation refusal's cause
 *      `(deferred …)` was lost with the World, so the finding had to be rebuilt
 *      by a later probe.
 *
 * This module is the ONE place those three contracts live, so the driver and a
 * host-free test can share them:
 *
 *   - {@link P2_01_ACCEPTANCE_ROOTS} / {@link assertAcceptanceRootWiring} —
 *     the identity contract: creation, state query, tool route, archive and
 *     the row oracle address ONE root value, and the driver reads it from this
 *     constant (not from a second literal).
 *   - {@link classifyDisposeFaults} — an identity-first classifier: only the
 *     two typed fault grammars count, a fault that names a session is matched
 *     by EXACT session id, and a non-fault line that merely contains the
 *     session name is not a fault.
 *   - {@link judgeAcceptanceRow} (and the six `judgeRowN` functions) — a
 *     THREE-WAY oracle per row. Every judge separates:
 *       NOT_REACHED  the observable the row asserts was never produced (the
 *                    drive never arrived at the asserted step, or the evidence
 *                    channel that carries it never existed);
 *       REFUTED      the observable exists and CONTRADICTS the row's claim;
 *       PROVEN       the observable exists and satisfies every clause.
 *     A row whose "pass" could be produced by `null` inputs is impossible here:
 *     each judge's first branch is the reachability predicate.
 *
 * WHAT THIS MODULE IS NOT: it does not observe anything, spawn anything, or
 * read a Host log. It is a pure decision contract over evidence the driver
 * collected. Every value it returns is a verdict plus the reason codes that
 * distinguish the three outcomes, so a reader can audit the classification
 * without the World.
 *
 * @module tests/world-factory/lib/a5sf-acceptance-preflight
 */

/**
 * The verdict vocabulary of the six rows. `PROVEN`/`REFUTED`/`NOT_REACHED` map
 * 1:1 onto the shared run record's `PASS`/`FAIL`/`NOT_REACHED`; the mapping is
 * done by {@link toRunVerdict} so a driver cannot invent a fourth word.
 */
export const ACCEPTANCE_VERDICTS = Object.freeze(['PROVEN', 'REFUTED', 'NOT_REACHED'])

/** The run-record word for each acceptance verdict (closed, total). */
const RUN_VERDICT = Object.freeze({ PROVEN: 'PASS', REFUTED: 'FAIL', NOT_REACHED: 'NOT_REACHED' })

/**
 * @param {'PROVEN'|'REFUTED'|'NOT_REACHED'} verdict
 * @returns {'PASS'|'FAIL'|'NOT_REACHED'}
 */
export function toRunVerdict(verdict) {
  const mapped = RUN_VERDICT[verdict]
  if (mapped === undefined) throw new Error(`not an acceptance verdict: ${JSON.stringify(verdict)}`)
  return mapped
}

/** The six rows + the composition precondition (the same case ids #575 used). */
export const ACCEPTANCE_CASES = Object.freeze([
  'live:composition-precondition-read-surface',
  'live:row1-read-a-inside-both-allowed',
  'live:row2-read-b-binding-deny-exactly-one-fact',
  'live:row3-read-c-refused-no-widening',
  'live:row4-write-b-ceiling-allowed-no-read-lane-fact',
  'live:row5-post-invalidation-refused-shadow-invalidated',
  'live:row6-teardown-no-usable-unconstrained-shadow',
])

/** The product's typed refusal code the row-5 admission gate materialises. */
export const INVALIDATED_CODE = 'A5SF_NATIVE_SHADOW_INVALIDATED'
/** The refusal error's typed name (the row 5 assertion checks both). */
export const INVALIDATED_NAME = 'A5sfNativeShadowInvalidatedError'
/** The binding identity the two-axis composition declares for native `read`. */
export const READ_BINDING_IDENTITY = 'dsh.fs/read'

/** The two refusal phrases the shipped guard emits (source: path-rules/guard). */
const LANE_REFUSAL = /outside every allow subtree of the lane/

// ─────────────────────────────────────────────────────────────────────────────
// 1. the root-identity contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed refusal for a broken root wiring. A driver that creates the Team on a
 * different root than it observes must fail BEFORE the grant, never after the
 * boot.
 */
export class AcceptanceRootMismatch extends Error {
  /**
   * @param {string} detail
   * @param {object} [extra]
   */
  constructor(detail, extra = {}) {
    super(`ACCEPTANCE_ROOT_MISMATCH: ${detail}`)
    this.name = 'AcceptanceRootMismatch'
    this.code = 'ACCEPTANCE_ROOT_MISMATCH'
    this.detail = detail
    Object.assign(this, extra)
  }
}

const isNonBlank = (value) => typeof value === 'string' && value.trim() !== ''

/**
 * Build the ONE root identity the acceptance driver uses.
 *
 * There are TWO roots in the World and they are not interchangeable:
 *   - `bootRoot` — the root the PRODUCTION row anchors at boot (`bootPhase:
 *     create`). It owns the discovery leader and is where `apiPrompt` samples
 *     the model-visible surface. It is NOT the acceptance Team: `team.create`
 *     on an already-bound root takes the COLD path and refuses a different
 *     blueprint (`TEAM_CREATE_BLUEPRINT_MISMATCH`, source
 *     `packages/runtime/src/plugin/s6-remote.ts`), so the dynamically-built
 *     acceptance blueprint cannot be bound there.
 *   - `teamRoot` — the root the acceptance Team is created on, and therefore
 *     the ONLY root `/__p6t6/state`, `/__p6t6/tool`, the archive dispatch and
 *     the row oracle may address.
 *
 * The returned object exposes the SAME value under every observation name, so
 * no caller needs a second literal; {@link assertAcceptanceRootWiring} proves
 * the equality and throws the typed refusal otherwise.
 *
 * @param {{bootRoot: string, teamRoot: string}} input
 * @returns {Readonly<{bootRoot: string, teamRoot: string, createRoot: string,
 *   stateQueryRoot: string, toolRouteRoot: string, archiveRoot: string,
 *   oracleRoot: string, directiveRoot: string}>}
 */
export function acceptanceRootIdentity({ bootRoot, teamRoot }) {
  if (!isNonBlank(bootRoot)) throw new AcceptanceRootMismatch(`bootRoot must be a non-blank session id (got ${JSON.stringify(bootRoot)})`)
  if (!isNonBlank(teamRoot)) throw new AcceptanceRootMismatch(`teamRoot must be a non-blank session id (got ${JSON.stringify(teamRoot)})`)
  return Object.freeze({
    bootRoot,
    teamRoot,
    // ONE value, named at every seam. These are deliberately the same string:
    // a future edit that changes one of them is caught by the assertion below
    // and by the host-free test, not by an empty state query after a boot.
    createRoot: teamRoot,
    stateQueryRoot: teamRoot,
    // NOT an observation root: `POST /__p6t6/tool` dispatches by the MEMBER's
    // child session (`as:`), not by a team root. Kept as a label for readers of
    // the record only; the assertion below does NOT count it as evidence.
    toolRouteRoot: teamRoot,
    toolRouteRootIsLabel: true,
    archiveRoot: teamRoot,
    oracleRoot: teamRoot,
    directiveRoot: teamRoot,
  })
}

/**
 * The P2-01 acceptance roots, DECLARED ONCE. `run-boot.mjs` imports this
 * constant; it does not carry a second copy of either literal. That is what
 * makes the host-free assertion meaningful: it checks the exact object the
 * driver uses, not a parallel construction.
 */
export const P2_01_ACCEPTANCE_ROOTS = acceptanceRootIdentity({
  bootRoot: 'session-a5sf-acceptance-root',
  teamRoot: 'session-a5sf-acceptance-team',
})

/**
 * Prove the identity contract on a root object.
 *
 * The contract: creation, the p6t6 directive (state + tool routes), the
 * archive dispatch and the row oracle address ONE root value. The boot root
 * may differ (it owns the anchor team); it may not be used as an observation
 * root for the acceptance rows.
 *
 * @param {object} roots - an object from {@link acceptanceRootIdentity}.
 * @returns {{ok: true, root: string, bootRoot: string}}
 * @throws {AcceptanceRootMismatch} when any observation seam disagrees.
 */
export function assertAcceptanceRootWiring(roots, { productionRowRoot, directiveRoot } = {}) {
  if (roots === null || typeof roots !== 'object') {
    throw new AcceptanceRootMismatch(`roots must be an object (got ${JSON.stringify(roots)})`)
  }
  // `toolRouteRoot` is deliberately NOT in this list: the tool route dispatches
  // by the member child session, so counting it as evidence would inflate the
  // contract with a value no product seam reads.
  const seams = ['createRoot', 'stateQueryRoot', 'archiveRoot', 'oracleRoot', 'directiveRoot']
  const values = seams.map((seam) => [seam, roots[seam]])
  const first = values[0][1]
  if (!isNonBlank(first)) throw new AcceptanceRootMismatch(`createRoot must be a non-blank session id (got ${JSON.stringify(first)})`)
  const disagreeing = values.filter(([, value]) => value !== first)
  if (disagreeing.length > 0) {
    throw new AcceptanceRootMismatch(
      `the acceptance Team would be created on ${JSON.stringify(first)} but ${disagreeing.map(([seam]) => `${seam}=${JSON.stringify(roots[seam])}`).join(', ')}`
      + ' — the state query, the archive dispatch and the row oracle must address the root the Team is created on'
      + ' (this is exactly the #575 defect: the record printed numbers for a different team)',
      { root: first, disagreeing },
    )
  }
  // THE PRODUCTION ROW'S OWN VALUE. The row config anchors the ANCHOR team at
  // boot (`bootPhase: create`); pointing it at the acceptance root passes a
  // naive constant check and then dies at `team.create` with
  // TEAM_CREATE_BLUEPRINT_MISMATCH on the live path.
  if (productionRowRoot !== undefined && productionRowRoot !== roots.bootRoot) {
    throw new AcceptanceRootMismatch(
      `the production team row is anchored on ${JSON.stringify(productionRowRoot)} but the boot root is ${JSON.stringify(roots.bootRoot)}`
      + ' — the anchor team must own the boot root, and the acceptance Team is created on a DIFFERENT root by team.create',
      { root: first, bootRoot: roots.bootRoot, productionRowRoot },
    )
  }
  // THE DIRECTIVE'S OWN VALUE. `GET /__p6t6/state` answers for the directive's
  // `rootSessionId`; a directive built from a second literal is the #575 bug.
  if (directiveRoot !== undefined && directiveRoot !== first) {
    throw new AcceptanceRootMismatch(
      `the p6t6 directive names ${JSON.stringify(directiveRoot)} but the acceptance Team is created on ${JSON.stringify(first)}`
      + ' — the state query would inspect a different team (the #575 defect)',
      { root: first, directiveRoot },
    )
  }
  const out = {
    ok: true,
    root: first,
    bootRoot: String(roots.bootRoot ?? ''),
    rootsCoincide: isNonBlank(roots.bootRoot) && roots.bootRoot === first,
    productionRowRootChecked: productionRowRoot !== undefined,
    directiveRootChecked: directiveRoot !== undefined,
    toolRouteRootIsLabel: true,
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. the dispose-fault identity classifier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two TYPED dispose-fault grammars the shipped row emits. Only these count:
 *
 *   - `a5sf: realm dispose failed: <message>` — producer
 *     `packages/runtime/src/plugin/live/agent-bindings.mjs` (`disposeRealm`
 *     callback; `a5sfRealmDisposers`). It carries NO identity in its text.
 *   - `p6t6: residency dispose failed for '<sessionId>': <message>` — producer
 *     the same file (`residency drop`); it CARRIES the exact session id.
 *
 * `a5sf: native tool shadow INVALIDATED (…)` is NOT a dispose fault; it is a
 * live-surface invalidation and is surfaced separately by
 * {@link classifyLiveSurfaceChange}. It was in #575's regex, which conflated a
 * row-6 fault with row 5's event.
 */
/**
 * Log decoration a REAL Host line can carry before the product text: a leading
 * level tag (`[error] `, `ERROR: `), or the line being JSON-quoted/wrapped.
 * Normalising this is not cosmetic: a prefixed real fault that fell through as
 * `ignoredNonFault` would silently PASS row 6 (review B4).
 */
const OBSERVATION_PREFIX = /^(?:\[(?:error|warn|warning|info|debug|trace|fatal|notice)\]\s*|(?:error|warn|warning|fatal)\s*[:|>-]\s*)+/i

/**
 * Strip log decoration and unwrap a quoted line, so the closed grammar sees the
 * product text. Returns the normalised string (never throws).
 *
 * @param {unknown} observation
 * @returns {string}
 */
export function normalizeObservation(observation) {
  let text = typeof observation === 'string' ? observation : String(observation ?? '')
  text = text.trim()
  for (let round = 0; round < 3; round += 1) {
    const next = text.replace(OBSERVATION_PREFIX, '').trim()
    if (next === text) break
    text = next
  }
  if (text.length >= 2) {
    const first = text[0]
    const last = text[text.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) text = text.slice(1, -1).trim()
  }
  return text
}

const DISPOSE_GRAMMAR = Object.freeze([
  Object.freeze({ kind: 'realm-dispose', re: /^a5sf: realm dispose failed:/, identity: 'unattributed' }),
  // the shipped text is `for '<sid>':`; accept double quotes and an unquoted id
  // so a re-wrapped line is still attributed instead of silently ignored.
  Object.freeze({ kind: 'residency-dispose', re: /^p6t6: residency dispose failed for\s+(?:'([^']+)'|"([^"]+)"|(\S+))\s*:/, identity: 'session' }),
])

/** The row-5 invalidation line (a live surface change, not a fault). */
const LIVE_CHANGE_GRAMMAR = /^a5sf: native tool shadow INVALIDATED \(/

/**
 * Parse ONE observation string against the closed grammar.
 *
 * @param {unknown} observation
 * @returns {{fault: boolean, kind: string|null, sessionId: string|null,
 *   identity: 'session'|'unattributed'|null, liveSurfaceChange: boolean, text: string}}
 */
export function classifyObservation(observation) {
  const text = normalizeObservation(observation)
  for (const rule of DISPOSE_GRAMMAR) {
    const match = rule.re.exec(text)
    if (match !== null) {
      return {
        fault: true,
        kind: rule.kind,
        sessionId: rule.identity === 'session' ? String(match[1] ?? match[2] ?? match[3]) : null,
        identity: rule.identity,
        liveSurfaceChange: false,
        text,
      }
    }
  }
  return {
    fault: false,
    kind: null,
    sessionId: null,
    identity: null,
    liveSurfaceChange: LIVE_CHANGE_GRAMMAR.test(text),
    text,
  }
}

/**
 * Classify the whole observation stream for ONE managed Member.
 *
 * IDENTITY RULES (the #575 defect cannot recur):
 *   1. a non-fault observation is NEVER a fault, even when it contains the
 *      managed session's name (`a5p1-guard: guard-installed agent=<sid>` was
 *      counted as a fault by `/a5sf/i`);
 *   2. a fault that NAMES a session is `managed` only on EXACT string equality
 *      with `managed.sessionId`; a different session's fault is `foreign` and
 *      never counted against this Member;
 *   3. a realm-dispose fault carries no identity. It may only be attributed to
 *      the managed realm through the caller's DISPOSAL WINDOW
 *      (`duringManagedDisposal === true`) and only when the world holds EXACTLY
 *      ONE managed realm (`managedRealmCount === 1`); otherwise it is
 *      `unattributed` and reported, never silently counted.
 *
 * @param {object} input
 * @param {readonly unknown[]} input.observations
 * @param {{sessionId?: string|null, instanceId?: string|null}} [input.managed]
 * @param {boolean} [input.duringManagedDisposal] - true only for the snapshot
 *   taken after THIS Member's archive/residency drop was dispatched.
 * @param {number} [input.managedRealmCount] - managed realms in the world.
 * @returns {{managed: object[], foreign: object[], unattributed: object[],
 *   ignoredNonFaultCount: number, liveSurfaceChanges: object[],
 *   identity: object}}
 */
export function classifyDisposeFaults({
  observations,
  managed = {},
  duringManagedDisposal = false,
  managedRealmCount = 1,
} = {}) {
  const list = Array.isArray(observations) ? observations : []
  const managedSessionId = isNonBlank(managed.sessionId) ? managed.sessionId : null
  const managedInstanceId = isNonBlank(managed.instanceId) ? managed.instanceId : null
  const managedFaults = []
  const foreign = []
  const unattributed = []
  const liveSurfaceChanges = []
  let ignoredNonFaultCount = 0

  for (const raw of list) {
    const parsed = classifyObservation(raw)
    if (parsed.liveSurfaceChange) {
      liveSurfaceChanges.push({ kind: 'native-shadow-invalidated', text: parsed.text })
      continue
    }
    if (!parsed.fault) {
      ignoredNonFaultCount += 1
      continue
    }
    if (parsed.identity === 'session') {
      if (managedSessionId !== null && parsed.sessionId === managedSessionId) {
        managedFaults.push({ ...parsed, attribution: 'exact-session-id' })
      } else {
        foreign.push({ ...parsed, attribution: 'other-session' })
      }
      continue
    }
    // realm-dispose: no identity in the product text.
    const attributable = duringManagedDisposal === true && managedRealmCount === 1
    const entry = {
      ...parsed,
      attribution: attributable ? 'managed-disposal-window' : 'unattributed',
      identityUnattributed: true,
    }
    if (attributable) managedFaults.push(entry)
    else unattributed.push(entry)
  }

  return {
    managed: managedFaults,
    foreign,
    unattributed,
    ignoredNonFaultCount,
    liveSurfaceChanges,
    identity: {
      sessionId: managedSessionId,
      instanceId: managedInstanceId,
      matchedBy: 'exact session id for identity-bearing faults; managed disposal window (single managed realm) for the identity-less realm-dispose fault',
      duringManagedDisposal: duringManagedDisposal === true,
      managedRealmCount,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. the six-row, three-way oracle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build one verdict. Every judge returns this shape:
 * `{verdict, reason, detail}` — `reason` is a CLOSED code so a test can tell
 * NOT_REACHED from REFUTED without reading prose.
 */
function verdict(verdictWord, reason, detail = {}) {
  if (!ACCEPTANCE_VERDICTS.includes(verdictWord)) throw new Error(`not an acceptance verdict: ${JSON.stringify(verdictWord)}`)
  return { verdict: verdictWord, reason, detail: { ...detail, reason } }
}

const reached = (detail) => verdict('NOT_REACHED', detail.reason, detail)
const proven = (detail) => verdict('PROVEN', detail.reason ?? 'CLAIM_HOLDS', detail)
const refuted = (reason, detail) => verdict('REFUTED', reason, detail)

const callPresent = (call, result) => call !== null && call !== undefined && result !== null && result !== undefined
const textOfResult = (result) => String(result?.text ?? '')

/**
 * The composition precondition: an a5sf-wired Member ACTIVATED and its
 * model-visible surface carries exactly ONE native `read`, without duplicate
 * names and without prompt-section drift. NOT a row; it is the gate that makes
 * every row's NOT_REACHED legible.
 */
export function judgePrecondition({ hostAlive, memberRequest, discovery, readCalls }) {
  if (memberRequest === null || memberRequest === undefined) {
    return reached({ reason: 'NO_MEMBER_REQUEST', hostAlive: hostAlive === true, readCalls: Number(readCalls ?? 0) })
  }
  const checks = {
    hostAlive: hostAlive === true,
    memberReadSchemas: memberRequest.readSchemas === 1,
    noDuplicateNames: memberRequest.duplicateNames === false,
    memberPromptNotDrifted: Number(memberRequest.systemPromptReadMentions ?? 0) <= Number(discovery?.readMentions ?? 0),
    memberSectionNotDrifted: Number(memberRequest.systemPromptReadSectionMentions ?? -1) === Number(discovery?.readSectionMentions ?? -2),
    discoveryReadSchemas: discovery?.readSchemas === 1,
    readCallsAtLeast3: Number(readCalls ?? 0) >= 3,
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  if (failed.length > 0) return refuted('PRECONDITION_CLAUSE_FAILED', { checks, failed })
  return proven({ reason: 'MEMBER_ACTIVATED_ONE_READ', checks, memberSurfaceSize: memberRequest.surfaceSize ?? null })
}

/**
 * Row 1 — read A (inside the ceiling AND inside the binding restriction)
 * returns the planted bytes, records a BINDING-realm allow fact, and is served
 * by a CONFINED provider instance (never the base one).
 *
 * NOT_REACHED iff the read call or its result was never produced.
 */
export function judgeRow1({ call, result, claim, allowFacts = [], bindingAllowFacts = [], counterRows = [] }) {
  if (!callPresent(call, result)) return reached({ reason: call == null ? 'NO_READ_CALL_A' : 'NO_READ_RESULT_A' })
  const checks = {
    notError: result.isError !== true,
    claimReturned: textOfResult(result).includes(String(claim)),
    bindingAllowFact: bindingAllowFacts.length >= 1,
    providerServed: counterRows.length >= 1,
    providerConfined: counterRows.every((row) => row?.isBase !== true),
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  if (failed.length > 0) return refuted('ROW1_CLAUSE_FAILED', { checks, failed, isError: result.isError === true, bindingAllowFacts: bindingAllowFacts.length, counterRows: counterRows.length, observed: textOfResult(result) })
  return proven({ reason: 'READ_A_ALLOWED_AND_CONFINED', checks, allowFacts: allowFacts.length, bindingAllowFacts: bindingAllowFacts.length, counterRows: counterRows.length })
}

/**
 * Row 2 — read B (inside the ceiling, OUTSIDE the binding restriction) is
 * refused by the BINDING lane with EXACTLY ONE deny fact carrying the binding
 * identity, no bytes, and no provider read.
 *
 * NOT_REACHED iff the read call or its result was never produced.
 */
export function judgeRow2({ call, result, claim, writeContent = '', facts = [], bindingDenyFacts = [], counterRows = [] }) {
  if (!callPresent(call, result)) return reached({ reason: call == null ? 'NO_READ_CALL_B' : 'NO_READ_RESULT_B' })
  const text = textOfResult(result)
  // THE SAME LOCATOR IS TOUCHED TWICE IN A HEALTHY RUN: the worker reads B
  // (row 2) and later WRITES B (row 4). The write is served by the ceiling
  // realm and emits its own `writeText` fact at the same locator, so counting
  // raw facts made a healthy stream REFUTE row 2 (review B1 — a deterministic
  // false FAIL). The row is about the READ consultation: scope to the read
  // method, and let an unexpected non-read fact be visible in the detail rather
  // than counted.
  const readFacts = facts.filter((fact) => String(fact?.method ?? '') === 'readText')
  const nonReadFacts = facts.filter((fact) => String(fact?.method ?? '') !== 'readText')
  const checks = {
    isError: result.isError === true,
    typedLaneRefusal: LANE_REFUSAL.test(text),
    noClaimLeak: text.includes(String(claim)) !== true,
    noWriteContentLeak: String(writeContent) === '' ? true : text.includes(String(writeContent).trim()) !== true,
    exactlyOneReadFactForB: readFacts.length === 1,
    exactlyOneBindingDeny: bindingDenyFacts.length === 1,
    noProviderRead: counterRows.length === 0,
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  if (failed.length > 0) return refuted('ROW2_CLAUSE_FAILED', { checks, failed, readFactsForB: readFacts.length, nonReadFactsForB: nonReadFacts.map((fact) => ({ method: fact?.method ?? null, decision: fact?.decision ?? null, realm: fact?.realm ?? null })), factsForB: facts.length, bindingDenyFacts: bindingDenyFacts.length, counterRows: counterRows.length, observed: text })
  return proven({ reason: 'BINDING_DENY_EXACTLY_ONE', checks, readFacts: readFacts.length, nonReadFacts: nonReadFacts.length })
}

/**
 * Row 3 — read C (OUTSIDE the ceiling, inside the restriction) is refused and
 * the product's own lane report shows NO WIDENING (ceiling deny + restriction
 * allow ⇒ effective deny).
 *
 * NOT_REACHED iff the call/result never existed, or the lane report (the
 * channel that carries "no widening") was never produced.
 */
export function judgeRow3({ call, result, claim, denyFacts = [], bindingDenyFacts = [], counterRows = [], probeC = null, laneReport = null }) {
  if (!callPresent(call, result)) return reached({ reason: call == null ? 'NO_READ_CALL_C' : 'NO_READ_RESULT_C' })
  if (laneReport === null || laneReport === undefined) return reached({ reason: 'NO_LANE_REPORT_C' })
  if (probeC === null || probeC === undefined) return reached({ reason: 'NO_LANE_PROBE_C' })
  const text = textOfResult(result)
  const effectiveAllow = Array.isArray(laneReport?.effective?.read?.allow) ? laneReport.effective.read.allow : []
  const checks = {
    isError: result.isError === true,
    typedLaneRefusal: LANE_REFUSAL.test(text),
    noClaimLeak: text.includes(String(claim)) !== true,
    exactlyOneBindingDeny: bindingDenyFacts.length === 1,
    noProviderRead: counterRows.length === 0,
    ceilingDenies: probeC.ceilingRead === 'deny',
    restrictionAllows: probeC.restrictionRead === 'allow',
    effectiveDenies: probeC.effectiveRead === 'deny',
    noWidenedAllow: effectiveAllow.includes(String(probeC.locator ?? '')) !== true
      && !effectiveAllow.some((entry) => String(entry).endsWith('/restriction-outside')),
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  if (failed.length > 0) return refuted('ROW3_CLAUSE_FAILED', {
    checks,
    failed,
    denyFacts: denyFacts.length,
    bindingDenyFacts: bindingDenyFacts.length,
    counterRows: counterRows.length,
    probeC,
    effectiveReadAllow: effectiveAllow,
    observed: text,
  })
  return proven({ reason: 'REFUSED_WITHOUT_WIDENING', checks, effectiveReadAllow: effectiveAllow })
}

/**
 * Row 4 — native `write` to B succeeds on the CEILING lane, lands on disk, and
 * produces NO read-lane fact (the sibling lane is not contaminated).
 *
 * NOT_REACHED iff the write call/result never existed; a missing on-disk file
 * after a successful result is REFUTED (the effect channel exists and
 * contradicts the claim).
 */
export function judgeRow4({ call, result, expectedContent, disk, writeFacts = [], ceilingFacts = [], readLaneWriteFacts = [], counterRows = [] }) {
  if (!callPresent(call, result)) return reached({ reason: call == null ? 'NO_WRITE_CALL_B' : 'NO_WRITE_RESULT_B' })
  const checks = {
    notError: result.isError !== true,
    diskMatches: disk === String(expectedContent),
    allowFactPresent: writeFacts.some((fact) => fact?.decision === 'allow'),
    everyWriteFactOnCeiling: writeFacts.length > 0 && ceilingFacts.length === writeFacts.length,
    noReadLaneFact: readLaneWriteFacts.length === 0,
    confinedProviderServed: counterRows.length >= 1 && counterRows.every((row) => row?.isBase !== true),
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  if (failed.length > 0) return refuted('ROW4_CLAUSE_FAILED', {
    checks,
    failed,
    isError: result.isError === true,
    disk,
    expectedContent,
    writeFacts: writeFacts.length,
    ceilingFacts: ceilingFacts.length,
    readLaneWriteFacts: readLaneWriteFacts.length,
    counterRows: counterRows.length,
  })
  return proven({ reason: 'CEILING_WRITE_NO_READ_LANE_FACT', checks })
}

/**
 * Row 5 — after a LIVE surface change invalidates the shadow, the SAME
 * out-of-lane read is refused with the typed admission code, no bytes escape,
 * and no guard fact / provider call appears (the deny fires before either).
 *
 * NOT_REACHED: no member child session in state (#575's actual condition), OR
 * the invalidation event the row is about never happened (the fixture's late
 * tool was not registered / no invalidation line) — in both cases the product
 * was never asked, so REFUTED would be a false report.
 * REFUTED: the question WAS put and the product served bytes or answered
 * without the typed refusal.
 */
export function judgeRow5({
  member,
  lateTrigger = null,
  lateReport = null,
  invalidationLine = null,
  postRead = null,
  inLaneRead = null,
  forbiddenClaim,
  sinkDelta = null,
  counterDelta = null,
}) {
  const memberSession = isNonBlank(member?.childSessionId) ? member.childSessionId : ''
  if (memberSession === '') return reached({ reason: 'NO_MEMBER_CHILD_SESSION_IN_STATE', member: member ?? null })
  // REACHABILITY IS NOT "THE PRODUCT DID NOT INVALIDATE" (review B2). Once the
  // trigger was dispatched, the product was asked. A non-200 trigger, an
  // unregistered late tool, or a registered tool with NO invalidation line is a
  // contradiction, not an absence. Only a trigger that was never dispatched is
  // NOT_REACHED.
  if (lateTrigger === null || lateTrigger === undefined) {
    return reached({ reason: 'NO_INVALIDATION_TRIGGER', member: member ?? null })
  }
  const triggerOk = lateTrigger.ok === true || lateTrigger.body?.ok === true
  if (lateTrigger.status !== 200 || triggerOk !== true) {
    return refuted('INVALIDATION_TRIGGER_FAILED', {
      member: member ?? null,
      lateTrigger: { status: lateTrigger.status ?? null, ok: lateTrigger.ok ?? null, body: lateTrigger.body ?? null },
      note: 'the live-surface change was dispatched and the Host did not accept it — the product is implicated, so this is REFUTED, not NOT_REACHED',
    })
  }
  if (lateReport?.registered !== true) {
    return refuted('INVALIDATION_TOOL_NOT_REGISTERED', {
      member: member ?? null,
      lateReport: lateReport ?? null,
      note: 'the trigger answered 200 but the fixture tool is not registered — the product accepted the change without the observable it is about',
    })
  }
  if (!isNonBlank(invalidationLine)) {
    return refuted('INVALIDATION_NOT_RAISED', {
      member: member ?? null,
      lateReport: lateReport ?? null,
      note: 'the late tool IS registered and the trigger answered 200, yet the product recorded no native-shadow invalidation — NoStaleShadow is exactly this contradiction',
    })
  }
  if (postRead === null || postRead === undefined) return reached({ reason: 'NO_POST_INVALIDATION_READ' })
  const body = postRead.body ?? null
  const error = body?.error ?? null
  const text = String(error?.message ?? '')
  const checks = {
    refused: postRead.status === 200 && body?.ok === false,
    typedCode: error?.info?.code === INVALIDATED_CODE,
    typedName: error?.info?.name === INVALIDATED_NAME,
    noForbiddenBytes: text.includes(String(forbiddenClaim)) !== true && JSON.stringify(body ?? {}).includes(String(forbiddenClaim)) !== true,
    noGuardFact: sinkDelta === 0,
    noProviderCall: counterDelta === 0,
    inLaneAlsoRefused: inLaneRead !== null && inLaneRead !== undefined
      && inLaneRead.status === 200 && inLaneRead.body?.ok === false
      && inLaneRead.body?.error?.info?.code === INVALIDATED_CODE,
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  if (failed.length > 0) return refuted('ROW5_CLAUSE_FAILED', {
    checks,
    failed,
    postRead: { status: postRead.status, ok: body?.ok ?? null, code: error?.info?.code ?? null, name: error?.info?.name ?? null },
    sinkDelta,
    counterDelta,
  })
  return proven({ reason: 'SHADOW_INVALIDATED_AND_ADMISSION_REFUSED', checks, invalidationLine })
}

/**
 * Row 6 — teardown: after the Member is stopped/archived there is no usable
 * but unconstrained shadow, no orphan process, no unsettled call, and no
 * MANAGED dispose fault.
 *
 * NOT_REACHED: no member existed to stop, or the archive/dispatch the row
 * observes never happened (scenario premise absent).
 * REFUTED: the stop happened and the product served the forbidden bytes, or a
 * managed dispose fault was reported, or a fact appeared after the stop.
 *
 * Identity is enforced by {@link classifyDisposeFaults}: a fault naming ANOTHER
 * session is `foreign`; a non-fault observation containing the managed
 * session's NAME is not a fault.
 */
export function judgeRow6({
  member = null,
  archive = null,
  membersAfter = [],
  observations = [],
  managed = {},
  duringManagedDisposal = false,
  managedRealmCount = 1,
  postStopDispatches = [],
  residencyDrop = null,
  forbiddenClaim,
  sinkDelta = null,
  healthStatus = null,
  hostAlive = null,
}) {
  const memberSession = isNonBlank(member?.childSessionId) ? member.childSessionId : ''
  if (memberSession === '') return reached({ reason: 'NO_MEMBER_TO_STOP' })
  if (archive === null || archive === undefined) return reached({ reason: 'NO_ARCHIVE_DISPATCH' })
  // THE PRODUCT WAS ASKED. A 200-with-ok:false envelope refusal, a non-200, or
  // any other answer that is not an accepted archive is the product refusing
  // the stop — REFUTED. Only "the archive was never dispatched" is an absence.
  if (archive.status !== 200 || archive.body?.ok !== true) {
    return refuted('ARCHIVE_REFUSED', {
      member: member ?? null,
      archive: { status: archive.status ?? null, ok: archive.body?.ok ?? null, error: archive.body?.error ?? null },
      note: 'the archive dispatch was answered and the Member was not stopped; treating this as NOT_REACHED would hide a product refusal (review B2)',
    })
  }
  if (!Array.isArray(postStopDispatches) || postStopDispatches.length === 0) {
    return reached({ reason: 'NO_POST_STOP_DISPATCH' })
  }
  const identity = classifyDisposeFaults({ observations, managed, duringManagedDisposal, managedRealmCount })
  const successes = postStopDispatches.filter((reply) => reply !== null && reply !== undefined && reply.status === 200 && reply.body?.ok === true)
  const unexplained = postStopDispatches.filter((reply) => reply === null || reply === undefined
    || !(reply.status === 422 || (reply.status === 200 && reply.body?.ok === false)))
  const servedForbidden = successes.some((reply) => JSON.stringify(reply.body ?? {}).includes(String(forbiddenClaim)))
  const archived = (Array.isArray(membersAfter) ? membersAfter : []).some((entry) => String(entry?.templateId) === 'worker' && String(entry?.lifecycle) === 'ARCHIVED')
  const checks = {
    archivedLifecycle: archived,
    everyDispatchExplained: unexplained.length === 0,
    noSuccessAfterStop: successes.length === 0,
    noForbiddenBytesAfterStop: servedForbidden !== true,
    noManagedDisposeFault: identity.managed.length === 0,
    noUnattributedRealmFault: identity.unattributed.length === 0,
    noFactAfterStop: sinkDelta === 0,
    hostHealthy: healthStatus === 200,
    hostAlive: hostAlive === true,
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  const detail = {
    checks,
    failed,
    identity,
    archive: { status: archive.status, ok: archive.body?.ok ?? null },
    residencyDrop: residencyDrop === null || residencyDrop === undefined ? null : residencyDrop.body ?? null,
    postStop: postStopDispatches.map((reply) => reply === null || reply === undefined
      ? null
      : { status: reply.status, ok: reply.body?.ok ?? null, code: reply.body?.error?.info?.code ?? null }),
    successes: successes.length,
    sinkDelta,
  }
  if (failed.length > 0) return refuted('ROW6_CLAUSE_FAILED', detail)
  return proven({ reason: 'NO_USABLE_UNCONSTRAINED_SHADOW', ...detail })
}

/**
 * Dispatch a case id to its judge. Kept as ONE switch so the driver cannot
 * drift from the tested contract and a new id fails loudly.
 *
 * @param {string} caseId one of {@link ACCEPTANCE_CASES}
 * @param {object} sample the evidence sample the driver collected
 */
export function judgeAcceptanceRow(caseId, sample = {}) {
  switch (caseId) {
    case 'live:composition-precondition-read-surface': return judgePrecondition(sample)
    case 'live:row1-read-a-inside-both-allowed': return judgeRow1(sample)
    case 'live:row2-read-b-binding-deny-exactly-one-fact': return judgeRow2(sample)
    case 'live:row3-read-c-refused-no-widening': return judgeRow3(sample)
    case 'live:row4-write-b-ceiling-allowed-no-read-lane-fact': return judgeRow4(sample)
    case 'live:row5-post-invalidation-refused-shadow-invalidated': return judgeRow5(sample)
    case 'live:row6-teardown-no-usable-unconstrained-shadow': return judgeRow6(sample)
    default: throw new Error(`no acceptance judge for ${JSON.stringify(caseId)} (known: ${ACCEPTANCE_CASES.join(', ')})`)
  }
}
