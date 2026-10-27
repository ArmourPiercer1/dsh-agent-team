/**
 * u7-fixfwd (2026-10-27) — post-merge #405 review HIGH F-405-R2-1: a hardlink
 * whose second name sits INSIDE the governed root while its first name is an
 * OUTSIDE canary must never be read, presented, loaded or mutated.
 *
 * Root cause: the shared opened-handle law `verifyOpenedHandle`
 * (controlled-fs/src/open-at-exec.ts) proved /proc/self/fd containment and
 * fstat-vs-snapshot identity. `/proc/self/fd/<n>` reports the PATH the fd was
 * opened through — for a hardlink that is the in-root name — and the snapshot
 * was taken of the same inode, so both checks passed. The `nlink === 1`
 * refusal existed ONLY on the create path. The fix lives ONCE in the shared
 * law (a `hardlink-alias` verdict, before any byte is read), so every caller
 * below fails closed with no per-family edit.
 *
 * Every leg pairs the ANSWER with a FACT: canary bytes absent from the result,
 * the observation lines and the port payload; the port/store not invoked; the
 * outside canary byte-identical after write/edit attempts. Positive controls
 * prove an ordinary nlink=1 file still flows through the same caller.
 *
 * Mutation (evidence dev/agent-workflow/evidence/u7-fixfwd-20261027/): with the
 * nlink check removed from open-at-exec.ts every H-leg below is RED.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { linkSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD_LEX = join(REPO, 'tests/homes', `u7-fixfwd-hl-${Date.now().toString(36)}`)
let WORLD = WORLD_LEX
let ROOT = ''
let OUTSIDE = ''
let SKILL_ROOT = ''
const REALM = 'u7-fixfwd-hl-realm'
const CANARY = 'OUTSIDE-CANARY-HARDLINK-NEVER-DISCLOSE-7c1d'
const INSIDE = 'INSIDE-PLAIN-NLINK-ONE-CONTROL'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])
const CANARY_PNG = Buffer.concat([PNG, Buffer.from(CANARY)])

type Outcome = Record<string, unknown> & { kind?: string; code?: string; text?: string }
type Exec = (raw: unknown, corr?: Record<string, unknown>) => Promise<Outcome>

const allowPa = async (c: { signal?: { aborted?: boolean } }) => (c?.signal?.aborted === true ? { kind: 'allow', cancelled: true } : { kind: 'allow' })
const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
/** The fields this suite reads. The repo ships NO @types/node; the production
 *  shim (`packages/runtime/src/plugin/node-min.d.ts`) declares only what the
 *  host row itself uses (`isDirectory()`), and that shim says in its own header
 *  that nothing else may rely on it — so the test states the subset it needs
 *  rather than widening the shim for a test's convenience. */
type StatFields = { readonly dev: number; readonly ino: number; readonly size: number; readonly mtimeMs: number; readonly nlink: number }
const statOf = (p: string): StatFields => statSync(p) as unknown as StatFields
const flat = (...parts: unknown[]) => parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p, (_k, v) => (Buffer.isBuffer(v) || v instanceof Uint8Array ? Buffer.from(v).toString('latin1') : v)))).join('\n')

