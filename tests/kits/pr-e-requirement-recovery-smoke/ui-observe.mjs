#!/usr/bin/env node
/**
 * ui-observe.mjs — OPT-IN "UI observe" hold-point helpers for the PR-E E.12
 * kit (pre-alpha3 plan: the pending-review / reviewed-payload UI gate).
 *
 * PURPOSE: when the kit runs with `--ui-observe <dir> --ui-hold-ms <n>`, the
 * FIRST recovery-class pending control-request observed by the pending pump
 * (the S9 reviewed payload + digest carrier) is HELD — the kit does NOT
 * resolve it. An external authorized browser session views the REAL pending
 * request in the REAL UI and acts on the SAME real request; the observer
 * tooling drops `marker.json` into the observe dir. The marker is a HINT
 * ONLY — never truth. The kit proceeds ONLY after re-reading durable truth
 * through the kit's existing `team.getLedgerPage` read path and matching
 * requestId + reviewPayloadDigest (recomputed sha256 over canonicalJson of
 * the recorded reviewPayload) + the actual durable fact for the claimed
 * action. Expiry / forged hints are FAIL-CLOSED: "UI NOT_RUN" / "UI TIMEOUT"
 * — the kit NEVER auto-allows and NEVER falls back to resolving on behalf.
 *
 * FLAG-OFF = byte-identical old behavior: every path here is entered only
 * when `parseObserveFlags` returns `enabled:true`.
 *
 * This module also owns the ONE copy of `canonicalJson`/`sha256Hex` (the kit
 * imports them — results are byte-identical to the kit's former local fns,
 * pinned by the golden vectors in ui-observe.test.mjs).
 */

import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync, rmSync, writeSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'

// ── canonical JSON / digest (the kit's exact pattern, single implementation) ─

export function sha256Hex(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

/** Deterministic JSON: keys in ascending code-unit order, compact (the
 *  contracts `canonicalJsonStringify` — recomputed for the S9 digest). */
export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
}

/** The S9 digest pattern (kit L2284-2286): `sha256:` + sha256Hex of the
 *  canonicalJson of the reviewed payload (null-normalized). */
export function reviewPayloadDigestOf(reviewPayload) {
  return `sha256:${sha256Hex(canonicalJson(reviewPayload ?? null))}`
}

// ── typed errors / constants ────────────────────────────────────────────────

/** Closed claim set of the observer marker. Anything else is rejected. */
export const UI_CLAIMS = Object.freeze(['resolved:deny', 'resolved:allow', 'abandon-observed', 'surface-close'])
const UI_CLAIM_SET = new Set(UI_CLAIMS)

/** Hold cap (constraint: <= 300000). The DEFAULT exceeds the 120s
 *  executeTool abort seam so the abandon-observed claim (which can only be
 *  durable AFTER that seam fires) remains verifiable. */
export const MAX_UI_HOLD_MS = 300_000
export const DEFAULT_UI_HOLD_MS = 180_000
const MIN_UI_HOLD_MS = 1_000

export const UI_OBSERVE_FILE = 'marker.json'
export const UI_SUMMARY_FILE = 'summary.json'
export const UI_ACCESS_FILE = 'browser-access.json'

export class ObserveFlagError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ObserveFlagError'
    this.code = code
  }
}

// ── path guards (prefix + realpath containment, fail closed) ────────────────

function rawHasDotDot(p) {
  return /(^|[\\/])\.\.([\\/]|$)/.test(String(p))
}

/** realpath of the nearest EXISTING ancestor, re-joining the rest (a dir the
 *  kit has not created yet cannot carry a symlink in its missing tail). */
function realpathNearest(absPath) {
  const missing = []
  let cur = absPath
  while (!existsSync(cur)) {
    const base = basename(cur)
    const parent = dirname(cur)
    if (base === '' || parent === cur) break
    missing.unshift(base)
    cur = parent
  }
  const real = realpathSync(cur) // throws if even the root is unreadable — fail closed
  return missing.length > 0 ? join(real, ...missing) : real
}

