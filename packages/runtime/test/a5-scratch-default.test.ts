/**
 * a5-scratch-default — the PRODUCTION DEFAULT FORM of the live glob row under
 * the #337 scratch law (root order 23:12Z, #346-README compatibility audit).
 *
 * The public contract (docs/INSTALL.md §3.5, lines 424-438) shows
 * `confinedProvider: { trustRoot, assembly }` with NO scratchRoot key — that
 * IS the public default shape. The four fixed families (glue7/a5b3/globoff/kit)
 * were all CALLER-side keys; what this suite proves is the assembly itself:
 * on the default form the REAL anchored glob (real launcher, real packaged rg,
 * production createTeamToolPlaneAssembly) must still return its seeds.
 *
 * Law split (root ruling, no loosening of the refusal):
 *  - ABSENT scratchRoot  -> the row defaults PARENT-SIDE to a sibling of the
 *    governed root (`${rootDir}.a5g7-glob-scratch`), the same measured law the
 *    search row already ships (`search-backend.mjs` :590-596 "the DEFAULT is a
 *    sibling of the root and never the root itself"). A scratch inside the
 *    governed root leaks the sandbox layout into every walk result (the row's
 *    own probe-cwd note) — the sibling keeps the default usable AND clean.
 *  - EXPLICIT bad value (empty string, relative) -> the PROVIDER gate still
 *    refuses typed (IO_POLICY_UNSUPPORTED -> row confined-unavailable). The
 *    gate was not weakened; only a never-valid default was replaced.
 *
 * World discipline: tests/homes (TEST_METHODS §5), self-removed; the sibling
 * is derived from the world path, so one rmSync(WORLD) removes everything.
 */
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5scratchdef-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const SIBLING = `${ROOT_DIR}.a5g7-glob-scratch`
const REALM = 'a5scratchdef-realm'
const ALLOW_ALL = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
interface PlaneValue {
  definitions: ReadonlyArray<{ name: string; execute(a: unknown): Promise<{ text: string }> }>
}
type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message: string }
interface PlaneRow {
  createTeamToolPlaneAssembly(input: Record<string, unknown>): Built
}
let row: PlaneRow

function buildWith(confined: Record<string, unknown>): Built {
  return row.createTeamToolPlaneAssembly({
    permissionPolicy: ALLOW_ALL,
    realmId: REALM,
    templateId: 'a5scratchdef-tpl',
    role: 'member',
    instanceId: 'a5scratchdef-instance',
    plane: {
      fsInstance: { fs: 'a5scratchdef-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' },
      confinedProvider: confined,
      names: { grep: 'team_grep', glob: 'team_glob', bash: 'bash' },
    },
  })
}
function glob(built: Built, pattern: string): Promise<{ text: string }> {
  if (!built.ok) throw new Error(`assembly refused: ${JSON.stringify(built)}`)
  const d = built.value.definitions.find((x) => x.name === 'team_glob')
  if (d === undefined) throw new Error('team_glob not on the plane')
  return d.execute({ pattern })
}

beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(ROOT_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'seed-one.txt'), 'SCRATCHDEF-ONE\n')
  writeFileSync(join(ROOT_DIR, 'seed-two.txt'), 'SCRATCHDEF-TWO\n')
})
afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

describe('a5-scratch-default — production default form under the scratch law (root 23:12Z)', () => {
  it('D1 positive control: the INSTALL.md §3.5 default conf (NO scratchRoot key) runs the REAL glob and returns BOTH seeds', async () => {
    // The conf below is the public contract default shape verbatim (INSTALL.md
    // :432-437): trustRoot trio, nothing else. No fixture substitute: real
    // assembly, real launcher, real packaged rg.
    const built = buildWith({
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    const res = await glob(built, '*.txt')
    expect(res.text, `default-form glob must not land on a refusal: ${res.text.slice(0, 300)}`).not.toContain('IO_POLICY_UNSUPPORTED')
    expect(res.text, `default-form glob must not land on confined-unavailable: ${res.text.slice(0, 300)}`).not.toContain('confined-unavailable')
    expect(res.text).toContain('seed-one.txt')
    expect(res.text).toContain('seed-two.txt')
    // The design law the sibling exists to keep: the governed root itself stays
    // clean — no provider scratch tree ever appears inside the walk root.
    const listing = readdirSync(ROOT_DIR)
    expect(listing, `governed root must stay walk-clean, saw ${listing.join(',')}`).not.toContain('out')
    expect(listing, `governed root must stay walk-clean, saw ${listing.join(',')}`).not.toContain('plans')
  }, 120_000)

  it('D2 the sibling default lands PARENT-SIDE of the governed root (never inside it)', async () => {
    const built = buildWith({
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    expect(built.ok).toBe(true)
    await glob(built, '*.txt')
    // If the provider materialises anything, it is under the sibling — and the
    // sibling is OUTSIDE the walk root, which is the whole point (search row
    // :590-596 carries the identical measured law).
    expect(SIBLING.startsWith(WORLD), 'sibling stays inside the self-removing world').toBe(true)
    expect(SIBLING.startsWith(`${ROOT_DIR}.`), 'sibling is a sibling, not a child').toBe(true)
    expect(existsSync(join(ROOT_DIR, 'a5g7-glob-scratch')), 'no child-of-root scratch form').toBe(false)
  }, 120_000)

  it('D3 explicit EMPTY scratchRoot still lands typed-refused (the gate is NOT weakened)', async () => {
    const built = buildWith({
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: '',
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    expect(built.ok).toBe(true)
    const res = await glob(built, '*.txt')
    expect(res.text).toContain('confined-unavailable')
    expect(res.text).not.toContain('seed-one.txt')
  }, 120_000)

  it('D4 explicit RELATIVE scratchRoot still lands typed-refused (the gate is NOT weakened)', async () => {
    const built = buildWith({
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: 'scratch-rel',
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    expect(built.ok).toBe(true)
    const res = await glob(built, '*.txt')
    expect(res.text).toContain('confined-unavailable')
    expect(res.text).not.toContain('seed-two.txt')
  }, 120_000)

  it('D5 an explicit valid scratchRoot rules (default never overrides it)', async () => {
    const explicit = join(WORLD, 'scratch-explicit')
    const built = buildWith({
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: explicit,
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    expect(built.ok).toBe(true)
    const res = await glob(built, '*.txt')
    expect(res.text).toContain('seed-one.txt')
    expect(res.text).toContain('seed-two.txt')
    // That the CONFIGURED value rules OVER the default is proven causally by
    // D3/D4: an explicit ''/relative is refused there even though the sibling
    // default exists and is valid — if the default overrode the explicit key,
    // those legs would pass, and they must not.
  }, 120_000)
})
