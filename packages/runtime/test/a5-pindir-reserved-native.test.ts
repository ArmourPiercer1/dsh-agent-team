/**
 * a5-pindir-reserved-native.test.ts — C-16: the reserved-native registry must
 * equal the AUTHORITATIVE catalog harvest of the pinned host release, in BOTH
 * directions (root ruling 20:31Z).
 *
 * The C-16 hole: the first derivation of PLANE_RESERVED_NATIVE grepped host
 * sources for `name: '<n>'` registrations and MISSED every name that reaches
 * the model-facing registry another way — run_code (the tool registry's own
 * reserved PTC transport), plugin_manager / schedule_* (tools.ts maps),
 * workflow (tool-workflow's toolName-config default), stagehand_* (the
 * experimental browser-use package). Pre-fix the plane assembly ACCEPTED rows
 * mounted under those host spellings (the impostor face this gate exists to
 * refuse); the negative-control red of these legs is recorded in
 * dev/agent-workflow/evidence/alpha5/pindir/.
 *
 * The authoritative source (unit ③): the host catalog guarantee chain —
 * `scripts/gen-tool-catalog.ts` boots every shipped tool package and harvests
 * the model-facing names; its committed artifact `docs/tool-catalog.md` is
 * regenerated + --check-verified by the host's own guarantee spec at the pinned
 * commit. Consuming that artifact at the pinned tree IS reusing the harvest
 * (booting the host workspace from this repo is not possible; artifact
 * freshness is the host guarantee). Caliber: schemas column ∪ shippedNames
 * column — the documented alias caliber ("a per-package note records those
 * shipped aliases"); `subagent_fork` lives exactly there (boot-harvest names
 * miss the bundle-composed fork route, the manifest carries it).
 *
 * Drift law encoded here: FORWARD (catalog name not pinned) is RED. REVERSE
 * (pinned name not in the catalog) must carry an explicit entry in
 * REVERSE_DISPOSITIONS — retire or keep-with-rationale, never silent.
 */
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// REVIEW-R1 B1 (R-REM-2.2 / FIX-K K3): the kernel lifecycle port is ONLY the
// dispatcher's ledger — production passes the Guard handle's pendingCalls
// (agent-bindings). These executor-level legs never install a dispatcher, so
// this holder never settles a handle: the port reads the same wiring's honest
// empty-ledger zero. No family-local counter, no faked number.
const dispatchLedger: { current?: { pendingCalls(): readonly unknown[] } } = {}


const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5pindir-unit-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')

interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: { ownNames: readonly string[] } }
    | { ok: false; code: string; message: string }
  verifyPlaneNames: (names: Record<string, string>, readName: string) =>
    { ok?: boolean; code?: string; message?: string }
  DEFAULT_PLANE_NAMES: Record<string, string>
  PLANE_RESERVED_NATIVE: readonly string[]
  PLANE_RESERVED_NATIVE_HOST_PIN: string
  PLANE_RESERVED_NATIVE_PREFIXES: readonly string[]
}

let row: PlaneRow

// the 13 C-16 names, exactly as the unit pins them
const C16_NAMES: readonly string[] = [
  'run_code',
  'plugin_manager',
  'schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update',
  'workflow',
  'stagehand_act', 'stagehand_extract', 'stagehand_navigate', 'stagehand_observe', 'stagehand_screenshot', 'stagehand_tabs',
]

// Reverse drift: a pinned name the catalog harvest does not carry MUST appear
// here with its disposition — 'kept (forward-looking/cross-generation)' or
// 'retired', each with the measured reason. An unlisted reverse name is RED by
// law (explicit reasons only, never silent). The subagent_fork worked example
// lives in the registry comment: under THIS caliber (schemas ∪ shippedNames)
// it is catalog-present, so it needs no entry — the leg
// `subagent_fork is a live shipped registration...` re-verifies that presence
// at the host tree every run, so a future harvest change REDs here instead of
// silently deleting the pin.
// Current entries (root ruling 21:15Z, (b)+(c)): the two shipped-disabled
// subagent route names — shipped native names whose real registration source
// the pin carries (route config tool-subagent index.ts:108; route instances
// web-app presets cordis :107/:115, ptc :108/:116, standard :108/:116 with
// `disabled: true` in the same blocks); the catalog artifact does NOT list
// them (boot harvest skips disabled routes, shippedNames only carries
// subagent/subagent_fork), so they enter this table by law, keep-with-
// rationale: "shipped native names, default-disabled is not an impersonation
// licence" — preventive claim-denial reservation, zero enablement, tested for
// flip-drift in a5-pindir-subagent-flip.test.ts.
const REVERSE_DISPOSITIONS: Readonly<Record<string, string>> = Object.freeze({
  subagent_codex: 'kept (root 21:15Z): shipped native route name, disabled in every shipped preset; real registration source at the pin; preventive claim-denial, enables nothing',
  subagent_claude_code: 'kept (root 21:15Z): shipped native route name, disabled in every shipped preset; real registration source at the pin; preventive claim-denial, enables nothing',
})

