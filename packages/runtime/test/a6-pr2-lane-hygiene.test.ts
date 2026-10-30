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
import { dirname, join, relative, sep } from 'node:path'
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

/** Any mention of an assignment-lane module in a quoted specifier, extensionless, bare-directory or
 *  dynamic. */
const LANE_IMPORT_PATTERN =
  /['"][^'"]*review-assignment\/(?:index|types|facts|router|handoff)(?:\.js)?['"]|['"][^'"]*\/review-assignment\/?['"]|import\(\s*['"][^'"]*review-assignment/

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
        if (LANE_IMPORT_PATTERN.test(readIfPresent(file) ?? '')) offenders.push(rel)
      }
    }
    expect(offenders).toEqual([...ALLOWED_CONSUMERS])
  })

  it.each<[string, string]>([
    ['a plain TypeScript importer', `import { routeReviewCase } from '../review-assignment/index.js'`],
    ['an extensionless importer', `import { routeReviewCase } from '../review-assignment/index'`],
    ['a bare directory import', `import * as assignment from '../review-assignment'`],
    ['a live-plane .mjs importer', `import { foldReviewAssignmentRows } from '../review-assignment/index.js'`],
    ['a sibling-module import', `import { encodeAssignmentFact } from './review-assignment/facts.js'`],
    ['a dynamic import', `const lane = await import('../review-assignment/router.js')`],
    ['a contracts-package importer', `import { planHandoff } from '../../runtime/review-assignment/handoff.js'`],
  ])('the dormancy detector catches %s (positive control)', (_label, sample) => {
    expect(LANE_IMPORT_PATTERN.test(sample)).toBe(true)
  })

  it('the dormancy detector does not fire on unrelated text (negative control)', () => {
    expect(LANE_IMPORT_PATTERN.test("import { evaluateReviewAdmission } from '../review-mandate/index.js'")).toBe(false)
    expect(LANE_IMPORT_PATTERN.test('// review-assignment is dormant until PR-I1')).toBe(false)
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
    const allowed = /^(?:\.\.\/\.\.\/contracts\/src\/index\.js|\.\.\/review-mandate\/index\.js|\.\/(?:types|facts|router|handoff)\.js)$/
    let laneSpecifiers = 0
    for (const file of sourceFiles(LANE_DIR)) {
      const text = readFileSync(file, 'utf8')
      const specifiers = [...text.matchAll(/^\s*(?:import|export)[^;]*?from '([^']+)'/gm)].map((match) => match[1] as string)
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
      expect(text).not.toMatch(/readFileSync|writeFileSync|process\.env|fetch\(|node:fs|node:net|node:http|child_process/)
    }
    // Anti-vacuity, and the two dependencies the lane is allowed to have: the frozen lifecycle
    // vocabulary comes from contracts, and the admission gate comes from PR0.
    expect(laneSpecifiers).toBeGreaterThanOrEqual(8)
    expect(readFileSync(join(LANE_DIR, 'types.ts'), 'utf8')).toContain("from '../../contracts/src/index.js'")
    expect(readFileSync(join(LANE_DIR, 'router.ts'), 'utf8')).toContain("from '../review-mandate/index.js'")
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
      expect(LANE_IMPORT_PATTERN.test(readFileSync(keeper, 'utf8'))).toBe(true)
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