function isInsideOrSame(childReal, parentReal) {
  const p = parentReal.endsWith(sep) ? parentReal : `${parentReal}${sep}`
  return childReal === parentReal || childReal.startsWith(p)
}

/**
 * Parse the two UI flags out of argv.
 *   `--ui-observe <dir>`  enables the mode. COORDINATOR RULING (2026-10-01):
 *                         the dir must resolve INSIDE the authorized
 *                         workspace (`workspaceRoot`, e.g. a controlled dir
 *                         like `<repo>/.worktrees/.scratch-logs/pr54-ui-observe/`),
 *                         still fully separated from the test world: the
 *                         private 0600 browser-access record stays ONLY at
 *                         tests/homes/<world>/browser-access.json and the
 *                         observe dir NEVER carries auth values. Guards
 *                         (fail closed): raw '..' segments, prefix + realpath
 *                         escapes of the workspace, symlink escapes, and
 *                         identical-to / inside the world or anywhere under
 *                         tests/homes.
 *   `--ui-hold-ms <n>`    hold budget (integer ms, 1000..MAX_UI_HOLD_MS);
 *                         only valid together with --ui-observe.
 * Returns { enabled:false, observeDir:null, holdMs:0 } when the mode is off
 * (the kit's old behavior, byte-identical). Typed ObserveFlagError otherwise.
 */
export function parseObserveFlags(argv, { workspaceRoot, worldDir } = {}) {
  const args = Array.isArray(argv) ? argv : []
  const i = args.indexOf('--ui-observe')
  const h = args.indexOf('--ui-hold-ms')
  if (i === -1) {
    if (h !== -1) {
      throw new ObserveFlagError('UI_OBSERVE_HOLD_WITHOUT_MODE', '--ui-hold-ms is only valid together with --ui-observe (fail closed)')
    }
    return { enabled: false, observeDir: null, holdMs: 0 }
  }
  const raw = args[i + 1]
  if (typeof raw !== 'string' || raw === '' || raw.startsWith('--')) {
    throw new ObserveFlagError('UI_OBSERVE_MISSING_VALUE', '--ui-observe requires a directory value')
  }
  if (rawHasDotDot(raw)) {
    throw new ObserveFlagError('UI_OBSERVE_PATH_ESCAPE', `--ui-observe rejects '..' segments in the raw argument: ${raw}`)
  }
  if (typeof workspaceRoot !== 'string' || workspaceRoot === '') {
    throw new ObserveFlagError('UI_OBSERVE_NO_WORKSPACE_ROOT', 'parseObserveFlags requires workspaceRoot for the containment guard')
  }
  const wsReal = realpathNearest(resolve(workspaceRoot))
  const homesReal = realpathNearest(join(wsReal, 'tests', 'homes'))
  const worldReal = typeof worldDir === 'string' && worldDir !== '' ? realpathNearest(resolve(worldDir)) : null
  const obsReal = realpathNearest(resolve(raw))
  if (obsReal === wsReal) {
    throw new ObserveFlagError('UI_OBSERVE_IS_WORKSPACE_ROOT', 'the observe dir must be a CONTROLLED directory INSIDE the workspace, not the workspace root itself')
  }
  if (!isInsideOrSame(obsReal, wsReal)) {
    throw new ObserveFlagError('UI_OBSERVE_OUTSIDE_WORKSPACE', `the observe dir must resolve INSIDE the authorized workspace (${wsReal}) — prefix + realpath guard; got ${obsReal}`)
  }
  if (worldReal !== null && obsReal === worldReal) {
    throw new ObserveFlagError('UI_OBSERVE_IDENTICAL_TO_WORLD', 'the observe dir must NOT be the test world itself')
  }
  if (worldReal !== null && isInsideOrSame(obsReal, worldReal)) {
    throw new ObserveFlagError('UI_OBSERVE_INSIDE_WORLD', 'the observe dir must NOT live inside the test world (the 0600 access record lives there)')
  }
  if (isInsideOrSame(obsReal, homesReal)) {
    throw new ObserveFlagError('UI_OBSERVE_INSIDE_HOME', `the observe dir must live OUTSIDE tests/homes (${homesReal}); got ${obsReal}`)
  }
  if (worldReal !== null && isInsideOrSame(worldReal, obsReal)) {
    throw new ObserveFlagError('UI_OBSERVE_CONTAINS_WORLD', 'the observe dir must be DISJOINT from the test world — the world may not live under it (FIX-3 inverse containment)')
  }
  let holdMs = DEFAULT_UI_HOLD_MS
  if (h !== -1) {
    const rawHold = args[h + 1]
    const n = typeof rawHold === 'string' && /^[0-9]+$/.test(rawHold) ? Number(rawHold) : Number.NaN
    if (!Number.isInteger(n) || n < MIN_UI_HOLD_MS || n > MAX_UI_HOLD_MS) {
      throw new ObserveFlagError('UI_OBSERVE_HOLD_INVALID', `--ui-hold-ms requires an integer in [${MIN_UI_HOLD_MS}, ${MAX_UI_HOLD_MS}] ms; got ${String(rawHold)}`)
    }
    holdMs = n
  }
  return { enabled: true, observeDir: obsReal, holdMs }
}

