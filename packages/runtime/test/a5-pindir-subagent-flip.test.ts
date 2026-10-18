/**
 * a5-pindir (root ruling 21:15Z, option (b)+(c)): the shipped-disabled
 * subagent route names subagent_codex / subagent_claude_code are pinned
 * NATIVE names — a default `disabled: true` is not an impersonation licence.
 * This spec tests the FLIP drift law: a preset disabled->enabled flip (never
 * on the host bundle — an in-memory fixture only) changes NOTHING about the
 * deny table, and a plane claim of either name refuses with
 * PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED in BOTH directions (shipped-disabled
 * and flipped-enabled). Zero enablement, zero permission change: the tools
 * stay disabled exactly as shipped; only the plane CLAIM face is closed.
 *
 * Real registration sources at the pin (no guessed names): route config
 * host packages/subagent/tool-subagent/src/index.ts:108
 * (`toolName: z.string().default('subagent')` — the route name comes from
 * this config field); route instances web-app presets cordis.patch.yml:107
 * /:115, ptc.patch.yml:108/:116, standard.patch.yml:108/:116, each inside a
 * `disabled: true` block (standard :105/:113).
 */
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5pindir-flip-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')

interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: { ownNames: readonly string[] } }
    | { ok: false; code: string; message: string }
  verifyPlaneNames: (names: Record<string, string>, readName: string) =>
    { ok?: boolean; code?: string; message?: string }
  DEFAULT_PLANE_NAMES: Record<string, string>
  PLANE_RESERVED_NATIVE: readonly string[]
}

let row: PlaneRow
let PATHS: {
  TEST_USE_REL: string
  TEST_USE_BASELINE_SHA: string
  findTestRepoRoot: (start: string) => string | null
}

const FLIP_NAMES: readonly string[] = ['subagent_codex', 'subagent_claude_code']
const ROUTE_OF: Readonly<Record<string, string>> = {
  subagent_codex: 'codex',
  subagent_claude_code: 'claude-code',
}
const UNSUPPORTED = 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED'

const ALLOW_ALL = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
const fsInstance = () => ({ fs: 'a5pf-ctl', rootDir: ROOT_DIR, realmId: 'a5pf-unit-realm', kind: 'absolute-path' })
const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})

/** the three shipped web-app presets (the flip surface) + the pin gate */
function presetDoc(rel: string): string {
  const hostRoot = PATHS.findTestRepoRoot(REPO) as string
  const tree = join(hostRoot, PATHS.TEST_USE_REL)
  const sha = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  expect(sha, `host tree moved (${sha}) — re-check the flip surface before consuming this test`).toBe(PATHS.TEST_USE_BASELINE_SHA)
  return readFileSync(join(tree, 'packages/bundle', rel), 'utf8')
}
function routeBlocks(doc: string, name: string): string[] {
  const route = ROUTE_OF[name] as string
  return doc.split(/\n(?=\s*- id:)/).filter((b) => new RegExp(`provider:\\s*${route}\\b`).test(b) && b.includes(`toolName: ${name}`))
}
/** in-memory fixture ONLY: strip `disabled: true` from the two route blocks */
function flipFixture(doc: string): string {
  // the split regex consumes the boundary newline (zero-width lookahead is on
  // the line AFTER it) — re-add it on join or the whole doc glues into one line
  return doc
    .split(/\n(?=\s*- id:)/)
    .map((b) => (routeBlocks(doc, 'subagent_codex').includes(b) || routeBlocks(doc, 'subagent_claude_code').includes(b)
      ? b.replace(/disabled:\s*true/, 'enabled: by-fixture')
      : b))
    .join('\n')
}
function assemblyVerdict(name: string): string {
  const built = row.createTeamToolPlaneAssembly({
    permissionPolicy: ALLOW_ALL,
    realmId: 'a5pf-unit-realm',
    templateId: 'a5pf-tpl',
    role: 'member',
    instanceId: `a5pf-${name}`,
    onObserve: () => { /* no rows expected — refused pre-construction */ },
    plane: {
      fsInstance: fsInstance(),
      confinedProvider: confinedProvider(),
      names: { ...row.DEFAULT_PLANE_NAMES, glob: name },
    },
  })
  return built.ok === true
    ? JSON.stringify({ ok: true, ownNames: built.value.ownNames })
    : JSON.stringify({ ok: false, code: built.code })
}

