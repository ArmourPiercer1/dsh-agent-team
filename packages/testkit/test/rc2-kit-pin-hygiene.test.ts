/**
 * rc2-kit-pin-hygiene — the host generation is named in exactly one place.
 *
 * Three kit sources carried a comment (and one carried a PASS detail string)
 * asserting "test-use pristine @ 46a7f68b09 / 0.1.7-rc.1" while the pin they
 * actually read had moved to 0.2.0-rc.2. A criterion that reports a baseline the
 * run did not use is worse than no criterion: the evidence contradicts itself and
 * the run cannot be judged. Historical provenance comments — "this mirror was taken
 * at @46a7f68b09", "written against fb2c4b9e69" — stay: they are dated facts, and
 * they are the archive this round must not launder away.
 *
 * Pure static checks: no host, no fs writes.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CLIENT_COMMIT_HASH,
  DSH_BASELINE_VERSION,
  TEST_USE_BASELINE_SHA,
  findTestRepoRoot,
} from '../../../tests/paths.mjs'

// REPO_ROOT is where the pristine HOST RUNTIME lives. A linked git worktree has
// no copy of the gitignored `tests/deepseek-harness-test-use`, so locating it
// means walking UP — into the parent checkout. That is correct for the host tree
// and was wrong for the sources: scanning from that root made every worktree run
// report ~954 offenders, each one under the parent checkout's gitignored
// `tests/homes/**` DSH_HOME worlds — generated durable stores, not kit code, and
// not this repository's material at all.
const REPO_ROOT = findTestRepoRoot(process.cwd())
if (REPO_ROOT === null) throw new Error('no repo root with tests/deepseek-harness-test-use')

// WORKSPACE_ROOT is the tree UNDER REVIEW: the worktree this scanner file itself
// lives in. A guard over "what this repository ships" enumerates TRACKED paths —
// the same discipline `packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts`
// uses — which is what makes a worktree run and a main-checkout run agree, and
// what keeps generated worlds and build output out of the subject by
// construction rather than by an exclude list that has to be re-guessed every
// round (the three names the old walk skipped were exactly that list).
// Nothing about a checked file is weakened: every tracked file is still read and
// still matched against the same patterns.
const WORKSPACE_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: dirname(fileURLToPath(import.meta.url)),
  encoding: 'utf8',
}).trim()

const trackedUnder = (relDir: string, pattern: RegExp): string[] =>
  execFileSync('git', ['ls-files', '--', relDir], { cwd: WORKSPACE_ROOT, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    // Build output is not source: `dist` is tracked in this repository, and the
    // walk this replaces skipped it.
    .filter((rel) => rel.length > 0 && !rel.includes('/dist/') && pattern.test(basename(rel)))
    .map((rel) => join(WORKSPACE_ROOT, rel))

/** Code lines only: a line whose first non-space token is a comment marker is prose. */
function codeLines(source: string): string[] {
  return source
    .split('\n')
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => {
      const t = line.trimStart()
      return !(t.startsWith('//') || t.startsWith('#') || t.startsWith('*') || t.startsWith('/*'))
    })
    .map(({ line, i }) => `${i + 1}: ${line}`)
}

const SHA_LITERAL = /\b[0-9a-f]{40}\b/
const SHORT_SHA_PIN = /@\s*[0-9a-f]{8,10}\b/
const RC_LITERAL = /\b\d+\.\d+\.\d+-rc\.\d+\b/

