/**
 * alpha5-glue7-plane-backends.test.ts — GLUE-7: the production mount must
 * wire the REAL effect backends into the plane assembly (no new executors:
 * every backend here rides an implementation this repo already ships).
 *
 * THE GAP THIS FILE REDS ON (int-a5b README correction, root 20:01Z): the
 * production mount row calls `createTeamToolPlaneAssembly` WITHOUT
 * `backends`, so every live read/search/shell dispatch lands on the typed
 * shut face (`IO_POLICY_UNSUPPORTED`) — a LANDING, never a capability.
 * Provider-side binding-feed rows were unwired too (the feed face itself
 * landed here by `cherry-pick -x 94abdd90`).
 *
 * THE ASSEMBLY THIS ROUND (glue only; fail-closed fully preserved):
 *  - shell  -> the confined Process provider (sandbox-provider P-B/P-LSP:
 *              probe gate + launcher byte-pin + streaming ladder + lease law);
 *  - search -> the W5 wiring round's REAL grep read-only search, anchored at
 *              the governed controlled-fs instance root (fs-class anchor =
 *              the P-C controlled-fs instance declaration + isBeneath);
 *  - read   -> a placed governed read over the SAME governed root, with the
 *              placement identity fed to the Guard through the §6 feed;
 *  - glob   -> NO existing implementation exists: the row stays TYPED-SHUT
 *              (lands `IO_POLICY_UNSUPPORTED`), honestly disclosed;
 *  - deny-before-backend (G1 law) and the no-backends default (R-a closed
 *              world, every existing world keeps the shut shape byte-for-
 *              byte) stay untouched: real backends appear ONLY for a row
 *              that configures `plane.fsInstance` / `plane.confinedProvider`.
 *
 * Host law: the confined legs run the REAL launcher on THIS host (Landlock
 * ABI v4 — the pinned acceptance host; the same discipline as the a5lsp2/a5p4
 * REAL legs). Scratch worlds live under `tests/homes/` (workspace constraint,
 * TEST_METHODS §5) and self-remove.
 */
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5g7-unit-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root') // the governed controlled-fs instance root
const OUTSIDE_DIR = join(WORLD, 'outside') // never inside any governed root

type Exec = (raw: unknown) => Promise<{ text: string }>
interface PlaneValue {
  definitions: ReadonlyArray<{ name: string; execute: Exec }>
  ownNames: readonly string[]
  decide: (effectSet: unknown) => { kind: 'allow' } | { kind: 'deny'; code: string }
  backends: {
    search: { backendId: string; execCount(): number }
    glob: { backendId: string; execCount(): number }
    shell: { backendId: string; execCount(): number }
    read?: { execCount(): number }
  }
  placementFeed?: (name: string) => { definitionIdentity: string; realmId: string } | undefined
  realmId: string
}
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
  DEFAULT_PLANE_NAMES: Record<string, string>
}
type TD = { definitionIdentityOf: (target: unknown) => string | null }

let row: PlaneRow
let td: TD

const ALLOW_ALL = Object.freeze({
  default: 'ask',
  // A2C-1: the MEMBER grammar never allows the shell class — the shell
  // reaches the backend through the ASK default exactly as the shipped
  // governed worlds do; the lane's own fast paths stay deny-only.
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
const DENY_BASH = Object.freeze({
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [{ tool: 'bash', resource: { kind: 'any' } }],
})

const REALM = 'a5g7-unit-realm'
const fsInstance = () => ({ fs: 'a5g7-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' })
const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})

function buildPlane(extra: Record<string, unknown> = {}, policy: unknown = ALLOW_ALL) {
  const rows: string[] = []
  const built = row.createTeamToolPlaneAssembly({
    permissionPolicy: policy,
    realmId: REALM,
    templateId: 'a5g7-tpl',
    role: 'member',
    instanceId: 'a5g7-instance',
    onObserve: (r: string) => rows.push(String(r)),
    ...extra,
  })
  return { built, rows }
}
function def(value: PlaneValue, name: string) {
  const d = value.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`no def named ${name} on the plane (ownNames=${value.ownNames.join(',')})`)
  return d
}

beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  td = (await import(new URL('../tool-dispatch/index.js', import.meta.url).href)) as unknown as TD
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'data', 'needle.txt'), 'A5G7-INSIDE-TOK\nnoise line\nA5G7-INSIDE-TOK again\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'A5G7-OUTSIDE-SECRET-42\n')
})

afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

