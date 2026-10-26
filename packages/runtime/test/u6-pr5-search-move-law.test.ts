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
 *     VERBATIM, byte for byte, in the lane's `search-mechanics.mjs` — up to
 *     the archived CANDIDATE-A glob factory (master :319-539), which U7-G6b
 *     RETIRED (a second, unrepaired copy of the walker law; the census-load
 *     flake). M1 pins both halves: the kept region verbatim, the retired
 *     tail absent;
 *  M2 `search-backend.mjs` / `glob-backend.mjs` / `cancel-leg.mjs` moved
 *     with EXACTLY the declared deltas (provider-import depth re-based to
 *     the lane + the `@module` provenance tag) — nothing else differs by a
 *     single byte. The claim is about THE MOVE, so it is pinned against the
 *     move commit's own blobs (`MOVE_SHA`), not the working tree: a later
 *     lane-owned fix (u7 grep-drain: the stream drain law) is not a move;
 *  M3 the center files do NOT define the moved names any more — and the
 *     center hub that used to re-export them is DELETED outright (U6 PR6:
 *     pure re-export surface, zero importers once the plane mounts the
 *     lanes), so no second copy and no second face survives anywhere (the
 *     no-dual-ledger law);
 *  M4 the dist mirror carries the lane files at the placed paths (the
 *     dist-glue law — the runtime loads what is actually placed);
 *  M5 the CURRENT lane bytes: a reviewed sha256 per row file, so the
 *     working tree cannot drift from what the owners last reviewed. The
 *     claim here is NOT move-parity (M2 owns that, against the move
 *     commit's own blobs) — it is "these are the bytes we approved". A
 *     lane-owned fix MUST update this digest in the same commit and say
 *     why in LANE_LEDGER; an unexplained change is a RED.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const BASE_SHA = '5c03f7240a2a43534e6f52b87aa3c541fad993f7'
/** The U6 PR5 move commit itself (`feat(search-family): move the search rows
 *  into their own lane`). M2 compares ITS blobs to master: what the move
 *  wrote, not what the lane later fixed in place. */
const MOVE_SHA = 'b720fa8f6'

const gitShow = (rel: string, ref = BASE_SHA): string =>
  execFileSync('git', ['show', `${ref}:${rel}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

// NOTE: the vitest type env shadows the URL global (vitest/browser); every
// path here resolves through import.meta.url via fileURLToPath + join.
const HERE = dirname(fileURLToPath(import.meta.url))
const abs = (rel: string): string => join(HERE, rel)
const read = (rel: string): string => readFileSync(abs(rel), 'utf8')
/** Repo root (this file is `packages/runtime/test/<file>`); the git checks run
 *  with this as cwd so their pathspecs are NEVER cwd-relative and vacuous. */
const REPO_ROOT = join(HERE, '../../..')
/** Tracked-AND-Present index entries for a repo-root-relative path. A plain
 *  working-tree `rm` leaves the path in the index (`git ls-files` still lists
 *  it until the deletion is staged/committed), so the dual-ledger law reads
 *  the index together with the work tree: what must not exist is a tracked
 *  copy that is actually there. */
const trackedPresent = (rel: string): string[] =>
  execFileSync('git', ['ls-files', '--', rel], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim())
    .filter((p) => p.length > 0 && existsSync(join(REPO_ROOT, p)))

const MECHANICS = '../../tools/search-family/src/search-mechanics.mjs'
const SEARCH_BACKEND = '../../tools/search-family/src/search-backend.mjs'
const GLOB_BACKEND = '../../tools/search-family/src/glob-backend.mjs'
const CANCEL_LEG = '../../tools/search-family/src/cancel-leg.mjs'
const PLANE_PEB = '../src/plugin/live/plane-effect-backends.mjs'
const PLANE_PEB_DTS = '../src/plugin/live/plane-effect-backends.d.mts'

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

/**
 * M5 — THE CURRENT-LANE DIGEST LEDGER. One sha256 per lane row file, with the
 * date and the reason of the last reviewed change, so the suite answers "are
 * these the bytes the owners approved?" without making every future fix a
 * rewrite of the move law.
 *
 * THE RULE: a change to any of these files MUST come with a ledger entry in the
 * same commit. If the digest below and the file disagree, the fix is to record
 * the new digest AND its reason here (this PR is the first such entry), not to
 * relax the check. `cancel-leg.mjs` is untouched since the move, which is why
 * its digest equals the move commit's — a free, non-vacuous control.
 */
const LANE_DIGESTS: Readonly<Record<string, { readonly sha256: string, readonly why: string }>> = Object.freeze({
  'search-backend.mjs': {
    sha256: '164c56d62662c79649dbfd747d0ec369b8b06f74f53cf3310d5aaa3e43bc15a4',
    why: '2026-10-26 u7-grep-drain (PR #401 review F-1): the row drains both walker streams before classifying (shared ./stream-drain.mjs), and the drain verdict now names an already-terminal stream instead of paying the bound',
  },
  'glob-backend.mjs': {
    sha256: 'ee1006d55af725eca823760c9aaba766ccfdbdec189f9022dfdad1bb0de608af',
    why: '2026-10-26 u7-grep-drain: the glob row\'s stdout watch, streams drain and record fuse ride the same shared drain helper (behaviour unchanged), and GLOB_STDERR_DRAIN_MS became an alias of the one bound',
  },
  'cancel-leg.mjs': {
    sha256: '90233b20a2fd7a11ee29408f9a78537a749b888f27197dbf51c6d84ae482e2da',
    why: 'unchanged since the move commit b720fa8f6 (control: this digest equals the move blob\'s)',
  },
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
  it('M1 the moved mechanics region is byte-identical to master plane-effect-backends.mjs:107-318; the archived candidate tail :319-539 is retired', () => {
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
    // U7-G6b: the region now ends where the archived CANDIDATE-A glob
    // factory's doc block begins (master :319); that tail is RETIRED, and
    // its absence is pinned below — never a silent partial match.
    const retiredMark = '/**\n * THE glob row (GLUE-7 scope probe -> PR5 commitment)'
    const retired = master.indexOf(retiredMark, start)
    expect(retired, 'retired-tail marker (master)').toBeGreaterThan(start)
    expect(retired, 'the retired tail sits inside the moved region').toBeLessThan(end)
    expect(master.slice(0, retired).split('\n').length).toBe(319)
    const region = master.slice(start, retired).replace(/\n+$/, '\n')
    const lane = read(MECHANICS)
    expect(lane.includes('export function createAnchoredGlobBackend'), 'the archived candidate factory is retired').toBe(false)
    expect(lane.includes(retiredMark), 'no part of the retired tail survives').toBe(false)
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
      const moved = gitShow(`packages/tools/search-family/src/${name}`, MOVE_SHA)
      expect(moved, `${name}: exactly the declared deltas`).toBe(applyDeclaredDeltas(master, name))
      // Non-vacuity: the lane file is still the moved file (it exists and still
      // carries the lane provenance tag), not a deleted or replaced one.
      expect(read(rel), `${name}: the lane file is gone`).toContain(` * @module search-family/${name.replace(/\.mjs$/, '')}`)
    }
  })

  it('M3 no dual ledger: the center defines nothing, the hub is deleted, and the old files are gone', () => {
    // (a) the old center files are deleted from the index (not just moved
    //     in the worktree — a surviving tracked copy IS the dual ledger).
    const tracked = execFileSync('git', ['ls-files', 'packages/runtime/src/plugin/live'], { cwd: process.cwd(), encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
    for (const gone of ['search-backend.mjs', 'glob-backend.mjs', 'cancel-leg.mjs']) {
      expect(tracked.some((t) => t.endsWith(`live/${gone}`)), `${gone} still tracked under live/`).toBe(false)
      expect(existsSync(abs(`../src/plugin/live/${gone}`)), `${gone} still on disk under live/`).toBe(false)
    }
    // (b) U6 PR6: the center hub is DELETED outright. Its seven blocks had
    //     become PURE re-export edges (every body already in a family lane)
    //     and the plane mounts the lanes directly, so the hub lost its last
    //     importer — nothing of the search surface survives at the center,
    //     not even as an export edge: no file, no tracked copy.
    expect(existsSync(abs(PLANE_PEB)), 'the center hub .mjs is deleted').toBe(false)
    expect(existsSync(abs(PLANE_PEB_DTS)), 'the center hub .d.mts is deleted').toBe(false)
    for (const rel of [
      'packages/runtime/src/plugin/live/plane-effect-backends.mjs',
      'packages/runtime/src/plugin/live/plane-effect-backends.d.mts',
    ]) {
      expect(trackedPresent(rel), `${rel} is not tracked any more`).toEqual([])
    }
    // Non-vacuity: the SAME check does see a tracked live row, so the empty
    // answers above mean absence, not a blind pathspec or a wrong cwd.
    expect(trackedPresent('packages/runtime/src/plugin/live/jobs-family-bridge.mjs'))
      .toEqual(['packages/runtime/src/plugin/live/jobs-family-bridge.mjs'])
    // (c) the rows are assembled THROUGH the lane (never an inline copy).
    // u7-w0b S3 (disclosed interface update): the plane no longer names the
    // search family at all — the family's FamilyAssembly descriptor
    // (packages/tools/families/search.mjs) imports the lane face, and the
    // plane mounts the descriptor through the generic seam.
    const plane = read('../src/plugin/live/team-tool-plane.mjs')
    const descriptor = read('../../tools/families/search.mjs')
    expect(descriptor.includes("from '../search-family/src/search-mechanics.mjs'"), 'the descriptor imports the lane face').toBe(true)
    expect(plane.includes('search-family'), 'the plane names no search-family module').toBe(false)
    expect(plane.includes('function grepArgv'), 'the plane defines no local copy').toBe(false)
    expect(descriptor.includes('function grepArgv'), 'the descriptor defines no local copy').toBe(false)
  })

  it('M5 the CURRENT lane bytes match the reviewed digest ledger (an unexplained change is a RED)', () => {
    const seen: string[] = []
    for (const [name, entry] of Object.entries(LANE_DIGESTS)) {
      const actual = createHash('sha256').update(readFileSync(abs(`../../tools/search-family/src/${name}`))).digest('hex')
      expect(actual, `${name}: the lane bytes changed with no reviewed ledger entry — record the new sha256 in LANE_DIGESTS with WHY, in this commit`).toBe(entry.sha256)
      expect(entry.why.length, `${name}: the ledger entry must say why it is these bytes`).toBeGreaterThan(20)
      seen.push(name)
    }
    // Non-vacuity: the ledger covers the two moving rows AND the untouched one,
    // and it really does read the working tree (a digest that matched nothing
    // would pass every file). The move-blob digests differ from the current ones
    // for exactly the files this lane changed in place.
    expect(seen.sort()).toEqual(['cancel-leg.mjs', 'glob-backend.mjs', 'search-backend.mjs'])
    const movedCancel = createHash('sha256').update(gitShow('packages/tools/search-family/src/cancel-leg.mjs', MOVE_SHA)).digest('hex')
    expect(movedCancel, 'cancel-leg.mjs is not the move blob: either it changed (add its new digest) or the control is broken').toBe(LANE_DIGESTS['cancel-leg.mjs']!.sha256)
    for (const name of ['search-backend.mjs', 'glob-backend.mjs']) {
      const moved = createHash('sha256').update(gitShow(`packages/tools/search-family/src/${name}`, MOVE_SHA)).digest('hex')
      expect(moved, `${name} still equals its move blob: the ledger would be vacuous for it`).not.toBe(LANE_DIGESTS[name]!.sha256)
    }
  })

  it('M4 the dist mirror carries the lane files (the dist-glue law)', () => {
    for (const name of ['index.mjs', 'search-mechanics.mjs', 'search-backend.mjs', 'glob-backend.mjs', 'cancel-leg.mjs', 'search-row.mjs', 'search-contribution.mjs']) {
      const distPath = abs(`../dist/packages/tools/search-family/src/${name}`)
      expect(existsSync(distPath), `dist placement missing: ${name}`).toBe(true)
      expect(readFileSync(distPath, 'utf8').length, `dist placement empty: ${name}`).toBeGreaterThan(0)
    }
  })
})
