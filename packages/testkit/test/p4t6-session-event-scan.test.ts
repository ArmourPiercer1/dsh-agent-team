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

  it('coverage: all nine package dirs discovered, nine carry source, 537 files scanned, runtime carries the P7-T2 mutation files and the P8-T2 projection service, legacy carries the P7-T6 adapter and the P7-T7 session reader, contracts carries the P8-T1 projection DTO, remote carries the P8-T3 contract v1 + handlers and the P8-T4 push engine + test client, G8-S1 adds its two gate-supplement test files (storage stamp-advance + runtime generation-stamp), P8-S4B adds its four mutation/agent-setup sources and four p8s4b test files, P8-S5A adds its thirteen production-assembly files (plugin types + seams + root + projection source + legacy surface + node-min shim + upstream resolver + live bindings + five test files), P8-S5B adds its shared team-operation coordination module and the operation-fencing acceptance test, P8-S6 adds its three remote/principal/overlay production sources and five p8s6 test files, P8-S7R1 adds its two initial-work test files (wire contract + runtime admission), P8-S7-R2 adds its ten policy/model-state view files (contracts model-state + disposed-history DTOs + runtime durable-mutation-store, effective-config-view, model-state-view + five p8s7r2 test files), P8-S7-R4 adds its one handoff-surface production module and five p8s7r4 test files', () => {
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
    // p8t1-projection-negative) +
    // 12 P8-T2 projection service files (6 module .ts under
    // runtime/projection: types, errors, ledger, fold, service, index +
    // 6 files under runtime/test: p8t2-helpers + 5 suites:
    // p8t2-cold, p8t2-fifty, p8t2-overlay, p8t2-terminal,
    // p8t2-negative)) +
    // 29 P8-T3 remote contract files (21 module .ts under remote/src:
    // 9 contracts/* modules + 12 handlers/* modules — the remote
    // index.ts pre-existed as the package skeleton and is already
    // counted in the pre-existing base — + 8 test files under
    // remote/test: p8t3-helpers, p8t3-round-trip.test,
    // p8t3-invalid-ids.test, p8t3-admission.test, p8t3-version.test,
    // p8t3-negative.test, p8t3-negative-scan.mjs,
    // p8t3-negative-scan.d.mts) +
    // 13 P8-T4 push model files (6 module .ts under remote/src/push:
    // types, generation, pull, reconnect, ledger-page, index +
    // 7 files under remote/test: p8t4-engine.test, p8t4-sync.test,
    // p8t4-negative.test, p8t4-negative-scan.mjs,
    // p8t4-negative-scan.d.mts, p8t4-server, p8t4-test-client) +
    // 2 G8-S1 gate-supplement test files (storage g8s1-stamp-advance +
    // runtime g8s1-generation-stamp) +
    // 2 P8-S2 leader-contract test files (contracts
    // leader-instance-record.test + runtime p8s2-leader-contract.test) +
    // 4 P8-S3 work-execution files (module
    // runtime/action-router/work-execution + tests
    // runtime p8s3-work-request, runtime p8s3-work-chain,
    // storage p8s3-member-cas) +
    // 4 P8-S4A unified compatibility admission files (module
    // runtime/compatibility/authority + tests
    // runtime p8s4a-helpers, runtime p8s4a-chain,
    // runtime p8s4a-entrypoints) +
    // 8 P8-S4B durable mutation closure files (module
    // runtime/agent-setup/capability/mcp-facet +
    // runtime/agent-setup/model/durable-consumption +
    // runtime/mutation/cell-provenance +
    // runtime/mutation/override-admission + tests
    // runtime p8s4b-cell-provenance, runtime p8s4b-mcp-facet,
    // runtime p8s4b-model-consumption,
    // runtime p8s4b-override-admission) +
    // 13 P8-S5A production-assembly files (module
    // runtime/plugin/types, runtime/plugin/seams,
    // runtime/plugin/root, runtime/plugin/projection-source,
    // runtime/plugin/legacy-surface, runtime/plugin/node-min.d,
    // runtime/plugin/upstream-resolver.mjs,
    // runtime/plugin/live/agent-bindings.mjs + tests
    // runtime p8s5a-artifacts.mjs, runtime p8s5a-artifacts.d.mts,
    // runtime p8s5a-stub-glue.mjs,
    // runtime p8s5a-host-loadability.test,
    // runtime p8s5a-production-assembly.test) +
    // 2 P8-S5B operation-fencing files (module
    // runtime/coordination/index + test
    // runtime p8s5b-operation-fencing.test) +
    // 8 P8-S6 remote/principal/overlay files (3 module .ts under
    // runtime/src/plugin: s6-remote, s6-principal,
    // s6-live-overlay + 5 unit-test .ts under runtime/test:
    // p8s6-projection, p8s6-principal, p8s6-remote-commands,
    // p8s6-push-reconnect, p8s6-pagination) +
    // 2 P8-S7R1 creation/preflight test files (tests
    // runtime p8s7r1-create-params, runtime p8s7r1-initial-work) +
    // 10 P8-S7-R2 policy/model-state view files (module
    // contracts/src/projection/model-state + contracts/src/projection/disposed-history + runtime/src/plugin:
    // durable-mutation-store, effective-config-view,
    // model-state-view + 5 unit-test .ts under runtime/test:
    // p8s7r2-policy-state-durable, p8s7r2-effective-config,
    // p8s7r2-model-state, p8s7r2-residency-resuming,
    // p8s7r2-disposed-history). +
    // 1 P8-S7-R4 handoff-surface production module (module
    // runtime/src/plugin/handoff-surface: readCanonicalSourceSurface +
    // summarizeSourceSurface) +
    // 5 P8-S7-R4 handoff/fork test files (tests
    // runtime p8s7r4-handoff-surface, runtime p8s7r4-handoff-wiring,
    // runtime p8s7r4-bc22-idempotency,
    // runtime p8s7r4-bc23-24-no-mutation,
    // runtime p8s7r4-fork-describe).
    // T12 lane A +9 files: t12a-live-bridge.mjs + t12a-live-bridge.d.mts +
    // the seven t12a-b2/b3/h1/m1/m2/m3/glue test files under runtime/test
    // (.ts/.mts/.mjs are all scanned by the frozen scanner).
    expect(scanResult.filesScanned).toBe(552)
    expect(scanResult.files.length).toBe(552)
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