/**
 * Where the browser ACCESS RECORD may be written: ONLY inside the test world
 * (tests/homes/<world>/browser-access.json — gitignored per TEST_METHODS §3.6).
 * Guards (fail closed): raw '..' segments, worlds outside tests/homes,
 * symlink-escaped worlds, the homes root itself. Returns the absolute path
 * inside the REAL world dir; the CALLER writes it with mode 0o600.
 */
export function validateAccessRecordPath({ repoRoot, worldDir, fileName = UI_ACCESS_FILE } = {}) {
  if (typeof worldDir !== 'string' || worldDir === '') {
    throw new ObserveFlagError('UI_ACCESS_MISSING_WORLD', 'validateAccessRecordPath requires worldDir')
  }
  if (rawHasDotDot(worldDir)) {
    throw new ObserveFlagError('UI_ACCESS_PATH_ESCAPE', `worldDir rejects '..' segments: ${worldDir}`)
  }
  if (rawHasDotDot(fileName) || /[\\/]/.test(fileName)) {
    throw new ObserveFlagError('UI_ACCESS_PATH_ESCAPE', `fileName must be a bare file name: ${fileName}`)
  }
  if (typeof repoRoot !== 'string' || repoRoot === '') {
    throw new ObserveFlagError('UI_ACCESS_MISSING_REPO', 'validateAccessRecordPath requires repoRoot')
  }
  const repoReal = realpathNearest(resolve(repoRoot))
  const homesReal = realpathNearest(join(repoReal, 'tests', 'homes'))
  // FIX-3(a): the HOMES ROOT ITSELF must stay inside the authorized repo tree
  // (a symlinked tests/homes escaping the repo is refused before anything else).
  if (!isInsideOrSame(homesReal, repoReal)) {
    throw new ObserveFlagError('UI_ACCESS_HOMES_ESCAPES_REPO', `tests/homes must stay inside the authorized repo tree (${repoReal}); realpath says ${homesReal}`)
  }
  const worldReal = realpathNearest(resolve(worldDir))
  if (worldReal === homesReal) {
    throw new ObserveFlagError('UI_ACCESS_WORLD_IS_HOMES_ROOT', 'the access record belongs INSIDE one tests/homes/<world>, not the homes root')
  }
  if (!isInsideOrSame(worldReal, homesReal)) {
    throw new ObserveFlagError('UI_ACCESS_NOT_IN_HOMES', `the access record may ONLY be written inside tests/homes/<world> (${homesReal}); got ${worldReal}`)
  }
  // Belt-and-braces (FIX-3(a)): the world's repo containment is IMPLIED by the
  // homes chain above (homes ⊆ repo ∧ world ⊆ homes) — proven again explicitly.
  if (!isInsideOrSame(worldReal, repoReal)) {
    throw new ObserveFlagError('UI_ACCESS_WORLD_ESCAPES_REPO', `the world must stay inside the authorized repo tree (${repoReal}); realpath says ${worldReal}`)
  }
  return join(worldReal, fileName)
}

