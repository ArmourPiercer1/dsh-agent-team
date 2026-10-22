/**
 * a5-m1-bash-c1 — M1 BASH vertical slice, C1 level (real confined process
 * backend behind the plane lane; the C2 real-PA legs ride the host kits).
 *
 * CONTRACT: M0-B `1b06c402…` §1.2 BASE.C1 + B-PROCESS.C1; index `e1b8b29a…`
 * records 9 (bash#plane-takeover) + 11 (team_bash#alias, R2).
 * NOT duplication of a5b2 (exit-code fidelity/timeouts) — this suite owns the
 * C1 refusal family (zero-side-effect-before-probe) + the R2 CHARACTERIZATION
 * pin of today's lane semantics (fix-leg detection, see R2-PIN below).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5-m1-bash-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const REALM = 'a5-m1-bash-realm'

interface Definition { name: string; execute: (raw: unknown) => Promise<{ text: string }> }
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: { definitions: ReadonlyArray<Definition>; ownNames: readonly string[]; backends: Record<string, { execCount?: () => number; lastStageTrace?: string[] }> } }
    | { ok: false; code: string; message: string }
}
let row: PlaneRow
beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(ROOT_DIR, { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-LEAK\n')
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
// World law (a5b2 precedent): member templates CANNOT carry a shell-class
// allow (A2C-1 in the frozen admission grammar); the governed bash success
// world is default-ask with NO shell rule — the lane answers allow and the
// ASK lifecycle is Host-PA-owned (the R2-PIN leg pins exactly this seam).
const POLICY_BASH_ALLOW = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
function buildPlane(policy: unknown, observe: string[] = [], controlLeg?: (input: Record<string, unknown>) => Promise<unknown>) {
  const built = row.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
    permissionPolicy: policy,
    realmId: REALM, templateId: 'a5m1-tpl', role: 'member', instanceId: 'a5m1-instance',
    onObserve: (r: unknown) => observe.push(String(r)),
    ...(controlLeg === undefined ? {} : { controlLeg }),
    plane: {
      fsInstance: { fs: 'a5m1-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' },
      confinedProvider: confinedProvider(),
      cwdRoot: ROOT_DIR,
    },
  })
  if (built.ok !== true) throw new Error(`mount refused: ${(built as { code: string }).code}`)
  return built.value
}
const def = (plane: ReturnType<typeof buildPlane>, name: string) => {
  const d = plane.definitions.find((x) => x.name === name)
  if (!d) throw new Error(`no definition ${name}`)
  return d
}
async function runBash(plane: ReturnType<typeof buildPlane>, raw: Record<string, unknown>) {
  try { return { threw: false, res: await def(plane, 'team_bash').execute(raw) } }
  catch (e) { return { threw: true, msg: String((e as Error)?.message ?? e) } }
}

describe('a5-m1-bash-c1 — confined shell C1 refusal family + success positive (real landlock process)', () => {
  it('B-C2p success POSITIVE at C1 level: PA ask → durable leg approves → REAL foreground command executes (real stdout/exit facts)', async () => {
    const plane = buildPlane(POLICY_BASH_ALLOW, [], approvingControlLeg())
    const r = await runBash(plane, { command: 'printf a5m1-bash-ran' })
    expect(r.threw).toBe(false)
    if (!r.threw) expect(r.res.text).toContain('a5m1-bash-ran')
  }, 60_000)

  it('B-C1-1 background spawn refused by NAME before any probe/spawn (never reinterpreted; the refusal rides BEHIND PA: even an approved call dies by name at the row)', async () => {
    const plane = buildPlane(POLICY_BASH_ALLOW, [], approvingControlLeg())
    const r = await runBash(plane, { command: 'sleep 30', background: true })
    expect(r.threw).toBe(false)
    if (!r.threw) expect(r.res.text).toMatch(/background-not-supported/)
    const be = plane.backends.shell
    expect(be?.execCount?.()).toBe(0)
    expect(be?.lastStageTrace?.length ?? 0).toBe(0) // never reached probe
  })

  it('B-C1-2 cwd escape refused with zero spawn', async () => {
    const plane = buildPlane(POLICY_BASH_ALLOW)
    const r = await runBash(plane, { command: 'id', cwd: '../outside' })
    expect(r.threw).toBe(false)
    if (!r.threw) expect(r.res.text).toMatch(/code=locator-rejected/); expect(r.res.text).toMatch(/\$\.cwd/); expect(r.res.text).toMatch(/`\.\.` segments are refused|segments are refused/)
    const be = plane.backends.shell
    expect(be?.execCount?.()).toBe(0)
  })

  it('B-C1-3 command text never leaves the governed surface: reading outside via the shell does NOT disclose the outside secret', async () => {
    const plane = buildPlane(POLICY_BASH_ALLOW, [], approvingControlLeg())
    const r = await runBash(plane, { command: 'cat ../outside/secret.txt' })
    if (!r.threw) expect(r.res.text).not.toContain('OUTSIDE-SECRET') // provider grant must make it unreadable
    if (r.threw) expect(r.msg).toMatch(/refused|denied|outside/i)
  }, 60_000)

  it('B-C1-4 deny-lane answers BEFORE the backend under a shell-class deny (execCount stays 0)', async () => {
    const observe: string[] = []
    const plane = buildPlane(Object.freeze({
      default: 'deny',
      allow: [{ tool: 'read', resource: { kind: 'any' } }],
      ask: [] as unknown[],
      deny: [{ tool: 'bash', resource: { kind: 'any' } }],
    }), observe)
    const r = await runBash(plane, { command: 'true' })
    expect(r.threw).toBe(false)
    if (!r.threw) expect(r.res.text).toContain('template-deny-lane')
    expect(plane.backends.shell?.execCount?.()).toBe(0)
    expect(observe.some((l) => l.includes('confined-shell capability'))).toBe(false)
  })

  it('R2-CENTER (was PIN): team_bash default-ask with NO control leg PENDING-REFUSES — request=0 now MEANS body=0 (the release-blocker flipped); a deny leg and an approve leg settle correctly', async () => {
    const observe: string[] = []
    // (a) no control leg mounted: pending is a denial, never an allow.
    const noLeg = buildPlane(Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }), observe)
    const r1 = await runBash(noLeg, { command: 'true' })
    expect(r1.threw).toBe(false)
    if (!r1.threw) expect(r1.res.text).toMatch(/APPROVAL_REQUEST_UNAVAILABLE/)
    expect(noLeg.backends.shell?.execCount?.()).toBe(0)
    expect(observe.some((l) => l.includes('pa-ask pending-refused'))).toBe(true)
    // (b) deny leg: the durable request settles deny — still zero spawn.
    const denyLeg = buildPlane(Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }), [], denyingControlLeg())
    const r2 = await runBash(denyLeg, { command: 'true' })
    if (!r2.threw) expect(r2.res.text).toMatch(/APPROVAL_DENIED/)
    expect(denyLeg.backends.shell?.execCount?.()).toBe(0)
    // (c) C1 stand-in approving leg (kernel landing real; durable Control row/guardOperation = AUTH bridge): ONE body after issueApprovedGrant + consume.
    const okLeg = buildPlane(Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] }), [], approvingControlLeg())
    const r3 = await runBash(okLeg, { command: 'printf r2-fixed-body' })
    expect(r3.threw).toBe(false)
    if (!r3.threw) expect(r3.res.text).toContain('r2-fixed-body')
    expect(okLeg.backends.shell?.execCount?.()).toBe(1)
  }, 90_000)

  it('B-C1-5 zero side effects during a LANE refusal: no scratch dir was created by the refused legs', () => {
    const strays = existsSync(join(ROOT_DIR, '.a5-scratch')) || existsSync(join(WORLD, 'scratch'))
    expect(strays).toBe(false)
  })
})
