/**
 * agent-state-family/src/fs-state-store.mjs — the PRODUCTION durable store
 * behind the injected state-store port (`state-store.mjs` owns the contract;
 * this file owns PERSISTENCE).
 *
 * WHY IT EXISTS (U7 stop condition): the family's hard-stop was "功能必交项
 * 仅『拒绝所有调用』" — with no store backend every L4-positive arm was
 * DISCLOSED. This module is the durable home those arms run on.
 *
 * SCOPE LAW — BYTE-EXACT, NO NORMALISATION. The key is the family's own
 * `agent:<id>` built from the dispatch's calling agent
 * (`executors.mjs#scopeOf`, already byte-exact). This store never trims,
 * folds, lowercases or unicodes it: the record FILE is named by the sha256 of
 * the key's exact bytes (so an arbitrary id cannot shape a path), and the key
 * itself is stored VERBATIM inside the record and re-compared byte-for-byte
 * on every read — a record whose key does not match is CORRUPT, never
 * "empty state". Two identities differing by one trailing space hash
 * differently and can never alias.
 *
 * DURABILITY + ATOMICITY. A write is fully applied or not at all: the record
 * is written to a fresh temp file in the SAME directory, `fsync`ed, then
 * `rename`d over the target, and the directory is `fsync`ed. A crash can
 * therefore never leave a half-goal; the reader sees the old bytes or the new
 * bytes, never a torn record.
 *
 * REPLAY / CAS. `applyId` (the PA call correlation) is the durable
 * idempotence anchor: consuming it is an EXCLUSIVE CREATE of its own marker
 * file (`wx`), which is atomic on every POSIX filesystem, so a consumed grant
 * cannot apply twice even across a restart. Order is consume-THEN-commit: a
 * crash between the two loses the mutation but can never double-apply it
 * (at-most-once, the direction the law requires). `expectedRevision` CAS and
 * the create/already-exists leg mirror `createRecordingStateStore` exactly —
 * the fake is the specification.
 *
 * THE ATTEMPT/WRITE LEDGERS ARE DURABLE, not in-memory testimony:
 *   ledger/attempts.jsonl — one line per APPLY call with its outcome.
 *   ledger/writes.jsonl   — the DURABLE-WRITE audit: a line IFF a mutation
 *                           committed. A refused apply appends ONE attempts
 *                           line and leaves writes untouched — the zero-write
 *                           refusal law is a DISK fact, asserted as a byte
 *                           growth of `writes.jsonl` of exactly 0.
 *
 * BOUNDS. A per-scope record is bounded (`maxScopeBytes`) and every read is
 * bounded to that bound: an oversized record refuses typed, never a
 * truncated read that would parse into a plausible-but-wrong state.
 *
 * HARD LINK LAW. Reads go through {safeReadRecord} — component-free
 * `O_RDONLY | O_NOFOLLOW` open of the final path, `fstat` through the
 * descriptor, refuse unless it is a regular file with `nlink === 1` inside
 * the size bound, then read the SAME descriptor (no path re-resolution
 * between check and read). A symlink or a hardlink alias is refused typed.
 *   // TODO(#409): replace with hardlinkAliasVerdict from controlled-fs once
 *   // merged. #409 (origin/task/u7-fixfwd-20261027, 139f566a3 "fix(fs-law):
 *   // read paths refuse hardlink aliases") is NOT on master at this branch
 *   // point, and this lane must not vendor an unmerged symbol; the nlink>1
 *   // refusal above is pinned by its own test so the swap is a behaviour-
 *   // preserving edit.
 *
 * PURITY: `node:*` only (the lane's booked edge). No import of the plane, the
 * governance center, another family lane, or any Host internal.
 *
 * @module tools/agent-state-family/fs-state-store
 */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { constants as fsConstants, promises as fsp, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, sep } from 'node:path'
import process from 'node:process'

/** The durable subtree this store owns, relative to the harness home. */
export const STATE_STORE_SUBTREE = Object.freeze(['team-state', 'agent-state'])

