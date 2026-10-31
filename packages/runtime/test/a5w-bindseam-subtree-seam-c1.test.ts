/**
 * a5w-bindseam-subtree-seam-c1 — the GLUE assembly seam for the plane's
 * subtree containment law (product assembly gap closed 2026-10-31, real UTC).
 *
 * DEFECT EVIDENCE (bw5 real boot, origin/task/a5w-bootwave-20261030):
 * dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/run-bw5.json trace[4] —
 * the root session mounted; a MEMBER child session whose blueprint template
 * carried `permissions.ask: [{tool:'read_image',
 * resource:{kind:'subtree', path:<workspace>}}]` was refused at mount with
 * `projection refused: the policy carries a subtree rule but no SubtreeContains
 * seam was injected … (code: TOOL_BINDING_UNVERIFIED)`.
 *
 * ROOT CAUSE (verified before the fix): the GLUE-5 assembly point in
 * `src/plugin/live/agent-bindings.mjs` — the ONLY production caller of
 * `createTeamToolPlaneAssembly` — never passed the `fs` input at all, so
 * `input.fs.subtreeContains` reached the admission kernel as absent and the
 * kernel's fail-closed projection law (`projection-subtree-seam-missing`,
 * tool-admission/admission-kernel.ts) refused the mount. The kernel law is
 * CORRECT and untouched; the missing piece was pure assembly.
 *
 * WHAT THIS SUITE PINS (C1, fixture-level — NOT a boot claim; the boot wave
 * stays the coordinator's):
 *  P1  a member policy carrying the EXACT incident rule shape mounts through
 *      the plane assembly when the GLUE seam (agent-bindings' exported
 *      `a5PlaneSubtreeContains` — the very function object production wires)
 *      is injected: no TOOL_BINDING_UNVERIFIED;
 *  P2  the subtree rule then PARTICIPATES IN THE VERDICT through the mounted
 *      plane's lane decide, by the law: an effect whose canonicalLocator is
 *      the root itself or lies under it is covered (deny lane fires); an
 *      effect outside the root is NOT covered (no deny);
 *  P3  the production call site keeps passing the seam (source pin — the
 *      regression that hid this gap was a silently absent key);
 *  N1  the kernel fail-closed law does NOT regress: the same subtree policy
 *      (a) mounted with NO `fs` input and (b) handed to
 *      `createProductionAdmissionAssembly` with NO `subtreeContains` option
 *      both refuse with TOOL_BINDING_UNVERIFIED / projection-subtree-seam-
 *      missing — and the SAME kernel face is ok WITH the seam (the seam is
 *      the discriminator, nothing else);
 *  N2  sibling-with-shared-prefix spoofing: `/root-evil` is NEVER covered by
 *      a `/root` subtree rule — on all THREE consumer faces the plane feeds
 *      the predicate (kernel realm-joined positional, lane raw positional,
 *      fs-family `{realmId, parent, child}` row object);
 *  N3  a non-path question THROWS (unknown coverage is never a guessed
 *      verdict — the seam answers only string-pair questions).
 *
 * The world fixture mirrors a5-m1-read-c1c2.test.ts (the frozen plane-mount
 * fixture): the launcher-backed confinedProvider + fsInstance under a
 * tests/homes/<line>-<stamp> world (TEST_METHODS §7), removed in teardown.
 * No boot, no host, no durable store — assembly law only.
 *
 * @module packages/runtime/test/a5w-bindseam-subtree-seam-c1
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/types.js'
import { loadGlueModule } from './t12a-live-bridge.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests', 'homes', `a5w-bindseam-${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}-${Date.now().toString(36)}`)
const WS = join(WORLD, 'workspace')
const OUTSIDE = join(WORLD, 'outside')
const REALM = 'a5w-bindseam-realm'

interface PlaneBuiltOk { ok: true, value: { ownNames: readonly string[], decide: (effectSet: { effects: unknown[] }) => { kind: string, code?: string } } }
interface PlaneBuiltNo { ok: false, code: string, message: string }
type PlaneBuilt = PlaneBuiltOk | PlaneBuiltNo
type PlaneRowModule = {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => PlaneBuilt
}

const GLUE_SRC = fileURLToPath(new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url).href)

/** The exported production seam function — loaded from the REAL glue module
 *  (the same function object the fixed call site hands the plane). */
