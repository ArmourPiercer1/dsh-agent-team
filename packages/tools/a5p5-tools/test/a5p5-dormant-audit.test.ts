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
  // Census-race hardening (measured 2026-10-17, census capture on the
  // nine-root run): other suites CREATE AND DELETE volatile worlds under
  // packages/ WHILE this walk runs (e.g. packages/testkit/test/.tmp-fault/…,
  // cleared by the census runner before the run but recreated mid-run by the
  // fault-injection suite), and a plain readdirSync then crashes with ENOENT
  // on a directory that vanished between readdir and scandir. A crashed walk
  // is an instrument failure, not a verdict — this gate's own vocabulary
  // keeps those apart ("an instrument that is killed before reporting is a
  // refusal"). Skipping a path that vanished mid-scan cannot soften the law:
  // the offenders this audit grades are COMMITTED files, and a committed
  // file never disappears under a census. Every present path is still
  // scanned, and every still-ENOENT-unreadable present file is read again
  // with the throw intact below.
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
    throw err
  }
  for (const entry of entries) {
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
/**
 * Third entry (GLUE-2 round, gap C-11, coordinator queue — THIS is the
 * header's "enters review as its own change" moment, and the reviewed
 * integration it names is REAL and SAME-ROUND: root vitest collection and
 * the compile face landed together, per the WIRING-SURFACE disclosure that
 * the moves may not be split). `packages/tools/tsconfig.build.json` now
 * carries one bare include entry naming the lane's src directory — the
 * production COMPILE FACE (emit), not an import and not a barrel entry;
 * the leg below pins that form: every lane-naming line in that file is
 * the quoted include string and nothing else. The SHIPPED face this audit
 * guards is UNCHANGED: the barrel still does not know the lane (its own
 * leg, untouched), no outside file imports the lane, and the emitted
 * `dist` — a derived mirror of files this walk already reads — stays
 * outside the walk by the header's own rule.
 */
/**
 * Fourth entry (GLUE-5 production-assembly round, alpha5-glue5-entry):
 * `packages/runtime/tsconfig.build.json` carries the same bare include
 * shape as the tools entry, aimed at the COMMITTED install-surface mirror —
 * the production emit face for the live row's dist import edge. Same law:
 * a compile-face name is not an import; the leg below pins the one-line
 * form. The live row's REAL edge is NOT here — it is the REVIEWED_EDGE
 * exception below, separately pinned and separately disclosed.
 */
/**
 * Fifth entry (a5glb glob-backend lane, 2026-10-18): the glob row's PARITY spec
 * `runtime/test/alpha5-glob-backend.test.ts` reads `a5p5-tools/src/register.ts`
 * from disk to pin that the glob backend's argv equals what the lane's own
 * registration face feeds the host argument law (leg P0). It is a NAME, not an
 * edge: the file reads the source text, imports nothing from the lane, and its
 * pinned form is one quoted packages-relative path inside one `readFileSync`
 * call (the leg below). Nothing about the barrel, the mount or the per-scope
 * judgement moves — this audit keeps every one of its teeth; an unnamed new
 * reference is still a red.
 *
 * Sixth entry (a5srgp search row, alpha5-srgp): `runtime/test/alpha5-search-backend.test.ts`
 * is the search row's PARITY spec and cites the lane's argument law by NAME
 * (`src/args.ts:148-149`) when it pins which knobs the row refuses and why, plus
 * one packages-relative path it reads from disk to pin the RED control's argv
 * form. Again a NAME, not an edge: no import of the lane, nothing about the
 * barrel, the mount or the per-scope judgement moves.
 */
/**
 * u7-w0 (2026-10-26): the p4t6 census's per-lane lists moved out of the
 * test file above into `testkit/test/p4t6-bookings/<lane>.json` (one file per
 * lane, collected by enumeration). Same NAMES-ONLY category as the census
 * file itself: JSON data that imports nothing. Directory-scoped and
 * shape-exact (`<lane>.json` directly in that directory only) — the leg
 * "the p4t6 census names the lane ONLY as quoted ledger paths" pins every
 * lane-naming line inside them to one quoted path entry.
 */
const isP4t6Booking = (rel: string): boolean => /^testkit\/test\/p4t6-bookings\/[a-z0-9][a-z0-9-]*\.json$/.test(rel.split(sep).join('/'))

const NAMES_ONLY_LEDGER_EXCEPTIONS: readonly string[] = ['testkit/test/p4t6-session-event-scan.test.ts', 'domain/test/a5p0-layer-audit.test.ts', 'tools/tsconfig.build.json', 'runtime/tsconfig.build.json',
  'runtime/test/alpha5-glob-backend.test.ts', 'runtime/test/alpha5-search-backend.test.ts',
  // Seventh entry (A5-B2 exit-code fidelity, branch `alpha5-b2-rc-pr`): this spec names
  // the lane in exactly ONE comment line, citing `render.ts:183-184` as the location of a
  // renderer branch it proves unreachable through the shell row — the citation is the
  // leg's content, not decoration. Weaker than entries five and six, not stronger: it
  // reads NO lane source from disk (its readFileSync calls open two natexe capture logs
  // and the launcher it spawns) and imports nothing from the lane
  // (`../sandbox-provider/index.js` only). Zero barrel, zero mount, zero glue; the
  // barrel, the mount and the per-scope judgement keep every tooth.
  'runtime/test/a5b2-exit-code-fidelity.test.ts',
   // Eighth entry (A5-B3 cancel leg, branch `alpha5-b3-cancel-pr`): this spec names
   // the lane in TWO comment lines of its header — the pre-B3 `makeExecute` shape at
   // `packages/tools/a5p5-tools/src/register.ts` and the renderer branch at
   // `packages/tools/a5p5-tools/src/render.ts:183-184` whose reachability through the
   // shipped shell row is exactly what its legs measure. Both citations ARE the leg
   // content, not decoration. Weaker than entries five through seven, not stronger:
   // it reads NO lane source from disk (readFileSync opens only the launcher it
   // spawns) and imports nothing from the lane (`../sandbox-provider/index.js`, and
   // the plane row `../src/plugin/live/team-tool-plane.mjs` dynamically — reached
   // through the same reviewed edge GLUE-5 booked). Zero barrel, zero mount, zero
   // glue; the barrel, the mount and the per-scope judgement keep every tooth.
   'runtime/test/a5b3-cancel-leg.test.ts']

/**
 * The REVIEWED-EDGE exception (alpha5-glue5-entry, GLUE-5 production-assembly
 * round — THE header moment, and bigger than the three names above: this is
 * the first outside file that IMPORTS the lane). `team-tool-plane.mjs` is the
 * governed Team tool plane's placement row: a per-scope live row that mounts
 * ONLY behind a permissions-carrying template with a host-configured plane
 * row (a non-team session never executes it), placed on the Q4/R1 placement
 * route. The dormancy law it retires is exactly "the lane is shipped dark";
 * what it must NOT retire — the closed barrel, the zero global mount, the
 * per-scope judgement — the legs below keep pinning, and the edge itself is
 * form-pinned: ONE line, the barrel import, no deep import, no second edge,
 * no other file.
 */
const REVIEWED_EDGE_EXCEPTIONS: readonly string[] = ['runtime/src/plugin/live/team-tool-plane.mjs']

/**
 * TEST-ONLY EDGES — a THIRD kind, deliberately NOT folded into either list
 * above, and booked one path + one spelling at a time (A5-M1 / PR358-A1,
 * census run 39866646962 at headSha efecfe2b4).
 *
 * `runtime/test/a5-m1-correlation.test.ts:87` performs a DYNAMIC barrel
 * import of the lane —
 * `const reg = await import('../../tools/a5p5-tools/src/index.js')` — to
 * exercise the PR358-A1 execution-token correlation face (ONE real token
 * allocates ONE hexec correlation; in-flight and terminal replays refuse; a
 * stringy token never anchors) against the EMITTED-shape registration rather
 * than a re-spelled copy. It is a real reference, so it does not belong in
 * NAMES_ONLY_LEDGER_EXCEPTIONS (that list's contract is "a name without a
 * reference"); it is not a shipped edge, so it does not belong in
 * REVIEWED_EDGE_EXCEPTIONS (that list's contract is "a production row that
 * retired part of the dormancy law").
 *
 * What the permit buys is exactly one file and one line, both pinned by the
 * leg below: the entry is keyed to the path AND to the literal line, so a
 * second reference in that spec, a static import, a deep import past the
 * barrel, or the same shape appearing in any shipped path stays red. The
 * SHIPPED face keeps every tooth: the barrel stays closed, the global mount
 * stays zero, the per-scope judgement is untouched, and `dist`/production
 * never sees this file.
 */
const TEST_ONLY_EDGE_EXCEPTIONS: readonly { readonly path: string; readonly form: string }[] = [
  {
    path: 'runtime/test/a5-m1-correlation.test.ts',
    form: `const reg = await import('../../tools/a5p5-tools/src/index.js')`,
  },
  // U6 PR5 (disclosed law-surface update): the golden gate pins the
  // model-facing ROW grammar, which only this barrel carries — the plane
  // builds the placed rows from it (team-tool-plane.mjs:75). Same one-line
  // dynamic barrel form as the A5-M1 edge; the pinning leg below holds it
  // exactly as narrow.
  {
    path: 'runtime/test/u6-pr5-search-golden-vectors.test.ts',
    form: `const { parseGrepArgs, parseGlobArgs } = await import('../../tools/a5p5-tools/src/index.js')`,
  },
]

describe('a5p5-dormant-audit', () => {
  it('no shipped source outside the lane references a5p5-tools', () => {
    const offenders: string[] = []
    for (const file of walk(packagesRoot)) {
      const relativePath = relative(packagesRoot, file)
      const insideLane = file === laneRoot || file.startsWith(laneRoot + sep)
      if (insideLane) continue
      if (NAMES_ONLY_LEDGER_EXCEPTIONS.includes(relativePath)) continue
      if (isP4t6Booking(relativePath)) continue
      if (REVIEWED_EDGE_EXCEPTIONS.includes(relativePath)) continue
      // Path-EXACT, and only after the leg below has pinned the spelling: a
      // test file whose one dynamic barrel line drifted is an offender again.
      if (TEST_ONLY_EDGE_EXCEPTIONS.some((entry) => entry.path === relativePath)) continue
      let text: string
      try {
        text = readFileSync(file, 'utf8')
      } catch (err) {
        // Same mid-scan census race as the walk's: a transient file that
        // vanished after being listed is not committed content — skip it;
        // any other I/O error keeps throwing.
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw err
      }
      if (text.includes('a5p5-tools')) offenders.push(relativePath)
    }
    expect(offenders).toEqual([])
  })

  it('the one reviewed edge is exactly the live row barrel import, and nothing else', () => {
    // GLUE-5 (see the edge-exception list above): the form IS the contract.
    // The live row names the lane in EXACTLY one line — the barrel import of
    // the registration-face symbols — never a deep import into the lane's
    // internals, never a second lane string anywhere in the file. U6 PR3
    // (disclosed interface update, ARC-B part 2): the line carries the
    // shell-row face NEXT TO the trio face (two symbols, still ONE barrel
    // line, one file) — the process-family lane receives the transport
    // INJECTED from here, so no second consumer ever forms.
    const row = readFileSync(join(packagesRoot, 'runtime', 'src', 'plugin', 'live', 'team-tool-plane.mjs'), 'utf8')
    let namedLines = 0
    for (const line of row.split('\n')) {
      if (!line.includes('a5p5-tools')) continue
      namedLines += 1
      expect(line.trim(), line.trim()).toBe(`import { createGovernedShellRowDefinition, createGovernedToolDefinitions } from '../../../../tools/a5p5-tools/src/index.js'`)
    }
    expect(namedLines).toBe(1)
  })

  it('the A5-M1 correlation spec touches the lane ONLY as its one pinned dynamic barrel line', () => {
    // The TEST_ONLY edge (see the list above): the permit is one path AND one
    // spelling, so this leg is what makes the permit no wider than the fact.
    // EXACTLY one line in that spec may name the lane, it must be the pinned
    // `await import(...)` of the BARREL (`src/index.js` — never a deep import
    // into the lane's internals), and no static import / require / export of
    // the lane may appear anywhere in the file. Rename the file, grow it a
    // second reference, or turn the dynamic import into a static one and the
    // offender leg above is red again.
    for (const entry of TEST_ONLY_EDGE_EXCEPTIONS) {
      const spec = readFileSync(join(packagesRoot, ...entry.path.split('/')), 'utf8')
      let namedLines = 0
      for (const line of spec.split('\n')) {
        if (!line.includes('a5p5-tools')) continue
        namedLines += 1
        expect(line.trim(), `${entry.path}: ${line.trim()}`).toBe(entry.form)
      }
      expect(namedLines, `${entry.path} names the lane on exactly the pinned line`).toBe(1)
      for (const line of spec.split('\n')) {
        const trimmed = line.trim()
        expect(/^(import|export)\b.*a5p5-tools/.test(trimmed), `a static edge appeared in ${entry.path}: ${trimmed}`).toBe(false)
        expect(/require\(.*a5p5-tools/.test(line), `a require edge appeared in ${entry.path}: ${trimmed}`).toBe(false)
        // The pinned dynamic import is the barrel face; a `src/<other>.js`
        // specifier would be a deep import past the reviewed surface.
        if (!line.includes('a5p5-tools')) continue
        expect(trimmed, `the pinned form must address the barrel: ${trimmed}`).toContain('/a5p5-tools/src/index.js')
      }
      // …and the permit is test-scoped by SHAPE, not by trust: only a
      // `test/*.test.ts` file can ever qualify, so the same shape appearing
      // under `src/` (a shipped path) is an offender, not an exception.
      expect(entry.path, `a test-only permit must address a lane-local spec: ${entry.path}`).toMatch(/(?:^|\/)test\/[^/]+\.test\.ts$/)
    }
  })

  it('the p4t6 census names the lane ONLY as quoted ledger paths, never as an edge', () => {
    const ledger = readFileSync(join(packagesRoot, 'testkit', 'test', 'p4t6-session-event-scan.test.ts'), 'utf8')
    for (const line of ledger.split('\n')) {
      if (!line.includes('a5p5-tools')) continue
      expect(line.trim(), line.trim()).toMatch(/^'packages\/tools\/a5p5-tools\/[^']+',$/)
    }
    // u7-w0: the census's per-lane bookings moved into p4t6-bookings/*.json
    // (data, imports nothing). Same form law there: every line naming the
    // lane is ONE quoted path entry of a `paths` array, and at least one
    // booking still names it (the A5P5TOOLS booking) — a vacuous pass is RED.
    const bookingsDir = join(packagesRoot, 'testkit', 'test', 'p4t6-bookings')
    let named = 0
    for (const file of readdirSync(bookingsDir).filter((n) => n.endsWith('.json'))) {
      for (const line of readFileSync(join(bookingsDir, file), 'utf8').split('\n')) {
        if (!line.includes('a5p5-tools')) continue
        named += 1
        expect(line.trim(), `${file}: ${line.trim()}`).toMatch(/^"packages\/tools\/a5p5-tools\/[^"]+",?$/)
      }
    }
    expect(named).toBeGreaterThan(0)
  })

  it('the a5glb glob parity spec names the lane ONLY as one quoted read path, never as an edge', () => {
    // The fifth name-only booking (see the exception list above). Form is the
    // contract, same discipline as the four names before it: EXACTLY ONE line
    // in that spec carries the `a5p5-tools` path shape, it is a `readFileSync`
    // of one quoted packages-relative path (leg P0 pins argv parity against the
    // lane's registration face by reading its TEXT), and the file carries no
    // import/require edge to the lane of any shape.
    const spec = readFileSync(join(packagesRoot, 'runtime', 'test', 'alpha5-glob-backend.test.ts'), 'utf8')
    let namedLines = 0
    for (const line of spec.split('\n')) {
      if (!line.includes('a5p5-tools')) continue
      namedLines += 1
      expect(line.trim(), line.trim()).toMatch(/^const registerSource = readFileSync\(join\(REPO, 'packages\/tools\/a5p5-tools\/src\/register\.ts'\), 'utf8'\)$/)
    }
    expect(namedLines).toBe(1) // exactly the one parity read — if the spec grows a second reference, this trips
    for (const line of spec.split('\n')) {
      expect(/^(import|export)\b.*a5p5-tools/.test(line.trim()), `an import edge appeared: ${line.trim()}`).toBe(false)
      expect(/require\(.*a5p5-tools/.test(line), `a require edge appeared: ${line.trim()}`).toBe(false)
      expect(/from\s+'[^']*a5p5-tools/.test(line), `a module specifier appeared: ${line.trim()}`).toBe(false)
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
    expect(namedLines).toBe(7) // exactly the seven registered src consumers — if the pin drifts, this trips
    // (7th = src/register.ts, the PR4/5 registration face booked with review
    // #299@3668da59 in the a5p0 expected set, coordinator-authorized; the
    // form leg above keeps biting — the entry rides the same quoted-path line
    // shape, never an edge.)
  })

  it('the tools build tsconfig names the lane ONLY as the bare compile-face include, never as an edge', () => {
    // GLUE-2 release leg (see the exception list above for the moment):
    // the form IS the contract — one quoted directory include inside the
    // build `include` array, and EXACTLY one such line. A second entry, a
    // file-level include, or any prose wearing a path trips this pin; so
    // does any attempt to smuggle an import-shaped string into a JSONC
    // comment line that names the lane beyond the pinned entry (comments
    // may say "a5p5" but never carry the `a5p5-tools` path shape twice).
    const tsc = readFileSync(join(packagesRoot, 'tools', 'tsconfig.build.json'), 'utf8')
    let namedLines = 0
    for (const line of tsc.split('\n')) {
      if (!line.includes('a5p5-tools')) continue
      namedLines += 1
      expect(line.trim(), line.trim()).toMatch(/^"a5p5-tools\/src",?$/)
    }
    expect(namedLines).toBe(1) // exactly the one compile-face include entry
  })

  it('the runtime build tsconfig names the lane ONLY as the bare install-surface include, never as an edge', () => {
    // GLUE-5 (alpha5-glue5-entry): the runtime build project gained the
    // same-shape entry so the lane's emit rides the COMMITTED install-surface
    // mirror (the live row reaches the lane through dist, and dist is what
    // production runs — pb-CONTRACT §3). Form is the contract exactly like
    // the tools entry above: one quoted directory include, EXACTLY one line
    // naming the lane in the whole file.
    const tsc = readFileSync(join(packagesRoot, 'runtime', 'tsconfig.build.json'), 'utf8')
    let namedLines = 0
    for (const line of tsc.split('\n')) {
      if (!line.includes('a5p5-tools')) continue
      namedLines += 1
      expect(line.trim(), line.trim()).toMatch(/^"\.\.\/tools\/a5p5-tools\/src",?$/)
    }
    expect(namedLines).toBe(1)
  })

  it('the shared tools barrel still does not know the lane (explicit leg)', () => {
    const barrel = readFileSync(join(packagesRoot, 'tools', 'src', 'index.ts'), 'utf8')
    expect(barrel).not.toContain('a5p5')
  })
})
