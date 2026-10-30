/**
 * U7-9a C1 — the FS MUTATION family over the REAL chain: plane mount →
 * admission/lane → governed write/edit/read_image executors on the REAL
 * filesystem, every authority force the production seam injects (lane
 * decide, the PA one-shot edge, the controlled-fs post-consume closures,
 * the verified-handle image read port). The template law is
 * `a5-m1-read-c1c2.test.ts` (same fixtures, same honesty discipline): the
 * observe line `governed-write|edit|image RAN` appears ONLY when bytes
 * actually landed / were read through the verified boundary; every refusal
 * leg pairs the ANSWER with a DISK FACT (byte-compare), never with a guard
 * light alone.
 *
 * Pinned laws (per tool):
 *  write: create/update on real bytes; empty content legal; cap refused
 *    whole; unknown params refused (the governed row carries NO escalation
 *    lane); default-deny ZERO disk; outside-root + symlink-escape ZERO
 *    disk; missing parent NEVER mkdir-recursive (disclosed deviation);
 *    settled-token replay cancels (never re-consumes); closed flight before
 *    the body lands ZERO bytes; concurrent same-path calls each receipt
 *    their OWN bytes and the final file is one whole payload (single-chunk
 *    writes — no interleaved hybrid is claimable either way, and the
 *    receipts never claim more than their own fd wrote).
 *  edit: never creates (no-match/absent-target zero-disk); paired
 *    read+write effect coverage under default-deny (M-02 — the read effect
 *    is not decorative); replaceAll law; symlink/outside zero-disk; replay
 *    + close-before-body zero-disk.
 *  edit REFUSAL ZERO-EFFECT (U7-R3 C1 edit lane, the offline twin of the
 *    ledger's edit L3-refusal cell — fsm:refusal-zero-effect exercises
 *    write only): a lane-denied and a PA-denied edit each answer TYPED
 *    (`template-deny-lane` / `APPROVAL_DENIED`) with the WHOLE-directory
 *    digest identical (no partial apply, no stray entry) and a row ledger
 *    whose only edit line is the typed denial — plus a flip leg moving
 *    every witness. C1-only honesty: offline, grades the refusal LOGIC
 *    only (USER-RULING-20261029B item 2); the L3 grade rides live C2.
 *  read_image: native pre-read gate ORDER + sentences (extension law →
 *    store mounted → route capability → deployment media acceptance) —
 *    every gate refusal happens with zero fs I/O and zero attachment
 *    write; the positive leg commits through the mount-resolved store and
 *    the bytes committed EQUAL the disk bytes; oversized refused whole;
 *    store law-codes surface typed; default-deny zero commit; replay never
 *    double-commits.
 *  read_image REFUSAL ZERO-EFFECT + RESULT FACE (a5w-ri round, 2026-10-30,
 *    the read_image analogue of the ER discipline above): the IR arms grade
 *    every deny shape — the lane's `template-deny-lane`, the settled-DENY
 *    `APPROVAL_DENIED`, and deny-default's ungrantable `domain-ref` arm
 *    (`IO_POLICY_UNSUPPORTED`) — against the WHOLE-directory digest, an
 *    entry-identical WORLD, an attachment-store seam that was never CALLED,
 *    a ledger carrying only the typed denial and the KERNEL'S OWN admission
 *    rows (the `a5p2prod:` channel), each with a flip leg that moves every
 *    witness a READ can move (the store seam and the row ledger; the root
 *    digest is immovable for a read by law and is pinned on its own). The
 *    IP arms pin the TWO public faces of one
 *    admitted read as one source: the row's value and the two-block envelope
 *    rendered by the presentation face of the very Definition the mount
 *    registers (committed bytes == disk bytes == the byte count the envelope
 *    prints, the attachment reference field-for-field identical, the path the
 *    root-anchored one, store-reported geometry echoed field-for-field,
 *    nothing inline ever; a refusal produces no value and so no envelope at
 *    all).
 *
 * The canonicalization parity (fingerprints) is NOT here — it is the
 * golden gate (`u7-9a-mutation-golden-vectors.test.ts`), CA-01 style.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'

const dispatchLedger: { current?: { pendingCalls(): readonly unknown[] } } = {}

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `u7-9a-c1-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const REALM = 'u7-9a-c1-realm'

interface RowOutcome { path?: string; operation?: string; byteLength?: number; writtenFingerprint?: string; before?: string; after?: string; replaceAll?: boolean; cancelled?: boolean }
interface Definition { name: string; execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<RowOutcome> }
interface HandoffFace { open: (exec: object) => Promise<{ kind: string; code?: string; detail?: string; correlation?: string }>; close: (exec: object) => void }
interface PlaneValue {
  definitions: ReadonlyArray<Definition>
  ownNames: readonly string[]
  paReadHandoff?: HandoffFace
  mount: (agentCtx: Record<string, unknown>) => { dispose: () => void }
}
type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message?: string }

let row: { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built }

// PNG magic for the sniff legs (bytes only the STORE decodes dimensions
// from — the family never decodes, it commits what the verified handle
// read and lets the store apply its dimension law).
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])

const loadRow = async () => {
  if (!row) row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as typeof row
  return row
}

beforeAll(async () => {
  await loadRow()
  mkdirSync(ROOT_DIR, { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'exists.txt'), 'alpha5-u79a-before-line\n')
  writeFileSync(join(ROOT_DIR, 'multi.txt'), 'tick tick tick\n')
  writeFileSync(join(ROOT_DIR, 'photo.png'), PNG_BYTES)
  writeFileSync(join(ROOT_DIR, 'noext'), PNG_BYTES)
  writeFileSync(join(ROOT_DIR, 'notes.txt'), 'not-an-image-at-all\n')
  writeFileSync(join(ROOT_DIR, 'big.png'), Buffer.concat([PNG_BYTES, Buffer.alloc(64 * 1024, 7)]))
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.png'), PNG_BYTES)
  symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), join(ROOT_DIR, 'alias.txt'))
  mkdirSync(join(OUTSIDE_DIR, 'alldir'), { recursive: true })
  symlinkSync(join(OUTSIDE_DIR, 'alldir'), join(ROOT_DIR, 'dirlink'))
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
const fsInstance = () => ({ fs: 'u79a-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' })
const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})

// The decide lane's JSDoc param type asks for MUTABLE arrays; the lane never
// mutates them (its own law), so the test passes plain arrays — the earlier
// Object.freeze here only fought the typecheck, enforcing nothing at runtime.
const policy = (lanes: { allow?: unknown[]; ask?: unknown[]; deny?: unknown[] }) => ({
  default: 'deny',
  allow: lanes.allow ?? [],
  ask: lanes.ask ?? [],
  deny: lanes.deny ?? [],
})
const ALLOW = (tool: string) => policy({ allow: [{ tool, resource: { kind: 'subtree', path: ROOT_DIR } }] })
// Governed EDIT declares a PAIRED read+write effect set (M-02). The center
// admission covers each effect PER-KIND: the tool-invoke(edit) + write
// effect are covered by an `edit` rule, the READ effect needs a read-class
// rule. So a policy admitting an edit names BOTH — an honest consequence of
// declaring the read the edit actually performs; a single-class rule answers
// only part of the question and the center refuses (the E-6 leg pins the
// refusal).
const ALLOW_EDIT = policy({
  allow: [
    { tool: 'edit', resource: { kind: 'subtree', path: ROOT_DIR } },
    { tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } },
  ],
})

async function buildPolicy(frozen: unknown, extra: Record<string, unknown> = {}, observe: string[] = []): Promise<PlaneValue> {
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
    teamSessionId: 'u79a-test-team-root',
    permissionPolicy: frozen,
    realmId: REALM,
    templateId: 'u79a-tpl',
    role: 'member',
    instanceId: 'u79a-instance',
    onObserve: (r: unknown) => { observe.push(String(r)) },
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() },
    ...extra,
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} ${built.message ?? ''}`)
  return built.value
}

async function build(
  lanes: { allow?: unknown[]; ask?: unknown[]; deny?: unknown[] },
  extra: Record<string, unknown> = {},
  observe: string[] = [],
): Promise<PlaneValue> {
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
    teamSessionId: 'u79a-test-team-root',
    permissionPolicy: policy(lanes),
    realmId: REALM,
    templateId: 'u79a-tpl',
    role: 'member',
    instanceId: 'u79a-instance',
    onObserve: (r: unknown) => { observe.push(String(r)) },
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() },
    ...extra,
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} ${built.message ?? ''}`)
  return built.value
}

const def = (plane: PlaneValue, name: string): Definition => {
  const d = plane.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`no ${name} definition`)
  return d
}
const ran = (observe: string[], tool: string) => observe.filter((l) => l.includes(`governed-${tool} RAN`))

async function attempt(fn: () => Promise<unknown>): Promise<{ ok: true; value: RowOutcome } | { ok: false; msg: string }> {
  try { return { ok: true as const, value: await fn() as RowOutcome } }
  catch (e) { return { ok: false as const, msg: String((e as Error)?.message ?? e) } }
}
const bytesOf = (p: string): string | null => existsSync(p) ? readFileSync(p).toString('utf8') : null
const bytesEqual = (p: string, expected: string): boolean => bytesOf(p) === expected

// ─────────────────────────────────────────────────────────────────────────
describe('u7-9a C1 write — governed write on the real fs, every refusal zero-disk', () => {
  it('W-1 POSITIVE create: new file lands with EXACT bytes; receipt fingerprint == sha256(content) (center hashString law)', async () => {
    const observe: string[] = []
    const plane = await build(ALLOW('write'), {}, observe)
    const target = join(ROOT_DIR, 'created-a.txt')
    const r = await attempt(() => def(plane, 'write').execute({ file_path: target, content: 'hello-u79a\n' }))
    expect(r.ok).toBe(true)
    expect(bytesEqual(target, 'hello-u79a\n')).toBe(true)
    expect(readFileSync(target).byteLength).toBe(11)
    if (r.ok) {
      expect(r.value.operation).toBe('create')
      expect(r.value.writtenFingerprint).toBe(`sha256:${createHash('sha256').update('hello-u79a\n', 'utf8').digest('hex')}`)
    }
    expect(ran(observe, 'write')).toHaveLength(1)
  })

  it('W-2 POSITIVE update: existing bytes replaced; receipt says update; NO before/after echo (disclosed D-C2-1 deviation)', async () => {
    const plane = await build(ALLOW('write'))
    const r = await attempt(() => def(plane, 'write').execute({ file_path: join(ROOT_DIR, 'exists.txt'), content: 'replaced\n' }))
    expect(r.ok).toBe(true)
    expect(bytesEqual(join(ROOT_DIR, 'exists.txt'), 'replaced\n')).toBe(true)
    if (r.ok) {
      expect(r.value.operation).toBe('update')
      expect(r.value).not.toHaveProperty('before')
      expect(r.value).not.toHaveProperty('after')
    }
  })

  it('W-3 empty content is LEGAL (clears the file, zero bytes)', async () => {
    const plane = await build(ALLOW('write'))
    writeFileSync(join(ROOT_DIR, 'clears.txt'), 'was-here')
    const r = await attempt(() => def(plane, 'write').execute({ file_path: join(ROOT_DIR, 'clears.txt'), content: '' }))
    expect(r.ok).toBe(true)
    expect(bytesEqual(join(ROOT_DIR, 'clears.txt'), '')).toBe(true)
  })

  it('W-4 default-deny: refused BEFORE any authority and the disk is byte-identical (nothing created, nothing changed)', async () => {
    const observe: string[] = []
    const plane = await build({}, {}, observe)
    const fresh = join(ROOT_DIR, 'never-created.txt')
    const before = readFileSync(join(ROOT_DIR, 'exists.txt'))
    const r1 = await attempt(() => def(plane, 'write').execute({ file_path: fresh, content: 'x' }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.msg).toContain('template-default-deny')
    expect(existsSync(fresh)).toBe(false)
    const r2 = await attempt(() => def(plane, 'write').execute({ file_path: join(ROOT_DIR, 'exists.txt'), content: 'MUTATE' }))
    expect(r2.ok).toBe(false)
    expect(readFileSync(join(ROOT_DIR, 'exists.txt')).equals(before)).toBe(true)
    expect(ran(observe, 'write')).toHaveLength(0)
  })

  it('W-5 outside-root target refused at the pure anchor; outside bytes UNTOUCHED', async () => {
    const plane = await build(ALLOW('write'))
    const r = await attempt(() => def(plane, 'write').execute({ file_path: join(OUTSIDE_DIR, 'secret.txt'), content: 'OVERWRITE' }))
    expect(r.ok).toBe(false)
    expect(bytesEqual(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')).toBe(true)
  })

  it('W-6 symlink escape refused BOTH ways: symlink-name target AND through a linked directory; outside bytes untouched', async () => {
    const plane = await build(ALLOW('write'))
    const r1 = await attempt(() => def(plane, 'write').execute({ file_path: join(ROOT_DIR, 'alias.txt'), content: 'THROUGH-LINK' }))
    expect(r1.ok).toBe(false)
    expect(bytesEqual(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')).toBe(true)
    const r2 = await attempt(() => def(plane, 'write').execute({ file_path: join(ROOT_DIR, 'dirlink', 'new.txt'), content: 'THROUGH-DIR' }))
    expect(r2.ok).toBe(false)
    expect(existsSync(join(OUTSIDE_DIR, 'alldir', 'new.txt'))).toBe(false)
  })

  it('W-7 unknown parameters refused (NO escalation lane on the governed row) with zero disk', async () => {
    const plane = await build(ALLOW('write'))
    const fresh = join(ROOT_DIR, 'unknown-param.txt')
    const r = await attempt(() => def(plane, 'write').execute({ file_path: fresh, content: 'x', sandbox_permissions: 'danger-full-access', justification: 'because' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('write-unknown-parameter')
    expect(existsSync(fresh)).toBe(false)
  })

  it('W-8 over-cap content refused WHOLE (measured fact in the text), never truncated, zero disk', async () => {
    const plane = await build(ALLOW('write'))
    const fresh = join(ROOT_DIR, 'over-cap.txt')
    const r = await attempt(() => def(plane, 'write').execute({ file_path: fresh, content: 'a'.repeat(1024 * 1024 + 1) }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('write-content-too-large')
    expect(existsSync(fresh)).toBe(false)
  })

  it('W-9 missing parent directory is NEVER mkdir-recursive (disclosed deviation): io refusal, no parent, no file', async () => {
    const plane = await build(ALLOW('write'))
    const deep = join(ROOT_DIR, 'missing', 'inner', 'file.txt')
    const r = await attempt(() => def(plane, 'write').execute({ file_path: deep, content: 'x' }))
    expect(r.ok).toBe(false)
    expect(existsSync(join(ROOT_DIR, 'missing'))).toBe(false)
  })

  it('W-10 settled-token replay CANCELS at the execution edge (never re-consumes, never re-writes)', async () => {
    const plane = await build(ALLOW('write'))
    const write = def(plane, 'write')
    const target = join(ROOT_DIR, 'replay.txt')
    const args = { file_path: target, content: 'first\n' }
    const token = Symbol('u79a-write-replay')
    const first = await write.execute(args, { name: 'write', token })
    expect(first.cancelled).toBeUndefined()
    expect(bytesEqual(target, 'first\n')).toBe(true)
    const again = await write.execute(args, { name: 'write', token })
    expect(again.cancelled, 'the settled token rides a terminal signal — the PA edge answers cancelled, zero consumption').toBe(true)
    expect(bytesEqual(target, 'first\n')).toBe(true)
  })

  it('W-11 the execution signal aborted BEFORE the body: cancelled fact, the file is never created', async () => {
    const plane = await build(ALLOW('write'))
    const target = join(ROOT_DIR, 'closed-flight.txt')
    const r = await attempt(() => def(plane, 'write').execute(
      { file_path: target, content: 'x' },
      { name: 'write', token: Symbol('u79a-write-close'), signal: AbortSignal.abort() },
    ))
    // The row's honest cancelled transport: a cancelled INVOCATION fact,
    // not a success and not a lie — and above all, the disk fact below.
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.cancelled).toBe(true)
    expect(existsSync(target)).toBe(false)
  })

  it('W-12 concurrent same-path writes are HONEST: each receipt claims only its OWN bytes; the final file is ONE whole payload', async () => {
    const plane = await build(ALLOW('write'))
    const target = join(ROOT_DIR, 'race.txt')
    const [a, b] = await Promise.all([
      def(plane, 'write').execute({ file_path: target, content: 'AAAA-write-a\n' }),
      def(plane, 'write').execute({ file_path: target, content: 'BBBBBBBB-write-b\n' }),
    ])
    expect(a.cancelled).toBeUndefined()
    expect(b.cancelled).toBeUndefined()
    const final = bytesOf(target)
    // single-chunk writes: the final state is one writer's COMPLETE payload
    // (never an interleaved hybrid), and each receipt's byteLength matches
    // exactly the bytes THAT call's fd wrote — nothing is claimed beyond it.
    expect(final === 'AAAA-write-a\n' || final === 'BBBBBBBB-write-b\n').toBe(true)
    expect([a.byteLength, b.byteLength]).toEqual([13, 17])
  })

  it('W-13 ask lane: approval lands through the control leg and writes ONCE; the deny leg writes ZERO', async () => {
    const audit: string[] = []
    const planeOk = await build({ ask: [{ tool: 'write', resource: { kind: 'subtree', path: ROOT_DIR } }] }, { controlLeg: approvingControlLeg(audit) })
    const target = join(ROOT_DIR, 'ask-approved.txt')
    const ok = await attempt(() => def(planeOk, 'write').execute({ file_path: target, content: 'approved\n' }))
    expect(ok.ok).toBe(true)
    expect(bytesEqual(target, 'approved\n')).toBe(true)
    expect(audit.some((l) => l.startsWith('c1-standin-landing'))).toBe(true)
    const planeNo = await build({ ask: [{ tool: 'write', resource: { kind: 'subtree', path: ROOT_DIR } }] }, { controlLeg: denyingControlLeg(audit) })
    const denied = join(ROOT_DIR, 'ask-denied.txt')
    const no = await attempt(() => def(planeNo, 'write').execute({ file_path: denied, content: 'x' }))
    expect(no.ok).toBe(false)
    expect(existsSync(denied)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('u7-9a C1 edit — never creates, M-02 paired coverage, refusals zero-disk', () => {
  it('E-1 POSITIVE: real bytes updated; the receipt echoes before/after — lawful because the effect set PAIRS the read (M-02)', async () => {
    const observe: string[] = []
    const plane = await buildPolicy(ALLOW_EDIT, {}, observe)
    writeFileSync(join(ROOT_DIR, 'e1.txt'), 'alpha5-u79a-before-line\n')
    const r = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'e1.txt'), old_string: 'before', new_string: 'AFTER' }))
    expect(r.ok).toBe(true)
    expect(bytesEqual(join(ROOT_DIR, 'e1.txt'), 'alpha5-u79a-AFTER-line\n')).toBe(true)
    if (r.ok) {
      expect(r.value.before).toContain('before')
      expect(r.value.after).toContain('AFTER')
    }
    expect(ran(observe, 'edit')).toHaveLength(1)
  })

  it('E-2 NEVER creates: absent target refused, the file is NOT born', async () => {
    const plane = await buildPolicy(ALLOW_EDIT)
    const fresh = join(ROOT_DIR, 'edit-never.txt')
    const r = await attempt(() => def(plane, 'edit').execute({ file_path: fresh, old_string: 'x', new_string: 'y' }))
    expect(r.ok).toBe(false)
    expect(existsSync(fresh)).toBe(false)
  })

  it('E-3 no-match: refusal + the file is BYTE-IDENTICAL', async () => {
    const plane = await buildPolicy(ALLOW_EDIT)
    writeFileSync(join(ROOT_DIR, 'e3.txt'), 'nothing-here\n')
    const before = readFileSync(join(ROOT_DIR, 'e3.txt'))
    const r = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'e3.txt'), old_string: 'absent-needle', new_string: 'y' }))
    expect(r.ok).toBe(false)
    expect(readFileSync(join(ROOT_DIR, 'e3.txt')).equals(before)).toBe(true)
  })

  it('E-4 multi-match law: without replace_all refused byte-identical; with replace_all ALL occurrences land', async () => {
    const plane = await buildPolicy(ALLOW_EDIT)
    writeFileSync(join(ROOT_DIR, 'e4.txt'), 'tick tick tick\n')
    const before = readFileSync(join(ROOT_DIR, 'e4.txt'))
    const r1 = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'e4.txt'), old_string: 'tick', new_string: 'tock' }))
    expect(r1.ok).toBe(false)
    expect(readFileSync(join(ROOT_DIR, 'e4.txt')).equals(before)).toBe(true)
    const r2 = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'e4.txt'), old_string: 'tick', new_string: 'tock', replace_all: true }))
    expect(r2.ok).toBe(true)
    expect(bytesEqual(join(ROOT_DIR, 'e4.txt'), 'tock tock tock\n')).toBe(true)
  })

  it('E-5 empty-old / identical-pair refused at the PURE parameter law (before any PA consult, before any disk)', async () => {
    const observe: string[] = []
    const plane = await buildPolicy(ALLOW_EDIT, {}, observe)
    const r1 = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'e1.txt'), old_string: '', new_string: 'y' }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.msg).toContain('edit-old-string-empty')
    const r2 = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'e1.txt'), old_string: 'same', new_string: 'same' }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('edit-old-equals-new')
    expect(ran(observe, 'edit')).toHaveLength(0)
  })

  it('E-6 M-02 PAIRED COVERAGE: a write-only rule does NOT admit the edit (its READ effect is unruled) — refusal, byte-identical', async () => {
    const observe: string[] = []
    const plane = await build(ALLOW('write'), {}, observe)
    writeFileSync(join(ROOT_DIR, 'e6.txt'), 'paired-coverage\n')
    const before = readFileSync(join(ROOT_DIR, 'e6.txt'))
    const r = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'e6.txt'), old_string: 'paired', new_string: 'UNRULED' }))
    expect(r.ok).toBe(false)
    expect(readFileSync(join(ROOT_DIR, 'e6.txt')).equals(before)).toBe(true)
    expect(ran(observe, 'edit')).toHaveLength(0)
  })

  it('E-7 outside-root + symlink escape: refusals, outside bytes UNTOUCHED', async () => {
    const plane = await buildPolicy(ALLOW_EDIT)
    const r1 = await attempt(() => def(plane, 'edit').execute({ file_path: join(OUTSIDE_DIR, 'secret.txt'), old_string: 'SECRET', new_string: 'X' }))
    expect(r1.ok).toBe(false)
    expect(bytesEqual(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')).toBe(true)
    const r2 = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'alias.txt'), old_string: 'SECRET', new_string: 'X' }))
    expect(r2.ok).toBe(false)
    expect(bytesEqual(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')).toBe(true)
  })

  it('E-8 settled-token replay cancels; a pre-aborted signal lands zero bytes', async () => {
    const plane = await buildPolicy(ALLOW_EDIT)
    const edit = def(plane, 'edit')
    writeFileSync(join(ROOT_DIR, 'e8.txt'), 'one\n')
    const token = Symbol('u79a-edit-replay')
    const args = { file_path: join(ROOT_DIR, 'e8.txt'), old_string: 'one', new_string: 'two' }
    const first = await edit.execute(args, { name: 'edit', token })
    expect(first.cancelled).toBeUndefined()
    expect(bytesEqual(join(ROOT_DIR, 'e8.txt'), 'two\n')).toBe(true)
    const again = await edit.execute(args, { name: 'edit', token })
    expect(again.cancelled).toBe(true)
    expect(bytesEqual(join(ROOT_DIR, 'e8.txt'), 'two\n')).toBe(true)
    const target = join(ROOT_DIR, 'e8-closed.txt')
    writeFileSync(target, 'closed\n')
    const before = readFileSync(target)
    const r = await attempt(() => edit.execute(
      { file_path: target, old_string: 'closed', new_string: 'late' },
      { name: 'edit', token: Symbol('u79a-edit-abort'), signal: AbortSignal.abort() },
    ))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.cancelled).toBe(true)
    expect(readFileSync(target).equals(before)).toBe(true)
  })

  it('E-9 ask lane: approval lands the edit ONCE; deny leaves bytes identical', async () => {
    const audit: string[] = []
    writeFileSync(join(ROOT_DIR, 'e9.txt'), 'ask-before\n')
    const askEdit = {
      default: 'deny',
      allow: [],
      ask: [
        { tool: 'edit', resource: { kind: 'subtree', path: ROOT_DIR } },
        { tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } },
      ],
      deny: [],
    }
    const planeOk = await buildPolicy(askEdit, { controlLeg: approvingControlLeg(audit) })
    const ok = await attempt(() => def(planeOk, 'edit').execute({ file_path: join(ROOT_DIR, 'e9.txt'), old_string: 'before', new_string: 'approved' }))
    expect(ok.ok).toBe(true)
    expect(bytesEqual(join(ROOT_DIR, 'e9.txt'), 'ask-approved\n')).toBe(true)
    const planeNo = await buildPolicy(askEdit, { controlLeg: denyingControlLeg(audit) })
    const no = await attempt(() => def(planeNo, 'edit').execute({ file_path: join(ROOT_DIR, 'e9.txt'), old_string: 'approved', new_string: 'DENIED' }))
    expect(no.ok).toBe(false)
    expect(bytesEqual(join(ROOT_DIR, 'e9.txt'), 'ask-approved\n')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// ER — THE EDIT-REFUSAL ZERO-EFFECT ARMS (U7-R3 C1 edit lane, 2026-10-30).
//
// THE CELL (u7-tool-acceptance, row edit, L3-refusal, NOT_VERIFIED):
// "no committed RUN record grades a live edit refusal: fsm:refusal-zero-
// effect exercises write only". The live fsm case denies a WRITE; on the
// offline side E-9's deny leg measures only the boolean (refused: yes/no)
// plus the target bytes — the refusal's TYPED identity, the row ledger's
// zero-write state and the WHOLE-DIRECTORY zero effect (no partial apply,
// no stray temp file, neighbours untouched) are graded by nothing. These
// two arms add the edit analogue of exactly that witness discipline, on
// this suite's EXISTING machinery (real chain: plane mount → lane →
// governed edit executor on the REAL filesystem):
//
//  ER-1 the LANE-DENY arm — a template deny rule over the edit class
//    answers `refused-admission template-deny-lane` BEFORE any authority
//    or disk: the whole-directory digest (every entry name + every byte,
//    entries included) is IDENTICAL across an existing-target and a
//    fresh-path attempt, the row ledger carries the typed lane-denied line
//    and ZERO `governed-edit RAN` / `governed-write RAN` lines. The flip
//    (same call under the paired ALLOW_EDIT policy) MOVES every witness —
//    digest changes, the RAN line appears — so the zeros are measured,
//    not vacuous.
//  ER-2 the PA-DENY arm — the ask lane settled DENY by the control leg
//    answers `refused-admission APPROVAL_DENIED` with the same whole-
//    directory zero and a ledger whose ONLY edit line is the typed
//    pa-refused one; flip: the approving leg lands the same edit once.
//
// C1-only honesty (USER-RULING-20261029B item 2, PR #456/#464 semantics):
// this grades the refusal LOGIC offline; it does NOT upgrade edit L3 —
// the L3 grade itself rides a live C2 boot cell after merge.
const dirDigest = (dir: string): string => {
  const h = createHash('sha256')
  for (const name of readdirSync(dir).sort()) {
    h.update(name).update('\u0000')
    try {
      h.update(readFileSync(join(dir, name)))
    } catch {
      h.update('<entry-not-a-plain-file>')
    }
    h.update('\u0001')
  }
  return h.digest('hex')
}

describe('u7-9a C1 ER — edit-refusal zero-effect arms (U7-R3 C1 edit lane)', () => {
  it('ER-1 lane-deny: TYPED refusal before any authority; the WHOLE directory digest is identical across existing-target AND fresh-path attempts; ledger carries the typed denial and zero RAN lines; the allow flip moves every witness', async () => {
    const observe: string[] = []
    const plane = await buildPolicy({
      default: 'deny',
      allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }],
      ask: [],
      deny: [{ tool: 'edit', resource: { kind: 'subtree', path: ROOT_DIR } }],
    }, {}, observe)
    writeFileSync(join(ROOT_DIR, 'er1.txt'), 'er1-before-line\n')
    const fresh = join(ROOT_DIR, 'er1-never-born.txt')
    const digestBefore = dirDigest(ROOT_DIR)

    const r1 = await attempt(() => def(plane, 'edit').execute({ file_path: join(ROOT_DIR, 'er1.txt'), old_string: 'before', new_string: 'MUTATED' }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) {
      expect(r1.msg).toContain('refused-admission')
      expect(r1.msg).toContain('template-deny-lane')
    }
    const r2 = await attempt(() => def(plane, 'edit').execute({ file_path: fresh, old_string: 'absent', new_string: 'x' }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('template-deny-lane')

    // zero effect measured OVER THE WHOLE DIRECTORY: no partial apply, no
    // temp entry, no fresh file born, neighbours byte-identical.
    expect(dirDigest(ROOT_DIR), 'a refused edit must not move ONE byte or ONE directory entry').toBe(digestBefore)
    expect(existsSync(fresh)).toBe(false)
    expect(bytesEqual(join(ROOT_DIR, 'er1.txt'), 'er1-before-line\n')).toBe(true)
    // the row ledger: ONE typed lane denial per refused attempt (two
    // legs above); NO edit/write executor line was ever written.
    expect(observe.filter((l) => l.includes('governed-edit lane-denied refusal code=template-deny-lane'))).toHaveLength(2)
    expect(ran(observe, 'edit')).toHaveLength(0)
    expect(ran(observe, 'write')).toHaveLength(0)
    expect(observe.filter((l) => l.includes('governed-edit') && !l.includes('lane-denied'))).toHaveLength(0)

    // FLIP (sensitivity): the SAME calls under the paired-allow policy
    // move every witness — digest changes, the RAN line lands.
    const observeF: string[] = []
    const planeOk = await buildPolicy(ALLOW_EDIT, {}, observeF)
    const flip = await attempt(() => def(planeOk, 'edit').execute({ file_path: join(ROOT_DIR, 'er1.txt'), old_string: 'before', new_string: 'MUTATED' }))
    expect(flip.ok).toBe(true)
    expect(bytesEqual(join(ROOT_DIR, 'er1.txt'), 'er1-MUTATED-line\n')).toBe(true)
    expect(dirDigest(ROOT_DIR)).not.toBe(digestBefore)
    expect(ran(observeF, 'edit')).toHaveLength(1)
  })

  it('ER-2 PA-deny: the ask lane settled DENY answers TYPED APPROVAL_DENIED; whole-directory zero; the ledger writes ONLY the typed pa-refused line; the approving flip lands the edit ONCE', async () => {
    const askEdit = {
      default: 'deny',
      allow: [],
      ask: [
        { tool: 'edit', resource: { kind: 'subtree', path: ROOT_DIR } },
        { tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } },
      ],
      deny: [],
    }
    writeFileSync(join(ROOT_DIR, 'er2.txt'), 'er2-before-line\n')
    const digestBefore = dirDigest(ROOT_DIR)

    const audit: string[] = []
    const observe: string[] = []
    const planeNo = await buildPolicy(askEdit, { controlLeg: denyingControlLeg(audit) }, observe)
    const no = await attempt(() => def(planeNo, 'edit').execute({ file_path: join(ROOT_DIR, 'er2.txt'), old_string: 'before', new_string: 'DENIED' }))
    expect(no.ok).toBe(false)
    if (!no.ok) {
      expect(no.msg).toContain('refused-admission')
      expect(no.msg).toContain('APPROVAL_DENIED')
      expect(no.msg).toContain('answered deny')
    }
    // the durable request actually settled deny (the refusal is about a
    // REAL closed request, not an unreachable leg)
    expect(audit.some((l) => l.startsWith('c1-standin ') && l.includes('decision=deny'))).toBe(true)
    expect(dirDigest(ROOT_DIR), 'a PA-denied edit must not move ONE byte or ONE directory entry').toBe(digestBefore)
    expect(bytesEqual(join(ROOT_DIR, 'er2.txt'), 'er2-before-line\n')).toBe(true)
    // ledger zero-write (mutation face): the ONLY edit line is the typed
    // pa-refused one; no RAN line was ever written.
    expect(observe.filter((l) => l.includes('governed-edit pa-refused code=APPROVAL_DENIED'))).toHaveLength(1)
    expect(ran(observe, 'edit')).toHaveLength(0)
    expect(observe.filter((l) => l.includes('governed-edit') && !l.includes('pa-refused'))).toHaveLength(0)

    // FLIP (sensitivity): the approving leg lands the SAME edit once.
    const observeF: string[] = []
    const planeOk = await buildPolicy(askEdit, { controlLeg: approvingControlLeg([]) }, observeF)
    const flip = await attempt(() => def(planeOk, 'edit').execute({ file_path: join(ROOT_DIR, 'er2.txt'), old_string: 'before', new_string: 'APPROVED' }))
    expect(flip.ok).toBe(true)
    expect(bytesEqual(join(ROOT_DIR, 'er2.txt'), 'er2-APPROVED-line\n')).toBe(true)
    expect(dirDigest(ROOT_DIR)).not.toBe(digestBefore)
    expect(ran(observeF, 'edit')).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// The image legs drive the mount-resolved host seams EXACTLY as production
// does: `mount(agentCtx)` with `agentCtx.get('attachments' | 'llm')` — the
// same public ctx seam the native tool executes through. The fixture STORE
// mirrors the host attachment store's declared face (imageLimits +
// saveImage); its dimension/limit law-codes are the host law's shape.
describe('u7-9a C1 read_image — native gate ORDER, positive through the mount-resolved store, refusals zero-commit', () => {
  interface Store {
    imageLimits: { mediaTypes: string[]; maxImageBytes: number; maxMessageImageBytes: number }
    saved: Array<{ attachmentId: string; mediaType: string; bytes: Buffer; width: number; height: number }>
    saveImage: (i: { data: Buffer; mediaType: string; name?: string }) => Promise<{ attachmentId: string; mediaType: string; width: number; height: number; name?: string }>
  }
  const makeStore = (over: Partial<Store['imageLimits']> = {}, failCode?: string): Store => {
    const store: Store = {
      imageLimits: { mediaTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], maxImageBytes: 8 * 1024 * 1024, maxMessageImageBytes: 5 * 1024 * 1024, ...over },
      saved: [],
      saveImage: async ({ data, mediaType, name }) => {
        if (failCode !== undefined) {
          const err = new Error(`store law: ${failCode}`) as Error & { code?: string }
          err.code = failCode
          throw err
        }
        const ref = { attachmentId: `att-${String(store.saved.length + 1)}`, mediaType, width: 8, height: 8, ...(name === undefined ? {} : { name }) }
        store.saved.push({ ...ref, bytes: Buffer.from(data) })
        return ref
      },
    }
    return store
  }
  const execWithRoute = (token?: symbol): Record<string, unknown> => ({
    ...(token === undefined ? {} : { token }),
    name: 'read_image',
    agent: { session: { requestHeader: () => ({ config: { provider: 'unit-prov', model: 'unit-model' } }) }, options: { provider: 'unit-prov', model: 'unit-model' } },
  })
  const mountedPlane = async (
    lanes: { allow?: unknown[]; ask?: unknown[]; deny?: unknown[] },
    opts: { store?: Store | undefined; imageCapable?: boolean; observe?: string[] } = {},
  ): Promise<{ plane: PlaneValue; dispose: () => void; store: Store | undefined }> => {
    const plane = await build(lanes, {}, opts.observe ?? [])
    const store = opts.store
    const llm = opts.imageCapable === false
      ? { resolveModelInfo: async () => ({ inputModalities: ['text'] }) }
      : { resolveModelInfo: async () => ({ inputModalities: ['text', 'image'] }) }
    const handle = plane.mount({
      tools: { register: () => undefined },
      get: (name: string) => (name === 'attachments' ? store : name === 'llm' ? llm : undefined),
    })
    return { plane, dispose: () => { handle.dispose() }, store }
  }

  // POST-ADMISSION mechanics arm (u7-9a R1): the real executor + the REAL
  // bounded verified-handle port, driven with a test PA that ADMITS the
  // full fingerprinted effect set (recording every requested set). The
  // kernel's own refusal of the ungrantable attachment rung is proven
  // separately (I-12) through the mounted plane — the two arms together are
  // the law: admitted ⇒ the commit mechanics run; not admitted ⇒ zero
  // commit. Nothing here bypasses the executor's own gates.
  const createDirectImage = async (opts: { store: Store; observe?: string[] }): Promise<{
    exec: (raw: Record<string, unknown>, corr?: Record<string, unknown>) => Promise<RowOutcome>
    sets: Array<{ requestedEffects?: { effects?: Array<Record<string, unknown>> } }>
  }> => {
    const lane = await import(new URL('../../tools/fs-family/src/image-executor.mjs', import.meta.url).href) as {
      createGovernedReadImageExecutor: (i: Record<string, unknown>) => (raw: Record<string, unknown>, corr?: Record<string, unknown>) => Promise<RowOutcome>
    }
    const portMod = await import(new URL('../../tools/fs-family/src/image-read-port.mjs', import.meta.url).href) as {
      createBoundedImageReadPort: (i: { rootDir: string }) => (c: { canonicalLocator: string; maxBytes: number; signal?: unknown }) => Promise<never>
    }
    const sets: Array<{ requestedEffects?: { effects?: Array<Record<string, unknown>> } }> = []
    const exec = lane.createGovernedReadImageExecutor({
      realmId: REALM,
      rootDir: ROOT_DIR,
      policy: policy({ allow: [{ tool: 'read_image', resource: { kind: 'subtree', path: ROOT_DIR } }] }),
      decide: () => ({ kind: 'allow' }),
      // mirrors the REAL edge's arms: a settled token hands the executor an
      // already-aborted signal and the edge answers the cancel fact (same
      // law the plane's paAdmit walk answers on replay).
      pa: async (c: unknown) => {
        sets.push(c as { requestedEffects?: { effects?: Array<Record<string, unknown>> } })
        const signal = (c as { signal?: { aborted?: boolean } })?.signal
        return signal?.aborted === true ? { kind: 'allow', cancelled: true } : { kind: 'allow' }
      },
      subtreeContains,
      attachmentsProvider: () => opts.store,
      imageRoute: async () => ({ ok: true }),
      readBytes: portMod.createBoundedImageReadPort({ rootDir: ROOT_DIR }),
      observe: (line: string) => { opts.observe?.push(String(line)) },
    })
    return { exec, sets }
  }
  const outcomeKind = (o: unknown): string => String((o as { kind?: unknown })?.kind ?? 'unknown')
  const outcomeText = (o: unknown): string => String((o as { text?: unknown })?.text ?? '')

  it('I-1 pure pre-gate ORDER + sentences, ZERO I/O and zero commit: extension law first, then store mounted, then route, then media acceptance', async () => {
    // (a) .txt — the extension gate answers before ANY seam is consulted.
    const bare = await build(ALLOW('read_image'))
    const a = await attempt(() => def(bare, 'read_image').execute({ file_path: join(ROOT_DIR, 'notes.txt') }))
    expect(a.ok).toBe(false)
    if (!a.ok) expect(a.msg).toContain('unsupported-image-extension')
    // (b) valid extension, NO store mounted (mount never called): native sentence.
    const b = await attempt(() => def(bare, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }))
    expect(b.ok).toBe(false)
    if (!b.ok) expect(b.msg).toContain('no attachment service is mounted')
    // (c) store mounted, llm says the route has NO image modality.
    const { plane: p3, dispose: d3 } = await mountedPlane(ALLOW('read_image'), { store: makeStore(), imageCapable: false })
    const c = await attempt(() => def(p3, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execWithRoute()))
    expect(c.ok).toBe(false)
    if (!c.ok) expect(c.msg).toContain('does not declare image input')
    d3()
    // (d) image-capable route, but the deployment store accepts NO png.
    const { plane: p4, dispose: d4 } = await mountedPlane(ALLOW('read_image'), { store: makeStore({ mediaTypes: ['image/jpeg'] }) })
    const d = await attempt(() => def(p4, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execWithRoute()))
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.msg).toContain('image-media-not-accepted')
    d4()
  })

  it('I-2 POSITIVE (post-admission arm): the committed bytes EQUAL the disk bytes; ok answers the attachment reference (never inline base64)', async () => {
    const observe: string[] = []
    const store = makeStore()
    const { exec } = await createDirectImage({ store, observe })
    const o = await exec({ file_path: join(ROOT_DIR, 'photo.png') })
    expect(outcomeKind(o)).toBe('ok')
    expect(store.saved).toHaveLength(1)
    expect(store.saved[0]!.bytes.equals(readFileSync(join(ROOT_DIR, 'photo.png')))).toBe(true)
    expect(store.saved[0]!.mediaType).toBe('image/png')
    expect(ran(observe, 'image')).toHaveLength(1)
  })

  it('I-3 extension-less positive via POST-CONSUME sniff (never a pre-approval byte read of a rejected kind): png bytes without extension commit as image/png', async () => {
    const store = makeStore()
    const { exec } = await createDirectImage({ store })
    const o = await exec({ file_path: join(ROOT_DIR, 'noext') })
    expect(outcomeKind(o)).toBe('ok')
    expect(store.saved[0]?.mediaType).toBe('image/png')
  })

  it('I-4 extension-less NON-image bytes refuse as not-an-image AFTER the read, with zero commit', async () => {
    writeFileSync(join(ROOT_DIR, 'noext-bin'), 'plain text pretending\n')
    const store = makeStore()
    const { exec } = await createDirectImage({ store })
    const o = await exec({ file_path: join(ROOT_DIR, 'noext-bin') })
    expect(outcomeKind(o)).toBe('refused')
    expect(outcomeText(o)).toContain('not-an-image')
    expect(store.saved).toHaveLength(0)
  })

  it('I-5 outside-root + symlink escape: refused with zero commit; the outside image stays unstored', async () => {
    const store = makeStore()
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store })
    const a = await attempt(() => def(plane, 'read_image').execute({ file_path: join(OUTSIDE_DIR, 'secret.png') }, execWithRoute()))
    expect(a.ok).toBe(false)
    const b = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'alias.txt') }, execWithRoute()))
    expect(b.ok).toBe(false)
    expect(store.saved).toHaveLength(0)
    dispose()
  })

  it('I-6 oversized refused WHOLE (cap = min(store limits)), zero commit', async () => {
    const store = makeStore({ maxImageBytes: 32, maxMessageImageBytes: 32 })
    const { exec } = await createDirectImage({ store })
    const o = await exec({ file_path: join(ROOT_DIR, 'big.png') })
    expect(outcomeKind(o)).toBe('refused')
    expect(outcomeText(o)).toContain('image-too-large')
    expect(store.saved).toHaveLength(0)
  })

  it('I-7 store law-code (dimension law) surfaces typed with nothing committed', async () => {
    const store = makeStore({}, 'IMAGE_DIMENSION_TOO_LARGE')
    const { exec } = await createDirectImage({ store })
    const o = await exec({ file_path: join(ROOT_DIR, 'photo.png') })
    expect(outcomeKind(o)).toBe('refused')
    expect(outcomeText(o)).toContain('IMAGE_DIMENSION_TOO_LARGE')
    expect(store.saved).toHaveLength(0)
  })

  it('I-8 default-deny lane: refusal BEFORE any read, zero commit', async () => {
    const observe: string[] = []
    const store = makeStore()
    const { plane, dispose } = await mountedPlane({}, { store, observe })
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execWithRoute()))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('template-default-deny')
    expect(store.saved).toHaveLength(0)
    expect(ran(observe, 'image')).toHaveLength(0)
    dispose()
  })

  it('I-9 settled-token replay never double-commits (ONE admitted call, ONE commit; the replay answers terminal)', async () => {
    const store = makeStore()
    const { exec } = await createDirectImage({ store })
    const token = Symbol('u79a-image-replay')
    const first = await exec({ file_path: join(ROOT_DIR, 'photo.png') }, { token, route: async () => ({ ok: true }) })
    expect(outcomeKind(first)).toBe('ok')
    expect(store.saved).toHaveLength(1)
    const again = await exec({ file_path: join(ROOT_DIR, 'photo.png') }, { token, route: async () => ({ ok: true }) })
    expect(outcomeKind(again)).toBe('cancelled')
    expect(store.saved).toHaveLength(1)
  })

  it('I-10 torn-down mount: after dispose the host seams are gone — the row answers the no-store refusal, zero commit', async () => {
    const store = makeStore()
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store })
    dispose()
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execWithRoute()))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('no attachment service is mounted')
    expect(store.saved).toHaveLength(0)
  })

  it('I-11 unknown parameters refused with zero commit', async () => {
    const store = makeStore()
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store })
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png'), sandbox_permissions: 'x' }, execWithRoute()))
    expect(r.ok).toBe(false)
    expect(store.saved).toHaveLength(0)
    dispose()
  })

  it('I-12 R1 negative control — the REAL kernel: the attachment-store commit effect has no grantable rung in the closed admission grammar (admission-kernel RESOURCE_EFFECT_KINDS is protected center), so the FINGERPRINTED domain-ref arm makes the whole effect set unadmittable: typed refusal, ZERO commit, no RAN — the declared effect can no longer ride ungoverned', async () => {
    const observe: string[] = []
    const store = makeStore()
    // the MOST permissive read_image policy the grammar can express:
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store, observe })
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execWithRoute()))
    expect(r.ok).toBe(false)
    expect(store.saved).toHaveLength(0)
    expect(observe.some((l) => l.includes('governed-image') && /pa-refused|ask|pending/.test(l))).toBe(true)
    expect(ran(observe, 'image')).toHaveLength(0)
    dispose()
  })

  it('I-13 R1 pin — the DECLARED second target is IN the requested set: every governed call\'s fingerprinted PA request carries tool-invoke(read_image) + read(file) + domain-ref(' + "'" + 'attachment-store' + "'" + '); remove the arm and this test goes red (the reviewer\'s declared-effect law)', async () => {
    const store = makeStore()
    const { exec, sets } = await createDirectImage({ store })
    const o = await exec({ file_path: join(ROOT_DIR, 'photo.png') })
    expect(outcomeKind(o)).toBe('ok') // admitted ⇒ the mechanics arm runs (I-2)
    expect(sets).toHaveLength(1)
    const effects = sets[0]?.requestedEffects?.effects ?? []
    const kinds = effects.map((e) => String(e?.kind))
    expect(kinds).toContain('tool-invoke')
    expect(kinds).toContain('read')
    expect(kinds).toContain('domain-ref')
    const domain = effects.find((e) => e?.kind === 'domain-ref')
    expect(String(domain?.domainAuthorityId)).toBe('attachment-store')
    // the descriptor face carries the SAME identity (single-source const):
    const mechanics = await import(new URL('../../tools/fs-family/src/fs-mutation-mechanics.mjs', import.meta.url).href) as { ATTACHMENT_STORE_DOMAIN_AUTHORITY: string }
    expect(mechanics.ATTACHMENT_STORE_DOMAIN_AUTHORITY).toBe('attachment-store')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// IR — THE READ_IMAGE REFUSAL ZERO-EFFECT ARMS, and IP — ITS PUBLIC RESULT
// FACE VS THE ENVELOPE FACE THE HOST ACTUALLY REGISTERS (a5w-ri read_image
// coverage round, 2026-10-30; the read_image analogue of the ER block above).
//
// WHY THESE ARMS EXIST. I-1…I-13 grade the read_image MECHANICS: the pre-read
// gate ORDER, the post-admission commit (the committed bytes EQUAL the disk
// bytes), the cap/law-code faces, ONE default-deny lane (I-8) and the
// ungrantable domain-ref arm (I-12). Two holes stayed open, both named by the
// offline PoC (dev/agent-workflow/evidence/u7r3-readimage-20261030/POC-REPORT.md
// Q5 + its ask-lane probe legs A-2/A-4) and graded there only by a SCRATCH
// probe that never entered the committed tree:
//
//  (1) THE DENY ARMS (IR). Each refusal shape the governed image row answers —
//    the governance lane's deny rule (`template-deny-lane`), the settled-DENY
//    approval (`APPROVAL_DENIED`), and the deny-default template whose named
//    ask rule still cannot cover the domain-ref arm (`IO_POLICY_UNSUPPORTED`)
//    — was pinned only by its refusal STRING plus an empty store and an absent
//    RAN line (I-8/I-12). Missing was the zero-effect half measured the way ER
//    measures an edit refusal: the WHOLE-DIRECTORY digest (no temp file, no
//    stray entry, neighbours byte-identical), the WORLD staying
//    entry-identical, the attachment store never even being CALLED (a store
//    write IS a state write: an empty `saved` array shows nothing landed, the
//    call counter shows the seam was never touched), the row ledger carrying
//    ONLY the typed denial line, and — the arm the kernel owes honestly —
//    whether a Control request was born at all, AND by the kernel's OWN
//    handwriting on the plane's observe channel: the production admission
//    assembly writes through the sink the trusted mount hands it
//    (packages/runtime/src/plugin/live/team-tool-plane.mjs:859 wraps every
//    row as `a5p2prod: <event>`), so a leg reads the CENTER's ledger instead
//    of inferring from the row's self-report. A lane-denied call leaves NO
//    call-bearing kernel row; a PA-denied call leaves exactly ONE
//    `admission-requires-approval` and NO grant row; the deny-default call
//    leaves exactly ONE `production-admission-default-deny` and NO
//    `admission-requires-approval` — the refusal was born AT the kernel's
//    coverage gate, it was not admitted, granted or parked elsewhere and
//    undone here. Each leg ends in a FLIP that moves every witness a READ can
//    move (the store seam and the row ledger), so the zeros are measured, not
//    vacuous. The root digest is NOT such a witness: for a read it is
//    immovable by law, and IR-1's flip leg pins that on its own.
//  (2) THE PUBLIC RESULT FACE (IP). A governed image read produces TWO faces of
//    the same fact, and the host consumes the second: the row's execute VALUE
//    (the tool-result side) and the row's OWN presentation face — the
//    `{schema, render, presentationMeta}` the Definition carries through
//    `mount(agentCtx)` into `agentCtx.tools.register(def)` (the mount loop in
//    packages/runtime/src/plugin/live/team-tool-plane.mjs; the face is owned by
//    packages/tools/fs-family/src/image-row.mjs), which the pinned host
//    snapshots as the result's model-facing content. Nothing pinned that the
//    two faces are the SAME SOURCE: that the bytes the store committed are the
//    DISK bytes, that the value's byte count is the byte count the envelope
//    TEXT prints, that the attachment reference the envelope carries is
//    field-for-field the value's, that where the store reports its OWN facts
//    (a downscaled reference) both faces report THOSE and neither re-derives
//    the plane's numbers, that the reported path is the ROOT-ANCHORED path (a
//    relative call resolves inward and travels no further), and that NEITHER
//    face ever carries image bytes inline — the face is a reference. IP-1/IP-2
//    pin that identity through the production wiring (assembly → mount → the
//    very Definition the mount registers); IP-3 pins the refusal side, where
//    the row throws, so NO value and therefore NO envelope exists at all.
//
// C1-only honesty (USER-RULING-20261029B item 2, the ER block's discipline):
// the store is the disclosed in-test mirror of the host attachment store's
// declared face; the durable Control row, the real sharp decode and the native
// shadowing presentation stay the C2 legs the PoC sketch names.
interface ImageRowValue { path?: string; image?: Record<string, unknown>; cancelled?: boolean }
interface PresentationFace {
  schema: { required?: unknown; properties?: Record<string, unknown>; additionalProperties?: boolean }
  render: (args: unknown, value: unknown) => Array<Record<string, unknown>>
  presentationMeta: (args: unknown, value: unknown) => Record<string, unknown>
}
interface ImageRowDefinition {
  name: string
  execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<ImageRowValue>
  output?: PresentationFace
}
interface ImageStore {
  imageLimits: { mediaTypes: string[]; maxImageBytes: number; maxMessageImageBytes: number }
  /** Every saveImage ENTRY, in order — the witness that the state seam was
   *  consulted at all, kept apart from what actually landed (`saved`). */
  calls: Array<{ mediaType: string; byteLength: number }>
  saved: Array<{ attachmentId: string; mediaType: string; bytes: Buffer; width: number; height: number }>
  saveImage: (i: { data: Buffer; mediaType: string; name?: string }) => Promise<Record<string, unknown>>
}