beforeAll(() => {
  mkdirSync(WORLD_LEX, { recursive: true })
  WORLD = realpathSync(WORLD_LEX)
  ROOT = join(WORLD, 'root')
  OUTSIDE = join(WORLD, 'outside')
  SKILL_ROOT = join(WORLD, 'skills')
  mkdirSync(ROOT, { recursive: true })
  mkdirSync(OUTSIDE, { recursive: true })
  mkdirSync(join(SKILL_ROOT, 'alias-skill'), { recursive: true })
  mkdirSync(join(SKILL_ROOT, 'plain-skill'), { recursive: true })
  // The canaries: FIRST name outside the governed root …
  writeFileSync(join(OUTSIDE, 'secret.txt'), `${CANARY}\n`)
  writeFileSync(join(OUTSIDE, 'secret.png'), CANARY_PNG)
  writeFileSync(join(OUTSIDE, 'secret-w.txt'), `${CANARY}-write\n`)
  writeFileSync(join(OUTSIDE, 'secret-e.txt'), `${CANARY}-edit\n`)
  writeFileSync(join(OUTSIDE, 'SKILL.md'), `---\nname: alias-skill\ndescription: planted outside\n---\n\n${CANARY}\n`)
  // … SECOND name inside it (same inode, same filesystem: one world dir).
  linkSync(join(OUTSIDE, 'secret.txt'), join(ROOT, 'alias.txt'))
  linkSync(join(OUTSIDE, 'secret.png'), join(ROOT, 'alias.png'))
  linkSync(join(OUTSIDE, 'secret-w.txt'), join(ROOT, 'alias-w.txt'))
  linkSync(join(OUTSIDE, 'secret-e.txt'), join(ROOT, 'alias-e.txt'))
  linkSync(join(OUTSIDE, 'SKILL.md'), join(SKILL_ROOT, 'alias-skill', 'SKILL.md'))
  // Positive controls: ordinary single-link in-root files.
  writeFileSync(join(ROOT, 'plain.txt'), `${INSIDE}\n`)
  writeFileSync(join(ROOT, 'plain.png'), PNG)
  writeFileSync(join(SKILL_ROOT, 'plain-skill', 'SKILL.md'), `---\nname: plain-skill\ndescription: ok\n---\n\n${INSIDE}\n`)
  // The fixture is what it claims: two names, one inode.
  for (const n of ['alias.txt', 'alias.png', 'alias-w.txt', 'alias-e.txt']) {
    expect(statOf(join(ROOT, n)).nlink, `fixture ${n} is a hardlink`).toBe(2)
  }
  expect(statOf(join(ROOT, 'alias.txt')).ino).toBe(statOf(join(OUTSIDE, 'secret.txt')).ino)
  expect(statOf(join(ROOT, 'plain.txt')).nlink).toBe(1)
})
afterAll(() => { rmSync(WORLD_LEX, { recursive: true, force: true }) })