/** The per-scope record bound. A goal/todo/plan-mode record is a handful of
 *  KiB; 256 KiB is ~50x the honest ceiling and still bounded on every read. */
export const MAX_SCOPE_BYTES = 256 * 1024
/** The per-ledger-line bound (attempt/write lines are tiny). */
export const MAX_LEDGER_LINE_BYTES = 8 * 1024

const RECORD_SCHEMA = 'agent-state-scope/1'
const OPEN_NOFOLLOW = (fsConstants.O_RDONLY ?? 0) | (fsConstants.O_NOFOLLOW ?? 0)
const CREATE_EXCLUSIVE = (fsConstants.O_WRONLY ?? 0) | (fsConstants.O_CREAT ?? 0) | (fsConstants.O_EXCL ?? 0)

const typedError = (code, detail) => {
  const error = new Error(`${code}: ${detail}`)
  error.code = code
  error.detail = detail
  return error
}
const refusal = (code, detail) => ({ ok: false, code, detail })
const digestOf = (text) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')

/** The home guards are law, not decoration: a wrong home writes durable state
 *  into the operator's real `~/.dsh` (or outside any sanctioned root), which
 *  is exactly the accident the test-methods red line exists to prevent. */
const sameOrUnder = (child, parent) => child === parent || child.startsWith(parent.endsWith(sep) ? parent : `${parent}${sep}`)

/**
 * Resolve the durable harness home for the agent-state store from the
 * environment, with every dangerous shape REFUSED (never defaulted):
 *   - absent or blank                      -> AGENT_STATE_STORE_HOME_MISSING
 *   - relative / not an existing directory -> AGENT_STATE_STORE_HOME_INVALID
 *   - realpath equal to or beneath the
 *     operator's real `~/.dsh`              -> AGENT_STATE_STORE_HOME_INVALID
 *
 * The `~/.dsh` refusal is a POSITIVE guard, not a fallback: the harness's own
 * `resolveDshHome()` quietly answers `~/.dsh` when `$DSH_HOME` is unset, and
 * writing governed state into a developer's live harness home is exactly the
 * accident the test-methods red line forbids. Only an explicit, absolute,
 * existing, non-live-home `$DSH_HOME` is accepted. Precedent for reading the
 * variable directly: `packages/tools/harness/plugin.mjs:166`.
 *
 * SYNCHRONOUS on purpose: the descriptor's `build(cap)` is called
 * synchronously by the plane (`team-tool-plane.mjs:1644`).
 *
 * NAMED FOLLOW-UP (not a permanent design): this reads the environment
 * because the family capability object (`CAPABILITY_KEYS`,
 * `family-assembly.mjs:60-74`) carries no home path, and
 * `cap.hostService('dshHomePath')` binds only at `mount(agentCtx)`
 * (`team-tool-plane.mjs:2048`) — after `build`. A `homePath` capability is
 * the clean fix; it is a named center-interface change and is NOT made here
 * (CORE PATCH BUDGET = 0).
 *
 * @param {{env?: Record<string, string | undefined>, realHome?: string}} [opts]
 * @returns {{ok: true, home: string} | {ok: false, code: string, detail: string}}
 */
