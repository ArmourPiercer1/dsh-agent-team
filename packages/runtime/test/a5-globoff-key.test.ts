/**
 * a5-globoff-key.test.ts — the closed planeCfg consumption key `globEnabled`.
 *
 * ROOT RULING 20:31Z (implementation order A): an operator must be able to
 * close the glob row WITHOUT closing anything else. Semantics pinned here:
 *  ① ABSENT = true: the default behavior stays byte-for-byte the current
 *     production form (the real anchored rg glob); every existing test zero-flips.
 *  ② Explicit false: the glob row lands on the EXISTING typed shut face
 *     (`IO_POLICY_UNSUPPORTED`, the createShutBackend row) — zero new error
 *     surface, the definition still mounts, the call lands typed.
 *  ③ Renaming `names.glob` cannot restore it: the shut decision rides the
 *     class (glob), never a name (the name stays a valid mount spelling).
 *  ④ No fallback/native bypass: the gate holds even over the kit `backends`
 *     injection seam (an injected glob backend is never run); the disabled
 *     form has execCount 0 and zero spawns. Unknown plane keys keep the
 *     silent-ignore discipline; THIS key is validated: a non-boolean value
 *     fails closed on the existing config-refusal code (never silently true).
 *  ⑤ Zero widening, zero shrinking: with globEnabled:false and the full
 *     config, the read/grep/bash rows keep running exactly as they do today.
 *
 * Host law: the real legs ride the REAL launcher (REAL Landlock) and the REAL
 * packaged rg, same discipline as alpha5-glue7-plane-backends.test.ts; the
 * scratch world lives under `tests/homes/` (TEST_METHODS §5) and self-removes.
 */
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5globoff-unit-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')

type Exec = (raw: unknown) => Promise<{ text: string }>
interface PlaneValue {
  definitions: ReadonlyArray<{ name: string; execute: Exec }>
  ownNames: readonly string[]
  backends: {
    search: { backendId: string; execCount(): number }
    glob: { backendId: string; execCount(): number }
    shell: { backendId: string; execCount(): number }
    read?: { execCount(): number }
  }
  realmId: string
}
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
}

let row: PlaneRow
const REALM = 'a5globoff-realm'
const ALLOW_ALL = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
const fsInstance = () => ({ fs: 'a5globoff-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' })
const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  // #337 closing round (review-B item 5 law): provider scratch is a LAW, not an
  // option — the provider refuses an absent/relative scratchRoot (the plans/out/
  // probe trees would otherwise land in the process cwd; the glob row's own
  // comment "it is refused here" made that the intent, the gate made it real).
  // Fixture-side key inside the gitignored test world; every row this leg pins
  // stays zero-motion.
  scratchRoot: join(WORLD, 'scratch-confined'),
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
function buildPlane(plane: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, policy: unknown = ALLOW_ALL) {
  const built = row.createTeamToolPlaneAssembly({
    permissionPolicy: policy,
    realmId: REALM,
    templateId: 'a5globoff-tpl',
    role: 'member',
    instanceId: 'a5globoff-instance',
    plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider(), ...plane },
    ...extra,
  })
  return built
}
function def(value: PlaneValue, name: string) {
  const d = value.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`no def named ${name} on the plane (ownNames=${value.ownNames.join(',')})`)
  return d
}

beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(join(ROOT_DIR, 'docs'), { recursive: true })
  writeFileSync(join(ROOT_DIR, 'a.txt'), 'GLOBOFF-A\n')
  writeFileSync(join(ROOT_DIR, 'docs', 'b.txt'), 'GLOBOFF-B\n')
})
afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

