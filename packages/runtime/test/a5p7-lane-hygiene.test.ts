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
        'domain/vnext-field-mapping/src/index.ts',
        'runtime/jobs-gateway/cancellation-boundary.ts',
        'runtime/jobs-gateway/index.ts',
        'runtime/jobs-gateway/jobs-gateway.ts',
        'runtime/jobs-gateway/lease-window.ts',
        'runtime/jobs-gateway/types.ts',
        'runtime/jobs-gateway/web-projection.ts',
        'runtime/test/a5p7-cproc-fixture.ts',
        'runtime/test/a5p7-job-owner.test.ts',
        'runtime/test/a5p7-lane-hygiene.test.ts',
        'runtime/test/a5p7-lease-cancellation.test.ts',
        'runtime/test/a5p7-mcp-rebind-chain.test.ts',
      ].sort(),
    )
    expect(LANE_SOURCE_FILES.length).toBe(14)
  })

  // Reviewed NAMES-ONLY exception — the G-d integration wiring round paid
  // this lane's merge in the p4t6 session-event CENSUS (branch
  // `alpha5-int-wiring`). A census names every scannable path by design;
  // this is a name in a census, not a consumer (zero code, zero glue rides
  // with it — the leg below pins every lane-naming census line to exactly
  // one quoted path). Path-exact on purpose: a second census file, or any
  // import edge, is still an offender.
  const NAMES_ONLY_LEDGER_EXCEPTIONS: readonly string[] = ['testkit/test/p4t6-session-event-scan.test.ts']

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
      if (isLaneOwn || NAMES_ONLY_LEDGER_EXCEPTIONS.includes(rel)) continue
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
