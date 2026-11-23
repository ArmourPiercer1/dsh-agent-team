/**
 * Alpha.6 PR3 — lane hygiene for the dormant ReviewWakeCoordinator.
 *
 * Four structural legs:
 *
 * 1. PURITY: every file in `packages/runtime/review-wake` imports only its
 *    own siblings, never `node:*`, never another package. It also carries no
 *    clock, timer, randomness, process or filesystem access.
 * 2. REJECTED MACHINERY: the compressed latch must not reintroduce the
 *    seven-phase WakeSlot vocabulary, leases/fencing (`writerToken`,
 *    `leaseEpoch`) or a timer service. This is a source-level negative pin.
 * 3. ZERO CONSUMERS: no production file anywhere under `packages/` imports
 *    or references the lane. Only the test directory may.
 * 4. TYPECHECK SURFACE: the lane is listed in the runtime typecheck include
 *    so it cannot silently escape `tsc`; it is intentionally NOT in the
 *    build tsconfig because nothing emits or exports it yet.
 *
 * Offline, host-free. The only I/O is reading this repository's own files.
 *
 * @module packages/runtime/test/a6-pr3-lane-hygiene.test
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME_DIR = resolve(HERE, '..')
const PACKAGES_DIR = resolve(RUNTIME_DIR, '..')
const LANE_DIR = resolve(RUNTIME_DIR, 'review-wake')

const SOURCE_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']

function walk(
  dir: string,
  into: string[] = [],
  options: { skipTests?: boolean } = {},
): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (
        options.skipTests &&
        (entry === 'test' || entry === 'tests' || entry === '__tests__')
      ) {
        continue
      }
      walk(full, into, options)
      continue
    }
    if (!SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      continue
    }
    if (options.skipTests && /\.(test|spec)\./.test(entry)) continue
    into.push(full)
  }
  return into
}

/** Strip comments so prose about a forbidden token is not an edge. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

/** Minimal comment-tolerant JSON reader for tsconfig files. */
function readJsonc(file: string): { include?: string[] } {
  const raw = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  return JSON.parse(raw) as { include?: string[] }
}

/**
 * The keys the runtime package currently advertises. This is an EXPLICIT
 * allowlist, not a copy of the manifest: adding a subpath export is a review
 * event, so the owner of this pin has to see and update this line. The pin's
 * subject is the review-wake lane — `('.' , './settlement')` only records what
 * else is legitimately advertised today.
 */
const ADVERTISED_EXPORT_ALLOWLIST = ['.', './settlement'] as const

/** Advertised subpath keys, sorted, from a package manifest. */
function advertisedExportKeys(manifest: { exports?: Record<string, unknown> }): string[] {
  return Object.keys(manifest.exports ?? {}).sort()
}

/** The subset of advertised keys that name the dormant review-wake lane. */
function reviewWakeExportKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => /review-wake/i.test(key))
}

const laneSources = walk(LANE_DIR)
const laneCode = new Map(
  laneSources.map((file) => [relative(LANE_DIR, file), codeOnly(readFileSync(file, 'utf8'))] as const),
)

