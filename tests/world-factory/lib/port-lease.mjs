/**
 * port-lease.mjs — cross-process, crash-recoverable port leases for the
 * U5 TestWorldFactory (plan U5: 跨进程资源租约可崩溃恢复).
 *
 * SLOT LAYOUT (FIX-T T1 — append-ordered claims, crash-recoverable):
 *   A port's lease SLOT is a directory `<leaseRoot>/<port>.lease/` holding:
 *     seq            append-only CLAIM LOG. One line per acquisition
 *                    attempt: `{"t":<token>,"p":<pid>,"w":<world>,
 *                    "u":<purpose>,"s":<startedAt>}` plus, on release,
 *                    `{"r":<token>}`. The BYTE OFFSET of a line inside this
 *                    log is that attempt's claim ORDER: O_APPEND delivery is
 *                    atomic and offsets are strictly unique and monotonic.
 *                    The offset is recovered by reading our unique token
 *                    back (NOT by stat after write: under concurrency a
 *                    post-write fstat sees the peer's append too and two
 *                    attempts would compute the SAME order — measured, and
 *                    the root cause of every "oldest-live" double-owner).
 *     c-<seq>-w-<pid>-<token>.json
 *                    the CLAIM FILE (evidence object): pid, startedAt,
 *                    world, purpose, token (+ `reclaimedFrom` provenance
 *                    when the acquirer swept dead residue). Its existence =
 *                    still held; `release()` unlinks it (and appends the
 *                    release line).
 *
 * OWNERSHIP RULE (deterministic under ANY interleaving — no settle windows,
 * no ties, no clock reliance):
 *   A creator appends its claim line, reads the log back, takes its own
 *   byte-offset as ORDER N, writes the claim file, then DECIDES: any claim
 *   line at offset < N whose pid is alive and which is not released marks
 *   this creator the LOSER — it unlinks its claim file and throws
 *   LEASE_HELD. Later lines (offset > N) belong to later creators, who by
 *   the same rule see OUR line and back off. The rule is airtight because
 *   the earlier line is guaranteed visible before the later creator's
 *   decision (it precedes its append, which precedes its decision), so two
 *   creators can never both assert ownership, at any timing skew.
 *
 * STALE RECLAIM (the T1 protocol — closes the stale-observation race):
 *   The historic protocol acted on a stale observation with
 *   `unlinkSync(<port>.lease)` + O_EXCL create. Two processes that had BOTH
 *   observed the same stale lease could interleave as A.unlink → A.create →
 *   B.unlink(DELETING A's FRESH lease) → B.create, and both believed they
 *   owned the port. Any scheme that moves the SLOT keeps this race (between
 *   observing stale and moving it a fresh creator can land exactly there,
 *   and a link-based restore cannot recover once another creator fills the
 *   empty slot — measured: 165/300 natural double-ownerships on the old
 *   protocol, 3/200 on a rename-claim variant, evidence
 *   dev/agent-workflow/evidence/u5-fixt-20261026/). Reclaims here target
 *   the OBSERVED STALE CLAIM FILE BY ITS OWN UNIQUE NAME —
 *   `renameSync(thatFile, thatFile + '.gone-…')`, ENOENT = claim lost — so
 *   a fresh creator's claim can NEVER be the object moved, and the slot is
 *   never emptied. Identity (pid + startedAt) + liveness are re-verified
 *   after the move and before the discard.
 *
 *   LEGACY bare-file slots (`<port>.lease`, written by the pre-FIX-T
 *   protocol — possibly by a peer still RUNNING the old code, possibly
 *   crash residue) are honoured: held while their pid lives (coexistence:
 *   old writers treat our directory as corrupt and back off, never steal),
 *   stale-reclaimable when dead THROUGH A SWEEP SENTINEL
 *   (`<port>.lease.sweeping`, O_EXCL, dead-holder reclaimable): the legacy
 *   sweep is the one moment a slot path changes KIND (file → directory);
 *   the sentinel serializes it so a rival can never mkdir a directory that
 *   the by-name rename would then move away wholesale.
 *
 *   The lease alone is NOT sufficient: a sibling agent (e.g. the G1-F H0 PoC
 *   lane) may bind the same port WITHOUT a lease file. Acquisition therefore
 *   also proves the port is actually free (`portInUse`, the same TCP probe
 *   the characterization harness uses) and releases its OWN claim
 *   (token-guarded) when an external bind is found.
 *
 *   Port policy is enforced here, not trusted to callers: only ranges from
 *   tests/paths.mjs TEST_PORT_RANGES (3180-3186 / 3491-3500); 3080 (stable
 *   instance) and anything outside the ranges are refused.
 *
 *   A RELEASE deletes only the claim file whose CONTENT still names the
 *   releasing holder (pid + token) and appends its release line. An empty
 *   slot directory left behind is inert (state 'free'). The seq log grows
 *   ~90 bytes per start (disclosed in tests/world-factory/README.md; the
 *   lease root is workspace-temp infrastructure reclaimed wholesale).
 *
 * TEST-ONLY DETERMINISM HOOKS (env vars, default OFF; the C1 cross-process
 * race test uses them to force the exact interleaving the finding describes
 * instead of racing a microsecond window):
 *   DSH_U5_LEASE_PAUSE_AFTER_STALE_MS    pause once after a STALE lease is
 *                                        observed and BEFORE any reclaim
 *                                        begins — a peer's whole
 *                                        reclaim+claim lands inside the gap.
 *   DSH_U5_LEASE_PAUSE_AFTER_RECLAIM_MS  pause after sweeping stale residue
 *                                        and BEFORE this attempt appends its
 *                                        own claim — rivals land first and
 *                                        this process must lose cleanly.
 * Neither hook changes any decision, only timing; both read env per call.
 */
import { closeSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { basename, dirname, join } from 'node:path'
import { isSanctionedTestPort, STABLE_INSTANCE_PORT, TEST_PORT_RANGES } from '../../paths.mjs'
import { portInUse } from '../../characterization/lib/util.mjs'

/** True when `pid` is live (signal-0 probe). EPERM counts as alive. */
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    if (error.code === 'EPERM') return true
    // Unknown errno: conservatively treat as alive (never steal from maybe-alive).
    return true
  }
}

/** All candidate ports in policy order: the 3180 block first, then 3491-3500. */
export function candidatePorts() {
  const out = []
  for (const [lo, hi] of TEST_PORT_RANGES) for (let p = lo; p <= hi; p += 1) out.push(p)
  return out
}

export class LeaseError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LeaseError'
    this.code = code
  }
}

/** The SLOT path (a directory, or a legacy bare file) for one port. */
export function leasePathFor(leaseRoot, port) {
  return join(leaseRoot, `${port}.lease`)
}

/** Age after which an UNPARSABLE file is provably crash residue (writes of
 *  these small files complete in microseconds; one minute is generous). */
const UNPARSABLE_CLAIM_STALE_MS = 60_000

const claimNameFor = (offset, pid, token) => `c-${String(offset).padStart(12, '0')}-w-${pid}-${token}.json`
const claimOffset = (fileName) => {
  const m = /^c-(\d+)-w-/.exec(fileName)
  return m === null ? null : Number(m[1])
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Read a slot directory into ordered claim entries. The `seq` LOG is the
 * source of order and liveness intent; the CLAIM FILE is the evidence that
 * the hold is/was real (its unlink = release, paired with a release line).
 * An orphan claim file (no line — only possible for legacy-shaped foreign
 * files) sorts last and is judged by its own content.
 * @returns {{entries: Array<object>, seqMissingLine: boolean}}
 */
function readSlotEntries(slotPath) {
  const seqText = (() => {
    try {
      return readFileSync(join(slotPath, 'seq'), 'utf8')
    } catch {
      return ''
    }
  })()
  const released = new Set()
  const lines = []
  let offset = 0
  for (const rawLine of seqText.split('\n')) {
    const line = rawLine.trim()
    if (line !== '') {
      try {
        const obj = JSON.parse(line)
        if (typeof obj?.r === 'string') released.add(obj.r)
        else if (typeof obj?.t === 'string' && typeof obj?.p === 'number') lines.push({ offset, token: obj.t, pid: obj.p, world: obj.w ?? null, purpose: obj.u ?? null, startedAt: obj.s ?? '' })
      } catch {
        /* unparsable line: an append caught mid-write — its pid unknown,
           harmless for ordering (offset consumed), never treated as held */
      }
    }
    offset += Buffer.byteLength(rawLine, 'utf8') + 1
  }
  const byToken = new Map(lines.map((l) => [l.token, l]))
  let names = []
  try {
    names = readdirSync(slotPath)
  } catch {
    /* slot vanished mid-read */
  }
  const entries = []
  const seen = new Set()
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const claimPath = join(slotPath, name)
    const raw = readJsonFile(claimPath)
    const offsetOfName = claimOffset(name)
    const line = raw !== null ? byToken.get(String(raw.token ?? '')) : undefined
    const pid = Number.isInteger(raw?.pid) ? raw.pid : line?.pid ?? null
    const fileAgeOld = (() => {
      try {
        return Date.now() - statSync(claimPath).mtimeMs > UNPARSABLE_CLAIM_STALE_MS
      } catch {
        return true
      }
    })()
    const unparsable = raw === null
    const token = String(raw?.token ?? line?.token ?? '')
    seen.add(token)
    entries.push({
      name,
      claimPath,
      // ORDER: seq-log byte offset when known (authoritative); orphan claim
      // files sort last (Infinity) — they predate/bypass the log and must
      // never outrank a logged claim.
      seq: line !== undefined ? line.offset : offsetOfName !== null ? offsetOfName : Number.MAX_SAFE_INTEGER,
      raw: raw ?? { pid, token, unparsable: true },
      by: raw ?? { pid, token, unparsable: true },
      pid,
      startedAt: String(raw?.startedAt ?? line?.startedAt ?? ''),
      token,
      // A live pid with an UNRELEASED line and a claim file holds the port.
      // Unparsable file: live while young (mid-write creator), dead-stale
      // once old. Pid dead: stale. Released line: not a hold (file should
      // be gone; if present it is residue → stale-eligible).
      alive: pid !== null ? pidAlive(pid) && !released.has(token) : fileAgeOld && !unparsable ? false : !fileAgeOld,
      released: released.has(token),
      unparsable,
    })
  }
  // Logged lines with NO claim file: never-held (crash before write) or
  // already released — contribute nothing to SLOT STATE; for ORDERING they
  // are surfaced in `lines` with claimFile:false (in-flight or stalled
  // creators — see acquirePortLease decide step).
  const lineRecords = lines.map((l) => ({
    offset: l.offset,
    token: l.token,
    pid: l.pid,
    pidAliveNow: pidAlive(l.pid),
    released: released.has(l.token),
    claimFile: seen.has(l.token),
  }))
  entries.sort((a, b) => (a.seq !== b.seq ? a.seq - b.seq : a.name < b.name ? -1 : 1))
  return { entries, lines: lineRecords }
}

