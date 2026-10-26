/**
 * a5-read-slice-window.test.ts — Alpha.5 READ slice: the governed `read` row
 * finally CONSUMES its window (offset/limit), returns the native result shape,
 * throws typed refusals, and bounds its byte fetch at MAX_READ_BYTES+1 on the
 * SAME verified handle (post-verify growth can no longer disclose past the cap).
 *
 * PLAN: dev/agent-workflow/evidence/alpha5/READ-SLICE-PLAN.md rev4
 * (sha256 36e8c24242c3f2b18c8d122806a1347975e58304a1eb39967c2faff024e715d4).
 * Case IDs W1-W9 / T1-T2 / D1-D7 / F1-F2 / C1-C1c / Z1-Z2 / P1-P4 are the
 * plan's (b) table. Discipline (plan (b) RED-judgement rules):
 *  - RED legs = this slice's NEW assertions, false on the SCOPE-P baseline;
 *  - GUARD legs = pre-existing safety/shape, green on the baseline and after;
 *  - the ONLY real size-family RED is D6c (verify-then-growth); static
 *    over-cap files (D6b) are refused pre-byte on BOTH generations (guard);
 *  - W9 is the candidate-side short-read CHARACTERIZATION (防 requested-as-
 *    judgement), not a baseline RED;
 *  - every "zero I/O" claim here means "this executor path did not resolve/
 *    open/read", evidenced ONLY by the LOCAL spies (execCount() + the armed
 *    open/handle wrappers this file installs); it never claims Host-wide zero.
 *
 * INJECTION FACE (plan A-5, first-of-its-kind in this repo — risk R-7):
 * `vi.mock('node:fs/promises')` wraps `open` BY DEFAULT TRANSPARENT (real
 * receiver, verbatim args/this); when armed, it performs one fixed-point
 * action (pre-open swap) and/or wraps the RETURNED REAL HANDLE with
 * instance-level `readFile` + `read` (both generations: baseline reads via
 * readFile, the candidate reads via the bounded read ring) and `close`
 * counters. Every armed leg asserts its entry-level arm was CONSUMED —
 * unconsumed = the injection never landed = the leg goes RED, never silently
 * green. No production hook, no new permission face, no C-FS lane seam reuse.
 *
 * Scope honesty (plan C-4): unit production-backend path only (assembly ->
 * production provider -> executor, in-process). Real Host boot / live kit:
 * NOT RUN. NOT VERIFIED items are stated in the slice report, never here.
 */
