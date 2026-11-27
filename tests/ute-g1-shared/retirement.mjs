/**
 * retirement.mjs — the UTE G1 lanes' shared RETIREMENT-BY-A0 discipline.
 *
 * WHY THIS FILE EXISTS (round 81, final CI disposition). The A0/A1 cut deleted
 * the route-C *appending* mechanism: `attachA5sfNativeToolModules` no longer
 * appends a Team-authored `confined-*-tool.mjs` shadow; the COMPOSITION declares
 * the host's own native modules (`a5sfNativeToolModules`) and the seam re-mounts
 * them on the Member's isolated scope (`docs/plans/memo/ute-p0-20261121`,
 * `03-RETIRE-KEEP.md` §2c; `5d1349767` deleted every `confined*SpecOf` and its
 * module; `93ba0a1d1` cut the family contributions). The five lane suites were
 * written against the deleted mechanism, so their OLD-PATH arms assert
 * `Array.isArray(fibers)` from an attach that now correctly answers "nothing".
 *
 * The disposition is NOT a skip and NOT a deletion of the lane: each retired arm
 * is replaced by a pin that (a) asserts the retired surface stays ABSENT, (b)
 * keeps the frozen fixture/corpus laws that still hold, and (c) asserts every
 * NAMED successor that carries the guarantee now exists. A resurrected shadow,
 * a deleted fixture or a fabricated new-path claim is RED.
 *
 * Every pin answers a citation into the frozen ledger
 * (`dev/agent-workflow/ledgers/ute-cut-closure.allow.json#retiredSurfaces`) and
 * the deleting commit, so the retirement can be audited without this comment.
 *
 * @module tests/ute-g1-shared/retirement
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** This round's id. It names every re-recorded artifact (`accepted_by`). */
export const ACCEPTED_BY = 'round81-a1-cut'

/** The exact commits that deleted the retired mechanism. */
export const DELETING_COMMITS = Object.freeze({
  /** every `confined*SpecOf` + `confined-*-tool.mjs`; the attach stopped appending. */
  appendedShadow: '5d1349767',
  /** the A0 frozen wave-1 cut: family contributions + `team-tool-plane.mjs`. */
  frozenCut: '93ba0a1d1',
})

/** The production successor: the vNext assembly mounts the PRESET's own modules. */
export const VNEXT_ASSEMBLY = 'packages/runtime/src/plugin/vnext/agent-bindings.mjs'
/** The retired route-C row (still live, but HOST-MODULES-ONLY after A1). */
export const ROUTE_C_ROW = 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs'

/** The frozen retirement licence (round 80). */
export const RETIREMENT_LEDGER = 'dev/agent-workflow/ledgers/ute-cut-closure.allow.json'

/** Read one `retiredSurfaces.subjects` row by subject id (`id`). */
export function subjectRow(subjectId) {
  const ledger = JSON.parse(readFileSync(join(REPO_ROOT, RETIREMENT_LEDGER), 'utf8'))
  const row = ledger.retiredSurfaces.subjects.find((subject) => subject.id === subjectId)
  assert.ok(row !== undefined, `the frozen retirement licence has no subject ${subjectId}; the citation would be unfounded`)
  assert.equal(row.disposition, 'retired-by-a0-cut', `${subjectId}: the licence does not book this subject as retired`)
  assert.ok(Array.isArray(row.citations) && row.citations.length > 0, `${subjectId}: the licence row carries no citation`)
  return row
}

/**
 * Assert every retired path stays ABSENT, and PRINT the fact. A restored module
 * is RED here — this is the negative control the retirement must keep.
 *
 * @param {readonly string[]} paths - repo-relative paths the cut deleted.
 * @param {string} subject - the subject the paths belong to.
 */
export function assertAbsentPaths(paths, subject, { quiet = false } = {}) {
  assert.ok(paths.length > 0, `${subject}: the retirement must name at least one retired path`)
  for (const path of paths) {
    assert.equal(existsSync(join(REPO_ROOT, path)), false, `${subject}: the retired surface ${path} is BACK; the A0/A1 cut deleted it (${DELETING_COMMITS.appendedShadow}/${DELETING_COMMITS.frozenCut})`)
  }
  if (!quiet) console.log(`RETIRED-ABSENT subject=${subject} paths=${String(paths.length)}`)
  return paths.length
}