const UNSUPPORTED = 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED'

const ALLOW_ALL = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
const fsInstance = () => ({ fs: 'a5pd-ctl', rootDir: ROOT_DIR, realmId: 'a5pd-unit-realm', kind: 'absolute-path' })
const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})

/** Parse the committed catalog artifact at the pinned host tree: schemas ∪ shippedNames. */
function harvestCatalog(): Set<string> {
  const paths = PATHS
  const hostRoot = paths.findTestRepoRoot(REPO)
  expect(hostRoot, 'pinned host checkout reachable from the test root').toBeTruthy()
  const tree = join(hostRoot as string, paths.TEST_USE_REL)
  const sha = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  expect(sha, `host tree moved (${sha}) — re-derive the registry from the new release, move the pin, do NOT proceed`)
    .toBe(paths.TEST_USE_BASELINE_SHA)
  const doc = readFileSync(join(tree, 'docs/tool-catalog.md'), 'utf8')
  const names = new Set<string>()
  let rowsSeen = 0
  for (const line of doc.split('\n')) {
    if (!/^\|\s*`@deepseek/.test(line)) continue
    const cols = line.split('|').map((s) => s.trim())
    // every generated row splits into exactly 8 fields (cells carry no pipes):
    // 1=pkg, 2=schemas, 5=shippedNames; col 6 is free-text note — never harvested.
    expect(cols.length, `catalog row field count drifted: ${cols[1]}`).toBe(8)
    for (const cell of [cols[2], cols[5]]) {
      if (!cell || cell === '-') continue
      for (const m of cell.matchAll(/`([^`]+)`/g)) { const nm = m[1]; if (nm !== undefined) names.add(nm) }
    }
    rowsSeen += 1
  }
  expect(rowsSeen, 'the package map carries rows').toBeGreaterThan(10)
  return names
}

let PATHS: {
  TEST_USE_REL: string
  TEST_USE_BASELINE_SHA: string
  DSH_BASELINE_VERSION: string
  findTestRepoRoot: (start: string) => string | null
}