// ── marker hint: a HINT ONLY, never truth ───────────────────────────────────

/**
 * Tolerant, schema-lite read of `<dir>/marker.json`. Returns
 * { ok, hint|null, reason }. NEVER throws, NEVER trusts: `ok:true` only says
 * the hint is WELL-FORMED — the caller MUST still run `verifyUiTruth` over
 * the durable ledger facts (the hint's ts is passed through but is NEVER a
 * truth input).
 */
export function readMarkerHint(dir) {
  let raw
  try {
    raw = readFileSync(join(String(dir), UI_OBSERVE_FILE), 'utf8')
  } catch (error) {
    return { ok: false, hint: null, reason: (error && error.code) === 'ENOENT' ? 'NO_MARKER' : 'MARKER_READ_FAILED' }
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, hint: null, reason: 'MARKER_NOT_JSON' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, hint: null, reason: 'MARKER_NOT_OBJECT' }
  }
  const { requestId, digest, claimed, ts } = parsed
  if (typeof requestId !== 'string' || requestId === ''
    || typeof digest !== 'string' || digest === ''
    || typeof claimed !== 'string' || !UI_CLAIM_SET.has(claimed)) {
    return { ok: false, hint: null, reason: 'MARKER_MALFORMED' }
  }
  return { ok: true, hint: { requestId, digest, claimed, ts }, reason: null }
}

// ── durable truth: the ONLY basis to proceed ────────────────────────────────

/**
 * verifyUiTruth({ marker, ledgerFacts, expectedRequestId, expectedDigest })
 *  -> { ok, reason?, decision?, claim? }
 *
 * `ledgerFacts` is the RAW entry array from the kit's existing durable read
 * path (`ledgerEntries` over `team.getLedgerPage`). The marker NEVER decides
 * anything — it is only a pointer that this function CONFIRMS against the
 * ledger:
 *   - marker.requestId === expectedRequestId           (else REQUEST_ID mismatch)
 *   - marker.digest === expectedDigest === recomputed sha256 over
 *     canonicalJson of the RECORDED reviewPayload      (else DIGEST mismatch;
 *     the recorded fact's own reviewPayloadDigest must also recompute)
 *   - the DURABLE FACT for the claim:
 *       resolved:deny      -> control-decision-recorded {decision:'deny'}
 *       resolved:allow     -> control-decision-recorded {decision:'allow'}
 *       abandon-observed   -> control-request-abandoned
 *                             (this kit's concrete trigger: the 120s
 *                             executeTool abort seam — a product lifecycle
 *                             fact, never written by the kit)
 *       surface-close      -> ZERO new fact for the requestId (assertion
 *                             ONLY — never treated as deny/allow/abandon)
 * The marker ts is IGNORED for truth (a stale hint is judged solely by the
 * durable fact).
 */