import { approvingControlLeg } from './a5-m1-control-legs.mjs'
import { describe, beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest'
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

// REVIEW-R1 B1 (R-REM-2.2 / FIX-K K3): the kernel lifecycle port is ONLY the
// dispatcher's ledger — production passes the Guard handle's pendingCalls
// (agent-bindings). These executor-level legs never install a dispatcher, so
// this holder never settles a handle: the port reads the same wiring's honest
// empty-ledger zero. No family-local counter, no faked number.
const dispatchLedger: { current?: { pendingCalls(): readonly unknown[] } } = {}


// ---------------------------------------------------------------------------
// Injection state (hoisted above vi.mock — the factory closes over this).
// ---------------------------------------------------------------------------
interface ReadLog { want: number; delegated: number; bytesRead: number }
interface ByteArm {
  entries: Set<'read' | 'readFile'>
  action: () => void | Promise<void>
  consumed: boolean
  consumedEntry: 'read' | 'readFile' | null
}
const H = vi.hoisted(() => ({
  openCalls: 0,
  readFileCalls: 0,
  readCalls: 0,
  closeCalls: 0,
  requestedBytes: 0,
  delegatedBytes: 0,
  bytesReadTotal: 0,
  reads: [] as ReadLog[],
  preOpenAction: null as null | ((args: unknown[]) => void | Promise<void>),
  preOpenConsumed: false,
  byteArm: null as null | ByteArm,
  quarterRead: false,
  reset() {
    this.openCalls = 0
    this.readFileCalls = 0
    this.readCalls = 0
    this.closeCalls = 0
    this.requestedBytes = 0
    this.delegatedBytes = 0
    this.bytesReadTotal = 0
    this.reads = []
    this.preOpenAction = null
    this.preOpenConsumed = false
    this.byteArm = null
    this.quarterRead = false
  },
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>() as {
    open: (...args: unknown[]) => Promise<unknown>
  }
  const fireByteArm = async (entry: 'read' | 'readFile'): Promise<void> => {
    const arm = H.byteArm
    if (arm !== null && !arm.consumed && arm.entries.has(entry)) {
      arm.consumed = true
      arm.consumedEntry = entry
      await arm.action()
    }
  }
  // Instance-level wrappers on the REAL handle (never FileHandle.prototype):
  // save the real methods, delegate on the real receiver, keep the real FD.
  // Typed WITHOUT `any`: the handle is a bag of unknowns; each method is
  // runtime-checked once (throwing loudly if a real FileHandle ever lacks
  // it) and then carried under an explicit signature.
  type ReadFileFn = (...args: unknown[]) => Promise<unknown>
  type ReadFn = (buffer: Uint8Array, offset: number, length: number, position: number | null) =>
    Promise<{ bytesRead: number; buffer: Uint8Array }>
  type CloseFn = () => Promise<void>
  const pickMethod = <T,>(value: unknown, label: string): T => {
    if (typeof value !== 'function') {
      throw new TypeError(`a5rsw harness: the real FileHandle is missing ${label}()`)
    }
    return value as T
  }
  const wrapHandle = (handle: Record<string, unknown>): Record<string, unknown> => {
    const readFile = pickMethod<ReadFileFn>(handle.readFile, 'readFile').bind(handle)
    const read = pickMethod<ReadFn>(handle.read, 'read').bind(handle)
    const close = pickMethod<CloseFn>(handle.close, 'close').bind(handle)
    handle.readFile = async (...args: unknown[]) => {
      H.readFileCalls += 1
      await fireByteArm('readFile')
      return readFile(...args)
    }
    handle.read = async (buffer: Uint8Array, offset: number, length: number, position: number | null) => {
      H.readCalls += 1
      // mustfix #3 — TRUE short delegation (NO full-read-then-fabricate).
      // In quarter mode the REAL underlying read is invoked with a SHORT
      // length (ceil(want/4)); we never fetch `want` bytes and relabel the
      // count. The production ring advances by the EXPLICIT position, so the
      // remainder is fetched on the next call at the correct offset — content
      // stays byte-identical to a full read while the ring really runs more
      // times. Three meters are recorded per call:
      //   want      = bytes the ring ASKED for (caller-visible),
      //   delegated = length we ACTUALLY passed to the real read,
      //   bytesRead = bytes the real read ACTUALLY returned.
      const want = length
      const delegated = H.quarterRead && typeof want === 'number' && want > 0
        ? Math.max(1, Math.ceil(want / 4))
        : want
      if (typeof want === 'number') {
        H.requestedBytes += want
        H.delegatedBytes += delegated
        H.reads.push({ want, delegated, bytesRead: -1 })
      }
      await fireByteArm('read')
      const r = await read(buffer, offset, delegated, position)
      // The REAL returned count is surfaced untouched — no re-clamping.
      const logged = H.reads[H.reads.length - 1]
      if (logged !== undefined && logged.bytesRead === -1) logged.bytesRead = r.bytesRead
      H.bytesReadTotal += r.bytesRead
      return r
    }
    handle.close = async () => {
      H.closeCalls += 1
      return close()
    }
    return handle
  }
  const open = async (...args: unknown[]) => {
    H.openCalls += 1
    if (typeof H.preOpenAction === 'function') {
      const act = H.preOpenAction
      H.preOpenAction = null
      H.preOpenConsumed = true
      await act(args)
    }
    const handle = await actual.open(...args)
    return wrapHandle(handle as Record<string, unknown>)
  }
  return { ...actual, open }
})

// ---------------------------------------------------------------------------
// World + plane (glue7 buildPlane form; read-only legs need no launcher).
// ---------------------------------------------------------------------------
const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD = join(REPO, 'tests/homes', `a5rsw-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside') // never inside any governed root
const BACKUP_DIR = join(WORLD, 'backup') // swap-out landing zone (outside root)
const LINKS_DIR = join(WORLD, 'links') // symlinks pointing OUTSIDE live here
const REALM = 'a5rsw-unit-realm'
const MAX_READ_BYTES = 1024 * 1024 // mirrored production constant (fs-family/src/fs-mechanics.mjs:30)
const LINE_CAP = 2000
const OUTSIDE_TOKEN = 'A5RSW-OUTSIDE-SECRET-42'

/**
 * The consumed face of the fs-family lane's governed `read` executor
 * (`packages/tools/fs-family/src/index.mjs` — the row's single home since U6
 * PR2; the center re-export hub and its ADJACENT `.d.mts` type surface were
 * deleted at U6 PR6, so the typed surface this suite consumed is declared
 * HERE at the consumer, exactly the minimal face the legs use — the same
 * `.mjs` + local-declaration pattern, never a widening to `any`).
 *
 * The governed `read` executor: a callable that RESOLVES a discriminated
 * ok/refused outcome — refusals come back as VALUES from the executor; the
 * THROW transport lives in the OUTER read def, not here.
 */
interface GovernedReadExecutor {
  (raw: unknown, corr?: unknown): Promise<unknown>
  /** BYTE-FETCH-STAGE ENTRY count: incremented when a call ENTERS the
   *  byte-reading stage (after admission). NOT a syscall meter, NOT a
   *  completion meter, and by itself NOT evidence of zero I/O. */
  execCount(): number
  /** A5-M2 pre-dispatch leg: run ONLY the PA admission (Part A) for this
   *  execution token and hold the answer for its body; never reads a byte. */
  paHandoffOpen(raw: unknown, corr?: unknown): Promise<unknown>
  /** The terminal close: idempotent, synchronous, terminal. */
  paHandoffClose(token: unknown): string | undefined
  /** Mount teardown: no hand-off survives its mount. */
  paHandoffCloseAll(): void
}
/** The ONE face of the lane barrel this suite imports (SCOPE HONESTY: the
 *  lane exports more at runtime; nothing here is widened to `any`). */
interface FsFamilyReadFace {
  createGovernedReadExecutor(input: Record<string, unknown>): GovernedReadExecutor
}

type ReadWindowOk = {
  path: string
  offset: number
  lines: Array<{ number: number; text: string }>
  totalLines: number
}
interface ReadDef {
  name: string
  description?: string
  parameters?: unknown
  execute: (raw: unknown) => Promise<unknown>
  presentResult?: (args: unknown, result: unknown) => { card?: string } | undefined
  output?: {
    schema: Record<string, unknown>
    render: (args: unknown, value: unknown) => Array<{ type: string; text: string }>
    presentationMeta?: (args: unknown, value: unknown) => Record<string, unknown>
  }
}
interface PlaneValue {
  definitions: ReadonlyArray<ReadDef>
  ownNames: readonly string[]
  backends: { read?: { execCount(): number } }
  placementFeed?: (name: string) => { definitionIdentity: string; realmId: string } | undefined
  realmId: string
}
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
}

let row: PlaneRow
let ROOT_REAL = ROOT_DIR

function buildPlane(input: {
  plane: Record<string, unknown>
  permissionPolicy: unknown
  realmId?: string
  /** M1 carry: P4 pins the NO-SEAM refusal law; its world opts out of the kit seam. */
  noSeam?: boolean
}): { built: ReturnType<PlaneRow['createTeamToolPlaneAssembly']>; rows: string[] } {
  const rows: string[] = []
  const built = row.createTeamToolPlaneAssembly({
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

      teamSessionId: 'a5m1-test-team-root',
    controlLeg: approvingControlLeg(),
    ...(input.noSeam === true ? {} : { fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/') } }),
    permissionPolicy: input.permissionPolicy,
    realmId: input.realmId ?? REALM,
    templateId: 'a5rsw-tpl',
    role: 'member',
    instanceId: 'a5rsw-instance',
    onObserve: (r: string) => rows.push(String(r)),
    plane: input.plane,
  })
  return { built, rows }
}

function planeOk(built: ReturnType<PlaneRow['createTeamToolPlaneAssembly']>): PlaneValue {
  expect(built.ok, JSON.stringify(built)).toBe(true)
  if (!built.ok) throw new Error('unreachable')
  return built.value
}
function readDefOf(value: PlaneValue): ReadDef {
  const d = value.definitions.find((x) => x.name === 'read')
  if (d === undefined) throw new Error(`no read def (ownNames=${value.ownNames.join(',')})`)
  return d
}
function fsInstance(over: Record<string, unknown> = {}) {
  return { fs: 'a5rsw-ctl', rootDir: ROOT_REAL, realmId: REALM, kind: 'absolute-path', ...over }
}
/** Main positive-control policy (plan (b) 装配基式): default deny + ONE exact
 *  rule carrying the SAME canonical absolute spelling (realpath form). */
function exactPolicy(canonicalPath: string) {
  return {
    default: 'deny',
    allow: [{ tool: 'read', resource: { kind: 'exact', path: canonicalPath } }],
    ask: [] as unknown[],
    deny: [] as unknown[],
  }
}
const exactPlane = (policy: unknown) => buildPlane({ plane: { fsInstance: fsInstance() }, permissionPolicy: policy })

/** Settle a def.execute call either way (generation-agnostic capture). */
async function settle(fn: () => Promise<unknown>): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  try {
    return { ok: true, value: await fn() }
  } catch (error: unknown) {
    return { ok: false, message: String((error as Error)?.message ?? error) }
  }
}
/** Refusal text whether the generation resolves with the legacy {text} (def
 *  transport), a bare string (direct executor on the baseline), or throws
 *  (S2). undefined = the call SUCCEEDED. */
function refusalText(res: Awaited<ReturnType<typeof settle>>): string | undefined {
  if (!res.ok) return res.message
  if (typeof res.value === 'string') return res.value.startsWith('refused') ? res.value : undefined
  const text = (res.value as { text?: unknown })?.text
  return typeof text === 'string' && text.startsWith('refused') ? text : undefined
}
function asWindow(value: unknown): ReadWindowOk {
  expect(typeof value, 'success value must be an object').toBe('object')
  const v = value as ReadWindowOk
  expect(Array.isArray(v?.lines), 'native window: lines[]').toBe(true)
  return v
}

/** Harness indexing narrowing (noUncheckedIndexedAccess): a missing entry
 *  is a LOUD red (shape violation fails the test), never a swallow. */
function mustFirst<T>(entries: readonly T[], what: string): T {
  const value = entries[0]
  if (value === undefined) throw new Error(`a5rsw harness: ${what} produced no first entry`)
  return value
}

function lineFile(path: string, count: number, width = 3): string {
  const out: string[] = []
  for (let i = 1; i <= count; i += 1) out.push(`L${String(i).padStart(width, '0')}`)
  const body = `${out.join('\n')}\n`
  writeFileSync(path, body)
  return body
}

// ---------------------------------------------------------------------------
// Z1/Z2 inline baseline snapshot (SCOPE-P 5b39cab1, captured pre-change by a
// one-shot scratch run; receipt: .probe-plan-tmp/r23-launch/read-tdd/
// z1-trio-snapshot.json). The trio rows must stay BYTE-IDENTICAL.
// ---------------------------------------------------------------------------
const TRIO_BASELINE_SNAPSHOT = '[[{"name":"team_grep","description":"Governed search (a5p5 lane): strict pattern search over the realm; effects derived read-time, admission-gated before any backend runs.","parameters":{"type":"object","properties":{"pattern":{"type":"string"},"path":{"type":"string"},"glob":{"type":"string"},"output_mode":{"type":"string","enum":["content","files_with_matches","count"]},"fixed_string":{"type":"boolean"},"ignore_case":{"type":"boolean"},"multiline":{"type":"boolean"},"context":{"type":"integer","minimum":0,"maximum":20},"max_results":{"type":"integer","minimum":1,"maximum":5000}},"required":["pattern"],"additionalProperties":false}},{"name":"team_glob","description":"Governed filename traversal (a5p5 lane): pattern + target ONLY; admission-gated before any backend runs.","parameters":{"type":"object","properties":{"pattern":{"type":"string"},"path":{"type":"string"}},"required":["pattern"],"additionalProperties":false}},{"name":"team_bash","description":"Governed shell (a5p5 lane): opaque command text decided by admission + the confined backend; deny-before-backend.","parameters":{"type":"object","properties":{"command":{"type":"string"},"cwd":{"type":"string"},"timeout":{"type":"integer","minimum":1,"maximum":600000},"background":{"type":"boolean"}},"required":["command"],"additionalProperties":false}}]]'

function trioSerialization(value: PlaneValue): string {
  const trio = ['team_grep', 'team_glob', 'team_bash'].map((n) => {
    const d = value.definitions.find((x) => x.name === n)
    expect(d, `trio def ${n} present`).toBeTruthy()
    return { name: d!.name, description: d!.description, parameters: d!.parameters }
  })
  return JSON.stringify([trio])
}

// ---------------------------------------------------------------------------
// Fixtures (built once; per-test worlds never leave WORLD).
// ---------------------------------------------------------------------------
const F = {
  w1: '', w2: '', w3: '', w4: '', w5: '', w6: '', w8: '',
  status: '', inside: '',
}

beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(join(ROOT_DIR, 'reports'), { recursive: true })
  mkdirSync(join(ROOT_DIR, 'sub'), { recursive: true })
  mkdirSync(join(ROOT_DIR, 'd3dir'), { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  mkdirSync(BACKUP_DIR, { recursive: true })
  mkdirSync(LINKS_DIR, { recursive: true })
  ROOT_REAL = realpathSync(ROOT_DIR)

  F.w1 = lineFile(join(ROOT_REAL, 'w1.txt'), 40)
  F.w2 = lineFile(join(ROOT_REAL, 'w2.txt'), 2050)
  F.w3 = lineFile(join(ROOT_REAL, 'w3.txt'), 20)
  writeFileSync(join(ROOT_REAL, 'w4.txt'), '')
  F.w4 = ''
  writeFileSync(join(ROOT_REAL, 'w5.txt'), 'a\r\nb\r\n')
  F.w5 = 'a\r\nb\r\n'
  // 40 multibyte lines (CJK + emoji families, widths mixed).
  const mb: string[] = []
  for (let i = 1; i <= 40; i += 1) mb.push(`行-${i}-あいうえお-🙂tail`)
  writeFileSync(join(ROOT_REAL, 'w6.txt'), `${mb.join('\n')}\n`)
  F.w6 = mb.join('\n')
  writeFileSync(join(ROOT_REAL, 'w7.txt'), `${'a'.repeat(3000)}\n`)
  F.w8 = `${Array.from({ length: 300 }, (_, i) => `B${String(i).padStart(3, '0')}${'B'.repeat(196)}`).join('\n')}\n`
  writeFileSync(join(ROOT_REAL, 'w8.txt'), F.w8)
  writeFileSync(join(ROOT_REAL, 't-a'), 'TOK-A-PLAIN-77\n')
  writeFileSync(join(ROOT_REAL, 't-a '), 'TOK-A-TRAILSPACE-91\n')
  writeFileSync(join(ROOT_REAL, 'reports', 'status.txt'), 'STATUS-OK-L1\nSTATUS-L2\nSTATUS-L3\n')
  writeFileSync(join(ROOT_REAL, 'sub', 'inside.txt'), 'A5RSW-SUB-INSIDE-1\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), `${OUTSIDE_TOKEN}\n`)
  // Size family.
  writeFileSync(join(ROOT_REAL, 'size-cap.bin'), `${'A'.repeat(MAX_READ_BYTES - 1)}\n`)
  writeFileSync(join(ROOT_REAL, 'size-capplus1.bin'), `${'A'.repeat(MAX_READ_BYTES)}\n`)
  writeFileSync(join(ROOT_REAL, 'size-4mib.bin'), Buffer.alloc(4 * MAX_READ_BYTES, 0x43))
  // W9: 500000 bytes of 50-byte lines (+short tail).
  const w9lines: string[] = []
  for (let i = 1; i <= 9803; i += 1) w9lines.push(`w9-${String(i).padStart(5, '0')}${'x'.repeat(43 - String(i).length)}`)
  writeFileSync(join(ROOT_REAL, 'w9.txt'), `${w9lines.join('\n')}\n`)
})

afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

beforeEach(() => {
  H.reset()
})

// ===========================================================================
// W — window consumption + native shape (RED family: the baseline ignores
// offset/limit entirely and resolves { text: <whole file> }).
// ===========================================================================
describe('A5RSW W window (plan (b) W1-W9)', () => {
  it('W1 windowed positive read (offset 20 limit 15): native lines 20..34 of 40', async () => {
    const canonical = join(ROOT_REAL, 'w1.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: canonical, offset: 20, limit: 15 }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    expect(w.path).toBe(canonical)
    expect(w.offset).toBe(20)
    expect(mustFirst(w.lines, 'the window lines')).toEqual({ number: 20, text: 'L020' })
    expect(w.lines.at(-1)).toEqual({ number: 34, text: 'L034' })
    expect(w.lines.length).toBe(15)
    expect(w.totalLines).toBe(40)
    expect(Object.keys(w).sort()).toEqual(['lines', 'offset', 'path', 'totalLines'])
    const rendered = readDefOf(value).output!.render({ file_path: canonical, offset: 20, limit: 15 }, w)
    expect(rendered).toHaveLength(1)
    expect(mustFirst(rendered, 'the render face').text).toContain('(Showing lines 20-34 of 40. Use offset=35 to continue.)')
  })

  it('W2 default window: omitted offset/limit -> lines 1..2000 of 2050 (deployment cap 2000)', async () => {
    const canonical = join(ROOT_REAL, 'w2.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: canonical }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    expect(w.offset).toBe(1)
    expect(w.lines.length).toBe(2000)
    expect(mustFirst(w.lines, 'the window lines').number).toBe(1)
    expect(w.lines.at(-1)!.number).toBe(2000)
    expect(w.totalLines).toBe(2050)
    const rendered = readDefOf(value).output!.render({ file_path: canonical }, w)
    expect(mustFirst(rendered, 'the render face').text).toContain('Use offset=2001 to continue.')
  })

  it('W3 offset past EOF is refused (mirror of finish(): offset 21 of 20 lines), zero content', async () => {
    const canonical = join(ROOT_REAL, 'w3.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: canonical, offset: 21 }))
    expect(res.ok).toBe(false)
    const msg = (res as { message: string }).message
    expect(msg).toContain('(20 lines)')
    expect(msg).not.toContain('L001') // zero content smuggled through
  })

  it('W4 empty file: lines [] totalLines 0 + EOF footer; offset 2 refused (empty+offset1 exception reversed)', async () => {
    const canonical = join(ROOT_REAL, 'w4.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: canonical }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    expect(w.lines).toEqual([])
    expect(w.totalLines).toBe(0)
    const rendered = readDefOf(value).output!.render({ file_path: canonical }, w)
    expect(mustFirst(rendered, 'the render face').text).toContain('(End of file - total 0 lines)')
    await expect(readDefOf(value).execute({ file_path: canonical, offset: 2 })).rejects.toThrow(/offset 2 is out of range/)
  })

  it('W5 CRLF: trailing \\r stripped before counting, totalLines 2', async () => {
    const canonical = join(ROOT_REAL, 'w5.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: canonical }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    expect(w.lines).toEqual([
      { number: 1, text: 'a' },
      { number: 2, text: 'b' },
    ])
    expect(w.totalLines).toBe(2)
  })

  it('W6 UTF-8 multibyte across window bounds: decode-whole-then-split lines exact (no byte-slice mojibake)', async () => {
    const canonical = join(ROOT_REAL, 'w6.txt')
    const expected = F.w6.split('\n').slice(4, 14).map((text, i) => ({ number: i + 5, text }))
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: canonical, offset: 5, limit: 10 }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    expect(w.lines).toEqual(expected)
    expect(w.totalLines).toBe(40)
    expect(JSON.stringify(w)).not.toContain('\uFFFD')
  })

  it('W7 over-long line: 3000 chars truncate to 2000 + verbatim ASCII suffix (… never)', async () => {
    const canonical = join(ROOT_REAL, 'w7.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: canonical }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    const suffix = '... (line truncated to 2000 chars)'
    const only = mustFirst(w.lines, 'the window lines')
    expect(only.number).toBe(1)
    expect(only.text.endsWith(suffix)).toBe(true)
    expect(only.text).not.toContain('\u2026') // ASCII dots, not U+2026
    expect(only.text.length).toBe(2000 + suffix.length)
    expect(w.totalLines).toBe(1)
  })

  it('W8 output byte cap: capped footer state (no "of Z"), lines < effective limit, NO truncatedByBytes in the result', async () => {
    const canonical = join(ROOT_REAL, 'w8.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: canonical, limit: 300 }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    expect('truncatedByBytes' in w).toBe(false)
    expect(w.lines.length).toBeLessThan(300)
    expect(w.totalLines).toBe(300)
    const last = w.lines.at(-1)!.number
    const rendered = readDefOf(value).output!.render({ file_path: canonical, limit: 300 }, w)
    expect(mustFirst(rendered, 'the render face').text).toContain(`(Output capped. Showing lines 1-${last}. Use offset=${last + 1} to continue.)`)
    expect(mustFirst(rendered, 'the render face').text).not.toContain(` of ${w.totalLines}. Use offset=${last + 1}`)
  })

  // W9 is the CANDIDATE-side short-read CHARACTERIZATION (plan E4 [rev4]
  // metering law): quarter-reporting `read` wrapper — content/totalLines stay
  // full-read-equal while cumulative REQUESTED passes MAX+1. Guards against
  // an implementation that (mis)uses `requested` as the refusal judgement.
  it('W9 short-read characterization: quarter reads change nothing; requested may exceed cap+1', async () => {
    const canonical = join(ROOT_REAL, 'w9.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const fullRes = await settle(() => readDefOf(value).execute({ file_path: canonical }))
    expect(fullRes.ok, JSON.stringify(fullRes)).toBe(true)
    const full = asWindow((fullRes as { value: unknown }).value)
    const opensAfterFull = H.openCalls
    const readsBefore = H.reads.length
    H.quarterRead = true
    const shortRes = await settle(() => readDefOf(value).execute({ file_path: canonical }))
    expect(shortRes.ok, JSON.stringify(shortRes)).toBe(true)
    const short = asWindow((shortRes as { value: unknown }).value)
    expect({ offset: short.offset, lines: short.lines, totalLines: short.totalLines })
      .toEqual({ offset: full.offset, lines: full.lines, totalLines: full.totalLines })
    const legReads = H.reads.slice(readsBefore)
    expect(legReads.length).toBeGreaterThan(1) // the short-read ring really ran
    // mustfix #3 — three separate meters, each recorded where it happens:
    // caller-requested / ACTUALLY delegated (short) / really returned.
    const requested = legReads.reduce((s, r) => s + r.want, 0)
    const delegated = legReads.reduce((s, r) => s + r.delegated, 0)
    const delivered = legReads.reduce((s, r) => s + Math.max(0, r.bytesRead), 0)
    // the delegation really was short (quarter), never a full fetch relabeled:
    expect(legReads.every((r) => r.delegated === Math.max(1, Math.ceil(r.want / 4)) && r.delegated < r.want)).toBe(true)
    expect(delegated).toBeLessThan(requested)
    expect(delivered).toBeLessThanOrEqual(delegated)
    // requested exceeded the bound...
    expect(requested).toBeGreaterThan(MAX_READ_BYTES + 1)
    // ...bytes DELIVERED never did (the refusal judgement metering law):
    expect(delivered).toBeLessThanOrEqual(MAX_READ_BYTES)
    // and the ring's own per-request bound held against ACTUAL progress:
    let running = 0
    for (const r of legReads) {
      expect(r.want).toBeLessThanOrEqual(MAX_READ_BYTES + 1 - running)
      running += r.bytesRead
    }
    expect(H.openCalls - opensAfterFull).toBe(1) // no reopen
  })
})

// ===========================================================================
// T — locator spelling (E3: A3 fix — trailing-space names read RIGHT; the
// whitespace-only refusal law stays where it already lives).
// ===========================================================================
describe('A5RSW T spelling (plan (b) T1-T2)', () => {
  it('T1 trailing-space twin files: "t-a " reads the TRAILING file, "t-a" reads the plain one', async () => {
    const plain = join(ROOT_REAL, 't-a')
    const trail = join(ROOT_REAL, 't-a ')
    const { built } = exactPlane({ default: 'deny', allow: [
      { tool: 'read', resource: { kind: 'exact', path: trail } },
      { tool: 'read', resource: { kind: 'exact', path: plain } },
      // M1 PA carry: exact spellings answer the EFFECT path only up to the
      // canonicalizer; the governed subtree rides the seam (kit-local widening,
      // the T law itself remains the executor's spelling under test).
      { tool: 'read', resource: { kind: 'subtree', path: ROOT_REAL } },
    ], ask: [], deny: [] })
    const value = planeOk(built)
    const r1 = await settle(() => readDefOf(value).execute({ file_path: 't-a ' }))
    expect(r1.ok, JSON.stringify(r1)).toBe(true)
    const w1 = asWindow((r1 as { value: unknown }).value)
    expect(JSON.stringify(w1)).toContain('TOK-A-TRAILSPACE-91')
    expect(JSON.stringify(w1)).not.toContain('TOK-A-PLAIN-77')
    const r2 = await settle(() => readDefOf(value).execute({ file_path: 't-a' }))
    expect(r2.ok, JSON.stringify(r2)).toBe(true)
    const w2 = asWindow((r2 as { value: unknown }).value)
    expect(JSON.stringify(w2)).toContain('TOK-A-PLAIN-77')
    expect(JSON.stringify(w2)).not.toContain('TOK-A-TRAILSPACE-91')
  })

  // Guard: the whitespace-only refusal already lives at :105 — shape-agnostic.
  it('T2 GUARD: whitespace-only locator stays refused locator-rejected', async () => {
    const canonical = join(ROOT_REAL, 'w1.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: '   ' }))
    const text = refusalText(res)
    expect(text, 'must still be refused').toBeDefined()
    expect(text).toContain('refused-schema locator-rejected')
  })
})

// ===========================================================================
// D — denial / containment / window-parameter law / size family / TOCTOU.
// ===========================================================================
describe('A5RSW D denial and size (plan (b) D family)', () => {
  it('D1 lane-deny zero-byte law + admission throw shape (plan fixture disclosure inline)', async () => {
    // MEASURED-SHAPE DISCLOSURE (plan-vs-measured delta, see slice report):
    // the plan's D1 fixture `{deny:[{tool:'read',resource:{kind:'any'}}]}` is
    // NOT mountable on the production assembly — the projection layer refuses
    // an 'any' deny on the file-class tool with IO_POLICY_UNSUPPORTED (pinned
    // below in Leg C). The exact-resource deny shape used to be a BACKEND
    // DEPTH-CHECK DEFECT (既有后端纵深检查缺陷: the lane matcher read
    // `effect.resource.locator` while the repo's canonical effect vocabulary
    // is `canonicalLocator` — domain resource.ts:62, a5p5 effects-schema,
    // this executor) — there was NEVER evidence of an actual Host bypass
    // (尚无实际 Host 绕过证据; host-chain scope stays NOT VERIFIED). It is
    // REPAIRED in this commit (canonical-first, legacy fallback only, no
    // policy-semantics change) and its contract is pinned by D8 below.
    // Leg A — the executor's OWN consumption of a deny verdict (direct,
    // deterministic; a verdict-consumption unit, NOT matcher evidence —
    // D8 carries the matcher legs). Green on both generations.
    // typed via the fs-family lane face (the owning lane of the read row);
    // the lane `.mjs` carries no declaration, so the consumed face is the
    // local FsFamilyReadFace above. Runtime still loads the `.mjs`.
    const backends = (await import(new URL('../../tools/fs-family/src/index.mjs', import.meta.url).href)) as FsFamilyReadFace
    const denied = backends.createGovernedReadExecutor({
      realmId: REALM, rootDir: ROOT_REAL,
      policy: { default: 'ask', allow: [], ask: [], deny: [] },
      decide: () => ({ kind: 'deny', code: 'template-deny-lane' }),
      observe: () => {},
    })
    const resA = await settle(() => denied({ file_path: join(ROOT_REAL, 'w1.txt') }))
    const textA = refusalText(resA)
    expect(textA, 'a denied read verdict refuses the call').toBeDefined()
    expect(textA).toContain('refused-admission template-deny-lane')
    expect(textA).not.toContain('L001')
    expect(denied.execCount()).toBe(0)
    expect(H.openCalls).toBe(0)
    // Leg B — the throw-shape RED on an admission-class refusal over the DEF
    // transport (default-deny uncovered rule): baseline RESOLVES the legacy
    // {text}; the candidate THROWS the verbatim refusal.
    const canonical = join(ROOT_REAL, 'w1.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    await expect(readDefOf(value).execute({ file_path: join(ROOT_REAL, 'w2.txt') }))
      .rejects.toThrow(/refused-admission template-default-deny/)
    expect(value.backends.read!.execCount()).toBe(0)
    // Leg C — the plan fixture's 'any' deny: NOT mountable (projection
    // refuses, both generations — a coverage pin, not new law).
    const mount = buildPlane({
      plane: { fsInstance: fsInstance() },
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [{ tool: 'read', resource: { kind: 'any' } }] },
    })
    expect(mount.built.ok).toBe(false)
    if (!mount.built.ok) expect(mount.built.code).toBe('IO_POLICY_UNSUPPORTED')
  })

  it('D8 lane matcher contract (mustfix 6): canonical-first depth check — backend-layer conflict denies at ZERO bytes, backend two gates distinguished, legacy shape kept, dual-field conflict follows canonical', async () => {
    const canonical = join(ROOT_REAL, 'w1.txt')
    const other = join(ROOT_REAL, 'w2.txt')
    const planeRow = row as unknown as PlaneRow & {
      createLaneDecide: (policy: unknown, planeNames: Record<string, string>, subtreeContains?: unknown) =>
        (effectSet: unknown) => { kind: string; code?: string }
    }
    const names = { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }
    // G1-style effect set, exactly as deriveToolEffectSet builds it (native
    // tool-invoke + file effect in the CANONICAL locator vocabulary).
    const readEffects = (resource: Record<string, unknown>) => ({ effects: [
      { kind: 'tool-invoke', toolName: 'read', resource: null },
      { kind: 'read', resource: { realmId: REALM, kind: 'file', ...resource, rights: ['read'] } },
    ] })
    const exactRule = (path: string) => ({ tool: 'read', resource: { kind: 'exact', path } })
    // -- Leg (a): backend exact allow+deny CONFLICT, over the REAL
    //    production lane decider (createLaneDecide is production code —
    //    no stub decide anywhere in this test). The deny fast path wins.
    const conflictPolicy = { default: 'ask', allow: [exactRule(canonical)], ask: [] as unknown[], deny: [exactRule(canonical)] }
    const lane = planeRow.createLaneDecide(conflictPolicy, names, undefined)
    expect(lane(readEffects({ canonicalLocator: canonical }))).toEqual({ kind: 'deny', code: 'template-deny-lane' })
    const allowOnly = planeRow.createLaneDecide(
      { default: 'ask', allow: [exactRule(canonical)], ask: [], deny: [] }, names, undefined)
    expect(allowOnly(readEffects({ canonicalLocator: canonical }))).toEqual({ kind: 'allow' })
    // Backward compat: the legacy `locator`-only shape keeps matching.
    expect(lane(readEffects({ locator: canonical }))).toEqual({ kind: 'deny', code: 'template-deny-lane' })
    // -- Dual-field conflict negative control (AUTHORITY ORDER pinned):
    // canonical=other, legacy=denied path -> the legacy spelling NEVER
    // overrides the canonical: ALLOW.
    expect(lane(readEffects({ canonicalLocator: other, locator: canonical }))).toEqual({ kind: 'allow' })
    // canonical=denied path, legacy=decoy -> canonical decides: DENY.
    expect(lane(readEffects({ canonicalLocator: canonical, locator: other }))).toEqual({ kind: 'deny', code: 'template-deny-lane' })
    // -- Leg (b): the SAME conflict through the ASSEMBLED read def. SCOPE
    //    (root ruling, honest wording): this exercises the BACKEND layer
    //    (assembly-wired lane + executor gate — production code, nothing
    //    mocked), NOT an outer durable permission listener/end-cap — that
    //    claim is OPEN until the D9 leg below lands. ACCEPTANCE CRITERION
    //    = body/bytes ZERO: the body never ran (pre-fetch counter), no
    //    open, no fetch, no content.
    H.reset()
    const value = planeOk(exactPlane(conflictPolicy).built)
    await expect(readDefOf(value).execute({ file_path: canonical }))
      .rejects.toThrow(/refused-admission template-deny-lane/)
    expect(value.backends.read!.execCount()).toBe(0) // body ran ZERO
    expect(H.openCalls).toBe(0) // ...zero opens...
    expect(H.reads.length).toBe(0) // ...and zero bytes
    // -- BACKEND two gates distinguished on one production face (backend
    //    layers, not the outer permission layer): a DENIED path is answered
    //    by the assembly-wired LANE fast path (`template-deny-lane`) while
    //    an UNCOVERED path is answered by the executor's own coverage gate
    //    (`template-default-deny`) — different code, different backend gate,
    //    both refuse at zero bytes.
    const gateValue = planeOk(buildPlane({
      plane: { fsInstance: fsInstance() },
      permissionPolicy: { default: 'deny', allow: [exactRule(canonical)], ask: [], deny: [exactRule(canonical)] },
    }).built)
    await expect(readDefOf(gateValue).execute({ file_path: canonical }))
      .rejects.toThrow(/refused-admission template-deny-lane/) // lane layer, first
    await expect(readDefOf(gateValue).execute({ file_path: other }))
      .rejects.toThrow(/refused-admission template-default-deny/) // coverage-gate layer
    expect(gateValue.backends.read!.execCount()).toBe(0) // both layers: zero bytes
    expect(H.openCalls).toBe(0)
  })

  it('D2 root escape + throw shape: ../outside refused, zero disclosure of the outside token', async () => {
    const canonical = join(ROOT_REAL, 'w1.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: '../outside/secret.txt' }))
    expect(res.ok).toBe(false)
    const msg = (res as { message: string }).message
    expect(msg).toContain('refused')
    expect(msg).not.toContain(OUTSIDE_TOKEN)
    expect(H.openCalls).toBe(0)
  })

  it('D3 directory + throw shape: an in-root DIRECTORY the policy names is refused not-a-file (admission passes, the file-effect law refuses)', async () => {
    const dirReal = realpathSync(join(ROOT_REAL, 'd3dir'))
    const { built } = exactPlane(exactPolicy(dirReal))
    const value = planeOk(built)
    await expect(readDefOf(value).execute({ file_path: dirReal }))
      .rejects.toThrow(/refused-io not-a-file/)
  })

  it('D4 illegal window family: 6 shapes x {offset,limit} each refused-schema read-window-invalid; this executor opens no handle and fetches no bytes', async () => {
    const canonical = join(ROOT_REAL, 'w1.txt')
    const bad: unknown[] = [0, -1, 2.5, '100', Number.NaN, true]
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const def = readDefOf(value)
    for (const v of bad) {
      for (const key of ['offset', 'limit'] as const) {
        H.reset()
        const res = await settle(() => def.execute({ file_path: canonical, [key]: v }))
        expect(res.ok, `key=${key} value=${String(v)}`).toBe(false)
        const msg = (res as { message: string }).message
        expect(msg).toContain('refused-schema read-window-invalid')
        expect(msg).not.toContain('L001') // zero content
        // mustfix #4 — LOCAL-spy claim, scoped to THIS executor only: zero
        // open, zero bytes (openCalls/read spies + pre-fetch execCount), on
        // a path source-pinned to run BEFORE any path resolution
        // (fs-family/src/read-executor.mjs: window parse :195 precedes
        // resolveAnchoredPath :379 — the row's single home since U6 PR2).
        // No Host-wide I/O claim is made here.
        expect(value.backends.read!.execCount(), `key=${key} value=${String(v)}`).toBe(0)
        expect(H.openCalls).toBe(0)
      }
    }
  })

  it('D5 over-cap limit: limit 2001 refused with the verbatim pin639 detail; limit 2000 positive', async () => {
    const canonical = join(ROOT_REAL, 'w1.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    await expect(readDefOf(value).execute({ file_path: canonical, limit: LINE_CAP + 1 }))
      .rejects.toThrow(/limit must be less than or equal to 2000/)
    const ok = await settle(() => readDefOf(value).execute({ file_path: canonical, limit: LINE_CAP }))
    expect(ok.ok, JSON.stringify(ok)).toBe(true)
    expect(asWindow((ok as { value: unknown }).value).lines.length).toBe(40)
  })

  // D6 (one plan case, three legs; declared guard-first so the baseline round
  // SHOWS each leg's own verdict instead of a masked chain):
  it('D6b GUARD size family (static): exact-cap positive and static over-cap refusals stay pre-byte on BOTH generations', async () => {
    // GUARD (green on BOTH generations): static over-cap is refused by the
    // pre-existing verified-size gate BEFORE any byte fetch; the refusal's
    // transfer shape (legacy resolve-text vs new throw) is NOT asserted.
    for (const [name, size] of [['size-capplus1.bin', MAX_READ_BYTES + 1], ['size-4mib.bin', 4 * MAX_READ_BYTES]] as const) {
      H.reset()
      const f = join(ROOT_REAL, name)
      const { built } = exactPlane(exactPolicy(f))
      const value = planeOk(built)
      const res = await settle(() => readDefOf(value).execute({ file_path: f, limit: 1 }))
      const text = refusalText(res)
      expect(text, `${name}: must be refused`).toBeDefined()
      expect(text).toContain('read-too-large')
      expect(text).toContain('1048576')
      expect(text).not.toContain('AAAA')
      expect(value.backends.read!.execCount()).toBe(0)
      // metering: cumulative ACTUAL bytesRead never exceeds cap+1 (baseline:
      // fetch never runs -> trivially 0; candidate: ring never enters either).
      expect(H.bytesReadTotal).toBeLessThanOrEqual(MAX_READ_BYTES + 1)
      let running = 0
      for (const r of H.reads) {
        expect(r.want, 'each request is bounded by cap+1 minus what was actually read')
          .toBeLessThanOrEqual(MAX_READ_BYTES + 1 - running)
        running += Math.max(0, r.bytesRead)
      }
      expect(H.openCalls).toBeLessThanOrEqual(1) // never reopens
      expect(size > MAX_READ_BYTES).toBe(true)
    }
  })

  it('D6c size family RED (verify-then-growth): post-verify growth past the cap must refuse the WHOLE call', async () => {
    const growFile = join(ROOT_REAL, 'd6c.bin')
    // -- BASELINE-control sub-leg FIRST (RED on the baseline = the safety-delta
    //    proof): arm BOTH byte entries; a generation that fetches bytes via the
    //    legacy readFile discloses over-cap content here (the exact hazard the
    //    slice closes). The candidate (bounded ring) refuses the whole call.
    writeFileSync(growFile, Buffer.alloc(983_040, 0x44)) // 960 KiB <= cap
    {
      H.byteArm = {
        entries: new Set(['read', 'readFile']),
        action: () => { appendFileSync(growFile, Buffer.alloc(70_656, 0x44)) }, // -> > cap
        consumed: false,
        consumedEntry: null,
      }
      const { built } = exactPlane(exactPolicy(growFile))
      const value = planeOk(built)
      const res = await settle(() => readDefOf(value).execute({ file_path: growFile }))
      expect(H.byteArm.consumed, 'INJECTION SELF-PROOF: a byte-entry arm was consumed').toBe(true)
      const text = refusalText(res)
      expect(text, 'growth-before-byte-fetch must never disclose over-cap content').toBeDefined()
      expect(text).toContain('read-too-large')
      expect(text).not.toContain('DDDD') // zero content on either generation
      expect(H.openCalls).toBe(1) // never reopens
    }
    // -- CANDIDATE sub-leg (RED on baseline: the baseline never calls `read`,
    //    so the read-arm is never consumed AND no refusal happens): growth
    //    right before the first bounded-read fetch => refused, zero content,
    //    exactly one close (finally owns it), no reopen.
    H.reset()
    writeFileSync(growFile, Buffer.alloc(983_040, 0x44))
    {
      H.byteArm = {
        entries: new Set(['read']),
        action: () => { appendFileSync(growFile, Buffer.alloc(70_656, 0x44)) },
        consumed: false,
        consumedEntry: null,
      }
      const { built } = exactPlane(exactPolicy(growFile))
      const value = planeOk(built)
      const res = await settle(() => readDefOf(value).execute({ file_path: growFile }))
      expect(H.byteArm.consumed, 'INJECTION SELF-PROOF: the read-entry arm was consumed').toBe(true)
      expect(H.byteArm.consumedEntry).toBe('read')
      const text = refusalText(res)
      expect(text, 'post-verify growth past the cap must refuse the whole call').toBeDefined()
      expect(text).toContain('read-too-large')
      expect(text).not.toContain('DDDD')
      expect(H.openCalls).toBe(1)
      expect(H.closeCalls).toBe(1) // exactly one close
      // mustfix #1 — the GROWTH leg carries its OWN metering evidence (the
      // static D6b legs prove nothing about the ring; this leg ran it):
      // every request is bounded by cap+1 minus what was ACTUALLY read, and
      // the cumulative ACTUAL bytesRead (the refusal judgement itself) stays
      // ≤ cap+1 — the ring read exactly cap+1 bytes before refusing.
      expect(H.reads.length).toBeGreaterThan(1)
      let running = 0
      for (const r of H.reads) {
        expect(r.want, 'per-request bound: want ≤ cap+1 − already-read')
          .toBeLessThanOrEqual(MAX_READ_BYTES + 1 - running)
        running += r.bytesRead
      }
      expect(running, 'cumulative ACTUAL bytesRead at refusal').toBeLessThanOrEqual(MAX_READ_BYTES + 1)
      expect(running).toBe(MAX_READ_BYTES + 1) // refused exactly at the bound
    }
  })

  it('D6a size family native shape: exact-cap success, ring fetch <= cap (equal passes)', async () => {
    const capFile = join(ROOT_REAL, 'size-cap.bin')
    const { built } = exactPlane(exactPolicy(capFile))
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: capFile }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    asWindow((res as { value: unknown }).value)
    expect(H.bytesReadTotal).toBeLessThanOrEqual(MAX_READ_BYTES)
    expect(H.openCalls).toBe(1)
  })

  it('D7a GUARD (deterministic pre-open swap): same-path swap to an outside symlink -> ELOOP refusal; same-path new inode -> exec-time drift; zero disclosure', async () => {
    {
      // ① mustfix #2 — the swap acts on the ORIGINAL TARGET itself (open
      //    arguments stay byte-for-byte untouched): after the pre-open
      //    snapshot the file is renamed away and the SAME PATH is replaced
      //    by a symlink pointing OUTSIDE the root. The open then hits the
      //    lane's own O_NOFOLLOW law on the very path it was given -> ELOOP
      //    refusal before a byte exists. Scene restored in finally.
      const swap = join(ROOT_REAL, 'd7a.bin')
      writeFileSync(swap, 'D7A-ORIGINAL-66\n')
      const canonical = realpathSync(swap)
      H.preOpenAction = () => {
        renameSync(swap, join(BACKUP_DIR, 'd7a-orig'))
        symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), swap) // same path, outside alias
      }
      try {
        const { built } = exactPlane(exactPolicy(canonical))
        const value = planeOk(built)
        const res = await settle(() => readDefOf(value).execute({ file_path: canonical }))
        expect(H.preOpenConsumed, 'INJECTION SELF-PROOF: the open arm was consumed (args untouched)').toBe(true)
        const text = refusalText(res)
        expect(text, 'same-path outside symlink must refuse the open (ELOOP law)').toBeDefined()
        expect(text).toMatch(/symlink-alias|exec-time-/)
        expect(text).not.toContain(OUTSIDE_TOKEN)
        expect(value.backends.read!.execCount()).toBe(0)
        expect(H.openCalls).toBe(1) // the refusal came from the ONE opened path
      } finally {
        rmSync(swap, { force: true })
        renameSync(join(BACKUP_DIR, 'd7a-orig'), swap)
        rmSync(swap, { force: true })
      }
    }
    {
      // ② same PATH, different INODE: after the pre-open snapshot, before the
      //    open, the path is swapped to a different in-root inode -> drift.
      const swap = join(ROOT_REAL, 'd7b.bin')
      writeFileSync(swap, 'D7B-ORIGINAL-77\n')
      const canonical2 = realpathSync(swap)
      H.preOpenAction = () => {
        renameSync(swap, join(BACKUP_DIR, 'd7b-orig'))
        writeFileSync(swap, `D7B-DECOY-55 ${OUTSIDE_TOKEN}\n`) // new inode, inside root
      }
      try {
        const { built } = exactPlane(exactPolicy(canonical2))
        const value = planeOk(built)
        const res = await settle(() => readDefOf(value).execute({ file_path: canonical2 }))
        expect(H.preOpenConsumed, 'INJECTION SELF-PROOF: the open arm was consumed').toBe(true)
        const text = refusalText(res)
        expect(text, 'inode swap before open must refuse (drift)').toBeDefined()
        expect(text).toMatch(/exec-time-drift|exec-time-escape/)
        expect(text).not.toContain('D7B-DECOY-55')
        expect(value.backends.read!.execCount()).toBe(0)
      } finally {
        rmSync(swap, { force: true })
        renameSync(join(BACKUP_DIR, 'd7b-orig'), swap)
      }
    }
  })

  it('D7b GUARD (deterministic post-verify swap): bytes keep coming from the VERIFIED fd (old content), never from the path', async () => {
    const target = join(ROOT_REAL, 'd7c.bin')
    writeFileSync(target, 'A5RSW-FD-BOUND-ORIG-13\n')
    const canonical = realpathSync(target)
    H.byteArm = {
      entries: new Set(['read', 'readFile']),
      action: () => {
        renameSync(target, join(BACKUP_DIR, 'd7c-moved'))
        symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), target) // pathname now a root-outside alias
      },
      consumed: false,
      consumedEntry: null,
    }
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    try {
      const res = await settle(() => readDefOf(value).execute({ file_path: canonical }))
      expect(H.byteArm.consumed, 'INJECTION SELF-PROOF: the byte-fetch arm was consumed').toBe(true)
      expect(refusalText(res), 'fd-bound read of the verified inode must SUCCEED').toBeUndefined()
      const serialized = JSON.stringify((res as { value: unknown }).value)
      expect(serialized).toContain('A5RSW-FD-BOUND-ORIG-13') // the verified handle's content
      expect(serialized).not.toContain(OUTSIDE_TOKEN) // the path swap never leaked in
      expect(H.openCalls).toBe(1) // never reopened by path
    } finally {
      rmSync(target, { force: true })
      renameSync(join(BACKUP_DIR, 'd7c-moved'), target)
    }
  })

  it('D7c GUARD (supplementary): 200 random-race rename->symlink rounds — every outcome is safe, zero outside disclosure, never asserts "must catch"', async () => {
    const target = join(ROOT_REAL, 'race.bin')
    const policy = exactPolicy(join(ROOT_REAL, 'race.bin'))
    const { built } = exactPlane(policy)
    const value = planeOk(built)
    const def = readDefOf(value)
    const allowed = /^refused-io (exec-time-(escape|drift|undeterminable)|symlink-alias|open-failed)/
    for (let i = 0; i < 200; i += 1) {
      writeFileSync(target, `RACE-ORIG-${i}\n`)
      const link = join(LINKS_DIR, `race-link-${i}`)
      symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), link)
      const inflight = def.execute({ file_path: target })
      // fire the swap NOW (single atomic rename) — races the realpath->read
      // window; the alternating microtask delay varies which side wins.
      if (i % 2 === 1) await Promise.resolve()
      renameSync(link, target)
      const res = await settle(() => inflight)
      const refusal = refusalText(res)
      if (refusal === undefined) {
        const serialized = JSON.stringify((res as { ok: true; value: unknown }).value)
        expect(serialized, `round ${i}: success must carry the ORIGINAL content`).toContain(`RACE-ORIG-${i}`)
        expect(serialized).not.toContain(OUTSIDE_TOKEN)
      } else {
        expect(refusal, `round ${i}: refusal must be an exec-time/alias class`).toMatch(allowed)
        expect(refusal).not.toContain(OUTSIDE_TOKEN)
        expect(refusal).not.toContain('RACE-ORIG')
      }
      rmSync(target, { force: true })
    }
  }, 120_000)
})

// ===========================================================================
// F — effect equivalence + fingerprint identity (F2 is a GUARD: the frozen
// fingerprint law already holds; digests stay pinned ONLY in a2c5).
// ===========================================================================
describe('A5RSW F equivalence and identity (plan (b) F1-F2)', () => {
  it('F1 omitted-limit vs explicit-2000 executions: IDENTICAL native output objects (2050-line file)', async () => {
    const canonical = join(ROOT_REAL, 'w2.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const aRes = await settle(() => readDefOf(value).execute({ file_path: canonical }))
    const bRes = await settle(() => readDefOf(value).execute({ file_path: canonical, limit: LINE_CAP }))
    expect(aRes.ok, JSON.stringify(aRes)).toBe(true)
    expect(bRes.ok, JSON.stringify(bRes)).toBe(true)
    const a = asWindow((aRes as { value: unknown }).value)
    const b = asWindow((bRes as { value: unknown }).value)
    expect(a.lines.length).toBe(2000) // the row really caps at the deployment line cap
    expect({ offset: a.offset, lines: a.lines, totalLines: a.totalLines, path: a.path })
      .toEqual({ offset: b.offset, lines: b.lines, totalLines: b.totalLines, path: b.path })
  })

  // Guard: identity law lives in canonical-operation.ts (digest authority =
  // a2c5 T1/T6/T7 :305/:338/:356 — this file pins INEQUALITIES only).
  it('F2 GUARD: {file_path} vs {file_path,limit:2000} are distinct identities; omitted offset == offset 1', async () => {
    const { canonicalizeOperation } = (await import('../operation-permission/index.js')) as {
      canonicalizeOperation: (input: { name: string; arguments: unknown; resolveTarget: (p: string) => Promise<{ key: string; display: string }> }) => Promise<{ fingerprint: string }>
    }
    const resolver = async (path: string) => ({ key: `fskey:${path}`, display: `display:${path}` })
    const omitted = await canonicalizeOperation({ name: 'read', arguments: { file_path: './r/f.txt' }, resolveTarget: resolver })
    const explicit2000 = await canonicalizeOperation({ name: 'read', arguments: { file_path: './r/f.txt', limit: 2000 }, resolveTarget: resolver })
    const offset1 = await canonicalizeOperation({ name: 'read', arguments: { file_path: './r/f.txt', offset: 1 }, resolveTarget: resolver })
    expect(omitted.fingerprint).not.toBe(explicit2000.fingerprint)
    expect(omitted.fingerprint).toBe(offset1.fingerprint)
  })
})

// ===========================================================================
// C — the read row's own presentation face (RED: the baseline row still
// shares the trio face and has no presentResult).
// ===========================================================================
describe('A5RSW C face contract (plan (b) C1-C1c)', () => {
  const ENVELOPE = /^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u

  it('C1 read-row face: native keys, own schema, verbatim envelope render, meta without lang, read-card presentResult, isError declines', async () => {
    const canonical = join(ROOT_REAL, 'reports', 'status.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const def = readDefOf(value)
    const res = await settle(() => def.execute({ file_path: canonical }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    expect('truncatedByBytes' in w).toBe(false) // the flag NEVER rides the result (S6)
    expect(def.output).toBeDefined()
    const props = (def.output!.schema.properties ?? {}) as Record<string, unknown>
    expect(Object.keys(props).sort()).toEqual(['lines', 'offset', 'path', 'totalLines'])
    expect(def.output!.schema.additionalProperties).toBe(false)
    const rendered = def.output!.render({ file_path: canonical }, w)
    expect(rendered).toHaveLength(1)
    expect(ENVELOPE.test(mustFirst(rendered, 'the render face').text), 'render output is the read envelope').toBe(true)
    expect(mustFirst(rendered, 'the render face').text).toContain('(End of file - total 3 lines)')
    const meta = def.output!.presentationMeta!({ file_path: canonical }, w)
    expect(Object.keys(meta).sort()).toEqual(['lines', 'offset', 'path', 'totalLines']) // NO lang (S7)
    expect(typeof def.presentResult).toBe('function')
    const card = def.presentResult!({ file_path: canonical }, {
      isError: false,
      meta,
      content: [{ type: 'text', text: mustFirst(rendered, 'the render face').text }],
    })
    expect(card?.card).toBe('read')
    expect(def.presentResult!({ file_path: canonical }, {
      isError: true, meta, content: [{ type: 'text', text: mustFirst(rendered, 'the render face').text }],
    })).toBeUndefined()
  })

  it('C1b malformed / missing meta declines to undefined and NEVER throws', async () => {
    const canonical = join(ROOT_REAL, 'reports', 'status.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const def = readDefOf(value)
    expect(typeof def.presentResult).toBe('function')
    const res = await settle(() => def.execute({ file_path: canonical }))
    const w = asWindow((res as { value: unknown }).value)
    const goodMeta = def.output!.presentationMeta!({ file_path: canonical }, w)
    const text = mustFirst(def.output!.render({ file_path: canonical }, w), 'the render face').text
    const badMetas: unknown[] = [
      undefined,
      null,
      42,
      'meta',
      [1, 2],
      { ...goodMeta, offset: 0 },
      { ...goodMeta, offset: 1.5 },
      { ...goodMeta, totalLines: -1 },
      { ...goodMeta, lines: [{ number: 2, text: 'b' }, { number: 1, text: 'a' }] },
      { ...goodMeta, totalLines: 1, lines: [{ number: 2, text: 'x' }] },
      { ...goodMeta, lang: 7 },
    ]
    for (const meta of badMetas) {
      let out: unknown
      expect(() => {
        out = def.presentResult!({}, { isError: false, meta, content: [{ type: 'text', text }] })
      }, `meta=${JSON.stringify(meta)}`).not.toThrow()
      expect(out, `meta=${JSON.stringify(meta)} must decline`).toBeUndefined()
    }
  })

  it('C1c legacy / foreign result forms decline to undefined (replay-safe, never throws)', async () => {
    const canonical = join(ROOT_REAL, 'reports', 'status.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    const def = readDefOf(value)
    expect(typeof def.presentResult).toBe('function')
    const res = await settle(() => def.execute({ file_path: canonical }))
    const w = asWindow((res as { value: unknown }).value)
    const goodMeta = def.output!.presentationMeta!({ file_path: canonical }, w)
    // legacy {text}-refusal wire text (obsolete logged output)
    expect(def.presentResult!({}, {
      isError: false, meta: goodMeta,
      content: [{ type: 'text', text: 'refused-io read-too-large — 2 bytes exceeds the 1 bound (refused, never truncated)' }],
    })).toBeUndefined()
    // non-envelope text
    expect(def.presentResult!({}, {
      isError: false, meta: goodMeta, content: [{ type: 'text', text: 'plain prose, no envelope' }],
    })).toBeUndefined()
    // more than one content block
    const text = mustFirst(def.output!.render({ file_path: canonical }, w), 'the render face').text
    expect(def.presentResult!({}, {
      isError: false, meta: goodMeta,
      content: [{ type: 'text', text }, { type: 'text', text }],
    })).toBeUndefined()
  })
})

// ===========================================================================
// Z — zero-flip guards (green on the baseline AND after the change).
// ===========================================================================
describe('A5RSW Z zero-flip (plan (b) Z1-Z2)', () => {
  it('Z1 GUARD: with the read row placed, the trio defs + jobs-shape are byte-identical to the SCOPE-P snapshot', async () => {
    const canonical = join(ROOT_REAL, 'w1.txt')
    const { built } = exactPlane(exactPolicy(canonical))
    const value = planeOk(built)
    expect(trioSerialization(value)).toBe(TRIO_BASELINE_SNAPSHOT)
    expect(value.ownNames.filter((n) => n.startsWith('job_'))).toEqual([]) // jobs rows untouched
    expect(value.ownNames).toContain('read')
  })

  it('Z2 GUARD: no plane.fsInstance -> no read row; trio byte-identical; the no-plane world keeps the shut landing', async () => {
    const { built } = buildPlane({ plane: {}, permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] } })
    const value = planeOk(built)
    expect(value.ownNames).not.toContain('read')
    expect(trioSerialization(value)).toBe(TRIO_BASELINE_SNAPSHOT)
    const shut = await settle(() => value.definitions.find((d) => d.name === 'team_grep')!.execute({ pattern: 'x', path: '.', output_mode: 'content' }))
    // Discriminated narrowing (tsc): the shut landing must RESOLVE on both
    // generations — a rejection is a loud red carrying its message.
    if (!shut.ok) throw new Error(`Z2: the shut face must resolve, got: ${shut.message}`)
    expect(JSON.stringify(shut.value)).toContain('IO_POLICY_UNSUPPORTED')
  })
})

// ===========================================================================
// P — the INSTALL §3.5 recipe as a machine-readable assembly input.
// RED legs (P1/P1b): the doc blocks + window content. Guards (P2/P3): the
// existing CFS_PROVIDER_REFUSED refusals (this repo's FIRST pin of the
// shape — a coverage gap, not a baseline RED).
// ===========================================================================
describe('A5RSW P production recipe (plan (b) P1-P4)', () => {
  const doc = readFileSync(join(REPO, 'docs/INSTALL.md'), 'utf8')
  const markerBlock = (marker: string): string | undefined => {
    const m = new RegExp(`<!-- ${marker} -->\\s*\\n\`\`\`yaml\\n([\\s\\S]*?)\\n\`\`\``).exec(doc)
    return m?.[1]
  }

  it('P1 doc-YAML positive control: the TWO §3.5 marker blocks parse into row-config plane + blueprint policy and mount (plane and policy are DIFFERENT carriers, fed separately)', async () => {
    const rowYaml = markerBlock('a5-read-only-row')
    const policyYaml = markerBlock('a5-read-only-policy')
    expect(rowYaml, 'INSTALL.md carries the a5-read-only-row fenced block').toBeDefined()
    expect(policyYaml, 'INSTALL.md carries the a5-read-only-policy fenced block').toBeDefined()
    // Row-config face (plugin row config: teamToolPlane increment).
    const rowDoc = parseYaml(rowYaml!) as {
      config: { teamToolPlane: { realmId: string; fsInstance: Record<string, unknown> } }
    }
    const rowCfg = rowDoc.config.teamToolPlane
    expect(Object.keys(rowCfg.fsInstance).sort()).toEqual(['fs', 'kind', 'realmId', 'rootDir'])
    expect(rowCfg.fsInstance.fs).toBe('team-ctl')
    expect(rowCfg.fsInstance.kind).toBe('absolute-path')
    // Blueprint face (capabilities.permissions — a DIFFERENT carrier).
    const policyDoc = parseYaml(policyYaml!) as {
      capabilities: { permissions: { default: string; allow: Array<{ tool: string; resource: { kind: string; path: string } }> } }
    }
    const policy = policyDoc.capabilities.permissions
    expect(policy.default).toBe('deny')
    expect(policy.allow).toHaveLength(1)
    const allowRule = mustFirst(policy.allow, 'the pinned INSTALL allow lane')
    expect(allowRule.tool).toBe('read')
    expect(allowRule.resource.kind).toBe('exact')
    // Only PLACEHOLDER VALUES are substituted (structure untouched): the doc
    // spellings -> this scratch world's canonical absolute values.
    rowCfg.fsInstance.rootDir = ROOT_REAL
    const target = join(ROOT_REAL, 'reports', 'status.txt')
    allowRule.resource.path = realpathSync(target)
    // Fed separately: plane/realm from the ROW config, policy from the BLUEPRINT.
    const { built } = buildPlane({
      plane: { realmId: rowCfg.realmId, fsInstance: rowCfg.fsInstance },
      permissionPolicy: policy,
      realmId: rowCfg.realmId,
    })
    const value = planeOk(built) // baseline-green sub-legs: ok:true + placement
    expect(value.ownNames).toContain('read')
    const feed = value.placementFeed?.('read')
    expect(feed?.definitionIdentity).toMatch(/^def#\d+$/)
    // The window itself is the new assertion (RED on the baseline).
    const res = await settle(() => readDefOf(value).execute({ file_path: allowRule.resource.path }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const w = asWindow((res as { value: unknown }).value)
    expect(mustFirst(w.lines, 'the window lines').text).toBe('STATUS-OK-L1')
    expect(w.totalLines).toBe(3)
  })

  it('P1b relative locator still reads (compat): the same assembly serves the workspace-placement spelling', async () => {
    const rowYaml = markerBlock('a5-read-only-row')
    const policyYaml = markerBlock('a5-read-only-policy')
    if (rowYaml === undefined || policyYaml === undefined) {
      expect(rowYaml, 'row block present').toBeDefined()
      return
    }
    const rowDoc = parseYaml(rowYaml) as { config: { teamToolPlane: { realmId: string; fsInstance: Record<string, unknown> } } }
    const policyDoc = parseYaml(policyYaml) as { capabilities: { permissions: Record<string, unknown> } }
    rowDoc.config.teamToolPlane.fsInstance.rootDir = ROOT_REAL
    const twinAllow = mustFirst(
      (policyDoc.capabilities.permissions as { allow: Array<{ resource: { path: string } }> }).allow,
      'the pinned INSTALL allow lane',
    )
    twinAllow.resource.path = realpathSync(join(ROOT_REAL, 'reports', 'status.txt'))
    const { built } = buildPlane({
      plane: { realmId: rowDoc.config.teamToolPlane.realmId, fsInstance: rowDoc.config.teamToolPlane.fsInstance },
      permissionPolicy: policyDoc.capabilities.permissions,
      realmId: rowDoc.config.teamToolPlane.realmId,
    })
    const value = planeOk(built)
    const res = await settle(() => readDefOf(value).execute({ file_path: 'reports/status.txt' }))
    expect(res.ok, JSON.stringify(res)).toBe(true)
    expect(asWindow((res as { value: unknown }).value).lines.length).toBe(3)
  })

  it('P2 GUARD (coverage gap pin): the legacy rootDir-only fsInstance shape refuses with CFS_PROVIDER_REFUSED', async () => {
    const { built } = buildPlane({
      plane: { fsInstance: { rootDir: ROOT_REAL } },
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
    })
    expect(built.ok).toBe(false)
    if (!built.ok) expect(built.code).toBe('CFS_PROVIDER_REFUSED')
  })

  it('P3 GUARD: an fsInstance realmId different from the plane realmId refuses with the same code', async () => {
    const { built } = buildPlane({
      plane: { fsInstance: fsInstance({ realmId: 'a5rsw-other-realm' }) },
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
    })
    expect(built.ok).toBe(false)
    if (!built.ok) expect(built.code).toBe('CFS_PROVIDER_REFUSED')
  })

  it('P4 subtree over-promise guard: a lone subtree rule proves NOTHING — assembly refuses to mount it without the containment seam (measured law), the executor-level default-deny law holds, and the exact twin reads', async () => {
    const target = realpathSync(join(ROOT_REAL, 'sub', 'inside.txt'))
    const subReal = realpathSync(join(ROOT_REAL, 'sub'))
    const subtreePolicy = {
      default: 'deny',
      allow: [{ tool: 'read', resource: { kind: 'subtree', path: subReal } }],
      ask: [] as unknown[],
      deny: [] as unknown[],
    }
    // -- Leg A (GUARD / coverage pin, green on both generations): the
    //    production plane carries NO SubtreeContains seam, so a policy with a
    //    subtree rule cannot be projected — the MOUNT itself refuses with
    //    TOOL_BINDING_UNVERIFIED (measured; stronger than the plan's assumed
    //    executor-level reach — disclosed as plan-vs-measured delta).
    const mount = buildPlane({ plane: { fsInstance: fsInstance() }, permissionPolicy: subtreePolicy, noSeam: true })
    expect(mount.built.ok, 'a subtree rule without the seam must never mount').toBe(false)
    if (!mount.built.ok) expect(mount.built.code).toBe('TOOL_BINDING_UNVERIFIED')
    // -- Leg B (GUARD, the executor's own :828 law via the DIRECT executor,
    //    the seam-less face the plan described): without subtreeContains, a
    //    subtree rule covers nothing -> default-deny refusal, attributed to
    //    template-default-deny, zero bytes (execCount 0), generation-agnostic.
    // typed via the fs-family lane face (the owning lane of the read row);
    // the lane `.mjs` carries no declaration, so the consumed face is the
    // local FsFamilyReadFace above. Runtime still loads the `.mjs`.
    const backends = (await import(new URL('../../tools/fs-family/src/index.mjs', import.meta.url).href)) as FsFamilyReadFace
    const exec = backends.createGovernedReadExecutor({
      realmId: REALM, rootDir: ROOT_REAL, policy: subtreePolicy,
      decide: () => ({ kind: 'allow' }), observe: () => {},
    })
    const res = await settle(() => exec({ file_path: target }))
    const text = refusalText(res)
    expect(text, 'no seam -> the subtree rule covers nothing; refusal, zero bytes').toBeDefined()
    expect(text).toContain('refused-admission template-default-deny')
    expect(text).not.toContain('A5RSW-SUB-INSIDE-1')
    expect(exec.execCount()).toBe(0)
    // -- Leg C (RED on the baseline for the WINDOW shape): the SAME root and
    //    file, ONE exact rule with the canonical spelling -> reads natively.
    const { built: twin } = exactPlane(exactPolicy(target))
    const twinValue = planeOk(twin)
    const resC = await settle(() => readDefOf(twinValue).execute({ file_path: target }))
    expect(resC.ok, JSON.stringify(resC)).toBe(true)
    expect(mustFirst(asWindow((resC as { value: unknown }).value).lines, 'the window lines').text).toBe('A5RSW-SUB-INSIDE-1')
  })
})

// ===========================================================================
// D9 — the OUTER durable permission layer (mustfix2, root ruling): the
// PRODUCTION `installParameterPermissionListener` (operation-permission
// pre-execute adapter — the same install the A6 glue performs per agent
// lifecycle, agent-bindings.mjs :3100) is ACTUALLY CALLED here; its
// composite install registers BOTH the `tools/pre-execute` waterfall
// listener AND the monotonic end-cap guard over the public `tools.guard`
// seam (R6/H1; the recording seam follows the t12a-live-bridge.mjs :576
// H1 semantics — it RECORDS the production guard function, never
// substitutes a verdict). Durable control plane: the real
// createControlService over a real P6T4 world (issue2/a4p4 recipe). The
// harness ctx follows the a4p4 makeFakeAgentCtx pattern (a pipeline
// harness; every DECISION on the chain is production code). Upstream stage
// order (dsh-tools prepareExecution, recorded in the i2 header):
// waterfall -> monotonic guard -> dispatch; the dispatch edge here runs
// the SAME real assembled read def.
// ===========================================================================
describe('A5RSW D9 outer permission layer (mustfix2)', () => {
  it('D9 production permission listener + its recorded monotonic end-cap guard drive the SAME real read def: exact allow+deny conflict denies at body/bytes ZERO; the allow twin self-proves the wiring really reaches the def', async () => {
    const opPerm = (await import('../operation-permission/index.js')) as unknown as {
      installParameterPermissionListener: (agentCtx: unknown, params: unknown) => () => void
    }
    const controlMod = (await import('../control/index.js')) as unknown as {
      createControlService: (input: unknown) => unknown
    }
    const p6 = (await import('./p6t4-helpers.js')) as unknown as {
      P6T4_ROOT: string
      P6T4_NOW: unknown
      P6T4_SEEDS: { worker: { instanceId: string } }
      createP6T4World: (basename: string, members: readonly string[]) => Promise<Record<string, unknown>>
      destroyP6T1World: (world: Record<string, unknown>) => Promise<void>
      memberCaller: (instanceId: string) => unknown
    }
    const canonical = join(ROOT_REAL, 'w1.txt')
    const exactRule = (path: string) => ({ tool: 'read', resource: { kind: 'exact', path } })
    const workerId = String(p6.P6T4_SEEDS.worker.instanceId)
    // i2/a4p4 resolver: stable file:/// keys, same basis for operations AND rules.
    const fakeResolve = async (path: string): Promise<{ key: string; display: string }> => ({
      key: `file:///${path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')}`,
      display: path,
    })
    // Harness ctx: waterfall registration + RECORDING guard seam (t12a H1).
    const listeners: Array<(exec: Record<string, unknown>, next: () => Promise<unknown>) => Promise<unknown>> = []
    const guards: Array<{ fn: (exec: Record<string, unknown>) => string | undefined; active: boolean }> = []
    const ctx = {
      on: (_event: string, listener: (exec: Record<string, unknown>, next: () => Promise<unknown>) => Promise<unknown>) => {
        listeners.push(listener)
        return () => {
          const i = listeners.indexOf(listener)
          if (i >= 0) listeners.splice(i, 1)
        }
      },
      tools: {
        guard: (fn: (exec: Record<string, unknown>) => string | undefined) => {
          const entry = { fn, active: true }
          guards.push(entry)
          return () => { entry.active = false }
        },
      },
    }
    const world = await p6.createP6T4World('a5rsw-d9', ['leader', 'worker'])
    try {
      const service = controlMod.createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: (world.ports as { externalPolicyFacts: unknown }).externalPolicyFacts,
        now: () => p6.P6T4_NOW,
        waitPollIntervalMs: 10,
      }) as { listControlState: (root: string) => Promise<{ requests: unknown[]; decisions: unknown[]; consumptions: unknown[] }> }
      const controlRows = async (): Promise<number> => {
        const state = await service.listControlState(p6.P6T4_ROOT)
        return state.requests.length + state.decisions.length + state.consumptions.length
      }
      const makeExec = (callId: string): Record<string, unknown> => ({
        callId,
        name: 'read',
        arguments: { file_path: canonical },
        signal: new AbortController().signal,
      })
      /** One upstream-ordered drive: waterfall -> guard -> dispatch of the
       *  SAME real def. Returns the stage evidence. */
      const drive = async (
        exec: Record<string, unknown>,
        def: ReadDef,
      ): Promise<{
        decision: { kind?: string; reason?: string }
        nextCalls: number
        guardByHarness: string | undefined
        dispatched: number
        dispatchOutcome?: Awaited<ReturnType<typeof settle>>
      }> => {
        let nextCalls = 0
        let guardByHarness: string | undefined
        let dispatched = 0
        let dispatchOutcome: Awaited<ReturnType<typeof settle>> | undefined
        const next = async (): Promise<unknown> => {
          nextCalls += 1
          guardByHarness = guards[0] !== undefined ? guards[0]!.fn(exec) : undefined
          if (typeof guardByHarness === 'string') return { kind: 'deny', reason: guardByHarness }
          dispatched += 1
          dispatchOutcome = await settle(() => def.execute(exec.arguments))
          return { kind: 'allow' }
        }
        const decision = (await listeners[0]!(exec, next)) as { kind?: string; reason?: string }
        return { decision, nextCalls, guardByHarness, dispatched, dispatchOutcome }
      }
      // -- CONFLICT leg: allow + deny on the SAME exact resource. Install
      //    the PRODUCTION listener (the composite install registers the
      //    end-cap guard through the recording seam — R6 refuses install
      //    when the seam is absent).
      const conflictPolicy = { default: 'deny', allow: [exactRule(canonical)], ask: [], deny: [exactRule(canonical)] }
      const dispose = opPerm.installParameterPermissionListener(ctx, {
        policy: conflictPolicy,
        resolveTarget: fakeResolve,
        controlService: service,
        rootSessionId: p6.P6T4_ROOT,
        caller: p6.memberCaller(workerId),
        targetInstanceId: workerId,
        isLeader: false,
      })
      expect(listeners.length, 'the production install registered the pre-execute listener').toBe(1)
      expect(guards.length, 'the SAME install registered the monotonic end-cap guard').toBe(1)
      const conflictValue = planeOk(exactPlane(conflictPolicy).built)
      const conflictDef = readDefOf(conflictValue)
      H.reset()
      const conflict = await drive(makeExec('a5rsw-d9-conflict'), conflictDef)
      // The OUTER production listener denies: the waterfall never reaches
      // its tail, the harness never reaches dispatch, the def body is
      // NEVER entered.
      expect(JSON.stringify(conflict.decision), 'outer production verdict on the conflict').toMatch(/deny/)
      expect(conflict.nextCalls, 'waterfall tail never reached').toBe(0)
      expect(conflict.dispatched, 'dispatch of the read def never happened').toBe(0)
      // ACCEPTANCE CRITERION — body/bytes ZERO on the same real def:
      expect(conflictValue.backends.read!.execCount()).toBe(0)
      expect(H.openCalls).toBe(0)
      expect(H.reads.length).toBe(0)
      // The deny lane never touches the durable control state...
      expect(await controlRows()).toBe(0)
      // ...and the recorded end-cap guard is the PRODUCTION monotonic one:
      // a fresh, never-authorized exec object is DENIED by it (string
      // verdict = deny on the upstream guard contract).
      const hostileVerdict = guards[0]!.fn(makeExec('a5rsw-d9-hostile'))
      expect(typeof hostileVerdict, 'unauthorized exec: the production end-cap guard denies').toBe('string')
      dispose()
      expect(guards[0]!.active, 'the composite disposer tears the guard down too').toBe(false)

      // -- ALLOW-TWIN self-proof (the ONLY difference: no deny rule): the
      //    same harness, same production install path, same REAL def — here
      //    the chain MUST reach the def and READ. Without this twin the
      //    zeros above could hide a dead harness.
      const allowPolicy = { default: 'deny', allow: [exactRule(canonical)], ask: [], deny: [] }
      listeners.splice(0, listeners.length)
      guards.splice(0, guards.length)
      const disposeTwin = opPerm.installParameterPermissionListener(ctx, {
        policy: allowPolicy,
        resolveTarget: fakeResolve,
        controlService: service,
        rootSessionId: p6.P6T4_ROOT,
        caller: p6.memberCaller(workerId),
        targetInstanceId: workerId,
        isLeader: false,
      })
      const twinValue = planeOk(exactPlane(allowPolicy).built)
      const twinDef = readDefOf(twinValue)
      H.reset()
      const twin = await drive(makeExec('a5rsw-d9-twin'), twinDef)
      expect(twin.nextCalls, 'self-proof: the waterfall really passed the call downstream').toBe(1)
      expect(twin.guardByHarness, 'self-proof: the end-cap guard ABSTAINS on the exec THIS install authorized').toBeUndefined()
      expect(twin.dispatched, 'self-proof: dispatch reached the def').toBe(1)
      expect(twin.dispatchOutcome?.ok, JSON.stringify(twin.dispatchOutcome)).toBe(true)
      expect(JSON.stringify((twin.dispatchOutcome as { value: unknown }).value)).toContain('L001')
      expect(H.openCalls).toBeGreaterThan(0) // bytes were really fetchable through this harness
      expect(await controlRows(), 'the static allow lane touches no durable row').toBe(0)
      disposeTwin()
    } finally {
      await p6.destroyP6T1World(world)
    }
  })
})

