/**
 * A5-M2 FS-EDIT card (2026-10-25) — C1 for the post-consume EDIT closure
 * (`packages/runtime/controlled-fs/src/post-consume-edit.ts`) and the B-EDIT
 * grammar leaf. M-02's pre-booked line governs the whole family: "`edit`/
 * `replace` 另需 read effect；配对 read effect 走同一受治理读臂, 不得另起弱
 * 读面" — this row ships that read effect IN the approval, and the closure's
 * own bound-fd read is the paired read leg.
 *
 * What each leg proves against a REAL filesystem (worlds under
 * `tests/homes/`, TEST_METHODS §7, torn down; no Host, no ports):
 *   E1  a real single replacement: bytes change on disk, the receipt is
 *       EXACTLY {canonicalLocator, before, after} (the echo pair rides under
 *       the paired read effect — the native output face);
 *   E2  the edit NEVER creates: an absent target refuses `not-a-file` and
 *       zero creation is asserted;
 *   E3  `old_string` absent refuses "did not appear verbatim" — the file is
 *       byte-intact (asserted by re-read, the write row's discipline);
 *   E4  multiple occurrences without replace_all refuse with the 1-based
 *       line list — bytes intact;
 *   E5  replace_all replaces EVERY occurrence (and only those);
 *   E6  a symlink at the target name refuses `symlink-alias`; the outside
 *       file it points at is byte-intact;
 *   E7  single flight (P3): the second call refuses `grant-consumed`;
 *   E8  cancellation before the truncate (counting-getter seam, the exact
 *       check) refuses with the file byte-intact — zero side effect is the
 *       TRUTH here, asserted;
 *   E9  cancellation at the write loop lands AFTER the truncate: the loss
 *       is reported honestly (undetermined, sideEffectPossible, the file
 *       truncated to zero bytes — asserted by re-stat);
 *   E10 the root swapped AFTER the plan froze refuses at the ANCHOR law;
 *       the outside file stays byte-intact;
 *   E11 non-UTF-8 bytes refuse the strict decode; bytes untouched;
 *   E12 the closure is a PRIVATE executor: it rides no public barrel.
 *
 * Disclosed NOT_VERIFIED: a mid-loop chunk failure race (no fault seam; the
 * loop law is the reviewed r16 closure's verbatim); a real concurrent writer
 * between read and truncate (the fd-identity law is code-reviewed, the race
 * needs an inotify harness).
 *
 * @module packages/runtime/test/a5m2-edit-c1
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { createPostConsumeEditClosure } from '../controlled-fs/src/post-consume-edit.js'
// the write-handoff spec's precedent (a5m2-write-handoff-c1.test.ts:249):
// the governed .mjs family module is loaded through the URL form and cast —
// the arm's surface is pinned BY these tests, not by a declaration file.
const EDIT_MOD = (await import(new URL('../src/plugin/live/governed-families/edit.mjs', import.meta.url).href)) as {
  createGovernedEditArm: (deps: Record<string, unknown>) => {
    classify: (args: Record<string, unknown>, exec: unknown, callId: string) => any
    prepare: (plan: any, grant: unknown) => any
    execute: (plan: any, consumed: unknown) => Promise<any>
    cancel: (plan: any) => any
    drain: () => void
  }
}
const createGovernedEditArm = EDIT_MOD.createGovernedEditArm
import { validatePaFamilyTarget } from '../control/types.js'
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

interface EditPlan {
  readonly approvedRootLexical: string
  readonly approvedRootReal: string
  readonly approvedLocator: string
  readonly oldString: string
  readonly newString: string
  readonly replaceAll: boolean
  readonly planFingerprint: string
}

function mkPlan(root: string, rel: string, oldString: string, newString: string, replaceAll = false): EditPlan {
  return Object.freeze({
    approvedRootLexical: root,
    approvedRootReal: realpathSync(root),
    approvedLocator: path.join(root, rel),
    oldString,
    newString,
    replaceAll,
    planFingerprint: 'fp-edit-plan-1',
  })
}

/** Counting cancellation seam (the create spec's D-leg law, mirrored):
 *  every isAborted read advances; abortFromRead is the FIRST read that
 *  answers true. Edit check order: (1) top, (2) pre-open, (3) pre-truncate,
 *  (4..) before every write chunk. */
