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
 *  read_image: native pre-read gate ORDER + sentences (extension law →
 *    store mounted → route capability → deployment media acceptance) —
 *    every gate refusal happens with zero fs I/O and zero attachment
 *    write; the positive leg commits through the mount-resolved store and
 *    the bytes committed EQUAL the disk bytes; oversized refused whole;
 *    store law-codes surface typed; default-deny zero commit; replay never
 *    double-commits.
 *
 * The canonicalization parity (fingerprints) is NOT here — it is the
 * golden gate (`u7-9a-mutation-golden-vectors.test.ts`), CA-01 style.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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

  it('I-2 POSITIVE: the committed bytes EQUAL the disk bytes; ok answers the attachment reference (never inline base64)', async () => {
    const observe: string[] = []
    const store = makeStore()
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store, observe })
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execWithRoute()))
    expect(r.ok).toBe(true)
    expect(store.saved).toHaveLength(1)
    expect(store.saved[0]!.bytes.equals(readFileSync(join(ROOT_DIR, 'photo.png')))).toBe(true)
    expect(store.saved[0]!.mediaType).toBe('image/png')
    expect(ran(observe, 'image')).toHaveLength(1)
    dispose()
  })

  it('I-3 extension-less positive via POST-CONSUME sniff (never a pre-approval byte read of a rejected kind): png bytes without extension commit as image/png', async () => {
    const store = makeStore()
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store })
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'noext') }, execWithRoute()))
    expect(r.ok).toBe(true)
    expect(store.saved[0]?.mediaType).toBe('image/png')
    dispose()
  })

  it('I-4 extension-less NON-image bytes refuse as not-an-image AFTER the read, with zero commit', async () => {
    writeFileSync(join(ROOT_DIR, 'noext-bin'), 'plain text pretending\n')
    const store = makeStore()
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store })
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'noext-bin') }, execWithRoute()))
    expect(r.ok).toBe(false)
    expect(store.saved).toHaveLength(0)
    dispose()
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
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store })
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'big.png') }, execWithRoute()))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('image-too-large')
    expect(store.saved).toHaveLength(0)
    dispose()
  })

  it('I-7 store law-code (dimension law) surfaces typed with nothing committed', async () => {
    const store = makeStore({}, 'IMAGE_DIMENSION_TOO_LARGE')
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store })
    const r = await attempt(() => def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execWithRoute()))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('IMAGE_DIMENSION_TOO_LARGE')
    expect(store.saved).toHaveLength(0)
    dispose()
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

  it('I-9 settled-token replay never double-commits', async () => {
    const store = makeStore()
    const { plane, dispose } = await mountedPlane(ALLOW('read_image'), { store })
    const token = Symbol('u79a-image-replay')
    const execLike = execWithRoute(token)
    const first = await def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execLike)
    expect(first.cancelled).toBeUndefined()
    expect(store.saved).toHaveLength(1)
    const again = await def(plane, 'read_image').execute({ file_path: join(ROOT_DIR, 'photo.png') }, execLike)
    expect(again.cancelled).toBe(true)
    expect(store.saved).toHaveLength(1)
    dispose()
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
})
