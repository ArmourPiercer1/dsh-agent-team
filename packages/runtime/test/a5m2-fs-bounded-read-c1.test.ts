/**
 * A5-M2 (FS-PROC) — C1 for the bounded raw-bytes read kernel
 * (`packages/runtime/controlled-fs/src/bounded-bytes-read.ts`).
 *
 * Every case drives a REAL temporary file through a REAL fd
 * (`fsPromises.open` in this test — the kernel itself never opens; the opened
 * FileHandle is the only input it receives). Coverage of the seven mandated
 * legs:
 *   ① in-cap full read, byte-exact against the source incl. NON-utf8 binary
 *      (a fatal-utf8 probe over the source proves any utf8 round-trip would
 *      have corrupted these bytes, so byte-equality proves raw fidelity);
 *   ② file == cap passes with byteLength === cap;
 *   ③ file == cap+1 answers ok:true with byteLength === cap+1 — the kernel
 *      OBSERVES the cap+1 fact, reads nothing more, truncates nothing
 *      (un-truncated content asserted here; the stop itself is ④);
 *   ④ a file far larger than cap still answers EXACTLY cap+1 (stop, not
 *      slurp — the returned sha differs from the whole file's);
 *   ⑤ a true short read / EOF probe (final chunk shorter than requested,
 *      then a zero-byte read) is metered by ACTUAL bytesRead — requested-
 *      based counting would have mis-reported 11 bytes for a 9-byte file;
 *   ⑥ cancellation: pre-aborted answers byteLength 0; a structural signal
 *      whose `aborted` getter flips true at the 4th check boundary pins the
 *      OBSERVED byte count exactly (12 = three completed 4-byte chunks); a
 *      real AbortController racing a 60001-byte ring answers cancelled with
 *      an honest partial count; a present-but-not-aborted signal (plain
 *      object and real AbortSignal) changes nothing;
 *   ⑦ chunkBytes < cap accumulates across chunk boundaries (1000-byte
 *      chunks against a 5001-byte ring; the default 65536 chunk against a
 *      100001-byte ring).
 * T8 pins the kernel's structural law mechanically (comment-stripped source
 * text): single export, type-only import, zero open/realpath/stat/utf8/
 * Buffer/ledger/consume wording, the `ok: false` arm only ever 'cancelled'.
 *
 * NOT_PROVEN (disclosed, not claimed):
 *  (1) a NON-EOF mid-file short read cannot be forced on a regular file with
 *      a real fd on this platform; ⑤ exercises the genuinely short reads the
 *      OS does return (partial final chunk + zero-byte EOF probe), not a
 *      mocked short read;
 *  (2) the port layer ABOVE this kernel (grantRef handling, same-FD
 *      re-anchor, O_NOFOLLOW, observedKind, verbatim ok:false pass-through)
 *      is CENTER's port/call-site law — this suite pins only the kernel;
 *  (3) win32 behaviour is not exercised (this run is Linux);
 *  (4) an abort landing DURING a syscall is honoured at the next check
 *      boundary (cooperative law) — exact in-flight timing is not proven,
 *      nor is it the contract;
 *  (5) non-regular fds (FIFO/pipe short-read rhythm) are outside the
 *      governed-read target this kernel serves.
 *
 * Honesty: no Host, no ports, no network; worlds under `tests/homes/`
 * (workspace, TEST_METHODS §7), torn down in afterAll.
 *
 * @module packages/runtime/test/a5m2-fs-bounded-read-c1
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

import { readBoundedBytes } from '../controlled-fs/src/bounded-bytes-read.js'

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
let worldRoot = ''

beforeAll(() => {
  worldRoot = path.join(repoRoot, 'tests', 'homes', `a5m2fsbr-${runId}`)
  mkdirSync(worldRoot, { recursive: true })
})

afterAll(() => {
  rmSync(worldRoot, { recursive: true, force: true })
})

// ── helpers ────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random bytes. The header is a deliberately INVALID
 *  utf8 sequence set (0xFF/0xFE never valid; C3 28 invalid continuation;
 *  E2 82 truncated; 80 BF stray continuations; NUL/0x01 controls), so the
 *  source is provably NOT utf8-round-trippable for every length ≥ 12. */
function mkBinaryBytes(len: number, seed: number): Uint8Array {
  const b = new Uint8Array(len)
  let x = seed >>> 0
  for (let i = 0; i < len; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    b[i] = (x >>> 24) & 0xff
  }
  const header = new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0xc3, 0x28, 0xe2, 0x82, 0xf6, 0x00, 0x80, 0xbf])
  b.set(header.subarray(0, Math.min(header.length, len)), 0)
  return b
}