export function resolveAgentStateHome({ env = process.env, realHome } = {}) {
  const raw = env?.DSH_HOME
  if (raw === undefined || String(raw).trim().length === 0) {
    return refusal('AGENT_STATE_STORE_HOME_MISSING', 'DSH_HOME is not set, so this mount has no durable home to write governed agent state into (refused — an invented default would write outside the sanctioned root)')
  }
  const candidate = String(raw)
  if (!isAbsolute(candidate)) {
    return refusal('AGENT_STATE_STORE_HOME_INVALID', `DSH_HOME must be an absolute path — got ${JSON.stringify(candidate.slice(0, 120))} (refused, never resolved against the cwd)`)
  }
  let real
  try {
    real = realpathSync(candidate)
  } catch (error) {
    return refusal('AGENT_STATE_STORE_HOME_INVALID', `DSH_HOME does not resolve to an existing directory: ${String(error?.code ?? error)}`)
  }
  const operatorHome = realHome ?? homedir()
  let realOperatorHome = operatorHome
  try { realOperatorHome = realpathSync(operatorHome) } catch { /* keep the given form */ }
  const liveDsh = join(realOperatorHome, '.dsh')
  let realLiveDsh = liveDsh
  try { realLiveDsh = realpathSync(liveDsh) } catch { /* absent live home: compare the spelling */ }
  if (sameOrUnder(real, liveDsh) || sameOrUnder(real, realLiveDsh)) {
    return refusal('AGENT_STATE_STORE_HOME_INVALID', `DSH_HOME resolves to the operator's live harness home (${liveDsh}) — governed agent state is never written there; refusing`)
  }
  let stat
  try { stat = statSync(real) } catch (error) {
    return refusal('AGENT_STATE_STORE_HOME_INVALID', `DSH_HOME is unreadable: ${String(error?.code ?? error)}`)
  }
  if (!stat.isDirectory()) return refusal('AGENT_STATE_STORE_HOME_INVALID', 'DSH_HOME is not a directory')
  return { ok: true, home: real }
}

/** The realm id names ONE directory under the store subtree: a closed
 *  path-safe spelling, never `.`/`..`, never a separator. */
const REALM_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/
export function storeRootFor(home, realmId) {
  if (typeof realmId !== 'string' || !REALM_SEGMENT.test(realmId)) {
    return refusal('AGENT_STATE_STORE_REALM_INVALID', `the realm id ${JSON.stringify(String(realmId).slice(0, 80))} is not a path-safe single segment (refused, never sanitised into another realm's directory)`)
  }
  return { ok: true, rootDir: join(home, ...STATE_STORE_SUBTREE, realmId) }
}

/** fsync one directory so a rename is durable, not merely visible. */
const fsyncDir = async (dir) => {
  let handle
  try {
    handle = await fsp.open(dir, fsConstants.O_RDONLY)
    await handle.sync()
  } catch {
    /* directory fsync is unavailable on some platforms/filesystems; the
     * rename itself is still atomic, which is the crash-safety requirement. */
  } finally {
    if (handle !== undefined) { try { await handle.close() } catch { /* closed */ } }
  }
}

/**
 * The ONE safe-read leg. Open the final path with `O_NOFOLLOW` (so a symlink
 * is ELOOP, never followed), `fstat` THROUGH the descriptor, refuse anything
 * that is not a regular file with `nlink === 1` inside the bound, then read
 * the SAME descriptor — the identity that was checked is the identity that is
 * read.
 * @param {string} path
 * @param {number} limit
 * @returns {Promise<{ok: true, text: string} | {ok: false, code: string, detail: string, absent?: boolean}>}
 */
export async function safeReadRecord(path, limit = MAX_SCOPE_BYTES) {
  let handle
  try {
    handle = await fsp.open(path, OPEN_NOFOLLOW)
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: false, code: 'AGENT_STATE_SCOPE_ABSENT', detail: 'no record at this scope', absent: true }
    if (error?.code === 'ELOOP') return refusal('AGENT_STATE_STORE_ALIAS_REFUSED', `the state record at this scope is a symlink (O_NOFOLLOW refused it): ${path}`)
    return refusal('AGENT_STATE_STORE_UNREADABLE', `the state record could not be opened: ${String(error?.code ?? error)}`)
  }
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) return refusal('AGENT_STATE_STORE_NOT_A_FILE', 'the state record is not a regular file')
    if (stat.nlink !== 1) {
      // TODO(#409): replace with hardlinkAliasVerdict once merged (see header).
      return refusal('AGENT_STATE_STORE_ALIAS_REFUSED', `the state record has ${String(stat.nlink)} hard links; an aliased durable fact is refused (the hardlink law)`)
    }
    if (stat.size > limit) {
      return refusal('AGENT_STATE_STORE_OVERSIZED', `the state record is ${String(stat.size)} bytes, over the ${String(limit)}-byte bound for one scope (refused, never truncated into a plausible state)`)
    }
    const buffer = Buffer.allocUnsafe(limit)
    let offset = 0
    for (;;) {
      const { bytesRead } = await handle.read(buffer, offset, limit - offset, offset)
      if (bytesRead === 0) break
      offset += bytesRead
      if (offset > limit) return refusal('AGENT_STATE_STORE_OVERSIZED', `the state record grew past the ${String(limit)}-byte bound mid-read (refused)`)
    }
    return { ok: true, text: buffer.subarray(0, offset).toString('utf8') }
  } catch (error) {
    return refusal('AGENT_STATE_STORE_UNREADABLE', `the state record could not be read: ${String(error?.code ?? error)}`)
  } finally {
    try { await handle.close() } catch { /* closed */ }
  }
}

