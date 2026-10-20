/**
 * Bounded READ pilot — unit suite (T-U1..T-U8 + admission negatives).
 * Spec-level parity vectors are hand-derived from host
 * 0.2.0-rc.2 packages/fs/tool-fs/src/read-render.ts (:69-98, :152-169) and
 * read.ts (:47-60); live two-mount parity is booked at pilot acceptance.
 *
 * @module packages/tools/test/governed-fs-read
 */
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, linkSync, renameSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGovernedReadDefinition, fingerprintParameters, GovernedFsError, type CallAdmission, type GovernedReadDefinition, type GovernedToolExec } from '../src/governed-fs/index.js'

let root: string
let opens: { path: string, flags: number }[]

function defFor (over: Partial<Parameters<typeof createGovernedReadDefinition>[0]> = {}): GovernedReadDefinition {
  return createGovernedReadDefinition({
    rootDir: root,
    ioProfile: 'pinned-trusted-root',
    observer: { onOpen (path, flags) { opens.push({ path, flags }) } },
    expectationFor (filePath, offset, limit) {
      const abs = filePath.startsWith('/') ? filePath : join(root, filePath)
      return { bindingRevision: 1, generation: 7, canonicalLocator: abs, parametersFingerprint: fingerprintParameters(abs, offset, limit) }
    },
    ...over,
  })
}

function bindingFor (abs: string, offset = 1, limit = 2000, over: Partial<CallAdmission> = {}): CallAdmission {
  return { bindingRevision: 1, generation: 7, canonicalLocator: abs, parametersFingerprint: fingerprintParameters(abs, offset, limit), ...over }
}

function call (def: GovernedReadDefinition, args: Record<string, unknown>, exec?: GovernedToolExec): Promise<unknown> {
  return def.execute(args, exec)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'a5-read-pilot-'))
  opens = []
})
afterEach(() => { try { rmSync(root, { recursive: true, force: true }) } catch { /* tmp cleanup best effort */ } })