/**
 * Interpret one slot. Returns
 *   {state:'free'} | {state:'held', by, live:[...]} |
 *   {state:'stale', by, stale:[...]} | {state:'corrupt', detail}
 * `held` = ≥1 live claim (SMALLEST claim ORDER is the owner, reported as
 * `by`); `stale` = claims present but dead, `stale` listing EVERY dead claim
 * so acquirers sweep the whole slot with per-file provenance. A legacy
 * bare-file slot is honoured (see file header).
 */
export function readLease(leaseRoot, port) {
  return interpretSlot(leasePathFor(leaseRoot, port))
}

function interpretSlot(slotPath) {
  let st
  try {
    st = lstatSync(slotPath)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { state: 'free', path: slotPath }
    return { state: 'corrupt', detail: `stat failed: ${error.code ?? error.message}`, path: slotPath }
  }
  if (!st.isDirectory()) {
    // LEGACY bare-file slot (pre-FIX-T protocol, or a peer still running it).
    const raw = readJsonFile(slotPath)
    if (raw === null) return { state: 'corrupt', detail: 'legacy lease file unreadable/unparsable', path: slotPath }
    const pid = Number(raw?.pid)
    if (!Number.isInteger(pid)) return { state: 'corrupt', detail: 'legacy lease without valid pid', path: slotPath }
    const alive = pidAlive(pid)
    const entry = {
      name: basename(slotPath),
      claimPath: slotPath,
      seq: -1,
      raw,
      by: raw,
      pid,
      startedAt: String(raw?.startedAt ?? ''),
      token: String(raw?.token ?? ''),
      alive,
      legacy: true,
    }
    return alive
      ? { state: 'held', by: raw, live: [entry], path: slotPath }
      : { state: 'stale', by: raw, stale: [entry], path: slotPath }
  }
  const { entries } = readSlotEntries(slotPath)
  const live = entries.filter((e) => e.alive)
  const stale = entries.filter((e) => !e.alive && !e.unparsable)
  // A HELD slot still reports its dead residue in `stale` (crash leftovers
  // beside a live claim must stay visible to the leak/reclaim scans).
  if (live.length > 0) return { state: 'held', by: live[0].by, live, stale, path: slotPath }
  if (stale.length > 0) return { state: 'stale', by: stale[0].by, stale, path: slotPath }
  return { state: 'free', path: slotPath }
}

