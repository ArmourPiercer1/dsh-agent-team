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

describe('A6-PR3 zero production consumers', () => {
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
      if (file === join(PACKAGES_DIR, 'runtime', 'src', 'plugin', 'root.ts')) continue
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
    expect(Object.keys(manifest.exports ?? {})).toEqual(['.'])
    expect(JSON.stringify(manifest.exports)).not.toMatch(/review-wake/)
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