describe('H1 no kit or harness code names a host generation the pin does not', () => {
  const files = [
    ...trackedUnder('tests/kits', /\.mjs$/),
    ...trackedUnder('packages/runtime/root-binding/harness', /\.mjs$/),
    ...trackedUnder('packages/runtime/member-residency/harness', /\.mjs$/),
  ]

  it('there is something to scan', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('code lines carry no 40-hex SHA other than the pinned baseline', () => {
    const hits: string[] = []
    for (const file of files) {
      for (const line of codeLines(readFileSync(file, 'utf8'))) {
        const found = line.match(new RegExp(SHA_LITERAL.source, 'g')) ?? []
        for (const sha of found) {
          if (sha !== TEST_USE_BASELINE_SHA) hits.push(`${file.slice(WORKSPACE_ROOT.length + 1)} ${line.slice(0, 120)}`)
        }
      }
    }
    expect(hits).toEqual([])
  })

  it('code lines carry no release-candidate literal other than the pinned version', () => {
    const hits: string[] = []
    for (const file of files) {
      for (const line of codeLines(readFileSync(file, 'utf8'))) {
        // only flag a version literal in a position that reports or compares it,
        // i.e. a string literal inside a check()/note - the shape that ended up
        // in a PASS detail line once already.
        if (!/check\(|detail|note|label/i.test(line)) continue
        for (const rc of line.match(new RegExp(RC_LITERAL.source, 'g')) ?? []) {
          if (rc === DSH_BASELINE_VERSION) continue
          // The convention: a reported generation literal is either the pin, or
          // it is DATED PROVENANCE that says so out loud. Marking it is not
          // weakening it - the observation stays, and the reader learns it has
          // not been re-taken on the current baseline.
          if (/observed at|UNVERIFIED AT PIN/i.test(line)) continue
          hits.push(`${file.slice(WORKSPACE_ROOT.length + 1)} ${line.slice(0, 120)}`)
        }
      }
    }
    expect(hits).toEqual([])
  })

  it('no code line hardcodes "test-use pristine @ <short sha>" instead of the pin', () => {
    const hits: string[] = []
    for (const file of files) {
      for (const line of codeLines(readFileSync(file, 'utf8'))) {
        if (!/pristine/.test(line)) continue
        if (SHORT_SHA_PIN.test(line) && !line.includes('HOST_BASELINE_SHA') && !line.includes('TEST_USE_BASELINE_SHA')) {
          hits.push(`${file.slice(WORKSPACE_ROOT.length + 1)} ${line.slice(0, 140)}`)
        }
      }
    }
    expect(hits).toEqual([])
  })
})

describe('H2 the pin has exactly one declaration site', () => {
  it('only tests/paths.mjs assigns the baseline constants', () => {
    const offenders: string[] = []
    for (const file of [...trackedUnder('tests', /\.mjs$/), ...trackedUnder('packages', /\.mjs$/)]) {
      if (file.endsWith('tests/paths.mjs')) continue
      const source = readFileSync(file, 'utf8')
      if (/^\s*(const|let|var)\s+(TEST_USE_BASELINE_SHA|DSH_BASELINE_VERSION|CLIENT_COMMIT_HASH)\s*=\s*['"]/m.test(source)) {
        offenders.push(file.slice(WORKSPACE_ROOT.length + 1))
      }
    }
    expect(offenders).toEqual([])
  })

  it('the pinned values are the 0.2.0-rc.2 triple this round migrated to', () => {
    expect(DSH_BASELINE_VERSION).toBe('0.2.0-rc.2')
    expect(TEST_USE_BASELINE_SHA).toBe('639ed015397290b3745d163aafe02ffee4aa3f84')
    expect(CLIENT_COMMIT_HASH).toBe('639ed01539')
  })
})

describe('H3 the reference tree can never become a runtime candidate', () => {
  it('the plugin upstream-resolver names the legacy path exactly, not references/*', () => {
    // OUR source under review, so from the tree under review — reading the
    // parent checkout's copy would let this guard pass on a file that is not the
    // one being shipped.
    const resolver = readFileSync(
      resolve(WORKSPACE_ROOT, 'packages/runtime/src/plugin/upstream-resolver.mjs'),
      'utf8',
    )
    expect(resolver).toContain("join(base, 'references', 'deepseek-harness-test-use')")
    // A glob or a looser `references` join would let the read-only 0.2 reference
    // checkout (references/deepseek-harness-0.2.0-rc.2, see evidence 04) be
    // discovered as a host tree, which TEST_METHODS forbids.
    const code = codeLines(resolver).join('\n')
    expect(code.includes("join(base, 'references', 'deepseek-harness-0.2.0-rc.2')")).toBe(false)
    expect(/readdirSync\([^)]*'references'/.test(code)).toBe(false)
  })
})