/** The store mirror, faithful to the host attachment store's DECLARED face:
 *  a reference carries `bytes` (the schema requires it), so the default ref
 *  reports the length of what it was handed, and `refOver` emulates a store
 *  that reports its OWN facts about those bytes (a real store downscales and
 *  names the post-transform geometry plus the original dimensions). Which of
 *  the two branches the row takes therefore matters: the IP legs walk the
 *  store-reported branch (`ref.bytes`), while the I-* legs keep walking the
 *  measured-read fallback (`?? read.byteLength`) because their own store
 *  fixture omits `bytes` — both branches stay covered, neither is assumed. */
const makeImageStore = (refOver: Record<string, unknown> = {}): ImageStore => {
  const store: ImageStore = {
    imageLimits: { mediaTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], maxImageBytes: 8 * 1024 * 1024, maxMessageImageBytes: 5 * 1024 * 1024 },
    calls: [],
    saved: [],
    saveImage: async ({ data, mediaType, name }) => {
      store.calls.push({ mediaType, byteLength: data.byteLength })
      const ref: Record<string, unknown> = {
        attachmentId: `att-${String(store.saved.length + 1)}`,
        mediaType,
        bytes: data.byteLength,
        width: 8,
        height: 8,
        ...(name === undefined ? {} : { name }),
        ...refOver,
      }
      store.saved.push({ attachmentId: String(ref['attachmentId']), mediaType, bytes: Buffer.from(data), width: Number(ref['width']), height: Number(ref['height']) })
      return ref
    },
  }
  return store
}

