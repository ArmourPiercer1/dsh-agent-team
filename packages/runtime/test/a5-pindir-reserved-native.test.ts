/**
 * a5-pindir-reserved-native.test.ts — C-16, RE-ANCHORED (Round 72, hosted-CI repair).
 *
 * THE LAW (unchanged): the set of host tool names this repository CLAIMS as reserved-native must equal
 * the AUTHORITATIVE catalog harvest of the pinned host release, in BOTH directions, and every claim must
 * carry a real registration source at the pinned tree — a guessed name is RED. Forward drift (a catalog
 * name nobody booked) is RED; reverse drift (a booked name the catalog does not carry) needs an explicit,
 * checkable disposition, never silence.
 *
 * WHAT MOVED AND WHY. The left-hand side used to be `PLANE_RESERVED_NATIVE`, read out of
 * `src/plugin/live/team-tool-plane.mjs`. The A1 cut retired that module (the plane assembly, its name
 * verification and the whole governed-plane route), so this suite could not load: it was listed in
 * `tests/checks/eb3-host-security-suites.txt`, graded by ci-census on every ready PR, and RED by import.
 * The claim set is NOT gone — it moved to the reviewed authority artifact
 * `dev/engineering/tool-obligations/authoritative-tool-sources.v1.json`, which books every host name this
 * repo claims WITH `file:line` provenance and an `authority` class (U1-C, the static-source authority).
 * This suite reads that artifact instead of the retired registry; the right-hand side (the pinned host's
 * `docs/tool-catalog.md`, caliber = `schemas ∪ shippedNames`) and the pin are UNCHANGED.
 *
 * WHAT RETIRED WITH ITS SUBJECT (recorded in `dev/agent-workflow/evidence/ute-a1/MIGRATED-SUITE-STATUS.md`,
 * Round 72): the `verifyPlaneNames` matrix over the 13 C-16 names, the two assembly-level injection legs
 * (`createTeamToolPlaneAssembly` refusing `names.glob=run_code` / `names.bash=schedule_list`) and the
 * plane defaults/alias/`mcp__` zero-regression leg. They drove the retired plane; the law they protected
 * (an impostor name never mounts) is now structural — the centre admits only tools with a declared axis
 * (`ADMISSION_TOOL_UNBOUND`), and its closed sets live in `admission.ts`.
 *
 * REVERSE DISPOSITION IS DERIVED, NOT HAND-WRITTEN. Each authority row states its own class, and the two
 * classes that legitimately miss the generated catalog say so in the row (`host-source-only (internal)`,
 * `host-source-route (not in generated catalog harvest)`). A row claiming a catalog class while missing
 * from the harvest is RED — so the table can never drift into "everything is dispositioned" by editing
 * prose in one place.
 */
