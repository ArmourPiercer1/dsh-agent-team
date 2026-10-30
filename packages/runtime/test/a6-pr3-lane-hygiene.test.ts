/**
 * Alpha.6 PR3′ (Lane 2) — lane hygiene for `review-wake`: what it may touch, who may consume it, and what
 * it may not reach for.
 *
 * Same three laws as PR0's hygiene suite, re-established rather than inherited, because a shared helper
 * would make this leg inherit PR0's blind spots too — and every one of those blind spots was found by
 * executing a planted file, not by reading the helper.
 *
 *  1. **Dormant, measured not declared.** PR3′ ships a scheduler that cannot wake anything: delivery is
 *     PR-I2 and the package exports nothing that reaches a Session. A dark lane is only safe while it stays
 *     dark, so the importer set is walked from disk on every run.
 *  2. **No reverse dependency on the protected centre.** The wake scheduler will eventually be driven from
 *     the live plugin plane; that direction is allowed. What is not allowed is this lane importing the
 *     ARC-A digest-pinned decision core, which would put a new lane inside the kernel's compile graph and
 *     turn the next Center-Interface PR into a two-direction merge.
 *  3. **In the compile face, and pure.** Both tsconfigs must name the lane, and its module set may import
 *     only `node:crypto`, the shared canonical encoder, and each other — no host, no clock, no I/O.
 *
 * The screen in the last leg is the same LEXICAL FLOOR as PR0's, with the same honest limit: the proof of
 * purity is that `reduceWakeSlot` and `reconcileWakeSlots` return identical results for identical inputs
 * (leg 12 of the kernel spec), and this screen exists so a future edit that grabs `Date.now()` fails here
 * rather than in a reviewer's reading.
 */

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LANE_DIR = join(RUNTIME_ROOT, 'review-wake')
const PACKAGES_ROOT = join(RUNTIME_ROOT, '..')

/** Production consumers of the wake scheduler. Empty by design: PR3′ has none, and PR-I2 arrives with its
 *  own Center-Interface ledger override, its own tests, and this list updated in the same change. */
const ALLOWED_CONSUMERS: readonly string[] = []

const FOUNDING_MODULES = ['identity.ts', 'index.ts', 'recovery.ts', 'slot.ts', 'types.ts']

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

// `.tsx` is here because the round-5 review planted an importer in `alpha/src/offender.tsx` and the
// dormancy leg stayed GREEN while twelve production `packages/client/src/ui/*.tsx` files sat outside the
// walk — and PR-I2's wake states are exactly the kind of file that lands there. `.mts` needs nothing:
// every `.mts` in this tree is a `.d.mts` declaration, already excluded.
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.cjs', '.js']
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'composition-shim', 'coverage'])

/**
 * Did this error mean "the path is gone / its parent is gone", as opposed to "the filesystem is broken"?
 * Three sibling suites (f3a/f3b/f3c) and the po-notify suite create and destroy scratch under
 * `packages/testkit/test/.tmp-fault`, which every tree walk in this file crosses. A full-repo run measured
 * the collision rather than predicting it: the first version of this walker aborted the whole spec with
 * `ENOENT: no such file or directory, stat '.../.tmp-fault/po-notify-determinism'` — a spec whose claim is
 * about who imports a dormant lane, defeated because another suite happened to be mid-cleanup. Treating
 * "gone" as "gone" is not a weakened assertion: a file that no longer exists cannot import anything, and
 * anything OTHER than gone still throws, because a real filesystem problem must not look like success.
 */
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

/** Read a file that a concurrent suite may delete between listing and open. `null` means "it is gone",
 * which the dormancy scan reads as "nothing here imports the lane" — the truth for a deleted file. Used
 * ONLY for foreign trees; the lane's own files are read strictly, because a missing founding module must
 * fail loudly rather than vanish into an empty string. */
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