/** The mounted plane over an EXPLICIT policy object (the ask/deny arms need a
 *  template default `policy()` cannot express), mounted against the SAME
 *  public host seams production binds: ctx.get('attachments') / ctx.get('llm').
 *  `registered` receives every Definition the placement hands to
 *  `agentCtx.tools.register`, so a leg can name what the HOST is given. */
const mountImagePlane = async (
  frozen: unknown,
  opts: { store: ImageStore; controlLeg?: unknown; observe?: string[]; imageCapable?: boolean; registered?: unknown[] },
): Promise<{ plane: PlaneValue; dispose: () => void }> => {
  const plane = await buildPolicy(frozen, opts.controlLeg === undefined ? {} : { controlLeg: opts.controlLeg }, opts.observe ?? [])
  const modalities = opts.imageCapable === false ? ['text'] : ['text', 'image']
  const handle = plane.mount({
    tools: {
      register: (definition: unknown) => {
        opts.registered?.push(definition)
        return () => undefined
      },
    },
    get: (name: string) => (name === 'attachments' ? opts.store : name === 'llm' ? { resolveModelInfo: async () => ({ inputModalities: modalities }) } : undefined),
  })
  return { plane, dispose: () => { handle.dispose() } }
}
const imageRow = (plane: PlaneValue): ImageRowDefinition => plane.definitions.find((x) => x.name === 'read_image') as unknown as ImageRowDefinition
const imageExec = (): Record<string, unknown> => ({
  name: 'read_image',
  agent: { session: { requestHeader: () => ({ config: { provider: 'unit-prov', model: 'unit-model' } }) }, options: { provider: 'unit-prov', model: 'unit-model' } },
})
async function attemptImage(fn: () => Promise<ImageRowValue>): Promise<{ ok: true; value: ImageRowValue } | { ok: false; msg: string }> {
  try { return { ok: true as const, value: await fn() } }
  catch (e) { return { ok: false as const, msg: String((e as Error)?.message ?? e) } }
}
const valueOrRefusal = (r: { ok: true; value: ImageRowValue } | { ok: false; msg: string }): ImageRowValue => {
  if (!r.ok) throw new Error(`expected an admitted image read, got: ${r.msg}`)
  return r.value
}
/** Count the PRODUCTION ADMISSION KERNEL's own rows on the plane's observe
 *  channel. The mount hands the center its sink
 *  (packages/runtime/src/plugin/live/team-tool-plane.mjs:859) and every row
 *  arrives as `a5p2prod: <event>`, the events being the kernel's own
 *  (packages/runtime/tool-admission/admission-kernel.ts — :1191 the
 *  default-deny coverage gate, :450 requires-approval, :307 grant-minted,
 *  :578 approved-grant-issued). This is what lets a refusal leg say "no
 *  authority was ever born here" from the CENTER's ledger rather than from
 *  the row's self-report. The two mount-time rows
 *  (`production-admission-note`, `production-admission-constructed`) ride
 *  every mount, so a leg claiming NOTHING happened also pins the total. */
