/**
 * p8t4-negative.test.ts — the P8-T4 negative-scan acceptance tests:
 * the push engine (`packages/remote/src/push`) and the P8-T4 test surface
 * (`packages/remote/test/p8t4-*`) must be built from no legacy / upstream /
 * session log artifact source at all.
 *
 * Four proofs:
 *   1. The owned-file scan: exactly the 13 P8-T4-owned files are scanned
 *      (6 push engine + 7 test), rules R1–R6 report zero violations, and
 *      every specifier outside the `.mjs` scanner file is relative (or the
 *      exempted test-runner specifier).
 *   2. Positive controls: synthetic texts (built by the scanner, never
 *      embedded in this file) that each MUST be detected — proof the
 *      scanner is not vacuous.
 *   3. The frozen legacy vocabulary control delegates to the P4-T6
 *      scanner's `matchDenyListInText` (single source of truth).
 *   4. By-construction: the handler dependency surface is exactly the 12
 *      frozen ports (no upstream controller mirror, no upstream session
 *      API) — pinned at the type level by `makeFakePorts` (the fake would
 *      fail to compile if `RemoteHandlerDeps` gained or lost a port) and
 *      pinned here on the key names.
 *
 * Token-free by design: this file sits inside both the P4-T6 scanner tree
 * and this scanner's own owned set, so the control texts are produced at
 * runtime by the scanner from fragments and imported frozen values — no
 * rule or denylist literal appears in this file.
 */
import { describe, expect, it } from 'vitest'
import { matchDenyListInText } from '../../testkit/fault-injection/session-event-scan.mjs'
import {
  buildP8T4MirrorLogControlText,
  buildP8T4SpecifierControlText,
  buildP8T4VocabularyControlText,
  matchP8T4RulesInText,
  scanP8T4OwnedFiles,
} from './p8t4-negative-scan.mjs'
import { makeFakePorts } from './p8t3-helpers.js'

/** The exact 13 P8-T4-owned files, in the scanner's sorted order. */
const P8T4_EXPECTED_FILES = [
  'packages/remote/src/push/generation.ts',
  'packages/remote/src/push/index.ts',
  'packages/remote/src/push/ledger-page.ts',
  'packages/remote/src/push/pull.ts',
  'packages/remote/src/push/reconnect.ts',
  'packages/remote/src/push/types.ts',
  'packages/remote/test/p8t4-engine.test.ts',
  'packages/remote/test/p8t4-negative-scan.d.mts',
  'packages/remote/test/p8t4-negative-scan.mjs',
  'packages/remote/test/p8t4-negative.test.ts',
  'packages/remote/test/p8t4-server.ts',
  'packages/remote/test/p8t4-sync.test.ts',
  'packages/remote/test/p8t4-test-client.ts',
]

/** The exact 12 `RemoteHandlerDeps` port keys, sorted. */
const P8T4_EXPECTED_PORT_KEYS = [
  'admission',
  'catalog',
  'compatibility',
  'handoff',
  'intent',
  'ledger',
  'legacy',
  'lifecycle',
  'override',
  'policyState',
  'projection',
  'teamCreate',
]

/** The test-runner specifier exempted from the relative-only rule (R6). */
const TEST_RUNNER_SPECIFIER = 'vitest'

describe('P8-T4 negative scan (push engine + test surface)', () => {
  it('scans exactly the 13 owned P8-T4 files', () => {
    const scan = scanP8T4OwnedFiles()
    expect(scan.files.length).toBe(13)
    expect(scan.files).toEqual(P8T4_EXPECTED_FILES)
  })

  it('reports zero violations under rules R1–R6 across the owned set', () => {
    const scan = scanP8T4OwnedFiles()
    expect(scan.totalViolations).toBe(0)
    expect(scan.violations).toEqual([])
    for (const fileResult of scan.fileResults) {
      expect(fileResult.violations).toEqual([])
    }
  })

  it('proves every specifier outside the .mjs scanner is relative or the test runner', () => {
    const scan = scanP8T4OwnedFiles()
    let checked = 0
    for (const fileResult of scan.fileResults) {
      const isMjs = fileResult.file.endsWith('.mjs')
      for (const specifier of fileResult.importSpecifiers) {
        if (isMjs) continue
        checked += 1
        const spec = specifier.specifier
        expect(spec.startsWith('./') || spec.startsWith('../') || spec === TEST_RUNNER_SPECIFIER).toBe(true)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('detects builtin, upstream and non-relative specifiers (positive control R1/R2/R6)', () => {
    const result = matchP8T4RulesInText(buildP8T4SpecifierControlText())
    const rules = result.violations.map((v) => v.rule)
    expect(result.violations.length).toBe(5)
    expect(rules.filter((r) => r === 'R1').length).toBe(1)
    expect(rules.filter((r) => r === 'R2').length).toBe(1)
    expect(rules.filter((r) => r === 'R6').length).toBe(3)
    expect(rules.filter((r) => r === 'R3').length).toBe(0)
  })

  it('detects the mirror token and the log artifact tokens (positive control R3/R4)', () => {
    const result = matchP8T4RulesInText(buildP8T4MirrorLogControlText())
    const rules = result.violations.map((v) => v.rule)
    expect(result.violations.length).toBe(5)
    expect(rules.filter((r) => r === 'R3').length).toBe(1)
    expect(rules.filter((r) => r === 'R4').length).toBe(4)
  })

  it('detects the frozen legacy vocabulary (positive control R5)', () => {
    const control = buildP8T4VocabularyControlText()
    const hits = matchDenyListInText(control)
    expect(hits.length).toBe(2)
    const kinds = hits.map((h) => h.kind)
    expect(kinds.includes('event-string')).toBe(true)
    expect(kinds.includes('declaration-merge')).toBe(true)
    const result = matchP8T4RulesInText(control)
    const r5 = result.violations.filter((v) => v.rule === 'R5')
    expect(r5.length).toBe(2)
  })

  it('pins the handler dependency surface to exactly the 12 frozen ports', () => {
    const ports = makeFakePorts()
    const keys = Object.keys(ports)
      .filter((key) => key !== 'calls' && key !== 'admissionRequests')
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    expect(keys).toEqual(P8T4_EXPECTED_PORT_KEYS)
  })
})