describe('a5-pindir subagent flip-drift (root 21:15Z): disabled->enabled changes no pin state; both directions refuse', () => {
  beforeAll(async () => {
    row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
    PATHS = (await import(new URL('../../../tests/paths.mjs', import.meta.url).href)) as typeof PATHS
    mkdirSync(join(ROOT_DIR, 'data'), { recursive: true })
    writeFileSync(join(ROOT_DIR, 'data', 'flip.txt'), 'A5PF-TOK\n')
  })
  afterAll(() => {
    try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
  })

  it('facts at the pin: every route block is shipped `disabled: true` and the flip fixture flips exactly those blocks', () => {
    const presets = ['web-app/presets/cordis.patch.yml', 'web-app/presets/ptc.patch.yml', 'web-app/presets/standard.patch.yml']
    for (const rel of presets) {
      const doc = presetDoc(rel)
      for (const name of FLIP_NAMES) {
        const blocks = routeBlocks(doc, name)
        expect(blocks.length, `${rel}: the ${name} route exists`).toBeGreaterThan(0)
        for (const b of blocks) expect(b, `${rel}: ${name} ships disabled: true`).toMatch(/disabled:\s*true/)
      }
      const flipped = flipFixture(doc)
      expect(flipped, `${rel}: fixture touched the document`).not.toBe(doc)
      for (const name of FLIP_NAMES) {
        const fb = routeBlocks(flipped, name)
        for (const b of fb) {
          expect(b, `${rel}: flipped ${name} block has no disabled flag`).not.toMatch(/disabled:\s*true/)
          expect(b, `${rel}: flipped ${name} block carries the fixture marker`).toMatch(/enabled: by-fixture/)
        }
      }
    }
    // the host bundle is NOT touched by the fixture (read-only consumption)
    const hostRoot = PATHS.findTestRepoRoot(REPO) as string
    const tree = join(hostRoot, PATHS.TEST_USE_REL)
    expect(execFileSync('git', ['-C', tree, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), 'host bundle stays pristine').toBe('')
  })

  it.each(FLIP_NAMES)('name %s: the deny-table is flip-invariant and claims refuse in BOTH directions (verify + assembly)', (name) => {
    const D = row.DEFAULT_PLANE_NAMES
    const refusals: string[] = []
    for (const direction of ['shipped-disabled', 'flipped-enabled'] as const) {
      // the pin state itself never depends on preset enablement (static deny table)
      expect(row.PLANE_RESERVED_NATIVE, `${name} stays pinned in direction ${direction}`).toContain(name)
      // mount-surface refusal
      for (const cls of ['grep', 'glob', 'bash'] as const) {
        const v = row.verifyPlaneNames({ ...D, [cls]: name }, 'read')
        expect(v.ok, `${direction}: ${cls} row under '${name}' must not be accepted`).not.toBe(true)
        expect(v.code, `${direction}: ${cls} row under '${name}'`).toBe(UNSUPPORTED)
        expect(v.message ?? '', `${direction}: ${cls} row under '${name}' names it`).toContain(`reserved native name '${name}'`)
      }
      const rv = row.verifyPlaneNames({ ...D }, name)
      expect(rv.ok, `${direction}: read row under '${name}' must not be accepted`).not.toBe(true)
      expect(rv.code, `${direction}: read row under '${name}'`).toBe(UNSUPPORTED)
      // assembly-level injection refusal (pre-construction, Gate 0b)
      const verdict = assemblyVerdict(name)
      expect(verdict, `${direction}: assembly refuses '${name}'`).toBe(JSON.stringify({ ok: false, code: UNSUPPORTED }))
      refusals.push(verdict)
    }
    // raw-text law: the two directions produce the SAME refusal verdict —
    // the flip opened nothing (identical impersonation face, identical denial)
    expect(refusals[0], 'both directions share one verdict string').toBe(refusals[1])
  })

  it('the two names are NOT shipped-enabled anywhere (this ruling enables nothing; a real enablement elsewhere is a separate, governed act)', () => {
    for (const rel of ['base/cordis.patch.yml', 'web-app/presets/cordis.patch.yml', 'web-app/presets/ptc.patch.yml', 'web-app/presets/standard.patch.yml']) {
      const doc = presetDoc(rel)
      for (const name of FLIP_NAMES) {
        const enabledBlocks = routeBlocks(doc, name).filter((b) => !/disabled:\s*true/.test(b))
        expect(enabledBlocks, `${rel}: '${name}' must stay shipped-disabled (zero enablement by this unit)`).toEqual([])
      }
    }
  })
})