export function verifyUiTruth({ marker, ledgerFacts, expectedRequestId, expectedDigest } = {}) {
  if (marker === null || typeof marker !== 'object' || Array.isArray(marker)) {
    return { ok: false, reason: 'MARKER_MALFORMED' }
  }
  const { requestId, digest, claimed } = marker
  if (typeof requestId !== 'string' || typeof digest !== 'string'
    || typeof claimed !== 'string' || !UI_CLAIM_SET.has(claimed)) {
    return { ok: false, reason: 'MARKER_MALFORMED' }
  }
  if (requestId !== expectedRequestId) {
    return { ok: false, reason: 'MARKER_REQUEST_ID_MISMATCH' }
  }
  if (digest !== expectedDigest) {
    return { ok: false, reason: 'MARKER_DIGEST_MISMATCH' }
  }
  const entries = Array.isArray(ledgerFacts) ? ledgerFacts : []
  const forReq = entries.filter((e) => e?.payload?.requestId === expectedRequestId)
  const recorded = forReq.find((e) => e?.factType === 'control-request-recorded')
  if (recorded === undefined) {
    return { ok: false, reason: 'NO_DURABLE_REQUEST_FACT' }
  }
  const recomputed = reviewPayloadDigestOf(recorded.payload?.reviewPayload ?? null)
  if (typeof recorded.payload?.reviewPayloadDigest !== 'string'
    || recorded.payload.reviewPayloadDigest !== recomputed
    || recomputed !== expectedDigest) {
    return { ok: false, reason: 'RECORDED_DIGEST_MISMATCH' }
  }
  const decisionFact = forReq.find((e) => e?.factType === 'control-decision-recorded')
  const abandonFact = forReq.find((e) => e?.factType === 'control-request-abandoned')
  if (claimed === 'surface-close') {
    const newFacts = forReq.filter((e) => e?.factType !== 'control-request-recorded')
    if (newFacts.length > 0) {
      return { ok: false, reason: 'SURFACE_CLOSE_NOT_ZERO_EFFECT' }
    }
    return { ok: true, decision: 'surface-close-zero-effect', claim: claimed }
  }
  if (claimed === 'abandon-observed') {
    if (abandonFact === undefined) {
      return { ok: false, reason: 'NO_DURABLE_FACT_FOR_CLAIM' }
    }
    return { ok: true, decision: 'abandoned', claim: claimed }
  }
  const want = claimed === 'resolved:deny' ? 'deny' : 'allow'
  if (decisionFact === undefined) {
    return { ok: false, reason: abandonFact !== undefined ? 'NO_DURABLE_FACT_FOR_CLAIM:request-abandoned' : 'NO_DURABLE_FACT_FOR_CLAIM' }
  }
  if (decisionFact.payload?.decision !== want) {
    return { ok: false, reason: `DURABLE_DECISION_MISMATCH:${String(decisionFact.payload?.decision)}` }
  }
  return { ok: true, decision: want, claim: claimed }
}

// ── hold-deadline semantics (pure — fail CLOSED) ────────────────────────────

/**
 * planUiHoldStep({ nowMs, deadlineMs, markerSeen }) ->
 *   { action:'wait', autoResolve:false }
 *   | { action:'fail-closed', autoResolve:false, reason:'UI NOT_RUN'|'UI TIMEOUT' }
 *
 * Fail-closed by construction: the returned decision NEVER carries a
 * resolve/auto-allow action. 'UI NOT_RUN' = no marker was ever seen (the UI
 * lane never ran); 'UI TIMEOUT' = a marker appeared but durable truth never
 * confirmed it within the hold budget.
 */
export function planUiHoldStep({ nowMs, deadlineMs, markerSeen } = {}) {
  if (typeof nowMs !== 'number' || typeof deadlineMs !== 'number') {
    throw new TypeError('planUiHoldStep requires numeric nowMs and deadlineMs')
  }
  if (nowMs >= deadlineMs) {
    return { action: 'fail-closed', autoResolve: false, reason: markerSeen ? 'UI TIMEOUT' : 'UI NOT_RUN' }
  }
  return { action: 'wait', autoResolve: false }
}

// ── token-free summary.json payload ─────────────────────────────────────────

/** origin -> scheme://host only (launch tokens live in the URL query — the
 *  observe dir NEVER carries them; only the kit's 0600 access record does). */
