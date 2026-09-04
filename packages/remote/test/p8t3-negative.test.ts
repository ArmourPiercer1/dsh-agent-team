/**
 * p8t3-negative.test.ts — the P8-T3 negative-scan acceptance tests
 * (Brief §87–96): the remote contract layer must be built from no legacy /
 * upstream / session-log source at all.
 *
 * Three proofs:
 *   1. The owned-file scan: exactly the 28 `packages/remote/src` files are
 *      scanned, every import specifier is relative, and rules R1–R6 report
 *      zero violations.
 *   2. Positive controls: synthetic texts (built by the scanner, never
 *      embedded in this file) that each MUST be detected — proof the
 *      scanner is not vacuous.
 *   3. By-construction: the handler dependency surface is exactly the 12
 *      frozen ports (no SessionController mirror, no upstream session
 *      API) — pinned at the type level by `makeFakePorts` (the fake would
 *      fail to compile if `RemoteHandlerDeps` gained or lost a port) and
 *      pinned here on the key names.
 *
 * Token-free by design: this file sits inside the tree the P4-T6 scanner
 * scans, so the legacy-vocabulary control text is produced at runtime by
 * the scanner from the imported frozen constant values — no denylist
 * literal appears in this file.
 */
import { describe, expect, it } from 'vitest'
import { matchDenyListInText } from '../../testkit/fault-injection/session-event-scan.mjs'
import {
  buildP8T3MirrorLogControlText,
  buildP8T3SpecifierControlText,
  buildP8T3VocabularyControlText,
  matchP8T3RulesInText,
  scanP8T3OwnedFiles,
} from './p8t3-negative-scan.mjs'
import { makeFakePorts } from './p8t3-helpers.js'

/** The exact 28 P8-T3-owned source files, in the scanner's sorted order. */
const P8T3_EXPECTED_FILES = [
  'packages/remote/src/contracts/catalog.ts',
  'packages/remote/src/contracts/errors.ts',
  'packages/remote/src/contracts/ids.ts',
  'packages/remote/src/contracts/params.ts',
  'packages/remote/src/contracts/remote-safe.ts',
  'packages/remote/src/contracts/request.ts',
  'packages/remote/src/contracts/response.ts',
  'packages/remote/src/contracts/types.ts',
  'packages/remote/src/contracts/version.ts',
  'packages/remote/src/handlers/catalog.ts',
  'packages/remote/src/handlers/compatibility.ts',
  'packages/remote/src/handlers/dispatch.ts',
  'packages/remote/src/handlers/handoff.ts',
  'packages/remote/src/handlers/intent.ts',
  'packages/remote/src/handlers/legacy.ts',
  'packages/remote/src/handlers/member.ts',
  'packages/remote/src/handlers/override.ts',
  'packages/remote/src/handlers/policy-state.ts',
  'packages/remote/src/handlers/ports.ts',
  'packages/remote/src/handlers/register.ts',
  'packages/remote/src/handlers/team.ts',
  'packages/remote/src/index.ts',
  'packages/remote/src/push/generation.ts',
  'packages/remote/src/push/index.ts',
  'packages/remote/src/push/ledger-page.ts',
  'packages/remote/src/push/pull.ts',
  'packages/remote/src/push/reconnect.ts',
  'packages/remote/src/push/types.ts',
]

/** The exact 12 `RemoteHandlerDeps` port keys, sorted. */
const P8T3_EXPECTED_PORT_KEYS = [
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

describe('P8-T3 negative scan (Brief §87–96)', () => {
  it('scans exactly the 28 owned packages/remote/src files', () => {
    const scan = scanP8T3OwnedFiles()
    expect(scan.files.length).toBe(28)
    expect(scan.files).toEqual(P8T3_EXPECTED_FILES)
  })

  it('reports zero violations under rules R1–R6 across the owned tree', () => {
    const scan = scanP8T3OwnedFiles()
    expect(scan.totalViolations).toBe(0)
    expect(scan.violations).toEqual([])
    for (const fileResult of scan.fileResults) {
      expect(fileResult.violations).toEqual([])
    }
  })

  it('finds import specifiers and proves every one is relative', () => {
    const scan = scanP8T3OwnedFiles()
    const specifiers = scan.fileResults.flatMap((fileResult) => fileResult.importSpecifiers.map((s) => s.specifier))
    expect(specifiers.length).toBeGreaterThan(0)
    expect(specifiers.every((spec) => spec.startsWith('./') || spec.startsWith('../'))).toBe(true)
  })

  it('detects builtin, upstream and non-relative specifiers (positive control R1/R2/R6)', () => {
    const result = matchP8T3RulesInText(buildP8T3SpecifierControlText())
    const rules = result.violations.map((v) => v.rule)
    expect(result.violations.length).toBe(5)
    expect(rules.filter((r) => r === 'R1').length).toBe(1)
    expect(rules.filter((r) => r === 'R2').length).toBe(2)
    expect(rules.filter((r) => r === 'R6').length).toBe(2)
    expect(rules.filter((r) => r === 'R3').length).toBe(0)
  })

  it('detects the mirror token and session-log artifact tokens (positive control R3/R4)', () => {
    const result = matchP8T3RulesInText(buildP8T3MirrorLogControlText())
    const rules = result.violations.map((v) => v.rule)
    expect(result.violations.length).toBe(5)
    expect(rules.filter((r) => r === 'R3').length).toBe(1)
    expect(rules.filter((r) => r === 'R4').length).toBe(4)
  })

  it('detects the frozen legacy vocabulary (positive control R5)', () => {
    const control = buildP8T3VocabularyControlText()
    const hits = matchDenyListInText(control)
    expect(hits.length).toBe(2)
    const kinds = hits.map((h) => h.kind)
    expect(kinds.includes('event-string')).toBe(true)
    expect(kinds.includes('declaration-merge')).toBe(true)
    const result = matchP8T3RulesInText(control)
    const r5 = result.violations.filter((v) => v.rule === 'R5')
    expect(r5.length).toBe(2)
  })

  it('pins the handler dependency surface to exactly the 12 frozen ports', () => {
    const ports = makeFakePorts()
    const keys = Object.keys(ports)
      .filter((key) => key !== 'calls' && key !== 'admissionRequests')
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    expect(keys).toEqual(P8T3_EXPECTED_PORT_KEYS)
  })
})