/**
 * Assert the route-C row appends NO Team-authored tool shadow any more, and that
 * the successor (composition-declared native modules) is the only mount source.
 * This is a source-level law: restoring a `confined-*-tool.mjs` spec is RED even
 * if the module file stayed deleted.
 */
export function assertNoAppendedShadow({ quiet = false } = {}) {
  const source = readFileSync(join(REPO_ROOT, ROUTE_C_ROW), 'utf8')
  for (const symbol of ['confined-bash-tool', 'confined-search-tool', 'confined-web-tool', 'confined-terminal-tool', 'confined-ui-tool']) {
    assert.equal(source.includes(symbol), false, `${ROUTE_C_ROW} names ${symbol}: the appended shadow is back (${DELETING_COMMITS.appendedShadow})`)
  }
  assert.equal(/confined[A-Z]\w*SpecOf/u.test(source), false, `${ROUTE_C_ROW} defines a confined*SpecOf again; the A1 law is HOST-MODULES-ONLY`)
  // The positive half of the same law: the composition's own spec list is read.
  assert.match(source, /a5sfConfig\?\.nativeToolModules/u, `${ROUTE_C_ROW} no longer reads the composition's native module list`)
  assert.match(source, /A1: the realm is HOST-MODULES-ONLY/u, `${ROUTE_C_ROW} lost the A1 HOST-MODULES-ONLY statement`)
  if (!quiet) console.log('RETIRED-ABSENT subject=appended-shadow symbol=none')
}

/**
 * The vNext assembly (SHAPE A) mounts the ACTIVE preset's own native modules by
 * default: the successor that carries confinement now. Assert it is present and
 * still derives the module set from the preset (never a Team shadow list).
 */
export function assertVnextAssemblyMountsHostModules({ quiet = false } = {}) {
  assert.ok(existsSync(join(REPO_ROOT, VNEXT_ASSEMBLY)), `${VNEXT_ASSEMBLY} is missing; the successor instrument is gone`)
  const source = readFileSync(join(REPO_ROOT, VNEXT_ASSEMBLY), 'utf8')
  assert.match(source, /mountHostModules|mountVnextNativeToolModules|a5sfNativeToolModules/u, `${VNEXT_ASSEMBLY} no longer mounts native modules; the confinement successor is unproven`)
  if (!quiet) console.log('RETIRED-ABSENT subject=team-shadow successor=vnext-host-modules')
}

/**
 * Assert every NAMED successor exists as a tracked, non-empty file. A successor
 * that is a shell command line is accepted only when its script exists.
 *
 * @param {readonly string[]} successors
 * @param {string} subject
 */
export function assertSuccessorsExist(successors, subject, { quiet = false } = {}) {
  assert.ok(successors.length > 0, `${subject}: a retirement without a named successor is not allowed`)
  for (const successor of successors) {
    const target = successor.split(/\s+/u)[0]
    const absolute = join(REPO_ROOT, target)
    assert.ok(existsSync(absolute), `${subject}: named successor ${successor} does not exist`)
    if (statSync(absolute).isFile()) {
      assert.ok(statSync(absolute).size > 0, `${subject}: named successor ${successor} is empty`)
    }
  }
  if (!quiet) console.log(`RETIRED-SUCCESSORS subject=${subject} named=${String(successors.length)}`)
  return successors.length
}

/**
 * The golden fixture is the FROZEN historical old-path baseline. It must not be
 * re-recorded to match a product that no longer has the mechanism: this style of
 * fingerprint (vector count + the pinned host line) proves the file was not
 * quietly rewritten. Re-recording is legitimate only for the half the NEW path
 * owns, and this lane has no new path.
 *
 * @param {string} relativeGolden - repo-relative golden TSV.
 * @param {number} expectedRows
 * @returns {number} the row count.
 */