const kernelRows = (observe: string[], event: string): number =>
  observe.filter((l) => l.includes(`a5p2prod: ${event}`)).length
const kernelRowTotal = (observe: string[]): number => observe.filter((l) => l.includes('a5p2prod: ')).length

const laneDenyImage = { default: 'deny', allow: [], ask: [], deny: [{ tool: 'read_image', resource: { kind: 'subtree', path: ROOT_DIR } }] }
const askDefaultAllowImage = { default: 'ask', allow: [{ tool: 'read_image', resource: { kind: 'subtree', path: ROOT_DIR } }], ask: [], deny: [] }
const denyDefaultNamedAskImage = { default: 'deny', allow: [], ask: [{ tool: 'read_image', resource: { kind: 'subtree', path: ROOT_DIR } }], deny: [] }

describe('u7-9a C1 IR — read_image refusal zero-effect arms (lane-deny, PA-deny, deny-default), each with a witness-moving flip leg', () => {
  it('IR-1 governance lane-deny: TYPED template-deny-lane before any read; WHOLE-directory and WORLD entries identical over an existing image AND a fresh path; the store seam is never called; the ledger carries only the typed lane denial; the ask+approve flip commits ONCE', async () => {
    const photo = join(ROOT_DIR, 'photo.png')
    const fresh = join(ROOT_DIR, 'ir1-never-born.png')
    const digestBefore = dirDigest(ROOT_DIR)
    const worldBefore = readdirSync(WORLD).sort()
    const observe: string[] = []
    const store = makeImageStore()
    const { plane, dispose } = await mountImagePlane(laneDenyImage, { store, observe })

    const r1 = await attemptImage(() => imageRow(plane).execute({ file_path: photo }, imageExec()))
    expect(r1.ok).toBe(false)
    if (!r1.ok) {
      expect(r1.msg).toContain('refused-admission')
      expect(r1.msg).toContain('template-deny-lane')
    }
    const r2 = await attemptImage(() => imageRow(plane).execute({ file_path: fresh }, imageExec()))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('template-deny-lane')

    // ZERO SIDE EFFECT, measured over the whole directory and the whole
    // world: no partial read landed anywhere, no temp file, no stray entry,
    // neighbours byte-identical, the fresh path never born.
    expect(dirDigest(ROOT_DIR), 'a refused image read must not move ONE byte or ONE directory entry').toBe(digestBefore)
    expect(existsSync(fresh)).toBe(false)
    expect(readdirSync(WORLD).sort()).toEqual(worldBefore)
    // the attachment store is a STATE write: the seam was never consulted.
    expect(store.calls).toHaveLength(0)
    expect(store.saved).toHaveLength(0)
    // the row ledger: ONE typed lane denial per refused attempt, and NO
    // executor line of any other kind.
    expect(observe.filter((l) => l.includes('governed-image lane-denied refusal code=template-deny-lane'))).toHaveLength(2)
    expect(ran(observe, 'image')).toHaveLength(0)
    expect(observe.filter((l) => l.includes('governed-image') && !l.includes('lane-denied'))).toHaveLength(0)
    // THE CENTER'S OWN LEDGER: the lane refused BEFORE the admission edge, so
    // the kernel wrote NOTHING for these two calls — not the default-deny
    // coverage note, not an approval request, not a grant. The only
    // `a5p2prod:` rows on the channel are the two the mount itself writes at
    // construction, which is what makes the four zeros a CLOSED statement: a
    // future call-bearing kernel event cannot slip through uncounted.
    for (const event of ['production-admission-default-deny', 'admission-requires-approval', 'admission-grant-minted', 'admission-approved-grant-issued']) {
      expect(kernelRows(observe, event), `a lane-denied read must never reach the admission edge (${event})`).toBe(0)
    }
    expect(kernelRowTotal(observe), 'only the two mount-time admission rows may exist').toBe(2)
    dispose()

    // FLIP (sensitivity): the SAME call under the ask template with an
    // approving control leg moves every witness a READ can move — the store
    // seam and the row ledger, plus the kernel rows (this leg is the only one
    // here that walks the admission edge at all). The root digest is NOT such
    // a witness: for a read it is immovable by law, pinned by the last line
    // below, because read_image owns no write face.
    const observeFlip: string[] = []
    const auditFlip: string[] = []
    const storeFlip = makeImageStore()
    const flip = await mountImagePlane(askDefaultAllowImage, { store: storeFlip, observe: observeFlip, controlLeg: approvingControlLeg(auditFlip) })
    const ran1 = await attemptImage(() => imageRow(flip.plane).execute({ file_path: photo }, imageExec()))
    expect(ran1.ok).toBe(true)
    expect(storeFlip.calls).toHaveLength(1)
    expect(storeFlip.saved).toHaveLength(1)
    expect(storeFlip.saved[0]!.bytes.equals(readFileSync(photo))).toBe(true)
    expect(ran(observeFlip, 'image')).toHaveLength(1)
    expect(auditFlip.some((l) => l.startsWith('c1-standin-landing'))).toBe(true)
    expect(kernelRows(observeFlip, 'admission-requires-approval')).toBe(1)
    expect(kernelRows(observeFlip, 'admission-grant-minted')).toBe(1)
    expect(kernelRows(observeFlip, 'admission-approved-grant-issued')).toBe(1)
    expect(kernelRows(observeFlip, 'production-admission-default-deny')).toBe(0)
    expect(dirDigest(ROOT_DIR), 'a READ that ran still writes nothing into the governed root').toBe(digestBefore)
    flip.dispose()
  })

  it('IR-2 PA-deny (the settled-DENY approval): TYPED APPROVAL_DENIED naming the request that answered deny; store seam never called; whole-directory zero; the ledger writes ONLY the typed pa-refused line; the approving flip commits ONCE', async () => {
    const photo = join(ROOT_DIR, 'photo.png')
    const digestBefore = dirDigest(ROOT_DIR)
    const worldBefore = readdirSync(WORLD).sort()
    const audit: string[] = []
    const observe: string[] = []
    const store = makeImageStore()
    const { plane, dispose } = await mountImagePlane(askDefaultAllowImage, { store, observe, controlLeg: denyingControlLeg(audit) })

    const denied = await attemptImage(() => imageRow(plane).execute({ file_path: photo }, imageExec()))
    expect(denied.ok).toBe(false)
    if (!denied.ok) {
      expect(denied.msg).toContain('refused-admission')
      expect(denied.msg).toContain('APPROVAL_DENIED')
      // the refusal names the request it answers — a REAL closed request,
      // not an unreachable leg.
      expect(denied.msg).toContain('answered deny')
    }
    expect(audit.filter((l) => l.startsWith('c1-standin ') && l.includes('decision=deny'))).toHaveLength(1)
    expect(dirDigest(ROOT_DIR), 'a PA-denied image read must not move ONE byte or ONE directory entry').toBe(digestBefore)
    expect(readdirSync(WORLD).sort()).toEqual(worldBefore)
    expect(store.calls).toHaveLength(0)
    expect(store.saved).toHaveLength(0)
    expect(observe.filter((l) => l.includes('governed-image pa-refused code=APPROVAL_DENIED'))).toHaveLength(1)
    expect(ran(observe, 'image')).toHaveLength(0)
    expect(observe.filter((l) => l.includes('governed-image') && !l.includes('pa-refused'))).toHaveLength(0)
    // THE CENTER'S OWN LEDGER: the approval case WAS born here — exactly one
    // `admission-requires-approval` — and NO grant row was ever written for it
    // (neither minted nor issued): the kernel's own testimony that the denial
    // closed the case before any authority existed. The total is pinned with
    // it — two mount-time rows plus that one request, nothing else.
    expect(kernelRows(observe, 'admission-requires-approval')).toBe(1)
    expect(kernelRows(observe, 'admission-grant-minted')).toBe(0)
    expect(kernelRows(observe, 'admission-approved-grant-issued')).toBe(0)
    expect(kernelRows(observe, 'production-admission-default-deny')).toBe(0)
    expect(kernelRowTotal(observe), 'two mount-time rows and exactly one approval request').toBe(3)
    dispose()

    // FLIP: the approving leg runs the SAME call once — so IR-2's zeros are
    // the DENIAL's zeros, not a mount that could never have committed.
    const observeFlip: string[] = []
    const storeFlip = makeImageStore()
    const flip = await mountImagePlane(askDefaultAllowImage, { store: storeFlip, observe: observeFlip, controlLeg: approvingControlLeg([]) })
    const ran2 = await attemptImage(() => imageRow(flip.plane).execute({ file_path: photo }, imageExec()))
    expect(ran2.ok).toBe(true)
    expect(storeFlip.saved).toHaveLength(1)
    expect(ran(observeFlip, 'image')).toHaveLength(1)
    flip.dispose()
  })

  it('IR-3 deny-default + a NAMED ask rule: the domain-ref arm stays ungrantable — TYPED IO_POLICY_UNSUPPORTED naming its arm, the control leg NEVER consulted (no Control request is ever born), store never called, ledger carries only the typed refusal', async () => {
    const photo = join(ROOT_DIR, 'photo.png')
    const digestBefore = dirDigest(ROOT_DIR)
    const worldBefore = readdirSync(WORLD).sort()
    const audit: string[] = []
    const observe: string[] = []
    const store = makeImageStore()
    const { plane, dispose } = await mountImagePlane(denyDefaultNamedAskImage, { store, observe, controlLeg: approvingControlLeg(audit) })

    const r = await attemptImage(() => imageRow(plane).execute({ file_path: photo }, imageExec()))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.msg).toContain('refused-admission')
      expect(r.msg).toContain('IO_POLICY_UNSUPPORTED')
      // the refusal names the arm that cannot be granted, so a reader can
      // tell WHICH effect the grammar cannot cover — never a bare refusal.
      expect(r.msg).toContain('(domain-ref)')
    }
    // zero STATE written, at the strongest face: no approval case ever
    // reached a control leg, so there is no request to settle and no grant
    // to consume.
    expect(audit).toHaveLength(0)
    expect(dirDigest(ROOT_DIR), 'an unadmittable image read must not move ONE byte or ONE directory entry').toBe(digestBefore)
    expect(readdirSync(WORLD).sort()).toEqual(worldBefore)
    expect(store.calls).toHaveLength(0)
    expect(store.saved).toHaveLength(0)
    expect(observe.filter((l) => l.includes('governed-image pa-refused code=IO_POLICY_UNSUPPORTED'))).toHaveLength(1)
    expect(ran(observe, 'image')).toHaveLength(0)
    expect(observe.filter((l) => l.includes('governed-image') && !l.includes('pa-refused'))).toHaveLength(0)
    // THE CENTER'S OWN LEDGER, and the door this closes: the refusal was
    // written BY the kernel's default-deny coverage gate — exactly ONE
    // `production-admission-default-deny` for the one uncovered arm — and NO
    // `admission-requires-approval` was ever emitted. So the "no Control
    // request" zero above is not an unreachable leg, and not a call that was
    // admitted or granted elsewhere and undone here: the center itself says
    // the effect set died at its coverage gate.
    expect(kernelRows(observe, 'production-admission-default-deny')).toBe(1)
    expect(kernelRows(observe, 'admission-requires-approval')).toBe(0)
    expect(kernelRows(observe, 'admission-grant-minted')).toBe(0)
    expect(kernelRows(observe, 'admission-approved-grant-issued')).toBe(0)
    expect(kernelRowTotal(observe), 'two mount-time rows and exactly one coverage-gate refusal').toBe(3)
    dispose()
  })
})