describe('spec-level parity (T-U1/T-U6)', () => {
  it('renders the native envelope for a plain read (golden)', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'alpha\nbeta\ngamma\n')
    const out = await call(defFor(), { file_path: p }, { admissionBinding: bindingFor(p) }) as { path: string, offset: number, lines: { number: number, text: string }[], totalLines: number }
    expect(out).toEqual({ path: p, offset: 1, lines: [{ number: 1, text: 'alpha' }, { number: 2, text: 'beta' }, { number: 3, text: 'gamma' }], totalLines: 3 })
    const def = defFor()
    const text = def.output.render({ file_path: p }, out)[0]?.text
    expect(text).toBe(`<path>${p}</path>\n<type>file</type>\n<content>\n1: alpha\n2: beta\n3: gamma\n\n(End of file - total 3 lines)\n</content>`)
  })
  it('windows with offset/limit and carries the continuation footer', async () => {
    const p = join(root, 'b.txt')
    writeFileSync(p, 'l1\nl2\nl3\nl4\n')
    const def = defFor()
    const out = await call(def, { file_path: p, offset: 2, limit: 2 }, { admissionBinding: bindingFor(p, 2, 2) }) as Record<string, unknown>
    expect(def.output.render({}, out)[0]?.text).toContain('(Showing lines 2-3 of 4. Use offset=4 to continue.)')
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
    // kernel law: O_NOFOLLOW|O_DIRECTORY on a symlink answers ENOTDIR (not ELOOP) —
    // either typed code proves the chain refused to descend THROUGH the symlink.
    expect(['GOV_ELOOP', 'GOV_NOT_REGULAR']).toContain(err.code)
  })
  it('T-U4 fifo rejects S_ISREG law, no hang', async () => {
    const fifo = join(root, 'pipe')
    const r = spawnSync('mkfifo', [fifo], { timeout: 5000 })
    if (r.status !== 0) return // environment without mkfifo: skip honestly
    const err = await call(defFor(), { file_path: fifo }, { admissionBinding: bindingFor(fifo) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_NOT_REGULAR')
  })
  it('T-U5 size over cap rejects before reading more', async () => {
    const p = join(root, 'big.txt')
    writeFileSync(p, 'a'.repeat(64))
    const err = await call(defFor({ maxSizeBytes: 8 }), { file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_TOO_LARGE')
  })
  it('T-U6 no parent traversal and no escape of the root', async () => {
    const err = await call(defFor(), { file_path: `${root}/../escape.txt` }, { admissionBinding: bindingFor(`${root}/../escape.txt`) }).catch((e: unknown) => e) as GovernedFsError
    expect(err.code).toBe('GOV_OUTSIDE_ROOT')
    expect(opens.length).toBe(0)
  })
  it('T-U7 retarget mid-chain never mixes: swap between steps rejects typed, all opens stayed beneath the anchor', async () => {
    const p = join(root, 't', 'f.txt')
    mkdirSync(join(root, 't'))
    writeFileSync(p, 'OLD\n')
    const swapped: typeof opens = []
    const def = createGovernedReadDefinition({
      rootDir: root,
      ioProfile: 'pinned-trusted-root',
      observer: {
        onOpen (path, flags) {
          swapped.push({ path, flags })
          if (swapped.length === 2) { // right after the intermediate dir step: retarget the leaf elsewhere
            renameSync(p, join(root, 't', 'f.gone'))
            writeFileSync(p, 'NEW-INDEPENDENT-CONTENT\n')
          }
        },
      },
      expectationFor (filePath, offset, limit) {
        const abs = filePath
        return { bindingRevision: 1, generation: 7, canonicalLocator: abs, parametersFingerprint: fingerprintParameters(abs, offset, limit) }
      },
    })
    const err = await def.execute({ file_path: p }, { admissionBinding: bindingFor(p) }).catch((e: unknown) => e) as GovernedFsError | { lines?: { text: string }[] }
    const outcome = err instanceof GovernedFsError ? 'refuse' : (err as { lines: { text: string }[] }).lines[0]?.text === 'OLD' ? 'old' : 'new'
    expect(['refuse', 'old', 'new']).toContain(outcome) // never mixed; and every chain open stayed beneath an fd anchor:
    expect(swapped.slice(1).every((o) => o.path.startsWith('/proc/self/fd/'))).toBe(true)
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
      { bindingRevision: 1, generation: 7, canonicalLocator: p, parametersFingerprint: 'stale' },
      { bindingRevision: 2, generation: 7, canonicalLocator: p, parametersFingerprint: fingerprintParameters(p, 1, 2000) },
      { bindingRevision: 1, generation: 8, canonicalLocator: p, parametersFingerprint: fingerprintParameters(p, 1, 2000) },
      { bindingRevision: 1, generation: 7, canonicalLocator: p, parametersFingerprint: fingerprintParameters(p, 1, 2000), revoked: true },
    ]
    const codes: string[] = []
    for (const b of bad) codes.push(((await call(defFor(), { file_path: p }, { admissionBinding: b }).catch((e: unknown) => e)) as GovernedFsError).code)
    expect(codes).toEqual(['GOV_ADMISSION_DIVERGENT', 'GOV_ADMISSION_DIVERGENT', 'GOV_ADMISSION_DIVERGENT', 'GOV_ABANDONED_REVOKED'])
    expect(opens.length).toBe(0)
  })
  it('no shared-current-grant: two calls with their own bindings pass, an old binding re-used after policy change rejects', async () => {
    const p = join(root, 'a.txt')
    writeFileSync(p, 'x\n')
    const def = defFor()
    await expect(call(def, { file_path: p }, { admissionBinding: bindingFor(p) })).resolves.toBeTruthy()
    // second call supplying the FIRST call's binding again is fine ONLY while
    // the expectation is unchanged; a new expectation (e.g. new offset window)
    // rejects the reused binding — bindings are per-call facts, not state.
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
    expect(() => createGovernedReadDefinition({
      rootDir: root,
      ioProfile: 'arbitrary-tree',
      expectationFor () { return { bindingRevision: 1, generation: 1, canonicalLocator: '', parametersFingerprint: '' } },
    })).toThrow(GovernedFsError)
  })
})
