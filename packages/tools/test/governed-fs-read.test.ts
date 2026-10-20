/**
 * Bounded READ pilot — unit suite (T-U1..T-U8 + admission negatives + root
 * BLOCK-order negatives ①-⑫ @f13707e8).
 *
 * LABELING (review ⑫, honest): the envelope/window vectors below are
 * HAND-DERIVED goldens from host 0.2.0-rc.2 tool-fs source law
 * (read.ts:47-96, read-render.ts:66-169) — NOT live two-mount captures; the
 * live parity legs are booked at pilot acceptance (kit stage).
 *
 * ROOT CLEANUP HOLD: per-test tmp fixtures are RETAINED (nothing removed);
 * each fixture root is printed for the evidence ledger. Raw logs/tokens are
 * never read or echoed here.
 *
 * @module packages/tools/test/governed-fs-read
 */
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync, symlinkSync, linkSync, renameSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createGovernedReadDefinition, fingerprintParameters, GovernedFsError, validateNativeOutputShape, type AdmissionLiveState, type CallAdmission, type GovernedReadDefinition, type GovernedToolExec } from '../src/governed-fs/index.js'

let root: string
let opens: { path: string, flags: number }[]
let stats: string[]
let reads: number

type DefConfig = Parameters<typeof createGovernedReadDefinition>[0]

function defFor (over: Partial<DefConfig> = {}): GovernedReadDefinition {
  const st = statSync(root)
  const base: DefConfig = {
    rootDir: root,
    rootIdentity: { dev: st.dev, ino: st.ino },
    ioProfile: 'pinned-trusted-root',
    observer: {
      onOpen (path, flags) { opens.push({ path, flags }) },
      onStat (path) { stats.push(path) },
      onRead () { reads += 1 },
    },
    liveAdmission: () => ({ revoked: false, generation: 7, bindingRevision: 1, grantId: 'g-test-1' }),
    expectationFor (filePath, offset, limit) {
      const abs = filePath.startsWith('/') ? filePath : join(root, filePath)
      return { bindingRevision: 1, generation: 7, canonicalLocator: abs, parametersFingerprint: fingerprintParameters(abs, offset, limit) }
    },
  }
  return createGovernedReadDefinition({ ...base, ...over })
}

function bindingFor (abs: string, offset = 1, limit = 2000, over: Partial<CallAdmission> = {}): CallAdmission {
  return { bindingRevision: 1, generation: 7, canonicalLocator: abs, parametersFingerprint: fingerprintParameters(abs, offset, limit), grantId: 'g-test-1', ...over }
}

function call (def: GovernedReadDefinition, args: Record<string, unknown>, exec?: GovernedToolExec): Promise<unknown> {
  return def.execute(args, exec)
}

const fdCount = (): number => { try { return readdirSync('/proc/self/fd').length } catch { return -1 } }

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'a5-read-pilot-'))
  console.log(`[fixture retained (HOLD)] ${root}`)
  opens = []
  stats = []
  reads = 0
})