describe('GLUE-7 plane backends assembly', () => {
  it('R1 CURRENT-FORM PIN (stays green forever): a row with NO plane.fsInstance / NO confinedProvider keeps the typed shut face verbatim', async () => {
    const { built } = buildPlane()
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    for (const name of ['team_grep', 'team_bash']) {
      const res = await def(built.value, name).execute(
        name === 'team_bash' ? { command: 'echo nope' } : { pattern: 'A5G7', path: '.', output_mode: 'content' },
      )
      expect(res.text).toContain('IO_POLICY_UNSUPPORTED')
    }
  })

  it('G1 search positive: with plane.fsInstance the team_grep call runs the REAL read-only search over the governed root', async () => {
    const { built } = buildPlane({ plane: { fsInstance: fsInstance() } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_grep').execute({
      pattern: 'A5G7-INSIDE-TOK',
      path: '.',
      output_mode: 'content',
    })
    expect(res.text).toContain('A5G7-INSIDE-TOK')
    expect(res.text).not.toContain('IO_POLICY_UNSUPPORTED')
    expect(built.value.backends.search.execCount()).toBe(1)
  })

  // §4c AUDIT closure (RED-first): the presentation rewrite is PATH-FIELD
  // ONLY. A matched file whose OWN bytes contain the literal fd view must be
  // presented byte-for-byte equal to disk; only the grep-structured path
  // field is remapped to the anchored spelling. Forms the parser cannot
  // attribute to a path field keep the fd name verbatim (audit line), never
  // a body rewrite.
  it('G1b grep file-leg presentation integrity: body bytes stay disk-identical; only the path field remaps', async () => {
    writeFileSync(join(ROOT_DIR, 'fdlit.txt'), 'needle cites /proc/self/fd/3 literally\n')
    const { built } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() } })
    if (!built.ok) return
    const listed = await def(built.value, 'team_grep').execute({ pattern: 'needle', path: 'fdlit.txt', output_mode: 'files_with_matches' })
    expect(listed.text).toContain('fdlit.txt') // path field: still the anchored spelling
    expect(listed.text).not.toContain('/proc/self/fd') // the fd name never rides a -l path field
    const content = await def(built.value, 'team_grep').execute({ pattern: 'needle', path: 'fdlit.txt', output_mode: 'content' })
    // THE integrity claim: body byte run identical to the file on disk
    expect(content.text).toContain('needle cites /proc/self/fd/3 literally')
    expect(content.text).not.toContain(`fdlit.txt cites`) // body was NOT path-substituted
  })

  it('G2 search confinement: a target escaping the governed root is a typed refusal and the backend body never runs', async () => {
    const { built } = buildPlane({ plane: { fsInstance: fsInstance() } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const before = built.value.backends.search.execCount()
    const res = await def(built.value, 'team_grep').execute({
      pattern: 'A5G7-OUTSIDE-SECRET',
      path: '../outside',
      output_mode: 'content',
    })
    expect(res.text).not.toContain('A5G7-OUTSIDE-SECRET')
    expect(res.text).toContain('refused')
    expect(built.value.backends.search.execCount()).toBe(before)
  })

  it('G3 shell positive (REAL Landlock): with plane.confinedProvider the team_bash call RUNS confined on this host', async () => {
    const { built } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_bash').execute({ command: 'echo A5G7-SHELL-TOK' })
    expect(res.text).toContain('A5G7-SHELL-TOK')
    expect(res.text).toContain('exit=0')
    expect(built.value.backends.shell.execCount()).toBe(1)
  })

  it('G4 shell confinement (REAL): reading a file outside every allowPath is refused by the kernel inside the child', async () => {
    const { built } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_bash').execute({ command: `cat ${join(OUTSIDE_DIR, 'secret.txt')}` })
    expect(res.text).not.toContain('A5G7-OUTSIDE-SECRET-42')
    expect(res.text).toContain('Permission denied')
  })

  it('G5 deny-before-backend with the PRODUCTION shell backend: template-deny answers first, backend execCount 0, zero side effects', async () => {
    const sentinel = join(ROOT_DIR, 'sentinel-must-not-exist')
    const { built } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() } }, DENY_BASH)
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_bash').execute({ command: `touch ${sentinel}` })
    expect(res.text).toContain('template-deny-lane')
    expect(res.text).not.toContain('IO_POLICY_UNSUPPORTED')
    expect(built.value.backends.shell.execCount()).toBe(0)
    expect(existsSync(sentinel)).toBe(false)
  })

  it('G6 glob stays TYPED-SHUT (no existing implementation — honestly unconnected): lands IO_POLICY_UNSUPPORTED even with fsInstance + confinedProvider', async () => {
    const { built } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_glob').execute({ pattern: '*.txt' })
    expect(res.text).toContain('IO_POLICY_UNSUPPORTED')
  })

  // G6b — CANDIDATE-A ARCHIVE (security re-review 2026-10-18: the confined-rg
  // glob row FAILED for a NAME-class leak — the verify->launcher STRING-chdir
  // window plus the provider runtime_base '/' READ_DIR grant lets outside
  // NAMES surface (bytes never; measured 3/10700). The plane row is UN-WIRED
  // back to typed-shut (G6 above). The FACTORY stays exported and this leg
  // pins its honest face for the integration round that pairs it with a
  // runtime_base narrowing layer — driving the factory DIRECTLY, through no
  // plane. The row it once wired shipped NOTHING. See glue7/glob/ + §4b.
  it('G6b CANDIDATE-A archive: the glob FACTORY (unwired) keeps its bounded face + typed walker error + symlink-final refusal', async () => {
    const manyDir = join(ROOT_DIR, 'many')
    mkdirSync(manyDir, { recursive: true })
    for (let i = 0; i < 105; i++) writeFileSync(join(manyDir, `f${String(i)}.gen`), 'x\n')
    symlinkSync(OUTSIDE_DIR, join(ROOT_DIR, 'escape-link'))
    const beMod = (await import(new URL('../src/plugin/live/plane-effect-backends.mjs', import.meta.url).href)) as {
      createAnchoredGlobBackend: (cfg: Record<string, unknown>) => {
        run: (call: unknown, io: unknown) => Promise<{ ok: boolean; failure?: { code?: string }; outcome?: { files?: string[]; truncated?: boolean } }>
        execCount: () => number
      }
    }
    const factory = beMod.createAnchoredGlobBackend({
      realmId: 'a5g7-glob-archive', rootDir: ROOT_DIR,
      confined: confinedProvider(), observe: () => {},
    })
    const sink = { sink: { write: () => {} } }
    const capped = await factory.run({ callId: 'c1', parsedArgs: { tool: 'glob', pattern: 'many/*.gen', target: { placement: 'workspace', locator: '.' } } }, sink)
    expect(capped.ok).toBe(true)
    expect((capped.outcome?.files ?? []).length).toBe(100) // GLOB_MAX_RESULTS honest cap
    expect(capped.outcome?.truncated).toBe(true)
    const bad = await factory.run({ callId: 'c2', parsedArgs: { tool: 'glob', pattern: '[unclosed', target: { placement: 'workspace', locator: '.' } } }, sink)
    expect(bad.ok).toBe(false)
    expect(String(bad.failure?.code)).toMatch(/rg-walker-error|rg-exit-\d/) // typed, never a crash, never fake-empty
    const esc = await factory.run({ callId: 'c3', parsedArgs: { tool: 'glob', pattern: '*', target: { placement: 'relative', locator: 'escape-link' } } }, sink)
    expect(esc.ok).toBe(false)
    expect(String(esc.failure?.code)).toBe('symlink-alias') // refused BEFORE any spawn
    expect(factory.execCount()).toBe(2) // two refusals (bad spawned once; symlink added ZERO spawn)
  })

  it('G7 read placement + feed rows: the governed read is PLACED, executes over the governed root, and the placement identity rides the §6 feed', async () => {
    const { built } = buildPlane({ plane: { fsInstance: fsInstance() } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    expect(built.value.ownNames).toContain('read')
    const res = await def(built.value, 'read').execute({ path: 'data/needle.txt' })
    expect(res.text).toContain('A5G7-INSIDE-TOK')
    const feed = built.value.placementFeed?.('read')
    expect(feed?.realmId).toBe(REALM)
    expect(feed?.definitionIdentity).toMatch(/^def#\d+$/)
    const placed = built.value.definitions.find((d) => d.name === 'read')
    expect(td.definitionIdentityOf(placed)).toBe(feed?.definitionIdentity)
    // confinement + deny-first on the read row
    const escape = await def(built.value, 'read').execute({ path: '../outside/secret.txt' })
    expect(escape.text).not.toContain('A5G7-OUTSIDE-SECRET-42')
    expect(escape.text).toContain('refused')
  })

  it('G8 confined-only row (no fsInstance): shell is REAL, search and read keep the shut landing (no implicit root is invented)', async () => {
    const { built } = buildPlane({ plane: { confinedProvider: confinedProvider(), workingDir: ROOT_DIR } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    expect(built.value.ownNames).not.toContain('read')
    const shell = await def(built.value, 'team_bash').execute({ command: 'echo A5G7-SHELL-ONLY' })
    expect(shell.text).toContain('A5G7-SHELL-ONLY')
    const search = await def(built.value, 'team_grep').execute({ pattern: 'x', path: '.', output_mode: 'content' })
    expect(search.text).toContain('IO_POLICY_UNSUPPORTED')
  })

  it('G9 KIT-COMPAT PIN (stays green): the public backends override seam still wins over the production construction', async () => {
    const spy = { backendId: 'a5g7-spy', lastStageTrace: [] as never[], execCount: () => 0, run: async () => ({ ok: true as const, outcome: { exitCode: 0, stdout: 'SPY', stderr: '', timedOut: false, cancelled: false, truncated: false }, settlement: { kind: 'completed' as const } }) }
    const { built } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() }, backends: { shell: spy } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const res = await def(built.value, 'team_bash').execute({ command: 'echo x' })
    expect(res.text).toContain('SPY')
    expect(res.text).not.toContain('A5G7-SHELL')
  })
})