function countingSignal(abortFromRead: number): { readonly aborted: boolean } {
  let reads = 0
  return { get aborted() { reads += 1; return reads >= abortFromRead } }
}

beforeAll(() => {
  worldRoot = path.join(repoRoot, 'tests', 'homes', `m2pec-${runId}`)
  mkdirSync(worldRoot, { recursive: true })
})

afterAll(() => {
  rmSync(worldRoot, { recursive: true, force: true })
})

describe('A5M2 B-EDIT post-consume closure (real FS, author-side)', () => {
  it('E1 a real replacement lands; the receipt is EXACTLY {canonicalLocator,before,after}', async () => {
    const w = mkWorld('e1')
    writeFileSync(path.join(w.root, 'notes.md'), 'alpha\nbeta\ngamma\n', 'utf8')
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'notes.md', 'beta', 'BETA-2'),
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(Object.keys(r.value).sort()).toEqual(['after', 'before', 'canonicalLocator'])
    expect(r.value.canonicalLocator).toBe(path.join(w.root, 'notes.md'))
    expect(r.value.before).toBe('alpha\nbeta\ngamma\n')
    expect(r.value.after).toBe('alpha\nBETA-2\ngamma\n')
    expect(readFileSync(path.join(w.root, 'notes.md'), 'utf8')).toBe('alpha\nBETA-2\ngamma\n')
  })

  it('E2 the edit NEVER creates: absent target refuses not-a-file with zero creation', async () => {
    const w = mkWorld('e2')
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'ghost.md', 'x', 'y'),
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('not-a-file')
    expect(r.error.message).toContain('NEVER creates')
    expect(existsSync(path.join(w.root, 'ghost.md'))).toBe(false)
  })

  it('E3 old_string absent refuses "did not appear verbatim"; bytes byte-intact', async () => {
    const w = mkWorld('e3')
    writeFileSync(path.join(w.root, 'a.txt'), 'one two\n', 'utf8')
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'a.txt', 'absent', 'X'),
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.message).toContain('did not appear verbatim')
    expect(readFileSync(path.join(w.root, 'a.txt'), 'utf8')).toBe('one two\n')
  })

  it('E4 multiple occurrences without replace_all refuse with the 1-based line list; bytes intact', async () => {
    const w = mkWorld('e4')
    writeFileSync(path.join(w.root, 'b.txt'), 'dup\nx\ndup\n', 'utf8')
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'b.txt', 'dup', 'D'),
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.message).toContain('lines [1, 3]')
    expect(r.error.message).toContain('replace_all is false')
    expect(readFileSync(path.join(w.root, 'b.txt'), 'utf8')).toBe('dup\nx\ndup\n')
  })

  it('E5 replace_all replaces every occurrence and only those', async () => {
    const w = mkWorld('e5')
    writeFileSync(path.join(w.root, 'c.txt'), 'aa bb aa cc aa\n', 'utf8')
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'c.txt', 'aa', 'ZZ', true),
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(true)
    expect(readFileSync(path.join(w.root, 'c.txt'), 'utf8')).toBe('ZZ bb ZZ cc ZZ\n')
  })

  it('E6 a symlink at the target name refuses symlink-alias; the outside file is byte-intact', async () => {
    const w = mkWorld('e6')
    const victim = path.join(w.outside, 'victim.txt')
    writeFileSync(victim, 'target me not\n', 'utf8')
    symlinkSync(victim, path.join(w.root, 'link.txt'))
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'link.txt', 'not', 'NOW'),
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('symlink-alias')
    expect(readFileSync(victim, 'utf8')).toBe('target me not\n')
  })

  it('E7 single flight (P3): the repeat refuses grant-consumed with zero FS', async () => {
    const w = mkWorld('e7')
    writeFileSync(path.join(w.root, 'd.txt'), 'a\n', 'utf8')
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'd.txt', 'a', 'b'),
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: w.root },
    )
    expect((await closure.write()).ok).toBe(true)
    const second = await closure.write()
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('unreachable')
    expect(second.error.details?.['cfReason']).toBe('grant-consumed')
    expect(readFileSync(path.join(w.root, 'd.txt'), 'utf8')).toBe('b\n')
  })

  it('E8 cancellation before the truncate refuses with the file BYTE-INTACT (zero is the truth, asserted)', async () => {
    const w = mkWorld('e8')
    writeFileSync(path.join(w.root, 'e.txt'), 'keep\n', 'utf8')
    // reads: (1) top ok, (2) pre-open ok, (3) pre-truncate -> abort
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'e.txt', 'keep', 'gone'),
      { parametersFingerprint: 'fp-edit-plan-1', signal: countingSignal(3) },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('effect-outside-grant')
    expect(r.error.message).toContain('before the truncate')
    expect(readFileSync(path.join(w.root, 'e.txt'), 'utf8')).toBe('keep\n')
  })

  it('E9 cancellation at the write loop lands AFTER the truncate — reported as a real effect, never zero', async () => {
    const w = mkWorld('e9')
    writeFileSync(path.join(w.root, 'f.txt'), 'original bytes here\n', 'utf8')
    // reads: (1)(2)(3) pass, (4) = the write-loop check -> abort AFTER truncate
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'f.txt', 'original bytes here', 'replacement'),
      { parametersFingerprint: 'fp-edit-plan-1', signal: countingSignal(4) },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('write-side-effect-unconfirmed')
    expect(r.error.details?.['sideEffectUnknown']).toBe(true)
    // the truncate DID run: asserted by re-stat (the loss is the truth)
    expect(readFileSync(path.join(w.root, 'f.txt'), 'utf8')).toBe('')
  })

  it('E10 root swapped to an outside symlink AFTER the plan froze refuses at the ANCHOR law; outside byte-intact', async () => {
    const w = mkWorld('e10')
    const realRoot = path.join(w.root, 'real')
    mkdirSync(realRoot)
    writeFileSync(path.join(realRoot, 'g.txt'), 'hold\n', 'utf8')
    const plan = mkPlan(realRoot, 'g.txt', 'hold', 'stolen')
    rmSync(realRoot, { recursive: true, force: true })
    symlinkSync(w.outside, realRoot)
    const closure = createPostConsumeEditClosure(
      plan,
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: realRoot },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('outside-anchor')
    expect(existsSync(path.join(w.outside, 'g.txt'))).toBe(false)
  })

  it('E11 non-UTF-8 bytes refuse the strict decode; bytes untouched', async () => {
    const w = mkWorld('e11')
    const target = path.join(w.root, 'bin.dat')
    writeFileSync(target, Buffer.from([0xff, 0xfe, 0x00, 0x41]))
    const closure = createPostConsumeEditClosure(
      mkPlan(w.root, 'bin.dat', 'A', 'B'),
      { parametersFingerprint: 'fp-edit-plan-1' },
      { instanceRootDir: w.root },
    )
    const r = await closure.write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('path-rejected')
    expect([...readFileSync(target)].join(',')).toBe('255,254,0,65')
  })

  it('E12 the closure is a PRIVATE executor: it rides no public barrel', () => {
    const barrel = laneBarrel as Record<string, unknown>
    expect(barrel['createPostConsumeEditClosure']).toBeUndefined()
    expect(barrel['post-consume-edit']).toBeUndefined()
  })
})

