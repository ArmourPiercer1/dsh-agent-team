/**
 * Alpha.6 PR4′ (Lane 2) — lane hygiene for `review-defer`: what it may touch, who may consume it, and how
 * many switches may exist.
 *
 * The same three laws as PR0/PR2′/PR3′, re-established here rather than inherited from a shared helper
 * (every blind spot in those helpers was found by planting a file, not by reading them), plus one law that
 * belongs to this lane alone: **the count of choosers**. PR4′ decides whether a Leader is woken, and a second
 * place that also believes it decides — a flag read in the glue, a store constructed by the tool, a retry
 * queue that mirrors the floor — produces either two wakes for one request or none for a case that is
 * waiting. That is not a style preference; it is the difference between a liveness bug and a lost approval,
 * so the counts are asserted against the text of the one file allowed to hold them.
 *
 * What this screen is NOT: it is a lexical floor. A specifier assembled at runtime, a path held in a
 * variable, or a decision made through an indirection this walk cannot see all walk past it. The proof of
 * the lane's behaviour is its kernel spec; this screen exists so the ordinary mistakes — an import added for
 * convenience, a second `createReviewDeferStore()` in a file that wanted its own copy — fail here instead of
 * in a reviewer's reading.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES_ROOT = join(RUNTIME_ROOT, '..')
const LANE_DIR = join(RUNTIME_ROOT, 'review-defer')
const ROOT_TS = join(RUNTIME_ROOT, 'src', 'plugin', 'root.ts')

/**
 * Production consumers of the wake gate. EMPTY, and that is the round-1 blocker on #509 being honoured rather
 * than argued with: no wake in this tree can arrive for a key that already carries a quiet, so a flag, an
 * installed gate, or a `team_review_defer` tool shipped today would be a control with nothing on the other end.
 * The lane ships dark — the same posture as PR0/PR2′/PR3′ — and PR-I2 adds the entry to this list in the same
 * change that supplies the re-firing wake source, its own tests, and the single `root.ts` chooser.
 */
const ALLOWED_CONSUMERS: readonly string[] = []

const FOUNDING_MODULES = ['gate.ts', 'index.ts', 'store.ts', 'types.ts']
const EXTRA_MODULES_ALLOWED: readonly string[] = []

/** The ARC-A protected centre, plus the live glue: the lane may not reach any of it in either direction. */
const PROTECTED_PREFIXES = [
  `control${sep}`,
  `operation-permission${sep}`,
  `tool-admission${sep}`,
  `tool-dispatch${sep}`,
  `governance-center${sep}`,
  join('src', 'plugin', 'live', 'agent-bindings.mjs'),
  join('src', 'plugin', 'live', 'pa-mount-registry.mjs'),
]

// `.mts`/`.cts` are in the set because a live glue seam is typed in a `.d.mts` long before anything imports it:
// a declaration adding `reviewDeferGate?:` (camelCase, caught by the vocabulary screen below, which reads
// `.mts`/`.cts` since this widening and since the camel spelling landed in that pattern) is the earliest form a
// wiring takes, and skipping declarations would leave the screen blind to it.
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js']
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'composition-shim', 'coverage'])

/**
 * Every specifier a source file can name, including the shapes the first version of this screen missed:
 * bare `import x from`, dynamic `import()`, `require()`, and `createRequire(...)()`. A path held in a
 * variable is NOT visible to it, and this file says so instead of implying otherwise.
 */
const SPECIFIER_PATTERN =
  /(?:\bcreateRequire\s*\([^)]*\)\s*\(\s*|\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)['"`]([^'"`\n]+)['"`]/g

function walk(directory: string, into: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry) || entry.startsWith('.')) continue
    const full = join(directory, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) walk(full, into)
    else if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) into.push(full)
  }
  return into
}

function specifiersOf(source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(SPECIFIER_PATTERN)) {
    const specifier = match[1]
    if (specifier !== undefined) found.push(specifier)
  }
  return found
}

function importsLane(file: string): boolean {
  const source = readFileSync(file, 'utf8')
  return specifiersOf(source).some((specifier) => {
    if (!specifier.startsWith('.')) return false
    const target = resolve(dirname(file), specifier.replace(/\.js$/, ''))
    return target === LANE_DIR || target.startsWith(LANE_DIR + sep)
  })
}

/**
 * Strip comments for the ONE leg that needs it — parsing a JSONC tsconfig. It is deliberately NOT used by
 * the dormancy walk or the vocabulary screen: a naive stripper goes blind in both directions (a `/*` inside a
 * glob string swallows a real import — this file's first draft lost `src/plugin/root.ts` that way, which is a
 * false PASS on the most dangerous leg here), and a screen whose failure mode is silence is not a screen.
 * The screen stays suspicious and the lane's prose is written to satisfy it: this lane's laws are stated in
 * words a violation could not be mistaken for, because "the doc says the word" is exactly the noise that
 * gets a leg deleted later.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/[^\n]*/g, '$1')
}