/** Any mention of a wake-lane module in a quoted specifier, extensionless, bare-directory or dynamic. */
const LANE_IMPORT_PATTERN = /['"][^'"]*review-wake\/(?:index|types|identity|slot|recovery)(?:\.js)?['"]|['"][^'"]*\/review-wake\/?['"]|import\(\s*['"][^'"]*review-wake/

describe('a6-pr3 lane hygiene', () => {
  it('the lane is a real module set, not a vocabulary dump', () => {
    const files = sourceFiles(LANE_DIR).map((file) => relative(LANE_DIR, file)).sort()
    for (const required of FOUNDING_MODULES) {
      expect(files, `the lane is missing ${required}`).toContain(required)
    }
    expect(files.filter((file) => !FOUNDING_MODULES.includes(file))).toEqual([...EXTRA_MODULES_ALLOWED])
  })

  it('exports exactly ONE store-key derivation, so §2\'s "no second index" is a fact, not prose', () => {
    // The round-5 battery planted a second exported derivation (`altSlotRowKey`, a naive `a:b:c` join)
    // in identity.ts and every one of the 76 kernel legs stayed green: the atomicity argument says the
    // key comes from ONE function, and until this leg nothing in the repo could tell whether that was
    // still true. A closed name list is the only honest way to pin an absence.
    const text = readFileSync(join(LANE_DIR, 'identity.ts'), 'utf8')
    const exported = [...text.matchAll(/^export (?:function|const) (\w+)/gm)].map((match) => match[1] as string).sort()
    expect(exported).toEqual(['composeWakeText', 'deriveWakeId', 'sameWakeTurn', 'wakeSlotRowKey'])
    expect(exported.filter((name) => /key/i.test(name))).toEqual(['wakeSlotRowKey'])
    // And the barrel re-exports it exactly once, so a second barrel line cannot smuggle a synonym out.
    const barrel = readFileSync(join(LANE_DIR, 'index.ts'), 'utf8')
    expect(barrel.match(/wakeSlotRowKey/g) ?? []).toHaveLength(1)
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
      // The floor that makes the whole leg non-vacuous. Before the round-5 review, a walk that read
      // ZERO files passed: the only anti-vacuity was counting package NAMES from a strict readdir of
      // PACKAGES_ROOT, so a renamed package, a wrong PACKAGES_ROOT, a subtree swallowed by a symlink
      // loop, or an extension filter too narrow to see anything all produced a green "no offenders".
      // Measured floor on this tree: the smallest package holds 20 source files (testkit 342, runtime
      // 827), so this cannot accidentally trip — and it is the assertion that would catch the next
      // vanishing-scratch race turning into silence instead of a skip.
      expect(files, `the dormancy walk found no source file inside ${pkg}`).not.toHaveLength(0)
      for (const file of files) {
        const rel = relative(PACKAGES_ROOT, file)
        if (rel.startsWith(join('runtime', 'review-wake') + sep)) continue
        if (rel.includes(`${sep}test${sep}`) || rel.includes(`${sep}tests${sep}`) || rel.includes('.spec.')) continue
        if (LANE_IMPORT_PATTERN.test(readIfPresent(file) ?? '')) offenders.push(rel)
      }
    }
    expect(offenders).toEqual([...ALLOWED_CONSUMERS])
  })

  it.each<[string, string]>([
    ['a plain TypeScript importer', `import { reduceWakeSlot } from '../review-wake/index.js'`],
    ['an extensionless importer', `import { reduceWakeSlot } from '../review-wake/index'`],
    ['a bare directory import', `import * as wake from '../review-wake'`],
    ['a live-plane .mjs importer', `import { reconcileWakeSlots } from '../review-wake/index.js'`],
    ['a sibling-module import', `import { deriveWakeId } from './review-wake/identity.js'`],
    ['a dynamic import', `const wake = await import('../review-wake/slot.js')`],
    ['a contracts-package importer', `import { composeWakeText } from '../../runtime/review-wake/identity.js'`],
  ])('the dormancy detector catches %s (positive control)', (_label, sample) => {
    expect(LANE_IMPORT_PATTERN.test(sample)).toBe(true)
  })

  it('the dormancy detector does not fire on unrelated text (negative control)', () => {
    expect(LANE_IMPORT_PATTERN.test("import { reduce } from '../review-mandate/index.js'")).toBe(false)
    expect(LANE_IMPORT_PATTERN.test('// review-wake is dormant until PR-I2')).toBe(false)
  })

  it('imports NOTHING from the ARC-A protected centre (no reverse dependency)', () => {
    for (const file of sourceFiles(LANE_DIR)) {
      const text = readFileSync(file, 'utf8')
      for (const prefix of PROTECTED_PREFIXES) {
        expect(text, `${relative(RUNTIME_ROOT, file)} must not import the protected ${prefix}`).not.toContain(`../${prefix}`)
        expect(text, `${relative(RUNTIME_ROOT, file)} must not import the protected ${prefix}`).not.toContain(`./${prefix}`)
      }
    }
  })

  it('is named by both tsconfigs, so a repo-wide tsc reads it', () => {
    for (const config of ['tsconfig.json', 'tsconfig.build.json']) {
      const text = readFileSync(join(RUNTIME_ROOT, config), 'utf8')
      expect(text, `${config} must include the lane`).toContain('"review-wake"')
    }
    // And the build config stays parseable by a plain JSON reader: a comment in
    // it broke a master-green suite in PR0 round 1, so the constraint is pinned
    // here rather than remembered.
    expect(() => JSON.parse(readFileSync(join(RUNTIME_ROOT, 'tsconfig.build.json'), 'utf8').replace(/:\/\/.*/g, ''))).not.toThrow()
  })

  it('performs no I/O and reads no clock: only node:crypto, contracts and itself', () => {
    const allowed = /^(node:crypto|(?:\.\.\/)+contracts\/src\/index\.js|\.\/(types|identity|slot|recovery)\.js)$/
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
    // The walk is not vacuous: `types.ts` is legitimately import-free (it declares vocabulary and nothing
    // else), so the anti-vacuity claim is made about the LANE, not about every file in it.
    expect(laneSpecifiers).toBeGreaterThanOrEqual(8)
    expect(readFileSync(join(LANE_DIR, 'identity.ts'), 'utf8')).toContain("from 'node:crypto'")
  })

  it('says plainly, in its own source, that it cannot deliver and cannot authenticate its inputs', () => {
    // These two sentences are the lane's honest boundary, and a reader should find them in the code rather
    // than only in a memo: no delivery (PR-I2), and event ingress trusted to the adapter.
    const barrel = readFileSync(join(LANE_DIR, 'index.ts'), 'utf8')
    expect(barrel).toMatch(/PR-I2/)
    expect(barrel).toMatch(/cannot authenticate|cannot\s+authenticate/is)
    const slot = readFileSync(join(LANE_DIR, 'slot.ts'), 'utf8')
    expect(slot).toMatch(/hostile containers are a caller obligation/)
  })
})

describe('the tree walk survives a concurrent suite\'s scratch cleanup', () => {
  it('skips an entry that vanished, counts it, and still sees what exists', () => {
    // Deterministic model of the race: a symlink whose target does not exist makes `statSync` throw
    // ENOENT on every OS, which is exactly what a sibling suite mid-`rm -rf` produces on one entry.
    // The leg is not only "did not throw" — it pins that the resilient walk still SEES the real file
    // and still matches the lane pattern in it, so resilience cannot quietly become blindness.
    const dir = mkdtempSync(join(tmpdir(), 'a6-hygiene-walk-'))
    try {
      mkdirSync(join(dir, 'pkg', 'src'), { recursive: true })
      const keeper = join(dir, 'pkg', 'src', 'keeper.ts')
      writeFileSync(keeper, "import { wake } from '../review-wake/index.js'\n")
      symlinkSync(join(dir, 'already-deleted'), join(dir, 'pkg', 'src', 'dangling.ts'))
      const before = VANISHED.count
      const files = sourceFiles(join(dir, 'pkg'))
      expect(files).toContain(keeper)
      expect(files).not.toContain(join(dir, 'pkg', 'src', 'dangling.ts'))
      expect(VANISHED.count, 'the vanished entry must be counted, not swallowed').toBeGreaterThan(before)
      expect(LANE_IMPORT_PATTERN.test(readFileSync(keeper, 'utf8'))).toBe(true)
      // And a read that races the same way yields null, not a throw, for a foreign tree.
      // The sibling suite's cleanup is `rm -rf .tmp-fault`, which throws from the DIRECTORY listing,
      // not from the per-entry stat the dangling symlink models. Both catches must be owned.
      expect(sourceFiles(join(dir, 'already-deleted')), 'a directory that vanished mid-walk yields no files and no throw').toEqual([])
      expect(readIfPresent(keeper), 'a file that is still there must still be readable through the tolerant path').not.toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
