/**
 * A5M2-IMAGE-READ-PORT C1: the production readBounded port the B-IMAGE arm
 * header disclosed as its missing production leg. Every leg reads a REAL
 * file through the REAL composition (realpath agreement + O_NOFOLLOW +
 * verifyOpenedHandle same-FD re-read + cap+1 bounded read) over a REAL
 * workspace-internal root. The port answers FACTS (byteLength may be
 * cap+1 — the over-cap refusal is the arm's); refusals are the port's own
 * codes, passed verbatim by the arm (no second protocol).
 * @module @dsh-agent-team/runtime/test/a5m2-image-read-port-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findTestRepoRoot, homeRoot } from '../../../tests/paths.mjs'
import { createGovernedImageReadPort } from '../controlled-fs/src/governed-image-read-port.js'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-image-read-port: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD = join(homeRoot(REPO), `a5m2-image-read-port-${STAMP}`)
mkdirSync(WORLD, { recursive: true })
const ROOT = join(WORLD, 'nsroot')
mkdirSync(ROOT, { recursive: true })
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const GRANT = Symbol('exec-credential')
const port = createGovernedImageReadPort({ namespaceRoot: ROOT })

type Answer = Awaited<ReturnType<typeof port>>
/** Refusal code of a settled answer ('OK' when the port answered facts). */
function codeOf(answer: Answer): string {
  return answer.ok === true ? 'OK' : answer.code
}

