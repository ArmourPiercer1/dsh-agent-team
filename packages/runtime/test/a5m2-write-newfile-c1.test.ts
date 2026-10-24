/**
 * A5-M2 REAL-GAP card (2026-10-25) — C1 for the post-consume CREATE closure
 * (`packages/runtime/controlled-fs/src/post-consume-create.ts`): the
 * backlog row `write（新建文件） 未开发 … 待派` closes here with the law the
 * HELD branch NAMED (the parent stays FD-bound across the creation; the
 * exclusive create answers the race honestly).
 *
 * What each leg proves against a REAL filesystem (worlds under
 * `tests/homes/`, TEST_METHODS §7, torn down; no Host, no ports):
 *   C1  create-if-absent is REAL: the bytes land, the receipt is the D-C2-1
 *       pair, the fresh object is a regular single-link file;
 *   C2  a nested contained parent binds through the /proc/self/fd chain and
 *       creates there (not at the lexical name's new target);
 *   C3  an EEXIST race LOSES with ZERO bytes: existing content is asserted
 *       byte-intact by re-read (no truncate window — this is the defect the
 *       root's 07:13Z ruling listed, pinned here);
 *   C4  an absent parent is a TYPED refusal with the CONTRACT REASON
 *       (directory creation lives outside the `I + F(write exact file)`
 *       closed effect set — the disclosed deviation from the native
 *       mkdir-recursive spelling); nothing is created anywhere;
 *   C5  a parent swapped to a symlink BEFORE the run refuses `symlink-alias`
 *       and the outside directory stays EMPTY (zero creation is asserted,
 *       not claimed);
 *   C6  a symlink sitting at the final name refuses `symlink-alias` at the
 *       exclusive create; the outside file it points at is byte-intact;
 *   C7  single flight (P3): the second call refuses `grant-consumed`; the
 *       bytes exist exactly once, the first landing unchanged;
 *   C8  cancellation before the claim produces no effect: zero creation;
 *   C9  the root swapped to an outside symlink AFTER the plan froze refuses
 *       at the ANCHOR law before any open; the outside dir stays EMPTY;
 *   C10 the closure is a PRIVATE executor: it rides no public barrel
 *       (the sibling write closure's guard, mirrored).
 *
 * Disclosed NOT_VERIFIED: a mid-write chunk failure (no fault-injection
 * seam at this level; the loop law is the reviewed r16 closure's verbatim);
 * hardlink-at-fresh-name (needs an inotify race; the nlink law is code-
 * reviewed only).
 *
 * @module packages/runtime/test/a5m2-write-newfile-c1
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync,
  rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

import { createPostConsumeCreateClosure } from '../controlled-fs/src/post-consume-create.js'
import type { PostConsumeWritePlan } from '../controlled-fs/src/post-consume-write.js'
import * as laneBarrel from '../controlled-fs/src/index.js'

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
let worldRoot = ''

function mkWorld(name: string): { root: string; outside: string } {
  const root = mkdtempSync(path.join(worldRoot, `${name}-`))
  const outside = path.join(worldRoot, `${name}-outside`)
  mkdirSync(outside, { recursive: true })
  return { root, outside }
}

function sha(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

function mkPlan(root: string, rel: string, content: string): PostConsumeWritePlan {
  return Object.freeze({
    approvedRootLexical: root,
    approvedRootReal: realpathSync(root),
    approvedLocator: path.join(root, rel),
    content,
    planFingerprint: 'fp-create-plan-1',
  })
}

beforeAll(() => {
  worldRoot = path.join(repoRoot, 'tests', 'homes', `m2pcc-${runId}`)
  mkdirSync(worldRoot, { recursive: true })
})

afterAll(() => {
  rmSync(worldRoot, { recursive: true, force: true })
})

describe('a5m2 post-consume CREATE closure — the new-file law is REAL', () => {
  it('C1 an absent target CREATES: bytes land, the D-C2-1 pair rides the receipt, the fresh object is a regular single-link file', async () => {
    const w = mkWorld('c1')
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'fresh.txt', 'HELLO NEW FILE\n'),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(r.value).toEqual({ canonicalLocator: path.join(w.root, 'fresh.txt'), writtenFingerprint: sha('HELLO NEW FILE\n') })
    expect(readFileSync(path.join(w.root, 'fresh.txt'), 'utf8')).toBe('HELLO NEW FILE\n')
    const st = lstatSync(path.join(w.root, 'fresh.txt'))
    expect(st.isFile()).toBe(true)
    expect(st.nlink).toBe(1)
  })

  it('C2 a NESTED contained parent resolves at its mapped real spelling and the create rides the final-parent fd: the file lands inside the ROOT', async () => {
    const w = mkWorld('c2')
    mkdirSync(path.join(w.root, 'a', 'b'), { recursive: true })
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'a/b/deep.txt', 'nested lands\n'),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect(readFileSync(path.join(w.root, 'a', 'b', 'deep.txt'), 'utf8')).toBe('nested lands\n')
    expect(existsSync(path.join(w.outside, 'deep.txt'))).toBe(false)
  })

  it('C3 an existing target races LOST: EEXIST refuses with ZERO bytes and the existing content is BYTE-INTACT (no truncate window)', async () => {
    const w = mkWorld('c3')
    const target = path.join(w.root, 'keep.txt')
    writeFileSync(target, 'KEEP-ME UNTOUCHED\n')
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'keep.txt', 'OVERWRITE ATTEMPT\n'),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfClass']).toBe('denied')
    expect(r.error.message).toContain('ZERO bytes')
    expect(readFileSync(target, 'utf8')).toBe('KEEP-ME UNTOUCHED\n')
  })

  it('C4 an absent parent is a typed refusal with the CONTRACT REASON (mkdir is outside the closed effect set); nothing is created', async () => {
    const w = mkWorld('c4')
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'missing/deep/new.txt', 'never lands\n'),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('not-a-directory')
    expect(r.error.message).toContain('NEVER creates directories')
    expect(r.error.message).toContain('mkdir-recursive')
    expect(existsSync(path.join(w.root, 'missing'))).toBe(false)
  })

  it('C5 a parent swapped to an outside symlink BEFORE the run refuses symlink-alias; the OUTSIDE dir stays EMPTY (zero creation asserted)', async () => {
    const w = mkWorld('c5')
    symlinkSync(w.outside, path.join(w.root, 'notes'))
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'notes/hijack.txt', 'HIJACK\n'),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('symlink-alias')
    expect(r.error.message).toContain('before creation')
    expect(existsSync(path.join(w.outside, 'hijack.txt'))).toBe(false)
  })

  it('C6 a symlink AT THE FINAL NAME refuses symlink-alias at the exclusive create; the file it points at is byte-intact', async () => {
    const w = mkWorld('c6')
    const victim = path.join(w.outside, 'victim.txt')
    writeFileSync(victim, 'ORIGINAL OUTSIDE BYTES\n')
    symlinkSync(victim, path.join(w.root, 'alias.txt'))
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'alias.txt', 'SWAP ATTACK\n'),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('symlink-alias')
    expect(readFileSync(victim, 'utf8')).toBe('ORIGINAL OUTSIDE BYTES\n')
  })

  it('C7 single flight (P3): the second call refuses grant-consumed; the bytes exist ONCE, unchanged from the first landing', async () => {
    const w = mkWorld('c7')
    const plan = mkPlan(w.root, 'once.txt', 'exactly once\n')
    const closure = createPostConsumeCreateClosure(
      plan,
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const first = await closure.write()
    expect(first.ok, JSON.stringify(first)).toBe(true)
    const second = await closure.write()
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('unreachable')
    expect(second.error.details?.['cfReason']).toBe('grant-consumed')
    expect(readFileSync(path.join(w.root, 'once.txt'), 'utf8')).toBe('exactly once\n')
  })

  it('C8 cancellation before the claim produces no effect: zero creation', async () => {
    const w = mkWorld('c8')
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'cancelled.txt', 'never\n'),
      { parametersFingerprint: 'fp-create-plan-1', signal: { aborted: true } },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('effect-outside-grant')
    expect(existsSync(path.join(w.root, 'cancelled.txt'))).toBe(false)
  })

  it('C9 the root swapped to an outside symlink AFTER the plan froze refuses at the ANCHOR law BEFORE any open; the outside dir stays EMPTY', async () => {
    const w = mkWorld('c9')
    const plan = mkPlan(w.root, 'ghost.txt', 'never lands\n')
    // after approval the attacker replaces the whole root with a link out
    rmSync(w.root, { recursive: true })
    symlinkSync(w.outside, w.root)
    const closure = createPostConsumeCreateClosure(
      plan,
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('outside-anchor')
    expect(existsSync(path.join(w.outside, 'ghost.txt'))).toBe(false)
  })

  it('C10 the create closure is a PRIVATE executor: it rides no public barrel (mirrors the write closure guard)', () => {
    expect(laneBarrel).not.toHaveProperty('createPostConsumeCreateClosure')
    expect(laneBarrel).not.toHaveProperty('PostConsumeCreatePlan')
  })

  // ── root P2 pins (2026-10-25): the checks and the real-effect protocol ──
  // The cancellation seams use a COUNTING getter on signal.aborted — every
  // isAborted read advances it — so each pin exercises the EXACT check the
  // ruling named, deterministically (no timing luck).

  function countingSignal(abortFromRead: number): { readonly aborted: boolean } {
    let reads = 0
    return { get aborted() { reads += 1; return reads >= abortFromRead } }
  }

  it('D1 cancellation landing between the parent bind and the create refuses with ZERO creation (P2-1: the bind await is a real await point)', async () => {
    const w = mkWorld('d1')
    // check order: (1) top, (2) pre-bind, (3) post-bind/pre-create -> abort
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'never.txt', 'never lands\n'),
      { parametersFingerprint: 'fp-create-plan-1', signal: countingSignal(3) },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('effect-outside-grant')
    expect(r.error.message).toContain('after the parent bind but before the create')
    expect(existsSync(path.join(w.root, 'never.txt'))).toBe(false)
  })

  it('D2 cancellation AT/AFTER the exclusive create is a REAL side effect: undetermined, sideEffectPossible, the created file STANDS (P2-1 second half)', async () => {
    const w = mkWorld('d2')
    // check order: (1) top, (2) pre-bind, (3) post-bind, (4) post-create -> abort
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'created-then-cancelled.txt', ''),
      { parametersFingerprint: 'fp-create-plan-1', signal: countingSignal(4) },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('write-side-effect-unconfirmed')
    expect(r.error.details?.['sideEffectUnknown']).toBe(true)
    expect(r.error.message).toContain('STANDS at the exact target')
    // the file was really created — asserted by re-stat, never by the word
    expect(lstatSync(path.join(w.root, 'created-then-cancelled.txt')).isFile()).toBe(true)
  })

  it('D3 a STABLE trusted root symlink (/alias -> /real/root) answers normally through the frozen-real + relative mapping, and a CHILD-path symlink still refuses (P2-2: mapping does not relax children)', async () => {
    const w = mkWorld('d3')
    const realRoot = path.join(w.root, 'real')
    mkdirSync(realRoot)
    const alias = path.join(w.root, 'alias')
    symlinkSync(realRoot, alias)
    const closure = createPostConsumeCreateClosure(
      Object.freeze({
        approvedRootLexical: alias,
        approvedRootReal: realpathSync(alias),
        approvedLocator: path.join(alias, 'via-alias.txt'),
        content: 'lands via the alias root\n',
        planFingerprint: 'fp-create-plan-1',
      }),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: alias },
    )
    const r = await closure.write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect(readFileSync(path.join(realRoot, 'via-alias.txt'), 'utf8')).toBe('lands via the alias root\n')
    // children stay strict: a symlinked CHILD parent under the alias root refuses
    mkdirSync(path.join(realRoot, 'sub'))
    symlinkSync(realRoot, path.join(realRoot, 'loop'))
    const hostile = createPostConsumeCreateClosure(
      Object.freeze({
        approvedRootLexical: alias,
        approvedRootReal: realpathSync(alias),
        approvedLocator: path.join(alias, 'loop', 'hostile.txt'),
        content: 'no\n',
        planFingerprint: 'fp-create-plan-1',
      }),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: alias },
    )
    const h = await hostile.write()
    expect(h.ok).toBe(false)
    if (h.ok) throw new Error('unreachable')
    expect(h.error.details?.['cfReason']).toBe('symlink-alias')
    expect(existsSync(path.join(realRoot, 'hostile.txt'))).toBe(false)
  })

  it('D4 a failed post-create identity re-read settles write-side-effect-unconfirmed with sideEffectPossible — never a bare throw past the protocol (P2-3)', async () => {
    const w = mkWorld('d4')
    const probe = await (await import('node:fs/promises')).open(path.join(w.root, '.probe'), 'w')
    const proto = Object.getPrototypeOf(probe) as { stat: (opts?: unknown) => Promise<unknown> }
    const original = proto.stat
    let calls = 0
    proto.stat = async function (this: unknown, opts?: unknown) {
      calls += 1
      // the FIRST handle.stat the closure performs is the post-create
      // identity re-read (no stat runs before the create): fail exactly it
      if (calls === 1) throw Object.assign(new Error('injected stat failure'), { code: 'EIO' })
      return original.call(this, opts)
    }
    try {
      const closure = createPostConsumeCreateClosure(
        mkPlan(w.root, 'identity-fail.txt', 'content never checked\n'),
        { parametersFingerprint: 'fp-create-plan-1' },
        { instanceRootDir: w.root },
      )
      const r = await closure.write()
      expect(r.ok).toBe(false)
      if (r.ok) throw new Error('unreachable')
      expect(r.error.details?.['cfReason']).toBe('write-side-effect-unconfirmed')
      expect(r.error.details?.['sideEffectUnknown']).toBe(true)
      expect(r.error.message).toContain('identity re-read failed')
      expect(existsSync(path.join(w.root, 'identity-fail.txt'))).toBe(true)
    } finally {
      proto.stat = original
      await probe.close()
    }
  })

  it('C11 the empty string is a legal create: zero-byte file lands with the empty-content fingerprint', async () => {
    const w = mkWorld('c11')
    const closure = createPostConsumeCreateClosure(
      mkPlan(w.root, 'empty.txt', ''),
      { parametersFingerprint: 'fp-create-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(lstatSync(path.join(w.root, 'empty.txt')).size).toBe(0)
    expect(r.value.writtenFingerprint).toBe(sha(''))
  })
})