/** The default byte-writer: the whole text through the open descriptor. */
const writeAll = async (handle, text) => { await handle.writeFile(text, 'utf8') }

/** Atomic durable replace: temp file in the SAME directory, fsync, rename,
 *  fsync the directory. Never a partial record. `writeBytes` is the C1
 *  crash-simulation seam (a test may make it write half the bytes and then
 *  die); production always uses {writeAll}. */
async function atomicWrite(dir, filename, text, writeBytes = writeAll) {
  await fsp.mkdir(dir, { recursive: true })
  const target = join(dir, filename)
  const temp = join(dir, `.${filename}.${process.pid}.${Date.now().toString(36)}.tmp`)
  let handle
  try {
    handle = await fsp.open(temp, CREATE_EXCLUSIVE, 0o600)
    await writeBytes(handle, text)
    await handle.sync()
  } finally {
    if (handle !== undefined) { try { await handle.close() } catch { /* closed */ } }
  }
  try {
    await fsp.rename(temp, target)
  } catch (error) {
    try { await fsp.unlink(temp) } catch { /* best effort */ }
    throw typedError('AGENT_STATE_STORE_WRITE_FAILED', `the atomic rename failed: ${String(error?.code ?? error)}`)
  }
  await fsyncDir(dir)
}

/** Append one bounded line to a durable JSONL ledger, fsynced. */
async function appendLedgerLine(dir, filename, entry) {
  const line = `${JSON.stringify(entry)}\n`
  if (Buffer.byteLength(line, 'utf8') > MAX_LEDGER_LINE_BYTES) {
    throw typedError('AGENT_STATE_STORE_OVERSIZED', `a ledger line exceeded ${String(MAX_LEDGER_LINE_BYTES)} bytes`)
  }
  await fsp.mkdir(dir, { recursive: true })
  const path = join(dir, filename)
  let handle
  try {
    handle = await fsp.open(path, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_APPEND, 0o600)
    await handle.writeFile(line, 'utf8')
    await handle.sync()
  } finally {
    if (handle !== undefined) { try { await handle.close() } catch { /* closed */ } }
  }
}

/** The durable size of a ledger, in bytes — the zero-write assertion reads
 *  THIS, so "no new write entry" is a disk measurement. */
export async function ledgerBytes(dir, filename = 'writes.jsonl') {
  try {
    const stat = await fsp.stat(join(dir, filename))
    return stat.size
  } catch {
    return 0
  }
}

/**
 * The production EXECUTION-ORIGIN arm provider (`armFor`). The arm is not
 * durable state — it is a fact about the calling turn — so it is resolved
 * LAZILY from the mount's public host services (`cap.hostService(name)`, the
 * same seam `agent-control-family` and the `attachments`/`llm` lookups ride),
 * never persisted and never guessed:
 *
 *   agents.get(sessionId)                       the live agent
 *   sessionProjections.stateOf(session,'turnBoundary')  the open-turn cut
 *   agents.roots() / agents.currentInitiator()  the host's own "top-level" test
 *   agent.session.snapshotEvents()              the turn's events
 *
 * It mirrors the pinned host authority (`tool-goal/src/authority.ts:81-117`
 * @639ed01539): `direct-human` iff a `user/message` with `source.kind ===
 * 'user'` appears in the open turn of a ROOT agent; `goal-round` iff the turn
 * carries the exact `source.kind==='goal'` {goalId, revision, round}; else
 * `{kind:'model'}` — the CONSERVATIVE arm, under which every direct-human leg
 * refuses. An unresolvable service answers `model`, never a fabricated
 * human. That is the fail-closed direction.
 *
 * @param {{hostService: (name: string) => unknown}} input
 */
