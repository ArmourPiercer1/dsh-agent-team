/**
 * p4t6-session-event-scan.test.ts — P4-T6 independent TeamDomain audit:
 * committed evidence that the frozen Team SessionEvent denylist (five
 * legacy event strings, five legacy payload symbols, and the legacy
 * declaration-merging pattern on `@deepseek-ai/dsh-session/types`) is
 * absent from the vNext source tree.
 *
 * This file is one of exactly two self-referential exclusions of the
 * scanner (the other is `../fault-injection/session-event-scan.mjs`
 * itself), so the control samples below may carry denylist tokens as
 * literal test data. The scanner's frozen vocabulary lives in the `.mjs`.
 *
 * The tree scan runs once per file load (synchronous, deterministic);
 * every test below asserts on that single shared result plus fresh
 * single-text control samples.
 */

import { describe, it, expect } from 'vitest'
import {
  matchDenyListInText,
  scanSessionEventVocabulary,
} from '../fault-injection/session-event-scan.mjs'

/** The only files allowed to carry denylist tokens (frozen quarantine). */
const QUARANTINE_FILES: ReadonlySet<string> = new Set([
  'packages/contracts/src/legacy-vocabulary.ts',
  'packages/contracts/test/negative.test.ts',
])

/** The required P4 suites this audit cites as executed evidence. */
const REQUIRED_SUITES: readonly string[] = [
  'packages/storage/test/p4t4-adapter.test.ts',
  'packages/storage/test/p4t4-one-committed-invariant.test.ts',
  'packages/storage/test/p4t4-orphan-detect.test.ts',
  'packages/storage/test/p4t4-per-stage-retry.test.ts',
  'packages/testkit/test/p4t5-crash-matrix.test.ts',
  'packages/testkit/test/p4t5-retry-restart.test.ts',
  'packages/testkit/test/p4t5-corrupt-version.test.ts',
  'packages/storage/test/p4-01-schema-meta.test.ts',
]