import { describe, beforeAll, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
/** The reviewed claim set (U1-C static-source authority: every host name this repo books). */
const AUTHORITY_REL = 'dev/engineering/tool-obligations/authoritative-tool-sources.v1.json'

interface AuthorityRow {
  readonly name: string
  readonly authority: string
  readonly file: string
  readonly line: number
  readonly package: string
  readonly gating: string
}

interface Authority {
  readonly schema: string
  readonly pins: { readonly host_version: string, readonly host_sha: string, readonly host_pin_source: string }
  readonly static_sources: { readonly host: readonly AuthorityRow[], readonly team: readonly AuthorityRow[] }
}

/** Authority classes that legitimately do NOT appear in the generated catalog harvest. */
const NOT_CATALOG_VISIBLE: Readonly<Record<string, string>> = Object.freeze({
  'host-source-only (internal)': 'an internal child-session tool — never a model-facing name, so the generated catalog cannot carry it',
  'host-source-route (not in generated catalog harvest)': 'a bundle-composed route name the boot harvest skips (shipped default-disabled); the row carries its route block',
})

let AUTHORITY: Authority
let PATHS: {
  TEST_USE_REL: string
  TEST_USE_BASELINE_SHA: string
  DSH_BASELINE_VERSION: string
  findTestRepoRoot: (start: string) => string | null
}

/** Parse the committed catalog artifact at the pinned host tree: schemas ∪ shippedNames. */
function harvestCatalog(): Set<string> {
  const paths = PATHS
  const hostRoot = paths.findTestRepoRoot(REPO)
  expect(hostRoot, 'pinned host checkout reachable from the test root').toBeTruthy()
  const tree = join(hostRoot as string, paths.TEST_USE_REL)
  const sha = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  expect(sha, `host tree moved (${sha}) — re-derive the claim set from the new release, move the pin, do NOT proceed`)
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

const bookedNames = (): readonly string[] => AUTHORITY.static_sources.host.map((row) => row.name)

const classOf = (name: string): string | undefined =>
  AUTHORITY.static_sources.host.find((row) => row.name === name)?.authority

describe('a5-pindir C-16 — the reserved-native claim set vs the authoritative catalog harvest', () => {
  beforeAll(async () => {
    AUTHORITY = JSON.parse(readFileSync(join(REPO, AUTHORITY_REL), 'utf8')) as Authority
    PATHS = (await import(new URL('../../../tests/paths.mjs', import.meta.url).href)) as typeof PATHS
  })

  it('the claim set is the reviewed authority artifact and it is non-vacuous', () => {
    expect(AUTHORITY.schema).toBe('u7-0/authoritative-tool-sources/v1')
    expect(bookedNames().length, 'the authority books a real host claim set').toBeGreaterThan(50)
    // ROWS ARE PER REGISTRATION SOURCE, not per name: one name may be produced by more than one source
    // (a config variant, a second file), and each source carries its own `file:line`. The NAME set is what
    // the drift law compares, so it is deduped here and the duplicates are disclosed rather than refused.
    const distinct = new Set(bookedNames())
    expect(distinct.size, 'the bookable name set is non-vacuous').toBeGreaterThan(50)
    for (const row of AUTHORITY.static_sources.host) {
      expect(row.file, `${row.name}: a claim needs a file`).toBeTruthy()
      expect(row.line, `${row.name}: a claim needs a line`).toBeGreaterThan(0)
    }
    for (const name of distinct) {
      expect(AUTHORITY.static_sources.host.filter((row) => row.name === name).length, `${name}: at least one source row`).toBeGreaterThan(0)
    }
  })

  it('the host pin in the claim set matches tests/paths.mjs (drift pin reds when the host moves)', () => {
    const live = `${PATHS.DSH_BASELINE_VERSION}@${PATHS.TEST_USE_BASELINE_SHA.slice(0, 10)}`
    expect(AUTHORITY.pins.host_version, 'host baseline moved: re-derive the claim set from the new host release, then move the pin').toBe(PATHS.DSH_BASELINE_VERSION)
    expect(AUTHORITY.pins.host_sha, 'host baseline moved: re-derive the claim set from the new host release, then move the pin').toBe(PATHS.TEST_USE_BASELINE_SHA)
    expect(AUTHORITY.pins.host_pin_source, 'the pin must say where the pin comes from').toBe('tests/paths.mjs')
    expect(live.endsWith(PATHS.TEST_USE_BASELINE_SHA.slice(0, 10))).toBe(true)
  })

  it('BIDIRECTIONAL drift: claim set == catalog harvest (forward missing = RED; reverse needs a class that says it is not catalog-visible)', () => {
    const catalog = harvestCatalog()
    const booked = new Set<string>(bookedNames())
    const forward = [...catalog].filter((n) => !booked.has(n)).sort()
    expect(forward, `FORWARD drift — catalog names missing from the claim set (missing booking = RED): ${JSON.stringify(forward)}`).toEqual([])
    const reverse = [...booked].filter((n) => !catalog.has(n)).sort()
    const unexplained = reverse.filter((n) => NOT_CATALOG_VISIBLE[classOf(n) ?? ''] === undefined)
    expect(unexplained, `REVERSE drift without an authority class that says "not catalog-visible" (never silent): ${JSON.stringify(unexplained.map((n) => `${n} [${String(classOf(n))}]`))}`).toEqual([])
  })

  it('FALSIFIABILITY: both directions are detectable — a planted forward name and a planted reverse name each go RED', () => {
    // The law polices nothing if the two comparisons above cannot fail. These are IN-MEMORY mutations of
    // the two sets, exactly as the drift leg consumes them — never a mutation of the disk.
    const catalog = harvestCatalog()
    const booked = new Set<string>(bookedNames())
    const plantedForward = 'a_tool_the_catalog_does_not_carry'
    expect([...catalog].filter((n) => !booked.has(n) && n === plantedForward), 'a catalog name nobody booked is visible to the forward filter').toEqual([])
    const forwardWithPlant = [...catalog, plantedForward].filter((n) => !booked.has(n)).sort()
    expect(forwardWithPlant, 'the forward filter CATCHES a catalog name the claim set does not book').toEqual([plantedForward])

    const plantedReverse = 'a_claim_the_catalog_does_not_carry'
    const reverseWithPlant = [...booked, plantedReverse].filter((n) => !catalog.has(n)).sort()
    const unexplainedWithPlant = reverseWithPlant.filter((n) => NOT_CATALOG_VISIBLE[classOf(n) ?? ''] === undefined)
    expect(unexplainedWithPlant, 'the reverse filter CATCHES a booked name with no not-catalog-visible class').toContain(plantedReverse)
    // ... and the REAL rows that miss the catalog are explained, so the filter above is not vacuous.
    const realReverse = [...booked].filter((n) => !catalog.has(n)).sort()
    expect(realReverse.length, 'the reverse arm has real rows to explain (otherwise it proves nothing)').toBeGreaterThan(0)
    for (const n of realReverse) expect(NOT_CATALOG_VISIBLE[classOf(n) ?? ''], `${n} must carry a not-catalog-visible class`).toBeTruthy()
  })

  it('PROVENANCE of every booking: a guessed name is RED — each booked name must carry a real registration source at the host tree', () => {
    // A name enters the claim set only with a REAL registration source at the pinned host release: a quoted
    // literal ('name'/"name"), a `toolName: name` bundle route, or a NAMED template loop (stagehand only —
    // the template is listed explicitly, it is not a wildcard). "guessed name = red".
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
    for (const name of bookedNames()) {
      const direct = blobs.some((t) => t.includes(`'${name}'`) || t.includes(`"${name}"`) || t.includes(`toolName: ${name}`))
      const tmpl = TEMPLATES[name] !== undefined && blobs.some((t) => t.includes(TEMPLATES[name] as string))
      if (!direct && !tmpl) missing.push(name)
    }
    expect(missing, `bookings WITHOUT a real registration source at the pin (guessed names are RED): ${JSON.stringify(missing)}`).toEqual([])
  })

  it('subagent_fork is a live shipped registration at the pin (KEPT) and the sibling routes are shipped-disabled', () => {
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
    // and the catalog artifact carries it through the shippedNames column — the caliber that makes it
    // catalog-present (see harvestCatalog).
    expect(harvestCatalog().has('subagent_fork'), 'subagent_fork stays in the harvest caliber').toBe(true)
    expect(bookedNames(), 'the claim set books it').toContain('subagent_fork')
  })
})
