/**
 * U6 PR3 — BL-01 RE-TEST: the team_bash ask-penetration backlog breach
 * (recorded at the 9b2 world, before the M1 PA wiring) must NOT exist at
 * the production seam anymore — and the shell name must be kernel-backed
 * at the door, with the native ride refused (CI-05) and the non-Team
 * native untouched (CI-03).
 *
 * Harness shape: the review-r1 R2 door pattern (scopedRegistryDouble +
 * installScopedToolGuard pairing) for the door legs, and the a5-m1-bash-c1
 * executor pattern (REAL confined backend + scripted Control legs) for the
 * ask-lane legs. The breach at 9b2 was: an ASK-lane `team_bash` call
 * executed the command with no durable approval landing. Today the ask
 * lane is the PA edge (mint → Control leg → consumeOnce on the ONE kernel
 * → backend), so the legs below pin BOTH halves: ask-DENY answers with zero
 * spawn (execCount 0 = the spawn gate never opened), and ask-APPROVE
 * executes EXACTLY once through the kernel-consumed grant.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'
import { installScopedToolGuard } from '../tool-dispatch/index.js'
import { scopedRegistryDouble } from './a5p1r-scoped-registry-double.js'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests', 'homes', `u6pr3-bl01-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const REALM = 'u6pr3-bl01-realm'

interface Definition { name: string; execute: (raw: unknown) => Promise<{ text: string }> }
interface PlaneValue {
  definitions: ReadonlyArray<Definition>
  ownNames: readonly string[]
  backends: Record<string, { execCount?: () => number }>
  placementFeed: (name: string) => { definitionIdentity: string; realmId: string } | undefined
  kernelGuard?: { owns(name: string): boolean; identityFor(name: string): string | null }
  centerKernel?: {
    kernel: { approvalFor(scopeKey: string, name: string): { familyId: string } | undefined }
    scopeKey: string
    familyIds?: readonly string[]
  }
}
type PlaneRow = { createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
  | { ok: true; value: PlaneValue }
  | { ok: false; code: string; message: string } }

let row: PlaneRow
beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(ROOT_DIR, { recursive: true })
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
// The a5-m1-bash-c1 world law: member templates CANNOT carry a shell-class
// allow (A2C-1); the governed bash world is default-ask with no shell rule
// — every shell call rides the ASK lane, which is exactly BL-01's shape.
const POLICY_ASK = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})

function buildPlane(controlLeg: unknown, planeOver: Record<string, unknown> = {}): PlaneValue {
  const built = row.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'u6pr3-bl01-team-root',
    controlLeg,
    permissionPolicy: POLICY_ASK,
    realmId: REALM,
    templateId: 'u6pr3-bl01-tpl',
    role: 'member',
    instanceId: 'u6pr3-bl01-instance',
    onObserve: () => {},
    plane: {
      fsInstance: { fs: 'u6pr3-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' },
      confinedProvider: confinedProvider(),
      cwdRoot: ROOT_DIR,
      ...planeOver,
    },
  })
  if (built.ok !== true) throw new Error(`mount refused: ${built.code} ${built.message}`)
  return built.value
}
const defOf = (plane: PlaneValue, name: string) => {
  const d = plane.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`no definition ${name}`)
  return d
}

describe('u6-pr3 BL-01 re-test — the ask lane cannot open the spawn gate', () => {
  it('BL01-1 ask-DENY (durable Control answers deny): typed refusal, execCount 0 — the breach shape is CLOSED at the production seam', async () => {
    const plane = buildPlane(denyingControlLeg())
    const r = await defOf(plane, 'team_bash').execute({ command: 'printf BL01-SHOULD-NEVER-RUN' })
    expect(r.text).toMatch(/refused|denied/i)
    expect(r.text).not.toContain('BL01-SHOULD-NEVER-RUN')
    expect(plane.backends.shell?.execCount?.(), 'ZERO process spawned — the spawn gate never opened').toBe(0)
  }, 60_000)

  it('BL01-2 ask-APPROVE (durable Control lands + consumes): the command executes EXACTLY once through the kernel-consumed grant', async () => {
    const plane = buildPlane(approvingControlLeg())
    const r = await defOf(plane, 'team_bash').execute({ command: 'printf BL01-RAN-ONCE' })
    expect(r.text).toContain('BL01-RAN-ONCE')
    expect(plane.backends.shell?.execCount?.()).toBe(1)
  }, 60_000)

  it('BL01-3 the door posture 9b2 lacked: the shell name is kernel-owned, table-bound to the process family', async () => {
    const plane = buildPlane(approvingControlLeg())
    const guard = plane.kernelGuard
    if (guard === undefined) throw new Error('kernelGuard absent — the door is unbacked (the 9b2 shape)')
    expect(guard.owns('team_bash')).toBe(true)
    const fed = plane.placementFeed('team_bash')
    expect(fed?.definitionIdentity).toMatch(/^def#\d+$/)
    expect(guard.identityFor('team_bash')).toBe(fed?.definitionIdentity)
    const center = plane.centerKernel
    if (center === undefined) throw new Error('center kernel absent')
    expect(center.kernel.approvalFor(center.scopeKey, 'team_bash')?.familyId).toBe('dsh.process-family')
  })
})

describe('u6-pr3 CI-05/CI-03 — the door on the native takeover spelling', () => {
  const nativePair = (planeValue: PlaneValue, double: ReturnType<typeof scopedRegistryDouble>) => {
    const outcome = installScopedToolGuard({
      agentCtx: double.ctxFor('agent-m1'),
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-agent-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames: (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)!.map((r) => r.name),
      maskedNames: [],
      assemblyOwnedNames: [],
      realmId: REALM,
      bindingFeed: (name: string) => planeValue.placementFeed?.(name),
      ...(planeValue.kernelGuard === undefined
        ? {}
        : { kernelGuard: { owns: (n: string) => planeValue.kernelGuard!.owns(n), identityFor: (n: string) => planeValue.kernelGuard!.identityFor(n) } }),
    })
    if (!outcome.ok) throw new Error(`guard pairing refused: ${String(outcome.error?.message)}`)
    const guard = outcome.value as unknown as { bindOwnTools(names: readonly string[]): { ok: boolean }; publish(): { ok: boolean }; observations(): readonly Record<string, unknown>[] }
    return guard
  }

  it('CI05-b: native `bash` takeover mount — an unbound global native bash body is refused BEFORE any effect (never a silent native ride)', async () => {
    const plane = buildPlane(approvingControlLeg(), { names: { grep: 'team_grep', glob: 'team_glob', bash: 'bash' } })
    const double = scopedRegistryDouble({ globalNames: ['bash', 'grep'] })
    const guard = nativePair(plane, double)
    guard.bindOwnTools([])
    expect(guard.publish().ok).toBe(true)
    const run = await double.runCall({ callId: 'ci05-bash-1', name: 'bash' })
    expect(run.bodies, 'the native bash body must NOT execute for a governed agent under the kernel-owned name').toEqual([])
    expect(String(run.threw)).toContain('approval table')
  })

  it('CI03-b control: WITHOUT a plane the native bash rides on, unchanged', async () => {
    const double = scopedRegistryDouble({ globalNames: ['bash', 'grep'] })
    const outcome = installScopedToolGuard({
      agentCtx: double.ctxFor('agent-m1'),
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-agent-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames: (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)!.map((r) => r.name),
      maskedNames: [],
      assemblyOwnedNames: [],
      realmId: REALM,
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.value.publish().ok).toBe(true)
    const run = await double.runCall({ callId: 'ci03-bash-1', name: 'bash' })
    expect(run.bodies.length, 'non-Team native bash rides on, unchanged').toBe(1)
    expect(run.threw).toBeUndefined()
  })
})