describe('p4t6 frozen Team SessionEvent denylist scan', () => {
  const scanResult = scanSessionEventVocabulary()

  it('coverage: all nine package dirs discovered, nine carry source, 428 files scanned, runtime carries the P7-T2 mutation files, legacy carries the P7-T6 adapter and the P7-T7 session reader, contracts carries the P8-T1 projection DTO', () => {
    expect(scanResult.packageDirs).toEqual([
      'client',
      'contracts',
      'domain',
      'legacy',
      'remote',
      'runtime',
      'storage',
      'testkit',
      'tools',
    ])
    const withSource = scanResult.packageDirs.filter((name) =>
      scanResult.files.some((f) => f.startsWith('packages/' + name + '/')),
    )
    expect(withSource.length).toBe(9)
    // `packages/legacy` now carries the P7-T6 legacy teammates import
    // adapter: the pure core .ts, the sync fs seam .mjs, its .d.mts type
    // surface, and the p7t6 unit-test .ts (the fixture .md files are not
    // scanned source), plus the P7-T7 read-only legacy Team Session reader
    // (5 module .ts + 7 in-process suite .ts + 5 real-instance harness
    // .mjs).
    expect(
      scanResult.files.filter((f) => f.startsWith('packages/legacy/')).length,
    ).toBe(21)
    // 226 pre-existing .ts/.mts/.mjs files (189 pre-P5 + 12 P5-T1 runtime
    // files + 11 P5-T2 persona/preset files + 6 P5-T3 runtime files +
    // 8 P5-T4 capability adapter files) + the adjacent .d.mts type surface
    // of the scanner (the scanner .mjs and this test are excluded by the
    // self-reference contract) + 10 P5-T5 root-binding files (6 module
    // .ts + 4 unit-test .ts) + 6 P5-T5 real-instance harness .mjs
    // (ts-loader, seam, mini-mcp, slots, plugin, run) + 15 P5-T6
    // member-residency files (8 module .ts + 4 unit-test .ts +
    // 3 real-instance harness .mjs: plugin, run, slots-t6) + 13 P6-T1
    // activation-provider files (7 module .ts under runtime/activation +
    // 6 unit-test .ts under runtime/test: p6t1-helpers + 5 suites) +
    // 15 P6-T2 admission/action-router files (7 module .ts under
    // runtime/admission + 3 module .ts under runtime/action-router +
    // 5 unit-test .ts under runtime/test: p6t2-helpers + 4 suites) +
    // 9 P6-T3 messaging-coordination files (5 module .ts under
    // runtime/messaging + 4 unit-test .ts under runtime/test:
    // p6t3-helpers + 3 suites) +
    // 11 P6-T4 control files (4 module .ts under runtime/control:
    // errors, types, service, index + 7 unit-test .ts under
    // runtime/test: p6t4-helpers + 6 suites) +
    // 12 P6-T5 activity-ledger files (6 module .ts under runtime/activity
    // + 6 unit-test .ts under runtime/test: p6t5-helpers + 5 suites) +
    // 12 P6-T6 team-tools files (4 module .ts under tools/src: tokens,
    // guard, tools, types + 6 unit-test files under tools/test:
    // p6t6-helpers, p6t6-actions.test, p6t6-guard.test,
    // p6t6-bypass-scan.test, p6t6-bypass-scan.mjs, p6t6-bypass-scan.d.mts
    // + 2 real-instance harness .mjs under tools/harness: plugin, run) +
    // 11 P7-T1 compatibility-drift/ACK-lifecycle files (6 module .ts under
    // runtime/compatibility: types, errors, blueprint, drift, probe, index +
    // 5 unit-test .ts under runtime/test: p7t1-helpers,
    // p7t1-probe-generation.test, p7t1-ack-fingerprint.test,
    // p7t1-cold-resume.test, p7t1-inflight-drift.test)) +
    // 13 P7-T3 lifecycle files (8 module .ts under runtime/lifecycle:
    // types, errors, resolve, quiesce, archive, restore, dispose, index +
    // 5 unit-test .ts under runtime/test: p7t3-helpers + 4 suites:
    // p7t3-archive-running, p7t3-descendant-drain,
    // p7t3-restore-no-agent, p7t3-dispose-race)) +
    // + 2 real-instance harness .mjs under tools/harness: plugin, run
    // + 11 P7-T4 fork-reconciliation files (5 module .ts under
    // runtime/fork-reconciliation: errors, types, reconciler, adapter,
    // index + 6 unit-test .ts under runtime/test: p7t4-helpers +
    // 5 suites)) +
    // 12 P7-T5 handoff files (4 module .ts under runtime/handoff: types,
    // errors, service, index + 8 files under runtime/test:
    // p7t5-helpers, p7t5-snapshot-once.test, p7t5-source-mutate.test,
    // p7t5-target-inspect.test, p7t5-failure-before-root-create.test,
    // p7t5-no-creation-scan.test, p7t5-no-creation-scan.mjs,
    // p7t5-no-creation-scan.d.mts)) +
    // + 2 real-instance harness .mjs under tools/harness: plugin, run
    // + 4 P7-T6 legacy teammates adapter files under legacy (1 core
    // .ts + 1 fs seam .mjs + 1 .d.mts type surface + 1 unit-test .ts) +
    // 13 P7-T2 future-boundary mutation files (5 module .ts under
    // runtime/mutation: types, errors, envelope, service, index + the
    // runtime/policy-adapter.ts + 7 unit-test .ts under runtime/test:
    // p7t2-helpers + 6 suites: p7t2-future-boundary, p7t2-escalation,
    // p7t2-override-precedence, p7t2-policy-state, p7t2-creation-fields,
    // p7t2-provenance) +
    // + 17 P7-T7 legacy session reader files under legacy (5 module .ts
    // under legacy/session-reader: types, errors, format, inspect, index +
    // 7 in-process suite .ts under legacy/test: p7t7-helpers + 6 suites:
    // p7t7-legacy-read, p7t7-mutation-reject,
    // p7t7-integrated-drift-ack, p7t7-integrated-override-admission,
    // p7t7-integrated-lifecycle-restore, p7t7-integrated-fork-handoff +
    // 5 real-instance harness .mjs under
    // legacy/session-reader/e2e: ts-loader, fs-seam, mini-mcp, plugin,
    // run) +
    // 17 P8-T1 projection contract files (12 module .ts under
    // contracts/src/projection: common, schema, states, effective-config,
    // compatibility, activity, template, root, member, ledger, projection,
    // index + 5 unit-test .ts under contracts/test:
    // p8t1-projection-fixtures + 4 suites: p8t1-projection-serialization,
    // p8t1-projection-generation, p8t1-projection-overlay,
    // p8t1-projection-negative)).
    expect(scanResult.filesScanned).toBe(428)
    expect(scanResult.files.length).toBe(428)
  })

  it('exclusion contract: exactly the two self-referential files are excluded, in sorted order', () => {
    expect(scanResult.excludedSelfFiles).toEqual([
      'packages/testkit/fault-injection/session-event-scan.mjs',
      'packages/testkit/test/p4t6-session-event-scan.test.ts',
    ])
  })

  it('zero denylist violations outside the frozen quarantine set (no files skipped)', () => {
    const outside = scanResult.hits.filter(
      (h) => !QUARANTINE_FILES.has(h.file),
    )
    expect(outside).toEqual([])
  })

  it('zero legacy payload symbols anywhere in the tree', () => {
    expect(scanResult.summary.payloadSymbol).toBe(0)
  })

  it('zero legacy declaration-merging patterns anywhere in the tree', () => {
    expect(scanResult.summary.declarationMerge).toBe(0)
  })

  it('quarantine hits pinned exactly: fifteen event-string occurrences, the recorded adjudication', () => {
    // The frozen detection vocabulary (invariant 42: vNext has no Team
    // SessionEvents) lives in the v1 quarantine module and in the
    // contracts negative test that exercises the detection function.
    // Every other occurrence would be a true violation.
    const pinned = scanResult.hits.map(
      (h) => h.kind + '|' + h.file + ':' + h.line + ':' + h.column + '|' + h.token,
    )
    expect(pinned).toEqual([
      'event-string|packages/contracts/src/legacy-vocabulary.ts:7:5|team/member-bound',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:7:26|team/progress',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:7:43|team/control-request',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:8:4|team/control-decision',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:8:29|team/message',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:51:3|team/member-bound',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:52:3|team/progress',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:53:3|team/control-request',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:54:3|team/control-decision',
      'event-string|packages/contracts/src/legacy-vocabulary.ts:55:3|team/message',
      'event-string|packages/contracts/test/negative.test.ts:119:7|team/member-bound',
      'event-string|packages/contracts/test/negative.test.ts:120:7|team/progress',
      'event-string|packages/contracts/test/negative.test.ts:121:7|team/control-request',
      'event-string|packages/contracts/test/negative.test.ts:122:7|team/control-decision',
      'event-string|packages/contracts/test/negative.test.ts:123:7|team/message',
    ])
    expect(scanResult.summary.eventString).toBe(15)
    expect(scanResult.summary.total).toBe(15)
  })

  it('positive control: a legacy declaration-merge sample is detected (events + payload symbols + one file-level merge)', () => {
    const sample = [
      "import type {",
      "  TeamControlDecisionData,",
      "  TeamControlRequestData,",
      "  TeamMemberBoundData,",
      "  TeamMessageData,",
      "  TeamProgressData,",
      "} from './legacy-payloads'",
      '',
      "declare module '@deepseek-ai/dsh-session/types' {",
      '  interface SessionEventMap {',
      "    'team/control-decision': TeamControlDecisionData",
      "    'team/control-request': TeamControlRequestData",
      "    'team/member-bound': TeamMemberBoundData",
      "    'team/message': TeamMessageData",
      "    'team/progress': TeamProgressData",
      '  }',
      '}',
    ].join('\n')
    const hits = matchDenyListInText(sample)
    const events = hits.filter((h) => h.kind === 'event-string')
    const payloads = hits.filter((h) => h.kind === 'payload-symbol')
    const merges = hits.filter((h) => h.kind === 'declaration-merge')
    expect(events.length).toBe(5)
    // five import-list occurrences + five interface-body occurrences
    expect(payloads.length).toBe(10)
    expect(merges.length).toBe(1)
    // the file-level merge is anchored at the first SessionEventMap line
    expect(merges[0]?.line).toBe(10)
    expect(hits.length).toBe(16)
  })

  it('positive control: an emitter sample is detected (event strings + payload symbols, no merge)', () => {
    const sample = [
      'function emit(events, payload) {',
      "  events.append('team/progress', payload)",
      '  const d: TeamControlDecisionData = {} as TeamControlDecisionData',
      "  events.append('team/progress', d)",
      '  return d',
      '}',
    ].join('\n')
    const hits = matchDenyListInText(sample)
    const events = hits.filter((h) => h.kind === 'event-string')
    const payloads = hits.filter((h) => h.kind === 'payload-symbol')
    const merges = hits.filter((h) => h.kind === 'declaration-merge')
    expect(events.length).toBe(2)
    expect(payloads.length).toBe(2)
    expect(merges.length).toBe(0)
  })

  it('negative control: near-miss tokens produce zero hits (exact/word precision)', () => {
    const sample = [
      "events.append('team/unknown', payload)",
      "events.append('user/message', payload)",
      "events.append('team/progress-report', payload)",
      'const x: TeamProgressDataX = makeX()',
      'export interface SessionEventMap {} // no team events, no session specifier',
    ].join('\n')
    expect(matchDenyListInText(sample)).toEqual([])
  })

  it('suite citation: all eight required P4 evidence suites are present in the scanned tree', () => {
    expect(REQUIRED_SUITES.length).toBe(8)
    expect(REQUIRED_SUITES.every((s) => scanResult.files.includes(s))).toBe(true)
    expect(
      scanResult.files.filter((s) => REQUIRED_SUITES.includes(s)).length,
    ).toBe(8)
  })
})
