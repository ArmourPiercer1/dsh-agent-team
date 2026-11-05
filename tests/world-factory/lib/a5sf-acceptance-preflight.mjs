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
 *   - {@link judgeAcceptanceRow} (and the eight `judgeRowN`/`judgePrecondition`
 *     functions) — a THREE-WAY oracle per case. Every judge separates:
 *       NOT_REACHED  the observable the row asserts was never produced (the
 *                    drive never arrived at the asserted step, or the evidence
 *                    channel that carries it never existed);
 *       REFUTED      the observable exists and CONTRADICTS the row's claim;
 *       PROVEN       the observable exists and satisfies every clause.
 *     A row whose "pass" could be produced by `null` inputs is impossible here:
 *     each judge's first branch is the reachability predicate.
 *
 * CORRECTION ROUND AFTER THE FIRST LIVE RUN (2026-11-04T07:28Z, 4 PROVEN /
 * 3 FAIL). All three FAILs were defects of the QUESTION, not of the product:
 * `readText`-only fact counting on a `stat`-denied read (row 2), one row asking
 * for an allowance the write⇒read coupling correctly refuses (row 4), and a
 * COUNT of an append-only file standing in for "no fact after the stop" (row 6).
 * Each correction is stated at its judge, and each has a replay over the REAL
 * live stream plus a mutation-based negative control (`negative-controls.mjs`).
 *
 * SECOND CORRECTION ROUND AFTER BOOT 2 (2026-11-04T08:19Z, 6 PROVEN / 2 FAIL).
 * Both remaining FAILs were again defects of the question, and both are stated
 * at their judge:
 *   - row 4b asserted a refusal the algebra does not produce. The guard ALLOWS a
 *     write that the binding lane cannot read (the restriction constrains READ
 *     only; `edit` was what #579 measured), and what refused the live write was
 *     the Host's own read-before-write policy. The row now asserts the two-axis
 *     statement (ceiling-bounded write) plus "the bytes are not delivered
 *     blindly", and does NOT describe the Host policy as a Team-lane property;
 *   - row 6 re-read the sink AFTER its own post-stop probes, so the two facts
 *     those probes appended (a real `stat`/deny per probe) were counted as "a
 *     fact after the stop". The temporal bound now runs over the stop-time sink
 *     and the probe delta is separately required to be refusals.
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

/**
 * The case ids, NAMED so no caller indexes the list. The first live run
 * (2026-11-04T07:28Z) proved that a positional index is a latent defect of its
 * own: splitting row 4 into 4a/4b renumbers rows 4–6.
 *
 * `row2` and `row4*` were RENAMED by the 2026-11-04 correction rounds, because
 * the old names stated assertions the oracle no longer makes:
 *   - `live:row2-read-b-binding-deny-exactly-one-fact` (the count of `readText`
 *     facts) → `…-binding-deny-on-read-path` (every read-PATH consultation for B
 *     is a binding-lane deny; see {@link judgeRow2});
 *   - `live:row4-write-b-ceiling-allowed-no-read-lane-fact` (ONE row asserting an
 *     allowance the product correctly denies) → `live:row4a-…` and
 *     `live:row4b-write-b-ceiling-allowed-read-not-implied` (see
 *     {@link judgeRow4a} / {@link judgeRow4b}; 4b was renamed again after boot 2
 *     because the live answer was "the ceiling allows it, the read lane is not
 *     implied, and the bytes still do not land").
 * The historical `run-record.json` of the first live run keeps the old ids: it
 * is append-only evidence, not a current contract.
 */
export const ACCEPTANCE_CASE_IDS = Object.freeze({
  precondition: 'live:composition-precondition-read-surface',
  row1: 'live:row1-read-a-inside-both-allowed',
  row2: 'live:row2-read-b-binding-deny-on-read-path',
  row3: 'live:row3-read-c-refused-no-widening',
  row4a: 'live:row4a-write-in-lane-readable-allowed-ceiling-only',
  row4b: 'live:row4b-write-b-ceiling-allowed-read-not-implied',
  row5: 'live:row5-post-invalidation-refused-shadow-invalidated',
  row6: 'live:row6-teardown-no-usable-unconstrained-shadow',
})

/** The composition precondition + SEVEN rows (4a and 4b are separate cases). */
export const ACCEPTANCE_CASES = Object.freeze(Object.values(ACCEPTANCE_CASE_IDS))

/**
 * The Provider methods the shipped guard treats as the WRITE half
 * (`packages/runtime/team-services/src/fs.ts`: `const WRITE_METHODS:
 * ReadonlySet<string> = new Set(['writeText', 'editText'])`). Kept as data so
 * `dry-run.mjs` can assert this list EQUALS the product's own set: if the
 * product grows a third write method, the copy here is wrong and the dry run
 * says so instead of the oracle silently mis-scoping a fact.
 */
export const WRITE_PATH_METHODS = Object.freeze(['writeText', 'editText'])

/**
 * Is this guard-consultation fact on the READ path?
 *
 * THE LIVE DEFECT THIS REPLACES. The row-2 clause filtered `method ===
 * 'readText'`. But the native `read` tool STATS the target before it reads it,
 * and the binding lane denies the stat, so a refused read NEVER reaches
 * `readText` — the live stream carried `stat`/`deny` and the clause counted
 * zero facts (`exactlyOneReadFactForB: false`, 2026-11-04T07:28Z). The read
 * path is the provider surface MINUS the product's closed write set: an
 * unknown future method is therefore counted as a read-path consultation
 * (fail-closed, refuting) instead of being silently ignored.
 *
 * @param {{method?: unknown}} fact
 * @returns {boolean}
 */
export function isReadPathConsultation(fact) {
  return !WRITE_PATH_METHODS.includes(String(fact?.method ?? ''))
}

/** @param {{method?: unknown}} fact */
export function isWritePathConsultation(fact) {
  return WRITE_PATH_METHODS.includes(String(fact?.method ?? ''))
}

/** The product's typed refusal code the row-5 admission gate materialises. */
export const INVALIDATED_CODE = 'A5SF_NATIVE_SHADOW_INVALIDATED'
/** The refusal error's typed name (the row 5 assertion checks both). */
export const INVALIDATED_NAME = 'A5sfNativeShadowInvalidatedError'
/** The binding identity the two-axis composition declares for native `read`. */
export const READ_BINDING_IDENTITY = 'dsh.fs/read'

/**
 * The product's typed refusal for "this write target exists and the Member's
 * READ axis does not cover it" (`team-services/src/fs.ts`, the write⇒read
 * coupling; measured host-free in #579).
 *
 * WHY THE ROW ASSERTS PROSE AND NOT A CODE. The denial is a `TeamIoDenial`, not
 * a `HarnessError`, and the harness's tool layer renders `error.info` only for
 * `HarnessError` (`core/tools/src/index.ts#errorInfo`), so neither the model's
 * tool result nor the p6t6 tool route exports the code. The prose below is the
 * exact sentence of that ONE call site; `dry-run.mjs` binds it host-free (the
 * pattern must match the sentence inside the `IO_WRITE_REQUIRES_READ` branch of
 * `packages/runtime/team-services/src/fs.ts`), so asserting the prose IS
 * asserting the typed refusal — not a guess about wording.
 */
export const IO_WRITE_REQUIRES_READ = 'IO_WRITE_REQUIRES_READ'
export const IO_WRITE_REQUIRES_READ_PROSE = /must read .+ before rewriting it, but the Member read axis does not cover it; write does not imply read/

/**
 * The BLANKET admission code the realm-wide freeze (E8, #580) returns for a name
 * that is NOT covered by the invalidation's name set. It is deliberately NOT an
 * acceptable row-5 refusal: row 5 asserts that the RIGHT shadow was condemned by
 * name, so `A5SF_MEMBER_REALM_INVALIDATED` alone means "everything was refused
 * because the realm died", which is the opposite claim. See `judgeRow5`.
 */
export const REALM_INVALIDATED_CODE = 'A5SF_MEMBER_REALM_INVALIDATED'

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
 * refused by the BINDING lane, the refusal is typed, no bytes escape, and
 * EVERY read-path consultation at B's locator is a binding-lane deny.
 *
 * THE RULE (replaces "exactly one `readText` fact", which the first live run
 * refuted): the COUNT of read-path consultations is not an assertion — the
 * native `read` tool walks a path (`stat` then `readText`) and the product is
 * free to consult the guard once per step. What must hold is the DECISION:
 *   1. at least one read-path consultation exists (the sink channel is part of
 *      the claim: a denial nobody recorded is not evidence);
 *   2. every one of them is `deny`;
 *   3. every one of them comes from the BINDING lane (`realm: 'binding'` +
 *      `toolBindingIdentity: 'dsh.fs/read'`), so a CEILING-realm deny cannot be
 *      credited to the restriction lane;
 *   4. at least one binding-lane read-path deny exists.
 *
 * WHY A LEGITIMATE DOUBLE CONSULTATION (stat-then-read on an ALLOWED target)
 * MUST NOT BE A FAILURE *OF THIS RULE*: on an allowed target the product
 * records `stat allow` + `readText allow` (the live A stream: 2 allow facts on
 * the binding realm). Two facts are correct there — but B is not an allowed
 * target, so for row 2 those two allows contradict the row (clause 2 fails on
 * the DECISION, never on the multiplicity). Two DENIES at the same locator are
 * equally fine: both consultations were refused, which is the stronger form of
 * the same claim.
 *
 * The row-4 write fact at the same locator (`writeText`, ceiling realm) is
 * excluded by the product's own write-method partition and reported as
 * `nonReadPathFacts` — visible, never counted.
 *
 * NOT_REACHED iff the read call or its result was never produced.
 */
export function judgeRow2({ call, result, claim, writeContent = '', facts = [], counterRows = [] }) {
  if (!callPresent(call, result)) return reached({ reason: call == null ? 'NO_READ_CALL_B' : 'NO_READ_RESULT_B' })
  const text = textOfResult(result)
  const list = Array.isArray(facts) ? facts : []
  const readPathFacts = list.filter((fact) => isReadPathConsultation(fact))
  const nonReadPathFacts = list.filter((fact) => isWritePathConsultation(fact))
  const bindingReadPath = readPathFacts.filter((fact) => String(fact?.realm ?? '') === 'binding'
    && String(fact?.toolBindingIdentity ?? '') === READ_BINDING_IDENTITY)
  const readPathDenies = readPathFacts.filter((fact) => fact?.decision === 'deny')
  const checks = {
    isError: result.isError === true,
    typedLaneRefusal: LANE_REFUSAL.test(text),
    noClaimLeak: text.includes(String(claim)) !== true,
    noWriteContentLeak: String(writeContent) === '' ? true : text.includes(String(writeContent).trim()) !== true,
    readPathConsulted: readPathFacts.length >= 1,
    everyReadPathConsultationDenied: readPathFacts.length >= 1 && readPathDenies.length === readPathFacts.length,
    everyReadPathFactOnBindingLane: readPathFacts.length >= 1 && bindingReadPath.length === readPathFacts.length,
    bindingDenyOnReadPath: bindingReadPath.some((fact) => fact?.decision === 'deny'),
    noProviderRead: counterRows.length === 0,
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  const detail = {
    checks,
    failed,
    readPathFacts: readPathFacts.length,
    readPathMethods: readPathFacts.map((fact) => String(fact?.method ?? '')),
    readPathDecisions: readPathFacts.map((fact) => String(fact?.decision ?? '')),
    nonReadPathFacts: nonReadPathFacts.map((fact) => ({ method: fact?.method ?? null, decision: fact?.decision ?? null, realm: fact?.realm ?? null })),
    bindingReadPathFacts: bindingReadPath.length,
    factsForB: list.length,
    counterRows: counterRows.length,
    observed: text,
  }
  if (failed.length > 0) return refuted('ROW2_CLAUSE_FAILED', detail)
  return proven({ reason: 'BINDING_DENY_ON_READ_PATH', ...detail })
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
 * Row 4a (first half of the split row 4) — native `write` to a file INSIDE the
 * readable in-lane subtree (`<workspace>/axis/allow/`) is ALLOWED, lands on
 * disk, and produces write facts on the CEILING realm ONLY.
 *
 * WHY 4a AND 4b ARE TWO ROWS, NOT ONE (the first live run's contradiction):
 * row 4 wrote to B — inside the ceiling write lane but OUTSIDE the restriction
 * read allowance — and asked for "allowed AND no read-lane fact". Boot 2 showed
 * that the guard actually ALLOWS that write (the binding restriction constrains
 * READ only) and the Host's own read-before-write policy is what refuses it
 * downstream, so the question had two different answers mixed into one verdict.
 * The split keeps the real property ("a write must not cross channels") in BOTH
 * halves:
 *   4a  a write inside the readable in-lane subtree → ceiling-only facts, disk
 *       matches (the allow did not cross into the read lane);
 *   4b  a write to B → the guard allows it on the CEILING realm, NO write-allow
 *       on the read (binding) lane, and the bytes do not land: the Host policy
 *       refuses, the disk is unchanged, no planted byte reaches the model
 *       (see {@link judgeRow4b}; this is NOT a Team-lane security claim).
 * Both halves are measured live; neither is inferred from the other.
 *
 * The target is read by the model BEFORE it is written (the fixture script
 * reads it), for two independent reasons: the host's read-before-edit policy
 * turns an unobserved existing target into `createIfAbsent` (which would fail
 * for a different reason), and "read then write" is the shape the product's
 * coupling is about.
 *
 * NOT_REACHED iff the write call/result never existed; a missing or stale disk
 * content after a successful result is REFUTED (the effect channel exists and
 * contradicts the claim).
 */
export function judgeRow4a({ call, result, expectedContent, disk, facts = [], counterRows = [] }) {
  if (!callPresent(call, result)) return reached({ reason: call == null ? 'NO_WRITE_CALL_4A' : 'NO_WRITE_RESULT_4A' })
  const list = Array.isArray(facts) ? facts : []
  const writeFacts = list.filter((fact) => isWritePathConsultation(fact))
  const ceilingFacts = writeFacts.filter((fact) => String(fact?.realm ?? '') === 'member' && (fact?.toolBindingIdentity ?? null) === null)
  // Derived for the reader, not a separate clause: "every write fact is on the
  // ceiling realm" IS "no write fact on the read lane" — asserting both would be
  // one property with two names, and a mutation of either would be caught by the
  // other (measured: negative-control NC2a could not fail until this was one
  // clause).
  const readLaneWriteFacts = writeFacts.filter((fact) => String(fact?.realm ?? '') === 'binding')
  const checks = {
    notError: result.isError !== true,
    diskMatches: disk === String(expectedContent),
    allowFactPresent: writeFacts.some((fact) => fact?.decision === 'allow'),
    everyWriteFactOnCeiling: writeFacts.length > 0 && ceilingFacts.length === writeFacts.length,
    confinedProviderServed: counterRows.length >= 1 && counterRows.every((row) => row?.isBase !== true),
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  const detail = {
    checks,
    failed,
    isError: result.isError === true,
    disk,
    expectedContent,
    observed: textOfResult(result),
    writeFacts: writeFacts.length,
    ceilingFacts: ceilingFacts.length,
    readLaneWriteFacts: readLaneWriteFacts.length,
    counterRows: counterRows.length,
  }
  if (failed.length > 0) return refuted('ROW4A_CLAUSE_FAILED', detail)
  return proven({ reason: 'CEILING_WRITE_IN_LANE_READABLE', ...detail })
}

/**
 * Row 4b (second half) — the CEILING write lane admits a write the BINDING lane
 * cannot read, and the bytes are not delivered blindly.
 *
 * WHAT THE PRODUCT ACTUALLY PROMISES (boot 2, 2026-11-04T08:19Z; `edit`, not
 * `write`, was the operation #579 measured): the binding restriction constrains
 * the READ axis only. A `write` is bounded by the ceiling alone, so the guard
 * ALLOWS `writeText` to B (inside the ceiling, outside the read allowance) and
 * records the fact on the CEILING realm (`realm:'member'`,
 * `toolBindingIdentity:null`). The bytes do not reach the file anyway: the
 * Host's own read-before-write policy refuses the write downstream
 * (`cannot modify "<path>": file has not been read — read the file, then retry`),
 * the planted content is unchanged, and no byte of B comes back to the model.
 *
 * THAT HOST REFUSAL IS NOT A SECURITY PROPERTY OF THE TEAM LANES. It is the
 * upstream tool policy answering a different question ("was the target read?"),
 * not a lane refusal and not the Team write⇒read coupling. This row must not
 * describe it as either, and must not credit a Team refusal as this outcome.
 *
 * TWO CLAUSES (two claims, not one property twice):
 *   1. **The guard allows a write the binding lane cannot read.**
 *      `ceilingWriteAllowed` (≥1 write-ALLOW fact on the ceiling realm) and
 *      `noReadLaneWriteAllow` (no write-allow laundered onto the binding/read
 *      realm). The two-axis statement: a write is ceiling-bounded.
 *   2. **The bytes are not delivered blindly.** `isError`, and the error is
 *      neither an `A5SF_*`/lane refusal (`notTeamLaneRefusal`) nor the typed
 *      read-coupling refusal (`notReadCouplingRefusal`), the disk still holds the
 *      planted content (`diskUnchanged`), and the planted bytes did not come back
 *      to the model (`noPlantedBytesReturned`).
 *
 * The provider counter is REPORTED, not checked: the live run measured that the
 * write DID reach the confined provider (`writeText`, instance `fs-4`) before the
 * Host policy refused it. Asserting "no provider write" would contradict the
 * measured product behaviour.
 *
 * NOT_REACHED: the write never happened, or the driver did not plant the target
 * (the "unchanged" claim has no baseline without it).
 * REFUTED: asked and answered differently — the guard denied the write (a lane
 * refusal means the ceiling did NOT admit it), the product refused it with the
 * read coupling (a different contract), an `A5SF_*` admission refusal, a changed
 * disk, or returned planted bytes.
 */
export function judgeRow4b({ call, result, plantedContent, disk, facts = [], counterRows = [] }) {
  if (!callPresent(call, result)) return reached({ reason: call == null ? 'NO_WRITE_CALL_4B' : 'NO_WRITE_RESULT_4B' })
  if (typeof plantedContent !== 'string' || plantedContent === '') return reached({ reason: 'NO_PLANTED_B' })
  const text = textOfResult(result)
  const list = Array.isArray(facts) ? facts : []
  const writeFacts = list.filter((fact) => isWritePathConsultation(fact))
  const ceilingWriteAllowFacts = writeFacts.filter((fact) => String(fact?.realm ?? '') === 'member'
    && (fact?.toolBindingIdentity ?? null) === null
    && fact?.decision === 'allow')
  const readLaneWriteAllowFacts = writeFacts.filter((fact) => String(fact?.realm ?? '') === 'binding' && fact?.decision === 'allow')
  const checks = {
    isError: result.isError === true,
    ceilingWriteAllowed: ceilingWriteAllowFacts.length >= 1,
    noReadLaneWriteAllow: readLaneWriteAllowFacts.length === 0,
    notTeamLaneRefusal: LANE_REFUSAL.test(text) !== true && /A5SF_[A-Z0-9_]+/.test(text) !== true,
    notReadCouplingRefusal: IO_WRITE_REQUIRES_READ_PROSE.test(text) !== true,
    noPlantedBytesReturned: text.includes(plantedContent.trim()) !== true,
    diskUnchanged: disk === plantedContent,
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  const detail = {
    checks,
    failed,
    isError: result.isError === true,
    disk,
    plantedContent,
    observed: text,
    writeFacts: writeFacts.length,
    writeDecisions: writeFacts.map((fact) => ({ method: fact?.method ?? null, decision: fact?.decision ?? null, realm: fact?.realm ?? null })),
    ceilingWriteAllowFacts: ceilingWriteAllowFacts.length,
    readLaneWriteAllowFacts: readLaneWriteAllowFacts.length,
    // REPORTED, never checked: the live run measured that the write reached the
    // confined provider before the Host policy refused it. A row demanding
    // "no provider write" would be asking the product for something it does not
    // promise on the write axis.
    counterRows: counterRows.length,
    providerWrote: counterRows.length > 0,
  }
  if (failed.length > 0) return refuted('ROW4B_CLAUSE_FAILED', detail)
  return proven({ reason: 'CEILING_WRITE_ALLOWED_READ_NOT_IMPLIED', ...detail })
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
  const observedCode = error?.info?.code ?? null
  // THE NAME-KEYED vs BLANKET DISCRIMINATION. Row 5's claim is that the
  // invalidation condemned THIS covered name, so the refusal must carry the
  // name-keyed code. The realm-wide freeze added by E8 (#580) answers
  // `A5SF_MEMBER_REALM_INVALIDATED` for names OUTSIDE the invalidation's set;
  // seeing that code here means the whole realm was frozen and the row cannot
  // tell "the right shadow was condemned" from "everything was refused". It is
  // therefore a dedicated REFUTED reason, not a generic clause failure.
  const checks = {
    refused: postRead.status === 200 && body?.ok === false,
    typedCode: observedCode === INVALIDATED_CODE,
    notBlanketFreeze: observedCode !== REALM_INVALIDATED_CODE,
    typedName: error?.info?.name === INVALIDATED_NAME,
    noForbiddenBytes: text.includes(String(forbiddenClaim)) !== true && JSON.stringify(body ?? {}).includes(String(forbiddenClaim)) !== true,
    noGuardFact: sinkDelta === 0,
    noProviderCall: counterDelta === 0,
    inLaneAlsoRefused: inLaneRead !== null && inLaneRead !== undefined
      && inLaneRead.status === 200 && inLaneRead.body?.ok === false
      && inLaneRead.body?.error?.info?.code === INVALIDATED_CODE,
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  // A refusal that is ONLY the blanket realm freeze cannot satisfy the row.
  // Name it separately so the record says which product error fired.
  if (checks.refused === true && observedCode === REALM_INVALIDATED_CODE) {
    return refuted('BLANKET_INVALIDATION_ONLY', {
      checks,
      failed,
      expectedCode: INVALIDATED_CODE,
      observedCode,
      postRead: { status: postRead.status, ok: body?.ok ?? false, code: observedCode, name: error?.info?.name ?? null },
      inLaneCode: inLaneRead?.body?.error?.info?.code ?? null,
      note: 'the refusal came from the realm-wide freeze, not from the name-keyed invalidation — the row cannot distinguish "the right shadow was condemned" from "everything was refused because the realm died"',
    })
  }
  if (failed.length > 0) return refuted('ROW5_CLAUSE_FAILED', {
    checks,
    failed,
    expectedCode: INVALIDATED_CODE,
    observedCode,
    postRead: { status: postRead.status, ok: body?.ok ?? null, code: observedCode, name: error?.info?.name ?? null },
    inLaneCode: inLaneRead?.body?.error?.info?.code ?? null,
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
 * managed dispose fault was reported, or a STOP-TIME fact appeared after the
 * stop, or one of the row's own post-stop probe consultations was NOT a refusal.
 *
 * WHY THE PROBE FACTS ARE SEPARATE: the driver probes the stopped Member after
 * the archive (`postArchiveRead`, `postDropRead`); each probe is a real guard
 * consultation and appends a real fact. Those facts are the row's stimulus, not
 * a leak. Boot 2 re-read the sink after the probes and counted them as "facts
 * after the stop" — the row refuted itself. The stop-time sink (`facts`) carries
 * the temporal bound; the probe delta (`probeFacts`) must consist of refusals.
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
  /**
   * Every `a5sf-guard-consult/1` fact the World produced UP TO the stop instant
   * (the driver snapshots the sink before it dispatches any post-stop probe).
   */
  facts = [],
  /**
   * The facts the row's OWN post-stop probe dispatches appended (the delta
   * between the stop-time snapshot and the sink after `postArchiveRead` +
   * `postDropRead`). These are the row's stimulus, not an observation of the
   * product after the stop: judging them as "facts after the stop" made the row
   * refute itself (boot 2). They are judged separately — a stopped Member must
   * not be SERVED anything, so every probe fact must be a refusal.
   */
  probeFacts = [],
  /**
   * The instant the product ANSWERED the archive dispatch — the stop instant.
   * Recorded by the driver; the row's temporal bound.
   */
  stopInstant = null,
  /** Informational: the old count-based window input. NOT a check (see below). */
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
  // ── THE TEMPORAL BOUND (replaces the `sinkDelta === 0` count) ─────────────
  // The fact file is APPEND-ONLY and spans the whole run, so facts from rows
  // 1–5 land inside any "after the stop" window and a DELTA can never express
  // "nothing happened after the stop". The row's claim is temporal: NO fact may
  // carry an `observedAt` LATER than the stop instant. A fact whose
  // `observedAt` cannot be parsed cannot be proven to precede the stop, so it
  // also refutes (fail-closed).
  //
  // THE BOOT-2 DEFECT THIS REPLACES: the driver re-read the sink AFTER it had
  // dispatched its own two post-stop probes (`postArchiveRead` + `postDropRead`
  // of b.txt). Each probe is a real guard consultation and appends a real fact
  // (`stat`/deny, binding), so the row counted its own stimulus as "a fact after
  // the stop" and refuted a clean teardown. The bound is now judged over the
  // STOP-TIME sink (`facts`), and the probe-added facts are a separate clause:
  // a stopped Member may be consulted, but every such consultation must be a
  // refusal — an ALLOW would mean it was still being served.
  const stopMs = Date.parse(String(stopInstant ?? ''))
  if (!Number.isFinite(stopMs)) return reached({ reason: 'NO_STOP_INSTANT', stopInstant: stopInstant ?? null })
  const stopTimeFacts = (Array.isArray(facts) ? facts : []).filter((fact) => fact !== null && fact !== undefined)
  const probeTimeFacts = (Array.isArray(probeFacts) ? probeFacts : []).filter((fact) => fact !== null && fact !== undefined)
  const dated = stopTimeFacts.map((fact) => ({ fact, at: Date.parse(String(fact?.observedAt ?? '')) }))
  const undated = dated.filter((entry) => !Number.isFinite(entry.at))
  const afterStop = dated.filter((entry) => Number.isFinite(entry.at) && entry.at > stopMs)
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
    factsAreTimestamped: undated.length === 0,
    noFactAfterStop: afterStop.length === 0,
    probeFactsAreRefusals: probeTimeFacts.length === 0 || probeTimeFacts.every((fact) => fact?.decision === 'deny'),
    hostHealthy: healthStatus === 200,
    hostAlive: hostAlive === true,
  }
  const failed = Object.entries(checks).filter(([, ok]) => ok !== true).map(([name]) => name)
  const detail = {
    checks,
    failed,
    identity,
    archive: { status: archive.status, ok: archive.body?.ok ?? null },
    stopInstant: String(stopInstant),
    factsObserved: stopTimeFacts.length,
    factsAfterStop: afterStop.map((entry) => ({ method: entry.fact?.method ?? null, locator: entry.fact?.locator ?? null, realm: entry.fact?.realm ?? null, observedAt: entry.fact?.observedAt ?? null })),
    factsWithoutObservedAt: undated.length,
    probeFactsObserved: probeTimeFacts.length,
    probeFacts: probeTimeFacts.map((fact) => ({ method: fact?.method ?? null, locator: fact?.locator ?? null, realm: fact?.realm ?? null, decision: fact?.decision ?? null, observedAt: fact?.observedAt ?? null })),
    residencyDrop: residencyDrop === null || residencyDrop === undefined ? null : residencyDrop.body ?? null,
    postStop: postStopDispatches.map((reply) => reply === null || reply === undefined
      ? null
      : { status: reply.status, ok: reply.body?.ok ?? null, code: reply.body?.error?.info?.code ?? null }),
    successes: successes.length,
    // Informational only. The first live run was judged by this number and it
    // is structurally incapable of expressing the claim; it is reported so a
    // reader can see the old window, never checked.
    sinkDeltaObserved: sinkDelta,
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
    case ACCEPTANCE_CASE_IDS.precondition: return judgePrecondition(sample)
    case ACCEPTANCE_CASE_IDS.row1: return judgeRow1(sample)
    case ACCEPTANCE_CASE_IDS.row2: return judgeRow2(sample)
    case ACCEPTANCE_CASE_IDS.row3: return judgeRow3(sample)
    case ACCEPTANCE_CASE_IDS.row4a: return judgeRow4a(sample)
    case ACCEPTANCE_CASE_IDS.row4b: return judgeRow4b(sample)
    case ACCEPTANCE_CASE_IDS.row5: return judgeRow5(sample)
    case ACCEPTANCE_CASE_IDS.row6: return judgeRow6(sample)
    default: throw new Error(`no acceptance judge for ${JSON.stringify(caseId)} (known: ${ACCEPTANCE_CASES.join(', ')})`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SHARED ZERO-BOOT PREFLIGHT (2026-11-06, owner reorganisation directive)
//
// WHY THIS SECTION EXISTS. The two live drivers under
// `dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs` and
// `.../a5sf-search-live/run-boot.mjs` each grew their own pre-start checks, and
// they are good — but they are copied per driver, they only run when a driver
// runs (so an operator discovers a defect AFTER spending a start unless the
// driver happens to check it), and they do not cover the two defects that cost
// real allocations:
//
//   1. **CASE ALIASING** (candidate-1 allocation #1, 2026-11-06). Two cases
//      declared the SAME locator (`outside-restriction.txt`) and both judges
//      collect guard facts BY LOCATOR, so each lane's deny fact satisfied the
//      other's case. Two rows came back REFUTED for a defect of the fixture,
//      not of the product, and the retry cost allocation #4.
//   2. **A DENY EXERCISE INSIDE THE RUNTIME ALLOWANCE** (BL-16/BL-39). A
//      declared root under `/etc`, `/usr`, `/lib`, `/lib64` or `/proc` is
//      refused by the admission layer but WOULD be served by the kernel
//      profile's runtime allowance, so a case that expects "the kernel refuses
//      it" is vacuous.
//
// This section is the ONE host-free contract over a PRE-BOOT bundle: no ports,
// no DSH_HOME, no pristine host, no boot. A driver writes the bundle before it
// spends a start (`preflight-bundle.json`); the CLI in
// `scripts/a5sf-preflight.mjs` grades it and prints ONE machine-readable
// verdict; the test in `tests/world-factory/a5sf-acceptance-preflight.test.mjs`
// carries the aliased two-case negative control and one mutation per check.
//
// WHAT IT IS NOT: it does not replace the per-row judges above, and it does
// not decide a row. It answers one question — "would spending a start on this
// plan teach us anything, or would it burn a boot on a defect of the instrument?"
// ─────────────────────────────────────────────────────────────────────────────

/** The bundle schema this contract reads. A driver may add fields; these are required. */
export const ZERO_BOOT_PREFLIGHT_SCHEMA = 'a5sf-zero-boot-preflight/1'

/** The closed check-id set. A reader greps one id, not a sentence. */
export const PREFLIGHT_CHECK_IDS = Object.freeze([
  'assembly.usable',
  'identity.roots',
  'identity.blueprints',
  'identity.member-tool-binding',
  'identity.authority',
  'native.module-config',
  'policy.paths',
  'policy.fifo',
  'cases.isolation',
  'collector.shape',
  'wiring.candidate',
  'wiring.grant',
  'wiring.run-record',
])

/** The verdict vocabulary. Two words, because a preflight cannot "probably" pass. */
export const PREFLIGHT_VERDICTS = Object.freeze(['PASS', 'FAIL'])

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const nonBlank = (v) => typeof v === 'string' && v.trim() !== ''
const SHA40 = /^[0-9a-f]{40}$/

/**
 * Boundary-aware path containment: `/a/bc` is NOT inside `/a/b`.
 *
 * Deliberately string-based and normalising only trailing slashes and `..`
 * segments. This is the SAME predicate class the drivers use for their lane
 * dispositions; it is not a second path algebra (the product's
 * `matchLocator` remains the authority for a served call).
 *
 * @param {string} child
 * @param {string} parent
 * @returns {boolean}
 */
export function pathWithin(child, parent) {
  if (!nonBlank(child) || !nonBlank(parent)) return false
  const norm = (p) => {
    const parts = []
    for (const seg of String(p).replace(/\/+/g, '/').split('/')) {
      if (seg === '' || seg === '.') continue
      if (seg === '..') parts.pop()
      else parts.push(seg)
    }
    return `/${parts.join('/')}`
  }
  const c = norm(child)
  const p = norm(parent)
  if (c === p) return true
  return c.startsWith(p.endsWith('/') ? p : `${p}/`)
}

/** The runtime allowance the OS profile adds OUTSIDE the read lane (subprocess.ts
 *  `systemRuntimeAllowPaths`). A deny exercise inside it is not a kernel refusal. */
export const PREFLIGHT_RUNTIME_ALLOWANCE = Object.freeze(['/bin', '/usr', '/lib', '/lib64', '/etc', '/proc', '/sbin'])

function finding(code, detail, extra = {}) {
  return Object.freeze({ code, detail, ...extra })
}

/**
 * CASE ISOLATION — the allocation-#1 defect, made impossible to spend a boot on.
 *
 * Every case must own a locator and a guard-fact key that no other case uses.
 * A shared locator is not a style problem: the judges collect facts by locator,
 * so aliasing makes two cases read each other's evidence and produces verdicts
 * about the instrument. The check is deliberately identity-based (the same
 * string after normalisation), not a heuristic.
 *
 * @param {readonly object[]} cases
 * @returns {{ok: boolean, findings: object[]}}
 */
export function checkCaseIsolation(cases) {
  const findings = []
  if (!Array.isArray(cases) || cases.length === 0) {
    findings.push(finding('CASE_LIST_EMPTY', 'the bundle declares no cases; a preflight over nothing cannot pass'))
    return { ok: false, findings }
  }
  const byLocator = new Map()
  const byGuardKey = new Map()
  const byId = new Set()
  for (const c of cases) {
    if (!isObject(c)) { findings.push(finding('CASE_MALFORMED', `a case is not an object: ${JSON.stringify(c)}`)); continue }
    const id = String(c.id ?? '')
    if (!nonBlank(id)) { findings.push(finding('CASE_ID_MISSING', 'a case has no id')); continue }
    if (byId.has(id)) findings.push(finding('CASE_ID_DUPLICATED', `case id ${JSON.stringify(id)} is declared more than once`))
    byId.add(id)
    if (!nonBlank(c.locator)) findings.push(finding('CASE_LOCATOR_MISSING', `case ${id} declares no locator`))
    const loc = String(c.locator ?? '').replace(/\/+$/, '')
    if (nonBlank(loc)) {
      const prior = byLocator.get(loc)
      if (prior !== undefined) {
        findings.push(finding('CASE_LOCATOR_ALIASED', `cases ${JSON.stringify(prior)} and ${JSON.stringify(id)} share the locator ${JSON.stringify(loc)}; a judge that collects by locator cannot tell their facts apart (this is candidate-1 allocation #1)`, { locator: loc, cases: [prior, id] }))
      } else byLocator.set(loc, id)
    }
    const key = String(c.guardFactKey ?? '').trim()
    if (nonBlank(key)) {
      const prior = byGuardKey.get(key)
      if (prior !== undefined) findings.push(finding('CASE_GUARD_KEY_ALIASED', `cases ${JSON.stringify(prior)} and ${JSON.stringify(id)} share the guard-fact key ${JSON.stringify(key)}; one fact would satisfy two cases`, { guardFactKey: key, cases: [prior, id] }))
      else byGuardKey.set(key, id)
    }
  }
  return { ok: findings.length === 0, findings }
}

/**
 * POLICY-COMPUTED PATH / FIFO / PERMISSION EXPECTATIONS.
 *
 * A case's EXPECTED disposition must agree with the lane inputs the bundle
 * declares, and the exercise must be able to observe the refusal:
 *  - an `allow` case's locator must be inside the effective lane (and therefore
 *    inside the ceiling and the tool restriction);
 *  - a `deny` case's locator must be OUTSIDE the effective lane, and its own
 *    declared axis must be the one that denies (an out-of-ceiling case must not
 *    claim the restriction refused it);
 *  - a `deny` case inside {@link PREFLIGHT_RUNTIME_ALLOWANCE} is refused: the
 *    kernel profile grants that root, so "the OS refuses it" is not measurable;
 *  - the FIFO cancellation window must be inside the effective read lane, or
 *    the confined spawn is refused at admission before the cancellation window
 *    exists (BL-16 attempt 6, 2026-11-04).
 *
 * @param {object} bundle
 * @returns {{ok: boolean, findings: object[]}}
 */
export function checkPolicyPaths(bundle) {
  const findings = []
  const policy = isObject(bundle?.policy) ? bundle.policy : null
  const cases = Array.isArray(bundle?.cases) ? bundle.cases : []
  if (policy === null) {
    findings.push(finding('POLICY_UNDECLARED', 'the bundle carries no policy block; the path/permission expectations cannot be graded'))
    return { ok: false, findings }
  }
  const readLane = Array.isArray(policy.effectiveReadAllow) ? policy.effectiveReadAllow : []
  const writeLane = Array.isArray(policy.effectiveWriteAllow) ? policy.effectiveWriteAllow : []
  if (readLane.length === 0) findings.push(finding('POLICY_EFFECTIVE_LANE_EMPTY', 'policy.effectiveReadAllow is empty; every read case would be vacuous and every deny case trivially true'))
  const effective = readLane
  for (const c of cases) {
    if (!isObject(c)) continue
    const id = String(c.id)
    const expected = String(c.expected ?? '')
    if (expected !== 'allow' && expected !== 'deny') {
      findings.push(finding('POLICY_EXPECTATION_UNKNOWN', `case ${id} declares expected=${JSON.stringify(c.expected)}; the closed set is allow|deny`))
      continue
    }
    const axis = String(c.axis ?? 'read')
    if (axis === 'network') {
      // The network axis has no destination granularity this round: a deny
      // exercise is only measurable if the lane declares deny AND the backend
      // probe reports `enforced`; otherwise the call is refused before the
      // wire and no connection can be observed.
      if (expected === 'allow') findings.push(finding('POLICY_EXPECTATION_CONTRADICTS_LANE', `case ${id} expects ALLOW on the network axis; network=restricted is UNSUPPORTED this round`))
      if (String(policy.networkAccess ?? '') !== 'deny') findings.push(finding('POLICY_EXPECTATION_CONTRADICTS_LANE', `case ${id} expects DENY on the network axis but policy.networkAccess=${JSON.stringify(policy.networkAccess)}`))
      if (c.networkProbeEnforced !== true) findings.push(finding('POLICY_NETWORK_PROBE_NOT_ENFORCED', `case ${id} claims a network denial but the backend probe is not declared enforced; on this host the call is REFUSED, so "zero connects" is unmeasurable`))
      continue
    }
    if (axis !== 'read' && axis !== 'write') {
      findings.push(finding('POLICY_AXIS_UNKNOWN', `case ${id} declares axis=${JSON.stringify(axis)}; the closed set is read|write|network`))
      continue
    }
    const lane = axis === 'write' ? writeLane : readLane
    if (!nonBlank(c.locator)) { findings.push(finding('CASE_LOCATOR_MISSING', `case ${id} declares no locator`)); continue }
    const inEffective = lane.some((root) => pathWithin(c.locator, root))
    if (expected === 'allow' && !inEffective) {
      findings.push(finding('POLICY_EXPECTATION_CONTRADICTS_LANE', `case ${id} expects ALLOW on the ${axis} axis but ${JSON.stringify(c.locator)} is outside the effective ${axis} lane ${JSON.stringify(lane)}; the boot would spend a start refuting the fixture`))
    }
    if (expected === 'deny') {
      if (inEffective) {
        findings.push(finding('POLICY_EXPECTATION_CONTRADICTS_LANE', `case ${id} expects DENY on the ${axis} axis but ${JSON.stringify(c.locator)} is inside the effective ${axis} lane; the case cannot fail for the reason it claims`))
      }
      // The runtime allowance is a READ/EXECUTE grant; a write inside it is still
      // refused by the kernel, so only a read-axis deny can be made vacuous by it.
      const allowanceRoot = axis === 'read' ? PREFLIGHT_RUNTIME_ALLOWANCE.find((root) => pathWithin(c.locator, root)) : undefined
      if (allowanceRoot !== undefined) {
        findings.push(finding('POLICY_ROOT_INSIDE_RUNTIME_ALLOWANCE', `case ${id} expects DENY on ${JSON.stringify(c.locator)}, which sits under the runtime allowance ${JSON.stringify(allowanceRoot)}; the OS profile grants that root, so only the admission layer can refuse it and a kernel-refusal claim is vacuous`))
      }
      const disposition = isObject(policy.dispositions) ? policy.dispositions[id] : undefined
      if (isObject(disposition) && nonBlank(c.deniedBy)) {
        const actualDenier = disposition.effective === 'deny'
          ? (disposition.restriction === 'deny' ? 'restriction' : (disposition.ceiling === 'deny' ? 'ceiling' : null))
          : null
        if (actualDenier !== null && actualDenier !== String(c.deniedBy)) {
          findings.push(finding('POLICY_AXIS_ATTRIBUTION_WRONG', `case ${id} says ${JSON.stringify(c.deniedBy)} denies it, but the declared dispositions deny it at ${JSON.stringify(actualDenier)}`))
        }
      }
    }
  }
  const fifo = policy.fifo
  if (nonBlank(fifo)) {
    const inFifo = effective.some((root) => pathWithin(fifo, root))
    if (!inFifo) {
      findings.push(finding('POLICY_FIFO_OUTSIDE_LANE', `the cancellation FIFO ${JSON.stringify(fifo)} is outside the effective read lane; a confined spawn of it is refused at admission, so the cancellation window never exists (BL-16 attempt 6)`))
    }
  }
  return { ok: findings.length === 0, findings }
}

/**
 * BUILD / ASSEMBLY USABLE.
 *
 * Three pre-start facts the drivers already assert, lifted out of the drivers:
 * the emitted `dist` carries every face the plan rides; every native module the
 * plan mounts exists at its declared path; and the rows the driver EMITTED are
 * the rows the World was HANDED, before `boot` (the 2026-11-04 and attempt-1
 * defect: `emitPatchLayer` returned text that never reached `world.u6Fs.rows`).
 *
 * `fileExists` is injected so the pure check is testable without a checkout;
 * when it is absent the declared `exists` flag is used and that fact is stated
 * in the check detail (a declared fact is weaker than a probed one).
 *
 * @param {object} bundle
 * @param {{fileExists?: (rel: string) => boolean}} [probe]
 * @returns {{ok: boolean, findings: object[], probed: boolean}}
 */
export function checkAssemblyUsable(bundle, probe = {}) {
  const findings = []
  const assembly = isObject(bundle?.assembly) ? bundle.assembly : null
  if (assembly === null) {
    return { ok: false, findings: [finding('ASSEMBLY_UNDECLARED', 'the bundle carries no assembly block')], probed: false }
  }
  const fileExists = typeof probe.fileExists === 'function' ? probe.fileExists : null
  const faces = isObject(assembly.distFaces) ? assembly.distFaces : {}
  const required = Array.isArray(assembly.requiredDistFaces) && assembly.requiredDistFaces.length > 0
    ? assembly.requiredDistFaces
    : Object.keys(faces)
  if (required.length === 0) findings.push(finding('ASSEMBLY_FACES_UNDECLARED', 'assembly.requiredDistFaces is empty; a plan that names no face cannot be preflighted'))
  for (const face of required) {
    if (faces[face] !== true) findings.push(finding('ASSEMBLY_DIST_FACE_MISSING', `the emitted dist does not carry the ${JSON.stringify(face)} face the plan rides; run the build before spending a start`))
  }
  const modules = Array.isArray(assembly.hostModules) ? assembly.hostModules : []
  for (const mod of modules) {
    if (!isObject(mod) || !nonBlank(mod.path)) { findings.push(finding('ASSEMBLY_HOST_MODULE_UNDECLARED', `a host module entry has no path: ${JSON.stringify(mod)}`)); continue }
    const exists = fileExists === null ? mod.exists === true : fileExists(mod.path)
    if (!exists) findings.push(finding('ASSEMBLY_HOST_MODULE_MISSING', `the native module ${JSON.stringify(mod.path)} is absent from this checkout; the row cannot be mounted`))
  }
  const handoff = isObject(assembly.rowHandoff) ? assembly.rowHandoff : null
  if (handoff === null) {
    findings.push(finding('ASSEMBLY_ROW_HANDOFF_MISSING', 'assembly.rowHandoff is absent; the emitted rows were never proven to reach the World'))
  } else {
    if (handoff.usesHandOverRows !== true) findings.push(finding('ASSEMBLY_ROW_HANDOFF_MISSING', 'the rows do not reach the World through the single `handOverRows(world, rows)` seam'))
    if (handoff.beforeBoot !== true) findings.push(finding('ASSEMBLY_ROW_HANDOFF_MISSING', 'the row handover is not proven to run BEFORE `harness.boot(`'))
    const emitted = Array.isArray(handoff.emittedRowIds) ? handoff.emittedRowIds : []
    const world = Array.isArray(handoff.worldRowIds) ? handoff.worldRowIds : []
    if (emitted.join('\u0000') !== world.join('\u0000')) {
      findings.push(finding('ASSEMBLY_ROW_HANDOFF_MISSING', `emitted rows ${JSON.stringify(emitted)} are not the rows the World received ${JSON.stringify(world)} (ordered identity); this is the attempt-1/2026-11-04 defect`))
    }
    if (handoff.healthProbeRowPresent === false) findings.push(finding('ASSEMBLY_HEALTH_ROW_MISSING', 'the World would compose no health-probe row; the p6t6 route cannot answer and every row is unanswerable'))
  }
  return { ok: findings.length === 0, findings, probed: fileExists !== null }
}

/**
 * IDENTITY — root wiring, blueprint identity, Member/ToolBinding identity, and
 * the authority the run believes it is observing.
 *
 * The roots are graded with {@link assertAcceptanceRootWiring} (the same
 * function the P2-01 driver imports), so a bundle cannot pass with a
 * create-root ≠ observe-root construction.
 *
 * @param {object} bundle
 * @returns {{ok: boolean, findings: object[]}}
 */
export function checkIdentity(bundle) {
  const findings = []
  const identity = isObject(bundle?.identity) ? bundle.identity : null
  if (identity === null) return { ok: false, findings: [finding('IDENTITY_UNDECLARED', 'the bundle carries no identity block')] }

  const roots = {
    bootRoot: identity.bootRoot,
    teamRoot: identity.teamRoot,
    createRoot: identity.createRoot,
    stateQueryRoot: identity.stateQueryRoot,
    toolRouteRoot: identity.toolRouteRoot ?? identity.teamRoot,
    archiveRoot: identity.archiveRoot,
    oracleRoot: identity.oracleRoot,
    directiveRoot: identity.directiveRoot ?? identity.teamRoot,
  }
  try {
    assertAcceptanceRootWiring(roots)
  } catch (error) {
    findings.push(finding('IDENTITY_ROOT_MISMATCH', String(error?.message ?? error)))
  }

  const blueprints = Array.isArray(identity.blueprints) ? identity.blueprints : []
  if (blueprints.length === 0) findings.push(finding('IDENTITY_BLUEPRINT_UNDECLARED', 'no blueprint is declared; Member/ToolBinding identity cannot be graded'))
  const seenBlueprintIds = new Set()
  for (const bp of blueprints) {
    if (!isObject(bp) || !nonBlank(bp.blueprintId)) { findings.push(finding('IDENTITY_BLUEPRINT_INVALID', `a blueprint declares no blueprintId: ${JSON.stringify(bp)}`)); continue }
    if (seenBlueprintIds.has(bp.blueprintId)) findings.push(finding('IDENTITY_BLUEPRINT_INVALID', `blueprintId ${JSON.stringify(bp.blueprintId)} is declared twice`))
    seenBlueprintIds.add(bp.blueprintId)
    if (!Number.isInteger(bp.members) || bp.members < 1) findings.push(finding('IDENTITY_BLUEPRINT_INVALID', `blueprint ${JSON.stringify(bp.blueprintId)} declares members=${JSON.stringify(bp.members)}; a validated blueprint has at least one Member`))
  }

  const bindings = Array.isArray(identity.memberBindings) ? identity.memberBindings : []
  const cases = Array.isArray(bundle?.cases) ? bundle.cases : []
  for (const c of cases) {
    if (!isObject(c) || !nonBlank(c.id)) continue
    if (c.face === 'non-data-plane') continue
    const binding = bindings.find((b) => isObject(b) && b.caseId === c.id)
    if (binding === undefined) {
      findings.push(finding('IDENTITY_MEMBER_BINDING_MISSING', `case ${c.id} rides a data-plane face but declares no Member/ToolBinding identity; a verdict would not be attributable`))
      continue
    }
    if (!nonBlank(binding.memberIdentity) || !nonBlank(binding.toolBindingIdentity)) {
      findings.push(finding('IDENTITY_MEMBER_BINDING_INVALID', `case ${c.id} declares an incomplete Member/ToolBinding identity: ${JSON.stringify(binding)}`))
    }
  }

  const authority = isObject(bundle?.authority) ? bundle.authority : null
  const record = isObject(bundle?.runRecord) ? bundle.runRecord : null
  if (authority === null) {
    findings.push(finding('IDENTITY_AUTHORITY_UNDECLARED', 'the bundle carries no authority block'))
  } else {
    if (!nonBlank(authority.snapshotVersion)) findings.push(finding('IDENTITY_AUTHORITY_INVALID', 'authority.snapshotVersion is blank'))
    if (!nonBlank(authority.contentDigest)) findings.push(finding('IDENTITY_AUTHORITY_INVALID', 'authority.contentDigest is blank'))
    if (authority.pointerSha256 !== undefined && !/^[0-9a-f]{64}$/.test(String(authority.pointerSha256))) {
      findings.push(finding('IDENTITY_AUTHORITY_INVALID', 'authority.pointerSha256 is not a sha256 (the pointer precondition cannot be stated)'))
    }
    if (record !== null && isObject(record.bindings) && isObject(record.bindings.authority)) {
      const observed = record.bindings.authority
      if (isObject(observed.pointer) && nonBlank(observed.pointer.content_digest) && observed.pointer.content_digest !== authority.contentDigest) {
        findings.push(finding('IDENTITY_AUTHORITY_MISMATCH', `the run record observed pointer digest ${observed.pointer.content_digest} but the bundle names ${authority.contentDigest}`))
      }
    }
  }
  return { ok: findings.length === 0, findings }
}

/**
 * NATIVE MODULE REQUIRED CONFIG.
 *
 * Both attempt-4 and attempt-5 of BL-16 died on this and neither was a product
 * defect: the search module was mounted with an EMPTY config, then with a
 * config missing `sampleOverCapGlobResults`. A module that requires config keys
 * must declare them, and the bundle must supply every one non-empty.
 *
 * @param {object} bundle
 * @returns {{ok: boolean, findings: object[]}}
 */
export function checkNativeModuleConfig(bundle) {
  const findings = []
  const modules = Array.isArray(bundle?.nativeModules) ? bundle.nativeModules : []
  if (modules.length === 0) {
    findings.push(finding('NATIVE_MODULE_UNDECLARED', 'the bundle declares no native module; the row would mount nothing'))
    return { ok: false, findings }
  }
  for (const mod of modules) {
    if (!isObject(mod) || !nonBlank(mod.name)) { findings.push(finding('NATIVE_MODULE_INVALID', `a native module has no name: ${JSON.stringify(mod)}`)); continue }
    const inject = Array.isArray(mod.inject) ? mod.inject : []
    if (inject.length === 0) findings.push(finding('NATIVE_MODULE_INJECT_EMPTY', `${mod.name} declares no inject services; a mounted module that consumes nothing is not the tool under test`))
    const required = Array.isArray(mod.requiredConfig) ? mod.requiredConfig : []
    const config = isObject(mod.config) ? mod.config : {}
    for (const key of required) {
      if (!nonBlank(String(key))) { findings.push(finding('NATIVE_MODULE_CONFIG_UNDECLARED', `${mod.name} lists a blank required config key`)); continue }
      const value = config[key]
      if (value === undefined || value === null || value === '' ||
          (Array.isArray(value) && value.length === 0) ||
          (isObject(value) && Object.keys(value).length === 0)) {
        findings.push(finding('NATIVE_MODULE_CONFIG_EMPTY', `${mod.name} requires config ${JSON.stringify(key)} but the bundle supplies ${JSON.stringify(value)}; the module would fail to mount (BL-16 attempts 4 and 5)`))
      }
    }
  }
  return { ok: findings.length === 0, findings }
}

/**
 * COLLECTOR / RETURN-SHAPE / TERMINATE / ARCHIVE STRUCTURAL CHECKS.
 *
 * Every case must declare (a) a non-empty corpus of samples it will collect,
 * (b) the return-shape keys its judge reads, (c) a termination step and (d) an
 * archive-before-start bound. A case that cannot say what it will collect is
 * the shape of a boot that returns `NOT_REACHED` for every row.
 *
 * @param {object} bundle
 * @returns {{ok: boolean, findings: object[]}}
 */
export function checkCollectorShape(bundle) {
  const findings = []
  const cases = Array.isArray(bundle?.cases) ? bundle.cases : []
  const JUDGE_KEYS = Object.freeze(['call', 'result', 'claim'])
  for (const c of cases) {
    if (!isObject(c)) continue
    const id = String(c.id ?? '?')
    const corpus = Array.isArray(c.corpus) ? c.corpus : []
    if (corpus.length === 0) findings.push(finding('COLLECTOR_CORPUS_EMPTY', `case ${id} declares no corpus; its judge would read an empty sample and could pass on nulls`))
    const shape = Array.isArray(c.returnShape) ? c.returnShape : []
    const missing = JUDGE_KEYS.filter((k) => !shape.includes(k))
    if (missing.length > 0) findings.push(finding('COLLECTOR_RETURN_SHAPE_MISSING', `case ${id} returnShape is missing ${JSON.stringify(missing)}; the judge's input would be incomplete`))
    if (c.terminate !== true) findings.push(finding('COLLECTOR_TERMINATE_MISSING', `case ${id} declares no termination step; a case that can leave a process or a Member alive is not preflightable`))
    if (c.archiveBeforeStart !== true) findings.push(finding('COLLECTOR_ARCHIVE_MISSING', `case ${id} does not declare archive-before-start; a second run would overwrite the first run's evidence`))
  }
  return { ok: findings.length === 0, findings }
}

/**
 * CANDIDATE SHA + GRANT + RUN-RECORD WIRING.
 *
 * The three identities must agree before a start: the candidate commit the
 * grant is bound to, the tree the run record says it executed on, and the
 * baseline the authority snapshot names. The ledger arithmetic is the same
 * rule the read-gate enforces after the run — checked here so a mis-set budget
 * is found before it is spent.
 *
 * @param {object} bundle
 * @returns {{ok: boolean, findings: object[]}}
 */
export function checkCandidateWiring(bundle) {
  const findings = []
  const grant = isObject(bundle?.grant) ? bundle.grant : null
  const record = isObject(bundle?.runRecord) ? bundle.runRecord : null
  const candidate = isObject(bundle?.candidate) ? bundle.candidate : null
  const authority = isObject(bundle?.authority) ? bundle.authority : null

  if (candidate === null || !SHA40.test(String(candidate.head ?? ''))) {
    findings.push(finding('CANDIDATE_SHA_INVALID', `candidate.head is not a 40-hex commit: ${JSON.stringify(candidate?.head)}`))
  }
  if (candidate !== null && authority !== null && nonBlank(candidate.baseline) && nonBlank(authority.baseline) && candidate.baseline !== authority.baseline) {
    findings.push(finding('CANDIDATE_BASELINE_MISMATCH', `candidate.baseline ${candidate.baseline.slice(0, 12)}… is not the authority baseline ${authority.baseline.slice(0, 12)}…; the run would execute on a tree the snapshot does not name`))
  }
  if (grant === null) {
    findings.push(finding('GRANT_UNDECLARED', 'the bundle carries no grant; no start may be spent'))
  } else {
    if (!nonBlank(grant.grantId)) findings.push(finding('GRANT_UNATTRIBUTED', 'grant.grantId is blank'))
    if (!nonBlank(grant.grantedBy)) findings.push(finding('GRANT_UNATTRIBUTED', 'grant.grantedBy is blank; a start must name who authorised it'))
    if (!SHA40.test(String(grant.boundCommit ?? ''))) findings.push(finding('GRANT_CANDIDATE_MISMATCH', `grant.boundCommit is not a 40-hex commit: ${JSON.stringify(grant.boundCommit)}`))
    else if (candidate !== null && SHA40.test(String(candidate.head ?? '')) && grant.boundCommit !== candidate.head) {
      findings.push(finding('GRANT_CANDIDATE_MISMATCH', `the grant is bound to ${grant.boundCommit.slice(0, 12)}… but the candidate head is ${candidate.head.slice(0, 12)}…; the start would execute on a tree no grant names`))
    }
    const prior = Number(grant.priorRows ?? 0)
    const planned = Number(grant.plannedStarts ?? 0)
    const max = Number(grant.maxStarts ?? 0)
    if (!Number.isInteger(planned) || planned < 1) findings.push(finding('GRANT_NOT_LARGE_ENOUGH', `grant.plannedStarts=${JSON.stringify(grant.plannedStarts)} must be at least 1`))
    if (!Number.isInteger(max) || max < prior + planned) {
      findings.push(finding('GRANT_NOT_LARGE_ENOUGH', `grant.maxStarts=${JSON.stringify(grant.maxStarts)} does not cover prior rows ${JSON.stringify(prior)} + planned starts ${JSON.stringify(planned)}; the read-gate will refuse the run after it has already begun`))
    }
  }
  if (record === null) {
    findings.push(finding('RUNRECORD_UNDECLARED', 'the bundle carries no runRecord block; the wiring cannot be graded'))
  } else {
    if (!SHA40.test(String(record.teamSha ?? ''))) findings.push(finding('RUNRECORD_TEAM_SHA_INVALID', `runRecord.teamSha is not a 40-hex commit: ${JSON.stringify(record.teamSha)}`))
    else if (candidate !== null && SHA40.test(String(candidate.head ?? '')) && record.teamSha !== candidate.head) {
      // The run may execute at the frozen candidate's BASELINE commit only when
      // the per-path proof says the two product trees are byte-identical.
      const proof = Array.isArray(candidate.productTreeProof) ? candidate.productTreeProof : []
      const provenEqual = proof.length > 0 && proof.every((p) => isObject(p) && p.equal === true)
      if (record.teamSha !== candidate.baseline || !provenEqual) {
        findings.push(finding('RUNRECORD_TEAM_SHA_MISMATCH', `the run record names tree ${record.teamSha.slice(0, 12)}… which is neither the candidate head ${candidate.head.slice(0, 12)}… nor its baseline with a per-path productTreeProof proving equality`))
      }
    }
    if (isObject(record.bindings) && isObject(record.bindings.authority) && isObject(record.bindings.authority.pointer) && !nonBlank(record.bindings.authority.pointer.snapshot_version)) {
      findings.push(finding('RUNRECORD_AUTHORITY_MISMATCH', 'runRecord.bindings.authority.pointer names no snapshot_version'))
    }
    const ledger = isObject(record.ledger) ? record.ledger : null
    if (ledger === null) {
      findings.push(finding('LEDGER_ARITHMETIC_MISMATCH', 'runRecord.ledger is absent; bootRows === plannedStarts - aborts cannot be graded'))
    } else {
      const bootRows = Number(ledger.bootRows)
      const planned = Number(ledger.plannedStarts)
      const aborts = Number(ledger.aborts ?? 0)
      if (!Number.isInteger(bootRows) || !Number.isInteger(planned) || !Number.isInteger(aborts)) {
        findings.push(finding('LEDGER_ARITHMETIC_MISMATCH', `runRecord.ledger is not integral: ${JSON.stringify(ledger)}`))
      } else if (bootRows !== planned - aborts) {
        findings.push(finding('LEDGER_ARITHMETIC_MISMATCH', `bootRows=${bootRows} but plannedStarts(${planned}) - aborts(${aborts}) = ${planned - aborts}; the ledger and the plan disagree`))
      }
      if (grant !== null && Number.isInteger(planned) && Number(grant.plannedStarts ?? -1) !== planned) {
        findings.push(finding('LEDGER_ARITHMETIC_MISMATCH', `grant.plannedStarts=${String(grant.plannedStarts)} but runRecord.ledger.plannedStarts=${planned}`))
      }
    }
  }
  return { ok: findings.length === 0, findings }
}

/**
 * Run every preflight check over one bundle and return ONE verdict.
 *
 * The verdict is `FAIL` if ANY check produced a finding. There is no weighting
 * and no "advisory" tier: a preflight exists to stop a start, so a finding is a
 * stop. Every check's findings are returned, not just the first, because an
 * operator fixing an instrument should see all of its defects in one pass.
 *
 * @param {object} bundle
 * @param {{fileExists?: (rel: string) => boolean, now?: () => Date}} [options]
 * @returns {{schema: string, verdict: 'PASS'|'FAIL', checks: object[], findings: object[], summary: string}}
 */
export function runZeroBootPreflight(bundle, options = {}) {
  const checks = []
  const add = (id, result) => {
    checks.push(Object.freeze({ id, verdict: result.findings.length === 0 ? 'PASS' : 'FAIL', findings: Object.freeze(result.findings) }))
  }
  if (!isObject(bundle)) {
    return Object.freeze({
      schema: ZERO_BOOT_PREFLIGHT_SCHEMA,
      verdict: 'FAIL',
      checks: Object.freeze([]),
      findings: Object.freeze([finding('BUNDLE_MALFORMED', 'the preflight input is not an object')]),
      summary: 'FAIL 0/0 checks readable',
    })
  }
  if (bundle.schema !== ZERO_BOOT_PREFLIGHT_SCHEMA) {
    return Object.freeze({
      schema: ZERO_BOOT_PREFLIGHT_SCHEMA,
      verdict: 'FAIL',
      checks: Object.freeze([]),
      findings: Object.freeze([finding('BUNDLE_SCHEMA_MISMATCH', `bundle.schema is ${JSON.stringify(bundle.schema)}, expected ${JSON.stringify(ZERO_BOOT_PREFLIGHT_SCHEMA)}`)]),
      summary: 'FAIL 0/0 checks readable',
    })
  }
  add('assembly.usable', checkAssemblyUsable(bundle, { fileExists: options.fileExists }))
  // One evaluation, partitioned by finding family — a check that ran twice could
  // disagree with itself if a check ever grew a side effect.
  const identity = checkIdentity(bundle)
  add('identity.roots', { findings: identity.findings.filter((f) => f.code.startsWith('IDENTITY_ROOT')) })
  add('identity.blueprints', { findings: identity.findings.filter((f) => f.code.startsWith('IDENTITY_BLUEPRINT')) })
  add('identity.member-tool-binding', { findings: identity.findings.filter((f) => f.code.startsWith('IDENTITY_MEMBER')) })
  add('identity.authority', { findings: identity.findings.filter((f) => f.code.startsWith('IDENTITY_AUTHORITY') || f.code === 'IDENTITY_UNDECLARED') })
  add('native.module-config', checkNativeModuleConfig(bundle))
  const policy = checkPolicyPaths(bundle)
  add('policy.paths', { findings: policy.findings.filter((f) => f.code !== 'POLICY_FIFO_OUTSIDE_LANE') })
  add('policy.fifo', { findings: policy.findings.filter((f) => f.code === 'POLICY_FIFO_OUTSIDE_LANE') })
  add('cases.isolation', checkCaseIsolation(bundle.cases))
  add('collector.shape', checkCollectorShape(bundle))
  const wiring = checkCandidateWiring(bundle)
  add('wiring.candidate', { findings: wiring.findings.filter((f) => f.code.startsWith('CANDIDATE')) })
  add('wiring.grant', { findings: wiring.findings.filter((f) => f.code.startsWith('GRANT')) })
  add('wiring.run-record', { findings: wiring.findings.filter((f) => f.code.startsWith('RUNRECORD') || f.code.startsWith('LEDGER')) })

  const findings = Object.freeze(checks.flatMap((c) => c.findings))
  const passed = checks.filter((c) => c.verdict === 'PASS').length
  const verdict = findings.length === 0 ? 'PASS' : 'FAIL'
  const blocks = findings.length === 0 ? '' : ` blocks=${[...new Set(findings.map((f) => f.code))].join(',')}`
  return Object.freeze({
    schema: ZERO_BOOT_PREFLIGHT_SCHEMA,
    verdict,
    checks: Object.freeze(checks),
    findings,
    summary: `${verdict} ${String(passed)}/${String(checks.length)} checks${blocks}`,
  })
}
