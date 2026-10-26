/**
 * U6 PR5 — the SEARCH MOVE LAW: the search family lane must be the ONE
 * HOME of the moved mechanics, byte-identical to where they lived on
 * master, with the center sites DELETED (no dual ledger — the no-dual-
 * ledger law: replacement in the same PR, the PR2/PR3 re-export-edge form).
 *
 * What this pins (mechanically, against the BASE commit's own blobs — the
 * same git-object truth the golden recording was made from, NOT a copy):
 *
 *  M1 the mechanics region (master `plane-effect-backends.mjs` lines
 *     107–539: grepArgv + the W5 anchored search/glob wiring) is contained
 *     VERBATIM, byte for byte, in the lane's `search-mechanics.mjs`;
 *  M2 `search-backend.mjs` / `glob-backend.mjs` / `cancel-leg.mjs` moved
 *     with EXACTLY the declared deltas (provider-import depth re-based to
 *     the lane + the `@module` provenance tag) — nothing else differs by a
 *     single byte;
 *  M3 the center files do NOT define the moved names any more — they
 *     RE-EXPORT them through the lane's public face (the approved single-
 *     home form), and the old `src/plugin/live/` files are gone from the
 *     index (the no-dual-ledger law: no second copy survives);
 *  M4 the dist mirror carries the lane files at the placed paths (the
 *     dist-glue law — the runtime loads what is actually placed).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const BASE_SHA = '5c03f7240a2a43534e6f52b87aa3c541fad993f7'

const gitShow = (rel: string, ref = BASE_SHA): string =>
  execFileSync('git', ['show', `${ref}:${rel}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

// NOTE: the vitest type env shadows the URL global (vitest/browser); every
// path here resolves through import.meta.url via fileURLToPath + join.
const HERE = dirname(fileURLToPath(import.meta.url))
const abs = (rel: string): string => join(HERE, rel)
const read = (rel: string): string => readFileSync(abs(rel), 'utf8')

const MECHANICS = '../../tools/search-family/src/search-mechanics.mjs'
const SEARCH_BACKEND = '../../tools/search-family/src/search-backend.mjs'
const GLOB_BACKEND = '../../tools/search-family/src/glob-backend.mjs'
const CANCEL_LEG = '../../tools/search-family/src/cancel-leg.mjs'
const PLANE_PEB = '../src/plugin/live/plane-effect-backends.mjs'

/** The declared, reviewed deltas of the three git-mv'd files: every line
 *  that differs from master must appear HERE, exactly, and nowhere else
 *  may differ (M2 compares the DELTA, not a filter). */
const DECLARED_DELTAS: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = Object.freeze({
  'search-backend.mjs': [
    [' * @module packages/runtime/src/plugin/live/search-backend', ' * @module search-family/search-backend'],
    ["import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'",
     "import { createConfinedProcessProvider } from '../../../runtime/sandbox-provider/index.js'"],
  ],
  'glob-backend.mjs': [
    [' * @module packages/runtime/src/plugin/live/glob-backend', ' * @module search-family/glob-backend'],
    ["import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'",
     "import { createConfinedProcessProvider } from '../../../runtime/sandbox-provider/index.js'"],
  ],
  'cancel-leg.mjs': [
    [' * @module runtime/plugin/live/cancel-leg', ' * @module search-family/cancel-leg'],
  ],
})

function applyDeclaredDeltas(master: string, file: keyof typeof DECLARED_DELTAS): string {
  let out = master
  for (const [from, to] of DECLARED_DELTAS[file]!) {
    if (!out.includes(from)) throw new Error(`declared delta gone from master blob: ${file} :: ${from.slice(0, 60)}`)
    out = out.split(from).join(to)
  }
  return out
}

