/**
 * Alpha.6 PR2′ (Lane 2) — lane hygiene for `review-assignment`: what it may touch, who may consume it,
 * and what it may not reach for.
 *
 * The same three laws as PR0's and PR3′'s hygiene suites, re-established rather than inherited. The
 * reason for the duplication is recorded in those files and has not changed: every blind spot in the
 * shared helper would have been found by executing a planted file, and a helper shared between lanes
 * inherits every blind spot of the lane that wrote it.
 *
 *  1. **Dormant, measured not declared.** PR2′ ships a router that routes nothing and a fact family with
 *     no writer. The durable append needs the team's own lock, which is the protected centre's to give,
 *     so the writer is the named Center-Interface PR (PR-I1) and the importer set stays empty until then.
 *     A dark lane is only safe while it stays dark, so the importer set is walked from disk every run —
 *     with the per-package non-empty floor that PR3′'s round-5 review had to add after a walk reading
 *     zero files passed.
 *  2. **No reverse dependency on the protected centre, and no dependency on PR3′.** The router will
 *     eventually be driven from the live plugin plane; that direction is allowed. What is not allowed is
 *     this lane importing the ARC-A digest-pinned decision core, nor importing `review-wake`: PR2′ and
 *     PR3′ are separate PRs with separate reviews, and a merge order must never be smuggled in through
 *     an import.
 *  3. **In the compile face, and pure.** Both tsconfigs must name the lane — measured rather than
 *     assumed, because for the first hour of this work package the lane was NOT in `tsconfig.json` and
 *     `tsc --listFilesOnly` printed every file of the two earlier lanes and none of this one. And the
 *     module set may import only the shared contracts, PR0's frozen vocabulary, and each other: no host,
 *     no clock, no I/O.
 *
 * Leg 8 is the one a reviewer should read first: it pins that this lane booked its fact types into the
 * FROZEN eight categories and added no ninth. A ninth category would silently break
 * `totalEntries == sum(byCategory)` for every projection read in the repo, and the ledger cannot be
 * rewritten afterwards.
 */

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LANE_DIR = join(RUNTIME_ROOT, 'review-assignment')
const PACKAGES_ROOT = join(RUNTIME_ROOT, '..')

/** Production consumers of the assignment lane. Empty by design: the durable writer is PR-I1, and that
 *  PR arrives with its own Center-Interface ledger entry, its own tests, and this list amended in the
 *  same change that adds the first importer. */
const ALLOWED_CONSUMERS: readonly string[] = []

const FOUNDING_MODULES = ['facts.ts', 'handoff.ts', 'index.ts', 'router.ts', 'types.ts']

/** A new module in this lane is a deliberate amendment, named in the PR that adds it. */
const EXTRA_MODULES_ALLOWED: readonly string[] = []

const PROTECTED_PREFIXES = [
  `control${sep}`,
  `operation-permission${sep}`,
  `tool-admission${sep}`,
  `tool-dispatch${sep}`,
  join('src', 'plugin', 'live', 'pa-mount-registry.mjs'),
  join('src', 'plugin', 'live', 'agent-bindings.mjs'),
  `governance-center${sep}`,
]

/** `.tsx` and the per-package floor exist because PR3′'s round-5 review planted an importer in
 *  `alpha/src/offender.tsx` and in an empty package directory, and the leg stayed green both times. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.cjs', '.js']
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'composition-shim', 'coverage'])

/** Sibling suites (f3a/f3b/f3c, po-notify) create and destroy scratch under
 *  `packages/testkit/test/.tmp-fault`, which this walk crosses on every full-repo run. Treating "gone" as
 *  "gone" is not a weakened assertion — a file that no longer exists imports nothing — while anything
 *  OTHER than gone still throws, because a real filesystem problem must not look like success. */
const VANISHED = { count: 0 }

function isGoneError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP'
}

