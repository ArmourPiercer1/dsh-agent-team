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

/**
 * The only files allowed to carry denylist tokens (frozen quarantine):
 * the v1 quarantine module and the contracts negative test that
 * exercises the detection function. P9-T10 (P9-S7 DROP) removed the
 * temporary P9-T1 entry (team-marker-definition.client.spec.ts and its
 * six fixture tokens) together with the spec itself, restoring this
 * original two-file set.
 */
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

  it('coverage: all nine package dirs discovered, nine carry source, 537 files scanned, runtime carries the P7-T2 mutation files and the P8-T2 projection service, legacy carries the P7-T6 adapter and the P7-T7 session reader, contracts carries the P8-T1 projection DTO, remote carries the P8-T3 contract v1 + handlers and the P8-T4 push engine + test client, G8-S1 adds its two gate-supplement test files (storage stamp-advance + runtime generation-stamp), P8-S4B adds its four mutation/agent-setup sources and four p8s4b test files, P8-S5A adds its thirteen production-assembly files (plugin types + seams + root + projection source + legacy surface + node-min shim + upstream resolver + live bindings + five test files), P8-S5B adds its shared team-operation coordination module and the operation-fencing acceptance test, P8-S6 adds its three remote/principal/overlay production sources and five p8s6 test files, P8-S7R1 adds its two initial-work test files (wire contract + runtime admission), P8-S7-R2 adds its ten policy/model-state view files (contracts model-state + disposed-history DTOs + runtime durable-mutation-store, effective-config-view, model-state-view + five p8s7r2 test files), P8-S7-R4 adds its one handoff-surface production module and five p8s7r4 test files, P9-T1 adds its eleven scannable legacy-copy files (four team model .ts + the ui locales.ts + six legacy-copy spec .ts) and P9-T2 adds its css-modules.d.ts, and remote-mount-race adds its four fix test files (storage create-or-open + runtime mount race + runtime create-or-open boot + runtime team-tools registration), and TCM-M1 adds its two v2-surface test files (remote versioned-contract dispatcher spec + runtime s6 production-dispatcher version-routing spec), and D2 (Team D1-D6 repair v2) adds its two v3-surface test files (runtime s6 ensureRootLive handler spec + client open-team-mode mount spec), recording the nine missed increments since the TCM-D4 pin, and D3 (Team D1-D6 repair v2) adds its one ordinary-mode client-mount spec, and A2 (alpha.2 canonical operation) adds its seven scannable operation-permission files (module core types + errors + canonical-operation + index, the fake-resolver unit spec, the real fs-local backend spec .mjs + its .d.mts type surface), recording the ten missed alpha.1 T1-T4 capability increments since the repair-r1 pin + the alpha.2 A1 permission-policy spec file + the A4 control exact-scope spec file + the A3 static resolver source and spec (int integration)', () => {
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
    // T12 integration pin (543 baseline + 15 merged lane files):
    // lane A +9 (t12a-live-bridge.mjs + t12a-live-bridge.d.mts + the seven
    // t12a-b2/b3/h1/m1/m2/m3/glue test files) + lane B +3 (tests
    // t12b1-real-create, t12b2-resume-separation, t12b6-handoff-agent-start)
    // + lane C +3 (tests t12h4-s6-fail-closed, t12b4-principal-context,
    // t12m4-remote-mount); all under packages/runtime/test (.ts/.mts/.mjs
    // are all scanned by the frozen scanner).
    // T12-V vertical pin (558 + 2 vertical harness files): the T12-V
    // vertical-slice work adds two scanned files under
    // packages/tools/harness — t12-vertical.mjs (phase runner, 7-junction
    // bridge, budget ledger, deferred-content calibration) and
    // mock-deepseek.mjs (spec-strict mock model + verbatim capture); both
    // carry zero denylist vocabulary (the denylist scan over them passes).
    // P9-T1 legacy-copy pin (560 + 11): the verbatim legacy team UI copy
    // adds eleven scannable files under packages/client — four model .ts
    // (team-dock-model, team-feed-model, team-members-model,
    // team-timeline-model), the ui locales.ts, and six legacy-copy spec
    // .ts (client-bundle, team-dock-model, team-feed-model,
    // team-marker-definition, team-members-model, team-timeline-model);
    // the .tsx and .css copies are outside the frozen scanner's extension
    // set. team-marker-definition.client.spec.ts carries six legacy
    // event-string fixture tokens and is quarantined until the P9-T10
    // DROP removes it.
    // P9-T2 build-wiring pin (+1): packages/client/src/css-modules.d.ts.
    // P9-T3 frozen-remote client pin (+5): the S2-A/S2-B sources and their
    // two specs — three src .ts (transport/host-seams,
    // transport/team-remote-client, state/team-projection-store) plus
    // test/team-remote-client.test.ts and test/team-projection-store.test.ts;
    // all five carry zero denylist vocabulary (the scan over them passes).
    // P9-T4 ledger cursor store + vNext UI adapters pin (+10): six src
    // .ts (model/team-view-compat, model/team-ui-snapshot,
    // model/projection-adapter, model/ledger-adapter,
    // state/team-session-resolution, state/team-ledger-store) plus four
    // test .ts (test/team-session-resolution.test, test/projection-adapter.test,
    // test/ledger-adapter.test, test/team-ledger-store.test); all ten carry
    // zero denylist vocabulary (the scan over them passes).
    // P9-T6 UI-adaptation pin (587 - 1): the T6 collapse deletes two
    // scannable src .ts (model/team-view-compat, model/team-feed-model)
    // and their spec .ts (test/team-feed-model.client.spec) and adds one
    // scannable src .ts (model/team-ledger-model) plus one spec .ts
    // (test/team-ledger-model.client.spec); the .tsx/.css adaptations
    // (TeamFeed -> TeamLedger, TeamTasks -> TeamActivity, the rewritten
    // team-view spec) are outside the scanner's extension set; the net
    // scan-target count drops by one and the new files carry zero
    // denylist vocabulary (the scan over them passes).
    // P9-T7 new-team + member-command flows pin (+4): two src .ts
    // (model/team-intent-model, model/team-member-commands) plus two
    // spec .ts (test/team-intent-model.test,
    // test/team-member-commands.test); the two new .tsx jsdom specs
    // (team-creation-panel.client.spec, team-members-actions.client.spec)
    // and the CSS modules are outside the scanner's extension set; all
    // four scanned files carry zero denylist vocabulary (the scan over
    // them passes).
    // P9-T8 governance/handoff/legacy model pin (+6): three src .ts
    // (model/team-governance, model/team-handoff, model/team-legacy)
    // plus three spec .ts (test/team-governance.test,
    // test/team-handoff.test, test/team-legacy.test); the three new
    // .tsx jsdom specs (team-governance.client.spec,
    // team-creation-handoff.client.spec, team-legacy.client.spec), the
    // new CSS module, and the T7 .tsx/.css edits are outside the
    // scanner's extension set; all six scanned files carry zero
    // denylist vocabulary (the scan over them passes).
    // P9-T9 client mount pin (+2): the D-T9-13 core/glue split adds two
    // scannable .ts (src/plugin/team-mount-core — the pure-.ts mount core —
    // and test/client-plugin-mount.test — its behavior spec); the glue
    // rewrite (src/plugin/client) and the test/client.test.ts rewrite are
    // in-place edits (no count change); the .tsx component entries and
    // their CSS modules are outside the scanner's extension set; both new
    // files carry zero denylist vocabulary (the scan over them passes).
    // P9-T10 test-migration pin (598 + 3 - 1): the P9-S7 test migration
    // adds three scannable .test.ts under packages/client (
    // test/client-architecture-negatives.test, test/team-remote-categories.
    // test, test/team-command-flow.test) and deletes the quarantined
    // team-marker-definition.client.spec.ts (its six fixture tokens leave
    // the scan with it); the client-bundle.client.spec.ts and
    // team-plugin.client.spec.tsx rewrites are in-place (no count change);
    // the new jsdom specs and the CSS modules are outside the scanner's
    // extension set; all three new files carry zero denylist vocabulary
    // (the scan over them passes).
    // P9-S8 bug #5 regression-test pin (+1): the bug #5 fix commit
    // (48d7330) added packages/client/test/team-members-model.test.ts
    // (the zero-instance template-rows regression spec; zero denylist
    // vocabulary — the scan over it passes) without recording the
    // increment; this commit records the missed pin.
    // P9-S8 bug #9 regression-test pin (+1): the bug #9 fix commit
    // (47b41df) added packages/runtime/test/p7t3-lifecycle-fact.test.ts
    // (the lifecycle-evidence-port regression spec; zero denylist
    // vocabulary — the scan over it passes) after the pin was last
    // recorded; this commit records the increment.
    // plugin-bundle-form derivation-test pin (+1): the task/
    // plugin-bundle-form commit adds
    // packages/runtime/test/pbf-default-artifact-urls.test.ts (the
    // location-derived glue/seam default + validator-shape spec for the
    // machine-agnostic git-install surface; zero denylist vocabulary —
    // the scan over it passes). The sibling changes (host.ts, types.ts,
    // node-min.d.ts) are in-place edits (no count change); the root
    // package.json and cordis.patch.yml are outside the scanner's
    // packages/** + .ts/.mts/.mjs scope.
    // remote-mount-race fix pin (+3): the fix commits add
    // packages/storage/test/rmr-create-or-open.test.ts (the
    // adopt-or-initialize domain spec),
    // packages/runtime/test/rmr-remote-mount-race.test.ts (the bounded
    // connection-wait race regression spec), and
    // packages/runtime/test/rmr-create-or-open-boot.test.ts (the
    // row-level create-or-open phase-resolution acceptance); all three
    // carry zero denylist vocabulary (the scan over them passes). All
    // other fix changes (team-domain.ts, host.ts, types.ts,
    // cordis.patch.yml, t12m4-remote-mount.test.ts) are in-place edits
    // (no count change).
    // remote-mount-race D-2 pin (+1): the D-2 regression commit adds
    // packages/runtime/test/t12a-team-tools-registration.test.ts (the
    // team-tool registration boundary spec over the real ten-tool stack:
    // create + cold-root resume re-registration + close disposal); the
    // sibling change (t12a-live-bridge.d.mts registeredTools field) is an
    // in-place edit (no count change); the new file carries zero denylist
    // vocabulary (the scan over it passes).
    // TCM-M1 v2-surface pin (+2): this commit adds
    // packages/remote/test/tcm-m1-remote-v2.test.ts (the versioned-contract
    // dispatcher spec: v1 byte-compat, the per-version closed sets, the
    // v2-only method gating, the seven team-create v2 backing codes) and
    // packages/runtime/test/tcm-m1-s6-v2-routing.test.ts (the S6
    // production-dispatcher version-routing spec); both carry zero
    // denylist vocabulary (the scan over them passes). All other M1
    // changes (remote contracts/handlers/index, the s6-remote version
    // pass-through, the client transport, the updated focused specs, the
    // rebuilt install-surface artifacts) are in-place edits (no count
    // change).
    // Missed-increment record (+8, the pin was stale at the TCM-D4 base
    // 4216f47c — the same "record the missed pin" precedent as the P9-S8
    // bug #5/#9 entries): the commits merged after TCM-M1 added eight
    // scannable files without recording the increment — TCM-M2 adds
    // packages/runtime/src/plugin/workspace-attach.ts +
    // packages/runtime/test/tcm-m2-workspace-attach.test.ts; TCM-M3 adds
    // packages/runtime/action-router/root-initial-work.ts +
    // packages/runtime/test/tcm-m3-root-initial-work.test.ts +
    // packages/runtime/test/tcm-m3-root-work-glue.test.ts; TCM-G1 adds
    // packages/runtime/test/tcm-g1-s6-integration.test.ts; the
    // client team-create flow adds packages/client/src/model/
    // team-create-flow.ts + packages/client/test/team-create-flow.test.ts.
    // All eight carry zero denylist vocabulary (the scan over them
    // passes).
    // TCM-D4 second-root regression pin (+1): this commit adds
    // packages/runtime/test/tcm-d4-root-context.test.ts (the second-root
    // in a boot-root world spec: own-leader caller resolution, the
    // owning-root request boundaries, the model-visible root Team context
    // block, the cold-resume tool re-registration); the sibling changes
    // (agent-bindings.mjs, the t12a bridge .mjs/.d.mts, the M2/handoff
    // persona specs) are in-place edits (no count change); the new file
    // carries zero denylist vocabulary (the scan over it passes).
    // Missed-increment record (+9, the pin was stale at the TCM-D4 base
    // 6dc8931 — the same "record the missed pin" precedent as the TCM-D4
    // stale-base entry): the commits merged after TCM-D4 added nine
    // scannable files without recording the increment — the
    // WorkDeliveryResult C1/C2 line adds
    // packages/runtime/test/d3-member-identity-context.test.ts,
    // packages/runtime/test/d5-instance-contract.test.ts and
    // packages/runtime/test/p8s3b-result-effects.test.ts; D1 (Team D1-D6
    // repair v2) adds packages/runtime/src/team-ownership-index.ts (the
    // pure ownership-index module),
    // packages/runtime/test/d1-team-ownership-index.test.ts,
    // packages/runtime/test/d1-s6-remote-v3.test.ts,
    // packages/runtime/test/d1-member-base-tools.test.ts,
    // packages/remote/test/d1-remote-v3.test.ts and
    // packages/client/test/d1-team-remote-v3.test.ts. All nine carry
    // zero denylist vocabulary (the scan over them passes).
    // D2 (Team D1-D6 repair v2) pin (+2): this commit adds
    // packages/runtime/test/d2-s6-ensure-root-live.test.ts (the S6
    // production-handler spec for the v3 team.ensureRootLive: the success
    // shape, the bound-root guard, the fail-closed absent-port code and
    // the typed failure mapping) and
    // packages/client/test/d2-open-team-mode.test.ts (the client mount's
    // AWAITED two-phase openTeamMode spec: the ensure-before-open
    // ordering, the no-open-on-typed-failure gate, the per-root client-
    // local open-mode state + session-switch reset); the sibling changes
    // (s6-remote.ts, root.ts, team-mount-core.ts, TeamView/TeamMembers/
    // locales/CSS in-place edits + the .tsx spec, outside the scanner's
    // .ts/.mts/.mjs scope) are no count change. Both new files carry
    // zero denylist vocabulary (the scan over them passes).
    // D3 (Team D1-D6 repair v2) ordinary-mode client-mount spec (+1):
    // this commit adds packages/client/test/d3-open-ordinary-mode.test.ts
    // (the explicit ordinary-mode fallback entry of the client mount:
    // the pure native open with zero team.* carrier calls, the 'ordinary'
    // open-mode value + session-switch reset, the team→ordinary→team
    // switch pin, the idempotent repeat, the failed-switch no-op); the
    // sibling changes (team-mount-core.ts, TeamView/TeamMembers/locales
    // in-place edits + the .tsx spec, outside the scanner's
    // .ts/.mts/.mjs scope) are no count change. The new file carries
    // zero denylist vocabulary (the scan over it passes).
    // repair-r1 pin (630 + 12, the pin was stale at the D3 commit
    // 1386a9b — the same "record the missed pin" precedent as the
    // TCM-D4 stale-base entries): the F3/F11/F9/T1.4 repair round r1
    // work merged into int/repair-r1 (base 97d4729) added twelve
    // scannable files without recording the increment — F3 adds its
    // three lock-scope specs (runtime test f3a-lock-scope,
    // f3b-root-initial-work-lock-scope, f3c-messaging-sibling); F9
    // adds its six (remote test f9-remote-v4, client test
    // f9-remote-client-v4, runtime test f9-control-exactly-once,
    // runtime test f9-s6-resolve-control, the client-local
    // control-surface model packages/client/src/model/control-surface.ts
    // + its spec client test f9u-control-surface-model); T1.4 (T14-H)
    // adds its pre-creation probe-merge spec (runtime test
    // t14h-probe-merge); the Team D1-D6 repair v2 acceptance runners add
    // two tools/harness .mjs (d4-restart-reopen, g5-member-e2e). All
    // twelve carry zero denylist vocabulary (the scan over them passes
    // — the frozen quarantine hit set is unchanged at fifteen
    // occurrences). Independently re-verified on the clean candidate
    // worktree (filesystem walk + git ls-files enumeration byte-identical
    // to the committed scanner's file list; evidence:
    // dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/p4t6-pin/).
    // A2 (alpha.2 canonical operation) pin (642 + 17 on the A2 branch;
    // on int the A1 permission-policy spec merged first, so 642 + 18 =
    // 660): the pin was stale
    // when A2 ran — the same "record the missed pin" precedent as the
    // repair-r1 / TCM-D4 stale-base entries. Three increments are folded
    // in at once:
    //
    // (a) TEN missed increments since the repair-r1 pin (5bcb4b6) — the
    //     alpha.1 T1-T4 capability work merged into master without
    //     recording the increment: the domain/policy static capability
    //     source + its t1 spec (packages/domain/policy/src/static-
    //     capability-source.ts, packages/domain/test/t1-capability-
    //     schema.test.ts); the runtime agent-setup capability trio + its
    //     t3/t4a specs (packages/runtime/agent-setup/capability/{mcp-
    //     adapter,skill-adapter,skill-catalog}.ts,
    //     packages/runtime/test/t3-skills-mcp-adapter.test.ts,
    //     packages/runtime/test/t4a-capability-wiring.test.ts); and the
    //     tools tool-selector + builtin-deny sources + their t2 spec
    //     (packages/tools/src/{tool-selector,builtin-deny}.ts,
    //     packages/tools/test/t2-tool-selector-deny.test.ts). All ten
    //     carry zero denylist vocabulary (the scan over them passes).
    //
    // (b) ONE A1 scannable file (merged on int before A2):
    //     packages/domain/test/a1-permission-policy.test.ts (the
    //     alpha.2 permission-policy schema + hash + normalization
    //     suite). Zero denylist vocabulary (the scan over it passes).
    //     Recorded on int at the A1+A2 integration.
    //
    // (c) SEVEN A2 scannable files (this commit): the operation-
    //     permission module (packages/runtime/operation-permission/
    //     {types,errors,canonical-operation,index}.ts) and its two spec
    //     files (packages/runtime/test/a2-canonical-operation.test.ts,
    //     the fake-resolver unit spec; packages/runtime/test/a2-
    //     canonical-operation-realfs.mjs, the real fs-local backend
    //     contract spec, + its a2-canonical-operation-realfs.d.mts type
    //     surface). All seven carry zero denylist vocabulary (the scan
    //     over them passes — the frozen quarantine hit set is unchanged
    //     at fifteen occurrences).
    //
    // (d) ONE A4 scannable file (merged on int after A2):
    //     packages/runtime/test/a4a-control-exact-scope.test.ts (the
    //     alpha.2 control exact-fingerprint scope + wait-bridge suite).
    //     Zero denylist vocabulary (the scan over it passes). Recorded on
    //     int at the A1+A2+A4 integration.
    //
    // (e) TWO A3 scannable files (merged on int after A4):
    //     packages/runtime/operation-permission/permission-resolver.ts
    //     (the alpha.2 static resolver source) +
    //     packages/runtime/test/a3-permission-resolver.test.ts (its
    //     28-test spec). Zero denylist vocabulary (the scan over them
    //     passes). Recorded on int at the A1+A2+A4+A3 integration.
    //
    // (f) TWO A5 scannable files (this commit, the alpha.2 pre-execute
    //     enforcement adapter task): packages/runtime/operation-
    //     permission/pre-execute-adapter.ts (the tools/pre-execute
    //     adapter source — the classify → canonicalize → static decision
    //     → ask: request → wait → guard pipeline over the frozen A2/A3/
    //     A4 APIs) + packages/runtime/test/a5a-pre-execute.test.ts (its
    //     39-test spec over the real A4 durable control service). Zero
    //     denylist vocabulary (the scan over them passes). Recorded on
    //     the A5 task branch; re-verified on int at the A5 integration.
    //
    // (g) ONE A6 scannable file (this commit, the alpha.2 production
    //     wiring task): packages/runtime/test/a6a-production-wiring.
    //     test.ts (the A1–A5 composition spec over the REAL live glue +
    //     the t12a bridge doubles: the install decision — absent
    //     permissions = zero tools/pre-execute listeners (the legacy/
    //     alpha.1 regression proof), present = exactly one per permitted
    //     agent — the listener lifecycle (cold-resume reinstall, close
    //     drain), the driven frozen A5 pipeline over the spy control
    //     service + the fake fs seam, and the control-service ref
    //     contract (lazy read, fail-closed typed error)). Zero denylist
    //     vocabulary (the scan over it passes — the frozen quarantine
    //     hit set is unchanged at fifteen occurrences). Recorded on the
    //     A6 task branch; re-verified on int at the A6 integration.
    //
    // (h) ONE H1 scannable file (this commit, the alpha.2 hardening P0
    //     end-cap task): packages/runtime/test/h1a-pre-execute-endcap.
    //     test.ts (the monotonic end-cap guard spec over the REAL
    //     upstream composition: a real cordis Context + ToolRuntime +
    //     dsh-scope agent scope + the real A4 durable control service —
    //     the hostile prepend-allow bypass probes P0-A…P0-J + A9/A15/
    //     A16, the full ask→allow regression P0-G, and the composite-
    //     disposer + fail-closed install specs). Zero denylist
    //     vocabulary (the scan over it passes — the frozen quarantine
    //     hit set is unchanged at fifteen occurrences). The sibling
    //     changes (pre-execute-adapter.ts, errors.ts, index.ts, the
    //     a5a/a6a suite updates, the t12a bridge .mjs/.d.mts double
    //     extensions) are in-place edits (no count change). Recorded on
    //     the H1 task branch; re-verify on int at the alpha2-hardening
    //     integration.
    //
    // (h2) IN-PLACE EDITS ONLY, no scannable file added (this commit,
    //     the alpha.2 hardening P1 vertical — three P1 findings): the
    //     P1-1 bash contract ruling (domain validate.ts + the a1
    //     fixtures/suite + the a3 recorded-ruling doc + the a6a policy
    //     fixture), the P1-2 bash command-binding fingerprint (A2
    //     canonical-operation.ts + the closed bash-command-* reasons in
    //     errors.ts + the a2/a5a suite updates) and the P1-3 deny-rule
    //     fail-closed flip (pre-execute-adapter.ts + the a5a
    //     DR-A..DR-D legs) are all in-place edits on already-scanned
    //     files, so the scanned count is UNCHANGED at 667 (642 + 10 +
    //     1 + 7 + 1 + 2 + 2 + 1 + 1 — no new file). Zero denylist
    //     vocabulary (the scan over the touched files passes — the
    //     frozen quarantine hit set is unchanged at fifteen
    //     occurrences). Recorded on the H2 task branch; re-verify on
    //     int at the alpha2-hardening integration.
    //
    // Independently re-verified on the int tree at each integration: the
    // committed scanner's own run reports filesScanned == files.length ==
    // 667 (642 + 10 + 1 + 7 + 1 + 2 + 2 + 1 + 1), and its file list names
    // exactly the twenty-five files above (ten alpha.1 + one A1 + seven
    // A2 + one A4 + two A3 + two A5 + one A6 + one H1; the committed
    // scanner is byte-identical — no scanner change, DEC-1). The frozen
    // quarantine hit set and all required P4 suite lists are untouched.
    // Evidence: dev/agent-workflow/evidence/alpha2-permission/a2/ + a3/ +
    // a4/ + a5/ + a6/ + alpha2-hardening/h1/.
    expect(scanResult.filesScanned).toBe(667)
    expect(scanResult.files.length).toBe(667)
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
    // 15 frozen-quarantine occurrences (the P9-T1 temporary entry and its
    // six fixture tokens left the scan with the spec at the P9-T10 DROP).
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
