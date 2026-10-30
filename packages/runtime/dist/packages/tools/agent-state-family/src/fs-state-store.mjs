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
 * is written to a fresh `O_EXCL` temp file in the SAME (pinned) directory,
 * `fsync`ed, then `rename`d over the target, and the directory is `fsync`ed.
 * A crash can therefore never leave a half-goal; the reader sees the old bytes
 * or the new bytes, never a torn record.
 *
 * CONTAINMENT ON EVERY OPERATION (review B-1). Nothing is cached: EVERY read
 * and EVERY write re-walks the store subtree from the resolved home one
 * component at a time, opening each directory `O_DIRECTORY | O_NOFOLLOW`
 * RELATIVE TO THE PREVIOUS DIRECTORY'S DESCRIPTOR (`/proc/self/fd/<n>/<seg>`
 * — openat semantics on Linux), so a component swapped for a symlink is
 * refused (`AGENT_STATE_STORE_PATH_REFUSED`) and every byte lands in the
 * directory whose identity was just proven, never in a path re-resolved
 * later. The final descriptor's realpath is re-checked to equal the expected
 * location under the home before the operation. Where `/proc/self/fd` is
 * absent the walk falls back to per-component `lstat` + realpath checks on
 * every operation (a residual check-to-use window, disclosed).
 *
 * SERIALISATION (review B-2). Every apply holds an exclusive per-scope lock
 * (`locks/<scope-digest>.lock`, created `O_EXCL`, shared by every store
 * instance and process on the same home) across read → CAS check → commit,
 * so two concurrent appliers at the same `expectedRevision` cannot both win:
 * the second reads the first's committed revision and answers
 * `GOAL_STALE_REVISION` with zero writes. Creating a NEW scope additionally
 * holds the realm lock while the per-realm scope count is checked (lock order
 * is always scope → realm).
 *
 * LOCK-OWNER POLICY (review round 3, R3-1: malformed records NEVER break).
 * Unparseable or partial records are unprovable and therefore refuse with
 * LOCK_TIMEOUT; mtime is never used as a fallback. Lock creation publishes a
 * fully fsynced record with an atomic no-replace link, so a crash cannot leave
 * a partial lock at the name. If BOOT_ID is empty, previous-boot proof is
 * impossible and is never used.
 * A lock is broken only on POSITIVE PROOF its recorded owner is gone:
 *   1. the record names a different host → UNKNOWN, never broken (this store
 *      lives under one DSH_HOME; a shared-filesystem peer cannot be proven
 *      dead from here);
 *   2. same host, recorded boot id differs from ours → the owner died at a
 *      reboot → broken;
 *   3. same host, same boot, recorded pid is NOT alive (`kill(pid,0)` →
 *      ESRCH) AND its heartbeat token did not change across a full
 *      `lockStaleMs` window → broken (the token check covers pid re-use by
 *      an unrelated process: a live-but-different holder keeps beating);
 *   4. recorded pid IS alive → the holder is known-present → NEVER broken,
 *      whatever the lock's age; the caller gets a typed
 *      `AGENT_STATE_STORE_LOCK_TIMEOUT` with zero write.
 * The holder beats: it rewrites the lock record (fresh token + `at`) every
 * `heartbeatMs` through the same atomic temp+rename path, so a paused-but-live
 * writer is detectable and safe.
 * CORRECTNESS OVER LIVENESS (the accepted trade): a genuinely wedged live
 * holder — a process frozen mid-critical-section that never resumes and never
 * releases — blocks that ONE scope until an operator clears it. Losing a
 * write silently is the failure this store must never have, so the store
 * refuses rather than steals. Operator clear: stop the owning process, then
 * delete `<home>/team-state/agent-state/<realm>/locks/<scope-digest>.lock`
 * (a dead owner is broken automatically on the next apply; deleting a LIVE
 * owner's lock can corrupt that scope and is never done automatically).
 * LOCK BREAK/CLEANUP IS GENERATION-CHECKED (P0-2b, audit intake #3). The
 * POSIX substrate offers NO compare-and-swap on file CONTENT: `rename` moves
 * whatever a NAME holds (unconditionally), `unlink` removes by NAME, and the
 * only atomic conditional primitive here is `link` — create-if-absent, the
 * same link-atomics law createLockRecord publishes under. "Delete the
 * record I judged stale" cannot therefore be atomic; it is built, honestly,
 * as read-check → act → verify-after → reclaim:
 *   1. the staleness DECISION is revalidated against the current name bytes
 *      immediately before any holder-affecting move (a re-locked or re-beaten
 *      name is not provably dead — this breaker touches nothing);
 *   2. after the rename-aside, the MOVED object is identified by inode
 *      (rename preserves it) and generation CONTENT (nonce = the per-acquire
 *      generation identity; host/boot/pid are constant across a generation's
 *      beats, so the death proof covers the whole generation): only the
 *      judged generation is ever unlinked;
 *   3. a foreign generation (the rename raced a fresh create) is reclaimed
 *      with link — create-if-absent, never overwrite; if the reclaim loses,
 *      the foreign bytes are RETAINED as the aside file rather than
 *      destroyed (operator-addressable litter is acceptable, voiding a live
 *      holder's lock is not). The same law holds on the holder side: a beat
 *      re-reads the generation right before its rename and never overwrites
 *      a foreign record (a robbed holder stops beating and hands nothing
 *      back), a beat against a free name republishes with link semantics,
 *      and release pins the name's inode around its nonce check.
 * DISCLOSED RESIDUAL: the gap between the last check and each rename/unlink
 * (thread/fd scheduling, no FS primitive closes it) remains — a creator that
 * wins a name momentarily emptied by a breaker, or a holder robbed AFTER its
 * own post-publish check, can both enter until a generation check fires at
 * the next heartbeat. The deterministic audit legs pin exactly these windows
 * and prove the reclaim never destroys and the name never empties under a
 * revalidated decision; full mid-apply abort on detected lock loss is a
 * named follow-up outside this lane.
 *
 * REPLAY (audit P0-2a). `applyId` (the PA call correlation) is the durable
 * idempotence anchor, and its consumption is CROSS-SCOPE GLOBAL while the
 * persistence lock is PER-SCOPE — so the consumption must not depend on the
 * scope lock. It is an O_EXCL CREATE of the `applied/` marker: one atomic
 * create is the check AND the consume, at most one applier of a given applyId
 * can win it whichever scope carries the apply. The marker is therefore
 * written BEFORE the commit (consumption point); the committed record then
 * also carries the id (`appliedIds`, the last 256 in that scope) in the same
 * atomic rename, so after the commit BOTH witnesses hold the id and a replay
 * is refused (`STATE_APPLY_REPLAY`, zero persistence) on either. A CLEAN
 * failure BEFORE the commit (a refused precondition, or a typed write
 * failure the process survives) REFUNDS the marker — a refused apply never
 * burns its applyId, and a failed one stays re-drivable. The accepted crash
 * window (P0-2a's conservative direction): a process that dies between
 * consuming the marker and landing the rename leaves the grant CONSUMED with
 * no state change — the re-drive answers `STATE_APPLY_REPLAY` and loses the
 * write, because re-applying a possibly-consumed grant is exactly what this
 * store must never do. (This replaces the pre-fix order — marker written
 * only after the commit — which let two same-applyId applies at DIFFERENT
 * scopes both pass the check under their own scope locks and DOUBLE-COMMIT;
 * the second marker write died as a swallowed EEXIST.)
 * `expectedRevision` CAS and the create/already-exists leg mirror
 * `createRecordingStateStore` exactly — the fake is the specification.
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
 * truncated read that would parse into a plausible-but-wrong state. The
 * number of scope records per realm is bounded (`maxScopes`, default 1024):
 * creating one past the bound refuses typed (`AGENT_STATE_STORE_SCOPE_LIMIT`)
 * with zero write, so a model-driven caller cannot exhaust the disk with
 * unbounded scopes.
 *
 * HARD LINK LAW. Reads go through {safeReadRecord} — component-free
 * `O_RDONLY | O_NOFOLLOW` open of the final path, `fstat` through the
 * descriptor, refuse unless it is a regular file with `nlink === 1` inside
 * the size bound, then read the SAME descriptor (no path re-resolution
 * between check and read). A symlink or a hardlink alias is refused typed.
 *   The shared #409 law (`hardlinkAliasVerdict`, controlled-fs
 *   `open-at-exec.ts:82`, on master since a264d2df0) is NOT imported, on
 *   purpose: it is not part of controlled-fs's public face (`index.ts:40-48`
 *   exports `NO_RECHECK`/`isBeneath`/`verifyOpenedHandle` only), it lives in a
 *   compiled `.ts` lane this lane has no booked edge to (eb3-family-boundaries
 *   LANE_EDGES: `node:*` + domain/tool-governance only), and adding that edge
 *   would bind a `node:*`-only lane to a build-order dependency. The refusal
 *   below applies the same rule (nlink > 1 ⇒ refused before any byte) and
 *   carries the shared law's detail sentence; C1 K1 pins it.
 *
 * PURITY: `node:*` builtins, plus the ONE booked upstream edge —
 * `@deepseek-ai/dsh-home-paths`, a PUBLIC published package whose root export
 * `resolveDshHome` answers the host's own home in the PRODUCTION arm (the
 * search lane imports an upstream public package the same way; the edge is
 * booked in `scripts/eb3-family-boundaries.mjs` + this lane's README). No
 * import of the plane, the governance center, another family lane, or any
 * Host internal.
 *
 * @module tools/agent-state-family/fs-state-store
 */
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { constants as fsConstants, promises as fsp, readFileSync, realpathSync, statSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { isAbsolute, join, relative, sep } from 'node:path'
import process from 'node:process'
import { setTimeout as delayFor } from 'node:timers/promises'
import { clearInterval, setInterval } from 'node:timers'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** The durable subtree this store owns, relative to the harness home. */
export const STATE_STORE_SUBTREE = Object.freeze(['team-state', 'agent-state'])

/** The per-scope record bound. A goal/todo/plan-mode record is a handful of
 *  KiB; 256 KiB is ~50x the honest ceiling and still bounded on every read. */
export const MAX_SCOPE_BYTES = 256 * 1024
/** The per-ledger-line bound (attempt/write lines are tiny). */
export const MAX_LEDGER_LINE_BYTES = 8 * 1024
/** The per-realm scope-record bound (review round 1, item 2). */
export const MAX_SCOPES_PER_REALM = 1024
/** How many committed applyIds a scope record remembers (the replay witness
 *  coupled to the commit; the global marker covers anything older). */
export const APPLIED_IDS_KEPT = 256
const LOCK_TIMEOUT_MS = 10_000
const LOCK_STALE_MS = 30_000
/** The holder's beat period (a would-be breaker watches a full stale window). */
const LOCK_HEARTBEAT_MS = 500

const RECORD_SCHEMA = 'agent-state-scope/1'
const NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0
const OPEN_NOFOLLOW = (fsConstants.O_RDONLY ?? 0) | NOFOLLOW
const OPEN_DIR = (fsConstants.O_RDONLY ?? 0) | (fsConstants.O_DIRECTORY ?? 0) | NOFOLLOW
const CREATE_EXCLUSIVE = (fsConstants.O_WRONLY ?? 0) | (fsConstants.O_CREAT ?? 0) | (fsConstants.O_EXCL ?? 0) | NOFOLLOW
const APPEND_NOFOLLOW = (fsConstants.O_WRONLY ?? 0) | (fsConstants.O_CREAT ?? 0) | (fsConstants.O_APPEND ?? 0) | NOFOLLOW
const PATH_REFUSED = 'AGENT_STATE_STORE_PATH_REFUSED'
/** openat-equivalent availability: Linux exposes every open descriptor as a
 *  directory path under /proc/self/fd, and a path RELATIVE to that entry is
 *  resolved from the descriptor, not by re-walking the original path. */
const PROC_FD = (() => { try { return statSync('/proc/self/fd').isDirectory() } catch { return false } })()
const sleep = (ms) => delayFor(ms)

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
 * Resolve the durable harness home for the agent-state store. TWO arms,
 * selected ONLY by the assembly-set discriminator `testHomeGuard` (never by
 * an env var — an env-selected guard is bypassable by the same config that
 * misconfigures the mount; USER-RULING-20261031 §2 via
 * `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md` (c)):
 *
 *  TEST arm (`testHomeGuard: true` — the unit-boundary default, the
 *  fail-closed direction; every test World threads it true at its row-config
 *  choke point): the shipped law, every dangerous shape REFUSED (never
 *  defaulted), byte-for-byte as before this split:
 *   - absent or blank                      -> AGENT_STATE_STORE_HOME_MISSING
 *   - relative / not an existing directory -> AGENT_STATE_STORE_HOME_INVALID
 *   - realpath equal to or beneath the
 *     operator's real `~/.dsh`              -> AGENT_STATE_STORE_HOME_INVALID
 *  The `~/.dsh` refusal is a POSITIVE guard, not a fallback: the harness's
 *  own `resolveDshHome()` quietly answers `~/.dsh` when `$DSH_HOME` is unset,
 *  and writing governed state into a developer's live harness home is exactly
 *  the accident the test-methods red line forbids.
 *
 *  PRODUCTION arm (`testHomeGuard: false` — the mount-config DEFAULT, design
 *  (c): "ABSENT = production"): the home is the HOST's own sanctioned root,
 *  answered by the upstream PUBLIC API `@deepseek-ai/dsh-home-paths` →
 *  `resolveDshHome()` (`configured ?? $DSH_HOME ?? ~/.dsh`; the priority
 *  lives in that package and is NEVER reimplemented here). The plugin writes
 *  only its own namespace `<home>/team-state/agent-state/<realmId>/` under
 *  it. The live-home refusal above is a TEST-SAFETY rule and is gone from
 *  this arm BY RULING — refusing the host's own home would make the plugin
 *  unable to serve a normal install (design (a) rows 1–2). EVERY OTHER guard
 *  survives this arm unchanged (design (d)): a blank raw DSH_HOME stays
 *  HOME_MISSING; a relative raw DSH_HOME stays HOME_INVALID and is never
 *  resolved against the cwd (upstream's resolver WOULD cwd-resolve that
 *  shape — refusing it is the deliberate preserved divergence); the resolved
 *  home must EXIST as a real directory (realpath + isDirectory — on a real
 *  install the Host creates the home before any plugin mounts, so "must
 *  exist" refuses only a genuinely absent home; disclosed). The
 *  alias/symlink/hardlink/atomic/lock/audit laws below are untouched.
 *
 * SYNCHRONOUS on purpose: the descriptor's `build(cap)` is called
 * synchronously by the plane (`team-tool-plane.mjs:1644`).
 *
 * The environment read RETIRED the named `homePath` center-interface
 * follow-up (design (g)): its premise ("no public way to learn the
 * sanctioned home") is falsified by `@deepseek-ai/dsh-home-paths`' public
 * export plus the booked upstream-import precedent (search lane). The env is
 * read for the raw-ENV SHAPE law (survives both arms); the ANSWER for the
 * production default comes from the package.
 *
 * @param {{env?: Record<string, string | undefined>, realHome?: string, testHomeGuard?: boolean}} [opts]
 * @param realHome operator-home override — TEST arm only (injectable so unit
 *   tests pin the guard with a fake operator, never the real `~/.dsh`); the
 *   PRODUCTION arm never consults it
 * @param testHomeGuard discriminator from the trusted plane-mount config; the
 *   assembly ALWAYS threads it explicitly (`agent-state.mjs`), and at the
 *   mount level an ABSENT key means production (closed-world config law).
 *   This unit default is TRUE: a direct consumer that forgets the parameter
 *   gets today's law, never an invented default home.
 * @returns {{ok: true, home: string} | {ok: false, code: string, detail: string}}
 */
export function resolveAgentStateHome({ env = process.env, realHome, testHomeGuard = true } = {}) {
  const raw = env?.DSH_HOME
  const candidate = raw === undefined || String(raw).trim().length === 0 ? undefined : String(raw)
  // — raw-env shape law, preserved in BOTH arms (design (d)-1): a non-blank
  // relative DSH_HOME is refused here, never resolved against the cwd. —
  if (candidate !== undefined && !isAbsolute(candidate)) {
    return refusal('AGENT_STATE_STORE_HOME_INVALID', `DSH_HOME must be an absolute path — got ${JSON.stringify(candidate.slice(0, 120))} (refused, never resolved against the cwd)`)
  }
  if (candidate === undefined) {
    if (testHomeGuard === true) {
      return refusal('AGENT_STATE_STORE_HOME_MISSING', 'DSH_HOME is not set, so this mount has no durable home to write governed agent state into (refused — an invented default would write outside the sanctioned root)')
    }
    // Production default arm: the upstream trusted home answers (unset, or
    // blank — upstream's documented semantics treats blank as unset).
  }
  let real
  try {
    real = realpathSync(candidate ?? resolveDshHome(undefined, env))
  } catch (error) {
    return refusal('AGENT_STATE_STORE_HOME_INVALID', `DSH_HOME does not resolve to an existing directory: ${String(error?.code ?? error)}`)
  }
  if (testHomeGuard === true) {
    const operatorHome = realHome ?? homedir()
    let realOperatorHome = operatorHome
    try { realOperatorHome = realpathSync(operatorHome) } catch { /* keep the given form */ }
    const liveDsh = join(realOperatorHome, '.dsh')
    let realLiveDsh = liveDsh
    try { realLiveDsh = realpathSync(liveDsh) } catch { /* absent live home: compare the spelling */ }
    if (sameOrUnder(real, liveDsh) || sameOrUnder(real, realLiveDsh)) {
      return refusal('AGENT_STATE_STORE_HOME_INVALID', `DSH_HOME resolves to the operator's live harness home (${liveDsh}) — governed agent state is never written there; refusing`)
    }
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
      // The shared #409 rule and sentence (controlled-fs open-at-exec.ts:82),
      // applied in-lane — see the header for why the symbol is not imported.
      // R-AUDIT-DEPTH b3: this proof is an AT-OPEN statement; the residual
      // post-open hardlink window and its one-directional exposure are
      // documented at {appendLineIn} (the append leg, where our inode stays
      // live across the write).
      return refusal('AGENT_STATE_STORE_ALIAS_REFUSED', `hardlink-alias: the file has ${String(stat.nlink)} hard links, so a name outside the governed root may share it; containment is unprovable, refused before any byte. Use a single-link copy.`)
    }
    if (stat.size > limit) {
      return refusal('AGENT_STATE_STORE_OVERSIZED', `the state record is ${String(stat.size)} bytes, over the ${String(limit)}-byte bound for one scope (refused, never truncated into a plausible state)`)
    }
    const buffer = Buffer.allocUnsafe(limit + 1)
    let offset = 0
    for (;;) {
      const { bytesRead } = await handle.read(buffer, offset, limit + 1 - offset, offset)
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

/**
 * Walk `anchor/<segments…>` ONE component at a time and return the final
 * directory pinned (review B-1). Each component is opened `O_DIRECTORY |
 * O_NOFOLLOW` relative to the previous component's DESCRIPTOR, so a
 * component swapped for a symlink (or a file) is refused, and the returned
 * `path` addresses the proven directory itself (`/proc/self/fd/<n>`), not a
 * name that could be re-resolved later. The final realpath must equal the
 * expected location. `create: false` answers `{absent: true}` when a
 * component simply does not exist (a read of a store never written).
 *
 * Exported for C1 only.
 */
export async function openStoreDir(anchor, segments, { create }) {
  const realAnchor = await fsp.realpath(anchor)
  const expected = join(realAnchor, ...segments)
  const refuse = (detail) => typedError(PATH_REFUSED, `${detail} — refused before any byte (the store subtree must be real directories beneath ${realAnchor})`)
  if (!PROC_FD) {
    // Fallback (no openat face): per-component lstat + final realpath, on
    // EVERY operation. Residual check-to-use window, disclosed in the header.
    let cur = realAnchor
    for (const seg of segments) {
      cur = join(cur, seg)
      let st
      try { st = await fsp.lstat(cur) } catch (error) {
        if (error?.code !== 'ENOENT') throw error
        if (!create) return { absent: true, close: async () => {} }
        try { await fsp.mkdir(cur, { mode: 0o700 }) } catch (e) { if (e?.code !== 'EEXIST') throw e }
        st = await fsp.lstat(cur)
      }
      if (!st.isDirectory() || st.isSymbolicLink()) throw refuse(`store component ${cur} is not a real directory`)
    }
    if ((await fsp.realpath(cur)) !== expected) throw refuse(`store directory ${cur} does not resolve to ${expected}`)
    const handle = await fsp.open(cur, OPEN_DIR)
    return { path: cur, handle, close: async () => { try { await handle.close() } catch { /* closed */ } } }
  }
  const handles = []
  const closeAll = async () => { for (const h of handles.reverse()) { try { await h.close() } catch { /* closed */ } } }
  try {
    let handle
    try { handle = await fsp.open(realAnchor, OPEN_DIR) } catch (error) {
      if (error?.code === 'ELOOP' || error?.code === 'ENOTDIR') throw refuse(`the home ${realAnchor} is not a real directory`)
      throw error
    }
    handles.push(handle)
    for (const seg of segments) {
      const parent = `/proc/self/fd/${String(handle.fd)}`
      if (create) {
        try { await fsp.mkdir(`${parent}/${seg}`, { mode: 0o700 }) } catch (error) { if (error?.code !== 'EEXIST') throw error }
      }
      try { handle = await fsp.open(`${parent}/${seg}`, OPEN_DIR) } catch (error) {
        if (error?.code === 'ENOENT' && !create) { await closeAll(); return { absent: true, close: async () => {} } }
        if (error?.code === 'ELOOP' || error?.code === 'ENOTDIR') throw refuse(`store component '${seg}' is a symlink or not a directory`)
        throw error
      }
      handles.push(handle)
    }
    const path = `/proc/self/fd/${String(handle.fd)}`
    const real = await fsp.realpath(path)
    if (real !== expected || !sameOrUnder(real, realAnchor)) throw refuse(`the pinned store directory resolves to ${real}, not ${expected}`)
    return { path, handle, close: closeAll }
  } catch (error) {
    await closeAll()
    throw error
  }
}

/** The default byte-writer: the whole text through the open descriptor. */
const writeAll = async (handle, text) => { await handle.writeFile(text, 'utf8') }

/** Atomic durable replace INSIDE a pinned directory: `O_EXCL|O_NOFOLLOW` temp,
 *  fsync, rename, fsync the directory descriptor. `writeBytes` is the C1
 *  crash-simulation seam; production always uses {writeAll}. */
async function atomicWriteIn(dir, filename, text, writeBytes = writeAll) {
  const temp = `${dir.path}/.${filename}.${String(process.pid)}.${randomUUID()}.tmp`
  const target = `${dir.path}/${filename}`
  let handle
  try {
    handle = await fsp.open(temp, CREATE_EXCLUSIVE, 0o600)
    await writeBytes(handle, text)
    await handle.sync()
  } catch (error) {
    if (handle !== undefined) { try { await handle.close() } catch { /* closed */ } handle = undefined }
    try { await fsp.unlink(temp) } catch { /* best effort */ }
    throw error
  } finally {
    if (handle !== undefined) { try { await handle.close() } catch { /* closed */ } }
  }
  try {
    await fsp.rename(temp, target)
  } catch (error) {
    try { await fsp.unlink(temp) } catch { /* best effort */ }
    throw typedError('AGENT_STATE_STORE_WRITE_FAILED', `the atomic rename failed: ${String(error?.code ?? error)}`)
  }
  try { await dir.handle.sync() } catch { /* directory fsync unsupported here; the rename is still atomic */ }
}

/** Append one bounded line to a durable JSONL ledger inside a pinned dir.
 *  R-AUDIT-HL-1: the WRITE leg of the hard-link law. The read path
 *  (`safeReadRecord`) already refuses `nlink !== 1`; this append fstats the
 *  SAME descriptor it opened and refuses `AGENT_STATE_STORE_ALIAS_REFUSED`
 *  BEFORE any byte when `nlink !== 1`, so a ledger name aliased OUTSIDE the
 *  root can never receive the appended line. An FD-pinned append cannot be
 *  redirected by a POST-open hardlink (the descriptor is fixed), which closes
 *  the escape axis for this operation; the sharing/integrity axis — a
 *  per-event `O_EXCL` file so a second writer cannot reuse a name — is a
 *  named follow-up and is deliberately NOT implemented here.
 *
 *  RESIDUAL TOCTOU BOUNDARY (R-AUDIT-DEPTH b3; directory-trust assumption,
 *  characterised by the C1 audit leg `post-open hardlink exposes OUR appended
 *  bytes`): `nlink === 1` on the fstat below proves NO ALIAS EXISTED AT OPEN
 *  TIME. It cannot speak for the window after the check: a writer INSIDE the
 *  hostile directory may `link()` OUR inode out at any moment, and appends
 *  already on the way land on that inode — so the new name EXPOSES OUR OWN
 *  appended ledger bytes. The exposure is one-directional and content-less
 *  against us: a hardlink creates an additional name for OUR inode, link(2)
 *  refuses an existing target (EEXIST), so a pre-existing external file is
 *  never aliased onto the inode we append to and no external bytes can be
 *  smuggled in or rewritten; an aliased-IN name is refused at open
 *  (O_NOFOLLOW ELOOP, or the nlink check on the next append). Records are
 *  additionally immune in kind: their writes are replace-by-rename onto a
 *  fresh inode, so a post-open link of a record name only ever exposes the
 *  OLD bytes. Closing this disclosure window needs ownership/immutable-file
 *  hardening (chown/`FS_IOC_SETFLAGS`, out of any `node:*` lane's reach) —
 *  registered elsewhere as long-term hardening, deliberately NOT done here. */
async function appendLineIn(dir, filename, entry) {
  const line = `${JSON.stringify(entry)}\n`
  if (Buffer.byteLength(line, 'utf8') > MAX_LEDGER_LINE_BYTES) {
    throw typedError('AGENT_STATE_STORE_OVERSIZED', `a ledger line exceeded ${String(MAX_LEDGER_LINE_BYTES)} bytes`)
  }
  let handle
  try {
    handle = await fsp.open(`${dir.path}/${filename}`, APPEND_NOFOLLOW, 0o600)
    const stat = await handle.stat() // fstat on the SAME fd: check the identity we append to
    if (stat.nlink !== 1) {
      throw typedError('AGENT_STATE_STORE_ALIAS_REFUSED', `hardlink-alias: the audit ledger ${filename} has ${String(stat.nlink)} hard links, so a name outside the governed root may share it; containment is unprovable, refused before any byte. Use a single-link copy.`)
    }
    await handle.writeFile(line, 'utf8')
    await handle.sync()
  } finally {
    if (handle !== undefined) { try { await handle.close() } catch { /* closed */ } }
  }
}

/** The durable size of a ledger, in bytes — the zero-write assertion reads
 *  THIS, so "no new write entry" is a disk measurement.
 *
 *  R-AUDIT-FAIL-1: 0 is answered ONLY for a CONFIRMED-absent ledger (ENOENT)
 *  or a ledger that really is zero bytes. Any OTHER failure (permissions,
 *  I/O, a swapped component) throws `AGENT_STATE_STORE_LEDGER_UNREADABLE`, so
 *  a verifier can never misread "unreadable" as "zero writes". A
 *  zero-side-effect assertion MUST distinguish the two: expect 0 for an
 *  honest no-op, and treat a THROW as an unverifiable disk state — never as
 *  proof of zero writes.
 *
 *  R-AUDIT-DEPTH (b1): the measure is `lstat`, NEVER the path-following
 *  `stat` — a hostile directory that swapped the ledger NAME for a symlink
 *  would otherwise have the TARGET's size answer for the ledger (another
 *  file's bytes, and a number where only UNKNOWN belongs). Any non-regular
 *  name — symlink, DIRECTORY, special file — takes exactly the FAIL-1 leg:
 *  `AGENT_STATE_STORE_LEDGER_UNREADABLE`, the same typed UNKNOWN a permission
 *  or I/O failure earns. Never silently followed, never answered as a size,
 *  and an aliased name is never treated as absent either: only ENOENT
 *  (no name at all) and a REGULAR file's real size are honest answers.
 *  (A DIRECTORY at the name is also the root-proof test injection for this
 *  leg: `lstat` answers it for every uid, where chmod-000 binds nobody.) */
export async function ledgerBytes(dir, filename = 'writes.jsonl') {
  let stat
  try {
    stat = await fsp.lstat(join(dir, filename))
  } catch (error) {
    if (error?.code === 'ENOENT') return 0
    throw typedError('AGENT_STATE_STORE_LEDGER_UNREADABLE', `the audit ledger ${filename} could not be read (${String(error?.code ?? error)}) — a zero-side-effect assertion must treat an unreadable ledger as UNKNOWN, never as a clean write-free outcome`)
  }
  if (!stat.isFile()) {
    const shape = stat.isSymbolicLink() ? 'a symlink (never followed)' : stat.isDirectory() ? 'a directory where the file belongs' : 'not a regular file'
    throw typedError('AGENT_STATE_STORE_LEDGER_UNREADABLE', `the audit ledger ${filename} is ${shape} — a swapped-in name is UNKNOWN, never a clean write-free outcome (the target's size or a directory's bytes never stand in for the ledger)`)
  }
  return stat.size
}

/** This host's identity: a reboot gives a NEW boot id (Linux), so a lock from
 *  a previous boot can be proven orphaned; '' when the platform has no such
 *  file (then only the pid leg can prove death). */
const DEFAULT_BOOT_ID = (() => {
  try { return readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() } catch { return '' }
})()
const HOST_ID = (() => { try { return hostname() } catch { return '' } })()
const pidAlive = (pid) => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (error) { return error?.code !== 'ESRCH' }
}
const isCompleteLockRecord = (record, localBootId = DEFAULT_BOOT_ID) => record !== null && typeof record === 'object'
  && Number.isInteger(record.pid) && record.pid > 0
  && typeof record.host === 'string' && record.host.length > 0
  && typeof record.boot === 'string' && (record.boot.length > 0 || localBootId === '')
  && typeof record.nonce === 'string'
  && typeof record.token === 'string'
  && typeof record.at === 'number' && Number.isFinite(record.at)

async function readLockFile(path, localBootId = DEFAULT_BOOT_ID) {
  try {
    const read = await safeReadRecord(path, 4096)
    if (read.ok !== true) return read.absent === true ? null : { invalid: true }
    let parsed
    try { parsed = JSON.parse(read.text) } catch { return { invalid: true } }
    return isCompleteLockRecord(parsed, localBootId) ? parsed : { invalid: true }
  } catch { return { invalid: true } }
}

/** The lock record's identity: who, on which host, in which boot, beating
 *  under which token. Every field exists so a BREAKER can prove death
 *  (review round 2, F-4). */
const lockRecord = (nonce, token, at, bootId = DEFAULT_BOOT_ID) => JSON.stringify({ pid: process.pid, host: HOST_ID, boot: bootId, nonce, token, at })

/** Rewrite a lock record in place (the holder's beat, and the initial body):
 *  same atomic temp+fsync+rename path as every other durable byte. */
async function writeLockTemp(dir, name, text, faultAt = async () => {}, point = 'beat-before-rename') {
  const temp = `${dir.path}/.${name}.${String(process.pid)}.${randomUUID()}.tmp`
  let handle
  try {
    handle = await fsp.open(temp, CREATE_EXCLUSIVE, 0o600)
    await handle.writeFile(text, 'utf8')
    await handle.sync()
    await faultAt(point)
  } finally {
    if (handle !== undefined) { try { await handle.close() } catch { /* closed */ } }
  }
  return temp
}
async function createLockRecord(dir, name, text, faultAt = async () => {}) {
  const temp = await writeLockTemp(dir, name, text, faultAt, 'lock-before-publish')
  try {
    await fsp.link(temp, `${dir.path}/${name}`)
  } catch (error) {
    try { await fsp.unlink(temp) } catch { /* best effort */ }
    throw error
  }
  try { await fsp.unlink(temp) } catch { /* best effort */ }
}

/** MAY this holder be broken? Positive proof only (the F-4 table). */
async function mayBreak(dir, name, holder, staleMs, bootId = DEFAULT_BOOT_ID) {
  if (holder === null) return true // vanished — retry the create
  if (holder.invalid === true || !isCompleteLockRecord(holder, bootId)) return false // unprovable: never break
  if (holder.host !== HOST_ID) {
    return false // another host: unprovable from here (never broken)
  }
  if (bootId !== '' && holder.boot !== bootId) {
    return true // same host, previous boot: the owner died at the reboot
  }
  if (holder.pid === process.pid) return false // our own record: present by definition
  if (pidAlive(holder.pid)) return false // KNOWN-PRESENT: age is irrelevant
  // The pid is gone. Watch a FULL stale window for a beat before believing it:
  // a recycled pid would be an unrelated live process, but a holder that keeps
  // rewriting the record is alive no matter which pid number it grabbed.
  const before = holder.token
  await sleep(Math.min(staleMs, 1000))
  const after = await readLockFile(`${dir.path}/${name}`, bootId)
  if (after === null) return true
  if (after.invalid === true || (after.token !== before) || after.nonce !== holder.nonce) return false // it is beating (or was re-locked)
  return !pidAlive(after.pid ?? holder.pid)
}

/**
 * The exclusive lock (review B-2). `O_EXCL` create of `<dir>/<name>` carrying
 * `{pid, host, boot, nonce, token, at}`; the holder BEATS the record every
 * `heartbeatMs` so a paused-but-live owner can never look abandoned. Returns
 * the release function (removes the lock only if it is still ours). The
 * owner policy — and the correctness-over-liveness trade — is in the module
 * header.
 */
async function acquireLock(dir, name, { timeoutMs, staleMs, heartbeatMs, faultAt = async () => {}, bootId = DEFAULT_BOOT_ID, nowMs = () => Date.now() }) {
  const path = `${dir.path}/${name}`
  const nonce = randomUUID()
  const started = nowMs()
  let delay = 2
  for (;;) {
    try {
      await createLockRecord(dir, name, lockRecord(nonce, randomUUID(), nowMs(), bootId), faultAt)
      // P0-2b double-check before any holder-affecting effect: a successful
      // create is only HALF a hold — the name must STILL be publishing OUR
      // generation before we may act exclusive. A concurrent breaker that
      // moved our record between publish and this read-back means we hold
      // NOTHING: back off and retry, never proceed under a stolen belief.
      const published = await readLockFile(path, bootId)
      if (published === null || published.invalid === true || published.nonce !== nonce) continue
      let stopped = false
      let lost = false
      let inFlight = null
      const beat = setInterval(() => {
        if (stopped || inFlight !== null) return
        inFlight = (async () => {
          // P0-2b generation-checked beat: a foreign generation at the name
          // means the lock was broken or stolen from under this holder — the
          // beat stops for good (renaming over a foreign record would
          // silently hand the scope to two writers at once) and release
          // keeps its hands off. The temp is written first, so the CURRENT
          // generation is read AGAIN immediately before the name-affecting
          // rename (read-check → act, mirroring the breaker's revalidation);
          // a free name is republished with CREATE semantics (a link can
          // never overwrite whoever won it), never by rename-over.
          let current = await readLockFile(path, bootId)
          if (current !== null && current.invalid !== true && current.nonce !== nonce) { stopped = true; lost = true; clearInterval(beat); return }
          const temp = await writeLockTemp(dir, name, lockRecord(nonce, randomUUID(), nowMs(), bootId), faultAt)
          try {
            current = await readLockFile(path, bootId)
            if (current !== null && current.invalid !== true && current.nonce !== nonce) { stopped = true; lost = true; clearInterval(beat); throw Object.assign(new Error('lock lost'), { code: 'AGENT_STATE_LOCK_LOST' }) }
            if (current === null) await fsp.link(temp, path)
            else await fsp.rename(temp, path)
          } catch (error) {
            try { await fsp.unlink(temp) } catch { /* best effort */ }
            throw error
          }
        })().catch(() => {}).finally(() => { inFlight = null })
      }, heartbeatMs)
      beat.unref?.()
      return async () => {
        stopped = true
        clearInterval(beat)
        if (inFlight !== null) await inFlight
        if (lost) return // our generation is gone; whatever the name holds now is not ours to touch
        // P0-2b: pin the name's identity around the check so the unlink can
        // only ever remove OUR generation; a swap around the check is answered
        // by backing off, never by a blind unlink. The residual microsecond
        // window between the last check and the unlink is disclosed in the
        // module header (POSIX gives no unlink-if-content primitive).
        let pin = ''
        try { const st = await fsp.lstat(path); pin = `${String(st.dev)}:${String(st.ino)}` } catch { return /* already gone */ }
        const held = await readLockFile(path, bootId)
        if (held?.nonce !== nonce) return // never unlink a generation we cannot pin to ours
        try { const st2 = await fsp.lstat(path); if (`${String(st2.dev)}:${String(st2.ino)}` !== pin) return } catch { return }
        try { await fsp.unlink(path) } catch { /* already gone */ }
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw typedError('AGENT_STATE_STORE_WRITE_FAILED', `the lock ${name} could not be created: ${String(error?.code ?? error)}`)
    }
    const holder = await readLockFile(path, bootId)
    if (await mayBreak(dir, name, holder, staleMs, bootId)) {
      await faultAt('lock-before-break-rename')
      // P0-2b read-check (revalidate the DECISION against the NAME) before a
      // holder-affecting move: a stale judgement over a record authorises
      // moving THAT record and NOTHING else. A different generation at the
      // name — re-locked or re-beaten since the judgement — is not provably
      // dead here, so this breaker touches nothing and retries.
      const fresh = await readLockFile(path, bootId)
      if (fresh === null || fresh.invalid === true || fresh.nonce !== holder?.nonce || fresh.token !== holder?.token) continue
      let judgedInode = ''
      try { const st = await fsp.lstat(path); judgedInode = `${String(st.dev)}:${String(st.ino)}` } catch { continue }
      // Break by rename-aside: exactly one breaker wins the rename. Rename
      // PRESERVES the inode, so the moved object's identity is verifiable
      // AFTER the fact (verify-after); anything that is not the judged
      // generation is reclaimed with link (create-if-absent — the substrate's
      // only compare-and-swap, the same law createLockRecord rides), which
      // can never overwrite a current holder.
      const aside = `${dir.path}/.${name}.broken.${randomUUID()}`
      try {
        await fsp.rename(path, aside)
        await faultAt('lock-after-break-rename')
        let moved = null
        let movedIsJudged = false
        try {
          const st = await fsp.lstat(aside)
          moved = await readLockFile(aside, bootId)
          movedIsJudged = `${String(st.dev)}:${String(st.ino)}` === judgedInode
            && moved !== null && moved.invalid !== true && moved.nonce === holder?.nonce
        } catch { movedIsJudged = false }
        if (movedIsJudged) {
          // The proven-dead generation this breaker judged: removing it is
          // exactly what the owner policy permits (host/boot/pid fields are
          // constant across a generation's beats, so the death proof covers
          // the whole generation identified by this nonce).
          try { await fsp.unlink(aside) } catch { /* best effort */ }
        } else {
          // The moved object is NOT what was judged — it is somebody else's
          // (presumptively LIVE) generation. Reclaim it onto the name with
          // create-if-absent semantics; a lost race is retried briefly.
          let restored = false
          for (let attempt = 0; attempt < 8 && !restored; attempt += 1) {
            try { await fsp.link(aside, path); restored = true } catch (error) {
              if (error?.code !== 'EEXIST') break
              const now = await readLockFile(path, bootId)
              if (now === null) { await sleep(1); continue } // the name freed again — retry the reclaim
              if (moved !== null && moved.invalid !== true && now.nonce === moved.nonce) break // its owner already re-published: aside holds a superseded generation
              await sleep(1)
            }
          }
          if (restored) { try { await fsp.unlink(aside) } catch { /* the name keeps the same inode */ } }
          else {
            // The reclaim lost. Unlink the aside ONLY when its bytes are
            // provably dead: the judged generation itself, or a generation
            // whose owner demonstrably re-published (same nonce, newer beat
            // at the name). An unprovable foreign generation is RETAINED as
            // the aside file — operator-addressable litter is acceptable,
            // destroying a live holder's lock is not (never-steal, the
            // accepted correctness-over-liveness trade).
            const now = await readLockFile(path, bootId)
            const superseded = now !== null && moved !== null && moved.invalid !== true
              && now.nonce === moved.nonce && now.token !== moved.token
            if ((moved !== null && moved.nonce === holder?.nonce) || superseded) {
              try { await fsp.unlink(aside) } catch { /* best effort */ }
            }
          }
        }
      } catch { /* another breaker won the rename */ }
      continue
    }
    if (nowMs() - started > timeoutMs) {
      throw typedError('AGENT_STATE_STORE_LOCK_TIMEOUT', `the ${name} lock is held by another applier (pid ${String(holder?.pid)} on host ${String(holder?.host ?? '?')}) and cannot be proven abandoned — refused, nothing written (a live or unprovable holder is never broken; see the module header for the operator clear)`)
    }
    await sleep(delay)
    delay = Math.min(delay * 2, 50)
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
const lockName = (scope) => `${digestOf(scope)}.lock`
const markerName = (applyId) => `${digestOf(`apply:${String(applyId)}`)}.mark`
const REALM_LOCK = '_realm.lock'

/**
 * @param {object} input
 * @param {string} input.rootDir   the realm's store root (`<home>/team-state/agent-state/<realmId>`).
 * @param {string} [input.anchorDir] the resolved harness home the root must
 *        stay beneath; EVERY operation re-walks root → home (B-1).
 * @param {string} input.realmId
 * @param {(scope: string) => object} [input.armProvider] execution-origin arm;
 *        default answers `{kind:'model'}` (the conservative arm).
 * @param {number} [input.maxScopeBytes]
 * @param {number} [input.maxScopes]      per-realm scope-record bound.
 * @param {number} [input.lockTimeoutMs]
 * @param {number} [input.lockStaleMs]   the death-observation window.
 * @param {number} [input.lockHeartbeatMs] the holder's beat period.
 * @param {string} [input.bootId] test-only boot identity seam; production defaults to the local boot id.
 * @param {() => string} [input.nowIso] persistence clock (the store owns it).
 * @param {() => number} [input.nowMs] lock liveness/timeout clock (the store
 *        owns it); default Date.now. Tests may supply a controllable clock so
 *        the lock's elapsed-time semantics are deterministic under any runner
 *        context (R-413-1 v3: a module mock cannot follow the store's
 *        node:timers import across vitest roots, so the clock enters through
 *        this public seam instead).
 * @param {(handle: import('node:fs').promises.FileHandle, text: string) => Promise<void>} [input.recordWriter]
 *        C1 crash-simulation seam ONLY. The descriptor never passes it.
 * @param {(point: string) => void | Promise<void>} [input.faultAt]
 *        C1 crash/latency-simulation seam ONLY ('after-read' fires inside the
 *        critical section, after the applyId has been CONSUMED, between the
 *        read and the op's precondition check; 'after-commit' between the
 *        record rename and the ledgers — the commit has landed there, the
 *        marker was consumed before the commit; 'lock-before-publish'
 *        before the lock temp is linked to the name; 'beat-before-rename'
 *        inside a beat, before its rename; 'lock-before-break-rename' after
 *        the break DECISION and before any holder-affecting move, and
 *        'lock-after-break-rename' after the move and before its
 *        verification/reclaim — the P0-2b decision→action window). The
 *        descriptor never passes it.
 */
export function createFsStateStore({
  rootDir, realmId, anchorDir = rootDir, armProvider = () => Object.freeze({ kind: 'model' }),
  maxScopeBytes = MAX_SCOPE_BYTES, maxScopes = MAX_SCOPES_PER_REALM,
  lockTimeoutMs = LOCK_TIMEOUT_MS, lockStaleMs = LOCK_STALE_MS, lockHeartbeatMs = LOCK_HEARTBEAT_MS,
  bootId = DEFAULT_BOOT_ID,
  nowIso = () => new Date().toISOString(),
  nowMs = () => Date.now(),
  recordWriter = writeAll, faultAt = () => {},
}) {
  if (typeof rootDir !== 'string' || !isAbsolute(rootDir) || typeof anchorDir !== 'string' || !isAbsolute(anchorDir)) {
    throw typedError('AGENT_STATE_STORE_HOME_INVALID', 'the store root and its anchor must be absolute paths')
  }
  const rel = relative(anchorDir, rootDir)
  if (rel.startsWith('..') || isAbsolute(rel)) throw typedError(PATH_REFUSED, `the store root ${rootDir} is not beneath its anchor ${anchorDir}`)
  const rootSegs = rel === '' ? [] : rel.split(sep)
  const ledgerDirPath = join(rootDir, 'ledger')
  // In-memory mirrors of the durable ledgers, in the same shape the C1 fake
  // exposes (`log.reads` / `log.attempts` / `log.writes`).
  const log = { reads: [], writes: [], attempts: [] }

  /** Pin `<root>/<sub>` for ONE operation (no cache — review B-1). */
  const dirOf = async (sub, create) => {
    if (create && rootSegs.length === 0) await fsp.mkdir(anchorDir, { recursive: true })
    return await openStoreDir(anchorDir, sub === null ? rootSegs : [...rootSegs, sub], { create })
  }
  const withDir = async (sub, create, fn) => {
    const dir = await dirOf(sub, create)
    try { return await fn(dir) } finally { await dir.close() }
  }
  const parseRecord = (scope, read) => {
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
  const readState = async (scope) => {
    const dir = await dirOf('scopes', false)
    try {
      if (dir.absent === true) return null
      return parseRecord(scope, await safeReadRecord(`${dir.path}/${recordName(scope)}`, maxScopeBytes))
    } finally { await dir.close() }
  }
  /** Hold the scope lock for `fn` (every apply/seed). */
  const underScopeLock = async (scope, fn) => withDir('locks', true, async (locks) => {
    const release = await acquireLock(locks, lockName(scope), { timeoutMs: lockTimeoutMs, staleMs: lockStaleMs, heartbeatMs: lockHeartbeatMs, faultAt, bootId, nowMs })
    try { return await fn(locks) } finally { await release() }
  })
  /** Commit `patch` onto the CURRENT record (caller holds the scope lock). */
  const commitState = async (scope, locks, current, patch, applyId) => {
    const appliedIds = applyId === undefined
      ? (current?.appliedIds ?? [])
      : [...(current?.appliedIds ?? []), String(applyId)].slice(-APPLIED_IDS_KEPT)
    const next = {
      schema: RECORD_SCHEMA,
      key: scope,
      realmId,
      goal: current?.goal ?? null,
      todos: current?.todos ?? null,
      planMode: current?.planMode ?? { active: false, pendingIntents: [] },
      ...patch,
      appliedIds,
      updatedAt: nowIso(),
    }
    const text = `${JSON.stringify(next)}\n`
    if (Buffer.byteLength(text, 'utf8') > maxScopeBytes) {
      throw typedError('AGENT_STATE_STORE_OVERSIZED', `the record would be over the ${String(maxScopeBytes)}-byte per-scope bound (refused; nothing written)`)
    }
    const write = async () => withDir('scopes', true, async (scopes) => {
      await atomicWriteIn(scopes, recordName(scope), text, recordWriter)
    })
    if (current !== null) return await write()
    // A NEW scope: the realm lock serialises the count against concurrent creators.
    const release = await acquireLock(locks, REALM_LOCK, { timeoutMs: lockTimeoutMs, staleMs: lockStaleMs, heartbeatMs: lockHeartbeatMs, faultAt, bootId, nowMs })
    try {
      const count = await withDir('scopes', true, async (scopes) => (await fsp.readdir(scopes.path)).filter((n) => n.endsWith('.json')).length)
      if (count >= maxScopes) {
        throw typedError('AGENT_STATE_STORE_SCOPE_LIMIT', `this realm already holds ${String(count)} scope records (bound ${String(maxScopes)}); a new scope is refused with zero write`)
      }
      return await write()
    } finally { await release() }
  }
  /** THE consumption point for the cross-scope-GLOBAL applyId (audit P0-2a):
   *  an O_EXCL create of the `applied/` marker is the check AND the consume,
   *  one atomic create, outside the reach of any single scope lock. True =
   *  this apply consumed the id; false = already consumed (replay, zero
   *  persistence). A create failure other than EEXIST fails CLOSED — without
   *  its global witness an apply must not commit. */
  const markerConsume = async (applyId, scope, op) => {
    const dir = await dirOf('applied', true)
    try {
      try {
        const handle = await fsp.open(`${dir.path}/${markerName(applyId)}`, CREATE_EXCLUSIVE, 0o600)
        try { await handle.writeFile(`${JSON.stringify({ applyId: String(applyId), scope: String(scope), op, at: nowIso() })}\n`, 'utf8'); await handle.sync() } finally { await handle.close() }
        return true
      } catch (error) {
        if (error?.code === 'EEXIST') return false
        throw typedError('AGENT_STATE_STORE_WRITE_FAILED', `the applyId marker ${String(applyId)} could not be consumed: ${String(error?.code ?? error)} (refused, nothing committed — without the global witness the grant stays unconsumed)`)
      }
    } finally { await dir.close() }
  }
  /** Refund a consumption ONLY when the commit demonstrably did not land (a
   *  refused precondition, or a typed write failure the process survives): a
   *  refused apply never burns its applyId, a failed one stays re-drivable.
   *  A hard crash inside [consume, commit) leaves the marker — CONSUMED with
   *  no state change is the conservative direction (module header, REPLAY). */
  const markerRefund = async (applyId) => {
    const dir = await dirOf('applied', false)
    try {
      if (dir.absent !== true) { try { await fsp.unlink(`${dir.path}/${markerName(applyId)}`) } catch { /* absent or never ours */ } }
    } finally { await dir.close() }
  }
  const attemptEntry = (op, scope, resource, applyId) => {
    const entry = { op, scope, key: `${scope}/${resource}`, applyId, outcome: 'refused' }
    log.attempts.push(entry)
    return entry
  }
  // R-AUDIT-FAIL-1: the audit-append outcome is REPORTED, not swallowed. The
  // in-memory entry carries `audit`; the ANSWER/commit control flow is
  // untouched (a refused audit line never re-runs or replays the state write).
  // NOTE: a symlinked ledger NAME surfaces the raw ELOOP errno here (the
  // O_NOFOLLOW open throws before fstat), not the read path's typed
  // AGENT_STATE_STORE_ALIAS_REFUSED — that consistency fix is a named
  // follow-up, deliberately not made in this change.
  const shortErrorCode = (error) => {
    const code = error?.code
    return typeof code === 'string' && code.length > 0 ? code : 'AGENT_STATE_STORE_LEDGER_APPEND_FAILED'
  }
  const finishAttempt = async (entry) => {
    try {
      await withDir('ledger', true, (dir) => appendLineIn(dir, 'attempts.jsonl', entry))
      entry.audit = 'CONFIRMED'
    } catch (error) {
      entry.audit = { status: 'UNCONFIRMED', error: shortErrorCode(error) }
    }
  }
  const commitWrite = async (entry) => {
    log.writes.push(entry)
    try {
      await withDir('ledger', true, (dir) => appendLineIn(dir, 'writes.jsonl', entry))
      entry.audit = 'CONFIRMED'
    } catch (error) {
      entry.audit = { status: 'UNCONFIRMED', error: shortErrorCode(error) }
    }
  }

  /**
   * The ONE apply walk for all three mutations: scope lock → record replay
   * witness → GLOBAL applyId consumption (O_EXCL marker — the atomic
   * check-and-consume, P0-2a) → fresh decision input → the op's own
   * precondition legs (refund on refusal) → commit (record carries the id;
   * refund on a typed write failure) → fault seam → ledgers.
   */
  const applyUnder = async ({ scope, op, resource, applyId, decide }) => {
    const attempt = attemptEntry(op, scope, resource, applyId)
    try {
      return await underScopeLock(scope, async (locks) => {
        const current = await readState(scope)
        if ((current?.appliedIds ?? []).includes(String(applyId))) {
          attempt.code = 'STATE_APPLY_REPLAY'
          await finishAttempt(attempt)
          return { ...refusal('STATE_APPLY_REPLAY', `apply ${String(applyId)} already consumed; a consumed grant never applies twice`), audit: attempt.audit }
        }
        if (!(await markerConsume(applyId, scope, op))) {
          attempt.code = 'STATE_APPLY_REPLAY'
          await finishAttempt(attempt)
          return { ...refusal('STATE_APPLY_REPLAY', `apply ${String(applyId)} already consumed; a consumed grant never applies twice`), audit: attempt.audit }
        }
        await faultAt('after-read')
        const decision = decide(current)
        if (decision.ok !== true) {
          await markerRefund(applyId) // a refused apply never burns its applyId
          attempt.code = decision.code
          await finishAttempt(attempt)
          return { ...decision, audit: attempt.audit }
        }
        try {
          await commitState(scope, locks, current, decision.patch, applyId)
        } catch (error) {
          await markerRefund(applyId) // the commit did not land: the grant stays re-drivable
          throw error
        }
        await faultAt('after-commit') // the commit landed: the marker STAYS (pre-commit consumption)
        attempt.outcome = 'applied'
        await finishAttempt(attempt)
        const write = { op, scope, key: `${scope}/${resource}`, applyId }
        await commitWrite(write)
        return { ...decision.answer, audit: write.audit }
      })
    } catch (error) {
      attempt.code = String(error?.code ?? 'AGENT_STATE_STORE_FAULT')
      await finishAttempt(attempt)
      return { ...refusal(attempt.code, String(error?.detail ?? error?.message ?? error)), audit: attempt.audit }
    }
  }

  return Object.freeze({
    name: 'agent-state:fs',
    realmId,
    rootDir,
    log,
    /** Absolute durable ledger files (evidence-readable). */
    ledgerPaths: Object.freeze({ attempts: join(ledgerDirPath, 'attempts.jsonl'), writes: join(ledgerDirPath, 'writes.jsonl') }),
    /** The durable write-audit size — the independent zero-write witness. */
    writesBytes: () => ledgerBytes(ledgerDirPath, 'writes.jsonl'),
    attemptCount: () => log.attempts.length,
    /** Read one scope's whole record (tests/evidence; bounded, typed). */
    stateOf: async (scope) => await readState(scope),
    armFor: (scope) => armProvider(scope),

    readGoal: async (scope) => {
      log.reads.push({ op: 'goal/read', scope, key: `${scope}/goal` })
      return (await readState(scope))?.goal ?? null
    },
    applyGoal: async (scope, { expectedRevision, next, applyId }) => applyUnder({
      scope, op: 'goal/apply', resource: 'goal', applyId,
      decide: (record) => {
        const current = record?.goal ?? null
        // The CAS / already-exists legs, verbatim from the recording fake.
        if (expectedRevision === null) {
          if (current !== null && current.phase !== 'complete') {
            return refusal('GOAL_ALREADY_EXISTS', `goal "${current.goalId}" already exists with phase "${current.phase}"`)
          }
        } else if (current === null || current.goalId !== next.goalId || current.revision !== expectedRevision) {
          return refusal('GOAL_STALE_REVISION', `stale goal ref "${String(next.goalId)}" revision ${String(expectedRevision)}; current is "${String(current?.goalId)}" revision ${String(current?.revision)}`)
        }
        return { ok: true, patch: { goal: next }, answer: { ok: true, snapshot: next } }
      },
    }),
    readTodos: async (scope) => {
      log.reads.push({ op: 'todos/read', scope, key: `${scope}/todos` })
      return (await readState(scope))?.todos ?? null
    },
    applyTodos: async (scope, { todos, applyId }) => applyUnder({
      scope, op: 'todos/apply', resource: 'todos', applyId,
      decide: () => ({ ok: true, patch: { todos: todos.map((t) => ({ ...t })) }, answer: { ok: true, todos } }),
    }),
    readPlanMode: async (scope) => {
      log.reads.push({ op: 'plan-mode/read', scope, key: `${scope}/plan-mode` })
      return (await readState(scope))?.planMode ?? { active: false, pendingIntents: [] }
    },
    applyPlanModeExit: async (scope, { plan, applyId }) => applyUnder({
      scope, op: 'plan-mode/apply', resource: 'plan-mode', applyId,
      decide: (record) => {
        const current = record?.planMode ?? { active: false, pendingIntents: [] }
        if (current.active !== true) return refusal('PLAN_MODE_NOT_ACTIVE', 'exit_plan_mode is only available in plan mode')
        const state = { active: false, pendingIntents: [...current.pendingIntents, { plan, appliedBy: applyId }] }
        return { ok: true, patch: { planMode: state }, answer: { ok: true, state } }
      },
    }),
    /** Scenario control for tests/worlds: plant or flip PLAN MODE (the
     *  family has no tool that enters plan mode — the host's plan-mode
     *  service does — so the durable flag is seeded, never invented by a
     *  governed row). Writes through the SAME locked, pinned, atomic path. */
    seedPlanMode: async (scope, active) => {
      await underScopeLock(scope, async (locks) => commitState(scope, locks, await readState(scope), { planMode: { active: active === true, pendingIntents: [] } }))
    },
    /** Scenario control: plant a goal snapshot (cross-scope fixtures). */
    seedGoal: async (scope, goal) => {
      await underScopeLock(scope, async (locks) => commitState(scope, locks, await readState(scope), { goal }))
    },
    /** The realm's store root, for evidence binding (path only). */
    root: () => rootDir,
  })
}