describe('spec-level parity — HAND-DERIVED goldens, live two-mount booked at acceptance (T-U1/T-U6)', () => {
  it('renders the native envelope for a plain read (golden)', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'alpha\nbeta\ngamma\n')
    const def = defFor()
    const out = await call(def, { file_path: p }, { admissionBinding: bindingFor(p) }) as { path: string, offset: number, lines: { number: number, text: string }[], totalLines: number }
    expect(out).toEqual({ path: p, offset: 1, lines: [{ number: 1, text: 'alpha' }, { number: 2, text: 'beta' }, { number: 3, text: 'gamma' }], totalLines: 3 })
    expect(def.output.render({ file_path: p }, out)[0]?.text).toBe(`<path>${p}</path>\n<type>file</type>\n<content>\n1: alpha\n2: beta\n3: gamma\n\n(End of file - total 3 lines)\n</content>`)
  })
  it('windows with offset/limit and carries the continuation footer (derived law)', async () => {
    const p = join(root, 'b.txt')
    writeFileSync(p, 'l1\nl2\nl3\nl4\n')
    const def = defFor()
    const out = await call(def, { file_path: p, offset: 2, limit: 2 }, { admissionBinding: bindingFor(p, 2, 2) }) as Record<string, unknown>
    expect(def.output.render({ file_path: p, offset: 2, limit: 2 }, out)[0]?.text).toContain('(Showing lines 2-3 of 4. Use offset=4 to continue.)')
  })
  it('outcome object itself passes the native output-shape validator (BLOCK ⑤)', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    const out = await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(p) })
    expect(() => { validateNativeOutputShape(out) }).not.toThrow()
    expect(Object.keys(out as object).sort().join(',')).toBe('lines,offset,path,totalLines')
    expect(() => { validateNativeOutputShape({ ...(out as object), truncatedByBytes: true }) }).toThrow(/unexpected key set/)
  })
  it('empty file at offset 1 is a legal zero-window (native law)', async () => {
    const p = join(root, 'empty.txt')
    writeFileSync(p, '')
    const out = await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(p) }) as { totalLines: number }
    expect(out.totalLines).toBe(0)
  })
  it('offset past EOF rejects with the native out-of-range text shape', async () => {
    const p = join(root, 'c.txt')
    writeFileSync(p, 'one\n')
    await expect(call(defFor(), { file_path: p, offset: 9 }, { admissionBinding: bindingFor(p, 9, 2000) })).rejects.toThrow(/offset 9 is out of range for .* \(1 lines\)/)
  })
  it('missing file rejects GOV_NOT_FOUND without creating anything', async () => {
    const p = join(root, 'nope.txt')
    const err = await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err).toBeInstanceOf(GovernedFsError)
    expect(err.code).toBe('GOV_NOT_FOUND')
  })
  it('arg law matches native parseReadArgs texts', async () => {
    const def = defFor()
    await expect(call(def, { file_path: '  ' })).rejects.toThrow('file_path must be a non-empty string')
    await expect(call(def, { file_path: '/x', offset: 0 })).rejects.toThrow('offset must be a positive integer')
    await expect(call(def, { file_path: '/x', limit: 999999 })).rejects.toThrow('limit must be less than or equal to 2000')
  })
})