let glueSeam: (a: unknown, b?: unknown) => boolean
let row: PlaneRowModule

beforeAll(async () => {
  mkdirSync(WS, { recursive: true })
  mkdirSync(OUTSIDE, { recursive: true })
  const glue = await loadGlueModule() as unknown as {
    a5PlaneSubtreeContains: (a: unknown, b?: unknown) => boolean
  }
  glueSeam = glue.a5PlaneSubtreeContains
  expect(typeof glueSeam).toBe('function')
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRowModule
})

afterAll(() => {
  rmSync(WORLD, { recursive: true, force: true })
})

const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
const fsInstance = { fs: 'a5w-bindseam-ctl', rootDir: WS, realmId: REALM, kind: 'absolute-path' }

// The bw5 incident shape: a MEMBER template whose ASK lane carries a subtree
// rule over the workspace for `read_image`.
const POLICY_INCIDENT = {
  default: 'deny',
  allow: [],
  ask: [{ tool: 'read_image', resource: { kind: 'subtree', path: WS } }],
  deny: [],
} as unknown as TemplatePermissionPolicy

// The same subtree LAW on the DENY lane, where the plane's own lane decide
// answers the coverage question synchronously (P2/N2 verdict face).
const POLICY_DENY_SUBTREE = {
  default: 'deny',
  allow: [],
  ask: [],
  deny: [{ tool: 'read', resource: { kind: 'subtree', path: WS } }],
} as unknown as TemplatePermissionPolicy

function mount(permissionPolicy: TemplatePermissionPolicy, fsInput: Record<string, unknown> | undefined): PlaneBuilt {
  return row.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'session-a5w-bindseam-team-root',
    permissionPolicy,
    realmId: REALM,
    templateId: 'a5w-bindseam-member-tpl',
    role: 'member',
    instanceId: 'a5w-bindseam-member',
    ...(fsInput === undefined ? {} : { fs: fsInput }),
    plane: { fsInstance, confinedProvider: confinedProvider() },
    onObserve: () => {},
  })
}

const readEffect = (canonicalLocator: string) => ({
  kind: 'read',
  resource: { realmId: REALM, canonicalLocator },
})