export function createHostArmProvider({ hostService }) {
  const lookup = (name) => {
    try { return typeof hostService === 'function' ? hostService(name) : undefined } catch { return undefined }
  }
  const model = Object.freeze({ kind: 'model' })
  return (scope) => {
    // `agent:` is the family's OWN fixed encoding (executors.mjs#scopeOf);
    // slicing its exact prefix recovers the id byte-for-byte.
    const prefix = 'agent:'
    if (typeof scope !== 'string' || !scope.startsWith(prefix)) return model
    const agentId = scope.slice(prefix.length)
    const agents = lookup('agents')
    const projections = lookup('sessionProjections')
    if (agents === null || typeof agents !== 'object') return model
    let agent
    try { agent = typeof agents.get === 'function' ? agents.get(agentId) : undefined } catch { return model }
    if (agent === undefined || agent === null) return model
    const session = agent.session
    if (session === null || typeof session !== 'object') return model
    let events
    try { events = typeof session.snapshotEvents === 'function' ? session.snapshotEvents() : undefined } catch { return model }
    if (!Array.isArray(events)) return model
    let boundary
    try { boundary = projections === null || typeof projections !== 'object' ? undefined : projections.stateOf(session, 'turnBoundary') } catch { return model }
    const start = boundary?.openTurnStartSeq
    if (!Number.isInteger(start)) return model
    let isRoot = false
    try { isRoot = typeof agents.roots === 'function' && Array.isArray(agents.roots()) && agents.roots().includes(agent) } catch { isRoot = false }
    let goalRound = null
    for (let seq = start + 1; seq < events.length; seq += 1) {
      const event = events[seq]
      if (event?.type !== 'user/message') continue
      const source = event.data?.source
      if (source?.kind === 'user' && isRoot === true) return Object.freeze({ kind: 'direct-human' })
      if (source?.kind === 'goal' && typeof source.goalId === 'string') {
        goalRound = Object.freeze({ kind: 'goal-round', goalId: source.goalId, revision: source.revision, round: source.round })
      }
    }
    return goalRound ?? model
  }
}

/** The record filename for a scope: the sha256 of the key's EXACT bytes.
 *  Hashing is not normalisation — the key is still stored and compared
 *  verbatim; the digest only keeps an arbitrary id from shaping a path. */
const recordName = (scope) => `${digestOf(scope)}.json`
const markerName = (applyId) => `${digestOf(`apply:${String(applyId)}`)}.mark`

/**
 * @param {object} input
 * @param {string} input.rootDir   the realm's store root (`<home>/team-state/agent-state/<realmId>`).
 * @param {string} [input.anchorDir] the resolved harness home the root must
 *        stay beneath; checked by REALPATH on first use (a symlinked
 *        `team-state` component pointing elsewhere is refused before any write).
 * @param {string} input.realmId
 * @param {(scope: string) => object} [input.armProvider] execution-origin arm;
 *        default answers `{kind:'model'}` (the conservative arm).
 * @param {number} [input.maxScopeBytes]
 * @param {() => string} [input.nowIso] persistence clock (the store owns it).
 * @param {(handle: import('node:fs').promises.FileHandle, text: string) => Promise<void>} [input.recordWriter]
 *        C1 crash-simulation seam ONLY (writes the record bytes into the open
 *        temp descriptor). The descriptor never passes it.
 */