function sourceFiles(root: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch (error) {
    if (isGoneError(error)) {
      VANISHED.count += 1
      return out
    }
    throw error
  }
  for (const entry of entries) {
    const full = join(root, entry)
    let isDirectory = false
    try {
      isDirectory = statSync(full).isDirectory()
    } catch (error) {
      if (isGoneError(error)) {
        VANISHED.count += 1
        continue
      }
      throw error
    }
    if (isDirectory) {
      if (SKIPPED_DIRECTORIES.has(entry)) continue
      out.push(...sourceFiles(full))
      continue
    }
    if (entry.endsWith('.d.ts')) continue
    if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) out.push(full)
  }
  return out
}

/** Read a file a concurrent suite may delete between listing and open. Used only for FOREIGN trees; the
 *  lane's own files are read strictly, because a missing founding module must fail loudly rather than
 *  vanish into an empty string. */
function readIfPresent(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch (error) {
    if (isGoneError(error)) {
      VANISHED.count += 1
      return null
    }
    throw error
  }
}

/**
 * Which specifiers count as "imports the lane", and how that question is answered.
 *
 * The first version was ONE regex that enumerated the five lane module names inside a quoted string. The
 * review of #507 (F-9) showed four ways past it, all real and none of them exploited at head:
 *  - capture was single-quoted, so `from "…"` and ``import(`…`)`` were invisible;
 *  - a query-suffixed specifier (`'…index.js?v=2'`, what a bundler or a cache-buster emits) did not match
 *    the `.js'?` tail;
 *  - a specifier naming a module the regex did not enumerate — `'../review-assignment/ports.js'`, the
 *    shape a 6th lane module would have — escaped completely, so `EXTRA_MODULES_ALLOWED` could grow
 *    without this detector ever learning the new name;
 *  - an alias or absolute specifier (`'@lane/review-assignment/index.js'`) matched nothing because the
 *    pattern demanded a quote immediately before the path.
 * So: extract every specifier first (three quote styles, static and dynamic), strip the query/hash, then
 * ask TWO independent questions about it — does it name the lane as a path segment anywhere in its text
 * (this is what closes the 6th-module hole: no enumeration), and does it RESOLVE into the lane directory
 * from the importing file (this is what catches a specifier that reaches the lane without naming it in one
 * piece). Either answer is enough to be an offender. The enumeration is gone, so there is nothing here to
 * forget to amend when the module list changes.
 *
 * Round-2 review (NF-2) added a fifth form and, more usefully, named the limit this detector cannot cross.
 * `createRequire(import.meta.url)('../review-assignment/index.js')` is a full literal path to the lane and
 * the first pattern did not see it, because every alternative demanded a module-keyword immediately before
 * the quote; the `createRequire` alternative below is what closes that one. What no lexical floor can see
 * is a specifier that is not a literal at the call site — `const p = '../review-assignment/index.js'`
 * called through a variable, a concatenated or interpolated path, or a re-export rewritten by a bundler.
 * That limit is STATED rather than papered over, and pinned by its own leg, because a dormancy claim that
 * quietly exceeds the instrument backing it is the same class of defect as a doc block that says
 * "no production caller" when there is one.
 */