describe('syscall-boundary negatives (T-U2..T-U8)', () => {
  it('T-U2 final-component symlink rejects with the ELOOP law', async () => {
    writeFileSync(join(root, 'real.txt'), 'x\n')
    const link = join(root, 'link.txt')
    symlinkSync(join(root, 'real.txt'), link)
    const err = await call(defFor(), { file_path: link }, { admissionBinding: bindingFor(link) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_ELOOP')
  })
  it('T-U3 mid-chain symlink rejects at the chain step', async () => {
    mkdirSync(join(root, 'd'))
    writeFileSync(join(root, 'd', 'f.txt'), 'y\n')
    const alias = join(root, 'alias')
    symlinkSync(join(root, 'd'), alias)
    const p = join(alias, 'f.txt')
    const err = await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    // pre-open lstat law answers ELOOP directly; the kernel's
    // O_NOFOLLOW|O_DIRECTORY→ENOTDIR form remains accepted as a second layer.
    expect(['GOV_ELOOP', 'GOV_NOT_REGULAR']).toContain(err.code)
  })
  const fifoAvailable = (() => {
    const probe = join(mkdtempSync(join(tmpdir(), 'a5-fifo-probe-')), 'p')
    return spawnSync('mkfifo', [probe], { timeout: 5000 }).status === 0
  })()
  it.skipIf(!fifoAvailable)('T-U4 fifo rejects at the PRE-OPEN lstat law (never opened), no hang', async () => {
    const fifo = join(root, 'pipe')
    if (spawnSync('mkfifo', [fifo], { timeout: 5000 }).status !== 0) throw new Error('mkfifo disappeared between probe and test')
    const err = await call(defFor(), { file_path: fifo }, { admissionBinding: bindingFor(fifo) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_NOT_REGULAR')
    expect(reads).toBe(0)
    // BLOCK ⑨ order self-evidence: the stat of the final component precedes any open.
    expect((stats.at(-1) ?? '').endsWith('/pipe')).toBe(true)
  })
  if (!fifoAvailable) console.log('[NAMED-SKIP] T-U4 mkfifo-unavailable-on-this-host (recorded, not silently passed)')
  it('T-U5 size over cap rejects before reading more', async () => {
    const p = join(root, 'big.txt')
    writeFileSync(p, 'a'.repeat(64))
    const err = await call(defFor({ maxSizeBytes: 8 }), { file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_TOO_LARGE')
    expect(reads).toBe(0)
  })
  it('T-U6 no parent traversal and no escape of the root', async () => {
    const err = await call(defFor(), { file_path: `${root}/../escape.txt` }, { admissionBinding: bindingFor(`${root}/../escape.txt`) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_OUTSIDE_ROOT')
    expect(opens.length).toBe(0)
  })
  it('T-U8 hardlink (nlink>1) rejects by default law', async () => {
    const p = join(root, 'orig.txt')
    writeFileSync(p, 'z\n')
    const hard = join(root, 'hard.txt')
    linkSync(p, hard)
    const err = await call(defFor(), { file_path: hard }, { admissionBinding: bindingFor(hard) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_HARDLINK')
  })
})

describe('BLOCK ① FD hygiene', () => {
  it('a successful read leaks ZERO descriptors (proc fd delta over the calls)', async () => {
    mkdirSync(join(root, 't'))
    const p = join(root, 't', 'f.txt')
    writeFileSync(p, 'old-content\n')
    const before = fdCount()
    for (let i = 0; i < 25; i += 1) await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(p) })
    expect(fdCount()).toBe(before)
  })
  it('a failed read also leaks zero descriptors', async () => {
    writeFileSync(join(root, 'h.txt'), 'x\n')
    linkSync(join(root, 'h.txt'), join(root, 'h2.txt'))
    const before = fdCount()
    for (let i = 0; i < 10; i += 1) await call(defFor(), { file_path: join(root, 'h2.txt') }, { admissionBinding: bindingFor(join(root, 'h2.txt')) }).catch(() => undefined)
    expect(fdCount()).toBe(before)
  })
})

describe('BLOCK ②/③ effect-boundary rechecks (deterministic seams)', () => {
  it('retarget between chain and effect MUST refuse and NEVER surface new bytes', async () => {
    mkdirSync(join(root, 't'))
    const p = join(root, 't', 'f.txt')
    writeFileSync(p, 'OLD-CONTENT\n')
    const def = defFor({
      effectBoundarySeam: () => {
        // deterministic swap AFTER the verified chain, BEFORE the effect recheck:
        renameSync(p, join(root, 't', 'f.retired'))
        writeFileSync(p, 'NEW-INDEPENDENT-CONTENT\n')
      },
    })
    const err = await def.execute({ file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err).toBeInstanceOf(GovernedFsError)
    expect(err.code).toBe('GOV_STALE_HANDLE')
    expect(String(err.message)).not.toContain('NEW-INDEPENDENT-CONTENT')
    expect(reads).toBe(0)
    // every open after the root anchor stayed beneath an anchor fd (no target reopen):
    expect(opens.filter((o) => !o.path.startsWith('/proc/self/fd/')).map((o) => o.path)).toEqual([root])
  })
  it('retarget refuses deterministically across repeats (non-racing)', async () => {
    for (let i = 0; i < 5; i += 1) {
      const rr = mkdtempSync(join(tmpdir(), 'a5-read-pilot-rt-'))
      console.log(`[fixture retained (HOLD)] ${rr}`)
      const st = statSync(rr)
      const p = join(rr, 'f.txt')
      writeFileSync(p, 'OLD\n')
      const def = createGovernedReadDefinition({
        rootDir: rr,
        rootIdentity: { dev: st.dev, ino: st.ino },
        ioProfile: 'pinned-trusted-root',
        liveAdmission: () => ({ revoked: false, generation: 1, bindingRevision: 1, grantId: 'g' }),
        effectBoundarySeam: () => { renameSync(p, join(rr, 'f.gone')); writeFileSync(p, 'NEW\n') },
        expectationFor (fp, o, l) { return { bindingRevision: 1, generation: 1, canonicalLocator: fp, parametersFingerprint: fingerprintParameters(fp, o, l) } },
      })
      const err = await def.execute({ file_path: p }, { admissionBinding: { bindingRevision: 1, generation: 1, canonicalLocator: p, parametersFingerprint: fingerprintParameters(p, 1, 2000), grantId: 'g' } }).catch((e: unknown) => e) as GovernedFsError
      expect(err.code).toBe('GOV_STALE_HANDLE')
    }
  })
  it('revocation between chain and effect refuses with zero bytes read', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    let live: AdmissionLiveState = { revoked: false, generation: 7, bindingRevision: 1 }
    const def = defFor({
      liveAdmission: () => live,
      effectBoundarySeam: () => { live = { revoked: true, generation: 7, bindingRevision: 1, grantId: 'g-test-1' } },
    })
    const err = await def.execute({ file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_ABANDONED_REVOKED')
    expect(reads).toBe(0)
  })
  it('generation move between chain and effect refuses with zero bytes read', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    let live: AdmissionLiveState = { revoked: false, generation: 7, bindingRevision: 1 }
    const def = defFor({
      liveAdmission: () => live,
      effectBoundarySeam: () => { live = { revoked: false, generation: 8, bindingRevision: 1, grantId: 'g-test-1' } },
    })
    const err = await def.execute({ file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_ADMISSION_DIVERGENT')
    expect(reads).toBe(0)
  })
  it('grant swap between chain and effect refuses (grant consumed ≠ current grant)', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    let live: AdmissionLiveState = { revoked: false, generation: 7, bindingRevision: 1, grantId: 'g-test-1' }
    const def = defFor({
      liveAdmission: () => live,
      effectBoundarySeam: () => { live = { revoked: false, generation: 7, bindingRevision: 1, grantId: 'g-other' } },
    })
    const err = await def.execute({ file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_ADMISSION_DIVERGENT')
  })
  it('root-F1 ③ replayed grant: a consumed OLD grant under a rotated current grant refuses with reads=0', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    let live: AdmissionLiveState = { revoked: false, generation: 7, bindingRevision: 1, grantId: 'g-rotated-new' }
    const def = defFor({ liveAdmission: () => live })
    const err = await def.execute({ file_path: p }, { admissionBinding: bindingFor(p, 1, 2000, { grantId: 'g-consumed-old' }) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_ADMISSION_DIVERGENT')
    expect(reads).toBe(0)
  })
  it('root-F1 ③ valid grant positive control: the served read rides reads>0 and answers content', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'VALID-GRANT-CONTENT\n')
    const out = await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(p) }) as { lines: { text: string }[] }
    expect(out.lines[0]?.text).toBe('VALID-GRANT-CONTENT')
    expect(reads).toBeGreaterThan(0)
  })
  it('F1 @8ae8c445-review: a live view that omits grantId DIVERGES — never a silent skip', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    const def = defFor({
      liveAdmission: () => ({ revoked: false, generation: 7, bindingRevision: 1 }),
      effectBoundarySeam: () => { /* live view simply never reports a grant */ },
    })
    const err = await def.execute({ file_path: p }, { admissionBinding: bindingFor(p, 1, 2000, { grantId: 'grant-nobody-has' }) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_ADMISSION_DIVERGENT')
    expect(reads).toBe(0)
  })
})

describe('native contract shapes (review r2 ⑤/⑥)', () => {
  it('⑤ in-root \'..\' bounded traversal is ALLOWED exactly as native (not banned)', async () => {
    mkdirSync(join(root, 'a'))
    writeFileSync(join(root, 'b.txt'), 'B-CONTENT\n')
    const p = join(root, 'a', '..', 'b.txt')
    const out = await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(join(root, 'b.txt')) }) as { lines: { text: string }[] }
    // the expectation layer canonicalizes; the read answers b.txt's bytes.
    expect(out.lines[0]?.text).toBe('B-CONTENT')
  })
  it('⑥ raw path with in-name whitespace rides verbatim (only all-blank rejects)', async () => {
    const p = join(root, 'sp ace.txt')
    writeFileSync(p, 'WS-CONTENT\n')
    const out = await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(p) }) as { lines: { text: string }[] }
    expect(out.lines[0]?.text).toBe('WS-CONTENT')
    await expect(call(defFor(), { file_path: '   ' })).rejects.toThrow('file_path must be a non-empty string')
  })
})

describe('BLOCK ④ root anchor identity + platform law', () => {
  it('a root dirfd whose identity does not match the pinned anchor refuses', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    const st = statSync(root)
    const def = defFor({ rootIdentity: { dev: st.dev, ino: st.ino + 777 } })
    const err = await def.execute({ file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_FOREIGN_ROOT')
    expect(reads).toBe(0)
  })
  it('a swapped root (identity pinned to another dir) refuses via the anchor', async () => {
    const outer = mkdtempSync(join(tmpdir(), 'a5-read-pilot-swap-'))
    console.log(`[fixture retained (HOLD)] ${outer}`)
    const real = join(outer, 'real')
    mkdirSync(real)
    writeFileSync(join(real, 'a.txt'), 'x\n')
    const pinned = statSync(real)
    const swap = join(outer, 'swap')
    mkdirSync(swap)
    const def = createGovernedReadDefinition({
      rootDir: swap, // caller opens swap but pinned the anchor identity of `real`
      rootIdentity: { dev: pinned.dev, ino: pinned.ino },
      ioProfile: 'pinned-trusted-root',
      liveAdmission: () => ({ revoked: false, generation: 1, bindingRevision: 1, grantId: 'g' }),
      expectationFor (fp, o, l) { return { bindingRevision: 1, generation: 1, canonicalLocator: fp, parametersFingerprint: fingerprintParameters(fp, o, l) } },
    })
    const err = await def.execute({ file_path: join(swap, 'a.txt') }, { admissionBinding: { bindingRevision: 1, generation: 1, canonicalLocator: join(swap, 'a.txt'), parametersFingerprint: fingerprintParameters(join(swap, 'a.txt'), 1, 2000), grantId: 'g' } }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_FOREIGN_ROOT')
  })
})

describe('per-call admission + flags discipline (T-L7/L8/L9 unit arms)', () => {
  it('missing admission binding rejects BEFORE any open', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    const err = await call(defFor(), { file_path: p }, {}).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_ADMISSION_MISSING')
    expect(opens.length).toBe(0)
  })
  it('fingerprint / revision / generation / revocation mismatches all reject before any open', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    const bad: CallAdmission[] = [
      { bindingRevision: 1, generation: 7, canonicalLocator: p, parametersFingerprint: 'stale', grantId: 'g' },
      { bindingRevision: 2, generation: 7, canonicalLocator: p, parametersFingerprint: fingerprintParameters(p, 1, 2000), grantId: 'g' },
      { bindingRevision: 1, generation: 8, canonicalLocator: p, parametersFingerprint: fingerprintParameters(p, 1, 2000), grantId: 'g' },
      { bindingRevision: 1, generation: 7, canonicalLocator: p, parametersFingerprint: fingerprintParameters(p, 1, 2000), grantId: 'g', revoked: true },
    ]
    const codes: string[] = []
    for (const b of bad) codes.push(((await call(defFor(), { file_path: p }, { admissionBinding: b }).catch((e: unknown) => e)) as GovernedFsError).code)
    expect(codes).toEqual(['GOV_ADMISSION_DIVERGENT', 'GOV_ADMISSION_DIVERGENT', 'GOV_ADMISSION_DIVERGENT', 'GOV_ABANDONED_REVOKED'])
    expect(opens.length).toBe(0)
  })
  it('no shared-current-grant: a stale-window binding reused under a new expectation rejects', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    const def = defFor()
    await expect(call(def, { file_path: p }, { admissionBinding: bindingFor(p) })).resolves.toBeTruthy()
    const reused = bindingFor(p, 1, 2000)
    await expect(call(def, { file_path: p, offset: 2, limit: 5 }, { admissionBinding: reused })).rejects.toThrow(GovernedFsError)
  })
  it('aborted signal rejects with zero opens (cancel parity shape)', async () => {
    const ac = new AbortController()
    ac.abort()
    const err = await call(defFor(), { file_path: join(root, 'x') }, { signal: ac.signal, admissionBinding: bindingFor(join(root, 'x')) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_ABORTED')
    expect(opens.length).toBe(0)
  })
  it('sandbox_permissions/image fields are refused BY NAME (never stripped)', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    const err = await call(defFor(), { file_path: p, sandbox_permissions: 'workspace-write' }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_FIELD_UNSUPPORTED')
    expect(err.message).toContain('sandbox_permissions')
  })
  it('arbitrary-tree profile fails closed at construction (PoC3 / ARBITRARY_TREE_PROFILE_PUBLISHED=false)', () => {
    const st = statSync(root)
    expect(() => createGovernedReadDefinition({
      rootDir: root,
      rootIdentity: { dev: st.dev, ino: st.ino },
      ioProfile: 'arbitrary-tree',
      liveAdmission: () => ({ revoked: false, generation: 1, bindingRevision: 1 }),
      expectationFor () { return { bindingRevision: 1, generation: 1, canonicalLocator: '', parametersFingerprint: '' } },
    })).toThrow(GovernedFsError)
  })
})

describe('T-L10 unit arm — two-member negative control (review ⑫/⑦)', () => {
  // HONEST LABEL (root review r2 ⑦): the three calls are ISSUED SEQUENTIALLY
  // within one tick via Promise.all — this proves assembly-level isolation
  // (per-definition expectation/grant/root binding), NOT scheduler interleaving.
  it('two members sharing one process never cross bindings/grants/roots (sequential issue, assembly isolation)', async () => {
    const rootA = mkdtempSync(join(tmpdir(), 'a5-member-a-'))
    const rootB = mkdtempSync(join(tmpdir(), 'a5-member-b-'))
    console.log(`[fixture retained (HOLD)] ${rootA} ${rootB}`)
    writeFileSync(join(rootA, 'f.txt'), 'A-CONTENT\n')
    writeFileSync(join(rootB, 'f.txt'), 'B-CONTENT\n')
    const mk = (r: string, gen: number, grant: string): GovernedReadDefinition => {
      const st = statSync(r)
      return createGovernedReadDefinition({
        rootDir: r,
        rootIdentity: { dev: st.dev, ino: st.ino },
        ioProfile: 'pinned-trusted-root',
        liveAdmission: () => ({ revoked: false, generation: gen, bindingRevision: 1, grantId: grant }),
        expectationFor (fp, o, l) { return { bindingRevision: 1, generation: gen, canonicalLocator: fp, parametersFingerprint: fingerprintParameters(fp, o, l) } },
      })
    }
    const defA = mk(rootA, 3, 'gA')
    const defB = mk(rootB, 9, 'gB')
    const callA = defA.execute({ file_path: join(rootA, 'f.txt') }, { admissionBinding: { bindingRevision: 1, generation: 3, canonicalLocator: join(rootA, 'f.txt'), parametersFingerprint: fingerprintParameters(join(rootA, 'f.txt'), 1, 2000), grantId: 'gA' } })
    const callB = defB.execute({ file_path: join(rootB, 'f.txt') }, { admissionBinding: { bindingRevision: 1, generation: 9, canonicalLocator: join(rootB, 'f.txt'), parametersFingerprint: fingerprintParameters(join(rootB, 'f.txt'), 1, 2000), grantId: 'gB' } })
    // A supplied with B's binding (cross-wired) must reject — no assembly-level
    // definition/identity overwrite can make A answer with B's facts:
    const cross = defA.execute({ file_path: join(rootA, 'f.txt') }, { admissionBinding: { bindingRevision: 1, generation: 9, canonicalLocator: join(rootB, 'f.txt'), parametersFingerprint: fingerprintParameters(join(rootB, 'f.txt'), 1, 2000), grantId: 'gB' } }).catch((e: unknown) => e)
    const [a, b, x] = await Promise.all([callA, callB, cross])
    expect((a as { lines: { text: string }[] }).lines[0]?.text).toBe('A-CONTENT')
    expect((b as { lines: { text: string }[] }).lines[0]?.text).toBe('B-CONTENT')
    expect(x).toBeInstanceOf(GovernedFsError)
    expect((x as GovernedFsError).code).toBe('GOV_ADMISSION_DIVERGENT')
  })
})