describe('A5M2 B-EDIT arm (classify purity, M-02 effects, pairing)', () => {
  const binding = { bindingId: 'b-1', bindingRevision: 3, policyGeneration: 5, authorityGeneration: 7 }
  const execFor = () => ({ agent: { id: 'member-1', session: { header: { id: 'sess-1' } } } })
  function mkArm(root: string) {
    return createGovernedEditArm({
      definitionIdentity: 'def-edit-1',
      providerId: 'prov-1',
      realmId: 'realm-1',
      memberAgentId: 'member-1',
      sessionHeaderId: 'sess-1',
      instanceRootDir: root,
      bindingFacts: () => ({ ...binding }),
    })
  }

  it('T1 the happy classify: the effect set is EXACTLY I + R(read exact file) + F(write exact file), and the shipped manifest passes the B-EDIT leaf', () => {
    const w = mkWorld('t1')
    const arm = mkArm(w.root)
    const c = arm.classify({ file_path: 'notes.md', old_string: 'a', new_string: 'b' }, execFor(), 'call-1')
    expect(c.ok).toBe(true)
    expect(c.effects.map((e: { kind: string }) => e.kind)).toEqual(['tool-invoke', 'read', 'write'])
    const loc = path.join(w.root, 'notes.md')
    expect(c.effects[1].resource.canonicalLocator).toBe(loc)
    expect(c.effects[2].resource.canonicalLocator).toBe(loc)
    expect(c.effects[1].resource.rights).toEqual(['read'])
    expect(c.effects[2].resource.rights).toEqual(['write'])
    expect(validatePaFamilyTarget('B-EDIT', c.reviewPayload.targetManifest)).toBeUndefined()
    expect(c.reviewPayload.targetManifest.readEffectLaw).toContain('另需 read effect')
    expect(c.reviewPayload.targetManifest.creationPossible).toBe(false)
  })

  it('T2 classify is pure law: escalation fields, unknown params, blank/identical strings, absolute escapes and foreign sessions all refuse typed (zero FS)', () => {
    const w = mkWorld('t2')
    const arm = mkArm(w.root)
    const base = { file_path: 'x.md', old_string: 'a', new_string: 'b' }
    expect(arm.classify({ ...base, sandbox_permissions: 'danger-full-access' }, execFor(), 'c').code).toContain('UNKNOWN_PARAMETER')
    expect(arm.classify({ ...base, justification: 'please' }, execFor(), 'c').code).toContain('UNKNOWN_PARAMETER')
    expect(arm.classify({ ...base, extra: 1 }, execFor(), 'c').code).toContain('UNKNOWN_PARAMETER')
    expect(arm.classify({ ...base, old_string: '' }, execFor(), 'c').code).toContain('INVALID_ARGUMENTS')
    expect(arm.classify({ ...base, old_string: 'a', new_string: 'a' }, execFor(), 'c').code).toContain('INVALID_ARGUMENTS')
    expect(arm.classify({ ...base, replace_all: 'yes' }, execFor(), 'c').code).toContain('INVALID_ARGUMENTS')
    expect(arm.classify({ ...base, file_path: '/etc/passwd' }, execFor(), 'c').code).toContain('ANCHOR_ESCAPE')
    expect(arm.classify({ ...base, file_path: '../escape.md' }, execFor(), 'c').code).toContain('ANCHOR_ESCAPE')
    expect(arm.classify(base, { agent: { id: 'other', session: { header: { id: 'sess-1' } } } }, 'c').code).toContain('FOREIGN_SESSION')
    expect(existsSync(path.join(w.root, 'x.md'))).toBe(false)
  })

  it('T3 execute answers ONLY to the real consumed proof paired to this plan', async () => {
    const w = mkWorld('t3')
    writeFileSync(path.join(w.root, 'p.txt'), 'a\n', 'utf8')
    const arm = mkArm(w.root)
    const c = arm.classify({ file_path: 'p.txt', old_string: 'a', new_string: 'b' }, execFor(), 'call-3')
    expect((await arm.execute(c.plan, { consumed: false })).code).toContain('NOT_ADMITTED')
    expect(arm.prepare(c.plan, { grantId: 'g-3' }).ok).toBe(true)
    expect((await arm.execute(c.plan, { consumed: true, grant: { grantId: 'g-1', callId: c.plan.callId, parametersFingerprint: 'sha256:wrong', bindingId: binding.bindingId, bindingRevision: binding.bindingRevision } })).code).toContain('GRANT_MISMATCH')
    expect((await arm.execute(c.plan, { consumed: true, grant: { grantId: 'g-1', callId: c.plan.callId, parametersFingerprint: c.parametersFingerprint, bindingId: 'other-binding', bindingRevision: binding.bindingRevision } })).code).toContain('GRANT_MISMATCH')
    // nothing ran: bytes untouched through all three refusals
    expect(readFileSync(path.join(w.root, 'p.txt'), 'utf8')).toBe('a\n')
  })

  it('T4 the paired consumed proof runs the REAL edit once and returns the echo receipt; repeats refuse', async () => {
    const w = mkWorld('t4')
    writeFileSync(path.join(w.root, 'q.txt'), 'alpha beta\n', 'utf8')
    const arm = mkArm(w.root)
    const c = arm.classify({ file_path: 'q.txt', old_string: 'beta', new_string: 'GAMMA' }, execFor(), 'call-4')
    expect(arm.prepare(c.plan, { grantId: 'g-9' }).ok).toBe(true)
    const grant = { grantId: 'g-9', callId: c.plan.callId, parametersFingerprint: c.parametersFingerprint, bindingId: binding.bindingId, bindingRevision: binding.bindingRevision }
    const ran = await arm.execute(c.plan, { consumed: true, grant })
    expect(ran.ok).toBe(true)
    expect(ran.value.before).toBe('alpha beta\n')
    expect(ran.value.after).toBe('alpha GAMMA\n')
    expect(readFileSync(path.join(w.root, 'q.txt'), 'utf8')).toBe('alpha GAMMA\n')
    expect((await arm.execute(c.plan, { consumed: true, grant })).code).toContain('ALREADY_CONSUMED')
  })

  it('T5 cancel before the edge reports the honest zero; drain stops new calls', async () => {
    const w = mkWorld('t5')
    const arm = mkArm(w.root)
    const c = arm.classify({ file_path: 'r.txt', old_string: 'a', new_string: 'b' }, execFor(), 'call-5')
    expect(arm.cancel(c.plan)).toMatchObject({ ok: true, settled: 'CANCELLED' })
    expect((await arm.execute(c.plan, { consumed: true, grant: { grantId: 'g', callId: c.plan.callId, parametersFingerprint: c.parametersFingerprint, bindingId: binding.bindingId, bindingRevision: binding.bindingRevision } })).code).toContain('CANCELLED')
    arm.drain()
    expect(arm.classify({ file_path: 'r.txt', old_string: 'a', new_string: 'b' }, execFor(), 'call-6').code).toContain('DRAINING')
  })
})