const SPECIFIER_PATTERN =
  /(?:\bcreateRequire\s*\([^)]*\)\s*\(\s*|\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)['"`]([^'"`\n]+)['"`]/g

/** Every module name the lane may contain, as specifier stems — derived, never restated. */
const LANE_MODULE_STEMS = [...FOUNDING_MODULES, ...EXTRA_MODULES_ALLOWED].map((module) => module.replace(/\.ts$/, ''))

function specifiersOf(source: string): string[] {
  const out: string[] = []
  for (const match of source.matchAll(SPECIFIER_PATTERN)) {
    const raw = match[1]
    if (raw === undefined) continue
    out.push(raw.split(/[?#]/)[0] as string)
  }
  return out
}

function specifierEntersLane(fromFile: string, specifier: string): boolean {
  if (/(^|[/\\])review-assignment([/\\]|$)/.test(specifier)) return true
  if (!specifier.startsWith('.')) return false
  const target = resolve(dirname(fromFile), specifier)
  return target === LANE_DIR || target.startsWith(LANE_DIR + sep)
}

function sourceEntersLane(fromFile: string, source: string): boolean {
  return specifiersOf(source).some((specifier) => specifierEntersLane(fromFile, specifier))
}

describe('a6-pr2 lane hygiene', () => {
  it('the lane is a real module set, not a vocabulary dump', () => {
    const files = sourceFiles(LANE_DIR).map((file) => relative(LANE_DIR, file)).sort()
    for (const required of FOUNDING_MODULES) {
      expect(files, `the lane is missing ${required}`).toContain(required)
    }
    expect(files.filter((file) => !FOUNDING_MODULES.includes(file))).toEqual([...EXTRA_MODULES_ALLOWED])
  })

  it('exports one encoder, one decoder and one fold — no second writer of the durable row', () => {
    // The durability argument for this lane is: one module owns the row shape, and every other module
    // goes through it. If a second exported encoder appeared, the CAS/authority checks would become
    // optional depending on which door a writer chose — the same class of defect PR3′'s round-5 review
    // caught with a planted `altSlotRowKey`.
    const facts = readFileSync(join(LANE_DIR, 'facts.ts'), 'utf8')
    const exported = [...facts.matchAll(/^export (?:function|const) (\w+)/gm)].map((match) => match[1] as string).sort()
    expect(exported).toEqual([
      'REVIEW_ASSIGNMENT_PAYLOAD_FIELDS',
      'checkAssignmentMutation',
      'decodeAssignmentPayload',
      'encodeAssignmentFact',
      'foldReviewAssignmentRows',
      'isReviewAssignmentFactType',
      'maySubmitFor',
      'supersededTargetsOf',
    ])
    expect(exported.filter((name) => /^encode/.test(name))).toEqual(['encodeAssignmentFact'])
    expect(exported.filter((name) => /^decode/.test(name))).toEqual(['decodeAssignmentPayload'])
    // The handoff lane cannot write anything by itself: it exposes planning functions only.
    const handoff = readFileSync(join(LANE_DIR, 'handoff.ts'), 'utf8')
    expect([...handoff.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1] as string).sort()).toEqual([
      'planHandoff',
      'planRetirement',
    ])
  })

  it('is DORMANT: no production file outside the lane imports it yet', () => {
    const offenders: string[] = []
    const packages = readdirSync(PACKAGES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(packages.length).toBeGreaterThan(0)
    for (const pkg of packages) {
      const files = sourceFiles(join(PACKAGES_ROOT, pkg))
      // The floor that makes this leg non-vacuous (measured on this tree: runtime 827 source files,
      // testkit 342, smallest package 20). Without it, a renamed package, a wrong PACKAGES_ROOT, a
      // subtree swallowed by a symlink loop, or an extension filter too narrow to see anything all
      // produce a green "no offenders".
      expect(files, `the dormancy walk found no source file inside ${pkg}`).not.toHaveLength(0)
      for (const file of files) {
        const rel = relative(PACKAGES_ROOT, file)
        if (rel.startsWith(join('runtime', 'review-assignment') + sep)) continue
        if (rel.includes(`${sep}test${sep}`) || rel.includes(`${sep}tests${sep}`) || rel.includes('.spec.')) continue
        if (sourceEntersLane(file, readIfPresent(file) ?? '')) offenders.push(rel)
      }
    }
    expect(offenders).toEqual([...ALLOWED_CONSUMERS])
  })

  // Every control below is fed to `sourceEntersLane`, the SAME function the dormancy walk uses — a
  // detector tested through a different code path than production is a detector tested in pretend.
  const IMPORTER = join(PACKAGES_ROOT, 'runtime', 'src', 'importer.ts')

  it.each<[string, string]>([
    ['a plain TypeScript importer', `import { routeReviewCase } from '../review-assignment/index.js'`],
    ['an extensionless importer', `import { routeReviewCase } from '../review-assignment/index'`],
    ['a bare directory import', `import * as assignment from '../review-assignment'`],
    ['a live-plane .mjs importer', `import { foldReviewAssignmentRows } from '../review-assignment/index.js'`],
    ['a sibling-module import', `import { encodeAssignmentFact } from './review-assignment/facts.js'`],
    ['a dynamic import', `const lane = await import('../review-assignment/router.js')`],
    ['a contracts-package importer', `import { planHandoff } from '../../runtime/review-assignment/handoff.js'`],
    // The four forms review F-9 measured as escapes:
    ['a double-quoted importer', `import { routeReviewCase } from "../review-assignment/index.js"`],
    ['a backticked dynamic import', 'const lane = await import(`../review-assignment/index.js`)'],
    ['a query-suffixed specifier', `import { routeReviewCase } from '../review-assignment/index.js?v=2'`],
    ['an aliased or absolute specifier', `import { planHandoff } from '@dsh/runtime/review-assignment/handoff.js'`],
    // A 6th lane module. Nothing in the detector enumerates module names any more, so this needs no
    // amendment when `EXTRA_MODULES_ALLOWED` grows — which is the whole point of deriving it.
    ['a module that does not exist yet', `import { openAssignment } from '../review-assignment/ports.js'`],
    // Round-2 review NF-2: a full literal lane path through CommonJS interop, with no keyword adjacent to
    // the quote at all.
    ['a createRequire importer', `const lane = createRequire(import.meta.url)('../review-assignment/index.js')`],
    ['a require via a local alias', `const lane = require('../review-assignment/index.js')`],
    ['every founding module, by stem', LANE_MODULE_STEMS.map((stem) => `import * as m from '../review-assignment/${stem}.js'`).join('\n')],
  ])('the dormancy detector catches %s (positive control)', (_label, sample) => {
    expect(sourceEntersLane(IMPORTER, sample)).toBe(true)
  })

  it('the dormancy detector does not fire on unrelated text (negative control)', () => {
    expect(sourceEntersLane(IMPORTER, "import { evaluateReviewAdmission } from '../review-mandate/index.js'")).toBe(false)
    expect(sourceEntersLane(IMPORTER, '// review-assignment is dormant until PR-I1')).toBe(false)
    // Prose, a doc path, and a near-miss directory must not be enough — otherwise "no offenders" is
    // simply a detector that gave up.
    expect(sourceEntersLane(IMPORTER, "const doc = 'packages/runtime/review-assignment/README.md'")).toBe(false)
    expect(sourceEntersLane(IMPORTER, "import { x } from '../review-assignments/index.js'")).toBe(false)
    expect(sourceEntersLane(IMPORTER, "import { x } from '../review-mandate/facts.js'")).toBe(false)
  })

  it('states the escape its own detector cannot see, instead of claiming a floor it is not', () => {
    // Round-2 review NF-2, second half. `createRequire(import.meta.url)('../review-assignment/index.js')`
    // is catchable because the path is a literal next to a call. This is not:
    //
    //     const p = '../review-assignment/index.js'
    //     const lane = createRequire(import.meta.url)(p)
    //
    // No pattern over source text can prove what a variable holds, so the detector is a FLOOR for literal
    // specifiers, not a proof of dormancy. The proof of dormancy is the walk finding no offender together
    // with the two `ALLOWED_CONSUMERS` lists being honest about what is allowed; this leg exists so a
    // reader is not misled by the word "every", and so the boundary cannot silently drift into a promise.
    expect(sourceEntersLane(IMPORTER, "const p = '../review-assignment/index.js'\nconst lane = createRequire(import.meta.url)(p)")).toBe(false)
    // The limit is written down where a maintainer meets the detector, not only here.
    expect(readFileSync(join(RUNTIME_ROOT, 'test', 'a6-pr2-lane-hygiene.test.ts'), 'utf8')).toMatch(
      /no lexical floor|STATED rather than papered over/,
    )
    // And the literal form next to the call IS caught, so the floor holds where it can.
    expect(sourceEntersLane(IMPORTER, "const lane = createRequire(import.meta.url)('../review-assignment/index.js')")).toBe(true)
  })

  it('imports NOTHING from the ARC-A protected centre, and NOTHING from PR3′', () => {
    for (const file of sourceFiles(LANE_DIR)) {
      const text = readFileSync(file, 'utf8')
      for (const prefix of PROTECTED_PREFIXES) {
        expect(text, `${relative(RUNTIME_ROOT, file)} must not import the protected ${prefix}`).not.toContain(`../${prefix}`)
        expect(text, `${relative(RUNTIME_ROOT, file)} must not import the protected ${prefix}`).not.toContain(`./${prefix}`)
      }
      // PR3′ is a different PR with a different review. Delivery of a wake is PR-I2's decision, and this
      // lane must not even be able to name it, so that no merge order between #503 and this PR can be
      // smuggled in through an import edge.
      expect(text, `${relative(RUNTIME_ROOT, file)} must not import review-wake`).not.toMatch(/review-wake/)
    }
  })

  it('is named by both tsconfigs, so a repo-wide tsc and the install surface both read it', () => {
    for (const config of ['tsconfig.json', 'tsconfig.build.json']) {
      const text = readFileSync(join(RUNTIME_ROOT, config), 'utf8')
      expect(text, `${config} must include the lane`).toContain('"review-assignment"')
    }
    // The build config stays parseable by a plain JSON reader: a comment in it broke a master-green
    // suite in PR0 round 1, so the constraint is pinned here rather than remembered.
    expect(() =>
      JSON.parse(readFileSync(join(RUNTIME_ROOT, 'tsconfig.build.json'), 'utf8').replace(/:\/\/.*/g, '')),
    ).not.toThrow()
  })

  it('booked its facts inside the frozen eight categories and added no ninth', () => {
    // The category choice is tested for correctness in the kernel spec; this leg pins the shape of the
    // contract that choice had to fit inside. A ninth category would break `totalEntries ==
    // sum(byCategory)` on every projection read, and an append-only ledger cannot be re-filed afterwards.
    const states = readFileSync(join(RUNTIME_ROOT, '..', 'contracts', 'src', 'projection', 'states.ts'), 'utf8')
    // An object literal, not an array — pinned by reading the contract, not by remembering it. The
    // first draft of this leg grepped for `= [ ... ]`, matched nothing, and would have been a green
    // leg that read no categories at all were it not for the explicit null check below it.
    const block = /LEDGER_CATEGORIES\s*=\s*\{([\s\S]*?)\n\}/.exec(states)
    expect(block, 'LEDGER_CATEGORIES moved or renamed — re-read the contract').not.toBeNull()
    const categories = [...(block?.[1] ?? '').matchAll(/^\s*[a-zA-Z]+:\s*'([a-z]+)'/gm)].map((match) => match[1] as string)
    expect(categories).toHaveLength(8)
    // Anti-vacuity for the regex above: the eight names are listed, so a pattern that reads nothing
    // cannot pass.
    expect([...categories].sort()).toEqual(['compatibility', 'control', 'lifecycle', 'member', 'message', 'policy', 'progress', 'team'])
    expect(new Set(categories).size).toBe(8)
    expect(categories).toContain('team')
    expect(categories).not.toContain('assignment')
    expect(categories).not.toContain('review')
  })

  it('performs no I/O and reads no clock: only contracts, PR0 and itself', () => {
    // Sibling specifiers are DERIVED from the module list, so the closed set lives in exactly one place
    // (`FOUNDING_MODULES` + `EXTRA_MODULES_ALLOWED`, leg 1) and this floor cannot drift behind it.
    const allowed = new RegExp(
      `^(?:\\.\\./\\.\\./contracts/src/index\\.js|\\.\\./review-mandate/index\\.js|\\./(?:${LANE_MODULE_STEMS.join('|')})\\.js)$`,
    )
    let laneSpecifiers = 0
    for (const file of sourceFiles(LANE_DIR)) {
      const text = readFileSync(file, 'utf8')
      // `specifiersOf`, not a single-quoted regex: review F-9 measured that `from "node:os"` escaped the
      // first version of this leg entirely, so the floor it advertised did not exist for double quotes.
      const specifiers = specifiersOf(text)
      laneSpecifiers += specifiers.length
      for (const specifier of specifiers) {
        expect(allowed.test(specifier), `${relative(RUNTIME_ROOT, file)} imports ${specifier}, outside the pure-lane allow-list`).toBe(true)
      }
      expect(text).not.toMatch(/Date\.now\(/)
      expect(text).not.toMatch(/new Date\(\s*\)/)
      expect(text).not.toMatch(/performance\.now|process\.hrtime/)
      expect(text).not.toMatch(/setTimeout|setInterval|setImmediate/)
      expect(text).not.toMatch(/\brequire\s*\(/)
      expect(text).not.toMatch(/\bimport\s*\(/)
      // A word floor, deliberately redundant with the allow-list above: an entropy source, a clock, a
      // filesystem or a network handle must be refused even by a reader who never worked out that the
      // string around it was a specifier (`node:crypto` was in PR3′'s allow-list because ITS lane derives
      // wake ids; PR2′ has no such need and does not get its neighbour's permission by inheritance).
      expect(text).not.toMatch(
        /readFileSync|writeFileSync|process\.env|process\.argv|fetch\(|node:fs|node:net|node:http|node:os|node:crypto|node:vm|node:dgram|node:tls|node:dns|node:worker_threads|child_process|randomUUID|crypto\.getRandomValues/,
      )
    }
    // Anti-vacuity, and the two dependencies the lane is allowed to have: the frozen lifecycle
    // vocabulary comes from contracts, and the admission gate comes from PR0.
    expect(laneSpecifiers).toBeGreaterThanOrEqual(8)
    expect(readFileSync(join(LANE_DIR, 'types.ts'), 'utf8')).toContain("from '../../contracts/src/index.js'")
    expect(readFileSync(join(LANE_DIR, 'router.ts'), 'utf8')).toContain("from '../review-mandate/index.js'")
    // The capture is not silently blind to the quote style it did not use: a double-quoted import inside
    // the lane must be SEEN by this leg (and therefore judged by `allowed`), or the floor is a single
    // quote style deep. Measured: the lane writes single quotes today, so this control feeds the
    // detector a double-quoted line of the lane's own shape and requires it to be captured.
    expect(specifiersOf(`import { x } from "../review-mandate/index.js"`)).toEqual(['../review-mandate/index.js'])
    expect(specifiersOf('const p = await import(`./facts.js?v=2`)')).toEqual(['./facts.js'])
  })

  it('the trees OUTSIDE packages/ are watched too, and the shipped build outputs import nothing', () => {
    // Review F-9(d): the dormancy walk's roots were `packages/*`, so a repo-root `scripts/` glue file — the
    // exact place a "temporary" wiring tends to appear — was outside the law. F-9(c): the same walk skips
    // `dist/` and `composition-shim/` at any depth, which is correct for a SOURCE walk but meant nobody
    // had ever asked what the tracked build outputs import. Both gaps are closed as assertions, not as
    // comment promises.
    const repoRoot = join(PACKAGES_ROOT, '..')
    const roots: readonly (readonly [string, boolean])[] = [
      [join(repoRoot, 'scripts'), true],
      // `tests/` is walked at its top level only: `tests/deepseek-harness-test-use` is a pristine upstream
      // runtime checkout and `tests/homes` is a forest of live worlds, both gitignored, both enormous, and
      // neither is a place this plugin's consumers can live. Top-level `tests/*.mjs` is infrastructure glue
      // and is watched.
      [join(repoRoot, 'tests'), false],
    ]
    for (const [root, recursive] of roots) {
      const files = recursive ? sourceFiles(root) : readdirSync(root).map((entry) => join(root, entry)).filter((entry) => SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension)))
      expect(files, `the outside walk found no file under ${relative(repoRoot, root)}`).not.toHaveLength(0)
      for (const file of files) {
        expect(sourceEntersLane(file, readIfPresent(file) ?? ''), `${relative(repoRoot, file)} imports the assignment lane`).toBe(false)
      }
    }

    // The shipped lane: exactly the founding modules, and nothing in the rest of the tracked output reaches
    // it. This is the install-surface counterpart of the source walk.
    const shippedLane = join(RUNTIME_ROOT, 'dist', 'packages', 'runtime', 'review-assignment')
    const shipped = readdirSync(shippedLane).filter((entry) => entry.endsWith('.js')).sort()
    expect(shipped).toEqual([...LANE_MODULE_STEMS.map((stem) => `${stem}.js`)].sort())
    const shippedFiles: string[] = []
    const collectAll = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) collectAll(full)
        // Round-2 review NF-3: the first version filtered `.js` only, which silently excluded the
        // `.mjs` glue placements — the exact files `place-dist-glue.mjs` writes and the exact files a
        // "temporary" live-plane wiring would be edited into. Both halves of the install surface are
        // scanned, so "the shipped output imports nothing" covers what is actually shipped.
        else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) shippedFiles.push(full)
      }
    }
    collectAll(join(RUNTIME_ROOT, 'dist'))
    const outside = shippedFiles.filter((file) => !file.startsWith(shippedLane + sep))
    expect(outside.length, 'the tracked runtime build output is where the law is being applied').toBeGreaterThan(100)
    for (const file of outside) {
      const text = readIfPresent(file) ?? ''
      expect(sourceEntersLane(file, text), `${relative(RUNTIME_ROOT, file)} imports the assignment lane`).toBe(false)
    }

    // The client bundle carries the ledger CATEGORY literals for the three fact types — that is a mapping
    // the host's own ledger contract demands — and no import of the lane.
    const bundle = readFileSync(join(PACKAGES_ROOT, 'client', 'composition-shim', 'client-bundle.js'), 'utf8')
    for (const factType of ['review-assignment-created', 'review-assignment-transferred', 'review-assignment-retired']) {
      expect(bundle, `the client mirror lost ${factType}`).toContain(factType)
    }
    expect(/from\s*['"`][^'"`]*review-assignment\/|import\(\s*['"`][^'"`]*review-assignment\//.test(bundle)).toBe(false)
  })

  it('says plainly, in its own source, that it authorizes nothing and writes nothing yet', () => {
    // These sentences are the lane's honest boundary; a reader should meet them in the code, not only in
    // a memo or a PR body.
    const barrel = readFileSync(join(LANE_DIR, 'index.ts'), 'utf8')
    expect(barrel).toMatch(/Nothing here is wired|no durable writer/i)
    expect(barrel).toMatch(/Nothing here grants anything|never grants|not a permission credential/i)
    const types = readFileSync(join(LANE_DIR, 'types.ts'), 'utf8')
    expect(types).toMatch(/PR-I1/)
    expect(types).toMatch(/escalateApprovalLeg/)
  })
})