function scrubOrigin(origin) {
  const s = String(origin ?? '')
  try {
    const u = new URL(s)
    return `${u.protocol}//${u.host}`
  } catch {
    return s.split(/[?#]/)[0]
  }
}

/**
 * summarizeUiObserve(...) -> the summary.json payload the kit writes into the
 * observe dir. Token-free BY CONSTRUCTION: scrubbed origin, DIGEST PREFIX
 * only, requestId, outcome, holdMs (+ run stamp/claim).
 */
export function summarizeUiObserve({ runStamp = null, origin = null, requestId = null, digest = null, outcome = null, holdMs = null, claim = null } = {}) {
  return {
    kit: 'pr-e-requirement-recovery-smoke/ui-observe',
    runStamp,
    origin: scrubOrigin(origin),
    requestId,
    digestPrefix: String(digest ?? '').slice(0, 18),
    outcome,
    claim: claim ?? null,
    holdMs,
    at: new Date().toISOString(),
  }
}

// ── UI BOOTSTRAP CLIENT ROW (FIX-1) ─────────────────────────────────────────

/**
 * The S8-pattern CLIENT row contract, copied from the browser-smoke-host
 * `rewriteWorldProfile` (tests/kits/team-view-sync-complete-e2e/
 * browser-smoke-host.mjs L346-372): the browser needs a second, INERT node
 * half whose package.json manifest serves the `./client` export (the built
 * client-bundle.js) to the dynamic cordis runner — without it the team client
 * half never loads in a browser tab (no 团队 tab, zero /team-remote traffic).
 * The row MUST ride in an `insert:` LIST (a top-level `- id:`/`- name:`
 * mapping form is a PatchOptions target and is silently dropped — the
 * smoke-host negative-verified that trap; mirrored here).
 */
export const UI_CLIENT_ROW_ID = 'dsh-agent-team-client'

export function uiClientShimIndexHref(worktree) {
  return `file://${join(String(worktree), 'packages', 'client', 'composition-shim', 'index.js')}`
}

export function uiClientBundlePath(worktree) {
  return join(String(worktree), 'packages', 'client', 'composition-shim', 'client-bundle.js')
}

/**
 * The client-row patch lines. `enabled:false` => [] — the kit's assembled
 * cordis.patch.yml stays BYTE-IDENTICAL to the committed flag-off form
 * (golden-pinned in ui-observe.test.mjs).
 */
export function uiClientPatchLines({ worktree, enabled = true } = {}) {
  if (enabled !== true) return []
  return [
    '# browser client row (S8 pattern — the team client half bundle; UI OBSERVE bootstrap):',
    '- insert:',
    `    - id: ${UI_CLIENT_ROW_ID}`,
    `      name: "${uiClientShimIndexHref(worktree)}"`,
  ]
}

// ── FIX-2: absolute hold deadline (post-read adjudication) ──────────────────

/** Per-poll bound on the DURABLE ledger read inside the UI hold loop. A read
 *  over budget is NEVER adopted as verification — the loop simply keeps
 *  waiting and fails closed at the absolute deadline (the poll loop carries a
 *  read budget instead of the kit changing `ledgerEntries` semantics for the
 *  non-UI paths). */
export const UI_LEDGER_READ_BUDGET_MS = 15_000

/**
 * evaluateUiReadResult({ readDoneMs, deadlineMs, truthOk, budgetExceeded }) ->
 *   { action:'verified'|'not-verified'|'fail-closed', autoResolve:false, reason? }
 *
 * The hold boundary is ABSOLUTE: a durable read that COMPLETES at or past the
 * deadline is fail-closed 'UI TIMEOUT' even when truthOk is true — a late
 * marker or a slow ledger answer crossing the deadline is NEVER VERIFIED.
 * Before the boundary the truth decides; a budget-overrun read is
 * not-yet-verified. NEVER returns a resolve / auto-allow.
 */
export function evaluateUiReadResult({ readDoneMs, deadlineMs, truthOk = false, budgetExceeded = false } = {}) {
  if (typeof readDoneMs !== 'number' || typeof deadlineMs !== 'number') {
    throw new TypeError('evaluateUiReadResult requires numeric readDoneMs and deadlineMs')
  }
  if (readDoneMs >= deadlineMs) {
    return { action: 'fail-closed', autoResolve: false, reason: 'UI TIMEOUT' }
  }
  if (budgetExceeded) {
    return { action: 'not-verified', autoResolve: false, reason: 'READ_BUDGET_EXCEEDED' }
  }
  if (truthOk === true) {
    return { action: 'verified', autoResolve: false }
  }
  return { action: 'not-verified', autoResolve: false }
}

// ── FIX-3: secure private access-record write ───────────────────────────────

function leafState(path) {
  // lstat — NEVER stat: a symlinked leaf must surface as a symlink, not a file.
  try {
    const st = lstatSync(path)
    if (st.isSymbolicLink()) return { exists: true, kind: 'symlink', mode: st.mode & 0o777 }
    if (st.isFile()) return { exists: true, kind: 'file', mode: st.mode & 0o777 }
    return { exists: true, kind: 'other', mode: st.mode & 0o777 }
  } catch (error) {
    if (error && error.code === 'ENOENT') return { exists: false, kind: 'absent', mode: null }
    throw new ObserveFlagError('UI_ACCESS_LEAF_UNSTATABLE', `cannot lstat the access-record leaf: ${String(error?.message ?? error)}`)
  }
}

function refuseExistingLeaf(leaf) {
  // (c)/(d): symlink => refuse (never followed); looser-than-0600 => refuse
  // WITHOUT chmod (legacy private records are never rewritten); a pre-existing
  // 0600 record is STILL refused — this lane only ever writes NEW fixtures it
  // just created under its own name.
  if (leaf.kind === 'symlink') {
    throw new ObserveFlagError('UI_ACCESS_LEAF_SYMLINK', 'the access-record leaf is a symlink — refused, never followed, never rewritten')
  }
  if (leaf.kind !== 'file' || leaf.mode !== 0o600) {
    throw new ObserveFlagError('UI_ACCESS_LEAF_MODE', `a pre-existing leaf (kind=${leaf.kind} mode=0o${(leaf.mode ?? 0).toString(8)}) is not a fresh 0600 record this lane created — refused without chmod/chown/overwrite`)
  }
  throw new ObserveFlagError('UI_ACCESS_LEAF_EXISTS', 'the access-record leaf already exists — this lane only ever writes NEW records it just created')
}

/**
 * writePrivateAccessRecord({ repoRoot, worldDir, payload, fileName }) ->
 *   { path, mode: 0o600 }
 *
 * The ONLY sanctioned way the UI lane persists the PRIVATE browser access
 * record (raw launch URL). Guarantees, all fail-closed (ObserveFlagError):
 *  - placement (validateAccessRecordPath: world inside realpath-pinned
 *    tests/homes inside the authorized repo; homes root itself refused);
 *  - a pre-existing leaf (symlink, wrong kind, or ANY mode) is refused UNTOUCHED —
 *    never followed, never chmod'ed, never overwritten (this lane only writes
 *    NEW fixtures it just created);
 *  - the write uses O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW with mode 0o600 (no temp
 *    file + rename: the leaf is never swapped behind a rename window; the
 *    record is tiny and written once per target request);
 *  - post-write verification: fstat mode === 0o600 AND realpath(leaf) ===
 *    expected path; any mismatch removes OUR OWN fresh record and refuses.
 */
export function writePrivateAccessRecord({ repoRoot, worldDir, payload, fileName = UI_ACCESS_FILE } = {}) {
  const path = validateAccessRecordPath({ repoRoot, worldDir, fileName })
  const before = leafState(path)
  if (before.exists) refuseExistingLeaf(before)
  let fd
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      // Raced into an existing leaf — (c)/(d) checks then refuse, NEVER adopt it.
      refuseExistingLeaf(leafState(path))
    }
    throw new ObserveFlagError('UI_ACCESS_WRITE_FAILED', String(error?.message ?? error))
  }
  try {
    writeSync(fd, JSON.stringify(payload, null, 2))
    const st = fstatSync(fd)
    if (!st.isFile() || (st.mode & 0o777) !== 0o600) {
      throw new Error(`fstat mode 0o${(st.mode & 0o777).toString(8)} is not 0600`)
    }
  } catch (error) {
    try { closeSync(fd) } catch { /* best effort */ }
    try { rmSync(path) } catch { /* best effort — OUR OWN record only */ }
    throw new ObserveFlagError('UI_ACCESS_WRITE_UNVERIFIED', `post-write fstat verification failed: ${String(error?.message ?? error)}`)
  }
  closeSync(fd)
  if (realpathSync(path) !== path) {
    try { rmSync(path) } catch { /* best effort — OUR OWN record only */ }
    throw new ObserveFlagError('UI_ACCESS_WRITE_UNVERIFIED', 'realpath(access record) drifted from the guarded path — refused')
  }
  return { path, mode: 0o600 }
}
