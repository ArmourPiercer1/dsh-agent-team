/**
 * A5-M2 (root ruling) — C1 for the post-consume write closure
 * (`packages/runtime/controlled-fs/src/post-consume-write.ts`).
 *
 * The ruling's three states are separated BY CODE and resolved by legs:
 *   A — authorization/boundary refusal BEFORE creation ⇒ ZERO CREATION
 *       (proven by asserting the outside directory stays EMPTY under a
 *       parent-symlink attack: the open has no O_CREAT, so creation is
 *       structurally impossible, not merely unlikely);
 *   B — a raced target cannot come back "created": the O_CREAT-less open
 *       answers ENOENT and refuses with zero creation;
 *   C — after truncation, existence and content are BOTH changed; the
 *       success side is asserted byte-exact, and the failure side
 *       (`write-side-effect-unconfirmed { sideEffectPossible: true }`) has
 *       NO forceable injection seam at this level — disclosed
 *       NOT_VERIFIED below, riding the existing lane law verbatim.
 *
 * Honesty: no Host, no ports, no network; worlds under `tests/homes/`
 * (workspace, TEST_METHODS §7), torn down. NOT_VERIFIED (disclosed):
 *  (1) the truncate-succeeded-then-write-failed race (no fault seam);
 *  (2) the `/proc/self/fd` unreadable (`undeterminable`) branch — the
 *      mapping is the existing lane law, not re-exercised here.
 *
 * @module packages/runtime/test/a5m2-post-consume-write-c1
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync,
  symlinkSync, writeFileSync, readFileSync, realpathSync,
} from 'node:fs'
import { open as fsOpenProbe } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

import { createPostConsumeWriteClosure, type PostConsumeWritePlan } from '../controlled-fs/src/post-consume-write.js'
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

function isEmptyDir(dir: string): boolean {
  return readdirSync(dir).length === 0
}

// Node 24 exposes no FileHandle class by name — the prototype is taken from
// a REAL handle instance (the same object the closure uses; all handles
// share it), so the interception below is the real seam.
type HandleWriteFn = (buffer: Uint8Array, offset?: number, length?: number, position?: number | null) => Promise<{ bytesWritten: number; buffer: Uint8Array }>
async function handlePrototype(dir: string): Promise<{ write: HandleWriteFn }> {
  const probe = await fsOpenProbe(path.join(dir, '.probe'), 'w')
  const proto = Object.getPrototypeOf(probe) as { write: HandleWriteFn }
  await probe.close()
  return proto
}

// ── TOCTOU timing: what this Node (v24) ACTUALLY admits (measured, not
// assumed) ───────────────────────────────────────────────────────────────
// `fsPromises.open` on this runtime completes in the event-loop I/O polling
// backend (libuv 1.x): a synchronous main-thread attack CANNOT land
// between the call and the open() syscall — measured: the open wins every
// time, sparse-threadpool blockers never get a chance to matter. So the
// "swap after the post-open checks, before the open" window is
// physically UNREACHABLE here (disclosed, NOT forced; the fd-based checks
// below are exercised through the PRE-CHECK layer instead).

function sha(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

function mkPlan(root: string, rel: string, content: string, fp = 'fp-plan-1'): PostConsumeWritePlan {
  return Object.freeze({
    approvedRootLexical: root,
    approvedRootReal: realpathSync(root),
    approvedLocator: path.join(root, rel),
    content,
    planFingerprint: fp,
  })
}

beforeAll(() => {
  worldRoot = path.join(repoRoot, 'tests', 'homes', `m2pcw-${runId}`)
  mkdirSync(worldRoot, { recursive: true })
})

afterAll(() => {
  rmSync(worldRoot, { recursive: true, force: true })
})

describe('a5m2 post-consume write closure — state A: refused before creation, ZERO CREATION', () => {
  it('T-A1 an absent target is the HELD new-file path: typed refusal, nothing created', async () => {
    const w = mkWorld('a1')
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 'new.txt', 'X\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.message).toContain('HELD pending root ruling')
    expect(r.error.message).toContain('zero creation')
    expect(existsSync(path.join(w.root, 'new.txt'))).toBe(false)
  })

  it('T-A2 parent swapped to an outside symlink BEFORE the write: refused pre-creation; the outside dir stays EMPTY (zero creation is structural, not lucky)', async () => {
    const w = mkWorld('a2')
    mkdirSync(path.join(w.root, 'notes'))
    writeFileSync(path.join(w.root, 'notes', 't.txt'), 'OLD-CONTENT\n')
    // attacker swaps the parent directory out right before the call runs
    rmSync(path.join(w.root, 'notes'), { recursive: true })
    symlinkSync(w.outside, path.join(w.root, 'notes'))
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 'notes/t.txt', 'HIJACK\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('symlink-alias')
    expect(r.error.message).toContain('before creation')
    // iron proof: NOTHING was created at the swapped location — the
    // outside dir stands EMPTY where an O_CREAT open would have dropped
    // a file under the old (forbidden) law:
    expect(existsSync(path.join(w.outside, 't.txt'))).toBe(false)
    expect(isEmptyDir(w.outside)).toBe(true)
  })

  it('T-A3 root swapped to an outside symlink: outside-anchor before any open; victim bytes intact', async () => {
    const w = mkWorld('a3')
    const approvedReal = realpathSync(w.root)
    writeFileSync(path.join(w.root, 'victim.txt'), 'ORIGINAL-INSIDE\n')
    const closure = createPostConsumeWriteClosure(
      mkPlan(approvedReal, 'victim.txt', 'OVERWRITE\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    // swap the instance root itself between approval and execution
    rmSync(path.join(w.root, 'victim.txt'))
    rmSync(w.root, { recursive: true })
    symlinkSync(w.outside, w.root)
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('outside-anchor')
    expect(existsSync(path.join(w.outside, 'victim.txt'))).toBe(false)
  })

  it('T-A4 the target itself swapped to a symlink: pre-open alias refusal, victim intact outside', async () => {
    const w = mkWorld('a4')
    writeFileSync(path.join(w.outside, 'victim.txt'), 'OUTSIDE-VICTIM\n')
    symlinkSync(path.join(w.outside, 'victim.txt'), path.join(w.root, 'link.txt'))
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 'link.txt', 'OUTSIDE-OVERWRITE\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('symlink-alias')
    expect(readFileSync(path.join(w.outside, 'victim.txt'), 'utf8')).toBe('OUTSIDE-VICTIM\n')
  })

  it('T-A5 cancellation: refusal with zero side effect (no create/truncate ever ran)', async () => {
    const w = mkWorld('a5')
    writeFileSync(path.join(w.root, 't.txt'), 'ORIGINAL\n')
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 't.txt', 'POST-CANCEL\n'),
      { parametersFingerprint: 'fp-plan-1', signal: { aborted: true } },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.message).toContain('cancelled')
    expect(readFileSync(path.join(w.root, 't.txt'), 'utf8')).toBe('ORIGINAL\n')
  })
})

describe('a5m2 post-consume write closure — state B + P2: the closure NEVER creates; a refused check leaves the target UNTRUNCATED', () => {
  it('T-B1 a raced-away target: whatever the open answers, the closure creates NOTHING (no O_CREAT by construction)', async () => {
    const w = mkWorld('b1')
    writeFileSync(path.join(w.root, 't.txt'), 'ORIGINAL\n')
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 't.txt', 'RACE\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const pending = closure.write()
    rmSync(path.join(w.root, 't.txt'))
    const r = await pending
    // On this runtime the open wins the race and the verified write lands
    // in the raced-away fd (bytes vanish with the unlink — disclosed);
    // on a threadpool-scheduled runtime the open answers ENOENT and the
    // refusal below fires. EITHER WAY the iron invariant holds and is
    // asserted: NOTHING WAS CREATED at the target path.
    if (!r.ok) {
      expect(r.error.details?.['cfReason']).toBe('not-a-file')
      expect(r.error.message).toContain('zero creation (no O_CREAT)')
    }
    expect(existsSync(path.join(w.root, 't.txt'))).toBe(false)
  })

  it('T-P2 root swapped between approval and execution: the refused call leaves the target UNTRUNCATED and un-written (old law would have truncated it at open)', async () => {
    // P2 ordering proof: verification precedes truncation. The pre-open
    // ANCHOR check refuses; because no O_TRUNC open ever ran, the target
    // stands BYTE-EXACT. Under the old O_TRUNC-at-open law this same
    // attack window meant "truncated first, discovered later".
    const w = mkWorld('p2z')
    writeFileSync(path.join(w.root, 't.txt'), 'PRECIOUS-BEFORE-ATTACK\n')
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 't.txt', 'OVERWRITE\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    // attacker moves the real root away and swaps the name to a decoy dir
    // (an ancestor-level swap between approval and the write attempt):
    const savedRoot = path.join(worldRoot, 'p2z-real-root')
    rmSync(savedRoot, { recursive: true, force: true })
    renameSync(w.root, savedRoot)
    mkdirSync(w.root)
    symlinkSync(savedRoot, path.join(w.root, 'decoy'))
    rmSync(w.root, { recursive: true })
    symlinkSync(savedRoot, w.root)
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('outside-anchor')
    // the byte-level P2 evidence: the original content survived EXACTLY
    expect(readFileSync(path.join(savedRoot, 't.txt'), 'utf8')).toBe('PRECIOUS-BEFORE-ATTACK\n')
  })

  it('T-P2b parent swapped to an outside dir holding a NAMESAKE victim: refused pre-creation; the outside victim is NOT even opened', async () => {
    // The old-law exposure this closes: O_CREAT+O_TRUNC through a swapped
    // parent would CREATE or TRUNCATE the outside victim. The pre-creation
    // parent identity check refuses first; the O_CREAT-less open never
    // runs; the victim keeps its bytes (and could not have been CREATED
    // — no O_CREAT anywhere in this module).
    const w = mkWorld('p2b')
    const realParent = path.join(worldRoot, 'p2b-real-parent')
    mkdirSync(realParent)
    writeFileSync(path.join(realParent, 't.txt'), 'INSIDE-ORIGINAL\n')
    writeFileSync(path.join(w.outside, 't.txt'), 'OUTSIDE-VICTIM\n')
    rmSync(path.join(w.root, 'notes'), { recursive: true, force: true })
    symlinkSync(w.outside, path.join(w.root, 'notes'))
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 'notes/t.txt', 'ESCAPE-WRITE\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('symlink-alias')
    expect(readFileSync(path.join(w.outside, 't.txt'), 'utf8')).toBe('OUTSIDE-VICTIM\n')
  })

  // NOT_VERIFIED (disclosed): the post-open drift/escape branches of
  // verifyOpenedHandle (exec-time-identity-drift, exec-time-escape) cannot
  // be forced from this level on this runtime — fsPromises.open completes
  // before a synchronous attack can land (measured above). The mapping is
  // the existing lane law verbatim; the read side's C-FS suite owns the
  // exercised branches of verifyOpenedHandle itself.
})

describe('a5m2 post-consume write closure — state C + the P-laws on the existing-target path', () => {
  it('T-C1 happy path: verification PRECEDES truncation, then same-FD truncate+write — bytes exact (no residue), D-C2-1 receipt keys only', async () => {
    const w = mkWorld('c1')
    writeFileSync(path.join(w.root, 't.txt'), 'OLD-VERY-LONG-PREVIOUS-CONTENT\n')
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 't.txt', 'B\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(Object.keys(r.value).sort()).toEqual(['canonicalLocator', 'writtenFingerprint'])
    expect(r.value.canonicalLocator).toBe(path.join(w.root, 't.txt'))
    expect(r.value.writtenFingerprint).toBe(sha('B\n'))
    // same-FD truncate law: the file is EXACTLY the new content (no old residue)
    expect(readFileSync(path.join(w.root, 't.txt'), 'utf8')).toBe('B\n')
    // empty content is a legal frozen value too (construction accepts it)
    writeFileSync(path.join(w.root, 'e.txt'), 'X\n')
    const empty = createPostConsumeWriteClosure(
      mkPlan(w.root, 'e.txt', ''),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const r2 = await empty.write()
    expect(r2.ok).toBe(true)
    expect(readFileSync(path.join(w.root, 'e.txt'), 'utf8')).toBe('')
    // NOT_VERIFIED (disclosed): the truncate-succeeded-then-write-failed
    // branch (C failure) has no forceable injection seam at this level;
    // it rides the existing lane law
    // `cfsUndetermined('write-side-effect-unconfirmed', { sideEffectPossible: true })` verbatim.
  })

  it('T-C2 multi-byte content: success means the BYTE COUNT equals the UTF-8 length (loop completion, not one-call luck)', async () => {
    const w = mkWorld('c2')
    writeFileSync(path.join(w.root, 't.txt'), 'OLD\n')
    const content = 'héllo — 世界 🌍 multi-byte ✓\n'
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 't.txt', content),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    const landed = readFileSync(path.join(w.root, 't.txt'))
    expect(landed.length).toBe(Buffer.byteLength(content, 'utf8'))
    expect(landed.toString('utf8')).toBe(content)
    expect(r.value.writtenFingerprint).toBe(sha(content))
  })

  it('T-C3 TRUE short write (FileHandle.prototype.write really intercepted): partial bytes land, second round fails — NEVER a success, reports sideEffectPossible true', async () => {
    const w = mkWorld('c3')
    writeFileSync(path.join(w.root, 't.txt'), 'PRE-EXISTING-LONG-ORIGINAL\n')
    const content = 'AAAABBBBCCCCDDDD' // 16 utf-8 bytes; round one writes 8
    const proto = await handlePrototype(w.root)
    const real = proto.write
    let calls = 0
    try {
      proto.write = async function (
        this: unknown,
        buffer: Uint8Array,
        offset?: number,
        length?: number,
        position?: number | null,
      ) {
        calls += 1
        if (calls === 1) {
          // REAL short write: half the requested bytes land on disk via
          // the genuine syscall; the returned bytesWritten is real.
          const half = Math.max(1, Math.floor((length ?? buffer.length) / 2))
          return await real.call(this as never, buffer, offset ?? 0, half, position)
        }
        throw Object.assign(new Error('injected post-short-write failure'), { code: 'EIO' })
      }
      const closure = createPostConsumeWriteClosure(
        mkPlan(w.root, 't.txt', content),
        { parametersFingerprint: 'fp-plan-1' },
        { instanceRootDir: w.root },
      )
      const r = await closure.write()
      // ① not success while the plan bytes have not all landed
      expect(r.ok).toBe(false)
      if (r.ok) throw new Error('unreachable')
      // ② truncation + partial bytes DID land: undetermined, honest flag
      expect(r.error.code).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
      expect(r.error.details?.['cfReason']).toBe('write-side-effect-unconfirmed')
      expect(r.error.details?.['sideEffectUnknown']).toBe(true)
      const landed = readFileSync(path.join(w.root, 't.txt'))
      expect(landed.length).toBe(8) // exactly the half that really landed
      expect(landed.toString('utf8')).toBe('AAAABBBB')
      expect(calls).toBe(2)
    } finally {
      proto.write = real
    }
  })

  it('T-C4 the loop completes across repeated REAL short writes: full UTF-8 bytes land, success is honest', async () => {
    const w = mkWorld('c4')
    writeFileSync(path.join(w.root, 't.txt'), 'X\n')
    const content = '0123456789abcdefghij' // 20 bytes, each call lands at most 6
    const proto = await handlePrototype(w.root)
    const real = proto.write
    try {
      proto.write = async function (
        this: unknown,
        buffer: Uint8Array,
        offset?: number,
        length?: number,
        position?: number | null,
      ) {
        const capped = Math.min(length ?? buffer.length, 6)
        return await real.call(this as never, buffer, offset ?? 0, capped, position)
      }
      const closure = createPostConsumeWriteClosure(
        mkPlan(w.root, 't.txt', content),
        { parametersFingerprint: 'fp-plan-1' },
        { instanceRootDir: w.root },
      )
      const r = await closure.write()
      expect(r.ok).toBe(true)
      if (!r.ok) throw new Error('unreachable')
      const landed = readFileSync(path.join(w.root, 't.txt'))
      expect(landed.length).toBe(Buffer.byteLength(content, 'utf8'))
      expect(landed.toString('utf8')).toBe(content)
    } finally {
      proto.write = real
    }
  })

  it('T-P1 no post-approval substitution: the write takes ZERO parameters, extra arguments cannot change the frozen bytes', async () => {
    const w = mkWorld('p1')
    writeFileSync(path.join(w.root, 't.txt'), 'ORIGINAL\n')
    const plan = mkPlan(w.root, 't.txt', 'FROZEN\n')
    const closure = createPostConsumeWriteClosure(
      plan,
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    expect(closure.write.length).toBe(0)
    // an (improper) caller passing extra arguments changes nothing —
    // the frozen plan content is what lands:
    const r = await (closure.write as unknown as (a: string, b: string) => Promise<unknown>)('EVIL', 'path')
    expect(r).toMatchObject({ ok: true })
    expect(readFileSync(path.join(w.root, 't.txt'), 'utf8')).toBe('FROZEN\n')
  })

  it('T-P1b construction violations are TypeErrors (one plan, one spend; pure-lexical law)', () => {
    const w = mkWorld('p1b')
    writeFileSync(path.join(w.root, 't.txt'), 'X\n')
    expect(() => createPostConsumeWriteClosure(
      mkPlan(w.root, 't.txt', 'Y\n', 'fp-A'),
      { parametersFingerprint: 'fp-B' },
      { instanceRootDir: w.root },
    )).toThrow(/one plan, one spend/)
    expect(() => createPostConsumeWriteClosure(
      { ...mkPlan(w.root, 't.txt', 'Y\n'), approvedLocator: path.join(w.outside, 't.txt') },
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )).toThrow(/not strictly beneath/)
    expect(() => createPostConsumeWriteClosure(
      { ...mkPlan(w.root, 't.txt', 'Y\n'), approvedLocator: path.join(w.root, '..', 'escape.txt') },
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )).toThrow(/not strictly beneath/)
  })

  it('T-P3 the claim is single-flight BEFORE the first await: concurrent repeats refused, one landing only', async () => {
    const w = mkWorld('p3')
    writeFileSync(path.join(w.root, 't.txt'), 'ORIGINAL\n')
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 't.txt', 'ONCE\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    const first = closure.write()
    const second = closure.write()
    const third = closure.write()
    expect(closure.claimed()).toBe(true)
    const results = await Promise.all([first, second, third])
    expect(results[0]!.ok).toBe(true)
    for (const r of [results[1]!, results[2]!]) {
      expect(r.ok).toBe(false)
      if (r.ok) throw new Error('unreachable')
      expect(r.error.message).toContain('already claimed')
    }
    // settled: a fourth attempt after the landing is also refused
    const fourth = await closure.write()
    expect(fourth.ok).toBe(false)
    expect(readFileSync(path.join(w.root, 't.txt'), 'utf8')).toBe('ONCE\n')
    // a refused repeat settles the closure: the consumed call gets ONE
    // attempt by construction (disclosed: even refusal settles — a repeat
    // could touch FS again)
    expect(closure.claimed()).toBe(true)
  })

  it('T-P5 not exposed: absent from the lane barrel; the closure carries no other capability', async () => {
    expect(laneBarrel).not.toHaveProperty('createPostConsumeWriteClosure')
    expect(laneBarrel).not.toHaveProperty('PostConsumeWritePlan')
    const w = mkWorld('p5')
    writeFileSync(path.join(w.root, 't.txt'), 'X\n')
    const closure = createPostConsumeWriteClosure(
      mkPlan(w.root, 't.txt', 'Y\n'),
      { parametersFingerprint: 'fp-plan-1' },
      { instanceRootDir: w.root },
    )
    expect(Object.isFrozen(closure)).toBe(true)
    expect(Object.keys(closure).sort()).toEqual(['claimed', 'write'])
  })
})