describe('A6-PR3 lane purity', () => {
  it('contains the expected production files', () => {
    expect([...laneCode.keys()].sort()).toEqual([
      'coordinator.ts',
      'delivery.ts',
      'errors.ts',
      'index.ts',
      'types.ts',
    ])
  })

  it('imports only lane-local siblings — no node builtin, no package, no parent path', () => {
    for (const [name, code] of laneCode) {
      expect(code, name).not.toMatch(/from\s+['"]node:/)
      const specifiers = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
        (match) => match[1] ?? '',
      )
      for (const specifier of specifiers) {
        expect(specifier, `${name} -> ${specifier}`).toMatch(/^\.\/.+\.js$/)
      }
    }
  })

  it('carries no clock, timer, randomness, process or filesystem access', () => {
    const forbidden: Array<[string, RegExp]> = [
      ['setTimeout', /\bsetTimeout\b/],
      ['setInterval', /\bsetInterval\b/],
      ['setImmediate', /\bsetImmediate\b/],
      ['queueMicrotask', /\bqueueMicrotask\b/],
      ['Date', /\bDate\b/],
      ['performance', /\bperformance\b/],
      ['Math.random', /Math\s*\.\s*random\b/],
      ['process', /\bprocess\b/],
      ['fetch', /\bfetch\s*\(/],
      ['readFile', /\breadFile/],
      ['writeFile', /\bwriteFile/],
    ]
    for (const [name, code] of laneCode) {
      for (const [token, pattern] of forbidden) {
        expect(pattern.test(code), `${name} must not use ${token}`).toBe(false)
      }
    }
  })

  it('does not reintroduce the rejected seven-phase/lease/timer machinery', () => {
    const rejected = [
      /\bWakeSlot\b/,
      /\bwriterToken\b/,
      /\bleaseEpoch\b/,
      /\bleaseFenc/,
      /\bbackoff\b/i,
      /\breserved\b/,
      /\breconciling\b/,
      /\bsuspended\b/,
    ]
    for (const [name, code] of laneCode) {
      for (const pattern of rejected) {
        expect(pattern.test(code), `${name} matches ${pattern}`).toBe(false)
      }
    }
  })
})

describe('A6-PR3 production consumers are exactly the round-84 governed delivery', () => {
  it('no production file under packages/ imports or references the lane', () => {
    const files = walk(PACKAGES_DIR, [], { skipTests: true })
    const consumers: string[] = []
    for (const file of files) {
      if (file.startsWith(`${LANE_DIR}${sep}`)) continue
      // A6-PR6 is the consumer round: its notifier names the wake token on
      // purpose. PR3's no-consumer law is about UNWIRED production code; the
      // opt-in adapter below is inert until the Host chooses alpha6.
      if (file.startsWith(join(PACKAGES_DIR, 'runtime', 'alpha6') + sep)) continue
      // A6-PR6: `src/plugin/root.ts` IS the opt-in consumer adapter. It is
      // inert unless `alpha6ReviewRouting` is true, and the PR3 law targets
      // UNWIRED production code, not this Host entry. Keep the exemption to
      // exactly this file so any other runtime consumer still fails.
      // ROUND 72 (2026-11-22): the opt-in adapter moved to the centre with the UTE A0/A1 cut
      // (`src/plugin/root.ts` → `src/plugin/vnext/root.ts`). The exemption stays "exactly this file",
      // so any OTHER runtime consumer of the lane is still a finding.
      if (file === join(PACKAGES_DIR, 'runtime', 'src', 'plugin', 'vnext', 'root.ts')) continue
      // ROUND 84: the routed review's wake is now a GOVERNED DELIVERY, which is the one thing the
      // lane needed and did not have. Two named files carry it — the delivery port itself and the live
      // glue that delegates to it — and they are exempt BY EXACT PATH, so any OTHER consumer is still
      // a finding. (The old law said "zero production consumers" because the capability was refused on
      // every row; the refusal arms still hold for an incoherent row.)
      if (file === join(PACKAGES_DIR, 'runtime', 'src', 'plugin', 'vnext', 'review-wake-delivery.mjs')) continue
      if (file === join(PACKAGES_DIR, 'runtime', 'src', 'plugin', 'vnext', 'agent-bindings.mjs')) continue
      const code = codeOnly(readFileSync(file, 'utf8'))
      if (/\breview-wake\b/.test(code) || /\bReviewWake/.test(code)) {
        consumers.push(relative(PACKAGES_DIR, file))
      }
    }
    expect(consumers).toEqual([])
  })

  it('the runtime package does not advertise a review-wake export', () => {
    const manifest = JSON.parse(
      readFileSync(join(RUNTIME_DIR, 'package.json'), 'utf8'),
    ) as { exports?: Record<string, unknown> }
    const keys = advertisedExportKeys(manifest)
    // The property this arm is NAMED for: no advertised key reaches the lane.
    expect(reviewWakeExportKeys(keys)).toEqual([])
    expect(JSON.stringify(manifest.exports)).not.toMatch(/review-wake/)
    // Bite without over-reach: the exact set is pinned so ANY new subpath is a
    // review event, while unrelated legitimate exports (e.g. './settlement')
    // are not mistaken for a lane advertisement.
    expect(keys).toEqual([...ADVERTISED_EXPORT_ALLOWLIST])
  })

  it('non-vacuity: the same predicate refuses a synthetic review-wake export', () => {
    const synthetic = {
      exports: { '.': {}, './review-wake': {}, './review-wake/coordinator': {} },
    }
    const keys = advertisedExportKeys(synthetic)
    expect(reviewWakeExportKeys(keys)).toEqual(['./review-wake', './review-wake/coordinator'])
    expect(keys).not.toEqual([...ADVERTISED_EXPORT_ALLOWLIST])
  })
})

describe('A6-PR3 typecheck surface', () => {
  it('lists the lane in the runtime typecheck include', () => {
    const typecheck = readJsonc(join(RUNTIME_DIR, 'tsconfig.json'))
    expect(typecheck.include).toContain('review-wake')
  })

  it('does not add the dormant lane to the build/emit include', () => {
    const build = readJsonc(join(RUNTIME_DIR, 'tsconfig.build.json'))
    expect(build.include ?? []).not.toContain('review-wake')
  })
})
