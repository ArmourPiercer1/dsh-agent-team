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
  linkSync, symlinkSync, existsSync, statSync, realpathSync, constants as fsConstants,
} from 'node:fs'
import { open as openAsync } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