/** Test-only synchronous pause (env hooks documented at the file header). */
function testPauseOnce(envName) {
  let ms = Number(process.env[envName])
  if (!Number.isFinite(ms) || ms <= 0) return
  ms = Math.min(ms, 30_000)
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * CLAIM-BEFORE-DELETE reclaim of ONE named stale claim file (the T1
 * protocol). Renames that FILE — never the slot — so a fresh claim can
 * never be the object moved. ENOENT = another reclaimer already took it:
 * the claim is LOST, nothing is touched.
 * @param {string} filePath claim file path inside a slot directory (from
 *        readLease(...).stale[i].claimPath / scanStaleLeases(): `.leasePath`).
 *        LEGACY bare-file slots go through sweepLegacyLease, not this.
 * @param {object} expectedBy the holder the CALLER observed as stale
 * @returns {{ok:true, reclaimedFrom:object} | {ok:false, reason:string}}
 *   NEVER deletes anything unless it moved + re-verified the SAME dead
 *   holder it was given.
 */
export function reclaimStaleLease(filePath, expectedBy) {
  const movedPath = `${filePath}.gone-${process.pid}-${randomBytes(6).toString('hex')}`
  try {
    renameSync(filePath, movedPath)
  } catch (error) {
    if (error.code === 'ENOENT') return { ok: false, reason: 'lost' }
    return { ok: false, reason: `claim:${error.code ?? error.message}` }
  }
  // Defensive: we must have moved a FILE; a slot DIRECTORY is never ours to
  // keep — hand it straight back.
  try {
    if (!lstatSync(movedPath).isFile()) {
      try {
        renameSync(movedPath, filePath)
      } catch {
        /* slot vanished under us; leave the directory at its moved path */
      }
      return { ok: false, reason: 'moved-was-directory' }
    }
  } catch {
    /* lstat failed: fall through to content verification (will fail) */
  }
  const moved = readJsonFile(movedPath)
  const samePid = Number(moved?.pid) === Number(expectedBy?.pid)
  const sameStartedAt = String(moved?.startedAt ?? '') === String(expectedBy?.startedAt ?? '')
  const holderDead = Number.isInteger(Number(moved?.pid)) && !pidAlive(Number(moved.pid))
  if (!samePid || !sameStartedAt || !holderDead) {
    // Defensive: put the file back (link never clobbers) and abort. The name
    // is unique to a dead observation, so a live holder's claim is never the
    // object here — restoration is belt-and-braces for corrupted inputs.
    try {
      linkSyncSafe(movedPath, filePath)
    } catch {
      /* our copy names nobody live; leave it beside the slot */
    }
    return { ok: false, reason: samePid && sameStartedAt ? 'holder-alive' : 'identity-changed' }
  }
  const reclaimedFrom = {
    pid: Number(moved.pid),
    startedAt: moved.startedAt ?? null,
    world: moved.world ?? null,
    purpose: moved.purpose ?? null,
  }
  try {
    unlinkSync(movedPath)
  } catch {
    /* discarding our own verified copy: best effort */
  }
  return { ok: true, reclaimedFrom }
}

/** Restore a moved-away copy WITHOUT clobbering: link never overwrites. */
function linkSyncSafe(from, to) {
  try {
    linkSync(from, to)
    try {
      unlinkSync(from)
    } catch {
      /* restored; dropping our copy is best effort */
    }
  } catch (error) {
    if (error.code === 'EEXIST') return false
    throw error
  }
  return true
}

// ── LEGACY slot-transition mutex ─────────────────────────────────────────────
// Sweeping a LEGACY bare-file `<port>.lease` is the ONE moment a slot path
// changes KIND (file → directory). Without serialization, a rival could
// mkdir the directory between our observation and our rename, and our
// by-name rename would then move the DIRECTORY (and link-restore cannot put
// a directory back). The sentinel makes the transition exclusive:
//   acquire sentinel(wx) → rename the legacy FILE (a directory can appear
//   only after the file is gone, which only the sentinel holder does) →
//   create the slot directory → release sentinel. While a LIVE sentinel
//   exists, plain creators back off. A crashed holder's sentinel is
//   reclaimed by name, pid-verified, like any dead claim.
function sentinelPathFor(slotPath) {
  return `${slotPath}.sweeping`
}

function tryTakeSentinel(slotPath) {
  const sp = sentinelPathFor(slotPath)
  const nonce = randomBytes(6).toString('hex')
  const writeAttempt = () => {
    try {
      writeFileSync(sp, JSON.stringify({ pid: process.pid, nonce, at: new Date().toISOString() }) + '\n', { flag: 'wx' })
      return true
    } catch (error) {
      if (error.code === 'EEXIST' || error.code === 'ENOENT') return false
      throw error
    }
  }
  if (writeAttempt()) return { ok: true, nonce }
  let info = null
  let ageMs = Number.POSITIVE_INFINITY
  try {
    info = JSON.parse(readFileSync(sp, 'utf8'))
  } catch {
    try {
      ageMs = Date.now() - statSync(sp).mtimeMs
    } catch {
      return { ok: false, reason: 'sentinel-vanished' }
    }
  }
  const holderPid = Number(info?.pid)
  const live = info !== null ? Number.isInteger(holderPid) && pidAlive(holderPid) : ageMs <= UNPARSABLE_CLAIM_STALE_MS
  if (live) return { ok: false, reason: 'sweeping' }
  const moved = `${sp}.gone-${process.pid}-${randomBytes(4).toString('hex')}`
  try {
    renameSync(sp, moved)
    try {
      unlinkSync(moved)
    } catch {
      /* best effort */
    }
  } catch {
    return { ok: false, reason: 'sentinel-race' }
  }
  if (writeAttempt()) return { ok: true, nonce }
  return { ok: false, reason: 'sentinel-race' }
}

function releaseSentinel(slotPath, nonce) {
  const sp = sentinelPathFor(slotPath)
  try {
    const info = JSON.parse(readFileSync(sp, 'utf8'))
    if (String(info?.nonce) === String(nonce) && Number(info?.pid) === process.pid) unlinkSync(sp)
  } catch {
    /* already gone */
  }
}

/** True when a sweep is in flight (live sentinel) — creators must retry. */
function sentinelBlocks(slotPath) {
  const sp = sentinelPathFor(slotPath)
  let info
  try {
    info = JSON.parse(readFileSync(sp, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return false
    try {
      return Date.now() - statSync(sp).mtimeMs <= UNPARSABLE_CLAIM_STALE_MS
    } catch {
      return false
    }
  }
  const pid = Number(info?.pid)
  return Number.isInteger(pid) && pidAlive(pid)
}

/**
 * Claim a LEGACY bare-file `<port>.lease` by HARD LINK + INODE IDENTITY —
 * never by renameSync(slotPath, …): a rename silently moves a DIRECTORY,
 * and a rival that converted the slot file → slot directory between our
 * observation and our sweep would lose its whole live slot for the window
 * until restore (measured: that window produced a real double-ownership at
 * ~1/150 trials in the FIX-T race harness). A hard link CANNOT be made to a
 * directory (EPERM) and an unlink CANNOT remove one (EISDIR), so with
 * link → ino/dev match → unlink(legacyName) the legacy claim is removed
 * only when the name provably still refers to the SAME FILE we verified,
 * and the slot is never absent mid-sweep. The slot directory a creator
 * builds meanwhile is physically untouchable by this path.
 * @returns {{ok:true, reclaimedFrom:object} | {ok:false, reason:string}}
 */
function claimLegacyFileByLink(slotPath, expectedBy) {
  const gonePath = `${slotPath}.gone-${process.pid}-${randomBytes(6).toString('hex')}`
  try {
    linkSync(slotPath, gonePath)
  } catch (error) {
    if (error.code === 'ENOENT') return { ok: false, reason: 'lost' }
    if (error.code === 'EPERM') return { ok: false, reason: 'slot-is-directory' }
    return { ok: false, reason: `legacy-link:${error.code ?? error.message}` }
  }
  const cleanup = () => {
    try {
      unlinkSync(gonePath)
    } catch {
      /* best effort */
    }
  }
  let nameSt = null
  let copySt = null
  try {
    nameSt = lstatSync(slotPath)
    copySt = lstatSync(gonePath)
  } catch {
    cleanup()
    return { ok: false, reason: 'lost' }
  }
  if (nameSt.ino !== copySt.ino || nameSt.dev !== copySt.dev || !nameSt.isFile()) {
    cleanup()
    return { ok: false, reason: 'identity-changed' }
  }
  const moved = readJsonFile(gonePath)
  const samePid = Number(moved?.pid) === Number(expectedBy?.pid)
  const sameStartedAt = String(moved?.startedAt ?? '') === String(expectedBy?.startedAt ?? '')
  const holderDead = Number.isInteger(Number(moved?.pid)) && !pidAlive(Number(moved.pid))
  if (!samePid || !sameStartedAt || !holderDead) {
    cleanup() // the name still points at the original inode — nothing to restore
    return { ok: false, reason: samePid && sameStartedAt ? 'holder-alive' : 'identity-changed' }
  }
  // Remove the legacy NAME (unlink on a directory is EISDIR — impossible to
  // hurt a slot directory here, and the ino match proves the name is the
  // file we verified moments ago; a replacement racing in after the match
  // can only be a legacy claim by an OLD-PROTOCOL peer, whose own reader
  // treats any residue as corrupt-and-refuse, never steal).
  try {
    unlinkSync(slotPath)
  } catch (error) {
    cleanup()
    if (error.code === 'ENOENT' || error.code === 'EISDIR' || error.code === 'ENOTDIR') return { ok: false, reason: 'identity-changed' }
    throw error
  }
  const reclaimedFrom = {
    pid: Number(moved.pid),
    startedAt: moved.startedAt ?? null,
    world: moved.world ?? null,
    purpose: moved.purpose ?? null,
  }
  cleanup()
  return { ok: true, reclaimedFrom }
}

/**
 * Reclaim a LEGACY bare-file slot (transition file → directory), serialized
 * by the sweep sentinel and executed via the link-identity claim above.
 * Safe against every race: every branch ends either untouched-or-fully-
 * handled; the caller just re-reads on {ok:false}.
 * @param {string} slotPath the `<port>.lease` PATH (legacy file position)
 * @param {object} expectedBy the dead holder observed in the legacy file
 */
export function sweepLegacyLease(slotPath, expectedBy) {
  const take = tryTakeSentinel(slotPath)
  if (!take.ok) return { ok: false, reason: take.reason }
  try {
    const outcome = claimLegacyFileByLink(slotPath, expectedBy)
    if (outcome.ok) {
      try {
        mkdirSync(slotPath, { recursive: true })
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
    }
    return outcome
  } finally {
    releaseSentinel(slotPath, take.nonce)
  }
}

/**
 * Claim an ORDER in the slot's append-only seq log: O_APPEND our token line,
 * read the log back, take the BYTE OFFSET of our unique token as our order
 * (strictly unique — that is the property post-write fstat does NOT give
 * under concurrent appenders). Throws LeaseError('LEASE_HELD') if our line
 * cannot be found back (slot raced away): the caller retries the loop.
 */
function appendClaimOrder(slotPath, payload) {
  const seqFile = join(slotPath, 'seq')
  const line = JSON.stringify({ t: payload.token, p: payload.pid, w: payload.world, u: payload.purpose, s: payload.startedAt })
  const fd = openSync(seqFile, 'a')
  try {
    writeSync(fd, line + '\n')
  } finally {
    closeSync(fd)
  }
  const marker = `"t":"${payload.token}"`
  for (let read = 0; read < 3; read += 1) {
    let data = ''
    try {
      data = readFileSync(seqFile, 'utf8')
    } catch {
      break
    }
    const idx = data.indexOf(marker)
    if (idx >= 0) {
      // Byte offset == char index for our ASCII-only token marker scan.
      return Buffer.byteLength(data.slice(0, idx), 'utf8')
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2)
  }
  throw new LeaseError('LEASE_HELD', 'claim line not found in seq log (slot raced away)')
}

/**
 * Acquire an exclusive lease on `port`. Throws LeaseError on:
 *   PORT_REFUSED    (policy violation: 3080 or outside the sanctioned ranges)
 *   LEASE_HELD      (an earlier-ordered live claim owns the port, unparsable
 *                    slot, or every retry was out-ordered)
 *   EXTERNAL_BIND   (no live lease holder, but the TCP port answers — a
 *                    foreign listener, e.g. the concurrent G1-F lane)
 * Sweeps STALE claims (dead holder pids) through the named-file claim
 * protocol (see file header) and stamps `reclaimedFrom` provenance (first
 * swept claim) into the new claim.
 * @returns {Promise<{leasePath:string, slotPath:string, port:number, token:string, release:()=>void}>}
 */
export async function acquirePortLease({ leaseRoot, port, world, purpose }) {
  if (!isSanctionedTestPort(port)) {
    throw new LeaseError('PORT_REFUSED', `port ${port} is outside policy (sanctioned: 3180-3186/3491-3500; never ${STABLE_INSTANCE_PORT})`)
  }
  const slotPath = leasePathFor(leaseRoot, port)
  const token = randomBytes(8).toString('hex')
  const payloadBase = { pid: process.pid, startedAt: new Date().toISOString(), world: world ?? null, purpose: purpose ?? null, token }
  let owned = null // { myPath, order }
  let lastLoss = null
  for (let attempt = 0; attempt < 8 && owned === null; attempt += 1) {
    const state = interpretSlot(slotPath)
    if (state.state === 'corrupt') throw new LeaseError('LEASE_HELD', `lease slot ${slotPath} unreadable: ${state.detail}`)
    if (state.state === 'stale') {
      testPauseOnce('DSH_U5_LEASE_PAUSE_AFTER_STALE_MS')
      for (const s of state.stale) {
        const outcome = s.legacy === true ? sweepLegacyLease(slotPath, s.by) : reclaimStaleLease(s.claimPath, s.by)
        if (outcome.ok && payloadBase.reclaimedFrom === undefined) payloadBase.reclaimedFrom = outcome.reclaimedFrom
      }
      testPauseOnce('DSH_U5_LEASE_PAUSE_AFTER_RECLAIM_MS')
      continue // fresh read: the sweep may have raced with peer sweeps
    }
    if (state.state === 'held') {
      const mine = state.live.find((l) => Number(l.pid) === process.pid && l.token === token)
      if (mine !== undefined) {
        owned = { myPath: mine.claimPath, order: mine.seq }
        break
      }
      throw new LeaseError('LEASE_HELD', `port ${port} leased by pid ${String(state.by?.pid ?? '?')} since ${String(state.by?.startedAt ?? '?')}`)
    }
    // state 'free': a live sweep sentinel means the LEGACY→directory
    // transition is in flight in another process — back off and re-read.
    if (sentinelBlocks(slotPath)) continue
    try {
      mkdirSync(slotPath, { recursive: true })
    } catch (error) {
      if (error.code === 'EEXIST') continue // a legacy bare-file raced onto the slot
      throw error
    }
    // Claim an ORDER (append is the claim of precedence — a rival's line
    // that landed earlier blocks us even before their claim file exists),
    // then publish the evidence file, then DECIDE.
    const order = appendClaimOrder(slotPath, payloadBase)
    // DECIDE: our line+file are visible to every peer already. A LOWER-order
    // line whose holder is alive and whose claim FILE exists owns the port —
    // we remove our own file and back off. A lower-order line WITHOUT a file
    // yet is a creator mid-write: WAIT (bounded) for it to land or go silent
    // — never assert beside it. A line still file-less while the log stayed
    // hot is honoured even if stalled (we refuse the port instead of racing
    // it); only residue from a log silent for a full settle is inert. Higher
    // lines belong to later creators, who apply the identical rule to us.
    const myPath = join(slotPath, claimNameFor(order, process.pid, token))
    try {
      writeFileSync(myPath, JSON.stringify({ ...payloadBase, seq: order }, null, 2) + '\n', { flag: 'wx' })
    } catch (error) {
      if (error.code === 'EEXIST') continue
      if (error.code === 'ENOTDIR' || error.code === 'ENOENT') continue // slot raced
      throw error
    }
    let loseTo = null
    let inertOnly = true
    for (let round = 0; round < 12; round += 1) {
      const { lines } = readSlotEntries(slotPath)
      const older = lines.filter((l) => l.offset < order && l.token !== token && l.pidAliveNow && !l.released)
      const withFile = older.filter((l) => l.claimFile)
      if (withFile.length > 0) {
        loseTo = withFile[0]
        break
      }
      if (older.length === 0) break // ours
      inertOnly = false
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
    if (loseTo !== null) {
      lastLoss = `out-ordered by pid ${String(loseTo.pid)} at offset ${String(loseTo.offset)}`
      try {
        unlinkSync(myPath)
      } catch {
        /* our own claim: best effort */
      }
      throw new LeaseError('LEASE_HELD', `port ${port}: ${lastLoss}`)
    }
    if (!inertOnly) {
      // Older line(s) never published their claim file within the wait.
      // If the log has been quiet for a full settle, they are stalled-crash
      // residue and we ignore them; while the log is still hot we REFUSE
      // this port rather than risk asserting beside a late creator.
      let logQuietMs = 0
      try {
        logQuietMs = Date.now() - statSync(join(slotPath, 'seq')).mtimeMs
      } catch {
        continue // slot vanished: fresh read
      }
      if (logQuietMs <= UNPARSABLE_CLAIM_STALE_MS) {
        try {
          unlinkSync(myPath)
        } catch {
          /* best effort */
        }
        lastLoss = 'older claim line unpublishing (log hot) — refusing to race it'
        continue // next attempt: fresh order, likely wins once residue settles
      }
    }
    owned = { myPath, order }
  }
  if (owned === null) {
    throw new LeaseError('LEASE_HELD', `port ${port}: no claim order won after retries${lastLoss !== null ? ` (last: ${lastLoss})` : ''}`)
  }
  // Second guard: a foreign listener without a live lease (concurrent lane).
  if (await portInUse(port)) {
    try {
      releasePortLease(owned.myPath, { pid: process.pid, token })
    } catch {
      /* we named ourselves; refusal here is noise */
    }
    throw new LeaseError('EXTERNAL_BIND', `port ${port} answers TCP with no live lease holder — refusing (foreign listener)`)
  }
  return {
    leasePath: owned.myPath,
    slotPath,
    port,
    token,
    seq: owned.order,
    release: () => releasePortLease(owned.myPath, { pid: process.pid, token }),
    note: () => {},
  }
}

/**
 * Release OUR claim: delete ONLY a file whose content still names us
 * (pid + token) and append the release line to the seq log (so our earlier
 * line stops blocking peers even if the unlink races). A file that no
 * longer names us means our ownership was legitimately reclaimed (or never
 * ours) — deleting it would destroy another holder's proof, so this REFUSES
 * with LeaseError LEASE_HELD. A missing file counts as released
 * (idempotent: a crash between unlink and cleanup must not wedge a retry).
 */
export function releasePortLease(filePath, owner) {
  const pid = typeof owner === 'object' && owner !== null ? owner.pid : owner
  const token = typeof owner === 'object' && owner !== null ? owner.token : undefined
  const content = readJsonFile(filePath)
  if (content === null) {
    // ENOENT-or-unparsable: if it is truly gone we are released; if it is
    // unparsable we must NOT destroy evidence we cannot attribute.
    try {
      lstatSync(filePath)
      throw new LeaseError('LEASE_HELD', `lease ${filePath} unreadable on release — refusing to delete`)
    } catch (error) {
      if (error instanceof LeaseError) throw error
      return // ENOENT: already gone
    }
  }
  const namesPid = Number(content?.pid) === Number(pid)
  const namesToken = token === undefined ? true : String(content?.token ?? null) === String(token)
  if (!namesPid || !namesToken) {
    throw new LeaseError('LEASE_HELD', `lease ${filePath} names pid ${String(content?.pid ?? '?')}, not ${String(pid)}${token !== undefined ? ' + token' : ''} — refusing to delete a lease we do not own`)
  }
  const slotPath = dirname(filePath)
  try {
    unlinkSync(filePath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (typeof token === 'string' && token !== '') {
    try {
      const fd = openSync(join(slotPath, 'seq'), 'a')
      try {
        writeSync(fd, JSON.stringify({ r: token }) + '\n')
      } finally {
        closeSync(fd)
      }
    } catch {
      /* file already unlinked — the unlink itself released; line best effort */
    }
  }
}

/**
 * Convenience: try candidate ports in order (preferred first, then `include`),
 * skipping externally-bound ports, until one is ours.
 * @returns {Promise<object>} acquirePortLease result
 */
export async function acquireFirstFreeLease({ leaseRoot, preferred = [], include = candidatePorts(), world, purpose }) {
  const seen = new Set()
  const order = [...preferred, ...include].filter((p) => !seen.has(p) && (seen.add(p) || true))
  let lastError = null
  for (const port of order) {
    try {
      return await acquirePortLease({ leaseRoot, port, world, purpose })
    } catch (error) {
      if (error.code === 'PORT_REFUSED') throw error
      lastError = error
    }
  }
  throw lastError ?? new LeaseError('LEASE_HELD', `no free lease among ${order.join(',')}`)
}

/**
 * Scan a lease root for STALE leases (dead holder pids) — the crash-recovery
 * entry point used by the reclaim pass. One entry per dead claim file
 * (legacy bare-file slots included), each independently reclaimable via
 * reclaimStaleLease(entry.leasePath, entry.by) — or sweepLegacyLease for
 * `legacy: true` entries.
 */
export function scanStaleLeases(leaseRoot) {
  return scanAllLeases(leaseRoot).filter((entry) => !entry.alive)
}

/**
 * Every live or dead claim in every slot — the leak-check view: a World's
 * teardown must leave ZERO claims naming its world id.
 * @returns {{port:number, slotPath:string, leasePath:string, fileName:string, by:object, alive:boolean, legacy?:boolean}[]}
 */
export function scanAllLeases(leaseRoot) {
  const out = []
  let names
  try {
    names = readdirSync(leaseRoot)
  } catch {
    return out
  }
  for (const name of names) {
    if (!name.endsWith('.lease')) continue
    const port = Number(name.slice(0, -'.lease'.length))
    if (!Number.isInteger(port)) continue
    const slotPath = join(leaseRoot, name)
    const st = interpretSlot(slotPath)
    if (st.state === 'free' || st.state === 'corrupt') continue
    for (const e of [...(st.live ?? []), ...(st.stale ?? [])]) {
      out.push({
        port,
        slotPath,
        leasePath: e.claimPath,
        fileName: e.name,
        by: e.by,
        alive: e.alive,
        ...(e.legacy === true ? { legacy: true } : {}),
      })
    }
  }
  return out
}
