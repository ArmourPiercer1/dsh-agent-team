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
const LANE_DIRS = ['runtime/jobs-gateway', 'runtime/test', 'domain/vnext-field-mapping/src', 'domain/test']

function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) listFiles(full, out)
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

  it('zero production consumers: no importer outside the lanes and the a5p7 specs', () => {
    const importers: string[] = []
    for (const file of ALL_PACKAGE_FILES) {
      if (!/\.(ts|mjs)$/.test(file)) continue
      const rel = relative(REPO_PACKAGES, file).split(sep).join('/')
      const isLaneOwn =
        rel.startsWith('runtime/jobs-gateway/') ||
        rel.startsWith('domain/vnext-field-mapping/') ||
        /\/a5p7-/.test(rel)
      if (isLaneOwn) continue
      const text = readFileSync(file, 'utf8')
      if (/jobs-gateway|vnext-field-mapping/.test(text)) importers.push(rel)
    }
    expect(importers).toEqual([])
  })

  it('every lane file carries zero frozen denylist vocabulary', () => {
    for (const file of LANE_SOURCE_FILES) {
      const hits = matchDenyListInText(readFileSync(file, 'utf8'), file)
      expect(hits, file).toEqual([])
    }
  })
})