describe('u7-9a C1 IP — read_image result face vs the envelope face the mount registers (byte-identical, path-scoped, single source)', () => {
  it('IP-1 the DEFINITION THE MOUNT REGISTERS carries the family face, and value + envelope are the same source: committed bytes == disk bytes == value.bytes == the envelope text, the path is the root-anchored one, nothing travels inline', async () => {
    const photo = join(ROOT_DIR, 'photo.png')
    const disk = readFileSync(photo)
    const digestBefore = dirDigest(ROOT_DIR)
    const store = makeImageStore()
    const observe: string[] = []
    const audit: string[] = []
    const registered: unknown[] = []
    const { plane, dispose } = await mountImagePlane(askDefaultAllowImage, { store, observe, controlLeg: approvingControlLeg(audit), registered })
    const rowDef = imageRow(plane)

    // (0) THE WIRING ITSELF: the placement hands `agentCtx.tools.register`
    // the very Definition the plane publishes, and that Definition carries
    // the family's OWN face — so everything asserted below is what the host
    // is given, not a test-side stand-in.
    expect(registered).toContain(rowDef)
    const familyRow = await import(new URL('../../tools/fs-family/src/image-row.mjs', import.meta.url).href) as { IMAGE_ROW_PRESENTATION_FACE: PresentationFace }
    expect(rowDef.output).toBeDefined()
    expect(rowDef.output).toBe(familyRow.IMAGE_ROW_PRESENTATION_FACE)

    const value = valueOrRefusal(await attemptImage(() => rowDef.execute({ file_path: photo }, imageExec())))
    expect(store.saved).toHaveLength(1)
    // (a) the byte identity at the state seam: what the store RECEIVED is the
    // disk length, and what it COMMITTED is the disk bytes themselves.
    expect(store.calls[0]!.byteLength).toBe(disk.byteLength)
    expect(store.saved[0]!.bytes.equals(disk)).toBe(true)
    // (b) the public tool-result side: the reference it answers, never bytes.
    // This leg walks the STORE-REPORTED branch (the mirror names `bytes`, as
    // the host face requires), so the count below is the store's own number
    // for what it was handed — and it still equals the disk length, which is
    // the identity that has to hold for the model-facing face.
    expect(value.path).toBe(photo)
    const image = value.image ?? {}
    expect(String(image['attachmentId'])).toBe(store.saved[0]!.attachmentId)
    expect(String(image['mediaType'])).toBe('image/png')
    expect(Number(image['bytes'])).toBe(disk.byteLength)
    // (c) the envelope side: the SAME Definition's render over the SAME value.
    const blocks = rowDef.output!.render({}, value)
    expect(blocks.map((b) => String(b['type']))).toEqual(['text', 'image'])
    const envelope = String(blocks[0]!['text'])
    const attachment = blocks[1]!['attachment'] as Record<string, unknown>
    expect(attachment).toEqual(image) // field-for-field the value's reference
    expect(envelope).toContain(`<path>${photo}</path>`)
    expect(envelope).toContain(`${String(disk.byteLength)} bytes`)
    expect(envelope).toContain('image/png image, 8x8 px')
    // (d) the presentation meta mirrors the same identity (no third copy).
    expect(rowDef.output!.presentationMeta({}, value)).toEqual({ path: value.path, image })
    // (e) NO face carries image bytes inline — the host resolves the
    // reference; an inline base64 here would be a contract break.
    const wire = JSON.stringify({ value, blocks })
    expect(wire.includes('base64')).toBe(false)
    expect(wire.includes(disk.toString('base64'))).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(blocks[1]!, 'data')).toBe(false)
    // the declared schema is the reference shape too — closed at BOTH levels,
    // so nothing else may ride the result and the reference cannot be
    // half-populated (packages/tools/fs-family/src/image-row.mjs is the face's
    // owner; the inner arms are pinned with the same law as the outer one).
    expect(rowDef.output!.schema.required).toEqual(['path', 'image'])
    expect(rowDef.output!.schema.additionalProperties).toBe(false)
    const imageSchema = rowDef.output!.schema.properties?.image as { required?: unknown; additionalProperties?: boolean; properties?: Record<string, unknown> }
    expect(imageSchema.required).toEqual(['attachmentId', 'mediaType', 'bytes', 'width', 'height'])
    expect(imageSchema.additionalProperties).toBe(false)
    const originalDimensions = imageSchema.properties?.originalDimensions as { required?: unknown; additionalProperties?: boolean }
    expect(originalDimensions.required).toEqual(['width', 'height'])
    expect(originalDimensions.additionalProperties).toBe(false)
    // the value this very face renders satisfies the face it is rendered under
    // (required arms present, no unlisted key on the reference):
    for (const key of ['attachmentId', 'mediaType', 'bytes', 'width', 'height']) expect(Object.prototype.hasOwnProperty.call(image, key)).toBe(true)

    // (f) PATH SCOPE through the same production wiring: a RELATIVE call is
    // anchored into the governed root and both faces report the anchored
    // path — the raw relative spelling never travels to the model.
    const relative = valueOrRefusal(await attemptImage(() => rowDef.execute({ file_path: 'photo.png' }, imageExec())))
    expect(relative.path).toBe(photo)
    expect(String(relative.path).startsWith(`${ROOT_DIR}/`)).toBe(true)
    expect(store.saved).toHaveLength(2)
    expect(ran(observe, 'image')).toHaveLength(2)
    expect(audit).toHaveLength(2)
    expect(dirDigest(ROOT_DIR), 'two image reads that ran still write nothing into the governed root').toBe(digestBefore)
    dispose()
  })

  it('IP-2 where the store reports its OWN facts (a downscaled reference), value AND envelope carry those facts field-for-field — the plane never re-derives, never invents, and still commits the disk bytes', async () => {
    const photo = join(ROOT_DIR, 'photo.png')
    const disk = readFileSync(photo)
    // a store that downscales: it reports the POST-transform geometry and the
    // original dimensions, exactly the face the native row mirrors.
    const store = makeImageStore({ bytes: 999, width: 4, height: 4, originalDimensions: { width: 16, height: 8 } })
    const { plane, dispose } = await mountImagePlane(askDefaultAllowImage, { store, controlLeg: approvingControlLeg([]) })
    const rowDef = imageRow(plane)

    const value = valueOrRefusal(await attemptImage(() => rowDef.execute({ file_path: photo }, imageExec())))
    expect(store.saved[0]!.bytes.equals(disk)).toBe(true) // what was COMMITTED is the disk bytes
    const image = value.image ?? {}
    expect(Number(image['bytes'])).toBe(999)
    expect(Number(image['width'])).toBe(4)
    expect(Number(image['height'])).toBe(4)
    expect(image['originalDimensions']).toEqual({ width: 16, height: 8 })

    const blocks = rowDef.output!.render({}, value)
    const envelope = String(blocks[0]!['text'])
    expect(blocks[1]!['attachment']).toEqual(image)
    expect(envelope).toContain('image/png image, 4x4 px, 999 bytes')
    // the downscale advice is the STORE's numbers, computed once by the face
    // (16/4 on x, 8/4 on y — the anisotropic spelling).
    expect(envelope).toContain('downscaled from 16x8 px')
    expect(envelope).toContain('multiply x coordinates by 4.00 and y coordinates by 2.00')
    dispose()
  })

  it('IP-3 a refusal has NO result face at all: an escaping target answers TYPED before any seam is consulted, the store is never called, and nothing renderable exists — so no envelope can carry an out-of-scope path', async () => {
    const digestBefore = dirDigest(ROOT_DIR)
    const worldBefore = readdirSync(WORLD).sort()
    const store = makeImageStore()
    const observe: string[] = []
    const { plane, dispose } = await mountImagePlane(askDefaultAllowImage, { store, observe, controlLeg: approvingControlLeg([]) })
    const rowDef = imageRow(plane)

    const escaping = await attemptImage(() => rowDef.execute({ file_path: join(OUTSIDE_DIR, 'secret.png') }, imageExec()))
    expect(escaping.ok).toBe(false)
    if (!escaping.ok) {
      expect(escaping.msg).toContain('locator-rejected')
      expect(escaping.msg).toContain('escapes the governed root')
      // the refusal is a refusal STRING, never a value: it carries no
      // attachment reference for the host to resolve.
      expect(escaping.msg.includes('attachmentId')).toBe(false)
    }
    // no value ⇒ no envelope: the row THROWS the typed refusal, so the
    // presentation face is never reached with an out-of-scope fact.
    expect(store.calls).toHaveLength(0)
    expect(store.saved).toHaveLength(0)
    expect(readdirSync(WORLD).sort()).toEqual(worldBefore)
    expect(dirDigest(ROOT_DIR)).toBe(digestBefore)
    expect(observe.filter((l) => l.includes('governed-image RAN'))).toHaveLength(0)
    // and the face stays honest on a value it was never given: it renders an
    // empty path, never one it did not receive.
    const empty = rowDef.output!.render({}, {})
    expect(String(empty[0]!['text'])).toContain('<path></path>')
    dispose()
  })
})