// ─────────────────────────────────────────────────────────────────────────
describe('the shared law itself — verifyOpenedHandle', () => {
  const load = async () => await import(new URL('../controlled-fs/src/open-at-exec.ts', import.meta.url).href) as {
    verifyOpenedHandle: (h: unknown, anchor: string, snap: unknown) => Promise<{ verdict: string; nlink?: number; detail?: string }>
  }
  it('H-0 an in-root hardlink to an outside inode answers hardlink-alias (never confirmed), naming the link count', async () => {
    const { verifyOpenedHandle } = await load()
    const st = statOf(join(ROOT, 'alias.txt'))
    const h = await fsOpen(join(ROOT, 'alias.txt'), 'r')
    try {
      const v = await verifyOpenedHandle(h, ROOT, { dev: st.dev, ino: st.ino, size: st.size, mtimeMs: st.mtimeMs })
      expect(v.verdict).toBe('hardlink-alias')
      expect(v.nlink).toBe(2)
      expect(String(v.detail)).toMatch(/2 hard links/)
      expect(String(v.detail)).not.toContain(CANARY)
    } finally { await h.close() }
  })
  it('P-0 an ordinary nlink=1 in-root file is confirmed (positive control)', async () => {
    const { verifyOpenedHandle } = await load()
    const st = statOf(join(ROOT, 'plain.txt'))
    const h = await fsOpen(join(ROOT, 'plain.txt'), 'r')
    try {
      const v = await verifyOpenedHandle(h, ROOT, { dev: st.dev, ino: st.ino, size: st.size, mtimeMs: st.mtimeMs })
      expect(v.verdict).toBe('confirmed')
    } finally { await h.close() }
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('fs-family read', () => {
  const make = async (observe: string[]) => {
    const m = await import(new URL('../../tools/fs-family/src/index.mjs', import.meta.url).href) as { createGovernedReadExecutor: (i: Record<string, unknown>) => Exec & { execCount(): number } }
    return m.createGovernedReadExecutor({
      realmId: REALM, rootDir: ROOT,
      policy: { default: 'ask', allow: [], ask: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT } }], deny: [] },
      decide: () => ({ kind: 'allow' }), pa: allowPa, subtreeContains,
      observe: (l: string) => { observe.push(String(l)) },
    })
  }
  it('H-read an in-root hardlink to the outside canary is refused typed; zero canary bytes in the answer or any line; the byte stage never ran', async () => {
    const observe: string[] = []
    const exec = await make(observe)
    let out: unknown
    try { out = await exec({ file_path: join(ROOT, 'alias.txt') }) } catch (e) { out = String((e as Error).message) }
    expect(flat(out)).toMatch(/exec-time-hardlink-alias/)
    expect(flat(out)).toMatch(/hard link/)
    expect(flat(out, observe)).not.toContain(CANARY)
    expect(exec.execCount(), 'the byte stage never ran').toBe(0)
  })
  it('P-read a normal nlink=1 file still reads', async () => {
    const exec = await make([])
    const out = await exec({ file_path: join(ROOT, 'plain.txt') }) as { kind?: string; lines?: Array<{ text: string }> }
    expect(out.kind).toBe('ok')
    expect(out.lines?.[0]?.text).toBe(INSIDE)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('fs-family read_image', () => {
  const make = async (observe: string[]) => {
    const lane = await import(new URL('../../tools/fs-family/src/image-executor.mjs', import.meta.url).href) as { createGovernedReadImageExecutor: (i: Record<string, unknown>) => Exec }
    const portMod = await import(new URL('../../tools/fs-family/src/image-read-port.mjs', import.meta.url).href) as { createBoundedImageReadPort: (i: Record<string, unknown>) => (c: Record<string, unknown>) => Promise<Record<string, unknown>> }
    const store = { saved: [] as unknown[], imageLimits: { mediaTypes: ['image/png'], maxImageBytes: 8 * 1024 * 1024, maxMessageImageBytes: 5 * 1024 * 1024 }, saveImage: async (i: Record<string, unknown>) => { store.saved.push(i); return { attachmentId: `att-${String(store.saved.length)}`, mediaType: 'image/png', width: 8, height: 8 } } }
    const port = portMod.createBoundedImageReadPort({ rootDir: ROOT, observe: (l: string) => { observe.push(String(l)) } })
    const portCalls: unknown[] = []
    const portResults: unknown[] = []
    const readBytes = async (c: Record<string, unknown>) => { portCalls.push(c); const r = await port(c); portResults.push(r); return r }
    const exec = lane.createGovernedReadImageExecutor({
      realmId: REALM, rootDir: ROOT,
      policy: { default: 'ask', allow: [{ tool: 'read_image', resource: { kind: 'subtree', path: ROOT } }], ask: [], deny: [] },
      decide: () => ({ kind: 'allow' }), pa: allowPa, subtreeContains,
      attachmentsProvider: () => store, imageRoute: async () => ({ ok: true }), readBytes,
      observe: (l: string) => { observe.push(String(l)) },
    })
    return { exec, store, portResults }
  }
  it('H-image an in-root hardlink to the outside canary image is refused typed; the port returns zero bytes and the attachment store is never written', async () => {
    const observe: string[] = []
    const { exec, store, portResults } = await make(observe)
    const out = await exec({ file_path: join(ROOT, 'alias.png') })
    expect(out.kind).toBe('refused')
    expect(String(out.text)).toMatch(/exec-time-hardlink-alias/)
    expect(portResults).toHaveLength(1)
    expect((portResults[0] as { ok?: boolean; bytes?: unknown }).ok).toBe(false)
    expect((portResults[0] as { bytes?: unknown }).bytes).toBeUndefined()
    expect(store.saved, 'the attachment store is never written').toHaveLength(0)
    expect(flat(out, observe, portResults)).not.toContain(CANARY)
  })
  it('P-image a normal nlink=1 image still commits', async () => {
    const { exec, store } = await make([])
    const out = await exec({ file_path: join(ROOT, 'plain.png') })
    expect(out.kind, flat(out)).toBe('ok')
    expect(store.saved).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('inspect-family skill', () => {
  const make = async (observe: string[]) => {
    const m = await import(new URL('../../tools/inspect-family/src/skill-executor.mjs', import.meta.url).href) as { createGovernedSkillExecutor: (i: Record<string, unknown>) => Exec }
    return m.createGovernedSkillExecutor({
      realmId: REALM, skillRoots: [SKILL_ROOT], policy: { default: 'ask' },
      decide: () => ({ kind: 'allow' }), pa: allowPa,
      observe: (l: string) => { observe.push(String(l)) },
    })
  }
  it('H-skill a SKILL.md hardlinked from outside the sanctioned root is refused typed; the outside content is never loaded', async () => {
    const observe: string[] = []
    const exec = await make(observe)
    const out = await exec({ name: 'alias-skill' }, {})
    expect(out.kind).toBe('refused')
    expect(String(out.code)).toBe('exec-time-hardlink-alias')
    expect(flat(out, observe)).not.toContain(CANARY)
    expect(observe.some((l) => l.includes('governed-skill RAN'))).toBe(false)
  })
  it('P-skill a normal nlink=1 SKILL.md still loads', async () => {
    const exec = await make([])
    const out = await exec({ name: 'plain-skill' }, {})
    expect(out.kind, flat(out)).toBe('ok')
    expect(flat(out)).toContain(INSIDE)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('ui-family present (the F-405-R2-1 reproduction)', () => {
  const make = async (observe: string[]) => {
    const m = await import(new URL('../../tools/ui-family/src/present-executor.mjs', import.meta.url).href) as { createGovernedPresentExecutor: (i: Record<string, unknown>) => Exec }
    const presentCalls: unknown[] = []
    const port = {
      ask: async () => ({ answers: [] }),
      present: async (req: unknown) => { presentCalls.push(req); return { turn: 1 } },
    }
    const exec = m.createGovernedPresentExecutor({
      realmId: REALM, rootDir: ROOT, policy: { default: 'ask', allow: [], ask: [], deny: [] },
      decide: () => ({ kind: 'allow' }), pa: allowPa, portRef: () => port, subtreeContains,
      observe: (l: string) => { observe.push(String(l)) },
    })
    return { exec, presentCalls }
  }
  it('H-present an in-root hardlink to the outside canary is refused typed; the presenter is NEVER invoked; zero canary bytes anywhere', async () => {
    const observe: string[] = []
    const { exec, presentCalls } = await make(observe)
    const out = await exec({ files: [{ path: join(ROOT, 'alias.txt') }] }, { token: { t: 'h-present' } })
    expect(out.kind, flat(out)).toBe('refused')
    expect(String(out.code)).toBe('ANCHOR-ESCAPE')
    expect(String(out.text)).toMatch(/hardlink-alias/)
    expect(String(out.text)).toMatch(/hard link/)
    expect(presentCalls, 'the presenter is never invoked').toHaveLength(0)
    expect(observe.some((l) => l.includes('governed-present RAN') || l.includes('PROBED'))).toBe(false)
    expect(flat(out, observe, presentCalls)).not.toContain(CANARY)
  })
  it('P-present a normal nlink=1 file still presents (one port call)', async () => {
    const { exec, presentCalls } = await make([])
    const out = await exec({ files: [{ path: join(ROOT, 'plain.txt') }] }, { token: { t: 'p-present' } })
    expect(out.kind, flat(out)).toBe('ok')
    expect(presentCalls).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('search-family grep file target (the fifth read caller of the law)', () => {
  const call = (locator: string) => ({
    realmId: REALM, callId: `hl-${locator}`,
    parsedArgs: { tool: 'grep', pattern: 'CANARY|INSIDE', target: { placement: 'workspace', locator }, outputMode: 'content', fixedString: false, ignoreCase: false, multiline: false, contextLines: 0, maxResults: 100 },
  })
  const make = async () => {
    const m = await import(new URL('../../tools/search-family/src/search-mechanics.mjs', import.meta.url).href) as { createAnchoredSearchBackend: (i: Record<string, unknown>) => { run: (c: unknown, io: unknown) => Promise<Record<string, unknown>> } }
    return m.createAnchoredSearchBackend({ realmId: REALM, rootDir: ROOT, observe: () => {} })
  }
  it('H-grep a hardlinked file target is refused typed before grep sees the descriptor; zero canary bytes reach the sink', async () => {
    const b = await make()
    let sunk = ''
    const r = await b.run(call('alias.txt'), { sink: { write: (t: string) => { sunk += t } } })
    expect(r.ok).toBe(false)
    expect(String((r.failure as { code?: string })?.code)).toBe('exec-time-hardlink-alias')
    expect(flat(r, sunk)).not.toContain(CANARY)
  })
  it('P-grep a normal nlink=1 file target still searches', async () => {
    const b = await make()
    const r = await b.run(call('plain.txt'), { sink: { write: () => {} } })
    expect(r.ok, flat(r)).toBe(true)
    expect(flat(r)).toContain(INSIDE)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('controlled-fs post-consume write / edit — the same law protects the outside inode from mutation', () => {
  const load = async () => await import(new URL('../controlled-fs/src/index.ts', import.meta.url).href) as {
    createPostConsumeWriteClosure: (p: unknown, c: unknown, cfg: unknown) => { write: () => Promise<{ ok: boolean; error?: { details?: Record<string, unknown>; message?: string } }> }
    createPostConsumeEditClosure: (p: unknown, c: unknown, cfg: unknown) => { write: () => Promise<{ ok: boolean; error?: { details?: Record<string, unknown>; message?: string } }> }
  }
  it('H-write writing through an in-root hardlink is refused BEFORE truncation; the outside canary is byte-identical', async () => {
    const { createPostConsumeWriteClosure } = await load()
    const before = readFileSync(join(OUTSIDE, 'secret-w.txt'))
    const plan = { approvedRootLexical: ROOT, approvedRootReal: ROOT, approvedLocator: join(ROOT, 'alias-w.txt'), content: 'OVERWRITTEN', planFingerprint: 'fp-w' }
    const r = await createPostConsumeWriteClosure(plan, { parametersFingerprint: 'fp-w' }, { instanceRootDir: ROOT }).write()
    expect(r.ok).toBe(false)
    expect(String(r.error?.message)).toMatch(/hard link/)
    expect(readFileSync(join(OUTSIDE, 'secret-w.txt')).equals(before), 'outside canary untouched').toBe(true)
  })
  it('H-edit editing through an in-root hardlink is refused BEFORE the read half; the outside canary is byte-identical and never disclosed', async () => {
    const { createPostConsumeEditClosure } = await load()
    const before = readFileSync(join(OUTSIDE, 'secret-e.txt'))
    const plan = { approvedRootLexical: ROOT, approvedRootReal: ROOT, approvedLocator: join(ROOT, 'alias-e.txt'), oldString: 'CANARY', newString: 'EDITED', replaceAll: false, planFingerprint: 'fp-e' }
    const r = await createPostConsumeEditClosure(plan, { parametersFingerprint: 'fp-e' }, { instanceRootDir: ROOT }).write()
    expect(r.ok).toBe(false)
    expect(String(r.error?.message)).toMatch(/hard link/)
    expect(flat(r)).not.toContain(CANARY)
    expect(readFileSync(join(OUTSIDE, 'secret-e.txt')).equals(before), 'outside canary untouched').toBe(true)
  })
})