// ===========================================================================
// A5-M2 PA-READ HAND-OFF — the ROW legs (row-level laws only). Scope honesty:
// every claim here is about THIS executor against a stub `pa` that mirrors the
// plane's own two laws (an aborted signal answers cancelled before anything
// else; Part A answers 'approved' with a grant). The plane's split walk, the
// adapter's mark/close pair and the real Host chain are evidenced elsewhere.
// ===========================================================================
describe('A5RSW-HANDOFF — the governed read row under the PA hand-off', () => {
  const handoffPolicy = { default: 'allow', allow: [], ask: [], deny: [] }
  // OWN fixture root: this block must not depend on another describe's
  // beforeAll/afterAll ordering (its own realpath, its own files, its own
  // teardown).
  const HROOT_DIR = join(WORLD, 'handoff-root')
  let HROOT = HROOT_DIR
  beforeAll(() => {
    rmSync(HROOT_DIR, { recursive: true, force: true })
    mkdirSync(HROOT_DIR, { recursive: true })
    HROOT = realpathSync(HROOT_DIR)
    writeFileSync(join(HROOT, 'w1.txt'), 'A5RSW-HANDOFF-1\n')
    writeFileSync(join(HROOT, 'w2.txt'), 'A5RSW-HANDOFF-2\n')
  })
  afterAll(() => { rmSync(HROOT_DIR, { recursive: true, force: true }) })
  const target = (name: string) => join(HROOT, name)

  type PaEvent = { callId: string; kind: string }
  const handoffRow = async (log: PaEvent[]) => {
    const m = (await import(new URL('../../tools/fs-family/src/index.mjs', import.meta.url).href)) as FsFamilyReadFace
    // The stub mirrors `paAdmit`: an already-aborted call is answered at the
    // edge, before any walk (team-tool-plane.mjs:1025).
    const answer = (input: { callId: string; signal?: { aborted?: boolean } }, kind: string) => {
      // Mirrors team-tool-plane.mjs:1025 — an already-aborted call is answered
      // AT the edge, before any admission work, so it logs no walk either.
      if (input.signal?.aborted === true) return { kind: 'allow', cancelled: true }
      log.push({ callId: input.callId, kind })
      return kind === 'open' ? { kind: 'approved', grant: { bindingId: 'b-1' }, request: {} } : { kind: 'allow' }
    }
    const walk = (input: { callId: string; signal?: { aborted?: boolean } }) => answer(input, 'walk')
    const open = (input: { callId: string; signal?: { aborted?: boolean } }) => answer(input, 'open')
    const edge = (input: { callId: string; signal?: { aborted?: boolean } }) => answer(input, 'edge')
    const pa = Object.assign(walk, { open, edge })
    return m.createGovernedReadExecutor({
      realmId: REALM, rootDir: HROOT, policy: handoffPolicy,
      decide: () => ({ kind: 'allow' }), observe: () => {}, pa,
    })
  }

  it('H1: open authorizes on the token with ZERO bytes, and the body redeems the SAME correlation through the edge only', async () => {
    const log: PaEvent[] = []
    const exec = await handoffRow(log)
    const token = Symbol('a5rsw-handoff-h1')
    const opened = await exec.paHandoffOpen({ file_path: target('w1.txt') }, { token }) as { kind: string; correlation?: string }
    expect(opened.kind, 'Part A answers authorized').toBe('authorized')
    expect(typeof opened.correlation, 'the row mints the correlation, not the adapter').toBe('string')
    expect(exec.execCount(), 'the pre-dispatch leg never enters the byte stage').toBe(0)
    expect(log.map((e) => e.kind), 'open walks ONCE, through the open half only').toEqual(['open'])
    const ran = await settle(() => exec({ file_path: target('w1.txt') }, { token }))
    expect(ran.ok, JSON.stringify(ran)).toBe(true)
    expect(log.map((e) => e.kind), 'the body runs the edge; Part A is never re-run').toEqual(['open', 'edge'])
    expect(new Set(log.map((e) => e.callId)).size, 'ONE correlation for the whole life of the token').toBe(1)
  })

  it('H2: two concurrent claims on one token — the second finds no flight and fails closed (zero body, no walk)', async () => {
    const log: PaEvent[] = []
    const exec = await handoffRow(log)
    const token = Symbol('a5rsw-handoff-h2')
    await exec.paHandoffOpen({ file_path: target('w1.txt') }, { token })
    const both = await Promise.all([
      settle(() => exec({ file_path: target('w1.txt') }, { token })),
      settle(() => exec({ file_path: target('w1.txt') }, { token })),
    ])
    const texts = both.map((r) => refusalText(r) ?? '')
    expect(texts.some((t) => t.includes('PA_HANDOFF_LOST')), `the single take leaves nothing to re-enter: ${JSON.stringify(texts)}`).toBe(true)
    expect(exec.execCount(), 'exactly one redemption may reach the byte stage').toBe(1)
    expect(log.filter((e) => e.kind === 'walk'), 'Part A is never re-run on a redemption leg').toHaveLength(0)
  })

  it('H3: close is idempotent, terminal, and leaves nothing a same-token call can revive', async () => {
    const log: PaEvent[] = []
    const exec = await handoffRow(log)
    const token = Symbol('a5rsw-handoff-h3')
    const opened = await exec.paHandoffOpen({ file_path: target('w1.txt') }, { token }) as { correlation: string }
    expect(exec.paHandoffClose(token), 'close hands back the correlation whose plan fact to drop').toBe(opened.correlation)
    expect(exec.paHandoffClose(token), 'close is idempotent').toBeUndefined()
    expect(exec.paHandoffClose('not-a-token'), 'a non-token never closes').toBeUndefined()
    const late = await settle(() => exec({ file_path: target('w1.txt') }, { token }))
    expect(((late as unknown as { value?: { kind?: string } }).value ?? {}).kind, 'a closed token is TERMINAL: its original id answers cancelled, it never re-walks').toBe('cancelled')
    expect(exec.execCount(), 'zero bytes after the close').toBe(0)
    expect(log.map((e) => e.kind), 'no walk, no edge after the close').toEqual(['open'])
  })

  it('H4: a redemption that asks a DIFFERENT question mismatches (zero body); teardown claims every flight', async () => {
    const log: PaEvent[] = []
    const exec = await handoffRow(log)
    const token = Symbol('a5rsw-handoff-h4')
    await exec.paHandoffOpen({ file_path: target('w1.txt') }, { token })
    const other = await settle(() => exec({ file_path: target('w2.txt') }, { token }))
    const text = refusalText(other)
    expect(text, 'the redemption must ask the approved question').toBeDefined()
    expect(text).toContain('PA_HANDOFF_MISMATCH')
    expect(exec.execCount(), 'a mismatch never opens a file').toBe(0)
    exec.paHandoffCloseAll()
    const late = await settle(() => exec({ file_path: target('w1.txt') }, { token }))
    expect(((late as unknown as { value?: { kind?: string } }).value ?? {}).kind, 'teardown leaves the same terminal state').toBe('cancelled')
    expect(log.map((e) => e.kind), 'nothing walked on either leg').toEqual(['open'])
  })
})
