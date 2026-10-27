/**
 * u7-r4091 (2026-10-27) — residual R-409-1 (LOW, recorded on PR #409's merge
 * ruling): `verifyOpenedHandle` checks `nlink === 1` ONCE at open time; the
 * write-class paths (post-consume-write, post-consume-edit, and the
 * controlled-fs `writeText` destructive branch) then truncated/wrote on the
 * SAME fd with no second observation. A second name planted between the exec
 * -time verification and the first byte-changing step therefore mutated
 * through the alias.
 *
 * The fix lives ONCE in the shared law module as `recheckSingleLink(fd)`
 * (open-at-exec.ts): a cheap same-fd `fstat` of the link-count law, called
 * by every write-class caller immediately BEFORE its first byte-changing
 * step (truncate / first write). On `nlink !== 1` the path refuses with the
 * EXISTING `hardlink-alias` verdict (reused `hardlinkAliasVerdict`; closed
 * reason set unchanged) and performs zero byte change of its own.
 *
 * Determinism: the verify→write window is made observable by lane-INTERNAL
 * optional seams (post-consume `onBeforeFirstByteChange`, lane
 * `onAfterVerifiedBeforeWrite`) that mirror the existing PoC3
 * `onAfterPreCheckBeforeOpen` probe seam. The sanctioned production wiring
 * (fs-family executors, admission binding) passes NEITHER — pinned by the
 * S-leg below.
 *
 * RED (pre-fix, evidence dev/agent-workflow/evidence/u7-r4091-20261027/):
 * with only the inert seams on the tree, every H-leg shows the WRITE
 * HAPPENING (canary inode mutated through the late alias). GREEN: typed
 * `hardlink-alias` refusal, inode bytes unchanged. Mutation (re-check
 * disabled): every H-leg is RED again.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { linkSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD_LEX = join(REPO, 'tests/homes', `u7-r4091-nlink-${Date.now().toString(36)}`)
let WORLD = WORLD_LEX
let ROOT = ''
let OUTSIDE = ''

const BEFORE_W = 'TARGET-BEFORE-WRITE-4a7c\n'
const BEFORE_E = 'OLD-TEXT edit target\n'
const BEFORE_L = 'LANE-TARGET-BEFORE\n'
const AFTER_W = 'OVERWRITTEN-THROUGH-ALIAS'
const AFTER_L = 'LANE-WRITTEN-THROUGH-ALIAS'

type Outcome = Record<string, unknown> & {
  ok?: boolean
  kind?: string
  error?: { code?: string; message?: string; details?: Record<string, unknown> }
  value?: unknown
}
const flat = (...parts: unknown[]): string =>
  parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('\n')

const statOf = (p: string): { nlink: number; ino: number } => statSync(p) as unknown as { nlink: number; ino: number }

beforeAll(() => {
  mkdirSync(WORLD_LEX, { recursive: true })
  WORLD = realpathSync(WORLD_LEX)
  ROOT = join(WORLD, 'root')
  OUTSIDE = join(WORLD, 'outside')
  mkdirSync(ROOT, { recursive: true })
  mkdirSync(OUTSIDE, { recursive: true })
})
afterAll(() => { rmSync(WORLD_LEX, { recursive: true, force: true }) })

/** Per-leg fresh single-named target (legs never share an inode). */
function freshTarget(name: string, content: string): string {
  writeFileSync(join(ROOT, name), content)
  expect(statOf(join(ROOT, name)).nlink, `fixture ${name} is single-link`).toBe(1)
  return name
}

/** The attacker action the seams make deterministic: plant a SECOND NAME for
 *  the verified inode OUTSIDE the governed root, after exec-time verify and
 *  before the first byte-changing step. */
function plantAlias(name: string, aliasName: string): void {
  linkSync(join(ROOT, name), join(OUTSIDE, aliasName))
  expect(statOf(join(OUTSIDE, aliasName)).ino, 'alias is the same inode').toBe(statOf(join(ROOT, name)).ino)
}

