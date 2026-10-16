/**
 * `a5p5-dormant-audit` — the DORMANT pin (PR0 `a5p0-layer-audit` precedent):
 * this lane is allowed to exist only until an reviewed integration wires it.
 * The moment any SHIPPED source outside `packages/tools/a5p5-tools/` names
 * the lane, this test fails and the wiring enters review as its own change.
 *
 * Scan universe: every source-ish file under `packages/` (`*.ts`, `*.mjs`,
 * `*.json` manifests), excluding the lane itself, `node_modules`, `dist`
 * build output and this test file's own directory. The scan reads files —
 * tests may use `node:*`; the lane's `src/` remains pure.
 *
 * @module test/a5p5-dormant-audit
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const packagesRoot = join(here, '..', '..', '..') // packages/
const laneRoot = join(here, '..') // packages/tools/a5p5-tools

const SOURCE_EXTENSIONS = ['.ts', '.mts', '.mjs', '.js', '.json']

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      yield full
    }
  }
}

/**
 * Reviewed NAMES-ONLY exceptions (the header's "the wiring enters review as
 * its own change" moment, G-d integration wiring round, branch
 * `alpha5-int-wiring`): the p4t6 session-event ledger is a CENSUS whose whole
 * purpose is to NAME every scannable path — the lane's merge tie was paid
 * there (this is a name in a census, not a reference: zero code, zero barrel,
 * zero glue rides with it; dormancy of the SHIPPED face is unchanged). The
 * exception is path-exact on purpose — a second census-style file, or any
 * import edge, is still an offender, and the legs below pin that every
 * lane-naming line in each census-style file is exactly one quoted path and
 * nothing else.
 *
 * Second entry (review-Wiring condition A, same round): the a5p0 layer audit's
 * consumer-set pin NAMES the lane's six src files — the reviewed PR5 consumer
 * registration (review #260@5ccc5839, booked in
 * scripts/audit-a5-tool-governance-imports.mjs). A name inside a NAMED SET is
 * a name, not an edge: the file imports nothing from the lane (the leg below
 * pins every lane-naming line to the bare quoted-path form, so an edge cannot
 * hide in it), and dormancy of the SHIPPED face is unchanged.
 */
const NAMES_ONLY_LEDGER_EXCEPTIONS: readonly string[] = ['testkit/test/p4t6-session-event-scan.test.ts', 'domain/test/a5p0-layer-audit.test.ts']

describe('a5p5-dormant-audit', () => {
  it('no shipped source outside the lane references a5p5-tools', () => {
    const offenders: string[] = []
    for (const file of walk(packagesRoot)) {
      const relativePath = relative(packagesRoot, file)
      const insideLane = file === laneRoot || file.startsWith(laneRoot + sep)
      if (insideLane) continue
      if (NAMES_ONLY_LEDGER_EXCEPTIONS.includes(relativePath)) continue
      const text = readFileSync(file, 'utf8')
      if (text.includes('a5p5-tools')) offenders.push(relativePath)
    }
    expect(offenders).toEqual([])
  })

  it('the p4t6 census names the lane ONLY as quoted ledger paths, never as an edge', () => {
    const ledger = readFileSync(join(packagesRoot, 'testkit', 'test', 'p4t6-session-event-scan.test.ts'), 'utf8')
    for (const line of ledger.split('\n')) {
      if (!line.includes('a5p5-tools')) continue
      expect(line.trim(), line.trim()).toMatch(/^'packages\/tools\/a5p5-tools\/[^']+',$/)
    }
  })

  it('the a5p0 consumer-set pin names the lane ONLY as quoted consumer paths, never as an edge', () => {
    // Condition A (review-Wiring): this file entered the exception list when
    // the PR5 consumer registration was booked. The form is the contract:
    // every lane-naming line is one quoted packages-relative path — a bare
    // member of the NAMED SET, never an import, never prose wearing a path.
    const ledger = readFileSync(join(packagesRoot, 'domain', 'test', 'a5p0-layer-audit.test.ts'), 'utf8')
    let namedLines = 0
    for (const line of ledger.split('\n')) {
      if (!line.includes('a5p5-tools')) continue
      namedLines += 1
      expect(line.trim(), line.trim()).toMatch(/^'tools\/a5p5-tools\/[^']+',$/)
    }
    expect(namedLines).toBe(6) // exactly the six registered src consumers — if the pin drifts, this trips
  })

  it('the shared tools barrel still does not know the lane (explicit leg)', () => {
    const barrel = readFileSync(join(packagesRoot, 'tools', 'src', 'index.ts'), 'utf8')
    expect(barrel).not.toContain('a5p5')
  })
})