export function assertGoldenFrozen(relativeGolden, expectedRows, { quiet = false } = {}) {
  const absolute = join(REPO_ROOT, relativeGolden)
  assert.ok(existsSync(absolute), `${relativeGolden} is missing; the frozen baseline must not be deleted`)
  const text = readFileSync(absolute, 'utf8')
  const rows = text.trim().split('\n').length - 1 // header line
  assert.equal(rows, expectedRows, `${relativeGolden} carries ${String(rows)} vector rows, the frozen baseline records ${String(expectedRows)}; a re-record of a deleted mechanism is not a disposition`)
  assert.equal(/\baccepted_by=round81-a1-cut\b/u.test(text), false, `${relativeGolden} was re-recorded this round; this lane owns no new path, so its expectation may not be moved`)
  if (!quiet) console.log(`GOLDEN-FROZEN fixture=${relativeGolden} vectors=${String(rows)}`)
  return rows
}

/**
 * One falsifiable retirement pin for a lane suite. It returns the printed line
 * so a caller can assert its exact shape.
 *
 * @param {object} input
 * @param {string} input.suite - short suite id (`PROCESS`, `WEB`, ...).
 * @param {string} input.subject - ledger subject id.
 * @param {readonly string[]} input.retiredPaths - paths the cut deleted.
 * @param {readonly string[]} input.successors - named successor instruments.
 * @param {string} [input.golden] - repo-relative frozen fixture.
 * @param {number} [input.goldenRows] - the frozen row count.
 * @param {boolean} [input.checkRouteC] - assert the row is HOST-MODULES-ONLY.
 * @returns {{line: string, absent: number, successors: number}}
 */
export function retirementPin({ suite, subject, retiredPaths, successors, golden, goldenRows, checkRouteC = true }) {
  const absent = assertAbsentPaths(retiredPaths, subject)
  if (checkRouteC) assertNoAppendedShadow()
  assertVnextAssemblyMountsHostModules()
  const named = assertSuccessorsExist(successors, subject)
  if (golden !== undefined) assertGoldenFrozen(golden, goldenRows)
  const line = `UTE-G1-${suite}-RETIRED-BY-A0 subject=${subject} citation=${DELETING_COMMITS.appendedShadow}+${DELETING_COMMITS.frozenCut} absent=${String(absent)} successors=${String(named)}`
  console.log(line)
  return { line, absent, successors: named }
}

/**
 * Run a small negative-control battery with the lane's established transcript
 * shape (`NC <id> ok — detail` … `NC-VERDICT GREEN controls=n failed=0`).
 *
 * @param {readonly {id: string, run: () => (string|void|Promise<string|void>)} []} controls
 * @param {object} [options]
 * @param {string} [options.acceptedBy] - printed as the first line when re-recorded.
 * @param {string} [options.reason] - why the transcript was re-recorded.
 * @returns {Promise<{lines: string[], failed: number}>}
 */
export async function runRetirementControls(controls, options = {}) {
  assert.ok(controls.length > 0, 'an empty retirement battery proves nothing')
  const lines = []
  if (options.acceptedBy !== undefined) {
    lines.push(`ACCEPTED-BY ${options.acceptedBy}${options.reason === undefined ? '' : ` reason=${options.reason}`}`)
  }
  let failed = 0
  const results = []
  for (const control of controls) {
    try {
      const detail = await control.run()
      results.push({ id: control.id, ok: true, detail: typeof detail === 'string' ? detail : '' })
      lines.push(`NC ${control.id} ok${typeof detail === 'string' && detail.length > 0 ? ` — ${detail}` : ''}`)
    } catch (error) {
      failed += 1
      results.push({ id: control.id, ok: false, detail: error instanceof Error ? error.message : String(error) })
      lines.push(`NC ${control.id} FAIL — ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  lines.push(`NC-VERDICT ${failed === 0 ? 'GREEN' : 'RED'} controls=${String(controls.length)} failed=${String(failed)}`)
  return { lines, failed, results }
}