describe('A6-PR4/H — the lane is what it says it is', () => {
  it('has exactly the modules it declared, so a new file is an amendment and not a drift', () => {
    const files = readdirSync(LANE_DIR).filter((name) => name.endsWith('.ts')).sort()
    expect(files.filter((file) => !FOUNDING_MODULES.includes(file))).toEqual([...EXTRA_MODULES_ALLOWED])
    expect(files).toEqual([...FOUNDING_MODULES].sort())
  })

  it('is named by both compile faces, and both still parse', () => {
    for (const config of ['tsconfig.json', 'tsconfig.build.json']) {
      const text = readFileSync(join(RUNTIME_ROOT, config), 'utf8')
      expect(text, `${config} must include the lane`).toContain('"review-defer"')
      expect(() => JSON.parse(stripComments(text)), `${config} must stay parseable`).not.toThrow()
    }
  })

  it('reaches nothing in the protected centre, and nothing outside two allowed places', () => {
    for (const file of walk(LANE_DIR)) {
      for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
        if (!specifier.startsWith('.')) {
          // Not even `node:`: the lane has no clock and no I/O, so it has no reason to name a builtin, and
          // `Date.parse` on a supplied instant is not a clock read.
          expect(specifier, `${file} may not import ${specifier}`).not.toMatch(/^node:/)
          continue
        }
        const target = resolve(dirname(file), specifier.replace(/\.js$/, ''))
        const insideRuntime = target === RUNTIME_ROOT || target.startsWith(RUNTIME_ROOT + sep)
        expect(insideRuntime, `${file} reaches outside the runtime package: ${specifier}`).toBe(true)
        const relativeToRuntime = relative(RUNTIME_ROOT, target)
        for (const protectedPrefix of PROTECTED_PREFIXES) {
          expect(
            relativeToRuntime.startsWith(protectedPrefix),
            `${file} imports the protected centre: ${specifier}`,
          ).toBe(false)
        }
        // The lane talks to its siblings, and to contracts if it ever needs a shared type. Everything else —
        // review-wake, review-assignment, review-mandate, control, the live plane — is a dependency this PR
        // does not have and a review surface it does not need.
        const allowed = relativeToRuntime.startsWith(`review-defer${sep}`) || relativeToRuntime === 'review-defer'
          || relativeToRuntime.startsWith(join('..', 'contracts'))
        expect(allowed, `${file} imports ${specifier}, which this lane does not depend on`).toBe(true)
      }
    }
  })
})