describe('A5M2 B-EDIT grammar leaf (control/types.ts)', () => {
  const B_EDIT_REAL = {
    familyId: 'B-EDIT',
    adapterRevision: 1,
    operation: 'edit-file',
    realmId: 'realm-1',
    canonicalTarget: '/root/notes.md',
    oldFingerprint: 'sha256:aaaa',
    newFingerprint: 'sha256:bbbb',
    replaceAll: false,
    creationPossible: false,
    editFileLaw: 'read-verify-replace THROUGH ONE bound O_RDWR|O_NOFOLLOW fd inside the frozen anchor (verify-before-truncate class; 0 occurrences refuse "did not appear verbatim"; multiple refuse unique-law unless replace_all; the edit NEVER creates)',
    readEffectLaw: 'M-02 pre-booked law (verbatim): "edit/replace 另需 read effect；配对 read effect 走同一受治理读臂, 不得另起弱读面" — the read leg runs inside THIS approved closure on the bound fd',
    echoLaw: 'the receipt before/after echo rides ONLY under the paired READ effect on this exact locator; a write-only grant never carries those bytes',
  }

  it('the shipped-shape manifest passes the leaf', () => {
    expect(validatePaFamilyTarget('B-EDIT', B_EDIT_REAL)).toBeUndefined()
  })

  it('a missing paired-read law-fact refuses (the M-02 increment is REQUIRED, not decorative)', () => {
    const { readEffectLaw: _gone, ...rest } = B_EDIT_REAL
    expect(validatePaFamilyTarget('B-EDIT', rest)).toBeDefined()
  })

  it('a wrong-typed replaceAll refuses', () => {
    expect(validatePaFamilyTarget('B-EDIT', { ...B_EDIT_REAL, replaceAll: 'false' })).toBeDefined()
  })

  it('an unknown extra key refuses (closed set)', () => {
    expect(validatePaFamilyTarget('B-EDIT', { ...B_EDIT_REAL, escalation: true })).toBeDefined()
  })
})
