/**
 * a5p7-lane-hygiene.test.ts — DORMANT guarantees for the PR7 lane.
 *
 *  1. ZERO PRODUCTION CONSUMER: nothing outside the two lane directories
 *     and the a5p7 test files imports `jobs-gateway` or
 *     `vnext-field-mapping`. A second consumer is a design change, not an
 *     import accident (PR1/PR3 precedent).
 *  2. ZERO DENYLIST VOCABULARY: every lane file passes the frozen scanner's
 *     denylist matcher — the lane adds capability vocabulary, never the
 *     legacy Team event vocabulary.
 *  3. THE p4t6 INCREMENT IS ON THE RECORD: this lane cannot edit the shared
 *     scanner (INTERFACES-v1: shared files belong to the integration owner),
 *     so the exact scannable-file list this lane adds is pinned HERE and
 *     restated in the lane README for the integration owner's scanner bump.
 *
 * @module test/a5p7-lane-hygiene
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { matchDenyListInText } from '../../testkit/fault-injection/session-event-scan.mjs'

const REPO_PACKAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..') // packages/
const REPO_LEDGER_FILE = join(REPO_PACKAGES, 'testkit', 'test', 'p4t6-session-event-scan.test.ts')
const LANE_DIRS = ['runtime/jobs-gateway', 'runtime/test', 'domain/vnext-field-mapping/src', 'domain/test']

// Census-load discipline (poc3 fd-recycling precedent, same family): this walk
// runs at COLLECTION time, and the nine-root census executes files across
// workers — other suites' tests create and delete transient paths under
// packages/** (fault-injection state, test worlds) while this walk is in
// flight. An entry that vanishes between readdir and stat was transient at
// scan time: gone, it can import nothing and carry no vocabulary, so skipping
// it weakens no claim — the exact-set pin below still asserts every STABLE
// lane file is present, and every surviving file is still fully scanned.
// ENOENT/ENOTDIR only are tolerated; any other fs error still throws, so a
// broken tree is never walked silently. (Plain statSync in try/catch, not the
// `throwIfNoEntry` option: this package's declared @types/node predates it,
// and the merge-gate typecheck leg is what caught that — TS2554.)
function listFiles(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return out // directory gone: transient
    throw err
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st: ReturnType<typeof statSync>
    try {
      st = statSync(full)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || code === 'ENOTDIR') continue // vanished mid-walk
      throw err
    }
    if (st.isDirectory()) listFiles(full, out)
    else out.push(full)
  }
  return out
}

const ALL_PACKAGE_FILES = LANE_DIRS.length > 0 ? listFiles(REPO_PACKAGES) : []

const LANE_SOURCE_FILES = ALL_PACKAGE_FILES.filter((f) => {
  // The frozen scanner's extension set: only these can move its count or
  // carry denylist vocabulary (README.md and friends are not scannable).
  if (!/\.(ts|mts|mjs)$/.test(f)) return false
  const rel = relative(REPO_PACKAGES, f).split(sep).join('/')
  return (
    rel.startsWith('runtime/jobs-gateway/') ||
    rel.startsWith('domain/vnext-field-mapping/') ||
    (rel.startsWith('runtime/test/a5p7-') && rel.endsWith('.ts')) ||
    (rel.startsWith('domain/test/a5p7-') && rel.endsWith('.ts'))
  )
})

describe('a5p7 lane hygiene — DORMANT means DORMANT', () => {
  it('the lane files this round adds are exactly the recorded set (the p4t6 increment)', () => {
    const rel = LANE_SOURCE_FILES.map((f) => relative(REPO_PACKAGES, f).split(sep).join('/')).sort()
    expect(rel).toEqual(
      [
        'domain/test/a5p7-vnext-field-mapping.test.ts',
        'domain/vnext-field-mapping/src/field-mapping.ts',
        // alpha5-schema-rev (VNEXT-SCHEMA reversible half, ADR M-2): the
        // SHIPPING v4 authoring tables, composed from the frozen engine —
        // still DORMANT (SUPPORTED stays [3]; the only importer outside the
        // lane is the a5sr3 contract suite, see the reviewed test-edge
        // exception below).
        'domain/vnext-field-mapping/src/v4-authoring-map.ts',
        'domain/vnext-field-mapping/src/index.ts',
        'runtime/jobs-gateway/cancellation-boundary.ts',
        'runtime/jobs-gateway/index.ts',
        'runtime/jobs-gateway/jobs-gateway.ts',
        'runtime/jobs-gateway/lease-window.ts',
        'runtime/jobs-gateway/types.ts',
        'runtime/jobs-gateway/web-projection.ts',
        'runtime/test/a5p7-cproc-fixture.ts',
        'runtime/test/a5p7-job-owner.test.ts',
        // A5-JOBS-ISO (branch a5-jobs-isolation, B-route jobs closure round):
        // the live-row BEHAVIOR spec (two-member durable-identity legs) and
        // its round-2 ACTUATOR spec (creation attribution, the management-
        // path owner fence with the corded:false pass-through, the two
        // native kill forms). Test-edge files in the lane's own `a5p7-`
        // naming; this round added NEITHER a new lane source file NOR a new
        // production edge — the C2 mount rides the pinned GLUE-5 pair
        // below (the entry's new bridge import names plane-effect-backends,
        // never the lane).
        'runtime/test/a5p7-jobs-assembly.test.ts',
        'runtime/test/a5p7-jobs-assembly-actuator.test.ts',
        'runtime/test/a5p7-lane-hygiene.test.ts',
        'runtime/test/a5p7-lease-cancellation.test.ts',
        'runtime/test/a5p7-mcp-rebind-chain.test.ts',
      ].sort(),
    )
    expect(LANE_SOURCE_FILES.length).toBe(17)
  })

  // Reviewed NAMES-ONLY exception — the G-d integration wiring round paid
  // this lane's merge in the p4t6 session-event CENSUS (branch
  // `alpha5-int-wiring`). A census names every scannable path by design;
  // this is a name in a census, not a consumer (zero code, zero glue rides
  // with it — the leg below pins every lane-naming census line to exactly
  // one quoted path). Path-exact on purpose: a second census file, or any
  // import edge, is still an offender.
  // REVIEWED TEST-EDGE exception (alpha5-schema-rev, VNEXT-SCHEMA reversible
  // half): the domain contract suite a5sr3-default-deny-mapping.test.ts is a
  // TEST importer of the lane — it machine-checks the four mapping laws
  // against the shipped v4 tables (that is the round's M-2 deliverable).
  // A test edge is not a production consumer; the distinction this leg
  // guards is unchanged: zero PRODUCTION importers outside the lanes.
  // Form-pinned below: the exception only ever matches a path under a
  // `test/` directory.
  const REVIEWED_TEST_EDGE_EXCEPTIONS: readonly string[] = [
    'domain/test/a5sr3-default-deny-mapping.test.ts',
  ]

  const NAMES_ONLY_LEDGER_EXCEPTIONS: readonly string[] = [
    'testkit/test/p4t6-session-event-scan.test.ts',
    // GLUE-5: the A4 artifacts ledger now DERIVES its fixture world from
    // scripts/place-dist-glue.mjs's PLACEMENTS list (the re-booked dynamic
    // glue count) — it names the rows in comments and reads the list, it
    // imports no lane. Same name-only category as p4t6 above.
    'testkit/test/a4-artifacts-nonempty.test.ts',
    // U6-PR4 (jobs bridge onto the governance kernel): the bridge module,
    // the re-export back-of-house, and the PR4 spec name the LIVE ROW'S
    // FILENAME (`jobs-gateway-assembly.mjs` — itself an edge exception
    // below) as FROZEN-IMPORT LAW TEXT (E1 pins its sha). None of the
    // three imports ANY lane: the bridge module's import whitelist is
    // exactly node:crypto + the contracts barrel, pinned by
    // u6-pr4-jobs-bridge.test.ts A3, and the trio's gateway reach rides
    // the entry-injected accessor (the reviewed row edge), never a
    // barrel. Name-only, zero new edges — the same category GLUE-5
    // booked for the artifacts ledger above.
    'runtime/src/plugin/live/jobs-family-bridge.mjs',
    'runtime/src/plugin/live/plane-effect-backends.mjs',
    'runtime/test/u6-pr4-jobs-bridge.test.ts',
  ]

  // REVIEWED-EDGE exceptions (alpha5-glue5-entry, GLUE-5 production-assembly
  // round — THE "wiring enters review as its own change" moment the lane
  // header reserved): the LIVE ROW `runtime/src/plugin/live/jobs-gateway-assembly.mjs`
  // opens one gateway assembly per owning team root (pc-CONTRACT §3: the
  // live row, the dist-mirror import, the assembly-owned lease lifecycle and
  // the census booking were that section's checklist), and the production
  // entry `runtime/src/plugin/live/agent-bindings.mjs` reaches the lane ONLY
  // through that row. Both edges are form-pinned by the leg below: the row
  // imports the barrel exactly once; the entry imports the row exactly once
  // and NEVER touches the barrel directly. Dormancy retired here is exactly
  // "the lane ships dark" — nothing else in these pins moves.
  const REVIEWED_EDGE_EXCEPTIONS: readonly string[] = [
    'runtime/src/plugin/live/jobs-gateway-assembly.mjs',
    'runtime/src/plugin/live/agent-bindings.mjs',
  ]

  it('zero production consumers: no importer outside the lanes and the a5p7 specs', () => {
    const importers: string[] = []
    for (const file of ALL_PACKAGE_FILES) {
      if (!/\.(ts|mjs)$/.test(file)) continue
      const rel = relative(REPO_PACKAGES, file).split(sep).join('/')
      // Derived build output is skipped. A `.d.ts` under `…/dist/…` is tsc's
      // compiled mirror of a source file, and dist is a pure function of the
      // source graph: any production consumer that could appear in dist must
      // first exist as a SOURCE importer, and every source file is still
      // scanned below. Since the lanes joined the build plane (tsconfig.build
      // include), the scanner would otherwise flag the lane's OWN emitted
      // declarations (runtime/dist/packages/runtime/jobs-gateway/*.d.ts) as
      // consumers — a mirror, not an edge. Skipping derived output therefore
      // weakens the source-import invariant by nothing.
      if (/(^|\/)dist\//.test(rel)) continue
      const isLaneOwn =
        rel.startsWith('runtime/jobs-gateway/') ||
        rel.startsWith('domain/vnext-field-mapping/') ||
        /\/a5p7-/.test(rel)
      if (isLaneOwn || NAMES_ONLY_LEDGER_EXCEPTIONS.includes(rel) || REVIEWED_EDGE_EXCEPTIONS.includes(rel)) continue
      if (REVIEWED_TEST_EDGE_EXCEPTIONS.includes(rel)) {
        // form pin: a reviewed test edge must stay a test file, never a source edge
        if (!rel.includes('/test/')) throw new Error(`reviewed test edge ${rel} is not under a test/ directory`)
        continue
      }
      let text: string
      try {
        text = readFileSync(file, 'utf8')
      } catch (err) {
        // Same census-load family as the listFiles guard above: between the
        // module-load walk and this read (which runs while other workers'
        // suites churn transient paths), an entry can vanish. A file that is
        // GONE cannot import the lane — skipping it weakens the claim no
        // further than its own deletion does; every present file is still
        // read. ENOENT/ENOTDIR only; any other read error still throws.
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT' || code === 'ENOTDIR') continue
        throw err
      }
      if (/jobs-gateway|vnext-field-mapping/.test(text)) importers.push(rel)
    }
    expect(importers).toEqual([])
  })

  it('the two reviewed GLUE-5 edges are exactly the pinned import lines', () => {
    // See the REVIEWED_EDGE_EXCEPTIONS comment: the exception is edge-shaped,
    // so its shape is the contract. (a) The live row names the lane in
    // EXACTLY one import line — the barrel, dist-mirror relative form; no
    // deep imports into the lane's modules. (b) The production entry names
    // the lane in EXACTLY one import line — the live row itself — and the
    // barrel string NEVER appears in it: the entry can only reach the lane
    // through the row, never around it.
    const row = readFileSync(join(REPO_PACKAGES, 'runtime', 'src', 'plugin', 'live', 'jobs-gateway-assembly.mjs'), 'utf8')
    const rowEdges = row.split('\n').filter((line) => /^\s*import\b.*jobs-gateway/.test(line))
    expect(rowEdges.map((l) => l.trim())).toEqual([
      // A5-JOBS-ISO round 2 (C1): the pure-read owner fence reuses the
      // lane's OWN owner-key law, so the row also pulls `jobOwnerKey` —
      // still the exact ONE barrel import line, same dist-mirror relative
      // form, zero deep imports. The edge shape (the contract) did not
      // move; the imported-name list grew by one lane-exported symbol.
      // ROOT ruling X (bridge-specific scope keys): the ONE barrel import
      // line grew by one more lane-exported symbol (jobsBridgeScopeKey, the
      // single derivation helper the row RE-EXPORTS below so the entry can
      // ride the row and never touch the barrel). Same shape law as the C1
      // jobOwnerKey precedent above: list grew, edge shape did not move.
      `import { createJobsGateway, createLeaseWindow, jobOwnerKey, jobsBridgeScopeKey } from '../../../jobs-gateway/index.js'`,
    ])
    const entry = readFileSync(join(REPO_PACKAGES, 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
    const entryEdges = entry.split('\n').filter((line) => /^\s*import\b.*jobs-gateway/.test(line))
    expect(entryEdges.map((l) => l.trim())).toEqual([
      // Same law on the entry edge: still EXACTLY ONE line importing the
      // live row (never the barrel - pinned below again); the line grew by
      // the row-re-exported jobsBridgeScopeKey helper, not by an edge.
      `import { createLiveJobsGatewayAssembly, jobsBridgeScopeKey } from './jobs-gateway-assembly.mjs'`,
    ])
    expect(entry).not.toContain("jobs-gateway/index.js'")
  })

  it('the p4t6 census names the lane ONLY as quoted ledger paths, never as an edge', () => {
    const ledger = readFileSync(REPO_LEDGER_FILE, 'utf8')
    for (const line of ledger.split('\n')) {
      if (!/jobs-gateway|vnext-field-mapping/.test(line)) continue
      // Census form: a quoted scannable path as a list entry — nothing else
      // (imports and prose edges never take this shape).
      expect(line.trim(), line.trim()).toMatch(/^'packages\/[^']+',$/)
    }
  })

  it('every lane file carries zero frozen denylist vocabulary', () => {
    for (const file of LANE_SOURCE_FILES) {
      const hits = matchDenyListInText(readFileSync(file, 'utf8'), file)
      expect(hits, file).toEqual([])
    }
  })
})