/** Write a real temp file, return its path. */
function mkFile(name: string, bytes: Uint8Array): string {
  const dir = mkdtempSync(path.join(worldRoot, `${name}-`))
  const p = path.join(dir, 'target.bin')
  writeFileSync(p, bytes)
  return p
}

/** Drive the kernel through a REAL fd on a real file. */
async function readViaRealFd(filePath: string, opts: { maxBytes: number; signal?: { readonly aborted?: boolean }; chunkBytes?: number }) {
  const handle = await fsOpen(filePath, 'r')
  try {
    return await readBoundedBytes(handle, opts)
  } finally {
    await handle.close()
  }
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

type KernelOutcome = Awaited<ReturnType<typeof readBoundedBytes>>

function expectOk(r: KernelOutcome): { bytes: Uint8Array; byteLength: number } {
  if (r.ok !== true) throw new Error(`expected ok:true, got cancelled at byteLength=${String(r.byteLength)}`)
  return r
}

function expectCancelled(r: KernelOutcome): { byteLength: number } {
  if (r.ok !== false) throw new Error('expected ok:false, got an ok:true answer')
  expect(r.kind).toBe('cancelled')
  return r
}

// ── ① in-cap full read: raw bytes, byte-exact, not a utf8 round-trip ──────

describe('a5m2 fs-bounded-read — ① in-cap reads answer raw bytes', () => {
  it('T1 a <cap non-utf8 binary file comes back BYTE-EXACT (raw fidelity, no utf8 round-trip, no preallocated tail)', async () => {
    const src = mkBinaryBytes(1000, 0xc0ffee)
    // the source is genuinely NOT utf8: a fatal decode provably throws, so
    // byte-equality below can only be reached without any utf8 leg.
    expect(() => new TextDecoder('utf8', { fatal: true }).decode(src)).toThrow()
    const p = mkFile('t1', src)
    const r = expectOk(await readViaRealFd(p, { maxBytes: 4096 })) // default chunkBytes
    expect(r.bytes).toBeInstanceOf(Uint8Array)
    expect(r.byteLength).toBe(1000)
    // NOT a preallocated buffer: length is the OBSERVED count, not the cap
    // (4096+1) and not the scratch size (65536) — no trailing zeros.
    expect(r.bytes.length).toBe(1000)
    expect(r.bytes.length).toBe(r.byteLength)
    expect(Buffer.from(r.bytes).equals(Buffer.from(src))).toBe(true)
    expect(sha256Hex(r.bytes)).toBe(sha256Hex(src))
  })
})

// ── ② / ③ the exact cap boundary ──────────────────────────────────────────

describe('a5m2 fs-bounded-read — ②③ the exact cap boundary is a fact, not a refusal', () => {
  it('T2 file == cap passes with byteLength === cap (multi-chunk, last chunk partial)', async () => {
    const src = mkBinaryBytes(1024, 0x5eed)
    const p = mkFile('t2', src)
    const r = expectOk(await readViaRealFd(p, { maxBytes: 1024, chunkBytes: 300 }))
    expect(r.byteLength).toBe(1024)
    expect(r.bytes.length).toBe(1024)
    expect(Buffer.from(r.bytes).equals(Buffer.from(src))).toBe(true)
  })

  it('T3 file == cap+1 answers ok:true, byteLength === cap+1, NOTHING TRUNCATED (the ring stops at the fact; the stop itself is pinned by T4)', async () => {
    const src = mkBinaryBytes(1025, 0xbeef)
    const p = mkFile('t3', src)
    const r = expectOk(await readViaRealFd(p, { maxBytes: 1024, chunkBytes: 300 }))
    // the kernel does NOT refuse over-cap: it answers the observed fact.
    expect(r.byteLength).toBe(1025)
    expect(r.byteLength).toBe(1024 + 1)
    // nothing truncated: the answer equals the WHOLE file, byte for byte.
    expect(r.bytes.length).toBe(1025)
    expect(Buffer.from(r.bytes).equals(Buffer.from(src))).toBe(true)
  })
})

// ── ④ far above cap: stop at cap+1, do not slurp ──────────────────────────

describe('a5m2 fs-bounded-read — ④ a far-larger file still answers EXACTLY cap+1', () => {
  it('T4 65543-byte file against a 1024-byte cap: byteLength === 1025 exactly, bytes are the first cap+1, the whole file was NOT slurped', async () => {
    const src = mkBinaryBytes(64 * 1024 + 7, 0xd00d)
    const p = mkFile('t4', src)
    const r = expectOk(await readViaRealFd(p, { maxBytes: 1024 })) // default chunk 65536
    expect(r.byteLength).toBe(1025) // cap+1, exact — no more
    expect(r.bytes.length).toBe(1025)
    expect(Buffer.from(r.bytes).equals(Buffer.from(src.subarray(0, 1025)))).toBe(true)
    // stop, not slurp: the returned prefix differs from the whole file…
    expect(sha256Hex(r.bytes)).not.toBe(sha256Hex(src))
    // …and the fd-backed file is untouched with all its bytes (read-only).
    expect(readFileSync(p).length).toBe(64 * 1024 + 7)
  })
})

// ── ⑤ true short reads / EOF probes are metered by ACTUAL bytesRead ───────

describe('a5m2 fs-bounded-read — ⑤ short reads / EOF probes never fake an over-cap fact', () => {
  it('T5 9-byte file, maxBytes 10, chunk 4: reads 4+4+1 (TRUE short read) then a 0-byte EOF probe; byteLength is the TRUTH 9 — requested-based counting would have answered 11 (>cap)', async () => {
    const src = mkBinaryBytes(9, 0x0dd)
    const p = mkFile('t5', src)
    const r = expectOk(await readViaRealFd(p, { maxBytes: 10, chunkBytes: 4 }))
    // The ring: want 4→read 4, want 4→read 4, want min(4,3)=3→file holds 1
    // byte→ACTUAL short read 1, then want min(4,2)=2→EOF probe 0→break.
    // Actual metering: 9. Requested metering (the forbidden law): 4+4+3=11
    // — a 9-byte file would falsely look larger than the 10-byte cap.
    expect(r.byteLength).toBe(9)
    expect(r.bytes.length).toBe(9)
    expect(Buffer.from(r.bytes).equals(Buffer.from(src))).toBe(true)
  })
})

// ── ⑥ cancellation ─────────────────────────────────────────────────────────

describe('a5m2 fs-bounded-read — ⑥ cooperative per-chunk cancellation', () => {
  it('T6a pre-aborted structural signal: cancelled with byteLength 0 (the check runs before the FIRST chunk)', async () => {
    const src = mkBinaryBytes(64, 0x1)
    const p = mkFile('t6a', src)
    const r = expectCancelled(await readViaRealFd(p, { maxBytes: 1000, signal: { aborted: true } }))
    expect(r.byteLength).toBe(0)
  })

  it('T6b getter signal flipping at the 4th check: cancelled with EXACTLY the OBSERVED count (3 completed 4-byte chunks = 12)', async () => {
    const src = mkBinaryBytes(64, 0x2)
    const p = mkFile('t6b', src)
    let checks = 0
    const signal = {
      get aborted(): boolean {
        checks += 1
        return checks > 3
      },
    }
    const r = expectCancelled(await readViaRealFd(p, { maxBytes: 1000, chunkBytes: 4, signal }))
    // checks 1..3 read one chunk each (4+4+4); the 4th check cancels — the
    // answered count is the truth of what was ACTUALLY read: exactly 12.
    expect(r.byteLength).toBe(12)
    expect(checks).toBe(4)
  })

  it('T6c real AbortController aborting mid-ring: cancelled, honest partial count (multiple of the chunk quantum, strictly below the cap+1 stop)', async () => {
    const src = mkBinaryBytes(64 * 1024, 0x3)
    const p = mkFile('t6c', src)
    const ac = new AbortController()
    setTimeout(() => { ac.abort() }, 0)
    const r = expectCancelled(await readViaRealFd(p, { maxBytes: 60000, chunkBytes: 4, signal: ac.signal }))
    // An uncapped run would have answered ok at 60001; the abort landed
    // first, so the answer is the OBSERVED partial count — every completed
    // read here moved a full 4-byte chunk (file >> cap), so the truth of
    // the count is pinned by the chunk quantum and the stop bound.
    expect(r.byteLength).toBeGreaterThanOrEqual(0)
    expect(r.byteLength % 4).toBe(0)
    expect(r.byteLength).toBeLessThan(60001)
  })

  it('T6d signal present but NOT aborted changes nothing (plain object and real AbortSignal)', async () => {
    const src = mkBinaryBytes(1000, 0x4)
    const p = mkFile('t6d', src)
    const r1 = expectOk(await readViaRealFd(p, { maxBytes: 2048, signal: { aborted: false } }))
    expect(r1.byteLength).toBe(1000)
    expect(Buffer.from(r1.bytes).equals(Buffer.from(src))).toBe(true)
    const ac = new AbortController()
    const r2 = expectOk(await readViaRealFd(p, { maxBytes: 2048, signal: ac.signal }))
    expect(r2.byteLength).toBe(1000)
    expect(Buffer.from(r2.bytes).equals(Buffer.from(src))).toBe(true)
  })
})

// ── ⑦ chunkBytes < cap: accumulation across chunk boundaries ──────────────

describe('a5m2 fs-bounded-read — ⑦ multi-chunk accumulation crosses boundaries correctly', () => {
  it('T7 1000-byte chunks against a 5001-byte ring: 5 full chunks + a 1-byte final chunk = 5001 exactly', async () => {
    const src = mkBinaryBytes(12345, 0x7e57)
    const p = mkFile('t7', src)
    const r = expectOk(await readViaRealFd(p, { maxBytes: 5000, chunkBytes: 1000 }))
    expect(r.byteLength).toBe(5001) // 5×1000 + 1, cap+1 exact
    expect(r.bytes.length).toBe(5001)
    expect(Buffer.from(r.bytes).equals(Buffer.from(src.subarray(0, 5001)))).toBe(true)
    expect(sha256Hex(r.bytes)).toBe(sha256Hex(src.subarray(0, 5001)))
  })

  it('T7b the DEFAULT 65536 chunk against a 100001-byte ring: 65536 + 34465 = 100001 (cap+1) across the default-chunk boundary', async () => {
    const src = mkBinaryBytes(200000, 0x9e37)
    const p = mkFile('t7b', src)
    const r = expectOk(await readViaRealFd(p, { maxBytes: 100000 }))
    expect(r.byteLength).toBe(100001)
    expect(r.bytes.length).toBe(100001)
    expect(Buffer.from(r.bytes).equals(Buffer.from(src.subarray(0, 100001)))).toBe(true)
  })
})

// ── T8 structural law of the kernel, pinned on the source text ─────────────

describe('a5m2 fs-bounded-read — T8 kernel structural law (zero open / zero consume / zero wording)', () => {
  it('T8 single export; type-only import; no open/realpath/stat/utf8/Buffer/path/ledger/consume face; the only ok:false arm is cancelled', () => {
    const raw = readFileSync(path.resolve(__dirname, '..', 'controlled-fs', 'src', 'bounded-bytes-read.ts'), 'utf8')
    // strip block + line comments so the check reads CODE, not disclosure text
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    // single export, and it is the kernel
    expect((code.match(/^export\b/gm) ?? []).length).toBe(1)
    expect(code).toContain('export async function readBoundedBytes')
    // the only import is the ERASED type import — zero runtime imports
    expect((code.match(/\bimport\b/g) ?? []).length).toBe(1)
    expect(/import type \{ FileHandle \} from 'node:fs\/promises'/.test(code)).toBe(true)
    // zero open / zero realpath-stat / zero path / zero decode / zero buffer
    for (const forbidden of [/\bopen\b/, /\bopenSync\b/, /\bopendir\b/, /\brealpath/i, /\bstat\b/, /\blstat\b/, /\bfstat\b/, /\bpath\b/i, /\butf8\b/i, /\butf-8\b/i, /TextDecoder/, /TextEncoder/, /\bBuffer\b/, /\btoString\b/, /\bslice\('?,?utf8/i]) {
      expect(forbidden.test(code), `kernel code must not match ${String(forbidden)}`).toBe(false)
    }
    // zero ledger / zero consume / zero grant / no refusal wording of its own
    for (const forbidden of [/\bconsume/i, /\bledger\b/i, /\bgrant/i, /\brefus/i, /TOO_LARGE/i, /too-large/i, /\bcode\b/, /\bdetail\b/, /\bdrift\b/i]) {
      expect(forbidden.test(code), `kernel code must not match ${String(forbidden)}`).toBe(false)
    }
    // the ONLY negative answer is the cancellation fact
    expect((code.match(/ok: false/g) ?? []).length).toBe((code.match(/kind: 'cancelled'/g) ?? []).length)
    expect((code.match(/kind: 'cancelled'/g) ?? []).length).toBeGreaterThanOrEqual(2) // type + return
  })
})
