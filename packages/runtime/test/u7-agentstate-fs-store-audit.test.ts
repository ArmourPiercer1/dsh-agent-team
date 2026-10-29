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
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync,
  linkSync, chmodSync, existsSync, statSync, realpathSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type Refusal = { ok: false, code: string, detail: string }
type Audit = 'CONFIRMED' | { status: 'UNCONFIRMED', error: string }
type ApplyResult = { ok: boolean, code?: string, detail?: string, todos?: unknown, audit?: Audit }
type FsStore = {
  name: string
  log: { reads: unknown[], writes: Array<Record<string, unknown>>, attempts: Array<Record<string, unknown>> }
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

const lane = (await import(new URL('../../tools/agent-state-family/src/index.mjs', import.meta.url).href) as unknown as Promise<LaneModule>)

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
const isRoot = (): boolean => { try { return typeof (process as unknown as { getuid?: () => number }).getuid === 'function' && (process as unknown as { getuid: () => number }).getuid() === 0 } catch { return false } }

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
  // writes. chmod 000 the LEDGER DIRECTORY so stat(2) fails EACCES; root
  // bypasses permission bits, so this leg SKIPs (not passes) there.
  it.skipIf(isRoot())('unreadable → throws AGENT_STATE_STORE_LEDGER_UNREADABLE', async () => {
    mkdirSync(ledgerDir(), { recursive: true })
    writeFileSync(writesPath(), 'x')
    chmodSync(ledgerDir(), 0o000)
    try {
      await expect(lane.ledgerBytes(ledgerDir(), 'writes.jsonl')).rejects.toMatchObject({ code: 'AGENT_STATE_STORE_LEDGER_UNREADABLE' })
    } finally {
      chmodSync(ledgerDir(), 0o700)
    }
  })

  it.skipIf(isRoot())('audit UNCONFIRMED: an unwritable ledger surfaces UNCONFIRMED while the committed state stands (never re-run)', async () => {
    const s = store()
    await s.applyTodos('agent:seed', { todos: [{ content: 'seed', status: 'pending' }], applyId: 'un-seed' })
    chmodSync(ledgerDir(), 0o000) // the ledger is only touched AFTER the state commit
    try {
      const r = await s.applyTodos('agent:a', { todos: [{ content: 'committed', status: 'pending' }], applyId: 'un-1' })
      // ANSWER unchanged: ok:true and the committed todos still come back.
      expect(r.ok).toBe(true)
      expect(r.todos).toEqual([{ content: 'committed', status: 'pending' }])
      expect(r.audit).toMatchObject({ status: 'UNCONFIRMED' })
      // The committed state is durable (the audit failure never re-runs/replays it).
      expect(await store().readTodos('agent:a')).toEqual([{ content: 'committed', status: 'pending' }])
    } finally {
      chmodSync(ledgerDir(), 0o700)
    }
  })
})
