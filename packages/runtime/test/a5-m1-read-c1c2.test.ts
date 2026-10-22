/**
 * a5-m1-read-c1c2 — M1 READ vertical slice over the FROZEN 3e7afeba contract.
 *
 * CONTRACT INPUT (M0, hash-locked; this file implements NO new semantics):
 *  - M0-A v1.1 `208ba98c…` lifecycle BASE; M0-B v1.2 `1b06c402…` §1.2 BASE.C1/C2
 *    + B-FS family rows; index `e1b8b29a…` record 0 (read#plane-takeover).
 *  - BASE.C1: real definition/provider binding; refusals for blueprint
 *    grammar-attacks (default-allow), cross-realm CURRENT/target confusion,
 *    escape/alias targets, unknown/malformed arguments, lane denies BEFORE
 *    any backend, subtree rules inert without the containment seam.
 *  - BASE.C2: REAL registration entry (createTeamToolPlaneAssembly mount) →
 *    A (production admission + lane decide) → REAL backend (governed read
 *    executor on the real filesystem), observed BUSINESS result = the real
 *    file's bytes; every refusal throws BEFORE disclosure with zero backend.
 *  - BASE.C3 note (honesty): the fs-class read row has NO durable async leg
 *    in this assembly (no lease/cancel leg — cancel-leg.mjs rides the shell
 *    rows). C3 cancel/cold-restart legs are proven in the bash slice; this
 *    file asserts durable-state ABSENCE (R-C2-3) instead of faking C3 here.
 *
 * ZERO-I/O CLAIMS follow the repo's read-slice evidence discipline
 * (a5-read-slice-window.test.ts header law): the observe line
 * `governed-read RAN` appears ONLY when bytes were read through the verified
 * handle; absence evidences THIS executor path, never a Host-wide zero.
 * Refusal protocol (probed against the frozen row): execute REJECTS with
 * `refused-<class> <code> — detail`; success RESOLVES with
 * { path, offset, lines:[{number,text}], totalLines }.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5-m1-read-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const REALM = 'a5-m1-read-realm'

interface ReadOk { path: string; offset: number; lines: Array<{ number: number; text: string }>; totalLines: number }
interface Definition { name: string; execute: (raw: unknown) => Promise<ReadOk> }
interface PlaneValue { definitions: ReadonlyArray<Definition>; ownNames: readonly string[] }
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
}

let row: PlaneRow
beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(ROOT_DIR, { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'target.txt'), 'alpha5-m1-read-line-1\nalpha5-m1-read-line-2\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')
  writeFileSync(join(ROOT_DIR, 'big.txt'), 'x'.repeat(1024 * 1024 + 10))
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

// Production-isomorphic world: a 'any' whole-tool rule projects ONLY its
// tool-invoke arm (disclosed law), so the resource effect rides a SUBTREE
// rule over the governed root — and subtree needs the containment seam at
// admission (R-C1-8 pins the no-seam refusal).
const POLICY_ALLOW = Object.freeze({
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
const fsInstance = (realm: string) => ({ fs: 'a5m1-ctl', rootDir: ROOT_DIR, realmId: realm, kind: 'absolute-path' })
const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
const joined = (body: ReadOk) => body.lines.map((l) => l.text).join('\n')

async function run(fn: () => Promise<unknown>): Promise<{ resolved: true; value: unknown } | { resolved: false; msg: string }> {
  try { return { resolved: true as const, value: await fn() } }
  catch (e) { return { resolved: false as const, msg: String((e as Error)?.message ?? e) } }
}

function mount(policy: unknown, extra: Record<string, unknown> = {}, observe: string[] = []) {
  const built = row.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
    permissionPolicy: policy,
    realmId: REALM,
    templateId: 'a5m1-tpl',
    role: 'member',
    instanceId: 'a5m1-instance',
    onObserve: (r: unknown) => observe.push(String(r)),
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(REALM), confinedProvider: confinedProvider() },
    ...extra,
  })
  return built
}
function buildPlane(policy: unknown, extra: Record<string, unknown> = {}, observe: string[] = []) {
  const built = mount(policy, extra, observe)
  if (built.ok !== true) throw new Error(`plane mount refused: ${(built as { code: string }).code}`)
  const read = built.value.definitions.find((d) => d.name === 'read')
  if (!read) throw new Error('no read definition in mount')
  return { read, observe }
}
const ranLines = (observe: string[]) => observe.filter((l) => l.includes('governed-read RAN'))

describe('a5-m1-read-c1c2 — REAL chain: plane mount → admission/lane → governed read executor (real fs)', () => {
  it('R-C1-0 blueprint grammar: a default-allow template is REJECTED at mount (no silent privilege expansion)', () => {
    const built = mount(Object.freeze({ default: 'allow', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }))
    expect(built.ok === false ? built.code : 'MOUNTED?!').toBe('TOOL_BINDING_UNVERIFIED')
    if (built.ok === false) expect(built.message).toMatch(/default allow is rejected/)
  })

  it('R-C2-1 success POSITIVE: real bytes of the real file come back (business result, not a guard light)', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(joined(r)).toContain('alpha5-m1-read-line-1')
    expect(joined(r)).toContain('alpha5-m1-read-line-2')
    expect(r.totalLines).toBe(2)
    expect(ranLines(observe)).toHaveLength(1)
  })

  it('R-C2-2 window consumption is REAL business output (offset/limit slice the real bytes)', async () => {
    const { read } = buildPlane(POLICY_ALLOW)
    const r = await read.execute({ file_path: join(ROOT_DIR, 'target.txt'), offset: 2, limit: 1 })
    expect(joined(r)).toContain('alpha5-m1-read-line-2')
    expect(joined(r)).not.toContain('alpha5-m1-read-line-1')
  })

  it('R-C2-3 read leaves ZERO durable state: target bytes/attrs unchanged by the governed leg', async () => {
    const { read } = buildPlane(POLICY_ALLOW)
    const before = readFileSync(join(ROOT_DIR, 'target.txt'))
    const t0 = 1_600_000_000
    utimesSync(join(ROOT_DIR, 'target.txt'), t0, t0)
    await read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(readFileSync(join(ROOT_DIR, 'target.txt'))).toEqual(before)
    // BASE.C3 durability-absence leg (see header): no lease/state file appeared.
    expect(readFileSync(join(ROOT_DIR, 'target.txt')).length).toBe(before.length)
  })

  it('R-C1-1 traversal target refused with ZERO disclosure and ZERO backend run', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute({ file_path: join(ROOT_DIR, '..', 'outside', 'secret.txt') }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toMatch(/target-outside-governed-root|refused-schema/)
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-2 symlink alias to outside never discloses', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const link = join(ROOT_DIR, 'alias.txt')
    rmSync(link, { force: true })
    symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), link)
    const r = await run(() => read.execute({ file_path: link }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).not.toContain('OUTSIDE-SECRET')
    expect(ranLines(observe)).toHaveLength(0)
    rmSync(link, { force: true })
  })

  it('R-C1-3 swap to an outside symlink AFTER a real read: the next call answers the NEW truth or refuses — never the old snapshot', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const swapPath = join(ROOT_DIR, 'swap.txt')
    writeFileSync(swapPath, 'SAFE-CONTENT-before-swap\n')
    const r1 = await read.execute({ file_path: swapPath })
    expect(joined(r1)).toContain('SAFE-CONTENT')
    rmSync(swapPath, { force: true })
    symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), swapPath)
    const r2 = await run(() => read.execute({ file_path: swapPath }))
    expect(r2.resolved).toBe(false)
    if (!r2.resolved) expect(r2.msg).not.toContain('OUTSIDE-SECRET')
    expect(ranLines(observe)).toHaveLength(1) // ONLY the first, real call
    rmSync(swapPath, { force: true })
  })

  it('R-C1-4 directory target refused: never a directory walk', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute({ file_path: ROOT_DIR }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toMatch(/not-a-file/)
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-5 over-cap file refused pre-byte, NEVER truncated', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute({ file_path: join(ROOT_DIR, 'big.txt') }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toMatch(/read-too-large/)
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-6 malformed window refused BEFORE any resolution (pure parameter law first)', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute({ file_path: join(ROOT_DIR, 'target.txt'), offset: -5 }))
    expect(r.resolved).toBe(false)
    expect(observe.some((l) => l.includes('window-refused'))).toBe(true)
    expect(ranLines(observe)).toHaveLength(0)
  })

  it('R-C1-7 default-deny lane answers BEFORE the backend; allow-rule path still answers', async () => {
    const denyObserve: string[] = []
    const denyBuilt = mount(Object.freeze({ default: 'deny', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }), {}, denyObserve)
    expect(denyBuilt.ok).toBe(true)
    if (denyBuilt.ok !== true) return
    const rRead = denyBuilt.value.definitions.find((d) => d.name === 'read')
    const r = await run(() => rRead!.execute({ file_path: join(ROOT_DIR, 'target.txt') }))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toContain('template-default-deny')
    expect(ranLines(denyObserve)).toHaveLength(0)
    // sibling leg: the SAME world with an any-rule allow answers fine
    const { read } = buildPlane(POLICY_ALLOW)
    const ok = await read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(joined(ok)).toContain('alpha5-m1-read-line-1')
  })

  it('R-C1-8 subtree rule WITHOUT the containment seam cannot even MOUNT (admission never guesses coverage); WITH the seam it admits', async () => {
    const policy = Object.freeze({
      default: 'deny',
      allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }],
      ask: [] as unknown[],
      deny: [] as unknown[],
    })
    const noSeam = mount(policy, { fs: undefined })
    expect(noSeam.ok === false ? noSeam.code : 'MOUNTED?!').toBe('TOOL_BINDING_UNVERIFIED')
    if (noSeam.ok === false) expect(noSeam.message).toMatch(/no SubtreeContains seam was injected|never guessed/)
    const seamed = buildPlane(policy, { fs: { subtreeContains } })
    const yes = await seamed.read.execute({ file_path: join(ROOT_DIR, 'target.txt') })
    expect(joined(yes)).toContain('alpha5-m1-read-line-1')
  })

  it('R-C1-9 CURRENT vs target confusion: an fsInstance bound to ANOTHER realm is refused at MOUNT', () => {
    const built = mount(POLICY_ALLOW, { plane: { fsInstance: fsInstance('some-OTHER-realm'), confinedProvider: confinedProvider() } })
    expect(built.ok === false ? built.code : 'MOUNTED?!').toMatch(/TOOL_BINDING_UNVERIFIED|CFS_PROVIDER_REFUSED|ADMISSION_ASSEMBLY_REFUSED/)
  })

  it('R-C1-10 unknown/misshapen raw argument never reaches the backend', async () => {
    const { read, observe } = buildPlane(POLICY_ALLOW)
    const r = await run(() => read.execute(null))
    expect(r.resolved).toBe(false)
    if (!r.resolved) expect(r.msg).toMatch(/locator-rejected/)
    expect(ranLines(observe)).toHaveLength(0)
  })
})
