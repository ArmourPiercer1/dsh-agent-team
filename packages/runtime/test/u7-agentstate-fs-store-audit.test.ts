/**
 * U7 agent-state PRODUCTION STORE — audit hardening (U7-R1-A).
 *
 * Closes two registered remediation items against `fs-state-store.mjs`:
 *
 *  R-AUDIT-HL-1  the WRITE leg of the hard-link law. `safeReadRecord` (read
 *                path) already refuses `nlink !== 1` typed; the audit
 *                APPEND (`appendLineIn`) opened `O_APPEND | O_NOFOLLOW` and
 *                wrote with no hard-link guard, so an `attempts.jsonl` /
 *                `writes.jsonl` aliased OUTSIDE the store root received the
 *                appended bytes. Now `appendLineIn` fstats the SAME
 *                descriptor it opened and refuses `AGENT_STATE_STORE_ALIAS_REFUSED`
 *                BEFORE any byte when `nlink !== 1`.
 *
 *  R-AUDIT-FAIL-1 the audit append outcome was silently swallowed (`catch {}`)
 *                and `ledgerBytes` returned 0 for ANY error, so a verifier
 *                could read "unreadable" as "zero writes". Now each in-memory
 *                ledger entry carries `audit: 'CONFIRMED' | { status:
 *                'UNCONFIRMED', error }`, the apply result surfaces the same
 *                field (additive — the ANSWER shape is unchanged), and
 *                `ledgerBytes` returns 0 ONLY for ENOENT or size 0 and throws
 *                `AGENT_STATE_STORE_LEDGER_UNREADABLE` otherwise.
 *
 * These are the C1 legs for the two findings; the C2 live-host leg rides
 * `tests/world-factory/suites/120-u7-astore.mjs`.
 *
 *  R-AUDIT-DEPTH (external architecture review 2026-10-29) extends this file:
 *
 *  b1  `ledgerBytes` measured through a PATH-FOLLOWING `stat`, so a swapped-in
 *      symlink had the TARGET's size answer for the ledger. It now `lstat`s
 *      and requires a REGULAR file: symlink / directory / special name earns
 *      the same AGENT_STATE_STORE_LEDGER_UNREADABLE leg as any other
 *      non-ENOENT failure — UNKNOWN, never a clean read, never followed.
 *
 *  b2  the two unreadable-ledger legs used chmod-000 and `skipIf(isRoot())`
 *      (permission bits bind nobody as root). Replaced by a deterministic
 *      injection that fails for EVERY uid: a DIRECTORY where the ledger file
 *      is expected — `lstat` answers it (b1 leg) and the append open answers
 *      EISDIR. Same semantics (unreadable → UNCONFIRMED, never
 *      CONFIRMED-clean), now asserted under root too, no skips.
 *
 *  b3  the RESIDUAL TOCTOU boundary of the nlink-at-open law is pinned as a
 *      characterisation (directory-trust assumption): a hardlink to OUR
 *      ledger inode created AFTER the open+check EXPOSES OUR appended bytes
 *      at the new name, but can never smuggle pre-existing external content
 *      in (link(2) EEXIST on an existing target) nor survive the NEXT
 *      append's nlink check. Long-term hardening (immutable files/ownership)
 *      is registered elsewhere, out of scope.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync,
  linkSync, symlinkSync, existsSync, statSync, realpathSync, renameSync, unlinkSync, readdirSync,
  constants as fsConstants,
} from 'node:fs'
import { open as openAsync } from 'node:fs/promises'
import { tmpdir, hostname } from 'node:os'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

type Refusal = { ok: false, code: string, detail: string }
type Audit = 'CONFIRMED' | { status: 'UNCONFIRMED', error: string }
type ApplyResult = { ok: boolean, code?: string, detail?: string, todos?: unknown, audit?: Audit }
type FsStore = {
  name: string
  log: { reads: unknown[], writes: Array<Record<string, unknown>>, attempts: Array<Record<string, unknown>> }
  writesBytes: () => Promise<number>
  applyTodos: (scope: string, op: Record<string, unknown>) => Promise<ApplyResult>
  applyGoal: (scope: string, op: Record<string, unknown>) => Promise<ApplyResult>
  readTodos: (scope: string) => Promise<unknown>
  readGoal: (scope: string) => Promise<unknown>
  seedGoal: (scope: string, goal: Record<string, unknown>) => Promise<void>
}
type LaneModule = {
  STATE_STORE_SUBTREE: readonly string[]
  createFsStateStore: (input: Record<string, unknown>) => FsStore
  ledgerBytes: (dir: string, filename?: string) => Promise<number>
  safeReadRecord: (path: string, limit?: number) => Promise<{ ok: true, text: string } | (Refusal & { absent?: boolean })>
}

const lane = await (import(new URL('../../tools/agent-state-family/src/index.mjs', import.meta.url).href) as unknown as Promise<LaneModule>)

const REALM = 'u7as-audit-realm'
let scratch = ''
let home = ''
beforeEach(() => {
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'u7as-audit-')))
  home = join(scratch, 'world-home')
  mkdirSync(home)
})
afterEach(() => { rmSync(scratch, { recursive: true, force: true }) })

const storeRoot = (): string => join(home, ...lane.STATE_STORE_SUBTREE, REALM)
const ledgerDir = (): string => join(storeRoot(), 'ledger')
const writesPath = (): string => join(ledgerDir(), 'writes.jsonl')
const attemptsPath = (): string => join(ledgerDir(), 'attempts.jsonl')
const store = (opts: Record<string, unknown> = {}): FsStore =>
  lane.createFsStateStore({ rootDir: storeRoot(), anchorDir: home, realmId: REALM, ...opts })
const bytesOf = (p: string): number => (existsSync(p) ? (statSync(p) as unknown as { size: number }).size : 0)
// The package's minimal node shim types neither `process.env` nor `Stats.size`
// (same narrow local view as u7-agentstate-fs-store-c1.test.ts, not a shim edit).
const sizeOf = (p: string): number => (statSync(p) as unknown as { size: number }).size

describe('u7as-audit HL1 — the write leg of the hard-link law', () => {
  it('writes.jsonl hard-linked to a file OUTSIDE the root: the apply commits the STATE but refuses the aliased ledger typed, leaving the external file byte-unchanged', async () => {
    const s = store()
    await s.applyTodos('agent:seed', { todos: [{ content: 'seed', status: 'pending' }], applyId: 'hl-seed' })
    const external = join(scratch, 'external.txt')
    writeFileSync(external, 'TOP-SECRET-BYTES')
    rmSync(writesPath())
    linkSync(external, writesPath()) // writes.jsonl now aliases the external inode (nlink 2)

    const r = await s.applyTodos('agent:a', { todos: [{ content: 'committed', status: 'pending' }], applyId: 'hl-write' })

    // ANSWER semantics unchanged: the state commit is NOT re-run or replayed.
    expect(r.ok).toBe(true)
    expect(r.todos).toEqual([{ content: 'committed', status: 'pending' }])
    // The write-audit line was refused BEFORE any byte escaped the root.
    expect(r.audit).toEqual({ status: 'UNCONFIRMED', error: 'AGENT_STATE_STORE_ALIAS_REFUSED' })
    expect(readFileSync(external, 'utf8')).toBe('TOP-SECRET-BYTES')
    expect(s.log.writes.at(-1)).toMatchObject({ op: 'todos/apply', audit: { status: 'UNCONFIRMED', error: 'AGENT_STATE_STORE_ALIAS_REFUSED' } })
    // The committed state is durable and intact.
    expect(await store().readTodos('agent:a')).toEqual([{ content: 'committed', status: 'pending' }])
  })

  it('attempts.jsonl hard-linked to a file OUTSIDE the root: the REFUSAL path surfaces the typed alias refusal and its ANSWER is unchanged', async () => {
    const s = store()
    mkdirSync(ledgerDir(), { recursive: true })
    const external = join(scratch, 'external.txt')
    writeFileSync(external, 'ATTEMPT-SECRET')
    linkSync(external, attemptsPath()) // attempts.jsonl now aliases the external inode (nlink 2)

    // A stale CAS (no record yet) is refused with ZERO durable write; the
    // ANSWER must stay {ok:false, code, detail}.
    const r = await s.applyGoal('agent:a', { expectedRevision: 1, next: { goalId: 'g', revision: 2 }, applyId: 'hl-attempt' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('GOAL_STALE_REVISION')
    expect(typeof r.detail).toBe('string')
    // The attempt audit line was refused before any byte escaped.
    expect(r.audit).toEqual({ status: 'UNCONFIRMED', error: 'AGENT_STATE_STORE_ALIAS_REFUSED' })
    expect(readFileSync(external, 'utf8')).toBe('ATTEMPT-SECRET')
    expect(s.log.attempts.at(-1)).toMatchObject({ outcome: 'refused', code: 'GOAL_STALE_REVISION', audit: { status: 'UNCONFIRMED', error: 'AGENT_STATE_STORE_ALIAS_REFUSED' } })
    // zero durable write: the refusal law is a disk fact even under the alias.
    expect(bytesOf(writesPath())).toBe(0)
  })

  it('nlink=1 happy path still appends and reports audit CONFIRMED', async () => {
    const s = store()
    const r = await s.applyTodos('agent:a', { todos: [{ content: 'x', status: 'pending' }], applyId: 'hl-happy' })
    expect(r.ok).toBe(true)
    expect(r.audit).toBe('CONFIRMED')
    expect(s.log.attempts.at(-1)).toMatchObject({ outcome: 'applied', audit: 'CONFIRMED' })
    expect(s.log.writes.at(-1)).toMatchObject({ op: 'todos/apply', audit: 'CONFIRMED' })
    expect(readFileSync(writesPath(), 'utf8')).toContain('"todos/apply"')
  })
})

describe('u7as-audit FAIL — ledgerBytes distinguishes absent/empty from unreadable', () => {
  it('absent → 0, empty → 0, sized → bytes', async () => {
    // Absent ledger: honest 0.
    expect(await lane.ledgerBytes(ledgerDir(), 'writes.jsonl')).toBe(0)
    // Empty ledger: honest 0.
    mkdirSync(ledgerDir(), { recursive: true })
    writeFileSync(writesPath(), '')
    expect(await lane.ledgerBytes(ledgerDir(), 'writes.jsonl')).toBe(0)
    // Sized ledger: the real byte count.
    writeFileSync(writesPath(), 'one line\n')
    expect(await lane.ledgerBytes(ledgerDir(), 'writes.jsonl')).toBe('one line\n'.length)
  })

  // Unreadable: a non-ENOENT failure must THROW, never masquerade as zero
  // writes. R-AUDIT-DEPTH b2: the injection is a DIRECTORY at the ledger
  // name (lstat answers it for every uid) — the previous chmod-000 leg had
  // to SKIP under root because permission bits bind nobody there.
  it('unreadable (DIRECTORY at the ledger name) → throws AGENT_STATE_STORE_LEDGER_UNREADABLE — runs under root too', async () => {
    mkdirSync(ledgerDir(), { recursive: true })
    mkdirSync(writesPath()) // a directory where the ledger file is expected
    await expect(lane.ledgerBytes(ledgerDir(), 'writes.jsonl')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_LEDGER_UNREADABLE' })
    // A directory's own size (typically 4096) is never returned as a ledger
    // byte count, and the name is never treated as absent either.
  })

  it('audit UNCONFIRMED: an unwritable ledger surfaces UNCONFIRMED while the committed state stands (never re-run) — DIRECTORY injection, root-proof', async () => {
    const s = store()
    await s.applyTodos('agent:seed', { todos: [{ content: 'seed', status: 'pending' }], applyId: 'un-seed' })
    rmSync(writesPath())
    mkdirSync(writesPath()) // the ledger is only touched AFTER the state commit
    const r = await s.applyTodos('agent:a', { todos: [{ content: 'committed', status: 'pending' }], applyId: 'un-1' })
    // ANSWER unchanged: ok:true and the committed todos still come back.
    expect(r.ok).toBe(true)
    expect(r.todos).toEqual([{ content: 'committed', status: 'pending' }])
    expect(r.audit).toMatchObject({ status: 'UNCONFIRMED' })
    // A directory at the ledger name is never a clean write-free outcome: the
    // verifier's own witness refuses, it does not answer a byte count.
    expect(r.audit).not.toBe('CONFIRMED')
    await expect(s.writesBytes()).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_LEDGER_UNREADABLE' })
    // The committed state is durable (the audit failure never re-runs/replays it).
    expect(await store().readTodos('agent:a')).toEqual([{ content: 'committed', status: 'pending' }])
  })

  it('symlinked ledger name (target = a LARGE file) is UNKNOWN on every face: the measure refuses, the append refuses before any byte, the target is untouched (R-AUDIT-DEPTH b1)', async () => {
    const s = store()
    await s.applyTodos('agent:seed', { todos: [{ content: 'seed', status: 'pending' }], applyId: 'sym-seed' })
    const writesBefore = bytesOf(writesPath())
    const target = join(scratch, 'large-target.bin')
    writeFileSync(target, 'X'.repeat(1024 * 64))
    const targetBefore = sizeOf(target)
    rmSync(writesPath())
    symlinkSync(target, writesPath()) // the ledger NAME is now a symlink to a large file

    // The verifier face must NOT follow the link: a path-following stat would
    // have answered the TARGET's size for the ledger.
    await expect(lane.ledgerBytes(ledgerDir(), 'writes.jsonl')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_LEDGER_UNREADABLE' })

    // The apply face commits the STATE, answers unchanged, and records the
    // ledger error per the existing shape. NOTE the honest distinction: the
    // APPEND leg is not the READ leg — O_NOFOLLOW on the append open answers
    // the RAW errno (ELOOP on POSIX; the repository also runs Windows
    // runners, where a reparse-point refusal surfaces as EPERM — which is
    // exactly why `finishAttempt` documents this raw-errno wording as a named
    // follow-up) and it is a THROW, so the audit entry is UNCONFIRMED —
    // never a size, whatever the errno spelling.
    const r = await s.applyTodos('agent:a', { todos: [{ content: 'committed', status: 'pending' }], applyId: 'sym-1' })
    expect(r.ok).toBe(true)
    expect(r.todos).toEqual([{ content: 'committed', status: 'pending' }])
    expect(r.audit).toMatchObject({ status: 'UNCONFIRMED' })
    expect(['ELOOP', 'EPERM']).toContain((r.audit as { error?: string }).error)
    expect(s.log.writes.at(-1)).toMatchObject({ op: 'todos/apply', audit: { status: 'UNCONFIRMED' } })

    // ZERO SIDE EFFECTS, measured where it is honest to measure: the target is
    // byte-identical (never opened as the ledger, never appended to), and the
    // store's own witness refuses rather than reporting a clean size.
    expect(sizeOf(target)).toBe(targetBefore)
    expect(readFileSync(target, 'utf8')).toBe('X'.repeat(1024 * 64))
    await expect(s.writesBytes()).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_LEDGER_UNREADABLE' })
    expect(bytesOf(writesPath())).toBe(targetBefore) // (stat-following: proof it is NOT a ledger measure)
    expect(await store().readTodos('agent:a')).toEqual([{ content: 'committed', status: 'pending' }])
    expect(writesBefore).toBeGreaterThan(0)
  })

  it('MUTATION CONTROL: the ledger measure is lstat-based — the SAME name shape (a symlink) is refused, while the target\'s bytes are never the answer', async () => {
    // Without the b1 law, the only difference between "ledger is a 9-byte
    // file" and "ledger is a symlink to a 9-byte file" is invisible to a
    // path-following stat: this leg pins that the SHAPE, not the size, decides.
    mkdirSync(ledgerDir(), { recursive: true })
    const target = join(scratch, 'nine-bytes.bin')
    writeFileSync(target, 'one line\n') // same 9 bytes as the honest leg above
    symlinkSync(target, writesPath())
    await expect(lane.ledgerBytes(ledgerDir(), 'writes.jsonl')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_LEDGER_UNREADABLE' })
    rmSync(writesPath())
    writeFileSync(writesPath(), 'one line\n') // a regular file of the SAME bytes
    expect(await lane.ledgerBytes(ledgerDir(), 'writes.jsonl')).toBe('one line\n'.length)
  })
})

describe('u7as-audit HL3 — the nlink-at-open law\'s RESIDUAL boundary, pinned as a characterisation (R-AUDIT-DEPTH b3)', () => {
  it('a hardlink to OUR ledger inode created AFTER the open+check exposes OUR appended bytes, but cannot smuggle pre-existing external content in, and dies at the next append', async () => {
    const s = store()
    await s.applyTodos('agent:seed', { todos: [{ content: 'seed', status: 'pending' }], applyId: 'b3-seed' })
    const ledger = writesPath()
    const bytesAtOpen = readFileSync(ledger, 'utf8')

    // Open the append the SAME way appendLineIn does and check the identity we
    // append to — nlink===1, so NO ALIAS EXISTED THEN.
    const outside = join(scratch, 'aliased.jsonl')
    const handle = await openAsync(ledger, (fsConstants.O_WRONLY ?? 0) | (fsConstants.O_CREAT ?? 0) | (fsConstants.O_APPEND ?? 0) | (fsConstants.O_NOFOLLOW ?? 0))
    try {
      const st = await handle.stat()
      expect(st.isFile()).toBe(true)
      expect(st.nlink).toBe(1)

      // A writer INSIDE the hostile directory now links OUR inode out.
      linkSync(ledger, outside)

      // The append already in flight lands on OUR inode, and the new name
      // therefore shows OUR bytes — this is the residual window: an
      // AFTER-open alias exposes appended content of our own ledger.
      await handle.writeFile('appended-after-open\n', 'utf8')
    } finally {
      await handle.close()
    }
    expect(readFileSync(outside, 'utf8')).toBe(`${bytesAtOpen}appended-after-open\n`)
    // The direction is one-way: nothing travelled INTO our inode.
    expect(readFileSync(ledger, 'utf8')).toBe(`${bytesAtOpen}appended-after-open\n`)

    // The other half of the law: an alias cannot carry PRE-EXISTING external
    // content — link(2) refuses an existing target, so the attacker's own
    // file can never BECOME our inode to be overwritten.
    const preexisting = join(scratch, 'preexisting.txt')
    writeFileSync(preexisting, 'PRE-EXISTING-EXTERNAL')
    let refused: unknown = null
    try { linkSync(ledger, preexisting) } catch (error) { refused = error }
    expect((refused as { code?: string } | null)?.code).toBe('EEXIST')
    expect(readFileSync(preexisting, 'utf8')).toBe('PRE-EXISTING-EXTERNAL')

    // The alias does not survive the NEXT append: appendLineIn fstats its own
    // fd and now sees nlink 2 — refused typed, before any byte, ANSWER intact.
    const r = await s.applyTodos('agent:a', { todos: [{ content: 'committed', status: 'pending' }], applyId: 'b3-after' })
    expect(r.ok).toBe(true)
    expect(r.audit).toEqual({ status: 'UNCONFIRMED', error: 'AGENT_STATE_STORE_ALIAS_REFUSED' })
    // and the aliased name stopped growing at the byte our own fd wrote.
    expect(readFileSync(outside, 'utf8')).toBe(`${bytesAtOpen}appended-after-open\n`)
    // DIRECTORY-TRUST ASSUMPTION: this leg characterises the boundary the
    // module header documents; closing it needs ownership/immutable-file
    // hardening (registered elsewhere — out of scope here).
    expect(await store().readTodos('agent:a')).toEqual([{ content: 'committed', status: 'pending' }])
  })
})

// ---------------------------------------------------------------------------
// u7as-lockbreak P0-2b — LOCK ACQUISITION/CLEANUP characterisation legs
// (external audit intake #3, 2026-10-29; lane u7r3-al).
//
// The suspected defect: acquireLock's breaker DECIDES staleness against a
// lock RECORD, then acts on the lock NAME (rename-aside), and only checks
// AFTER the move whether what it moved was still what it judged — a
// decision→action→verify order in which the holder-affecting effect (the
// move, and the mismatch-restore's unlink) lands before the check, so a
// concurrent interleaving can (i) steal a NEW holder's lock for a moment
// (two writers both hold the scope), (ii) destroy the bytes of a live
// holder's lock when the mismatch-restore loses the race, or (iii) let a
// robbed holder's own beat clobber a new holder's lock. Each interleaving
// gets its own characterisation test FIRST; the law asserted is the module
// header's own SERIALISATION law, not an invention of this file.
//
// Determinism: every actor is parked at an explicit fault seam
// ('after-read' / 'beat-before-rename' inside the store, and the two
// decision→action seams added for this leg, 'lock-before-break-rename' and
// 'lock-after-break-rename'); the "concurrent" parties are driven by the
// test itself in the exact order that real thread/fd scheduling may
// produce. The bounded waits are disclosed caps on RED-side arrival, never
// correctness premises (same house style as the c1 T-legs).
// ---------------------------------------------------------------------------

const lockPathOf = (scope: string): string =>
  join(storeRoot(), 'locks', `${createHash('sha256').update(scope).digest('hex')}.lock`)
const writeLockRecord = (scope: string, record: Record<string, unknown>): void => {
  mkdirSync(join(storeRoot(), 'locks'), { recursive: true })
  writeFileSync(lockPathOf(scope), JSON.stringify(record))
}
const readLockOf = (scope: string): { nonce?: string, token?: string, host?: string, boot?: string } | null => {
  try { return JSON.parse(readFileSync(lockPathOf(scope), 'utf8')) as { nonce?: string } } catch { return null }
}
const raceTimeout = (p: Promise<unknown>, ms: number): Promise<boolean> =>
  Promise.race([p.then(() => true), new Promise<false>((r) => { setTimeout(() => r(false), ms) })])
const goalApplyLines = (): number => {
  try { return readFileSync(writesPath(), 'utf8').split('\n').filter((l) => l.includes('"goal/apply"')).length } catch { return 0 }
}
const gatePair = (): { wait: Promise<void>, open: () => void, arm: () => void, armed: Promise<void> } => {
  let fire!: () => void
  let release!: () => void
  const armed = new Promise<void>((r) => { fire = r })
  const wait = new Promise<void>((r) => { release = r })
  return { wait, open: release, arm: fire, armed }
}

describe('u7as-lockbreak P0-2b — break/cleanup decision→action races', () => {
  // Interleaving (iii) — holder vs cleaner: a live holder's lock is removed
  // under it by a concurrent cleaner; a fresh holder then acquires the
  // scope cleanly; the robbed holder's in-flight beat must NEVER rename its
  // own generation over the fresh holder's lock (that clobber would leave
  // TWO live holders each seeing "its" lock at the name). Characterised on
  // the pre-fix code with ONLY the pre-existing seams.
  it('iii — a beat must never overwrite a lock generation it does not own (live holder robbed, fresh holder clobbered)', async () => {
    const s = store()
    await s.applyTodos('agent:iii', { todos: [{ content: 'seed', status: 'pending' }], applyId: 'iii-seed' })

    // Victim C holds the scope, parked INSIDE the critical section; its
    // beat is parked at the pre-existing 'beat-before-rename' seam.
    const insideC = gatePair()
    const beat1 = gatePair()
    const victim = store({ lockHeartbeatMs: 10, faultAt: async (point: string) => {
      if (point === 'after-read') { insideC.arm(); await insideC.wait }
      if (point === 'beat-before-rename') { beat1.arm(); await beat1.wait }
    } })
    const pendingC = victim.applyTodos('agent:iii', { todos: [{ content: 'from-C', status: 'pending' }], applyId: 'iii-C' })
    await insideC.armed
    await beat1.armed
    const cNonce = (readLockOf('agent:iii') as { nonce: string }).nonce

    // The concurrent cleaner removes the LIVE holder's lock (byte-preserving
    // rename-aside — this is exactly what a breaker's rename does).
    const aside = join(scratch, 'iii-cleaner-aside')
    renameSync(lockPathOf('agent:iii'), aside)

    // Fresh holder D acquires the now-free name and enters its critical
    // section believing (rightly, by the published protocol) it holds the
    // scope exclusively.
    const insideD = gatePair()
    const thief = store({ lockHeartbeatMs: 10_000, faultAt: async (point: string) => {
      if (point === 'after-read') { insideD.arm(); await insideD.wait }
    } })
    const pendingD = thief.applyTodos('agent:iii', { todos: [{ content: 'from-D', status: 'pending' }], applyId: 'iii-D' })
    await insideD.armed
    const dNonce = (readLockOf('agent:iii') as { nonce: string }).nonce
    expect(dNonce).not.toBe(cNonce)

    // Release the victim's parked beat. PRE-FIX it renames C's generation
    // over D's live lock. POST-FIX the beat reads the current generation
    // first and refuses to overwrite a record it does not own.
    beat1.open()
    // Disclosed bounded settle: watch up to 400 ms (≈40 C-beats) for the
    // name to change hands; a clobber lands within a couple of beats.
    let captured = dNonce
    for (let i = 0; i < 100; i += 1) {
      const now = readLockOf('agent:iii')
      if (now !== null && now.nonce !== dNonce) { captured = now.nonce as string; break }
      await new Promise<void>((r) => setTimeout(r, 4))
    }
    insideC.open()
    insideD.open()
    await Promise.all([pendingC, pendingD])
    expect(captured, 'a live holder’s lock generation was overwritten by a robbed holder’s stale beat — mutual exclusion was silently voided').toBe(dNonce)
  })

  // Interleaving (i) — breaker A judges the OLD generation stale; breaker B
  // wins the same move race first and clears it; holder C acquires the free
  // name; A's rename then STEALS C's live lock (the name is momentarily
  // empty); writer D wins the scope in that gap. Pre-fix, C and D both
  // commit off the same expectedRevision — the header's own SERIALISATION
  // law ("two concurrent appliers at the same expectedRevision cannot both
  // win") is voided. Post-fix the move is revalidated against the name
  // before it happens, the name is never emptied under C, and D refuses.
  it('i — two appliers at the SAME expectedRevision must never both win: the break must not empty the name under a live holder', async () => {
    const s = store()
    await s.seedGoal('agent:i', { goalId: 'g', objective: 'seed', phase: 'active', revision: 1, roundsStarted: 0, armed: true })
    const lines0 = goalApplyLines()
    // Lock the scope with a DEAD-AT-REBOOT proof against the breaker's boot
    // identity (bootId seam: 'older-boot' vs the breaker's 'breaker-boot').
    writeLockRecord('agent:i', { pid: 2 ** 22 + 4242, host: hostname(), boot: 'older-boot', nonce: 'older-gen-i', token: 'older-tok-i', at: Date.now() })

    const beforeRename = gatePair()
    const afterRename = gatePair()
    let firstJudge = true
    const breaker = store({ bootId: 'breaker-boot', lockTimeoutMs: 400, faultAt: async (point: string) => {
      if (point === 'lock-before-break-rename' && firstJudge) { firstJudge = false; beforeRename.arm(); await beforeRename.wait }
      if (point === 'lock-after-break-rename') { afterRename.arm(); await afterRename.wait }
    } })
    const pendingA = breaker.applyTodos('agent:i', { todos: [{ content: 'from-breaker', status: 'pending' }], applyId: 'i-breaker' })
    await beforeRename.armed // breaker A has DECIDED (stale by boot proof) and not yet acted

    // Concurrent breaker B wins the same rename race and clears the stale record.
    const asideB = join(scratch, 'i-breakerB-aside')
    renameSync(lockPathOf('agent:i'), asideB)
    unlinkSync(asideB)

    // New holder C acquires the now-free name and parks INSIDE its critical section.
    const insideC = gatePair()
    const holderC = store({ bootId: 'breaker-boot', faultAt: async (point: string) => {
      if (point === 'after-read') { insideC.arm(); await insideC.wait }
    } })
    const pendingC = holderC.applyGoal('agent:i', {
      expectedRevision: 1, applyId: 'i-C',
      next: { goalId: 'g', objective: 'from-C', phase: 'active', revision: 2, roundsStarted: 0, armed: true },
    })
    await insideC.armed
    beforeRename.open() // A acts on its stale decision

    // RED world: A moves C's record aside and parks at the second seam — the
    // name is EMPTY. GREEN world: A revalidates, refuses, and the seam never
    // fires. Disclosed cap on RED arrival (lands in ms); the asserted law is
    // world-independent.
    const stole = await raceTimeout(afterRename.armed, 1_000)
    let dResult: ApplyResult
    if (stole) {
      // Writer D wins the scope in the momentary gap (full apply under the
      // stolen-then-restored name), same expectedRevision as C.
      const thief = store({ bootId: 'breaker-boot', lockTimeoutMs: 200 })
      dResult = await thief.applyGoal('agent:i', {
        expectedRevision: 1, applyId: 'i-D',
        next: { goalId: 'g', objective: 'from-D', phase: 'active', revision: 2, roundsStarted: 0, armed: true },
      })
      afterRename.open() // A now verifies the moved object, mismatches, restores (path empty again after D's release)
    } else {
      const thief = store({ bootId: 'breaker-boot', lockTimeoutMs: 200 })
      dResult = await thief.applyGoal('agent:i', {
        expectedRevision: 1, applyId: 'i-D',
        next: { goalId: 'g', objective: 'from-D', phase: 'active', revision: 2, roundsStarted: 0, armed: true },
      })
    }
    const aResult = await pendingA // both worlds: A ends refused (C's live record is never provably dead)
    expect(aResult.ok).toBe(false)
    insideC.open()
    const cResult = await pendingC
    const winners = [cResult, dResult].filter((r) => r.ok === true)
    expect(winners.length, `mutual exclusion voided: ${String(winners.length)} appliers won the SAME expectedRevision=1 (C=${String(cResult.ok)} D=${String(dResult.ok)})`).toBe(1)
    expect(await store().readGoal('agent:i')).toMatchObject({ revision: 2 })
    expect(goalApplyLines() - lines0, 'exactly one durable goal/apply commit may answer the same expectedRevision').toBe(1)
  })

  // Interleaving (ii) — the restore-failure path: A's rename moved a record
  // it never judged (C's live generation); C's owner is alive; the reclaim
  // link loses the race against a re-lock; the pre-fix code swallows the
  // EEXIST and UNCONDITIONALLY unlinks the aside — destroying the live
  // holder's lock bytes. Law (module header, CORRECTNESS OVER LIVENESS /
  // never-steal): a generation the breaker did not prove dead must never be
  // destroyed — it stays at the name, or its bytes are retained aside.
  it('ii — a reclaim that loses the race must retain the foreign generation’s bytes, never unlink a live holder’s lock', async () => {
    const s = store()
    await s.applyTodos('agent:ii', { todos: [{ content: 'seed', status: 'pending' }], applyId: 'ii-seed' })
    writeLockRecord('agent:ii', { pid: 2 ** 22 + 4242, host: hostname(), boot: 'older-boot', nonce: 'older-gen-ii', token: 'older-tok-ii', at: Date.now() })

    const beforeRename = gatePair()
    const afterRename = gatePair()
    let firstJudge = true
    const breaker = store({ bootId: 'breaker-boot', lockTimeoutMs: 400, faultAt: async (point: string) => {
      if (point === 'lock-before-break-rename' && firstJudge) { firstJudge = false; beforeRename.arm(); await beforeRename.wait }
      if (point === 'lock-after-break-rename') { afterRename.arm(); await afterRename.wait }
    } })
    const pendingA = breaker.applyTodos('agent:ii', { todos: [{ content: 'x', status: 'pending' }], applyId: 'ii-breaker' })
    await beforeRename.armed
    const asideB = join(scratch, 'ii-breakerB-aside')
    renameSync(lockPathOf('agent:ii'), asideB)
    unlinkSync(asideB)

    const insideC = gatePair()
    const holderC = store({ bootId: 'breaker-boot', faultAt: async (point: string) => {
      if (point === 'after-read') { insideC.arm(); await insideC.wait }
    } })
    const pendingC = holderC.applyTodos('agent:ii', { todos: [{ content: 'from-C', status: 'pending' }], applyId: 'ii-C' })
    await insideC.armed
    const cNonce = (readLockOf('agent:ii') as { nonce: string }).nonce
    beforeRename.open()

    const stole = await raceTimeout(afterRename.armed, 1_000) // disclosed cap (see leg i)
    if (stole) {
      // Someone re-locks the momentarily-empty name with CREATE semantics
      // (link — never overwrites), so A's reclaim link must lose with EEXIST.
      const dTemp = join(storeRoot(), 'locks', '.d-generation.tmp')
      writeFileSync(dTemp, JSON.stringify({ pid: process.pid, host: hostname(), boot: 'breaker-boot', nonce: 'd-gen-ii', token: 'd-tok-ii', at: Date.now() }))
      try { linkSync(dTemp, lockPathOf('agent:ii')) } catch { /* name taken */ }
      unlinkSync(dTemp)
      afterRename.open() // pre-fix: EEXIST swallowed, then the unconditional unlink DESTROYS C's bytes
    }
    const aResult = await pendingA
    expect(aResult.ok).toBe(false) // both worlds end in a typed refusal, never a steal-through
    const locksDir = join(storeRoot(), 'locks')
    const candidateNames = readdirSync(locksDir).filter((n) => n.endsWith('.lock') || n.includes('.broken.'))
    const cGenerationPresent = candidateNames.some((n) => {
      try { return (JSON.parse(readFileSync(join(locksDir, n), 'utf8')) as { nonce?: string }).nonce === cNonce } catch { return false }
    })
    expect(cGenerationPresent, 'the breaker destroyed the bytes of a live holder’s lock generation (restore lost the race and the aside was unlinked anyway)').toBe(true)
    insideC.open()
    await pendingC
  })
})