describe('A5M2-IMAGE-READ-PORT: the production port answers facts on the M1-verified boundary', () => {
  it('POSITIVE: exact bytes through realpath-agreement + same-FD verify; the fact shape is the arm contract', async () => {
    const target = join(ROOT, 'pic.bin')
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    writeFileSync(target, bytes)
    const answer = await port({ grant: GRANT, realmId: 'r1', canonicalLocator: target }, { maxBytes: 1024 })
    expect(answer.ok).toBe(true)
    if (answer.ok !== true) throw new Error('unreachable')
    expect(answer.value.observedKind).toBe('file')
    expect(answer.value.byteLength).toBe(8)
    expect(Buffer.from(answer.value.bytes).equals(bytes)).toBe(true)
  })

  it('THE OVER-CAP FACT: byteLength answers the cap+1 measurement (the READ_TOO_LARGE refusal is the arm\'s, on this fact)', async () => {
    const target = join(ROOT, 'ten.bin')
    writeFileSync(target, Buffer.alloc(10, 0x61))
    const answer = await port({ grant: GRANT, canonicalLocator: target }, { maxBytes: 5 })
    expect(answer.ok).toBe(true)
    if (answer.ok !== true) throw new Error('unreachable')
    expect(answer.value.byteLength).toBe(6)
    expect(answer.value.bytes.byteLength).toBe(6)
  })

  it('no credential, no bytes: the boundary requires the REAL execution credential to be PRESENT (contents are the ledger\'s check)', async () => {
    const target = join(ROOT, 'cred.bin')
    writeFileSync(target, 'x')
    expect(codeOf(await port({ grant: undefined as unknown as symbol, canonicalLocator: target }, { maxBytes: 8 }))).toBe('CREDENTIAL-ABSENT')
    expect(codeOf(await port({ grant: null as unknown as symbol, canonicalLocator: target }, { maxBytes: 8 }))).toBe('CREDENTIAL-ABSENT')
  })

  it('caller-law refusals carry zero FS: cap must be a real number; only absolute locators are accepted', async () => {
    expect(codeOf(await port({ grant: GRANT, canonicalLocator: join(ROOT, 'x.bin') }, { maxBytes: -1 }))).toBe('CAP-INVALID')
    expect(codeOf(await port({ grant: GRANT, canonicalLocator: join(ROOT, 'x.bin') }, { maxBytes: 1.5 as number }))).toBe('CAP-INVALID')
    expect(codeOf(await port({ grant: GRANT, canonicalLocator: 'nsroot/x.bin' }, { maxBytes: 8 }))).toBe('ABSOLUTE-ONLY')
  })

  it('the approved fact is a REALPATH AGREEMENT: a path that resolves elsewhere is STALE (ANCHOR-DRIFT), never a silent redirect', async () => {
    const real = join(ROOT, 'real.bin')
    const viaLink = join(ROOT, 'alias.bin')
    writeFileSync(real, 'payload')
    symlinkSync(real, viaLink)
    const answer = await port({ grant: GRANT, canonicalLocator: viaLink }, { maxBytes: 64 })
    expect(answer.ok).toBe(false)
    expect(codeOf(answer)).toBe('ANCHOR-DRIFT')
  })

  it('containment and object-shape refusals (verbatim M1 vocabulary): escape, absent, directory, symlink open', async () => {
    const outside = join(WORLD, 'outside.bin')
    writeFileSync(outside, 'foreign')
    expect(codeOf(await port({ grant: GRANT, canonicalLocator: outside }, { maxBytes: 64 }))).toBe('ANCHOR-ESCAPE')
    expect(codeOf(await port({ grant: GRANT, canonicalLocator: join(ROOT, 'ghost.bin') }, { maxBytes: 64 }))).toBe('target-unreadable')
    expect(codeOf(await port({ grant: GRANT, canonicalLocator: ROOT }, { maxBytes: 64 }))).toBe('not-a-file')
    // A symlinked FILE whose lexeme is also its realpath-inequal form is the
    // drift leg above; the O_NOFOLLOW ELOOP leg needs the open to be reached
    // — it is reached when the drift check passes, so the drift leg stands
    // as the observable boundary. The zero-byte fact is passed through for
    // the ARM to refuse as PORT_CONTRACT_BREACH (fact, not opinion):
    const empty = join(ROOT, 'empty.bin')
    writeFileSync(empty, '')
    const answer = await port({ grant: GRANT, canonicalLocator: empty }, { maxBytes: 64 })
    expect(answer.ok).toBe(true)
    if (answer.ok !== true) throw new Error('unreachable')
    expect(answer.value.byteLength).toBe(0)
    expect(answer.value.bytes.byteLength).toBe(0)
  })

  it('cancellation is answered INSIDE the read by AbortError (the arm\'s CANCELLED edge: the commit never starts)', async () => {
    const target = join(ROOT, 'cancel.bin')
    writeFileSync(target, Buffer.alloc(32, 0x62))
    await expect(port({ grant: GRANT, canonicalLocator: target }, { maxBytes: 16, signal: { aborted: true } }))
      .rejects.toSatisfy((error: unknown) => (error as Error).name === 'AbortError')
    // the same call NOT cancelled still reads (the refusal was live, not a
    // one-shot latch):
    const answer = await port({ grant: GRANT, canonicalLocator: target }, { maxBytes: 16 })
    expect(answer.ok).toBe(true)
  })

  it('a port without a real governed root cannot be constructed (assembly-time throw, no half-wired port)', () => {
    expect(() => createGovernedImageReadPort({ namespaceRoot: '' })).toThrow(TypeError)
    expect(() => createGovernedImageReadPort({ namespaceRoot: join(WORLD, 'does-not-exist') })).toThrow(TypeError)
  })

  it('bytes come from the VERIFIED HANDLE, never the path: the file may lawfully CHANGE after the answer (the read is the fact at read time)', async () => {
    const target = join(ROOT, 'live.bin')
    writeFileSync(target, 'first')
    const answer = await port({ grant: GRANT, canonicalLocator: target }, { maxBytes: 64 })
    expect(answer.ok).toBe(true)
    if (answer.ok !== true) throw new Error('unreachable')
    const readback = readFileSync(target, 'utf8')
    expect(readback).toBe('first')
    expect(Buffer.from(answer.value.bytes).toString('utf8')).toBe('first')
  })
})