describe('a5-globoff: the closed globEnabled consumption key', () => {
  it('K1 (default law): key ABSENT keeps the current production glob form — the REAL anchored rg glob runs', async () => {
    const built = buildPlane()
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_glob').execute({ pattern: '*.txt' })
    expect(res.text).not.toContain('IO_POLICY_UNSUPPORTED')
    expect(res.text).toContain('.txt')
    expect(built.value.backends.glob.execCount()).toBe(1)
  })

  it('K2 (②): globEnabled:false lands the EXISTING typed shut face — IO_POLICY_UNSUPPORTED, execCount stays 0', async () => {
    const built = buildPlane({ globEnabled: false })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_glob').execute({ pattern: '*.txt' })
    expect(res.text).toContain('IO_POLICY_UNSUPPORTED')
    expect(res.text).not.toContain('GLOBOFF-A')
    expect(built.value.backends.glob.execCount()).toBe(0)
  })

  it('K3 (③): a renamed names.glob cannot restore the row — the shut decision rides the class, not the name', async () => {
    const built = buildPlane({ globEnabled: false, names: { glob: 'zglob_renamed' } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    expect(built.value.ownNames).toContain('zglob_renamed')
    expect(built.value.ownNames).not.toContain('team_glob')
    const res = await def(built.value, 'zglob_renamed').execute({ pattern: '*.txt' })
    expect(res.text).toContain('IO_POLICY_UNSUPPORTED')
    expect(res.text).not.toContain('GLOBOFF-B')
  })

  it('K4 (④): the gate holds over the kit backends injection seam — an injected glob backend is never run', async () => {
    const calls: unknown[] = []
    const injected = {
      backendId: 'injected-glob',
      run: async (call: unknown) => {
        calls.push(call)
        return {
          ok: true,
          outcome: { outputMode: 'files_with_matches', matches: [], counts: [], files: ['injected.txt'], totalMatches: 1, truncated: false },
          settlement: { kind: 'completed' },
        }
      },
      execCount: () => calls.length,
      lastStageTrace: Object.freeze([]),
    }
    const built = buildPlane({ globEnabled: false }, { backends: { glob: injected } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_glob').execute({ pattern: '*.txt' })
    expect(res.text).toContain('IO_POLICY_UNSUPPORTED')
    expect(calls.length).toBe(0)
  })

  it('K5 (④): non-boolean globEnabled fails closed on the existing config-refusal code — never silently true', () => {
    for (const bad of ['yes', 1, null, {}, []]) {
      const built = buildPlane({ globEnabled: bad })
      expect(built.ok, `globEnabled=${JSON.stringify(bad)}`).toBe(false)
      if (built.ok) return
      expect(built.code).toBe('PLANE_CONFIG_INCOMPLETE')
    }
  })

  it('K6 (④ discipline): an UNKNOWN plane key keeps the silent-ignore law — only globEnabled is consumed+validated', () => {
    const built = buildPlane({ zzzUnknownKey: 1 })
    expect(built.ok, JSON.stringify(built)).toBe(true)
  })

  it('K7 (⑤): the four-tool matrix — globEnabled:false shrinks nothing else: grep/bash/read run for real, only glob lands shut', async () => {
    const built = buildPlane({ globEnabled: false })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const grep = await def(built.value, 'team_grep').execute({ pattern: 'GLOBOFF-A', path: '.', output_mode: 'content' })
    expect(grep.text).toContain('GLOBOFF-A')
    const bash = await def(built.value, 'team_bash').execute({ command: 'echo GLOBOFF-SHELL-TOK' })
    expect(bash.text).toContain('GLOBOFF-SHELL-TOK')
    const read = await def(built.value, 'read').execute({ path: 'a.txt' })
    expect(read.text).toContain('GLOBOFF-A')
    const glob = await def(built.value, 'team_glob').execute({ pattern: '*.txt' })
    expect(glob.text).toContain('IO_POLICY_UNSUPPORTED')
    expect(built.value.backends.search.execCount()).toBe(1)
    expect(built.value.backends.shell.execCount()).toBe(1)
    expect(built.value.backends.glob.execCount()).toBe(0)
  })
})