export function createFsStateStore({
  rootDir, realmId, anchorDir = rootDir, armProvider = () => Object.freeze({ kind: 'model' }),
  maxScopeBytes = MAX_SCOPE_BYTES, nowIso = () => new Date().toISOString(),
  recordWriter = writeAll,
}) {
  if (typeof rootDir !== 'string' || !isAbsolute(rootDir)) {
    throw typedError('AGENT_STATE_STORE_HOME_INVALID', 'the store root must be an absolute path')
  }
  const scopeDir = join(rootDir, 'scopes')
  const markerDir = join(rootDir, 'applied')
  const ledgerDir = join(rootDir, 'ledger')
  // In-memory mirrors of the durable ledgers, in the same shape the C1 fake
  // exposes (`log.reads` / `log.attempts` / `log.writes`) so the same
  // assertions read the production store.
  const log = { reads: [], writes: [], attempts: [] }
  let dirReady = false
  /** Anchor law: create the realm root, then prove by REALPATH that it (and
   *  every directory the store will write into) still sits beneath the
   *  resolved home. A symlinked component that redirects the subtree is
   *  refused before the first byte is written. */
  const ensureDirs = async () => {
    if (dirReady) return
    await fsp.mkdir(rootDir, { recursive: true })
    const realAnchor = await fsp.realpath(anchorDir)
    for (const dir of [rootDir, scopeDir, markerDir, ledgerDir]) {
      await fsp.mkdir(dir, { recursive: true })
      const real = await fsp.realpath(dir)
      if (!sameOrUnder(real, realAnchor) || real !== dir) {
        throw typedError('AGENT_STATE_STORE_PATH_REFUSED', `the store directory ${dir} resolves to ${real}, outside (or aliased away from) the sanctioned home ${realAnchor} — refused before any write`)
      }
    }
    dirReady = true
  }
  /** Containment: every path this store touches must sit beneath its root. */
  const inside = (path) => sameOrUnder(path, rootDir)

  const readState = async (scope) => {
    await ensureDirs()
    const path = join(scopeDir, recordName(scope))
    if (!inside(path)) throw typedError('AGENT_STATE_STORE_PATH_REFUSED', 'resolved a path outside the store root')
    const read = await safeReadRecord(path, maxScopeBytes)
    if (read.ok !== true) {
      if (read.absent === true) return null
      throw typedError(read.code, read.detail)
    }
    let parsed
    try { parsed = JSON.parse(read.text) } catch (error) {
      throw typedError('AGENT_STATE_STORE_CORRUPT', `the state record is not valid JSON (${String(error?.message ?? error).slice(0, 120)}) — refused, never read as empty state`)
    }
    if (parsed === null || typeof parsed !== 'object' || parsed.schema !== RECORD_SCHEMA) {
      throw typedError('AGENT_STATE_STORE_CORRUPT', 'the state record has an unknown schema — refused, never read as empty state')
    }
    // BYTE-EXACT identity: the stored key must be this scope, verbatim.
    if (parsed.key !== scope) {
      throw typedError('AGENT_STATE_STORE_CORRUPT', 'the state record carries a different key than the scope requested (refused — no aliasing, no normalisation)')
    }
    return parsed
  }
  const writeState = async (scope, patch) => {
    await ensureDirs()
    const current = await readState(scope)
    const next = {
      schema: RECORD_SCHEMA,
      key: scope,
      realmId,
      goal: current?.goal ?? null,
      todos: current?.todos ?? null,
      planMode: current?.planMode ?? { active: false, pendingIntents: [] },
      updatedAt: nowIso(),
      ...patch,
    }
    const text = `${JSON.stringify(next)}\n`
    if (Buffer.byteLength(text, 'utf8') > maxScopeBytes) {
      throw typedError('AGENT_STATE_STORE_OVERSIZED', `the record would be over the ${String(maxScopeBytes)}-byte per-scope bound (refused; nothing written)`)
    }
    await atomicWrite(scopeDir, recordName(scope), text, recordWriter)
    return next
  }
  /** Consume an applyId durably and atomically. `wx` is the CAS. */
  const consume = async (applyId) => {
    await ensureDirs()
    const path = join(markerDir, markerName(applyId))
    if (!inside(path)) throw typedError('AGENT_STATE_STORE_PATH_REFUSED', 'resolved a marker path outside the store root')
    try {
      const handle = await fsp.open(path, CREATE_EXCLUSIVE, 0o600)
      try { await handle.writeFile(`${JSON.stringify({ applyId: String(applyId), at: nowIso() })}\n`, 'utf8'); await handle.sync() } finally { await handle.close() }
      await fsyncDir(markerDir)
      return true
    } catch (error) {
      if (error?.code === 'EEXIST') return false
      throw typedError('AGENT_STATE_STORE_WRITE_FAILED', `the apply marker could not be written: ${String(error?.code ?? error)}`)
    }
  }
  /** Roll a consumed marker back when the commit behind it failed, so a
   *  transient write fault does not silently burn a grant. */
  const unconsume = async (applyId) => {
    try { await fsp.unlink(join(markerDir, markerName(applyId))) } catch { /* best effort */ }
  }
  const attemptEntry = (op, scope, resource, applyId) => {
    const entry = { op, scope, key: `${scope}/${resource}`, applyId, outcome: 'refused' }
    log.attempts.push(entry)
    return entry
  }
  const finishAttempt = async (entry) => {
    try { await appendLedgerLine(ledgerDir, 'attempts.jsonl', entry) } catch { /* the ledger is best-effort on the refusal path; the ANSWER is not */ }
  }
  const commitWrite = async (entry) => {
    log.writes.push(entry)
    await appendLedgerLine(ledgerDir, 'writes.jsonl', entry)
  }

  return Object.freeze({
    name: 'agent-state:fs',
    realmId,
    rootDir,
    log,
    /** Absolute durable ledger files (evidence-readable). */
    ledgerPaths: Object.freeze({ attempts: join(ledgerDir, 'attempts.jsonl'), writes: join(ledgerDir, 'writes.jsonl') }),
    /** The durable write-audit size — the independent zero-write witness. */
    writesBytes: () => ledgerBytes(ledgerDir, 'writes.jsonl'),
    attemptCount: () => log.attempts.length,
    /** Read one scope's whole record (tests/evidence; bounded, typed). */
    stateOf: async (scope) => await readState(scope),
    armFor: (scope) => armProvider(scope),

    readGoal: async (scope) => {
      log.reads.push({ op: 'goal/read', scope, key: `${scope}/goal` })
      return (await readState(scope))?.goal ?? null
    },
    applyGoal: async (scope, { expectedRevision, next, applyId }) => {
      const attempt = attemptEntry('goal/apply', scope, 'goal', applyId)
      if ((await consume(applyId)) !== true) {
        attempt.code = 'STATE_APPLY_REPLAY'
        await finishAttempt(attempt)
        return refusal('STATE_APPLY_REPLAY', `apply ${String(applyId)} already consumed; a consumed grant never applies twice`)
      }
      let current
      try { current = (await readState(scope))?.goal ?? null } catch (error) {
        await unconsume(applyId)
        attempt.code = String(error?.code ?? 'AGENT_STATE_STORE_FAULT')
        await finishAttempt(attempt)
        return refusal(attempt.code, String(error?.detail ?? error?.message ?? error))
      }
      // The CAS / already-exists legs, verbatim from the recording fake.
      if (expectedRevision === null) {
        if (current !== null && current.phase !== 'complete') {
          await unconsume(applyId)
          attempt.code = 'GOAL_ALREADY_EXISTS'
          await finishAttempt(attempt)
          return refusal('GOAL_ALREADY_EXISTS', `goal "${current.goalId}" already exists with phase "${current.phase}"`)
        }
      } else if (current === null || current.goalId !== next.goalId || current.revision !== expectedRevision) {
        await unconsume(applyId)
        attempt.code = 'GOAL_STALE_REVISION'
        await finishAttempt(attempt)
        return refusal('GOAL_STALE_REVISION', `stale goal ref "${String(next.goalId)}" revision ${String(expectedRevision)}; current is "${String(current?.goalId)}" revision ${String(current?.revision)}`)
      }
      try {
        await writeState(scope, { goal: next })
      } catch (error) {
        await unconsume(applyId)
        attempt.code = String(error?.code ?? 'AGENT_STATE_STORE_WRITE_FAILED')
        await finishAttempt(attempt)
        return refusal(attempt.code, String(error?.detail ?? error?.message ?? error))
      }
      attempt.outcome = 'applied'
      await finishAttempt(attempt)
      await commitWrite({ op: 'goal/apply', scope, key: `${scope}/goal`, applyId })
      return { ok: true, snapshot: next }
    },
    readTodos: async (scope) => {
      log.reads.push({ op: 'todos/read', scope, key: `${scope}/todos` })
      return (await readState(scope))?.todos ?? null
    },
    applyTodos: async (scope, { todos, applyId }) => {
      const attempt = attemptEntry('todos/apply', scope, 'todos', applyId)
      if ((await consume(applyId)) !== true) {
        attempt.code = 'STATE_APPLY_REPLAY'
        await finishAttempt(attempt)
        return refusal('STATE_APPLY_REPLAY', `apply ${String(applyId)} already consumed; a consumed grant never applies twice`)
      }
      try {
        await writeState(scope, { todos: todos.map((t) => ({ ...t })) })
      } catch (error) {
        await unconsume(applyId)
        attempt.code = String(error?.code ?? 'AGENT_STATE_STORE_WRITE_FAILED')
        await finishAttempt(attempt)
        return refusal(attempt.code, String(error?.detail ?? error?.message ?? error))
      }
      attempt.outcome = 'applied'
      await finishAttempt(attempt)
      await commitWrite({ op: 'todos/apply', scope, key: `${scope}/todos`, applyId })
      return { ok: true, todos }
    },
    readPlanMode: async (scope) => {
      log.reads.push({ op: 'plan-mode/read', scope, key: `${scope}/plan-mode` })
      return (await readState(scope))?.planMode ?? { active: false, pendingIntents: [] }
    },
    applyPlanModeExit: async (scope, { plan, applyId }) => {
      const attempt = attemptEntry('plan-mode/apply', scope, 'plan-mode', applyId)
      if ((await consume(applyId)) !== true) {
        attempt.code = 'STATE_APPLY_REPLAY'
        await finishAttempt(attempt)
        return refusal('STATE_APPLY_REPLAY', `apply ${String(applyId)} already consumed; a consumed grant never applies twice`)
      }
      let current
      try { current = (await readState(scope))?.planMode ?? { active: false, pendingIntents: [] } } catch (error) {
        await unconsume(applyId)
        attempt.code = String(error?.code ?? 'AGENT_STATE_STORE_FAULT')
        await finishAttempt(attempt)
        return refusal(attempt.code, String(error?.detail ?? error?.message ?? error))
      }
      if (current.active !== true) {
        await unconsume(applyId)
        attempt.code = 'PLAN_MODE_NOT_ACTIVE'
        await finishAttempt(attempt)
        return refusal('PLAN_MODE_NOT_ACTIVE', 'exit_plan_mode is only available in plan mode')
      }
      const nextState = { active: false, pendingIntents: [...current.pendingIntents, { plan, appliedBy: applyId }] }
      try {
        await writeState(scope, { planMode: nextState })
      } catch (error) {
        await unconsume(applyId)
        attempt.code = String(error?.code ?? 'AGENT_STATE_STORE_WRITE_FAILED')
        await finishAttempt(attempt)
        return refusal(attempt.code, String(error?.detail ?? error?.message ?? error))
      }
      attempt.outcome = 'applied'
      await finishAttempt(attempt)
      await commitWrite({ op: 'plan-mode/apply', scope, key: `${scope}/plan-mode`, applyId })
      return { ok: true, state: nextState }
    },
    /** Scenario control for tests/worlds: plant or flip PLAN MODE (the
     *  family has no tool that enters plan mode — the host's plan-mode
     *  service does — so the durable flag is seeded, never invented by a
     *  governed row). Writes through the SAME atomic path. */
    seedPlanMode: async (scope, active) => {
      await writeState(scope, { planMode: { active: active === true, pendingIntents: [] } })
    },
    /** Scenario control: plant a goal snapshot (cross-scope fixtures). */
    seedGoal: async (scope, goal) => { await writeState(scope, { goal }) },
    /** The realm's store root, for evidence binding (path only). */
    root: () => rootDir,
    /** Resolve the realm store root under a resolved harness home. */
  })
}