describe('a5w-bindseam-subtree-seam-c1 — the glue injects the plane subtree containment seam', () => {
  it('P1: the incident member policy (subtree ask rule) MOUNTS through the assembly with the glue seam — no TOOL_BINDING_UNVERIFIED', () => {
    const built = mount(POLICY_INCIDENT, { subtreeContains: glueSeam })
    if (built.ok !== true) {
      throw new Error(`mount refused: ${built.code} — ${built.message}`)
    }
    expect(built.ok).toBe(true)
    expect(built.value.ownNames.length > 0).toBe(true)
  })

  it('P2: the subtree rule participates in the verdict by the law — root itself and paths under it are covered, paths outside are not', () => {
    const built = mount(POLICY_DENY_SUBTREE, { subtreeContains: glueSeam })
    if (built.ok !== true) throw new Error(`mount refused: ${built.code} — ${built.message}`)
    const decide = built.value.decide
    // covered: the effect IS the declared root (equality arm of the law)
    expect(decide({ effects: [readEffect(WS)] })).toMatchObject({ kind: 'deny', code: 'template-deny-lane' })
    // covered: the effect lies UNDER the declared root
    expect(decide({ effects: [readEffect(`${WS}/nested/a.png`)] })).toMatchObject({ kind: 'deny', code: 'template-deny-lane' })
    // NOT covered: the effect lives outside the root — the deny rule does not reach it
    expect(decide({ effects: [readEffect(join(OUTSIDE, 'secret.txt'))] })).toMatchObject({ kind: 'allow' })
  })

  it('P3: the production call site keeps passing the seam (source pin against a silently absent key)', () => {
    const src = readFileSync(GLUE_SRC, 'utf8')
    expect(src).toContain('fs: { subtreeContains: a5PlaneSubtreeContains },')
  })

  it('N1a: the plane assembly with NO fs input still refuses the subtree policy TOOL_BINDING_UNVERIFIED (kernel fail-closed, never relaxed)', () => {
    const built = mount(POLICY_INCIDENT, undefined)
    expect(built.ok).toBe(false)
    if (built.ok === true) return
    expect(built.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(built.message).toContain('no SubtreeContains seam was injected')
  })

  it('N1b: the kernel options face is the discriminator — subtree policy refuses WITHOUT the seam and constructs WITH it', () => {
    const base = {
      permissionPolicy: POLICY_INCIDENT,
      realmId: REALM,
      templateId: 'a5w-bindseam-kernel-tpl',
      role: 'member' as const,
      definitionOwnerAuthority: 'human-user' as const,
      clock: () => 1790000000000,
      authorityGeneration: () => 0,
      beneficiaryAuthority: 'member' as const,
      onObserve: () => {},
    }
    const without = createProductionAdmissionAssembly({ ...base })
    expect(without.ok).toBe(false)
    if (without.ok) return
    expect(without.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(without.error.details?.refusal).toBe('projection-subtree-seam-missing')
    const withSeam = createProductionAdmissionAssembly({ ...base, subtreeContains: glueSeam })
    expect(withSeam.ok).toBe(true)
  })

  it('N2: sibling-with-shared-prefix spoofing never matches — on every consumer face the plane feeds the predicate', () => {
    // row face (fs-family executors call with ONE object argument, raw paths)
    expect(glueSeam({ realmId: REALM, parent: '/root', child: '/root' })).toBe(true)
    expect(glueSeam({ realmId: REALM, parent: '/root', child: '/root/x' })).toBe(true)
    expect(glueSeam({ realmId: REALM, parent: '/root/', child: '/root/x' })).toBe(true)
    expect(glueSeam({ realmId: REALM, parent: '/root', child: '/root-evil' })).toBe(false)
    expect(glueSeam({ realmId: REALM, parent: '/root', child: '/root-evil/x' })).toBe(false)
    expect(glueSeam({ realmId: REALM, parent: '/root', child: '/elsewhere/x' })).toBe(false)
    // kernel faces (positional; realm-joined keys on BOTH sides — the shared
    // prefix is inert, the separator still decides the boundary)
    expect(glueSeam(`${REALM}|/root`, `${REALM}|/root`)).toBe(true)
    expect(glueSeam(`${REALM}|/root`, `${REALM}|/root/x`)).toBe(true)
    expect(glueSeam(`${REALM}|/root`, `${REALM}|/root-evil/x`)).toBe(false)
    // lane face (positional raw paths, as createLaneDecide calls it — and the
    // mounted-decide proof of P2/N2 already ran the same call through it)
    expect(glueSeam('/root', '/root-evil')).toBe(false)
    expect(glueSeam('/root', '/root')).toBe(true)
    // the deny fast-path of the MOUNTED lane proves the spoof does not match
    // end-to-end: `/WS-evil` under a `/WS` subtree deny is NOT denied.
    const built = mount(POLICY_DENY_SUBTREE, { subtreeContains: glueSeam })
    if (built.ok !== true) throw new Error(`mount refused: ${built.code} — ${built.message}`)
    expect(built.value.decide({ effects: [readEffect(`${WS}-evil/a.png`)] })).toMatchObject({ kind: 'allow' })
  })

  it('N3: a non-path question THROWS — unknown coverage is never a guessed verdict', () => {
    expect(() => glueSeam('/root')).toThrow(TypeError)
    expect(() => glueSeam(null as unknown as string, '/root/x')).toThrow(TypeError)
    expect(() => glueSeam(42 as unknown as string, '/root/x')).toThrow(TypeError)
    expect(() => glueSeam({ realmId: REALM } as unknown as string)).toThrow(TypeError)
  })
})