// ─────────────────────────────────────────────────────────────────────────
describe('recheckSingleLink — the shared second observation (unit)', () => {
  const load = async () => await import(new URL('../controlled-fs/src/open-at-exec.ts', import.meta.url).href) as {
    recheckSingleLink: (h: unknown) => Promise<{ verdict: string; nlink?: number; detail?: string }>
  }
  it('R-1 a single-link regular file fd is re-confirmed', async () => {
    const { recheckSingleLink } = await load()
    freshTarget('unit-1.txt', 'UNIT-SINGLE-1\n')
    const h = await fsOpen(join(ROOT, 'unit-1.txt'), 'r')
    try {
      expect((await recheckSingleLink(h)).verdict).toBe('confirmed')
    } finally { await h.close() }
  })
  it('R-2 a second name planted after the first observation answers hardlink-alias on the SAME fd', async () => {
    const { recheckSingleLink } = await load()
    freshTarget('unit-2.txt', 'UNIT-LATE-ALIAS-2\n')
    const h = await fsOpen(join(ROOT, 'unit-2.txt'), 'r')
    try {
      expect((await recheckSingleLink(h)).verdict, 'first look: still single-link').toBe('confirmed')
      plantAlias('unit-2.txt', 'unit-alias-2.txt')
      const v = await recheckSingleLink(h)
      expect(v.verdict).toBe('hardlink-alias')
      expect(v.nlink).toBe(2)
      expect(String(v.detail)).toMatch(/2 hard links/)
    } finally { await h.close() }
  })
  it('R-3 the directory exemption of the link-count law is unchanged (regular files only)', async () => {
    const { recheckSingleLink } = await load()
    const h = await fsOpen(ROOT, 'r')
    try {
      // A directory's nlink counts subdirectory entries, never aliases; the
      // law (open-at-exec.ts hardlinkAliasVerdict docs) exempts it by
      // construction and so does the re-check.
      expect((await recheckSingleLink(h)).verdict).toBe('confirmed')
    } finally { await h.close() }
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('post-consume write — nlink re-check before truncate/write', () => {
  const load = async () => await import(new URL('../controlled-fs/src/index.ts', import.meta.url).href) as {
    createPostConsumeWriteClosure: (p: unknown, c: unknown, cfg: unknown) => { write: () => Promise<Outcome> }
  }
  const plan = (locator: string, fp: string, content: string): unknown => ({
    approvedRootLexical: ROOT, approvedRootReal: ROOT, approvedLocator: locator, content, planFingerprint: fp,
  })

  it('H-write: alias planted between verify and truncate is refused hardlink-alias; the inode is byte-unchanged through BOTH names; zero bytes landed', async () => {
    const { createPostConsumeWriteClosure } = await load()
    const name = freshTarget('leg-hw.txt', BEFORE_W)
    const r = await createPostConsumeWriteClosure(
      plan(join(ROOT, name), 'fp-r4091-hw', AFTER_W),
      { parametersFingerprint: 'fp-r4091-hw', onBeforeFirstByteChange: () => { plantAlias(name, 'stolen-hw.txt') } },
      { instanceRootDir: ROOT },
    ).write()
    // FACT first: in RED the bytes prove the mutation through the late alias.
    expect(readFileSync(join(OUTSIDE, 'stolen-hw.txt'), 'utf8'), 'outside name: zero byte change').toBe(BEFORE_W)
    expect(readFileSync(join(ROOT, name), 'utf8'), 'in-root name: zero byte change').toBe(BEFORE_W)
    expect(r.ok, `write must be refused, got: ${flat(r)}`).toBe(false)
    expect(String(r.error?.details?.['cfReason'])).toBe('hardlink-alias')
    expect(String(r.error?.message)).toMatch(/hard link/)
  })

  it('P-write: with the seam present but inert, an ordinary nlink=1 write still lands (the seam alone changes no law)', async () => {
    const { createPostConsumeWriteClosure } = await load()
    const name = freshTarget('leg-pw.txt', BEFORE_W)
    const r = await createPostConsumeWriteClosure(
      plan(join(ROOT, name), 'fp-r4091-pw', 'NEW-PLAIN\n'),
      { parametersFingerprint: 'fp-r4091-pw', onBeforeFirstByteChange: () => { /* inert */ } },
      { instanceRootDir: ROOT },
    ).write()
    expect(r.ok, flat(r)).toBe(true)
    expect(readFileSync(join(ROOT, name), 'utf8')).toBe('NEW-PLAIN\n')
    expect(statOf(join(ROOT, name)).nlink).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('post-consume edit — nlink re-check before the write half', () => {
  const load = async () => await import(new URL('../controlled-fs/src/index.ts', import.meta.url).href) as {
    createPostConsumeEditClosure: (p: unknown, c: unknown, cfg: unknown) => { write: () => Promise<Outcome> }
  }
  const plan = (locator: string, oldString: string, newString: string): unknown => ({
    approvedRootLexical: ROOT, approvedRootReal: ROOT, approvedLocator: locator,
    oldString, newString, replaceAll: false, planFingerprint: 'fp-r4091-e',
  })

  it('H-edit: alias planted after the read half and before truncate is refused hardlink-alias; the inode is byte-unchanged through BOTH names; no echo in the refusal', async () => {
    const { createPostConsumeEditClosure } = await load()
    const name = freshTarget('leg-he.txt', BEFORE_E)
    const r = await createPostConsumeEditClosure(
      plan(join(ROOT, name), 'OLD-TEXT', 'NEW-TEXT'),
      { parametersFingerprint: 'fp-r4091-e', onBeforeFirstByteChange: () => { plantAlias(name, 'stolen-he.txt') } },
      { instanceRootDir: ROOT },
    ).write()
    // FACT first: in RED the bytes prove the mutation through the late alias.
    expect(readFileSync(join(OUTSIDE, 'stolen-he.txt'), 'utf8'), 'outside name: zero byte change').toBe(BEFORE_E)
    expect(readFileSync(join(ROOT, name), 'utf8'), 'in-root name: zero byte change').toBe(BEFORE_E)
    expect(r.ok, `edit must be refused, got: ${flat(r)}`).toBe(false)
    expect(String(r.error?.details?.['cfReason'])).toBe('hardlink-alias')
    expect(String(r.error?.message)).toMatch(/hard link/)
    // The paired-read echo is a success-receipt face only: the refusal
    // carries no file bytes.
    expect(flat(r)).not.toContain('OLD-TEXT')
    expect(flat(r)).not.toContain('NEW-TEXT')
  })

  it('P-edit: an ordinary nlink=1 edit still lands with the echo receipt', async () => {
    const { createPostConsumeEditClosure } = await load()
    const name = freshTarget('leg-pe.txt', BEFORE_E)
    const r = await createPostConsumeEditClosure(
      plan(join(ROOT, name), 'OLD-TEXT', 'NEW-TEXT'),
      { parametersFingerprint: 'fp-r4091-e' },
      { instanceRootDir: ROOT },
    ).write()
    expect(r.ok, flat(r)).toBe(true)
    expect(readFileSync(join(ROOT, name), 'utf8')).toBe('NEW-TEXT edit target\n')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('controlled-fs lane writeText — nlink re-check before the first write', () => {
  // Grant fixtures ride the frozen parsers via the PoC3 harness.
  const harness = async () => await import(new URL('../controlled-fs/test/poc3-harness.ts', import.meta.url).href) as {
    fileRef: (w: { ctrl: string }, rel: string, rights: readonly string[]) => unknown
    makeGrant: (fx: unknown) => unknown
    MEM_A: unknown
  }
  const lane = async (hooks?: Record<string, unknown>) => {
    const m = await import(new URL('../controlled-fs/src/index.ts', import.meta.url).href) as {
      createControlledFsLane: (cfg: unknown) => { fs: { writeText: (g: unknown, ref: unknown, content: string) => Promise<Outcome> }, ledger: Array<{ stage: string; locator: string }> }
    }
    return m.createControlledFsLane({
      instances: [{ fs: 'ctl', rootDir: ROOT, realmId: 'realm-1', kind: 'absolute-path' }],
      currentAuthorityGeneration: 1,
      consumed: () => false,
      hooks,
    })
  }

  it('H-lane: alias planted between the verified open and the write is refused hardlink-alias; NO content byte lands through either name', async () => {
    const h = await harness()
    const name = freshTarget('leg-hl.txt', BEFORE_L)
    const l = await lane({ onAfterVerifiedBeforeWrite: () => { plantAlias(name, 'stolen-hl.txt') } })
    const ref = h.fileRef({ ctrl: ROOT }, name, ['write'])
    const grant = h.makeGrant({ member: h.MEM_A, effects: [{ kind: 'write', resource: ref }] })
    const res = await l.fs.writeText(grant, ref, AFTER_L)
    // FACT first: in RED the bytes prove content landed through the late alias.
    // (The O_TRUNC destructive open is the EXISTING disclosed lane law — it
    // truncates before any verification can run; what this refusal must
    // guarantee is that NO CONTENT byte lands through the late alias.)
    expect(readFileSync(join(OUTSIDE, 'stolen-hl.txt'), 'utf8')).not.toContain(AFTER_L)
    expect(readFileSync(join(ROOT, name), 'utf8')).not.toContain(AFTER_L)
    expect(res.ok, `writeText must be refused, got: ${flat(res)}`).toBe(false)
    expect(String(res.error?.details?.['cfReason'])).toBe('hardlink-alias')
    expect(String(res.error?.message)).toMatch(/hard link/)
    expect(l.ledger.some((e) => e.stage === 'refused:denied:hardlink-alias'), 'ledger carries the typed refusal').toBe(true)
  })

  it('P-lane: without the probe seam an ordinary nlink=1 writeText still lands', async () => {
    const h = await harness()
    const name = freshTarget('leg-pl.txt', BEFORE_L)
    const l = await lane()
    const ref = h.fileRef({ ctrl: ROOT }, name, ['write'])
    const grant = h.makeGrant({ member: h.MEM_A, effects: [{ kind: 'write', resource: ref }] })
    const res = await l.fs.writeText(grant, ref, 'LANE-PLAIN\n')
    expect(res.ok, flat(res)).toBe(true)
    expect(readFileSync(join(ROOT, name), 'utf8')).toBe('LANE-PLAIN\n')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('seam discipline — the sanctioned wiring never passes the probe seams', () => {
  const SRC = new URL('../../', import.meta.url)
  const read = async (rel: string): Promise<string> => {
    const { readFileSync: rd } = await import('node:fs')
    return rd(fileURLToPath(new URL(rel, SRC).href), 'utf8')
  }
  it('S-1 the fs-family write/edit executors and the admission binding pass neither seam (internal test seams, never production knobs)', async () => {
    for (const rel of [
      'tools/fs-family/src/write-executor.mjs',
      'tools/fs-family/src/edit-executor.mjs',
      'runtime/controlled-fs/src/admission-binding.ts',
    ]) {
      const text = await read(rel)
      expect(text, `${rel} must never pass the verify-window probe seam`).not.toMatch(/onBeforeFirstByteChange|onAfterVerifiedBeforeWrite/)
    }
  })
  it('S-2 the re-check lives ONCE in open-at-exec.ts (no per-family copies)', async () => {
    const law = await read('runtime/controlled-fs/src/open-at-exec.ts')
    expect(law).toMatch(/export async function recheckSingleLink/)
    // The law is NOT re-derived in any caller: the write-class files call the
    // helper, they never re-state `nlink !== 1` beside a fstat of their own.
    for (const rel of [
      'runtime/controlled-fs/src/post-consume-write.ts',
      'runtime/controlled-fs/src/post-consume-edit.ts',
      'runtime/controlled-fs/src/controlled-fs.ts',
    ]) {
      const text = await read(rel)
      expect(text, `${rel} must use the shared helper`).toMatch(/recheckSingleLink/)
    }
  })
})