describe('A6-PR4/H — dormancy and the single switch, walked from disk', () => {
  it('has no production consumer at all, measured rather than declared', () => {
    const offenders: string[] = []
    for (const file of walk(PACKAGES_ROOT)) {
      if (file.startsWith(LANE_DIR)) continue
      // Test trees are where this lane's own specs live, and a spec importing the lane is how the lane gets
      // tested at all. The walk's subject is production consumers — the files that could make the gate fire
      // without anyone deciding it should.
      const rel = relative(PACKAGES_ROOT, file)
      if (rel.includes(`${sep}test${sep}`) || rel.includes(`${sep}tests${sep}`) || rel.includes('.spec.')) continue
      if (importsLane(file)) offenders.push(relative(RUNTIME_ROOT, file))
    }
    expect(offenders.sort()).toEqual([...ALLOWED_CONSUMERS].sort())
  })

  it('catches the specifier shapes a dormancy screen is usually written without', () => {
    // Positive controls, from the failures this family of screens has already had: a keyword sitting nowhere
    // near the quote is still an import of this lane, and a screen that misses it reports dormancy falsely.
    const shapes = [
      `import { x } from '../review-defer/index.js'`,
      `const m = await import('../../review-defer/gate.js')`,
      `const req = createRequire(import.meta.url)('../review-defer/index.js')`,
      `const legacy = require('../review-defer/store.js')`,
    ]
    for (const source of shapes) {
      const hit = specifiersOf(source).some((specifier) => specifier.includes('review-defer'))
      expect(hit, source).toBe(true)
    }
    // And the limit, stated: a specifier assembled at runtime walks past any pattern.
    expect(specifiersOf(`const p = '../review-def' + 'er/index.js'; await import(p)`).some((s) => s.includes('review-defer'))).toBe(false)
  })

  it('ships no plane flag, no installed gate and no store construction anywhere in the product', () => {
    // The earlier version of this leg counted ONE of each in `root.ts`. The round-1 review proved the wiring
    // was wired to nothing, so the honest count is zero and the shape it forbids — two stores, two choosers,
    // a tool whose state the notifier never reads — cannot be reached by adding a second one to a first that
    // should not exist yet.
    const wired = readFileSync(ROOT_TS, 'utf8')
    const count = (needle: string): number => wired.split(needle).length - 1
    expect(count('teamToolPlane?.reviewDeferEnabled')).toBe(0)
    expect(count('createReviewDeferGate(')).toBe(0)
    expect(count('createReviewDeferStore(')).toBe(0)
    expect(count('createReviewDeferPort(')).toBe(0)
    // And the same absence across the whole production surface, so the withdrawal is not undone by a name added
    // somewhere a reviewer would not think to look. CamelCase is in the pattern on purpose (round-3 findings
    // R3-4/R3-5 on #509): the plane's config keys would be spelled `reviewDeferEnabled` / `reviewDeferGate`, and a
    // screen reading only `review-defer|REVIEW_DEFER` is blind to the exact shape a flag arrives in — which made
    // the tsconfig sentence it credits ("gated by no flag of any kind") untrue for the flag half.
    for (const file of walk(PACKAGES_ROOT)) {
      if (file.startsWith(LANE_DIR)) continue
      const rel = relative(PACKAGES_ROOT, file)
      if (rel.includes(`${sep}test${sep}`) || rel.includes(`${sep}tests${sep}`)) continue
      expect(readFileSync(file, 'utf8'), `${rel} references the defer plane`).not.toMatch(/review-defer|REVIEW_DEFER|reviewDefer/iu)
    }
  })

  it('does not touch the completion wake family, which is not this lane to quiet', () => {
    for (const file of walk(LANE_DIR)) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} mentions the completion channel`).not.toContain('team-work-settled')
      expect(source, `${file} imports the completion notifier`).not.toContain('work-completion-notification')
    }
  })

  it('holds no clock, no timer, and no I/O of its own', () => {
    // A timer here would be a second scheduler driving review wakes; a clock read would make a floor
    // depend on which process asked. Both are laws, so both are grep-able.
    // `new Date` and friends are needles because the store's doc claims a leg greps for them (round-3 finding
    // R3-3 on #509 — it did not: the list stopped at `Date.now`, and a planted wall-clock read passed the leg).
    // `Date(` is here for the same reason one round later (round-4 finding R4-4): bare `const t = Date()` is a
    // direct call of the wall clock that none of the three `Date.…` spellings match, and it measured as passing
    // this leg. `Intl.DateTimeFormat` is the other clock-shaped API a plugin could reach for.
    // Round-5 finding R5-1 widened this list, and the finding was about the SENTENCE rather than the lane: the
    // prose named categories ("the timer APIs", "filesystem access", "RNG") while the screen named twelve
    // tokens, and `setImmediate`, `openSync`, `appendFileSync`, `crypto.getRandomValues` and
    // `requestAnimationFrame` are each a direct spelling of a category the sentence claimed to cover. The lane
    // contains none of them — grep-clean at HEAD — so nothing was wrong in the code and everything was wrong in
    // the claim, which is the same defect class R4-4 closed. Six tokens added; the claim is now the enumeration
    // below, not a category above it.
    // WHAT THIS SCREEN DOES NOT CLAIM, stated instead of implied: it reads tokens, not bindings. An alias
    // (`const D = Date; new D()`) or a computed member whose text is not itself a needle (`globalThis['Date']`)
    // walks past any needle list. A computed member of a FULL needle token does NOT: the reviewer planted
    // `globalThis['setInterval']` and it was caught, because the bare token survives inside the quotes. The
    // first draft of this sentence listed that as an escape, which under-claimed the screen (round-5 R5-2).
    const forbidden = ['Date.now', 'new Date', 'Date.UTC', 'Date(', 'performance.now', 'Intl.DateTimeFormat', 'setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 'process.', 'readFileSync', 'writeFileSync', 'openSync', 'appendFileSync', 'unlinkSync', 'Math.random', 'getRandomValues']
    for (const file of walk(LANE_DIR)) {
      const source = readFileSync(file, 'utf8')
      for (const needle of forbidden) {
        expect(source.includes(needle), `${file} contains ${needle}`).toBe(false)
      }
    }
    // A needle list is worth exactly as much as the smallest thing it catches, so each token is driven against
    // a realistic call written out by hand — not generated from the token, which would pass on a typo. The two
    // lists then have to agree with each other, or the drift turns red (the standing law: a check satisfiable by
    // something other than the thing it names is not a check of that thing). In memory, never a file: a plant
    // written into the lane would become one of the sources this leg reads.
    const plants: Readonly<Record<string, string>> = {
      'Date.now': 'const t = Date.now()',
      'new Date': 'const stamp = new Date().toISOString()',
      'Date.UTC': 'const day = Date.UTC(2026, 9, 31)',
      'Date(': 'const t = Date()',
      'performance.now': 'const started = performance.now()',
      'Intl.DateTimeFormat': 'new Intl.DateTimeFormat("en").format(0)',
      setTimeout: 'setTimeout(() => {}, 1_000)',
      setInterval: 'setInterval(() => {}, 1_000)',
      setImmediate: 'setImmediate(() => {})',
      requestAnimationFrame: 'requestAnimationFrame(() => {})',
      'process.': 'const pid = process.pid',
      readFileSync: 'const text = readFileSync(path, "utf8")',
      writeFileSync: 'writeFileSync(path, "x")',
      openSync: 'const fd = openSync(path, "w")',
      appendFileSync: 'appendFileSync(path, "x")',
      unlinkSync: 'unlinkSync(path)',
      'Math.random': 'const r = Math.random()',
      getRandomValues: 'crypto.getRandomValues(new Uint8Array(8))',
    }
    expect(Object.keys(plants).sort()).toEqual([...forbidden].sort())
    for (const [needle, plant] of Object.entries(plants)) {
      expect(plant.includes(needle), `the plant for ${needle} no longer contains it`).toBe(true)
      expect(forbidden.filter((token) => plant.includes(token)), `no needle flags ${plant}`).toContain(needle)
    }
  })

  it('leaves the tool layer carrying no defer surface at all, because there is nothing for it to control', () => {
    // Round-1 finding F-1 on #509 removed a sixteenth tool rather than documenting around it: the tool existed
    // to file a quiet, and no wake in this tree could ever be held by one. The dependency direction stays as
    // the lane intends it (an injected port, never an import), and the leg now pins the stronger present fact:
    // the tool layer contains no defer vocabulary, so the withdrawal is visible from the tool surface too.
    for (const file of [join(PACKAGES_ROOT, 'tools', 'src', 'tools.ts'), join(PACKAGES_ROOT, 'tools', 'src', 'types.ts')]) {
      expect(importsLane(file), `${file} imports the review-defer lane`).toBe(false)
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/reviewDefer|REVIEW_DEFER|review-defer/)
    }
  })
})

describe('A6-PR4/H — the shipped surface matches the source surface', () => {
  it('is referenced by nobody in the built output, and the screen can see a reference if one appeared', () => {
    const distRoot = join(RUNTIME_ROOT, 'dist')
    let stat
    try {
      stat = statSync(distRoot)
    } catch {
      stat = undefined
    }
    // The install surface is committed, so this leg is a drift detector rather than a formality: rebuild and
    // re-commit, or say why the build was not run.
    expect(stat?.isDirectory(), 'packages/runtime/dist must be committed for the install surface').toBe(true)
    const files = walk(distRoot).filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
    // A MODULE REFERENCE, not the word: `packages/tools` carries the status literal `'review-defer'` in its
    // own result vocabulary, and a screen that called that a dependency on the lane would be wrong in a way
    // that eventually gets deleted.
    const moduleReference = /['"`][^'"`\n]*review-defer\/[A-Za-z-]+\.js['"`]/
    // Positive control (round-2 finding R2-9 on #509): the assertion below passes on an EMPTY list, so without
    // this it would pass just as loudly if the pattern matched nothing at all. The lane's own compiled imports
    // are relative (`./types.js`) and do NOT match — that is why the exclusion filter below exists — so the
    // sample has to be the shape a real wiring takes.
    expect(moduleReference.test(`import { createReviewDeferGate } from '../../review-defer/index.js'`)).toBe(true)
    expect(moduleReference.test(`const p = './types.js'`)).toBe(false)
    // Dark lane: the shipped output of the lane exists, and NOTHING in the built surface references it. This
    // is the shipped-surface twin of the source walk above, and it is the leg that fails the day somebody
    // wires the gate without amending this file's allow-list.
    const referencing = files
      .filter((file) => moduleReference.test(readFileSync(file, 'utf8')))
      .map((file) => relative(distRoot, file).split(sep).join('/'))
      .filter((path) => !path.startsWith('packages/runtime/review-defer/'))
      .sort()
    expect(referencing).toEqual([])
  })

  it('ships no timer in the lane output either', () => {
    const laneDist = join(RUNTIME_ROOT, 'dist', 'packages', 'runtime', 'review-defer')
    // `.d.ts` carries the module doc, and the doc says the words a violation would use; the executable
    // surface is `.js`/`.mjs`, which is what this leg is about.
    for (const file of walk(laneDist).filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))) {
      const source = readFileSync(file, 'utf8')
      expect(source.includes('setInterval') || source.includes('setTimeout'), `${file} ships a timer`).toBe(false)
    }
  })
})
