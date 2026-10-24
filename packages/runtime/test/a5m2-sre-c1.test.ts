/**
 * A5-M2 FS-EDIT card — C1 for the post-consume str_replace_editor closure
 * (four governed branches on a REAL filesystem; worlds under tests/homes/,
 * TEST_METHODS §7, torn down; no Host, no ports).
 *
 * The branch laws pinned (native bodies @639ed01539 as the semantic
 * source, the shipped family closures as the governance source):
 *   S1  view: the native numbered view lands, bytes untouched (pure read);
 *   S2  view_range subset + the native bounds words; view_range on a
 *       directory refuses;
 *   S3  view of a directory: the 2-level listing, filters, codepoint sort;
 *   S4  truncation at the configured budget with the host suffix;
 *   S5  create: the delegated create law lands the file (createdNew,
 *       fingerprint, native success words);
 *   S6  create over an existing target LOSES (the O_EXCL law answers the
 *       native "cannot overwrite" rule), bytes untouched;
 *   S7  str_replace: unique success, native words, real bytes;
 *   S8  str_replace: 0 occurrences and multiple occurrences refuse with
 *       the native wording, bytes untouched;
 *   S9  str_replace newStr null refuses at construction (typed, zero FS);
 *   S10 insert: the splice lands; out-of-range insert_line answers the
 *       native bounds message; bytes asserted;
 *   S11 single flight (P3);
 *   S12 the closure is a PRIVATE executor (no barrel);
 *   S13 cancellation before the truncate: zero, asserted byte-intact.
 *
 * @module packages/runtime/test/a5m2-sre-c1
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { createPostConsumeSreClosure } from '../controlled-fs/src/post-consume-sre.js'
import type { PostConsumeSrePlan } from '../controlled-fs/src/post-consume-sre.js'
import * as laneBarrel from '../controlled-fs/src/index.js'

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
let worldRoot = ''

function mkWorld(name: string): { root: string } {
  const root = mkdtempSync(path.join(worldRoot, `${name}-`))
  return { root }
}

function mkPlan(root: string, rel: string, over: Partial<PostConsumeSrePlan> = {}): PostConsumeSrePlan {
  return Object.freeze({
    approvedRootLexical: root,
    approvedRootReal: realpathSync(root),
    approvedLocator: path.join(root, rel),
    command: 'view' as const,
    fileText: null,
    oldStr: null,
    newStr: null,
    insertLine: null,
    viewRange: null,
    planFingerprint: 'fp-sre-plan-1',
    ...over,
  })
}

function countingSignal(abortFromRead: number): { readonly aborted: boolean } {
  let reads = 0
  return { get aborted() { reads += 1; return reads >= abortFromRead } }
}

beforeAll(() => {
  worldRoot = path.join(repoRoot, 'tests', 'homes', `m2sre-${runId}`)
  mkdirSync(worldRoot, { recursive: true })
})

afterAll(() => {
  rmSync(worldRoot, { recursive: true, force: true })
})

describe('A5M2 B-SRE post-consume closure (real FS, author-side)', () => {
  it('S1 view: the native numbered view lands over a real read; bytes untouched', async () => {
    const w = mkWorld('s1')
    const target = path.join(w.root, 'a.txt')
    writeFileSync(target, 'one\ntwo\nthree\n', 'utf8')
    const r = await createPostConsumeSreClosure(mkPlan(w.root, 'a.txt'), {}, { instanceRootDir: w.root }).write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(r.value.rendered).toContain(`Here's the content of ${target} with line numbers (which has a total of 4 lines)`)
    expect(r.value.rendered).toContain('     2  two')
    expect(readFileSync(target, 'utf8')).toBe('one\ntwo\nthree\n')
  })

  it('S2 view_range subset works; the native bounds words fire off-range; a directory refuses view_range', async () => {
    const w = mkWorld('s2')
    writeFileSync(path.join(w.root, 'b.txt'), 'l1\nl2\nl3\n', 'utf8')
    const ok = await createPostConsumeSreClosure(mkPlan(w.root, 'b.txt', { viewRange: [2, 3] }), {}, { instanceRootDir: w.root }).write()
    expect(ok.ok).toBe(true)
    if (!ok.ok) throw new Error('unreachable')
    expect(ok.value.rendered).toContain('with view_range=[2, 3]')
    expect(ok.value.rendered).toContain('     3  l3')
    expect(ok.value.rendered).not.toContain('     1  l1')
    const bad = await createPostConsumeSreClosure(mkPlan(w.root, 'b.txt', { viewRange: [9, 10] }), {}, { instanceRootDir: w.root }).write()
    expect(bad.ok).toBe(false)
    if (bad.ok) throw new Error('unreachable')
    expect(bad.error.message).toContain('should be within the range of lines of the file: [1, 4]')
    mkdirSync(path.join(w.root, 'd'))
    const dirRange = await createPostConsumeSreClosure(mkPlan(w.root, 'd', { viewRange: [1, 2] }), {}, { instanceRootDir: w.root }).write()
    expect(dirRange.ok).toBe(false)
    if (dirRange.ok) throw new Error('unreachable')
    expect(dirRange.error.message).toContain('not allowed when `path` points to a directory')
  })

  it('S3 view of a directory: 2 levels, hidden/node_modules filtered, codepoint-sorted rows', async () => {
    const w = mkWorld('s3')
    const sub = path.join(w.root, 'sub')
    mkdirSync(sub, { recursive: true })
    mkdirSync(path.join(sub, 'beta'))
    mkdirSync(path.join(sub, '.hidden'))
    mkdirSync(path.join(sub, 'node_modules'))
    writeFileSync(path.join(sub, 'beta', 'inner.txt'), 'x\n', 'utf8')
    writeFileSync(path.join(sub, 'alpha.txt'), 'y\n', 'utf8')
    writeFileSync(path.join(sub, 'node_modules', 'junk.js'), 'z\n', 'utf8')
    const r = await createPostConsumeSreClosure(mkPlan(w.root, 'sub'), {}, { instanceRootDir: w.root }).write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(r.value.rendered).toContain('up to 2 levels deep in')
    expect(r.value.directory).toBe(true)
    const rendered = r.value.rendered
    expect(rendered).toContain(`d\t${sub}`)
    expect(rendered).toContain(`f\t${path.join(sub, 'alpha.txt')}`)
    expect(rendered).toContain(`d\t${path.join(sub, 'beta')}`)
    expect(rendered).toContain(`f\t${path.join(sub, 'beta', 'inner.txt')}`)
    // the PROMPT text names the filters (native wording); the ROWS carry none:
    expect(rendered).not.toContain(`\t${path.join(sub, 'node_modules')}`)
    expect(rendered).not.toContain(`\t${path.join(sub, '.hidden')}`)
    // codepoint order: alpha before beta in the sorted rows
    expect(rendered.indexOf('alpha.txt')).toBeLessThan(rendered.indexOf('beta'))
  })

  it('S4 truncation at the configured budget carries the host suffix', async () => {
    const w = mkWorld('s4')
    writeFileSync(path.join(w.root, 'big.txt'), 'x'.repeat(500), 'utf8')
    const r = await createPostConsumeSreClosure(mkPlan(w.root, 'big.txt'), {}, { instanceRootDir: w.root, maxOutputChars: 64 }).write()
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(r.value.rendered).toContain('<response clipped><NOTE>')
  })

  it('S5 create: the delegated create law lands the file with native success words', async () => {
    const w = mkWorld('s5')
    const r = await createPostConsumeSreClosure(
      mkPlan(w.root, 'new.txt', { command: 'create', fileText: 'created by sre\n' }),
      {}, { instanceRootDir: w.root },
    ).write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(r.value.rendered).toBe(`New file created successfully at: ${path.join(w.root, 'new.txt')}`)
    expect(r.value.createdNew).toBe(true)
    expect(String(r.value.writtenFingerprint)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(readFileSync(path.join(w.root, 'new.txt'), 'utf8')).toBe('created by sre\n')
  })

  it('S6 create over an EXISTING target loses with zero bytes (the O_EXCL law answers the native cannot-overwrite rule)', async () => {
    const w = mkWorld('s6')
    const target = path.join(w.root, 'exists.txt')
    writeFileSync(target, 'original\n', 'utf8')
    const r = await createPostConsumeSreClosure(
      mkPlan(w.root, 'exists.txt', { command: 'create', fileText: 'overwrite attempt\n' }),
      {}, { instanceRootDir: w.root },
    ).write()
    expect(r.ok).toBe(false)
    expect(readFileSync(target, 'utf8')).toBe('original\n')
  })

  it('S7 str_replace: unique success — native words, real bytes, echo pair under the paired read', async () => {
    const w = mkWorld('s7')
    const target = path.join(w.root, 'r.txt')
    writeFileSync(target, 'alpha\nbeta\n', 'utf8')
    const r = await createPostConsumeSreClosure(
      mkPlan(w.root, 'r.txt', { command: 'str_replace', oldStr: 'beta', newStr: 'GAMMA' }),
      {}, { instanceRootDir: w.root },
    ).write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (!r.ok) throw new Error('unreachable')
    expect(r.value.rendered).toBe(`The file ${target} has been edited successfully.`)
    expect(readFileSync(target, 'utf8')).toBe('alpha\nGAMMA\n')
    expect(r.value.before).toBe('alpha\nbeta\n')
    expect(r.value.after).toBe('alpha\nGAMMA\n')
  })

  it('S8 str_replace: zero and multiple occurrences refuse with the native words; bytes untouched', async () => {
    const w = mkWorld('s8')
    const target = path.join(w.root, 'm.txt')
    writeFileSync(target, 'dup\nx\ndup\n', 'utf8')
    const none = await createPostConsumeSreClosure(
      mkPlan(w.root, 'm.txt', { command: 'str_replace', oldStr: 'absent', newStr: 'X' }),
      {}, { instanceRootDir: w.root },
    ).write()
    expect(none.ok).toBe(false)
    if (none.ok) throw new Error('unreachable')
    expect(none.error.message).toContain('did not appear verbatim')
    const multi = await createPostConsumeSreClosure(
      mkPlan(w.root, 'm.txt', { command: 'str_replace', oldStr: 'dup', newStr: 'D' }),
      {}, { instanceRootDir: w.root },
    ).write()
    expect(multi.ok).toBe(false)
    if (multi.ok) throw new Error('unreachable')
    expect(multi.error.message).toContain('Multiple occurrences')
    expect(multi.error.message).toContain('lines [1, 3]')
    expect(readFileSync(target, 'utf8')).toBe('dup\nx\ndup\n')
  })

  it('S9 str_replace with newStr null refuses at construction (the native typed refusal, zero FS)', () => {
    const w = mkWorld('s9')
    expect(() => createPostConsumeSreClosure(
      mkPlan(w.root, 'n.txt', { command: 'str_replace', oldStr: 'a', newStr: null }),
      {}, { instanceRootDir: w.root },
    )).toThrow(/newStr null/)
  })

  it('S10 insert: the splice lands; out-of-range insert_line answers the native bounds message; bytes asserted', async () => {
    const w = mkWorld('s10')
    const target = path.join(w.root, 'i.txt')
    writeFileSync(target, 'l1\nl3\n', 'utf8')
    const r = await createPostConsumeSreClosure(
      mkPlan(w.root, 'i.txt', { command: 'insert', newStr: 'l2', insertLine: 1 }),
      {}, { instanceRootDir: w.root },
    ).write()
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect(readFileSync(target, 'utf8')).toBe('l1\nl2\nl3\n')
    const bad = await createPostConsumeSreClosure(
      mkPlan(w.root, 'i.txt', { command: 'insert', newStr: 'x', insertLine: 9 }),
      {}, { instanceRootDir: w.root },
    ).write()
    expect(bad.ok).toBe(false)
    if (bad.ok) throw new Error('unreachable')
    // the file NOW has 4 lines (l1/l2/l3/'') — the native bound answers 4
    expect(bad.error.message).toContain('within the range of lines of the file: [0, 4]')
    expect(readFileSync(target, 'utf8')).toBe('l1\nl2\nl3\n')
  })

  it('S11 single flight (P3): the repeat refuses grant-consumed', async () => {
    const w = mkWorld('s11')
    writeFileSync(path.join(w.root, 'p.txt'), 'a\n', 'utf8')
    const closure = createPostConsumeSreClosure(mkPlan(w.root, 'p.txt'), {}, { instanceRootDir: w.root })
    expect((await closure.write()).ok).toBe(true)
    const second = await closure.write()
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('unreachable')
    expect(second.error.details?.['cfReason']).toBe('grant-consumed')
  })

  it('S12 the closure is a PRIVATE executor: it rides no public barrel', () => {
    const barrel = laneBarrel as Record<string, unknown>
    expect(barrel['createPostConsumeSreClosure']).toBeUndefined()
  })

  it('S13 cancellation before the truncate refuses with the file BYTE-INTACT (zero is the truth, asserted)', async () => {
    const w = mkWorld('s13')
    const target = path.join(w.root, 'c.txt')
    writeFileSync(target, 'keep me\n', 'utf8')
    // mutation-branch reads: (1) top, (2) pre-truncate -> abort here
    const r = await createPostConsumeSreClosure(
      mkPlan(w.root, 'c.txt', { command: 'str_replace', oldStr: 'keep', newStr: 'gone' }),
      { signal: countingSignal(2) }, { instanceRootDir: w.root },
    ).write()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.error.details?.['cfReason']).toBe('effect-outside-grant')
    expect(readFileSync(target, 'utf8')).toBe('keep me\n')
  })
})