describe('the tree walk survives a concurrent suite\'s scratch cleanup', () => {
  it('skips an entry that vanished, counts it, and still sees what exists', () => {
    // Deterministic model of the race measured in a full-repo run: a sibling suite's `rm -rf` of
    // `packages/testkit/test/.tmp-fault` makes a stat throw ENOENT between listing and open. The leg is
    // not only "did not throw" — it pins that the resilient walk still SEES the real file and still
    // matches the lane pattern inside it, so resilience cannot quietly become blindness.
    const dir = mkdtempSync(join(tmpdir(), 'a6-pr2-hygiene-walk-'))
    try {
      mkdirSync(join(dir, 'pkg', 'src'), { recursive: true })
      const keeper = join(dir, 'pkg', 'src', 'keeper.ts')
      writeFileSync(keeper, "import { routeReviewCase } from '../review-assignment/index.js'\n")
      symlinkSync(join(dir, 'already-deleted'), join(dir, 'pkg', 'src', 'dangling.ts'))
      const before = VANISHED.count
      const files = sourceFiles(join(dir, 'pkg'))
      expect(files).toContain(keeper)
      expect(files).not.toContain(join(dir, 'pkg', 'src', 'dangling.ts'))
      expect(VANISHED.count, 'the vanished entry must be counted, not swallowed').toBeGreaterThan(before)
      expect(sourceEntersLane(keeper, readFileSync(keeper, 'utf8'))).toBe(true)
      expect(
        sourceFiles(join(dir, 'already-deleted')),
        'a directory that vanished mid-walk yields no files and no throw',
      ).toEqual([])
      expect(readIfPresent(keeper), 'a file that is still there must still be readable through the tolerant path').not.toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