describe('u6-pr5 search move law: one home, verbatim mechanics, deleted center sites', () => {
  it('M1 the moved mechanics region is byte-identical to master plane-effect-backends.mjs:107-539', () => {
    const master = gitShow('packages/runtime/src/plugin/live/plane-effect-backends.mjs')
    const startMark = '/** The ONE argv builder (ported verbatim from the W5 wiring round). */'
    const endMark = '// ── U6 PR3: the shell-class mechanics + the confined shell EXECUTOR moved'
    const start = master.indexOf(startMark)
    const end = master.indexOf(endMark)
    expect(start, 'region start marker (master)').toBeGreaterThan(-1)
    expect(end, 'region end marker (master)').toBeGreaterThan(start)
    // The region is master lines 107..539 (the plan's :106 is the boundary
    // blank line) — prove the marker arithmetic, do not trust prose.
    expect(master.slice(0, start).split('\n').length).toBe(107)
    // The boundary blank line(s) before the next banner are separator
    // formatting, not the moved code: the region ends at its final `}`.
    const region = master.slice(start, end).replace(/\n+$/, '\n')
    const lane = read(MECHANICS)
    expect(lane.includes(region), 'the lane contains the master region VERBATIM (not a rewrite)').toBe(true)
    // And the lane contains NOTHING between the region boundaries except
    // the region itself: the file is header + the region + lane additions
    // AFTER it — the region occurs exactly once.
    expect(lane.indexOf(region, lane.indexOf(region) + 1), 'no duplicated region').toBe(-1)
  })

  it('M2 the git-mv\'d files differ from master ONLY by the declared deltas (one byte otherwise)', () => {
    for (const [name, rel] of [
      ['search-backend.mjs', SEARCH_BACKEND] as const,
      ['glob-backend.mjs', GLOB_BACKEND] as const,
      ['cancel-leg.mjs', CANCEL_LEG] as const,
    ]) {
      const master = gitShow(`packages/runtime/src/plugin/live/${name}`)
      expect(read(rel), `${name}: exactly the declared deltas`).toBe(applyDeclaredDeltas(master, name))
    }
  })

  it('M3 no dual ledger: the center defines nothing, re-exports the lane, and the old files are gone', () => {
    const peb = read(PLANE_PEB)
    // (a) the old center files are deleted from the index (not just moved
    //     in the worktree — a surviving tracked copy IS the dual ledger).
    const tracked = execFileSync('git', ['ls-files', 'packages/runtime/src/plugin/live'], { cwd: process.cwd(), encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
    for (const gone of ['search-backend.mjs', 'glob-backend.mjs', 'cancel-leg.mjs']) {
      expect(tracked.some((t) => t.endsWith(`live/${gone}`)), `${gone} still tracked under live/`).toBe(false)
      expect(existsSync(abs(`../src/plugin/live/${gone}`)), `${gone} still on disk under live/`).toBe(false)
    }
    // (b) the center surface survives ONLY as re-export edges pointing at
    //     the lane (the PR2/PR3 single-home form): the definitions are gone
    //     from plane-effect-backends.mjs, the export edges name the lane.
    expect(peb.includes('export function grepArgv'), 'the center no longer DEFINES grepArgv').toBe(false)
    expect(peb.includes('function searchArgv'), 'the center no longer DEFINES searchArgv').toBe(false)
    expect(peb.includes("from '../../../../tools/search-family/src/search-mechanics.mjs'"), 're-export edge → the lane').toBe(true)
    expect(peb.includes('grepArgv'), 'the center surface still NAMES grepArgv (export edge)').toBe(true)
    // (c) the plane assembles the rows THROUGH the lane (never an inline copy).
    const plane = read('../src/plugin/live/team-tool-plane.mjs')
    expect(plane.includes("from '../../../../tools/search-family/src/search-mechanics.mjs'")
      || plane.includes('../../tools/search-family/src/search-mechanics.mjs'), 'the plane imports the lane face').toBe(true)
    expect(plane.includes('function grepArgv'), 'the plane defines no local copy').toBe(false)
  })

  it('M4 the dist mirror carries the lane files (the dist-glue law)', () => {
    for (const name of ['index.mjs', 'search-mechanics.mjs', 'search-backend.mjs', 'glob-backend.mjs', 'cancel-leg.mjs', 'search-row.mjs', 'search-contribution.mjs']) {
      const distPath = abs(`../dist/packages/tools/search-family/src/${name}`)
      expect(existsSync(distPath), `dist placement missing: ${name}`).toBe(true)
      expect(readFileSync(distPath, 'utf8').length, `dist placement empty: ${name}`).toBeGreaterThan(0)
    }
  })
})