describe('a5-pindir C-16 reserved-native registry vs the authoritative catalog harvest', () => {
  beforeAll(async () => {
    row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
    PATHS = (await import(new URL('../../../tests/paths.mjs', import.meta.url).href)) as typeof PATHS
    mkdirSync(join(ROOT_DIR, 'data'), { recursive: true })
    writeFileSync(join(ROOT_DIR, 'data', 'pindir.txt'), 'A5PD-TOK\n')
  })
  afterAll(() => {
    try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
  })

  it.each([...C16_NAMES])('C-16 name %s is refused on EVERY mount surface (grep/glob/bash rows + readName)', (name) => {
    const D = row.DEFAULT_PLANE_NAMES
    for (const cls of ['grep', 'glob', 'bash'] as const) {
      const v = row.verifyPlaneNames({ ...D, [cls]: name }, 'read')
      expect(v.ok, `${cls} row under '${name}' must not be accepted`).not.toBe(true)
      expect(v.code, `${cls} row under '${name}'`).toBe(UNSUPPORTED)
      expect(v.message ?? '', `${cls} row under '${name}' names it`).toContain(`reserved native name '${name}'`)
    }
    const rv = row.verifyPlaneNames({ ...D }, name)
    expect(rv.ok, `read row under '${name}' must not be accepted`).not.toBe(true)
    expect(rv.code, `read row under '${name}'`).toBe(UNSUPPORTED)
    expect(rv.message ?? '', `read row under '${name}' names it`).toContain(`reserved native name '${name}'`)
  })

  it('assembly-level injection: a full governed plane refuses names.glob=run_code BEFORE any mount (the C-16 repro leg)', () => {
    const built = row.createTeamToolPlaneAssembly({
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

      permissionPolicy: ALLOW_ALL,
      realmId: 'a5pd-unit-realm',
      templateId: 'a5pd-tpl',
      role: 'member',
      instanceId: 'a5pd-instance',
      onObserve: () => { /* no rows expected — refused pre-construction */ },
      plane: {
        fsInstance: fsInstance(),
        confinedProvider: confinedProvider(),
        names: { ...row.DEFAULT_PLANE_NAMES, glob: 'run_code' },
      },
    })
    const verdict = built.ok === true
      ? JSON.stringify({ ok: true, ownNames: built.value.ownNames })
      : JSON.stringify({ ok: false, code: built.code })
    // pre-fix this string read {"ok":true,"ownNames":["team_grep","run_code",...]}
    // — the negative control recorded in evidence/alpha5/pindir/.
    expect(verdict).toBe(JSON.stringify({ ok: false, code: UNSUPPORTED }))
    expect((built as { message?: string }).message ?? '').toContain("reserved native name 'run_code'")
  })

  it('assembly-level injection: names.bash=schedule_list is refused the same way', () => {
    const built = row.createTeamToolPlaneAssembly({
          dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },

      permissionPolicy: ALLOW_ALL,
      realmId: 'a5pd-unit-realm',
      templateId: 'a5pd-tpl',
      role: 'leader',
      instanceId: 'a5pd-instance-2',
      onObserve: () => { /* */ },
      plane: {
        fsInstance: fsInstance(),
        confinedProvider: confinedProvider(),
        names: { ...row.DEFAULT_PLANE_NAMES, bash: 'schedule_list' },
      },
    })
    expect(built.ok).not.toBe(true)
    expect((built as { code?: string }).code).toBe(UNSUPPORTED)
    expect((built as { message?: string }).message ?? '').toContain("reserved native name 'schedule_list'")
  })

  it('BIDIRECTIONAL drift: registry == catalog harvest (forward missing = RED; reverse needs an explicit disposition)', () => {
    const catalog = harvestCatalog()
    const pinned = new Set<string>(row.PLANE_RESERVED_NATIVE as unknown as string[])
    const forward = [...catalog].filter((n) => !pinned.has(n)).sort()
    expect(forward, `FORWARD drift — catalog names missing from PLANE_RESERVED_NATIVE (missing pin = RED): ${JSON.stringify(forward)}`).toEqual([])
    const reverse = [...pinned].filter((n) => !catalog.has(n)).sort()
    const unexplained = reverse.filter((n) => REVERSE_DISPOSITIONS[n] === undefined)
    expect(unexplained, `REVERSE drift without an explicit disposition (kept-with-rationale or retired — never silent): ${JSON.stringify(unexplained)}`).toEqual([])
  })

  it('PROVENANCE of every pin: a guessed name is RED — each pinned name must carry a real registration source at the host tree (root 21:15Z)', () => {
    // A name enters the deny table only with a REAL registration source at the
    // pinned host release: a quoted literal ('name'/"name"), a `toolName: name`
    // bundle route, or a NAMED template loop (stagehand only — the template is
    // listed explicitly, it is not a wildcard). "guessed name = red": a pin
    // that no host source produces is a hallucinated entry, RED by law.
    const paths = PATHS
    const hostRoot = paths.findTestRepoRoot(REPO) as string
    const tree = join(hostRoot, paths.TEST_USE_REL)
    const sha = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    expect(sha, `host tree moved (${sha}) — re-derive sources before consuming this check`).toBe(paths.TEST_USE_BASELINE_SHA)
    const files: string[] = []
    const walk = (dir: string, depth: number): void => {
      if (depth > 6) return
      for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e === '.git' || e === 'lib' || e === 'dist' || e === 'out') continue
        const p = join(dir, e)
        if (statSync(p).isDirectory()) walk(p, depth + 1)
        else if (/\.(ts|mjs|yml|yaml)$/.test(e) && !/\.(spec|test)\./.test(e) && !/(^|\/)tests?\//.test(p.slice(tree.length + 1))) files.push(p)
      }
    }
    walk(join(tree, 'packages'), 1)
    expect(files.length, 'host source enumeration ran').toBeGreaterThan(500)
    const blobs = files.map((f) => readFileSync(f, 'utf8'))
    const TEMPLATES: Readonly<Record<string, string>> = {
      stagehand_act: 'stagehand_${method}', stagehand_extract: 'stagehand_${method}',
      stagehand_navigate: 'stagehand_${method}', stagehand_observe: 'stagehand_${method}',
      stagehand_screenshot: 'stagehand_${method}', stagehand_tabs: 'stagehand_${method}',
    }
    const missing: string[] = []
    for (const name of row.PLANE_RESERVED_NATIVE as unknown as string[]) {
      const direct = blobs.some((t) => t.includes(`'${name}'`) || t.includes(`"${name}"`) || t.includes(`toolName: ${name}`))
      const tmpl = TEMPLATES[name] !== undefined && blobs.some((t) => t.includes(TEMPLATES[name] as string))
      if (!direct && !tmpl) missing.push(name)
    }
    expect(missing, `pins WITHOUT a real registration source at the pin (guessed names are RED): ${JSON.stringify(missing)}`).toEqual([])
  })

  it('the host baseline pin matches tests/paths.mjs (drift pin reds when the host moves)', () => {
    const live = `${PATHS.DSH_BASELINE_VERSION}@${PATHS.TEST_USE_BASELINE_SHA.slice(0, 10)}`
    expect(row.PLANE_RESERVED_NATIVE_HOST_PIN, 'host baseline moved: re-derive the registry from the new host release, then move the pin').toBe(live)
  })

  it('subagent_fork is a live shipped registration at the pin (KEPT, root ④) and the sibling routes are shipped-disabled', () => {
    const paths = PATHS
    const hostRoot = paths.findTestRepoRoot(REPO) as string
    const bundle = (rel: string) => readFileSync(join(hostRoot, paths.TEST_USE_REL, 'packages/bundle', rel), 'utf8')
    const files = ['base/cordis.patch.yml', 'web-app/presets/cordis.patch.yml', 'web-app/presets/ptc.patch.yml', 'web-app/presets/standard.patch.yml']
    for (const f of files) {
      const blocks = bundle(f).split(/\n(?=\s*- id:)/)
      const fork = blocks.filter((b) => /provider:\s*fork/.test(b) && /toolName:\s*subagent_fork/.test(b))
      expect(fork.length, `${f}: the fork route registers subagent_fork`).toBeGreaterThan(0)
      for (const b of fork) expect(b, `${f}: the fork route ships ENABLED (no disabled flag)`).not.toMatch(/disabled:\s*true/)
      for (const route of ['codex', 'claude-code']) {
        const sib = blocks.filter((b) => new RegExp(`provider:\\s*${route}`).test(b) && /toolName:\s*subagent_/.test(b))
        for (const b of sib) expect(b, `${f}: the ${route} sibling route ships disabled: true`).toMatch(/disabled:\s*true/)
      }
    }
    // and the catalog artifact carries it through the shippedNames column —
    // the caliber that makes it catalog-present (see harvestCatalog).
    expect(harvestCatalog().has('subagent_fork'), 'subagent_fork stays in the harvest caliber').toBe(true)
    expect(row.PLANE_RESERVED_NATIVE).toContain('subagent_fork')
  })

  it('zero-regression: defaults, the two supported takeover pairs, custom aliases, and the mcp__ prefix law all hold', () => {
    const D = row.DEFAULT_PLANE_NAMES
    expect(row.verifyPlaneNames(D, 'read').ok).toBe(true)
    expect(row.verifyPlaneNames({ ...D, bash: 'bash' }, 'read').ok).toBe(true)
    expect(row.verifyPlaneNames({ ...D, bash: 'myshell' }, 'read').ok).toBe(true)
    expect(row.verifyPlaneNames({ grep: 'mygrep', glob: 'myglob', bash: 'myshell' }, 'myread').ok).toBe(true)
    const mcp = row.verifyPlaneNames({ ...D, grep: 'mcp__host__read' }, 'read')
    expect(mcp.ok).not.toBe(true)
    expect(mcp.code).toBe(UNSUPPORTED)
    expect(row.PLANE_RESERVED_NATIVE_PREFIXES).toContain('mcp__')
    for (const n of C16_NAMES) expect(row.PLANE_RESERVED_NATIVE).toContain(n)
  })
})
