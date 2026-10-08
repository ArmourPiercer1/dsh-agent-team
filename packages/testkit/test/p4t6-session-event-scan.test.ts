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

  it('coverage: all nine package dirs discovered, nine carry source, 979 files scanned, runtime carries the P7-T2 mutation files and the P8-T2 projection service, legacy carries the P7-T6 adapter and the P7-T7 session reader, contracts carries the P8-T1 projection DTO, remote carries the P8-T3 contract v1 + handlers and the P8-T4 push engine + test client, G8-S1 adds its two gate-supplement test files (storage stamp-advance + runtime generation-stamp), P8-S4B adds its four mutation/agent-setup sources and four p8s4b test files, P8-S5A adds its thirteen production-assembly files (plugin types + seams + root + projection source + legacy surface + node-min shim + upstream resolver + live bindings + five test files), P8-S5B adds its shared team-operation coordination module and the operation-fencing acceptance test, P8-S6 adds its three remote/principal/overlay production sources and five p8s6 test files, P8-S7R1 adds its two initial-work test files (wire contract + runtime admission), P8-S7-R2 adds its ten policy/model-state view files (contracts model-state + disposed-history DTOs + runtime durable-mutation-store, effective-config-view, model-state-view + five p8s7r2 test files), P8-S7-R4 adds its one handoff-surface production module and five p8s7r4 test files, P9-T1 adds its eleven scannable legacy-copy files (four team model .ts + the ui locales.ts + six legacy-copy spec .ts) and P9-T2 adds its css-modules.d.ts, and remote-mount-race adds its four fix test files (storage create-or-open + runtime mount race + runtime create-or-open boot + runtime team-tools registration), and TCM-M1 adds its two v2-surface test files (remote versioned-contract dispatcher spec + runtime s6 production-dispatcher version-routing spec), and D2 (Team D1-D6 repair v2) adds its two v3-surface test files (runtime s6 ensureRootLive handler spec + client open-team-mode mount spec), recording the nine missed increments since the TCM-D4 pin, and D3 (Team D1-D6 repair v2) adds its one ordinary-mode client-mount spec, and A2 (alpha.2 canonical operation) adds its seven scannable operation-permission files (module core types + errors + canonical-operation + index, the fake-resolver unit spec, the real fs-local backend spec .mjs + its .d.mts type surface), recording the ten missed alpha.1 T1-T4 capability increments since the repair-r1 pin + the alpha.2 A1 permission-policy spec file + the A4 control exact-scope spec file + the A3 static resolver source and spec (int integration), and exec-autonomy-contract adds its two spec files (the domain leader-allow-lane contract spec + the runtime dual-gate spec), recording the two increments since the PR #18 pin, and the work-completion-wakeup adds its six scannable files (the runtime work-completion-notification module types + renderer + index, the pure-module spec, the live-glue spec, and the router-observer spec), and team-send-message-liveness adds its one acceptance-boundary regression spec and team-archive-member adds its one A1–A9 tool spec (packages/tools/test/archive-member-tool.test.ts) on the PR #25 merge, and strict-read-core-spill (PR #26 supplemental) adds its one pending-grant table source (runtime artifact-read pending.ts), and strict-read-core-spill (PR #26 final supplemental) adds its one composition override regression spec (runtime team-spill-local-composition.test.ts), and model-preference-routing (fix-model-preference-routing) adds its five scannable files (the runtime model token parser route.ts + the template model grant helper template-model.ts + the Gate B template-model-preference spec + the Gate D model-activation-step8 spec + the Gate E model-blueprint-initial-routing spec), and restart-recovery-017rc1 (task/team-restart-017rc1) adds its one v5 remote contract spec (remote c1-remote-v5.test.ts, the Commit-3 ordinary-open one-shot permit surface), recording the one missed Commit-3 increment since the Commit-2 pin, and restart-recovery-017rc1 supplemental (PR #31 fix round S1–S5) adds its two new scannable test files (runtime team-session-startup-fence H1/H2 spec + client s3-client-generation-spike evidence), recording the two missed supplement increments since the merge-union pin, and v4-work-completion-source (fix/v4-work-completion-source) adds its one live-glue producer-kind type declaration (runtime message-sources.d.ts, the MessageSourceMap augmentation for the producer-owned plugin:dsh-agent-team wake source), recording the one increment since the PR #31 pin, and team-projection-recovery-20260927 (fix/team-projection-recovery-20260927) adds its one compatibility-scope regression spec (runtime team-compatibility-scope.test.ts, the per-target-team compatibility prober scope), recording the one increment since the v4-work-completion-source pin, and team-view-sync-complete (fix/team-view-sync-complete-20260927) adds its ten v6-surface files (the runtime pure session read-state resolver + the pure live-token module and its three s6t specs (read-state resolver / live-token / s6 production-dispatcher v6), the remote pull-v6 pair assessor module and its c6 remote-v6 spec, and the client mount-level refresh coordinator module and its two v6 specs (projection store v6 identity + refresh coordinator)), recording the ten increments since the team-projection-recovery pin, and team-view-sync-complete (fix/team-view-sync-complete-20260927) PR #35 review follow-up adds its two read-state-driven refresh files (the client read-state model module + its outcome-matrix spec), recording the two increments since the v6-surface pin, and team-view-sync-complete (fix/team-view-sync-complete-20260927) PR #35 second follow-up adds its one Team-scoped overlay collision spec (runtime p01-team-scoped-overlay.test.ts, the two-team leader-collision unit over the real overlay + projection service + both token paths), recording the one increment since the review-follow-up pin, and pre-alpha3 PR-A (feat/pre-alpha3-pra-governance) adds its nine scannable files (the runtime governance mutation authority module — types/slot/service/index — plus its five governance test files: mutation-authority / concurrency / idempotence / reset-tombstone / restart), recording the nine increments since the PR-0 pin, and pre-alpha3 PR-B (feat/pre-alpha3-prb-effective-policy) adds its ten scannable files (the runtime effective-policy canonical read module — packages/runtime/effective-policy/types.ts + reader.ts + select.ts + legacy.ts + activation-policy.ts + index.ts — plus its four specs: packages/runtime/test/effective-policy-single-source.test.ts / effective-policy-policy-state-live.test.ts / boundary-committed-applied.test.ts / restart-effective-policy.test.ts), recording the ten increments since the PR-A pin, and pre-alpha3 PR-D adds its seven control-generalization test files (subject normalization + template/team subject + inline review/abandon + review payload roundtrip + legacy row compat), and pre-alpha3 PR-D review-fix (fix/pre-alpha3-w1c-control) adds its three control-abandon review test files (the narrow-close-authority spec control-abandon-without-resolve-envelope + the remote unmapped-code spec remote-control-abandoned-code + the abandon durable-write fault spec control-abandon-storage-fault), recording the three increments since the PR-D pin, and pre-alpha3 PR-D fix round 3 (feat/pre-alpha3-prd-control-generalization) adds its one wait-abort cascade suite (runtime control-inline-wait-abort.test.ts, the S1-S7 coupling-aware cascade: the inline mid-wait + pre-abort aborts durably abandon the SAME request via the shared abandon write path, the guarded/legacy aborts stay byte-identical, the decision race wins, the faulted cascade rejects typed), recording the one increment since the PR-D review-fix pin, and pre-alpha3 PR #42 fold (feat/pre-alpha3-pre-e-requirement-recovery, merge 1 ab108388) folds in the D-fix line (fix/d-req-recovery @ e696823e): its fifty-eight scannable files accumulated since the 822 pin (the nine W2-A requirement-facts + production-persona-substrate files + the thirty-five superseding PR-E cutover files (3ccbfe82) + the fourteen W3-D fix files)), recording the fifty-eight increments since the PR-D round-3 pin, and pre-alpha3 PR #42 pass 3 adds its one per-blueprint-scoping spec (runtime requirement-probe-blueprint-scoping.test.ts, the PF-1 fix suite) and pass 3b adds its two D-1/D-3 decision-scoping files (the runtime requirement-facts pending.ts classifier module + the 37-test requirement-d1-d3-decision-scoping spec), recording the three increments since the merge-1 pin, and pre-alpha3 F15 (feat/pre-alpha3-f15-mcp-live-loss) adds its two MCP live-loss specs (runtime f15-mcp-live-loss-characterization.test.ts, the RED gap probe + the public-seam tool-withdrawal evidence) and its §9 unit-matrix spec (runtime f15-mcp-live-loss.test.ts, the L1 normal / §9.4 re-sync / L2 permanent loss / L6 idempotence / L7 remount recovery / L3 zero-tool / L4 deny / L5 close / §9.5 multi-MCP isolation legs + the §9.2 static reconnect-policy call-site witness), recording the two increments since the 886 pin, and pre-alpha3 PR-F (feat/pre-alpha3-prf-closure) adds its three re-landed scannable files (the remote contracts semantic adapter (semantic.ts, the F.3 version->semantic translation + the shared live-projection wire application) + the runtime internal test-world mutation kernel (mutation/internal/mutation-service.ts, the F.2 StepClock/MutationService extraction) + the runtime same-source read-surface pin spec (prf-inspect-same-source.test.ts, the F.4 config-inspected policy/requirement/recovery views over the same durable facts the gates consume)), recording the three increments since the 888 pin, and the w1a F10/F11 stack-side re-land (master e44ebbbd, pre-e->master closure merge shared base) adds its five scannable files (the runtime bound-blueprint resolver (bound-blueprint.ts, the three-case bound-Blueprint contract) + the four runtime F10/F11 specs (governance-stale-ui-generation + remote-override-expected-generation + policy-state-multi-team-bound-blueprint + policy-state-bound-blueprint-production-wiring)), recording the five increments since the PR-F pin, and fix-runtime-template-consent (fix/runtime-template-consent, finding I) adds its one scannable regression test file (the runtime disabled-empty-template gate spec template-disable-no-requirements-gate.test.ts, the real-chain delegate-to-a-requirement-less-disabled-template block + re-enable over the durable availability fact), recording the one increment since the w1a re-land pin, and fix-runtime-template-consent (fix/runtime-template-consent, finding J) adds its one scannable regression test file (the runtime consent scope/hash binding spec consent-scope-hash-binding.test.ts, the host-entry real chain: the production creation preflight + the production consent writer — a consent is bound to the exact scope + blueprint content hash it was granted for (ADR-12): cross-scope same-reqID does not bleed, a stale rev1 consent is not inherited by the pre-team rev2 re-drive, the durable rows carry the scopeKey + contentHash key (legacy unkeyed rows fail closed against a keyed evaluation)), and fix-runtime-template-consent (fix/runtime-template-consent, finding I residual — the leader scope, 2026-10-01) adds its one scannable regression test file (the runtime leader-disable no-requirements initial-work spec leader-disable-no-requirements-initial-work.test.ts, the production closure + router real chain: a durable LEADER disable on a requirement-free leader template blocks admitInitialWork + the subsequent follow-up root boundary (zero model, zero work — the typed templateDisabled block naming the leader scope), the control/recovery lanes stay open, re-enable resumes through the same checks), and fix-persona-kind (PR #46, finding A, merged to master at 8e18819c) adds its two scannable regression test files (the runtime persona-KIND provider-preflight spec persona-kind-provider-preflight.test.ts, the persona-KIND-convention regression suite over the REAL production provider to preflight chain, and the persona-KIND SHIPPED DIST SMOKE spec persona-kind-shipped-dist-smoke.test.ts, the finding-A persona-KIND semantics + the Blocker-1 role identity + the Blocker-3 typed section-13.5 lane asserted over the BUILT dist artifact), recording the two increments from the PR #46 merge (896 -> 898 on that line), and fix-control-authz (fix/control-authz-boundary) adds its five scannable test files (the shared real-chain fixture fix-control-authz-helpers.ts + the four Control authorization-boundary regression suites: fix-control-authz-b-frozen-snapshot (B: the frozen review snapshot is the single source), fix-control-authz-c-abandon-terminal (C: the durable abandon mark is the terminal mark + the waiter liveness), fix-control-authz-d-restart-fresh-human (D: the restart-unique attempt identity, no approval replay) and fix-control-authz-h-send-message (H: the recovery send-message recipient-instance subject over the real chain)), recording the five increments since the w1a pin, and finding F (fix/mcp-target-materialization, this merge) adds its TWO scannable files (mcp-target-materialization.test.ts + mcp-target-materialization-unit.test.ts — the finding-F third file in my pre-merge tree, persona-kind-provider-preflight.test.ts, is already counted by the PR #46 pair above: no double count on the merged tree), recording the two finding-F increments (the merged tree since the 896 pin: 2 persona + 3 consent + 5 fix-control-authz + 2 finding-F = 12), and alpha3-pr5-notification-projection adds its seven scannable files (the runtime permission-notification awareness lane — types + notification + projection + index, the generation-tagged notification, the active-only never-throwing notifier and the read projection over the PR1 latest/history boundaries, shipped UNWIRED by design — plus its three specs a3p5-permission-notification / a3p5-permission-read-projection / a3p5-permission-notification-lane-hygiene), recording the seven PR5 increments + the one missed increment since the 934 pin (merged PR #56 client spec packages/client/test/pr56-control-subject-payload.test.ts), 934 -> 942 on the authoritative scanner run, and the alpha3-pr5 delivery-binding round adds its two scannable files (the INJECT-ONLY synchronous receipt gate source binding.ts + its a3p5-permission-delivery-binding spec pinning the parent GO classes a-e: running receives / idle-cold-closing-lifecycle-mismatch drop / active-to-idle race drops at the gate / wake-member landmines untouched / detached ack independence), 942 -> 944 on the authoritative scanner run, and the 2026-10-02 master integration merge of 940cd841 (alpha3-pr4 lifecycle lineage: the eleven scannable lifecycle-lane/plane/regression files join DISJOINT from the PR5 nine, the PR #56 client spec counted once) puts the merged tree at 955 on the scanner run of this suite (RED `merge/p4t6-RED.log`, GREEN `merge/p4t6-GREEN.log`), and the alpha3-pr5 FINAL PRODUCTION SPLICE adds its one scannable file (the root-assembled integration spec a3p5-permission-splice.test.ts; the splice wires EXISTING sources only — lane edits are doc-level, the edited root/types/glue files were already counted, dist is outside the scan; zero new denylist vocabulary, quarantine hits stay 15), 955 -> 956 on the scanner run of this suite (RED `splice/p4t6-RED.log`, GREEN `splice/p4t6-GREEN.log`), and the alpha3-pr5 ROOT BLOCK fix batch adds its two scannable spec files (a3p5-glue-permission-receipt — the REAL agent-bindings.mjs receipt exercised through the t12a live bridge with hostless fakes — and a3p5-permission-read-wiring — the override.getPermission read path over the root-assembled router + the real s6-remote gate port; the fix batch edits ALREADY-COUNTED files only otherwise — root.ts / types.ts / s6-remote.ts / the glue / the contracts / the lane docs; dist is outside the scan; zero new denylist vocabulary, quarantine hits stay 15), 956 -> 958 on the scanner run of this suite , and dsh-020rc2-upgrade (PR #62, 0.2.0-rc.2 host migration) adds its seven scannable rc2 test files (testkit rc2-kit-wire-shape / rc2-kit-fixture-invariants / rc2-kit-fault-injection / rc2-kit-pin-hygiene / rc2-kit-preset-seam / rc2-sanitize-evidence, tools rc2-team-deny-least-privilege), zero removals, 958 -> 965 on the scanner run of this suite (RED `logs/root-vitest-current-e89063c8-plus.log` reported `expected 964 to be 958`; the exact-base control `logs/base-vitest-the-10-failures-6b2f401b.log` shows this same suite PASSING at 958 with the own 0.1.7-rc.1 host tree of the base worktree, so the movement is the files added by this PR, not the host generation, and the same PR persona-residue round adds its three scannable files (the shared harness persona-slot reader packages/runtime/root-binding/harness/persona-probe.mjs + its persona-probe.d.mts type surface + the packages/runtime/test/rc2-persona-probe.test.ts contract-and-ledger spec), 965 -> 968 on the scanner run of this suite, and the same PR root-binding bounded-run harness round adds its three scannable files (packages/runtime/root-binding/harness/blueprint-source.mjs + packages/runtime/root-binding/harness/bounded-run.mjs + packages/runtime/root-binding/harness/bounded-run.regression.test.mjs, the bounded-run owner/builder harness, its blueprint source and its regression spec), 968 -> 971 on the scanner run of this suite with all 971 entries being intended packages/** source and the three new paths additionally asserted present by path, and A4-PR0 (feat/a4-pr0-proposal-substrate) adds its five scannable files (the durable governance proposal substrate packages/runtime/governance/proposal-store.ts and its lane-local closed error table proposal-codes.ts - shipped UNWIRED by design, ADR A4-6, no product surface reaches them - plus its three specs a4pr0-proposal-store / a4pr0-proposal-corrupt / a4pr0-proposal-generation), 973 -> 978 on the scanner run of this suite, and A4-PR7 §7.3 the version flip (`feat/a4-73-flip`) adds its one scannable file (the runtime a4p7-shipped-composition-blueprint spec — the embedded blueprint of the shipped composition blueprint parsed through the real `parseBlueprint`, which no test in the tree did before the cutover that changes what parses), 978 -> 979 on the scanner run of this suite', () => {
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
    // (h3) ONE H3 scannable file (this commit, the alpha.2 hardening
    //     closure task): packages/tools/test/h3-hostile-seam.test.ts
    //     (the DSH_HARDENING_PROBE-gated TEST-ONLY hostile-prepend seam
    //     spec — the gate on/off legs, the route registration + label,
    //     the 405/400 validation shapes, the prepend-allow call shape
    //     (event + { prepend: true } + the force-allow fn), per-agent
    //     scoping, the idempotent-per-agent replace, the unknown-session
    //     failure, and the row-stop backstop drain — over the plain-
    //     node fake ctx/webServer/teamRoot doubles; the security
    //     property itself is pinned by h1a (unit) + the H3 live kit
    //     battery). Zero denylist vocabulary (the scan over it passes —
    //     the frozen quarantine hit set is unchanged at fifteen
    //     occurrences). The sibling changes (the hostile seam route in
    //     packages/tools/harness/plugin.mjs, the a6a §16 extension, the
    //     H3 kit scripts under dev/agent-workflow — outside packages/**)
    //     are in-place edits on already-scanned files (no count change).
    //     Recorded on the H3 task branch; re-verify on int at the
    //     alpha2-hardening integration.
    //
    // (h4) ONE H4 scannable file (this commit, the alpha.2 hardening
    //     follow-up P1-A task): packages/runtime/test/h4-rule-identity.
    //     test.ts (the stale exact-rule canonical identity spec: a
    //     mutable fake backend (the map mutation IS the symlink/junction
    //     retarget) + the real A4 durable control service + one adapter
    //     install — H4-A1 DENY retarget (RED pre-fix: the cached key
    //     misses the retargeted identity and the decision downgrades to
    //     ask + a request), H4-A2 ALLOW retarget / stale authority (RED
    //     pre-fix: the cached key keeps authorizing the original
    //     target), H4-A3 transient rule-resolution failure (the P1-3
    //     fail-closed flip preserved; the failure is never remembered),
    //     H4-DB operation/rule same-basis agreement (one injected
    //     closure, identical keys on every decision)). Zero denylist
    //     vocabulary (the scan over it passes — the frozen quarantine
    //     hit set is unchanged at fifteen occurrences). The sibling
    //     changes (pre-execute-adapter.ts — the install-lifetime
    //     ruleKeyCache deleted, fresh-per-decision rule canonicalization
    //     + resolver-result shape validation; permission-resolver.ts
    //     input-contract docs; the a5a suite comment syncs) are in-place
    //     edits on already-scanned files (no count change). Recorded on
    //     the H4 task branch; re-verify on int at the
    //     alpha2-hardening-followup integration.
    //
    // (h5) ONE H5 scannable file (this commit, the alpha.2 hardening
    //     follow-up P1-B task): packages/runtime/test/h5-bash-effects.
    //     test.ts (the bash execution-effect fingerprint spec: the H5
    //     fake resolver over the session-cwd-/A model ('.' -> KEY_A,
    //     '/A' -> KEY_A, 'sub' -> KEY_A_SUB, '/B' -> KEY_B) + the real
    //     A4 durable control service + one adapter install — H5-B1
    //     workdir A/B (RED pre-fix), H5-B2 omitted == explicit
    //     session-cwd (the effective-canonical ruling), H5-B3
    //     background, H5-B4 timeoutMs, H5-B5 sandbox mode (the pinned
    //     upstream dsh-sandbox ESCALATION_TARGETS), H5-B6 excluded
    //     description/justification, H5-B7 raw command binding (H2),
    //     H5-B8 the six malformed effect-field fail-closed legs
    //     (workdir: 42 / run_in_background: 'yes' / timeoutMs: -1,
    //     '10000', Infinity / sandbox_permissions: 42 — the reachability
    //     proof: the upstream materialization is lossless-JSON-only and
    //     the pre-execute waterfall precedes validateBashArgs), H5-C1
    //     same authority args + new callId (same fingerprint, new
    //     request), H5-C2 the /A approval is not consumed by the /B
    //     operation (scope exactness), H5-S1 the summary effect tokens
    //     + the 120-char preview-cap non-authority leg). Zero denylist
    //     vocabulary (the scan over it passes — the frozen quarantine
    //     hit set is unchanged at fifteen occurrences). The sibling
    //     changes (canonical-operation.ts — the bash projection extended
    //     to { tool, commandHash, workdir, runInBackground, timeoutMs,
    //     sandboxPermissions } + the new extractBashEffects; errors.ts —
    //     the four new closed bash-workdir-not-a-string / bash-run-in-
    //     background-not-boolean / bash-timeout-ms-invalid / bash-
    //     sandbox-permissions-not-a-string reasons; types.ts — the
    //     CanonicalOperation.workdirDisplay presentation field; pre-
    //     execute-adapter.ts — the summary effect tokens; the a2 bash
    //     leg updates) are in-place edits on already-scanned files (no
    //     count change). Recorded on the H5 task branch; re-verify on
    //     int at the alpha2-hardening-followup integration.
    //
    // (issue#1) THREE issue #1 scannable files (this commit, the issue #1
    //     async delegation repair task — recorded on the task branch as
    //     668 + 3 = 671 on base 6a2f3e1; the H4/H5 follow-up (two
    //     scannable files, above) merged to master since the task branch
    //     base, so on int this lands as 670 + 3 = 673):
    //     packages/runtime/test/issue1-serial-blocking.test.ts (the RED
    //     characterization of the pre-fix sync-blocking behavior),
    //     packages/runtime/test/issue1-async-delegation.test.ts (the R1-R7
    //     acceptance battery: the async admission receipt without
    //     settlement, the detached continuation with no caller signal, the
    //     durable settlement fact persisting memberResult, the work-status
    //     read action entry shapes (admitted/running/succeeded/failed/
    //     unavailable-unknown), the WORK_REPLAYED replay and the admitted-
    //     only resume, the byte-identical sync default, and the cross-
    //     member concurrency overlap proof) and
    //     packages/tools/test/issue1-collect-tools.test.ts (the
    //     team_collect tool layer: the optional async flag on delegate and
    //     follow-up, the collect requestToken array validation, the
    //     read-only scan, the duplicate folding in input order, the
    //     unknown-token shape, and the explicit async:false override). All
    //     three carry zero denylist vocabulary (the scan over them passes
    //     — the frozen quarantine hit set is unchanged at fifteen
    //     occurrences). The sibling changes (the admission
    //     types/actions/index, the action-router work-execution/effects/
    //     router/index, the root.ts tool-count comment, tools/src/tools.ts,
    //     the five ten-tool registration pin specs, and the p6t6-bypass-
    //     scan eleven-tool update) are in-place edits on already-scanned
    //     files (no count change). Recorded on the task branch; re-verify
    //     on int at the issue1-async-delegation integration.
    //
    // (bp1) FOUR issue#2-blueprint-loading scannable files (this commit,
    //     the parallel-repair branch fix/alpha2-blueprint-loading @ 6a2f3e1
    //     base): packages/domain/blueprint/src/inspect.ts (the BP1
    //     identity-level source inspector — the weaker sibling of the
    //     strong parseBlueprint pipeline that a directory scan uses to
    //     list saved sources without strong-parsing each of them),
    //     packages/domain/test/bp1-blueprint-inspector.test.ts (its spec:
    //     the structural stage reusing the strong parser's own
    //     splitFrontmatter/decodeYamlFrontmatter, the identity field
    //     checks, and the identity/strong split),
    //     packages/runtime/test/bp1-red-probe.test.ts (the BP0
    //     RED-1/RED-2/RED-5 host-level characterization probes: the
    //     static single catalog, the no-HMR second Blueprint, and the
    //     boot-failure -> route-missing defect over the plain-object
    //     host seam + connection sink), and
    //     packages/runtime/test/bp1-red-glue-probe.test.ts (the BP0 RED-4
    //     per-Team authority split probe over the t12a live bridge).
    //     Zero denylist vocabulary (the scan over them passes — the
    //     frozen quarantine hit set is unchanged at fifteen
    //     occurrences). The sibling client probe
    //     (packages/client/test/team-creation-panel-refresh.client.spec.
    //     tsx — the RED-3 manual-refresh spec) is a .tsx, outside the
    //     frozen scanner's extension set (no count change, the P9-T1
    //     precedent). Recorded on the blueprint-loading task branch;
    //     re-verify on the merged tree after the hardening integration
    //     (plan §3.5: the merged-tree truth, never an arithmetic sum). On
    //     this master merge — after the (h4), (h5) and (issue#1)
    //     integrations above — the fourteen files of this branch land as
    //     673 + 14 = 687, the scanner truth on the merged tree (verified
    //     at the merge integration, not an arithmetic sum).
    //
    // (bp1-c) THREE issue#2-blueprint-loading scannable files (this
    //     commit, the TeamDomain v2 bump + blueprint_registry store,
    //     plan BP2): packages/storage/schema/blueprint-registry.ts (the
    //     registry row record module — the closed field set, the
    //     create/parse over the contracts id grammar, the L3 row-stamp
    //     discipline (v2 rows carry `2`), the canonical serialize/
    //     deserialize, and the blueprintId@revision row key agreeing
    //     with the contracts snapshot display key),
    //     packages/storage/repositories/blueprint-registry.ts (the
    //     append-only BlueprintRegistryRepository — get/list/freeze
    //     only, never last-write-wins: absent append, same-hash
    //     idempotent, different-hash loud RECORD_DUPLICATE
    //     blueprint-revision-frozen with both hashes, write-time re-read
    //     refusal), and packages/storage/test/bp1-blueprint-registry.
    //     test.ts (its spec: the append / idempotency / conflict
    //     surface, the key agreement, the malformed-row loud reads, the
    //     no-write-surface check). Zero denylist vocabulary (the scan
    //     over them passes — the frozen quarantine hit set is unchanged
    //     at fifteen occurrences). The sibling v2 edits (stores.ts,
    //     team-domain.ts, the index exports, the affected p4-01 / p4-06
    //     / p4-07 / rmr-create-or-open specs, the p4-t5 testkit specs,
    //     the committed-world fixture restamp — including its new
    //     untracked blueprint_registry.json table file, which lives
    //     under packages/testkit/fault-injection/fixtures, outside the
    //     scanner's packages/** source globs — and the in-place doc
    //     edits) are in-place edits on already-scanned files (no count
    //     change). Recorded on the blueprint-loading task branch;
    //     re-verify on the merged tree after the hardening integration
    //     (plan §3.5).
    //
    // (bp1-d) FOUR issue#2-blueprint-loading scannable files (this
    //     commit, the filesystem source index + live authority + live
    //     catalog facade, plan BP3/BP4):
    //     packages/runtime/src/plugin/blueprint-source-index.ts (the
    //     stateless blueprintDir scan — path semantics absolute /
    //     relative-to-cwd / absent-disabled, the *.yaml|*.yml candidate
    //     rule with *.draft.* excluded, rescan-per-request, the
    //     identity-level inspection seam, the fail-closed I/O codes),
    //     packages/runtime/src/plugin/blueprint-authority.ts (the live
    //     authority over the frozen registry + saved sources + bootstrap
    //     anchor — the registry-wins resolve precedence, the duplicate-
    //     mutable loud refusal, the resolveSnapshot / freezeSnapshot
    //     hash fences including the TOCTOU re-resolve),
    //     packages/runtime/src/plugin/blueprint-live-catalog.ts (the
    //     BlueprintCatalog interface implemented over live state — every
    //     method call re-queries the authority, the static catalog's
    //     closed not-found wording + revision order shared from the
    //     domain exports) and
    //     packages/runtime/test/bp1-blueprint-authority.test.ts (its
    //     29-test spec: the W0 index worlds, the W1/W1B authority
    //     unions + revision order, the W2 duplicate-mutable louds, the
    //     W3/W3C freeze + TOCTOU + frozen-after-deletion worlds, the W4
    //     logically-broken-vs-identity-broken split, the W5 facade
    //     surface). Zero denylist vocabulary (the scan over them passes
    //     — the frozen quarantine hit set is unchanged at fifteen
    //     occurrences). The sibling edits (domain catalog.ts + index.ts
    //     gaining the exported compareBlueprintRevisions / blueprintNotFound
    //     helpers, node-min.d.ts + types.ts additive surfaces)
    //     are in-place edits on already-scanned files (no count change).
    //     Recorded on the blueprint-loading task branch; re-verify on
    //     the merged tree after the hardening integration (plan §3.5).
    //
    // (bp1-e) ONE issue#2-blueprint-loading scannable file (this commit,
    //     the BP6 freeze-barrier invariant spec, plan §10):
    //     packages/runtime/test/bp1-freeze-barrier.test.ts (the
    //     fresh-TeamSession invariant — a production fresh TeamSession
    //     commit ⇒ the registry carries the same (id, revision,
    //     contentHash) record — pinned over the two production mint
    //     paths the host drives: the real create boot [the shared
    //     bindFresh wrapper choke point] and the fixture boot seed
    //     [writer-audit category 3's explicit registry seeding]; the
    //     stored row's source text is the row anchor — the saved copy of
    //     the anchor identity under blueprintDir is shadowed, never a
    //     second row). Zero denylist vocabulary (the scan over it passes
    //     — the frozen quarantine hit set is unchanged at fifteen
    //     occurrences). The sibling edits (root.ts the optional
    //     blueprintCatalog?/blueprintAuthority? params + the freeze
    //     barrier in the bindFresh wrapper + the handoff pre-put freeze +
    //     the fixture boot seeding, host.ts the sole authority-builder
    //     wiring + the blueprintDir config validation,
    //     blueprint-authority.ts the shadow-precedence correction [a
    //     saved file carrying the anchor's identity is shadowed, not a
    //     duplicate — the RED-1 contract], types.ts the code-doc update)
    //     are in-place edits on already-scanned files (no count change).
    //     Recorded on the blueprint-loading task branch; re-verify on
    //     the merged tree after the hardening integration (plan §3.5).
    //
    //
    // (bp1-f) ONE issue#2-blueprint-loading scannable file (this commit,
    // the BP-F per-Team Blueprint authority isolation in the live glue,
    // plan §11): packages/runtime/test/bp1-dual-team-gate.test.ts (the
    // §11.3 architecture gate: the REAL glue wired with a host-shaped
    // per-root resolver — the durable TeamSession row's bound snapshot
    // ref -> the live authority -> the FROZEN registry row (the real
    // TeamDomain blueprint_registry over a FileStorageSeam) -> the hash
    // equality — with two team roots sharing one glue instance and
    // deliberately different leader persona / member persona / teamTools
    // allowlist / builtinToolDeny / permissions rules; the A-only-A /
    // B-only-B assertions + the cold resume of a FRESH glue instance
    // after the saved sources are deleted [the frozen registry row
    // replays — the DoD "frozen source deletion never breaks the old
    // Team's resolve / cold resume"]). Zero denylist vocabulary (the
    // scan over it passes — the frozen quarantine hit set is unchanged
    // at fifteen occurrences). The sibling edits (agent-bindings.mjs the
    // per-root boundBlueprintByRoot cache + the resolveBoundBlueprint
    // dep + the root-aware persona callbacks + the locateTemplate /
    // resolveStaticCapabilities / agentSetup call sites, host.ts the
    // authority-builder move above the glue + the host-shaped resolver
    // closure + the GlueModule dep type, the t12a bridge .mjs/.d.mts the
    // host stand-in resolver injection + the blueprintSources /
    // resolveBoundBlueprint world options, bp1-red-glue-probe.test.ts
    // the REAL Team B source + the real contentHash + the world store
    // option [the RED-4 probe turns GREEN]) are in-place edits on
    // already-scanned files (no count change). Recorded on the
    // blueprint-loading task branch; re-verify on the merged tree after
    // the hardening integration (plan §3.5).
    //
    //
    // (bp1-g) ZERO new issue#2-blueprint-loading scannable files (this
    // commit — the BP-G remote mount-before-boot + boot readiness, plan
    // §12): the change is entirely in-place edits on already-scanned
    // files — host.ts (the mount section moved BEFORE the awaited live
    // boot [plan §12.1] + the in-process read-only readiness state
    // starting|ready|failed settling around the boot [plan §12.2] + the
    // remoteReadiness getter passed into the root), root.ts (the
    // additive TeamProductionRootParams.remoteReadiness + the pass-
    // through to createS6RemoteSurfaces), s6-remote.ts (the RemoteReadiness
    // type + the REMOTE_READINESS_INDEPENDENT_METHODS set [catalog.list /
    // catalog.get] + the optional readiness gate on the mounted
    // dispatcher — a non-`ready` state refuses every other closed
    // method with the frozen internal-error failure envelope: no new
    // wire code, no protocol bump [plan §12.3]). No new .test.ts file
    // (the RED-5 probes already committed in BP-A turn green by this
    // change: bp1-red-probe 3/6 -> 6/6); the frozen quarantine hit set
    // is unchanged at fifteen occurrences and the scan count stays 681.
    // Recorded on the blueprint-loading task branch; re-verify on the
    // merged tree after the hardening integration (plan §3.5).
    //
    //
    // (bp1-h) ONE new issue#2-blueprint-loading scannable file (this
    // commit — the BP-H client manual refresh + the BP10 local authoring
    // helper, plan §13/§14): packages/testkit/test/bp1h-blueprint-authoring.
    // test.ts (the 8-test sync-shim spec over the helper's exported
    // stage/validate-save semantics + the plan's conditional frozen
    // registry-probe guard). The rest of BP-H is OUTSIDE the scan:
    // scripts/blueprint-authoring.mjs + .d.mts (scripts/** is not
    // scanned), the TeamCreationPanel.tsx / locales.ts / module.css
    // refresh surface (.tsx/.css excluded; locales.ts already scanned —
    // in-place edit), the client .client.spec.tsx RED-3 probe (committed
    // in BP-A, .tsx excluded), and docs/blueprint-authoring.md (docs/**
    // is not under packages/**). +1 -> 682. Recorded on the
    // blueprint-loading task branch; re-verify on the merged tree after
    // the hardening integration (plan §3.5).
    //
    // (i2) THREE I2 scannable files (this commit, the alpha.2 issue #2
    //     permission-repair line B — the I2-P1/I2-P2/I2-P4 permanent
    //     tests): packages/runtime/test/issue2-real-preset-restriction.
    //     test.ts (the REAL-SEAM preset-mount + builtinToolDeny
    //     regression over the real upstream composition — the fixture
    //     preset roster + real Loader, the real ToolRuntime surface, the
    //     real adapter: the fresh/cold member + root lifecycle (plan
    //     §14), the sibling inertness, the fail-closed unrestrictable
    //     deny (plan §11), the already-joined adopted root (plan §12),
    //     and the registry-level dispatch mask),
    //     packages/runtime/test/issue2-capability-permission-precedence.
    //     test.ts (the capability > operation-permission precedence
    //     lanes P4-A..P4-D over the real pipeline + real control world,
    //     with the two recorded pipeline-order deviations pinned), and
    //     packages/tools/test/issue2-builtin-deny-focused.test.ts (the
    //     adapter contract: the no-op empty deny, the dedupe, the exact
    //     disposer, the idempotent dispose, the fail-closed propagation,
    //     and the no-silent-continuation pin). Zero denylist vocabulary
    //     (the scan over them passes — the frozen quarantine hit set is
    //     unchanged at fifteen occurrences). The sibling changes (the
    //     issue2 fixture preset/plugin under
    //     packages/runtime/test/issue2-fixtures — .js/.yml, not
    //     scannable .ts — the runtime devDependencies + pnpm-lock for
    //     the real composition, and the live-world kit + evidence under
    //     dev/agent-workflow — outside packages/**) carry no count
    //     change. Recorded on the issue #2 line-B branch
    //     (fix/alpha2-issue2-permission); re-verify with the scanner's
    //     truth at the post-line-A rebase (plan §23.2).
    //
    // Independently re-verified on the merged master tree at this
    // integration: the committed scanner's own run reports filesScanned
    // == files.length == 690 (642 + 10 + 1 + 7 + 1 + 2 + 2 + 1 + 1 + 1 +
    // 1 + 1 + 3 + 14 + 3), and its file list names exactly the forty-eight
    // files above (ten alpha.1 + one A1 + seven A2 + one A4 + two A3 +
    // two A5 + one A6 + one H1 + one H3 + one H4 + one H5 + three issue
    // #1 + fourteen issue#2-blueprint-loading [four bp1 + three bp1-c +
    // four bp1-d + one bp1-e + one bp1-f + one bp1-h] + three issue #2
    // permission-repair [two runtime + one tools]; the committed scanner
    // is byte-identical — no scanner change, DEC-1).
    // The frozen quarantine hit set and all required P4 suite lists are
    // untouched.
    // Evidence: dev/agent-workflow/evidence/alpha2-permission/a2/ + a3/ +
    // a4/ + a5/ + a6/ + alpha2-hardening/h1/ + alpha2-hardening/h3/ +
    // alpha2-hardening-followup/h4-rule-identity/ + alpha2-hardening-
    // followup/h5-bash-effect/ + dev/agent-workflow/evidence/issue1-async-
    // delegation/ + dev/agent-workflow/evidence/alpha2-blueprint-loading/ +
    // alpha2-issue2-permission/.
    // alpha.2 capability-completion A2C-4 (merged into
    // int/alpha2-capability-completion @ e2e0163, PR #8): +1 = 691 —
    // one new file, packages/runtime/test/a2c4-external-lastmile.test.ts
    // (the R1/R2 RED-probe retention + G1–G9 §6.5 matrix for the
    // external hard last-mile recheck). Zero other scannable additions
    // (the a6a spy completion is an in-place edit of an existing file;
    // the control/ + pre-execute-adapter sources are in-place edits).
    // Scanner unchanged; DEC-1 union applied at the integration tip by
    // the main agent. Zero denylist vocabulary in the new file (the
    // frozen quarantine hit set stays at fifteen occurrences).
    // Evidence:
    // dev/agent-workflow/evidence/alpha2-capability-completion/a2c-4/.
    // alpha.2 capability-completion A2C-1 (merged into
    // int/alpha2-capability-completion @ 23a4d9f, PR #9): +1 = 692 —
    // one new file, packages/runtime/test/a2c1-pwsh-permission.test.ts
    // (the P1–P4 RED-probe retention + 24 GREEN acceptance/fingerprint/
    // real-pipeline tests for the shell-class pwsh parameter permission).
    // The a1/a3 vocabulary pin updates (6→7 tool names) are in-place
    // edits of existing files (no count change). Scanner unchanged;
    // DEC-1 union applied at the integration tip by the main agent.
    // Zero denylist vocabulary in the new file (the frozen quarantine
    // hit set stays at fifteen occurrences).
    // Evidence:
    // dev/agent-workflow/evidence/alpha2-capability-completion/a2c-1/.
    // alpha.2 capability-completion A2C-5 (merged into
    // int/alpha2-capability-completion, PR #10): +1 = 693 — one new
    // file, packages/runtime/test/a2c5-read-fingerprint.test.ts (the
    // T1/T6/T7 RED-probe retention + §8.4 identity matrix for the
    // omitted-limit null identity). The a2 suite update + the
    // canonical-operation read-region change are in-place edits (no
    // count change). Scanner unchanged; DEC-1 union at the integration
    // tip by the main agent. Zero denylist vocabulary in the new file
    // (the frozen quarantine hit set stays at fifteen occurrences).
    // Evidence:
    // dev/agent-workflow/evidence/alpha2-capability-completion/a2c-5/.
    // alpha.2 capability-completion A2C-2 (merged into
    // int/alpha2-capability-completion, PR #11): +2 = 695 — two new
    // files, packages/runtime/test/a2c2-permission-coverage.test.ts
    // (the S0 §7.6 probes + six-class matrix + FATAL/typed-error legs
    // + real-seam legs) and the in-place t12a-live-bridge double
    // extension (the tools.schemas seam + createScope scope minting —
    // the merge-block repair for the a6a/bp1 production-wiring
    // worlds). Scanner unchanged; DEC-1 union at the integration tip
    // by the main agent. Zero denylist vocabulary in both new files.
    // Evidence:
    // dev/agent-workflow/evidence/alpha2-capability-completion/a2c-2/.
    // alpha.2 capability-completion A2C-7 (merged into
    // int/alpha2-capability-completion, PR #12): +1 = 696 — one new
    // file, packages/runtime/test/a2c7-subtree-matcher.test.ts (the
    // 16-group §9.9 subtree matrix + R1/R2 + the REAL pinned
    // LocalFileSystem contains section). All other A2C-7 changes are
    // in-place edits (domain schema/types/validate, A3 resolver, A5
    // adapter, host/glue, a1 test). Scanner unchanged; DEC-1 union at
    // the integration tip by the main agent. Zero denylist vocabulary
    // in the new file. Evidence:
    // dev/agent-workflow/evidence/alpha2-capability-completion/a2c-7/.
    // alpha.2 capability-completion A2C-3 (merged into
    // int/alpha2-capability-completion, PR #13): +1 = 697 — one new
    // file, packages/runtime/test/a2c3-inspect-operation-permission
    // .test.ts (the 11-leg §10.5 matrix: R1/R2 semantic-split probes +
    // static/absent forms + pwsh/subtree constant sources +
    // deterministic order + pure-read + remote round-trip +
    // effective-unregressed). All other A2C-3 changes are in-place
    // edits (admission types, action-router effects, tools
    // description). Scanner unchanged; DEC-1 union at the integration
    // tip by the main agent. Zero denylist vocabulary in the new
    // file. Evidence:
    // dev/agent-workflow/evidence/alpha2-capability-completion/a2c-3/.
    // team-skills-provider (task branch, plugin-attached skills):
    // +2 = 699 — two new files, packages/runtime/src/plugin/team-skills.ts
    // (the bundled-skills provider over the install-surface
    // .agents/skills dir: frontmatter parsing, the candidate shape
    // (rank 550 / source+provider 'dsh-agent-team'), the locator fence,
    // the loud degradation paths) and
    // packages/runtime/test/team-skills.test.ts (the fixture-dir unit
    // legs + the layout-candidate math + the REAL SkillRegistry
    // integration + the fiber-disposal / HMR-safety leg). All other
    // task changes are in-place edits (host.ts apply wiring, the
    // node-min shim console/path/fs surface additions, the root
    // package.json files whitelist, the runtime package.json devDep,
    // pnpm-lock.yaml). Scanner unchanged. Zero denylist vocabulary in
    // both new files (the frozen quarantine hit set stays at fifteen
    // occurrences).
    // multi-mcp quick-fix Task A (merged into int/multi-mcp-quick-fix,
    // PR #16 M1): +2 = 701 — two new files,
    // packages/runtime/src/plugin/mcp-supply.ts (the I1 pure module:
    // configuredMcpServers canonical read + mcpSupplyValidationIssue
    // fail-closed 0..N/unique-name/ambiguous/legacy checks) and
    // packages/runtime/test/mcp-supply-config.test.ts (the 39-case
    // normalization + validation-order + C7 legacy-pin + host
    // boundary matrix). All other Task A changes are in-place edits
    // (types.ts TeamPluginMcpServer + mcpServers field, host.ts
    // in-place validator swap). Scanner unchanged; DEC-1 union at the
    // integration tip by the main agent (measured truth 701 via
    // scanSessionEventVocabulary on the int tip; quarantine hit set
    // stays at fifteen). Zero denylist vocabulary in both new files.
    // Evidence: dev/agent-workflow/evidence/multi-mcp/a-config/.
    // multi-mcp quick-fix Task C (merged into int/multi-mcp-quick-fix,
    // PR #16 M2c): +1 = 702 — one new file,
    // packages/runtime/test/multi-mcp-wiring.test.ts (the 47-case
    // §6.1-6.11 matrix: role split A/B/A+B/none, legacy, zero-MCP,
    // template isolation, durable instance narrowing at the boundary,
    // activation-failure rollback + deny-first ordering, port-null
    // both cases, cold resume, close exactly-once, strict permission
    // coverage multi-MCP). All other Task C changes are in-place edits
    // (the t12a bridge per-server doubles, h1 zero-MCP migration, b3
    // per-server read, the I5 diagnostics in tools/harness/plugin.mjs,
    // the bridge .d.mts type surface). Scanner unchanged; DEC-1 union
    // at the integration tip by the main agent (measured truth 702 via
    // scanSessionEventVocabulary; quarantine hit set stays at fifteen).
    // Zero denylist vocabulary in the new file.
    // Evidence: dev/agent-workflow/evidence/multi-mcp/c-tests/.
    // RC2-A6 + RC2-A2 union (measured on the integration tip, DEC-1):
    // +7 = 709 — the two task suites' new files on top of the 702 base,
    // recording the two increments missed since the M2c pin (the same
    // "record the missed pin" precedent as the A2 alpha.2 / TCM-D4
    // stale-base entries — the rc2 repair round added them without
    // recording the increment): a42ebf4 alpha2-explicit-agent-setup
    // compat (packages/runtime/test/alpha2-explicit-agent-setup.test.ts)
    // and b8e77b2 webServer shim scoping (packages/runtime/test/
    // f1-webserver-shim-isolation.test.ts); RC2-A6 added packages/
    // runtime/test/control-guard-leader.test.ts (the A6-T1..T4 leader
    // last-mile guard liveness suite); RC2-A2 added packages/runtime/
    // test/bound-blueprint-persona-helpers.ts (the shared diverged-
    // blueprint fixtures + ref/identity-block builders), bound-
    // blueprint-persona-root.test.ts (the production-host-entry binder
    // suite A2-T1/T3/T4 + the missing-row typed throw + the factory-
    // world unchanged pin), bound-blueprint-persona-live.test.ts (the
    // T12 lane-A live-bridge persona-text suite A2-T1/T2/T3) and
    // p8s5a-stub-glue.d.mts (the stub-glue bundle's .d.mts type
    // surface so tsc (NodeNext) resolves the factory-world import).
    // All seven carry zero denylist vocabulary; the frozen quarantine
    // hit set is unchanged at fifteen. Scanner unchanged. Evidence:
    // dev/agent-workflow/evidence/rc2-repair/a6/ + a2/.
    // RC2-A1 (measured on the integration tip, DEC-1): +1 = 710 — one
    // new file, packages/runtime/test/rc2a1-fs-containment.test.ts
    // (the A1-T1..T6 fs-containment receiver/closure suite: the
    // production host-entry rig with the class-style fake fs whose
    // seams call instance methods through `this`, so a receiver loss
    // throws the production A1 fault signature — plus the World B
    // resolve-only provider typed setup rejection,
    // alpha2-permission-fs-containment-unavailable). Zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at
    // fifteen. Scanner unchanged. User-directed PR #18 closure
    // (2026-09-17): the single-writer pin bump executed on the PR
    // branch itself. Evidence:
    // dev/agent-workflow/evidence/rc2-repair/smoke/.
    // C1 (leader-approval reachability, DEC-1): +6 = 716 — the six new
    // scannable files of this repair round on top of the 710 base:
    // packages/runtime/control/leader-notification.ts (the pure C1
    // notification renderer + notifier factory — zero durable state),
    // packages/tools/test/c1-list-pending-control.test.ts (the
    // team_list_pending_control nine-case tool suite),
    // packages/runtime/test/c1-control-notification.test.ts (the
    // service notification six-case suite + the re-entrant
    // no-deadlock regression), packages/runtime/test/
    // c1-leader-notification-glue.test.ts (the live-glue
    // deliverRootControlNotification suite), packages/runtime/test/
    // c1-production-wiring.test.ts (the end-to-end wiring integration)
    // and packages/runtime/test/c1-restart-recovery.test.ts (the
    // durable restart recovery of the pending list). All six carry
    // zero denylist vocabulary; the frozen quarantine hit set is
    // unchanged at fifteen. Scanner unchanged.
    // PR #20 closure (caller-root binding + notification fault
    // closure, 2026-09-19): +1 = 717 — one new scannable file,
    // packages/tools/test/c1-caller-root-binding.test.ts (the R1–R6
    // cross-team caller-root binding suite over a real two-root
    // durable domain + the real control service; the plan §3
    // TEAM_TOOL_CALLER_ROOT_MISMATCH gate exercised end-to-end).
    // Zero denylist vocabulary; the frozen quarantine hit set is
    // unchanged at fifteen. Scanner unchanged.
    // exec-autonomy-contract (user ruling 2026-09-18, rebased onto the
    // PR #20 merge 2026-09-19): +2 = 719 — the two spec files of the
    // leader allow-lane exec-class exception (the domain
    // leader-allow-lane contract spec + the runtime dual-gate spec),
    // union-accounted on top of the 717 base. Evidence:
    // dev/agent-workflow/evidence/exec-contract/.
    // work-completion-wakeup (async work completion -> Leader
    // wakeup, 2026-09-20, rebased onto the PR #19 merge): +6 on top
    // of the 719 base (PR #19 exec-autonomy-contract +2):
    // packages/runtime/work-completion-notification/types.ts (the
    // closed notification DTO + target union + the notifier/delivery
    // port types), packages/runtime/work-completion-notification/
    // notification.ts (the deterministic token-leading renderer + the
    // notifier factory — zero durable state, no scan, no retry) and
    // packages/runtime/work-completion-notification/index.ts (the
    // module's public surface), packages/runtime/test/
    // work-completion-notification.test.ts (the N1–N5 pure-module
    // suite), packages/runtime/test/
    // work-completion-notification-glue.test.ts (the G1–G6 live-glue
    // idle-followup / running-steer / plugin-source / rejection
    // isolation suite over the real agent-bindings.mjs) and
    // packages/runtime/test/work-completion-async-wakeup.test.ts (the
    // R1–R6 router completion-observer suite: async success, sync
    // zero, delivery-failed notify, settlement-fault no-notify,
    // rejection isolation, Phase B/C-only bookkeeping). All six carry
    // zero denylist vocabulary; the frozen quarantine hit set is
    // unchanged at fifteen. Scanner unchanged.
    // team-send-message-liveness (the team_send_message acceptance
    // boundary fix, 2026-09-20, PR #24, merged at 01fa598): +1 — one
    // new scannable file:
    // packages/runtime/test/send-message-liveness.test.ts (the T1–T4
    // acceptance-boundary regression suite over the real
    // agent-bindings.mjs port + the MessagingCoordinator: acceptance
    // boundary, long-running recipient, the two-agent reply cycle, and
    // the fail-closed acceptance failure). Zero denylist vocabulary.
    // mcp-blueprint-initial-grant (plan MCP_BLUEPRINT_INITIAL_GRANT_FIX,
    // 2026-09-20): +1 — one new scannable file,
    // packages/runtime/test/mcp-blueprint-initial-grant.test.ts (the
    // real-glue regression of the initial static MCP grant matrix B1/B3/
    // B4/B5/C1/L/G4 over the live agent-bindings bridge doubles). The
    // extended p8s4b-mcp-facet.test.ts and the modified
    // agent-bindings.mjs are already-scanned files (no count delta).
    // UNION (DEC-1 precedent, rebase 2026-09-20 onto PR #21 merge
    // d63cb71, then onto PR #24 merge 01fa598): 719 + 6 + 2 = 727.
    // All eight new files carry zero denylist vocabulary; the frozen
    // quarantine hit set is unchanged at fifteen. Scanner unchanged.
    // team-archive-member (user-directed Leader lifecycle tool round,
    // 2026-09-21, rebased onto the PR #24 merge): +1 on top of the 727
    // base — one new scannable file,
    // packages/tools/test/archive-member-tool.test.ts (the A1–A9 suite
    // for team_archive_member over the P6-T2 durable world with the fake
    // lifecycle commit port: the 13th-tool catalog order, the guard's
    // pending/deny/allow/consumed-and-liveness blocks, the RUNNING
    // LIFECYCLE_TRANSITION_REJECTED passthrough, the leader-gate
    // rejection, the disposed target-stale block, and the closed
    // argument validation). Zero denylist vocabulary; the frozen
    // quarantine hit set is unchanged at fifteen. Scanner unchanged.
    // strict-read core-spill (task/strict-read-core-spill, the spill
    // content-read vertical per the implementation guide + architecture
    // + ADR-strict-read-core-spill-plugin-layer): +12 on top of the 728 base (rebased onto the PR #25 merge 0597757, 2026-09-21 — DEC-1
    // union) = 740 — the twelve new scannable files: Phase A the six pure
    // core modules (packages/runtime/artifact-read/ types.ts + digest.ts
    // + fact.ts + registry.ts + authority.ts + index.ts) and the two unit
    // suites (packages/runtime/test/artifact-read-digest-fact.test.ts +
    // test/artifact-read-authority.test.ts); Phase B the permission-lane
    // suite (packages/runtime/test/
    // artifact-read-permission-lane.test.ts); Phase C the artifact-grant
    // bridge module (packages/runtime/src/plugin/
    // artifact-grant-bridge.ts), the Team-aware local spill provider
    // (packages/runtime/src/plugin/team-spill-local.ts) and its
    // eight-case vertical suite (packages/runtime/test/
    // team-spill-local.test.ts). All twelve carry zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // Scanner unchanged. Single-writer pin bump on the task branch (the
    // PR #18 closure precedent).
    // strict-read core-spill (task/strict-read-core-spill, Phase D — the
    // foreground shell tools/result vertical): +2 on top of the 740 base (rebased onto the PR #25 merge 0597757 — DEC-1
    // union) = 742 — the two new scannable files: the pure tools/result adapter
    // (packages/runtime/artifact-read/shell-result-observer.ts) and its
    // twelve-case suite (packages/runtime/test/
    // shell-result-observer.test.ts). The modified agent-bindings.mjs and
    // host.ts are already-scanned files (no count delta). Both new files
    // carry zero denylist vocabulary; the frozen quarantine hit set is
    // unchanged at fifteen. Scanner unchanged.
    // strict-read core-spill supplemental (PR #26, this round): +1 on top of the 742 base (rebased onto the PR #25 merge 0597757 — DEC-1
    // union) = 743 — the one new scannable file: the
    // PendingShellGrantTable source (packages/runtime/artifact-read/
    // pending.ts) behind the P1 pending-grant barrier. The modified
    // authority.ts / shell-result-observer.ts / index.ts are
    // already-scanned files (no count delta). Zero denylist vocabulary;
    // the frozen quarantine hit set is unchanged at fifteen. Scanner
    // unchanged. Single-writer pin bump on the task branch.
    // strict-read core-spill final supplemental (PR #26, this round): +1 on top of the 743 base (rebased onto the PR #25 merge 0597757 — DEC-1
    // union) = 744 — the one new scannable file: the team-spill-local
    // composition override regression (packages/runtime/test/
    // team-spill-local-composition.test.ts) that pins the real bundle +
    // profile same-id patch tree (exactly one active team-spill-local row,
    // no duplicate spillStore) and the old INSTALL.md `- insert:` duplicate
    // failure mode. The modified docs/INSTALL.md, the smoke kit (dev/ —
    // not scanned) and the re-run evidence are not scannable. Zero
    // denylist vocabulary; the frozen quarantine hit set is unchanged at
    // fifteen. Scanner unchanged. Single-writer pin bump on the task
    // branch.
    // DSH 0.1.7-rc.1 upgrade (task/dsh-017rc1-upgrade, this round): +2 on
    // top of the 744 base (rebased onto dc6fb6f) = 746 — the two new
    // scannable files: the jsdom ResizeObserver functional stub
    // (packages/client/test/setup-jsdom.ts — the 0.1.7 Tooltip primitive
    // consumes it; the client vitest setupFiles entry) and the U6 MCP
    // regression suite (packages/runtime/test/u6-mcp-017-regression.test.ts
    // — the dsh-mcp-client 0.1.7 public seam pin + the real apply()
    // discovery over the plan §9.3 single/paginated/no-tools mini-MCP
    // variants). Both carry zero denylist vocabulary; the frozen
    // quarantine hit set is unchanged at fifteen. Scanner unchanged.
    // Single-writer pin bump on the task branch.
    // DSH 0.1.7-rc.1 upgrade (task/dsh-017rc1-upgrade, this round): +1 on
    // top of the 746 base = 747 — the one new scannable file: the tsc
    // type surface of the mini-MCP harness (packages/runtime/root-binding/
    // harness/mini-mcp.d.mts, the established adjacent .d.mts pattern).
    // Zero denylist vocabulary; the frozen quarantine hit set is unchanged
    // at fifteen. Scanner unchanged. Single-writer pin bump on the task
    // branch.
    // PR #29 review-supplement (task/dsh-017rc1-upgrade, this round): +1 on
    // top of the 747 base = 748 — the one new scannable file: the DSH
    // compatibility gate test (packages/testkit/test/
    // plugin-dsh-compat.test.ts — finding F1: the host's own built
    // evaluator from the pinned test-use checkout, positive/negative/
    // vacuous/exemption cases over the declared 0.1.7-rc.1 peer). Zero
    // denylist vocabulary; the frozen quarantine hit set is unchanged at
    // fifteen. Scanner unchanged. Single-writer pin bump on the task
    // branch. (tests/paths.d.mts lives under tests/, not a scanned package
    // dir — not counted.)
// C1 restart-recovery (task/team-restart-017rc1, this round): +6 on
// top of the 748 base = 754 — the six new scannable files: the Phase 0
// characterization probe (packages/tools/harness/fence-probe.mjs — the
// zero-patch runtime observation probe added by commit 9cf57a0; +1
// already in the tree at this commit, pin not bumped there) plus the
// C1 activation fence (packages/runtime/src/plugin/
// team-session-activation.ts — the process-local ownership guard:
// the awaited-serial agent/created veto, the exact-generation
// disposed barrier, the ref-counted runOwned guard, the one-shot
// ordinary permit) and its single durable Team-ownership resolver
// (packages/runtime/src/plugin/team-session-ownership.ts — the
// shared boot-root/self-row/member-list algorithm, zero denylist
// vocabulary), and the three C1 test suites (packages/runtime/test/
// team-session-activation.test.ts A1–A8, team-session-durability.
// test.ts D1–D4, team-session-activation-glue.test.ts G1–G6 + the
// §6.2 static call-site assertion). All carry zero denylist
// vocabulary; the frozen quarantine hit set is unchanged at fifteen.
// Scanner unchanged. Single-writer pin bump on the task branch.
// restart-recovery-0.1.7-rc.1 (task/team-restart-017rc1, Commit 3 =
// 61419de): +1 on top of the 754 base = 755 — the one new scannable
// file: the remote v5 contract test (packages/remote/test/
// c1-remote-v5.test.ts, the ordinary-open one-shot permit surface:
// REMOTE_CONTRACT_VERSION_V5 + REMOTE_V5_ONLY_METHODS + catalog
// 27→28 + the typed fail-closed error mapping). The pin was set at
// Commit 2 (e951344) before this file existed; the drift was caught
// by the §17.15 full root-suite verification (Commit 5). Zero
// denylist vocabulary; the frozen quarantine hit set is unchanged at
// fifteen. Scanner unchanged. Single-writer pin bump on the task
// branch.
    // model-preference routing fix (task/fix-model-preference-routing, this
    // round): +5 on top of the 748 base = 753 — the five new scannable
    // files: (a) the model token parser
    // (packages/runtime/agent-setup/model/route.ts — parseModelItem /
    // parseModelPreferenceToken, the frozen token grammar) and (b) the
    // template model grant helper
    // (packages/runtime/agent-setup/model/template-model.ts —
    // initialTemplateModelGrantOf: qualified token unchanged / model-only
    // inherits the staticModel provider / absent is undefined), plus three
    // regression specs: (c) the Gate B helper unit
    // (packages/runtime/test/template-model-preference.test.ts), (d) the
    // Gate D activation step-8 composition
    // (packages/runtime/test/model-activation-step8.test.ts), and (e) the
    // Gate E live-glue initial-routing acceptance E1-E9 (packages/runtime/
    // test/model-blueprint-initial-routing.test.ts). All five carry zero
    // denylist vocabulary; the frozen quarantine hit set is unchanged.
    // Scanner unchanged. Single-writer pin bump on the task branch.
    // PR #30 review-supplement (P2-1/P2-2/P2-4, this round): +3 on top of
    // the 753 = 756 — the three new scannable files: (f) the SINGLE domain
    // model-preference token parser (packages/domain/blueprint/src/
    // model-preference.ts — parseModelPreferenceToken; P2-2: the runtime
    // mirror in route.ts is DELETED, so there is ONE grammar, ONE site),
    // (g) the model-overlay typed error (packages/runtime/agent-setup/
    // model/errors.ts — InvalidTemplateModelPreferenceError; P2-1: a
    // PRESENT-but-malformed preference is a fail-loud throw, never a silent
    // staticModel fallback), and (h) the team_inspect_config effective-
    // policy regression I1–I4 (packages/runtime/test/model-inspect-config.
    // test.ts; P2-4 §4). All three carry zero denylist vocabulary; the
    // frozen quarantine hit set is unchanged. Scanner unchanged.
    // Single-writer pin bump on the task branch.
    // MERGE-UNION (task/team-restart-017rc1 <- origin/master,
    // 2026-09-26): both ledgers above apply — model-preference-
    // routing (PR #30) contributed +5 (route.ts + template-model.ts
    // + Gates B/D/E specs) and +3 (P2-1/P2-2/P2-4: the SINGLE domain
    // token parser + its spec + the composition regression spec) on
    // top of the 748 base = 756; restart-recovery-017rc1 contributed
    // +6 (C1 fence core: fence-probe + team-session-activation +
    // team-session-ownership + the three C1 suites) and +1 (remote
    // c1-remote-v5 contract spec) = 755. The two file sets are
    // disjoint; merged pin = 748 + 8 + 7 = 763. Zero denylist
    // vocabulary in all thirteen; frozen quarantine hit set
    // unchanged at fifteen. Scanner unchanged. Single-writer pin
    // bump on the task branch (merge commit).
    // restart-recovery-0.1.7-rc.1 SUPPLEMENTAL (task/team-restart-017rc1,
    // PR #31 supplemental fix round, this commit): +2 on top of the 763
    // merge-union pin = 765 — the two new scannable files: (a) the S2
    // startup-fence suite (packages/runtime/test/
    // team-session-startup-fence.test.ts — H1/H2: the ownershipReady-window
    // startup fence; H1 root source=resume suspends then typed veto after
    // release, H2 ordinary source=startup suspends then unmanaged pass)
    // and (b) the S3 same-page characterization spike (packages/client/test/
    // s3-client-generation-spike.test.ts — EVIDENCE ONLY: drives the
    // pristine upstream 0.1.7 client services over RemoteMock; excluded
    // from the package tsc program (TS6059/2307); verified at package
    // level where the client vitest environment applies; excluded from
    // the root vitest include for the same reason — see vitest.config.ts).
    // Both carry zero denylist vocabulary; the frozen quarantine hit set
    // is unchanged at fifteen. Scanner unchanged. Single-writer pin bump
    // on the task branch (the drift was caught by the S6 final root-suite
    // run, same as the Commit-3 c1-remote-v5 increment).
    // Session Format v4 work-completion source fix (fix/v4-work-completion-
    // source, this commit): +1 on top of the 765 pin = 766 — the single new
    // scannable file: (a) the live-glue producer-kind type declaration
    // (packages/runtime/src/plugin/live/message-sources.d.ts — the
    // MessageSourceMap module augmentation registering the plugin's
    // producer-owned `plugin:dsh-agent-team` source kind for the
    // work-completion Leader wake; plain type surface, no runtime code).
    // Carries zero denylist vocabulary; the frozen quarantine hit set is
    // unchanged at fifteen. Scanner unchanged. Single-writer pin bump on
    // the task branch (caught by the full root-suite run, same as the
    // Commit-3 c1-remote-v5 increment).
    // Team projection read-side recovery (fix/team-projection-recovery-
    // 20260927, this commit): +1 on top of the 766 pin = 767 — the single
    // new scannable file: (a) the per-target-team compatibility prober
    // scope regression spec (packages/runtime/test/
    // team-compatibility-scope.test.ts — H4: the compatibility get/reprobe
    // targets the TARGET team's authority, never the caller's, and both
    // ride the same production team-operation chain as admissions; H5:
    // the production chain's inline probe path via member.create on a
    // FATAL-environment team in the stub world). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // Scanner unchanged. Single-writer pin bump on the task branch
    // (caught by the full root-suite run, same as the Commit-3 c1-remote-v5
    // increment).
    // Team view sync completeness (fix/team-view-sync-complete-20260927,
    // this commit): +10 on top of the 767 pin = 777 — the ten new
    // scannable files of the v6 vertical: (a) the runtime pure session
    // read-state resolver (packages/runtime/src/plugin/team-read-state.ts)
    // + (b) the runtime pure live-token module (packages/runtime/src/
    // plugin/live-token.ts) + (c-e) their three specs (packages/runtime/
    // test/s6t-read-state-resolver.test.ts / s6t-live-token.test.ts /
    // s6t-remote-v6.test.ts — the production dispatcher v6 chain) +
    // (f) the remote pull-v6 pair assessor module (packages/remote/src/
    // push/pull-v6.ts) + (g) its spec (packages/remote/test/c6-remote-v6.
    // test.ts) + (h) the client mount-level refresh coordinator module
    // (packages/client/src/state/team-refresh-coordinator.ts) + (i-j) its
    // two v6 specs (packages/client/test/team-projection-store-v6.test.ts
    // + team-refresh-coordinator.test.ts). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // Scanner unchanged. Single-writer pin bump on the task branch
    // (caught by the full root-suite run at the WP9 gate).
    // Team view sync completeness (fix/team-view-sync-complete-20260927,
    // PR #35 review follow-up, this commit): +2 on top of the 777 pin =
    // 779 — the two new scannable files of the read-state-driven
    // refresh: (a) the client read-state model module (packages/client/
    // src/state/team-read-state.ts — the wire→outcome parse of
    // team.getReadState + the never-rejecting resolve seam wrapper) +
    // (b) its spec (packages/client/test/team-read-state.test.ts —
    // outcome matrix: ok relations / remote error / malformed /
    // transport loss). Carries zero denylist vocabulary; the frozen
    // quarantine hit set is unchanged at fifteen. Scanner unchanged.
    // Single-writer pin bump on the task branch (caught by the full
    // root-suite run at the follow-up gate).
    // Team view sync completeness (fix/team-view-sync-complete-20260927,
    // PR #35 second follow-up, this commit): +1 on top of the 779 pin =
    // 780 — the one new scannable file of the Team-scoped overlay
    // collision: (a) packages/runtime/test/p01-team-scoped-overlay.
    // test.ts — the two-team leader-collision unit over the REAL
    // production overlay + projection service + both token paths
    // (per-team snapshot / projection / read-state-vs-frame token
    // equality + the cross-team token split). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at
    // fifteen. Scanner unchanged. Single-writer pin bump on the task
    // branch (caught by the full root-suite run at the second-follow-up
    // gate).
    // pre-alpha3 PR-A (feat/pre-alpha3-pra-governance, this commit):
    // +9 on top of the 780 pin = 789 — the nine new scannable files of
    // the governance mutation authority (ADR-03): (a) packages/runtime/
    // governance/types.ts (the closed port/args/result surface) +
    // (b) packages/runtime/governance/slot.ts (the pure slot kernel:
    // authority closure, cell validation, the write-time envelope +
    // external-hard checks, the no-op/re-issue/tombstone record
    // builders) + (c) packages/runtime/governance/service.ts (the
    // service: the chain serialization, the deterministic record-id
    // mint, the commit-before-ack PolicyState switch) + (d) packages/
    // runtime/governance/index.ts (the public surface) + (e-i) their
    // five specs (packages/runtime/test/
    // governance-mutation-authority.test.ts / governance-concurrency.
    // test.ts / governance-idempotence.test.ts / governance-reset-
    // tombstone.test.ts / governance-restart.test.ts). Carries zero
    // denylist vocabulary; the frozen quarantine hit set is unchanged
    // at fifteen. Scanner unchanged. Single-writer pin bump on the
    // task branch.
    // pre-alpha3 PR-B (feat/pre-alpha3-prb-effective-policy, this
    // commit): +10 on top of the 789 pin = 799 — the ten new scannable
    // files of the effective-policy canonical read plane: (a-f) the
    // runtime effective-policy module (packages/runtime/effective-policy/
    // types.ts + reader.ts + select.ts + legacy.ts + activation-policy.ts
    // + index.ts) + (g-j) their four specs (packages/runtime/test/
    // effective-policy-single-source.test.ts /
    // effective-policy-policy-state-live.test.ts /
    // boundary-committed-applied.test.ts /
    // restart-effective-policy.test.ts). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // Scanner unchanged. Single-writer pin bump on the task branch.
    // pre-alpha3 PR-C (feat/pre-alpha3-prc-runtime-env, this commit):
    // +13 on top of the 799 pin = 812 — the thirteen new scannable files
    // of the runtime-environment unification: (a-g) the runtime readiness
    // module (packages/runtime/readiness/types.ts + errors.ts +
    // provider.ts + registry.ts + telemetry.ts + index.ts + status.ts) +
    // (h) the runtime substrate resolver (packages/runtime/agent-setup/
    // preset/substrate-resolver.ts) + (i-m) their five specs (packages/
    // runtime/test/ capability-readiness-provider.test.ts /
    // capability-runtime-status.test.ts / capability-telemetry.test.ts /
    // persona-observed-kind.test.ts / runtime-substrate-resolver.test.ts).
    // Carries zero denylist vocabulary; the frozen quarantine hit set is
    // unchanged at fifteen. Scanner unchanged. Single-writer pin bump on
    // the task branch.
    // pre-alpha3 PR-D review-fix (fix/pre-alpha3-w1c-control, this commit):
    // +3 on top of the 819 pin = 822 — the three new scannable review
    // test files: (a) packages/runtime/test/
    // control-abandon-without-resolve-envelope.test.ts (the F3 narrow
    // close authority, independent of the resolve-control envelope) +
    // (b) packages/runtime/test/remote-control-abandoned-code.test.ts
    // (the F12 CONTROL_REQUEST_ABANDONED remote unmapped-code pass) +
    // (c) packages/runtime/test/control-abandon-storage-fault.test.ts
    // (the F2 #41-side fault: a failed abandon durable write is a typed
    // failure, never a claimed abandon). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // Scanner unchanged. Single-writer pin bump on the task branch.
    // pre-alpha3 PR #41 review-fix round 2 (feat/pre-alpha3-prd-control-
    // generalization, this commit): +2 on top of the 822 pin = 824 — the
    // two new scannable control review test files: (a) packages/runtime/
    // test/control-subject-cross-kind-alias.test.ts (the B1 cross-kind
    // request-key aliasing regression — an instance request and a template
    // request with the SAME id create DISTINCT request rows; the scope key
    // is the kind-prefixed subject identity) + (b) packages/runtime/test/
    // control-guard-coupling.test.ts (the B2/D.4 lane-disjointness
    // regression — a guarded guard attempt against an inline-allowed scope
    // is BLOCKED with zero consumption, and an inline execution never
    // consumes a guarded allow). Carries zero denylist vocabulary; the
    // frozen quarantine hit set is unchanged at fifteen. Scanner unchanged.
    // Single-writer pin bump on the task branch.
    // pre-alpha3 PR #41 fix round 3 (feat/pre-alpha3-prd-control-
    // generalization, this commit): +1 on top of the 824 pin = 825 — the
    // one new scannable suite packages/runtime/test/
    // control-inline-wait-abort.test.ts (the S1-S7 coupling-aware
    // wait-abort cascade: the INLINE mid-wait and pre-aborted aborts
    // durably abandon the SAME request through the shared abandon write
    // path (one control-request-abandoned fact, reason wait-aborted),
    // the GUARDED and coupling-ABSENT aborts keep TODAY's byte-identical
    // PENDING behavior, the decision-vs-abort race resolves with the
    // durable decision, and the faulted cascade rejects typed
    // DURABLE_WRITE_FAILED with zero side effects). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // Scanner unchanged. Single-writer pin bump on the task branch.
    // pre-alpha3 PR #42 fold (feat/pre-alpha3-pre-e-requirement-recovery,
    // this commit): +58 on top of the 825 fold pin = 883 — the fifty-eight
    // new scannable files of the D-fix line (fix/d-req-recovery @
    // e696823e) folded into this branch by merge 1 (ab108388): (i) the
    // nine W2-A files merged into the fixed #41 base (packages/runtime/
    // requirement-facts/ types.ts + provider.ts + index.ts;
    // packages/runtime/agent-setup/preset/production-observer.ts +
    // persona-composition.ts; the four W2-A specs) + (ii) the thirty-five
    // superseding PR-E files (Blueprint v2 + RequirementAuthority +
    // Requirement/Recovery atomic cutover, D-fix cutover 3ccbfe82 + E.12)
    // + (iii) the fourteen W3-D fix files (crossAgentTrigger impact class
    // + creation-preflight + host-entry + the new W3-A/B/C/D/E specs).
    // The D-fix line's own provenance recorded the same 58 files as "+58
    // on top of the 822 pin = 880"; on the folded tree they stack on top
    // of the PR-D line's 825 (822 W1-C + 2 round-2 + 1 round-3). The
    // scanner run on the folded tree reports filesScanned = 883
    // (authoritative; not hand-computed). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // Scanner unchanged. Single-writer pin bump on the fold branch.
    // pre-alpha3 PR #42 pass 3 (feat/pre-alpha3-pre-e-requirement-recovery,
    // this commit): +1 on top of the 883 fold pin = 884 — the one new
    // scannable suite packages/runtime/test/
    // requirement-probe-blueprint-scoping.test.ts (the PF-1 fix suite:
    // per-blueprint facts scoping of the remote intent.probe / per-root
    // prober / admission gates — multi-blueprint probe vs gate, typed
    // identity, live-server verdicts, the single-blueprint byte-identity
    // pins). Carries zero denylist vocabulary; the frozen quarantine hit
    // set is unchanged at fifteen. Scanner unchanged. Single-writer pin
    // bump on the fold branch.
    // pre-alpha3 PR #42 pass 3b (feat/pre-alpha3-pre-e-requirement-
    // recovery, this commit): +2 on top of the 884 pin = 886 — the two
    // new scannable files of the D-1/D-3 decision-scoping line:
    // packages/runtime/requirement-facts/pending.ts (the pure PENDING/
    // DOWN classifier + the s6 probe seed-filled-fact drop filter, D-3 +
    // the probeable narrowing) + packages/runtime/test/
    // requirement-d1-d3-decision-scoping.test.ts (the 37-test D-1 + D-3
    // decision-path suite). Carries zero denylist vocabulary; the frozen
    // quarantine hit set is unchanged at fifteen. Scanner unchanged.
    // Single-writer pin bump on the fold branch.
    // pre-alpha3 F15 (feat/pre-alpha3-f15-mcp-live-loss, folded
    // 2026-09-30): +2 on top of the 886 pin = 888 — the two new
    // scannable files of the MCP live-loss line:
    // packages/runtime/test/f15-mcp-live-loss-characterization.test.ts
    // (the RED gap probe: mounted fiber + upstream post-budget-exhaustion
    // tool-surface withdrawal via the bridge double's public-seam trigger,
    // the frozen legacy fiber-presence-probe oracle (the stale positive),
    // and the assertion on the observeMcpOperationalWitness seam) +
    // packages/runtime/test/f15-mcp-live-loss.test.ts (the §9 unit-matrix
    // spec — L1 normal / §9.4 re-sync transient / L2 permanent loss +
    // same-step retirement + exactly-one capability-lost / L6 idempotence
    // / L7 cooldown-blocked same boundary + fresh remount + exactly-one
    // mount-restored / L3 zero-tool unknown / L4 policy-deny suppression
    // / L5 teardown-close suppression / §9.5 multi-MCP isolation / the
    // §9.2 static reconnect-policy call-site witness). The F15 product +
    // bridge modifications (agent-bindings.mjs, readiness/provider.ts +
    // index.ts, plugin/host.ts, plugin/types.ts,
    // u6-mcp-017-regression.test.ts, t12a-live-bridge.mjs) are
    // already-scanned files (no count delta). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // Scanner unchanged. The 888 value is the scanner run on the folded
    // tree (authoritative; not hand-computed).
    // pre-alpha3 PR-F (feat/pre-alpha3-prf-closure, this commit): +8 on
    // top of the 888 pin = 896 — the eight new scannable files of the
    // final closure increment: (a) packages/remote/src/contracts/
    // semantic.ts (the F.3 semantic version adapter — the ONLY
    // version->semantic translation in the wire surface, with the shared
    // `live` projection wire application) + (b) packages/runtime/
    // mutation/internal/mutation-service.ts (the F.2 internal test-world
    // kernel: the StepClock + MutationService + structural intake
    // validators + the frozen-error mapper, retired from production by
    // PR-A and pulled off the public surface by PR-F) + (c) packages/
    // runtime/test/prf-inspect-same-source.test.ts (the F.4 same-source
    // read-surface pin: config-inspected policy/requirement/recovery
    // views over the SAME durable facts the gates consume) — the three
    // WIP re-landed files (the policy-adapter.ts move
    // packages/runtime/policy-adapter.ts -> packages/runtime/
    // mutation/internal/policy-adapter.ts is an already-scanned
    // relocation, no count delta) — plus (d-h) the five scannable files
    // of the w1a F10/F11 stack-side re-land (master e44ebbbd, the
    // pre-e->master closure merge's shared base): (d) packages/runtime/
    // src/plugin/bound-blueprint.ts (the production bound-Blueprint
    // resolver, the three-case contract) + (e) packages/runtime/test/
    // governance-stale-ui-generation.test.ts (the F10 optimistic
    // override-generation conflict, zero write) + (f) packages/runtime/
    // test/remote-override-expected-generation.test.ts (the F10 v7
    // contract surface) + (g) packages/runtime/test/
    // policy-state-multi-team-bound-blueprint.test.ts (the F11 closed
    // set over the addressed team's bound Blueprint) + (h) packages/
    // runtime/test/policy-state-bound-blueprint-production-wiring.test.
    // ts (the F11 production wiring over the real factory + authority).
    // The w1a re-landed modifications (s6-remote.ts, host.ts, root.ts,
    // governance/service.ts, mutation/errors.ts, remote contracts
    // params/catalog/version/dispatch/index, team-remote-client.ts,
    // team-governance.ts, TeamGovernance.tsx + the modified test files)
    // are already-scanned files (no count delta). Carries zero denylist
    // vocabulary; the frozen quarantine hit set is unchanged at fifteen.
    // fix-persona-kind (finding A, the pre-alpha3 review P1 — the persona
    // KIND subject vs presetId mismatch in the production provider →
    // preflight → gate chain) pin (+1): this branch adds
    // packages/runtime/test/persona-kind-provider-preflight.test.ts (the
    // persona-KIND-convention regression suite over the REAL production
    // chain: the real createRuntimeRequirementFactsProvider + the real
    // resolveRuntimeSubstrate over the production observer-seam double +
    // the real runCreationPreflight / evaluateCreationScopes — T1 bespoke
    // composable preset ids pass with no seed, T2 the R8 root/member role
    // split, T3 the complete-conflict no-downgrade, T4 the typed
    // unresolved fail-closed + the documented 2-state seed legs, T5 the
    // frozen v1 preset-id legacy path, T6 the end-to-end creation
    // preflight). The product change (the requirement-facts/provider.ts
    // persona case — the kind path ahead of the byte-identical legacy
    // preset-id path) is an in-place edit on an already-scanned file (no
    // count delta). Carries zero denylist vocabulary (the scan over it
    // passes — the frozen quarantine hit set is unchanged at fifteen
    // occurrences). The 897 value is the scanner run on the fixed tree
    // (authoritative; not hand-computed).
    // fix-persona-kind (PR #46 external-review fix round — Blocker-2, the
    // SHIPPED DIST) pin (+1): this branch adds
    // packages/runtime/test/persona-kind-shipped-dist-smoke.test.ts (the
    // SHIPPED DIST SMOKE — the finding-A persona-KIND semantics + the
    // Blocker-1 role identity + the Blocker-3 typed §13.5 lane asserted
    // over the BUILT dist artifact via the file-URL import precedent; the
    // companion commit rebuilds the dist mirror — the rebuilt
    // provider.js/types.js/index.js/root.js + their .d.ts/.map — which
    // are already-scanned artifacts (no count delta)). Carries zero
    // denylist vocabulary (the scan over it passes — the frozen
    // quarantine hit set is unchanged at fifteen occurrences). Scanner
    // unchanged. The 898 value is the scanner run on this tree
    // (authoritative; not hand-computed).
    // MERGED-TREE pin (the 26c48c87 sync merge, 2026-10-01): 896 base +
    // 2 fix-persona-kind (PR #46) + 3 fix-runtime-template-consent (findings
    // I + J + I residual) + 5 fix-control-authz (PR #49, via origin/master)
    // + 2 finding-F (fix/mcp-target-materialization) = 908. RECOMPUTED from
    // the actual merged tree with the frozen scanner (the
    // merge-p4t6-recompute probe in the evidence log dir; the old pins 903
    // (this branch) and 906 (origin/master 26c48c87) are both stale — each
    // predates the other line's scannable additions; union disjoint by
    // file name). Scanner .mjs byte-identical on both sides.
    // ALPHA.3 PR1 pin (PermissionOverlay Foundation, 2026-10-01): 908 + 14 =
    // 922 — the fourteen scannable files this PR adds: two storage sources
    // (schema/permission-overlay.ts + repositories/permission-overlays.ts),
    // four runtime permission-governance sources (types.ts + port.ts +
    // overlay-repository.ts + index.ts), the shared spec helper
    // (runtime/test/permission-overlay-helpers.ts) and the seven
    // permission-overlay spec files (append + latest-generation +
    // restart-persistence + history-immutability + generation-conflict +
    // validation + port-surface). Zero new denylist vocabulary: the frozen
    // quarantine hit set stays at fifteen occurrences. Scanner .mjs
    // unchanged. The 922 value is the scanner run on this tree
    // (authoritative; not hand-computed).
    // ALPHA.3 PR1 additive-store round: 922 + 2 = 924 — the two scannable
    // spec files that pin the tenth store (testkit a3p1-team-domain-tenth-
    // store + a3p1-seam-additive-tables). No new source file: the store is
    // the same `schema/permission-overlay.ts` + `repositories/permission-
    // overlays.ts` pair already counted above. Zero new denylist vocabulary;
    // the frozen quarantine hit set stays at fifteen occurrences; scanner
    // .mjs unchanged. The 924 value is the scanner run on this tree
    // (authoritative; not hand-computed).
    // ALPHA.3 PR2 effective-assembler round: 924 + 5 = 929 — the Effective
    // Permission Assembler module (`runtime/effective-policy/permission-
    // assembler.ts`), its fixture helper, and the three targeted specs
    // (`a3p2-permission-assembler-precedence` / `-provenance` /
    // `a3p2-effective-policy-lane-import`, the last one pinning that re-exporting
    // the assembler through this lane does not put the admission surface into an
    // initialization cycle). No new denylist vocabulary and no new adapter: the
    // assembler COMPOSES the frozen Alpha.2 resolver and READS the PR1 snapshot
    // type, so the lane words allow/ask/deny it carries are the same
    // canonical-grammar tokens every Alpha.2 module already uses (outside this
    // scanner's denylist). The frozen quarantine hit set stays at fifteen
    // occurrences; scanner .mjs unchanged. The 929 value is the scanner run on
    // this tree (authoritative; not hand-computed).
    // ALPHA.3 PR3 governance-mutation round: 929 + 3 = 932 — the three
    // scannable files this PR adds: the permission-mutation kernel
    // (`runtime/governance/permission-mutation.ts` — the unified
    // PermissionMutation model, the §6 envelope model, the carrier grammar)
    // and its specs (`a3p3-permission-mutation-authority` /
    // `a3p3-governance-lane-hygiene`, the latter pinning zero production
    // consumers + the persistence-only consumer leg; plus the external P1
    // bounded-repair batch's two: `a3p3-revoke-reveal-semantics` — the
    // directed effective-region regressions — and `a3p3-effective-parity`,
    // the kernel-vs-merged-assembler parity matrix). The service/types/
    // index edits are in-place changes on already-scanned files (no count
    // delta). Zero new denylist vocabulary — the lane words allow/ask/deny
    // carry the same canonical-grammar tokens PR1/PR2 established
    // (outside the scanner's denylist); the frozen quarantine hit set stays
    // at fifteen occurrences; scanner .mjs unchanged. The 934 value is the
    // scanner run on this tree (authoritative; not hand-computed).
    // MERGED-TREE INTEGRATION NARRATIVE (both parent lines, merge-union
    // precedent — PR4 lineage first, then the PR5 line, then the recount):
    // ALPHA.3 PR4 permission-lifecycle round (2026-10-02): 934 + 7 = 941 —
    // the seven scannable files this PR adds: the lifecycle lane module set
    // (`runtime/permission-lifecycle/types.ts` + `mutation-lane.ts` +
    // `decision-lane.ts` + `index.ts` — the grant / revoke / restore entries
    // riding the SAME `PermissionMutation` authority, the ADR §8 execution
    // gate, and the merged file / exec decision planes), the production
    // assembly helper (`runtime/src/plugin/permission-plane.ts` — the
    // governance lane the root injects + the plane reference the live glue
    // reads), and the two specs (`a3p4-permission-lifecycle-e2e`, the
    // end-to-end service / call-chain legs over the real durable store and
    // the real lifecycle service, and `a3p4-production-permission-plane`, the
    // production-root assembly reachability legs). The `root.ts` / `host.ts`
    // / `agent-bindings.mjs` / `pre-execute-adapter.ts` edits are in-place
    // changes on already-scanned files (no count delta). Zero new denylist
    // vocabulary — the lifecycle words this lane carries are the contracts FSM
    // vocabulary (`ARCHIVE` / `RESTORE` / `ARCHIVED` / `DISPOSED`), not legacy
    // Team SessionEvent names; the frozen quarantine hit set stays at fifteen
    // occurrences and the scanner .mjs is unchanged. The 941 value is the
    // scanner run on this tree (authoritative: this suite reported
    // `expected 941 to be 934` before the recount; not hand-computed).
    // ALPHA.3 PR4 permission-lifecycle ROUND 3 (2026-10-06): 941 + 2 = 943 —
    // the two RED-first regression specs of the consolidated fix
    // (`a3p4-pr4-decision-routing-regression.test.ts`,
    // `a3p4-pr4-production-entry-regression.test.ts`; both SessionEvent-free
    // — every other pin of this suite, the fifteen-occurrence quarantine hit
    // set included, is UNCHANGED). The 943 value is the scanner run on this
    // tree (authoritative: this suite reported `expected 943 to be 941`
    // before the recount; not hand-computed).
    // ALPHA.3 PR4 permission-lifecycle ROUND 4 (2026-10-07): 943 + 1 = 944 —
    // the one new direct authority-facts + kernel-ceiling spec
    // (`a3p4-r4-authority-binding.test.ts`, SessionEvent-free; every other
    // pin of this suite is UNCHANGED — the round-4 production edits are
    // in-place changes on already-scanned files). The 944 value is the
    // scanner run on this tree (authoritative: this suite reported
    // `expected 944 to be 943` before the recount — raw retained as
    // `round4/r4-p4t6-scan.log`; not hand-computed).
    // ALPHA.3 PR4 permission-lifecycle ROUND 9 (2026-10-02, parent A7-5):
    // 944 + 1 = 945 — the ONE new scannable spec since the round-4 pin is
    // the root-assembled entry/exec + principal regression
    // (`a3p4-pr7-entry-exec-contract-regression.test.ts`, added round 7,
    // SessionEvent-free; round 8 EXTENDED it in place — `git log
    // --diff-filter=A` over base..HEAD confirms no other test file was ever
    // added on this branch). Every other pin of this suite is UNCHANGED.
    // The 945 value is the scanner run on this tree (authoritative: this
    // suite reported `expected 945 to be 944` before the recount — RED raw
    // `round9/r9-p4t6-RED.log`, GREEN `round9/r9-p4t6-GREEN.log`, full suite
    // `round9/r9-testkit-suite.log`; not hand-computed). The testkit suite
    // had NOT been run in rounds 5-8 — this closes that gap.
    // MASTER INTEGRATION (root ruling: merge of 6259cf4b; round 10):
    // 945 + 1 = 946 — the combined tree adds master's ONE new scannable
    // client spec (`packages/client/test/pr56-control-subject-payload.test.ts`,
    // PR #56, absent from the branch base). The 946 value is the committed
    // scanner run on the combined tree (authoritative: this suite reported
    // `expected 946 to be 945` before the recount — RED raw
    // `round10/r10-p4t6-combined-RED.log`, GREEN `round10/r10-p4t6-GREEN.log`;
    // not hand-computed). On the combined tree 9 of the 10 legs passed
    // UNCHANGED (quarantine hits, excluded-self, citations, controls) — the
    // ONLY failing leg is this count leg.
    // ALPHA.3 PR5 notification/projection round (branch side): the PR5
    // increment is NINE files — the seven lane-round files below plus TWO
    // binding-round files. On THIS merged tree the PR #56 client spec
    // (+1 above, the master-integration paragraph) is already counted by
    // master's 946 lineage, so it is NOT added again here.
    // (The 944 value below was the scanner run on the PRE-MERGE PR5 branch
    // tree — kept as lineage, not as the merged-tree claim.)
    // The +7 lane files: the runtime
    // permission-notification awareness lane (`packages/runtime/permission-
    // notification/types.ts + notification.ts + projection.ts + index.ts`
    // — the generation-tagged notification, the active-only never-throwing
    // notifier, the read projection over the PR1 `latest`/`history`
    // boundaries; shipped UNWIRED by design, zero production consumers,
    // zero runtime imports outside the lane) plus its three specs
    // (`a3p5-permission-notification` — the four required classes: active
    // delivered / idle never awakened / stale marked with permissions
    // unchanged / failed delivery leaving the mutation ack untouched —
    // `a3p5-permission-read-projection`, and `a3p5-permission-notification-
    // lane-hygiene` pinning the closed export surface, the TYPE-ONLY import
    // graph and the zero-consumer walk). Zero new denylist vocabulary; the
    // frozen quarantine hit set stays at fifteen occurrences (the PR5 run
    // reports hits = 15); scanner .mjs unchanged. The binding round adds
    // TWO files (permission-notification/binding.ts + its spec; zero new
    // denylist vocabulary, quarantine hits stay 15). The 944 value is the
    // scanner run on this tree (authoritative; not hand-computed).
    // FINAL MERGED-TREE PIN (this merge of 940cd841): value = the committed
    // scanner's OWN run on this final merged tree (authoritative RED/GREEN
    // raws: `merge/p4t6-RED.log` / `merge/p4t6-GREEN.log`; not hand-computed). Arithmetic: 946 (master lineage,
    // incl. PR #56) + 9 PR5 files (7 lane + 2 binding, disjoint from the 11
    // PR4 files already in 946) = 955. This suite reported
    // `expected 955 to be 944` before the recount — RED raw retained.
    // FINAL PRODUCTION SPLICE PIN: the alpha3-pr5 splice wires EXISTING
    // sources only (its lane edits are doc-level; root.ts / types.ts / the
    // live glue were already counted; dist is outside the scan). Its one
    // new scannable file is the root-assembled integration spec
    // test/a3p5-permission-splice.test.ts, so 955 + 1 = 956 on this
    // suite's own scanner run. RED raw `splice/p4t6-RED.log` reported
    // `expected 956 to be 955`; GREEN raw `splice/p4t6-GREEN.log`.
    // ROOT BLOCK FIX-BATCH PIN: the fix batch adds exactly two scannable
    // spec files (test/a3p5-glue-permission-receipt.test.ts, the real-glue
    // receipt harness, and test/a3p5-permission-read-wiring.test.ts, the
    // override.getPermission read-path harness); every other fix-batch edit
    // touches already-counted files. 956 + 2 = 958 on this suite own scanner
    // run. RED raw `fixbatch/p4t6-RED.log` reported `expected 958 to be 956`;
    // GREEN raw `fixbatch/p4t6-GREEN.log`.
    // 958 -> 965 -> 968: the seven rc2 files PR #62 adds, then the three
    // persona-residue files (the shared harness persona-slot reader, its type
    // surface, and its spec). See the case title for both increments.
    // SCOPE CLARIFICATION on the older wording below: "7 added, 0 removed, all
    // of them packages/*/test/rc2-*.test.ts" is the rc2 sub-delta of the
    // 958 -> 965 step ONLY; it was never this PR's complete committed delta.
    // Against the original PR base 6b2f401b the committed-file comparison now
    // accounts for 13 added scannable files and zero removals: those 7 rc2 test
    // files, the 3 persona files above, and the 3 root-binding harness files in
    // the next paragraph.
    // 968 -> 971: the root-binding bounded-run harness round adds exactly three
    // scannable files, all intended tracked harness/test source already inside
    // the scanner's existing packages/**/*.mjs scope - nothing generated,
    // nothing private, and no new skip, exclusion or self-reference is involved:
    //   packages/runtime/root-binding/harness/blueprint-source.mjs            (blob 3f9ddfb0)
    //   packages/runtime/root-binding/harness/bounded-run.mjs                 (blob f2872766)
    //   packages/runtime/root-binding/harness/bounded-run.regression.test.mjs (blob 01d3600f)
    // Arithmetic: 958 + 7 + 3 + 3 = 971. Proof beyond arithmetic: the sorted
    // inventory of THIS scanner run is retained at
    // dev/agent-workflow/evidence/dsh-020rc2-upgrade/p4t6-inventory-drift-20261006/p4t6-scanner-inventory-20261006.txt
    // (971 entries; dropping exactly these three leaves 968, and every entry is
    // a packages/** .ts/.mts/.mjs source - zero dist, dev, evidence or
    // node_modules paths), and each path's introducing commit (3fb2a729 for
    // blueprint-source.mjs, 65adf3ab for the two bounded-run files) is NOT an
    // ancestor of b5becb03, the commit that wrote the 968 pin, so the three
    // joined the scan only after that pin. RED raw p4t6-RED-20261006.log
    // reported `expected 971 to be 968`; GREEN raw p4t6-GREEN-20261006.log. The
    // constant stays an exact equality: this closes an unfinished maintenance
    // inventory pin - it is not scanner weakening and not relabeled debt.
    // 971 -> 973 (A4-PR0a): this commit adds exactly two scannable tracked test
    // files, both inside the scanner's existing packages/**/*.ts scope, nothing
    // generated and no new skip or exclusion:
    //   packages/runtime/test/a4pr0a-abandon-projection-closure.test.ts
    //   packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts
    // Arithmetic: 958 + 7 + 3 + 3 + 2 = 973. Both are added by THIS commit, so
    // neither existed at the 971 pin; the RED run of this file reported
    // `expected 973 to be 971` and the GREEN run reports equality. The constant
    // stays an exact equality (ADR A5-17: the recompute authority starts at
    // A4-PR0a - an added test file is a legitimate increment, and it is still
    // pinned exactly, never widened with a tolerance).
    // 973 -> 978 (A4-PR0): this commit adds exactly five scannable tracked
    // files, all inside the scanner's existing packages/** scope - two lane
    // sources plus three specs - with nothing generated, no new skip and no new
    // exclusion, and nothing removed:
    //   packages/runtime/governance/proposal-store.ts
    //   packages/runtime/governance/proposal-codes.ts
    //   packages/runtime/test/a4pr0-proposal-store.test.ts
    //   packages/runtime/test/a4pr0-proposal-corrupt.test.ts
    //   packages/runtime/test/a4pr0-proposal-generation.test.ts
    // Arithmetic: 973 + 5 = 978. The commit also EDITS three already-counted
    // files (src/plugin/projection-source.ts, the client's model/ledger-adapter.ts
    // and a4pr0a-fact-type-closed-set.test.ts) - an edit is not an increment - and
    // adds scripts/fail-set.mjs, which is outside the scanned `packages/**` scope
    // entirely. The RED run of this file reported `expected 978 to be 973` before
    // the constant moved; the GREEN run reports equality. Exact equality stays
    // (ADR A5-17): no tolerance, and the five paths are additionally asserted
    // present by path below rather than inferred from the total.
    // 978 -> 983 (A4-PR1): this commit adds exactly five scannable tracked
    // files, all inside the scanner's existing `packages/**/*.ts` scope — three
    // lane sources plus two specs — with nothing generated, no new skip, no new
    // exclusion and nothing removed:
    //   packages/domain/authority-envelope/src/authority-envelope.ts   (the shared grammar: the domain LEAF ADR A3-9 requires)
    //   packages/domain/authority-envelope/src/index.ts                (its barrel)
    //   packages/runtime/governance/authority-ceiling.ts               (bindingDocs/grantCeiling, spec §7.4)
    //   packages/domain/test/a4p1-blueprint-v3-governance.test.ts      (Blueprint v3 carrier + v1/v2 hash goldens)
    //   packages/runtime/test/a4p1-authority-envelope.test.ts          (the two lookups + the meet + positional binding)
    // Arithmetic: 978 + 5 = 983. Everything else this PR touches is an EDIT to
    // already-counted files (blueprint schema/types/validate/index, the
    // governance kernel + barrel, permission-plane, the domain tsconfig, the
    // lane-hygiene and a3p3/a3p4 specs, testdata/fixtures.ts) — an edit is not
    // an increment — and `dev/agent-workflow/evidence/**` plus `dist/**` are
    // outside the scanned scope. RED raw
    // `dev/agent-workflow/evidence/a4-pr1/gates/p4t6-RED.log` reported
    // `expected 983 to be 978`; the GREEN raw is `gates/p4t6-GREEN.txt`. Exact
    // equality stays (ADR A5-17): no tolerance, and the paths behind the movement
    // are additionally asserted present BY PATH below, not inferred from the total.
    // A4-PR2 (lane A/B/C): one production module plus its three specs. The edited
    // files (authority-ceiling.ts, permission-mutation.ts, service.ts, types.ts,
    // tools.ts and the four amended specs) are EDITS, not increments, and are
    // outside this list by the rule stated above.
    const SCANNED_PATHS_A4PR2: readonly string[] = [
      'packages/runtime/governance/runtime-authority.ts',
      'packages/runtime/test/a4p2-authority-ceiling.test.ts',
      'packages/runtime/test/a4p2-ceiling-reachability.test.ts',
      'packages/runtime/test/a4p2-dual-envelope-mutation.test.ts',
    ]
    // A4-PR3 (lane A/B/C): four lane sources plus four specs, all inside the
    // scanner's existing `packages/**/*.ts` scope, nothing generated and nothing
    // removed. The `intervention/` lane ships UNWIRED by design (ADR A4-6's
    // zero-dist posture restated at plan line 302: it is deliberately NOT in
    // `packages/runtime/tsconfig.build.json`, and the test asserting that is
    // `packages/runtime/test/a4p3-intervention-projection.test.ts`), so the four
    // sources are counted exactly as any other lane source is. Everything else
    // this PR touches is an EDIT to an already-counted file
    // (control/types.ts, control/service.ts, control/index.ts,
    // control/leader-notification.ts, src/plugin/projection-source.ts,
    // packages/client/src/model/ledger-adapter.ts and the amended specs) — an
    // edit is not an increment — and `dist/**` plus
    // `dev/agent-workflow/evidence/**` stay outside the scanned scope.
    // Arithmetic: 987 + 8 = 995. RED raw
    // `dev/agent-workflow/evidence/a4-pr3/red-captures/RED-04-p4t6-file-count-pin.txt`
    // reported `expected 994 to be 987`. The eighth file is
    // `a4p3-intervention-lane-hygiene.test.ts`, which the FREEZE AUDIT (finding F4,
    // against the pre-amendment freeze) required: the plan names it at line 305, so
    // the pin moved 994 -> 995 — and it moved for a NAMED file, which is what the
    // tie below is for.
    const SCANNED_PATHS_A4PR3: readonly string[] = [
      'packages/runtime/intervention/types.ts',
      'packages/runtime/intervention/derivation.ts',
      'packages/runtime/intervention/projection.ts',
      'packages/runtime/intervention/index.ts',
      'packages/runtime/test/a4p3-approval-case.test.ts',
      'packages/runtime/test/a4p3-approval-escalation.test.ts',
      'packages/runtime/test/a4p3-intervention-projection.test.ts',
      'packages/runtime/test/a4p3-intervention-lane-hygiene.test.ts',
    ]
    // A4-PR4 (lane A/B/C): one lane source plus its three specs, all inside the
    // scanner's existing `packages/**/*.ts` scope. Everything else this PR
    // touches is an EDIT to an already-counted file
    // (operation-permission/errors.ts, operation-permission/index.ts,
    // operation-permission/pre-execute-adapter.ts, tools/tools.ts, the amended
    // a2c4 / a3p3 / c1 specs, src/plugin/root.ts and
    // src/plugin/live/agent-bindings.mjs) — an edit is not an increment — and
    // `dist/**` plus `dev/agent-workflow/evidence/**` stay outside the scanned
    // scope. `control/service.ts` is NOT touched by this PR at all (the A1-14
    // guard-side re-check is reported as a file-scope blocker, not implemented).
    const SCANNED_PATHS_A4PR4: readonly string[] = [
      'packages/runtime/operation-permission/approval-routing.ts',
      'packages/runtime/test/a4p4-capability-vs-permission.test.ts',
      'packages/runtime/test/a4p4-operation-approval-authority.test.ts',
      'packages/runtime/test/a4p4-operation-single-shot.test.ts',
    ]
    // A4-PR5 (lane A/B/C): one proposal-law lane source plus its three specs,
    // all inside the scanner's existing `packages/**/*.ts` scope. Everything
    // else this PR touches is an EDIT to an already-counted file
    // (governance/service.ts, governance/types.ts, governance/index.ts,
    // src/plugin/root.ts, src/plugin/s6-remote.ts, src/plugin/permission-plane.ts,
    // tools/types.ts, tools/tools.ts, the amended a3p3 hygiene, a4p2
    // dual-envelope and tools c1-list specs, and THIS pin) — an edit is not an
    // increment (`control/` was NOT touched: the guard-side A1-14 duty closed
    // as a named BLOCKED with the exact seam, recorded in
    // `dev/agent-workflow/evidence/a4-pr5/design.md` §9) — and `dist/**` plus
    // `dev/agent-workflow/evidence/**` stay outside the scanned scope. RED raw
    // `dev/agent-workflow/evidence/a4-pr5/red-captures/RED-D01-p4t6-pin-999.txt`
    // reported `expected 1003 to be 999` on the rebased tree.
    const SCANNED_PATHS_A4PR5: readonly string[] = [
      'packages/runtime/governance/permission-approval.ts',
      'packages/runtime/test/a4p5-permission-mutation-proposal.test.ts',
      'packages/runtime/test/a4p5-permission-mutation-inline-commit.test.ts',
      'packages/runtime/test/a4p5-self-mutation.test.ts',
    ]
    // A4-PR6 (stage 6.A increment; extended INCREMENTALLY per file-creating
    // commit, per shared rule 8 / A5-17 — never renumber another PR): the
    // governance-warning lane (types + service + index, the ONE warning
    // module the start gate, the boundary observation and the v8 surface
    // read through) plus its three runtime specs. Everything else PR6
    // touches so far is an EDIT to an already-counted file (s6-remote.ts,
    // root.ts, host.ts, the remote dispatch.ts backing vocabulary,
    // intervention/*, tsconfig.build.json, this pin) — an edit is not an
    // increment — and `dist/**` plus `dev/agent-workflow/evidence/**` stay
    // outside the scanned scope.
    const SCANNED_PATHS_A4PR6: readonly string[] = [
      'packages/runtime/governance-warning/types.ts',
      'packages/runtime/governance-warning/service.ts',
      'packages/runtime/governance-warning/index.ts',
      'packages/runtime/test/a4p6-governance-warning.test.ts',
      'packages/runtime/test/a4p6-governance-warning-service.test.ts',
      'packages/runtime/test/a4p6-intervention-aggregation.test.ts',
      // §6.B (contract v8): the intervention wire law module + its remote suite.
      'packages/remote/src/handlers/intervention.ts',
      'packages/remote/test/a4p6-remote-v8.test.ts',
      // §6.D (client plane): the two client model sources (the scanner's
      // include pattern is .ts/.mts/.mjs — the panel/spec .tsx files are
      // outside the scan; the discovered total is the proof: discovered
      // minus registered is exactly these paths).
      'packages/client/src/model/team-interventions.ts',
      'packages/client/src/model/permission-administration.ts',
      // Review round 1 (this PR's review-fix commits): three new runtime
      // specs — the start-gate entrance suite (fix 1), the host-adapter
      // suite over the real docs/contains builders (fixes 2+3), and the
      // driven-principal act suite (fixes 5+6). Everything else the round
      // touched is an EDIT to an already-counted file (s6-remote.ts,
      // root.ts, host.ts, permission-plane.ts, catalog.ts, the client
      // model/spec, this pin) — an edit is not an increment.
      'packages/runtime/test/a4p6-start-gate-entrances.test.ts',
      'packages/runtime/test/a4p6-governance-warning-host-adapter.test.ts',
      'packages/runtime/test/a4p6-driven-principal-act.test.ts',
    ]
    // A4-PR7 (feat/a4-pr7-v3-cutover): A1-14's consumption-point revalidation
    // suite, the v3-cutover acceptance lane, and the Task 7.5 fence wrapper. This
    // list grows with every scannable file PR7 adds, and the advancing total below
    // moves exactly when this list does — never for a file that is not named here,
    // and never by hand. The fence SCRIPT (`scripts/verify-blueprint-version-clean
    // .mjs`) is deliberately absent: this scan covers the nine package directories,
    // and a root-level script is outside its scope (the wrapper test is inside, and
    // it is what makes the script a gate — ADR A5-9).
    const SCANNED_PATHS_A4PR7: readonly string[] = [
      'packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts',
      'packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts',
      'packages/testkit/test/a4p7-blueprint-version-clean.test.ts',
      // A4-PR7 Ruling 1 (this commit): the three-state migration surface on the
      // Remote catalog. Exactly one new scannable file — every other path the
      // ruling touches is an EDIT to a path this scan already counts, and an edit
      // is not an increment. The total below moves because this line does.
      'packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts',
      // A4-PR7 Task 7.5 (this commit): the smoke classifier's test. One new
      // scannable file — Task 7.5's other new paths are `scripts/*.mjs`
      // (+ their `.d.mts`), which this scan's `packages/**` scope does not
      // cover, and its edits to `scripts/build-client-composition.mjs` /
      // `scripts/check-artifacts-committed.mjs` are edits, not increments.
      'packages/testkit/test/a4p75-composition-smoke-classification.test.ts',
    ]
    // a4-escalate-act-truth (fix/a4-escalate-receipt-truth): the ONE new
    // scannable file of this fix lane — the escalate-terminate act-truth spec.
    // The fix's other paths (control/service.ts, this pin) are EDITS to
    // already-counted files, and an edit is not an increment. Like every list
    // above, this one is asserted present by path below and its length is tied
    // to the movement of the total; the total itself is never written by hand.
    const SCANNED_PATHS_A4ESCALATE: readonly string[] = [
      'packages/runtime/test/a4-escalate-act-truth.test.ts',
    ]
    // A4-F1 (`fix/a4-f1-row-vs-document-version`): the boundary test for finding F1
    // — a storage row's L3 stamp is not a Blueprint document version, and a row that
    // cannot know the version says so instead of printing a number. Exactly one new
    // scannable file; every other path that fix touched is an EDIT to a path this
    // scan already counts, and an edit is not an increment.
    const SCANNED_PATHS_A4F1: readonly string[] = [
      'packages/runtime/test/a4f1-row-version-not-document-version.test.ts',
    ]
    // a4-surface-authority-unavailable (feat/a4-surface-authority-unavailable):
    // the ONE new scannable file of this lane — the escalate-terminate SURFACING
    // spec. The lane's other paths (control/types.ts, control/service.ts,
    // intervention/derivation.ts, intervention/projection.ts, the a4-escalate
    // re-read rewrite, the client a4p6 spec) are all EDITS to files this scan
    // already counts, and an edit is not an increment. The total below moves
    // because this line does.
    const SCANNED_PATHS_A4SURFACE: readonly string[] = [
      'packages/runtime/test/a4-surface-authority-unavailable.test.ts',
    ]
    // a4-check-artifacts-nonempty (fix/a4-check-artifacts-nonempty): the ONE new
    // scannable file of this lane — the check:artifacts non-emptiness spec. The
    // lane's other path (scripts/check-artifacts-committed.mjs) is an EDIT to a
    // root-level script this scan does not cover (scripts/** is outside the nine
    // package dirs), and an edit is not an increment. The total below moves
    // because this line does.
    const SCANNED_PATHS_A4ARTIFACTS: readonly string[] = [
      'packages/testkit/test/a4-artifacts-nonempty.test.ts',
    ]
    // A4-PR7 §7.5 prerequisites (branch `feat/a4-73-prerequisites`, the 7.3 window):
    // the carrier-width pin the ceiling-coverage probe parked as
    // `dev/agent-workflow/evidence/a4-ceiling-coverage/a4p7-carrier-width-under-ceiling.test.ts.inert`,
    // landed here as a live spec. Its inertion note named THIS entry as the reason it
    // could not land in the probe's own commit: a landed test without its path here
    // moves the derived total with nothing asserting why. The second path is the
    // §7.5(3) spec — the ceiling's no-context branch pinned as a refusal at the real
    // entry. The third path is the 7.3-review spec: the ceiling re-asked at the
    // commit boundary of an APPROVED retry, over the same claimed-point set the
    // direct gate judges. Everything else the prerequisites and the review round
    // changed (the ceiling asking the width the mutation claims, the reader's
    // abstention answer, the shared `permissionRiseClaimedPoints` point algebra,
    // the `PermissionRiseRegion` doc) is an EDIT to a path this scan already
    // counts, and an edit is not an increment.
    const SCANNED_PATHS_A4P7PRE: readonly string[] = [
      'packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts',
      'packages/runtime/test/a4p7-ceiling-no-context-refusal.test.ts',
      'packages/runtime/test/a4p7-approved-retry-ceiling-at-commit.test.ts',
    ]
    // A4-PR7 Task 7.6 (`test/a4-pr7-76-gate`): the machine merge gate as a spec. One
    // new scannable file — `packages/testkit/test/a4p7-merge-gate.test.ts`. The leg's
    // other writes are this pin (an edit) and evidence `.md`/`.txt` under
    // `dev/agent-workflow/evidence/`, which this scan's `packages/**` scope does not
    // cover. Like every list here, the path is asserted present BY PATH below and the
    // length is tied to the movement of the total; the total is never written by hand.
    const SCANNED_PATHS_A4P76GATE: readonly string[] = [
      'packages/testkit/test/a4p7-merge-gate.test.ts',
    ]
    // A4-PR7 Task 7.3 the flip itself (`feat/a4-73-flip`, step 3 of 3): ONE new
    // scannable file. `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` narrowing is a
    // semantic change with no new surface, EXCEPT for the one document this repo
    // ships and nothing parsed: the embedded `blueprintSource` of the repo-root
    // bundle layer. That document is now parsed by a committed test
    // (`packages/runtime/test/a4p7-shipped-composition-blueprint.test.ts`), so the
    // cutover's own acceptance is witnessed rather than asserted. Everything else
    // this lane writes is an EDIT to a path this scan already counts (the two
    // narrowed constants, the migrated fixtures, the wrapper's deferral rows, the
    // legacy adapter's emitted draft, the skill's version sentence), plus evidence
    // `.md`/`.patch` under `dev/agent-workflow/evidence/` outside `packages/**`.
    // An edit is not an increment.
    const SCANNED_PATHS_A4P73FLIP: readonly string[] = [
      'packages/runtime/test/a4p7-shipped-composition-blueprint.test.ts',
    ]    // A4-PR2: the total is the base plus the derived PR2 list below, so the pin
    // moves exactly when the named files exist and cannot move for an unnamed one.
    // A4-PR7 Task 7.3 Option A (`feat/a4-73-grammar-version-agnostic`): the two instruments
    // the §7.3 decision record had to write by hand and ship as throwaway probes
    // (`dev/agent-workflow/evidence/a4-pr7/7-3-decision/probes/`), landed as committed tests.
    // TWO new scannable files — the identity twin in the package that owns the hash
    // (`packages/domain/test/`) and the enforcement twin in the package that owns the gates
    // (`packages/runtime/test/`). Every other write on this branch is an EDIT to a path this
    // scan already counts (the five relaxed gates + the one widened test mirror), and an edit
    // is not an increment; evidence `.md`/`.txt` under `dev/agent-workflow/evidence/` is
    // outside this scan's `packages/**` scope. Same discipline as every list here: each path
    // is asserted present BY PATH below and the length is tied to the movement of the total,
    // which is derived — never written by hand.
    const SCANNED_PATHS_A4P73GRAMMAR: readonly string[] = [
      'packages/domain/test/a4p7-v3-identity-binds-grammar.test.ts',
      'packages/runtime/test/a4p7-v3-grammar-enforced.test.ts',
    ]
    // A4-PR7 Task 7.6 ceiling-pin (`feat/a4-76-ceiling-pin`): the construction-level
    // assembly pin for the authority-ceiling wiring — ONE new scannable file, the
    // in-process host-entry instrument (`packages/runtime/test/a4p7-ceiling-port-
    // assembly-pin.test.ts`: boot the REAL shipped composition, drive a rise, assert the
    // ceiling decides; its mutation proof is a deleted host injection line). The lane's
    // other writes are edits to already-counted paths (the V16/V17 repair, this pin) and
    // evidence files under `dev/agent-workflow/evidence/` outside the `packages/**`
    // scope — an edit is not an increment. Same discipline: present BY PATH below,
    // length tied to the movement, total never written by hand.
    const SCANNED_PATHS_A4P76PIN: readonly string[] = [
      'packages/runtime/test/a4p7-ceiling-port-assembly-pin.test.ts',
    ]
    expect(scanResult.filesScanned).toBe(
      983 +
        SCANNED_PATHS_A4PR2.length +
        SCANNED_PATHS_A4PR3.length +
        SCANNED_PATHS_A4PR4.length +
        SCANNED_PATHS_A4PR5.length +
        SCANNED_PATHS_A4PR6.length +
        SCANNED_PATHS_A4PR7.length +
        SCANNED_PATHS_A4ESCALATE.length +
        SCANNED_PATHS_A4F1.length +
        SCANNED_PATHS_A4SURFACE.length +
        SCANNED_PATHS_A4ARTIFACTS.length +
        SCANNED_PATHS_A4P7PRE.length +
        SCANNED_PATHS_A4P76GATE.length +
        SCANNED_PATHS_A4P73FLIP.length +
        SCANNED_PATHS_A4P73GRAMMAR.length +
        SCANNED_PATHS_A4P76PIN.length,
    )
    expect(scanResult.files.length).toBe(
      983 +
        SCANNED_PATHS_A4PR2.length +
        SCANNED_PATHS_A4PR3.length +
        SCANNED_PATHS_A4PR4.length +
        SCANNED_PATHS_A4PR5.length +
        SCANNED_PATHS_A4PR6.length +
        SCANNED_PATHS_A4PR7.length +
        SCANNED_PATHS_A4ESCALATE.length +
        SCANNED_PATHS_A4F1.length +
        SCANNED_PATHS_A4SURFACE.length +
        SCANNED_PATHS_A4ARTIFACTS.length +
        SCANNED_PATHS_A4P7PRE.length +
        SCANNED_PATHS_A4P76GATE.length +
        SCANNED_PATHS_A4P73FLIP.length +
        SCANNED_PATHS_A4P73GRAMMAR.length +
        SCANNED_PATHS_A4P76PIN.length,
    )
    // Every path in the two lists below is asserted present BY PATH, not inferred
    // from the total: a total that moves for the wrong reason (one file added, one
    // dropped) is otherwise indistinguishable from one that moved for the right
    // one. NO COUNT IS WRITTEN IN PROSE ANYWHERE IN THIS BLOCK — this comment has
    // been wrong three rounds running ("the three", then "six and five", while the
    // list was thirteen), so the lists are the record and the arithmetic below is
    // derived from them.
    const SCANNED_PATHS_A4PR0: readonly string[] = [
      'packages/runtime/governance/proposal-store.ts',
      'packages/runtime/governance/proposal-codes.ts',
      'packages/runtime/test/a4pr0-proposal-store.test.ts',
      'packages/runtime/test/a4pr0-proposal-corrupt.test.ts',
      'packages/runtime/test/a4pr0-proposal-generation.test.ts',
      'packages/runtime/root-binding/harness/blueprint-source.mjs',
      'packages/runtime/root-binding/harness/bounded-run.mjs',
      'packages/runtime/root-binding/harness/bounded-run.regression.test.mjs',
    ]
    const SCANNED_PATHS_A4PR1: readonly string[] = [
      'packages/domain/authority-envelope/src/authority-envelope.ts',
      'packages/domain/authority-envelope/src/index.ts',
      'packages/runtime/governance/authority-ceiling.ts',
      'packages/domain/test/a4p1-blueprint-v3-governance.test.ts',
      'packages/runtime/test/a4p1-authority-envelope.test.ts',
    ]
    for (const path of [
      ...SCANNED_PATHS_A4PR0,
      ...SCANNED_PATHS_A4PR1,
      ...SCANNED_PATHS_A4PR2,
      ...SCANNED_PATHS_A4PR3,
      ...SCANNED_PATHS_A4PR4,
      ...SCANNED_PATHS_A4PR5,
      ...SCANNED_PATHS_A4PR6,
      ...SCANNED_PATHS_A4PR7,
      ...SCANNED_PATHS_A4ESCALATE,
      ...SCANNED_PATHS_A4F1,
      ...SCANNED_PATHS_A4SURFACE,
      ...SCANNED_PATHS_A4ARTIFACTS,
      ...SCANNED_PATHS_A4P7PRE,
      ...SCANNED_PATHS_A4P76GATE,
      ...SCANNED_PATHS_A4P73FLIP,
      ...SCANNED_PATHS_A4P73GRAMMAR,
      ...SCANNED_PATHS_A4P76PIN,
    ]) {
      expect(scanResult.files.includes(path)).toBe(true)
    }
    // The tie between the two forms of the pin, and the only place a number is
    // allowed to appear: A4-PR1 added exactly as many scannable files as the
    // 978 -> 983 movement claims, and every one of them is named above. A file
    // added without a name, or a name without a file, fails HERE.
    expect(SCANNED_PATHS_A4PR1.length).toBe(983 - 978)
    // The A4-PR2 tie, same form: the movement equals the named files, and every one
    // of them is asserted present by path above.
    expect(SCANNED_PATHS_A4PR2.length).toBe(987 - 983)
    // The A4-PR3 tie, same form: the movement equals the named files, and every
    // one of them is asserted present by path above.
    expect(SCANNED_PATHS_A4PR3.length).toBe(995 - 987)
    // The A4-PR4 tie, same form: the movement equals the named files, and every
    // one of them is asserted present by path above. No number in PROSE — the
    // difference of the two pinned totals is the only arithmetic here.
    expect(SCANNED_PATHS_A4PR4.length).toBe(999 - 995)
    // The A4-PR5 tie, same form: the movement equals the named files, and every
    // one of them is asserted present by path above. No number in PROSE — the
    // difference of the two pinned totals is the only arithmetic here.
    expect(SCANNED_PATHS_A4PR5.length).toBe(1003 - 999)
    // The A4-PR6 tie, same form: the movement equals the named files, and every
    // one of them is asserted present by path above. `1016` is THIS PR's own
    // advancing total — it moves only when THIS list grows (a stage commit
    // adding a file updates the list and this number together; an undeclared
    // file moves the scanner total without the list and fails above). Other
    // PRs' numbers stay untouched. Review round 1 moved it with the three
    // review-round specs named in the list.
    expect(SCANNED_PATHS_A4PR6.length).toBe(1016 - 1003)
    // The A4-PR7 tie, same form. `1021` is PR7's own advancing total: it moves
    // only when the A4-PR7 list above grows, and the by-path loop above is what
    // proves each named path really is in the scan (a total that moved for a
    // dropped file instead of an added one fails there, not here). Ruling 1 moved
    // it with the ONE file it added — every other path that ruling touched was
    // already counted, and an edit is not an increment. Task 7.5 moved it again
    // for the same reason: one new test file under `packages/**`.
    expect(SCANNED_PATHS_A4PR7.length).toBe(1021 - 1016)
    // The a4-escalate-act-truth tie, same form: the movement equals the named
    // files in SCANNED_PATHS_A4ESCALATE, each asserted present by path in the
    // loop above. A file added without a name, or a name without a file, fails
    // there — the total is still never written by hand.
    expect(SCANNED_PATHS_A4ESCALATE.length).toBe(1021 - 1020)
    // Reading these two ties together after the merge with `origin/master`: each
    // endpoint is that lane's OWN advancing total on the branch where it landed,
    // so the two endpoints come from two ladders and neither one is this merged
    // tree's total. Each tie asserts only "the movement equals the files I name",
    // which is the whole contract, and neither number was edited to make the
    // ladders look sequential — renumbering a tie is exactly how a pin starts
    // agreeing with a wrong tree. The merged total is the sum of the lists above;
    // it is derived by the two `toBe` sums and deliberately not written here.
    // The A4-F1 tie, same form: the movement equals the one file this lane names,
    // asserted present by path in the loop above. Its endpoints are this lane's OWN
    // advancing total on the branch it landed on, so — like the two above — neither
    // number is this merged tree's total; the derived sums compute that and this
    // comment does not write it.
    expect(SCANNED_PATHS_A4F1.length).toBe(1023 - 1022)
    // The a4-surface-authority-unavailable tie, same form: the movement
    // (1023 -> 1024) equals the named files in SCANNED_PATHS_A4SURFACE, each
    // asserted present by path in the loop above. The endpoints are this
    // lane's OWN advancing total on the base it landed on (master's own
    // derived total at the rebase was 1023, and the merged tree measures
    // 1024); neither number is written by hand for the merged tree — the
    // derived sums above compute that. The increment's own RED capture
    // (evidence a4-surface/p4t6-PRE-EXTEND-RED.txt: `expected 1022 to be
    // 1021` before the list existed) was taken on the pre-rebase base.
    expect(SCANNED_PATHS_A4SURFACE.length).toBe(1024 - 1023)
    // The a4-check-artifacts-nonempty tie, same form: the movement equals the
    // named files in SCANNED_PATHS_A4ARTIFACTS, each asserted present by path in
    // the loop above. The endpoints are this lane's OWN advancing total on the
    // base it landed on (the merged tree measured 1024 before this spec joined
    // and the increment's RED capture read `expected 1025 to be 1024` with the
    // file present but the list absent); neither number is written for the
    // merged tree by hand — the derived sums above compute that.
    expect(SCANNED_PATHS_A4ARTIFACTS.length).toBe(1025 - 1024)
    // The A4-PR7 §7.5-prerequisites tie, same form: the movement equals the three
    // files this lane names, each asserted present by path in the loop above. Its
    // endpoints are THIS lane's own advancing total on the base it landed on: the
    // merged tree reached 1025 through the a4-surface and a4-check-artifacts lanes
    // (each with its own line above), and this review round adds the third named file
    // on top of the two the prerequisites landed. No earlier lane's endpoint was
    // renumbered to make the ladders look sequential, and this comment writes neither
    // number for the merged tree — the derived sums above compute that, and a landed
    // file without its path here turns the sum RED rather than silently moving it.
    expect(SCANNED_PATHS_A4P7PRE.length).toBe(1028 - 1025)
    // The A4-PR7 Task 7.6 tie, same form: the movement equals the one file this lane
    // names, asserted present by path in the loop above. Its endpoints are THIS lane's OWN
    // advancing total on the tree it merged into, and each was measured, not inferred:
    // origin/master (which carries A4ARTIFACS above and A4P7PRE's three) measures 1028, and
    // 1029 with this lane's gate spec added. Both numbers come from the RED capture in
    // `dev/agent-workflow/evidence/a4-pr7/7-6-merge-gate/p4t6-PRE-EXTEND-RED.txt` — the
    // merged-tree one reads `expected 1028 to be 1029`, taken with this file's entry in the
    // list and the spec itself absent from disk; the two earlier captures in that file are
    // the same lane's RED on its two pre-merge bases, kept rather than rewritten because
    // each tie asserts the pair the lane actually moved. The comma-operator trap this file's
    // comments warn about is a live hazard here: the term above this list's own sum entry
    // ends in `+` and this line's last term ends in `,` — a `,` one term early silently
    // turns the sum into a comma expression inside `.toBe(…)` and reports a total that is
    // really just the last term. The derived sums above compute the merged total; this
    // comment does not write it.
    expect(SCANNED_PATHS_A4P76GATE.length).toBe(1029 - 1028)
    // §7.3 the flip's tie, same form, both endpoints MEASURED on this branch: with
    // the shipped-composition instrument on disk and absent from this list the run
    // reads `expected 1032 to be 1031` (capture
    // `dev/agent-workflow/evidence/a4-pr7/7-3-flip/p4t6-PRE-EXTEND-RED.txt`), and
    // 1031 is the derived total the §7.3-Option-A line below ends on. The narrowing
    // itself moves nothing here: two constants changed in place.
    expect(SCANNED_PATHS_A4P73FLIP.length).toBe(1032 - 1031)
    // The A4-PR7 §7.3-Option-A tie, same form: the movement equals the two twin instruments
    // this lane names, each asserted present by path in the loop above. Both endpoints were
    // MEASURED on this branch, not inferred: the tree with the two twin files on disk but
    // absent from this list read `expected 1031 to be 1029` (capture
    // `dev/agent-workflow/evidence/a4-pr7/7-3-relax/p4t6-PRE-EXTEND-RED.txt`), and 1029 is
    // the derived master total the line above ends on. The five relaxed gates and the one
    // widened test mirror are EDITS to already-counted paths and contribute nothing to the
    // movement — an edit is not an increment, which is exactly why a landed file without its
    // path here turns this sum RED instead of moving it silently.
    expect(SCANNED_PATHS_A4P73GRAMMAR.length).toBe(1031 - 1029)
    // The A4-PR7 Task 7.6 ceiling-pin tie, same form: the movement equals the one
    // instrument this lane names, asserted present by path in the loop above. Its
    // endpoints were RE-MEASURED on the merged tree when §7.3 landed under this lane
    // and this tie moved with them — never hand-copied: with the pin file tracked on
    // disk and this entry stripped, the merged run reads `expected 1033 to be 1032`
    // (capture `dev/agent-workflow/evidence/a4-pr7/7-6-ceiling-pin/p4t6-PRE-EXTEND-RED-MERGED.txt`);
    // 1032 is the derived merged-master total the flip's tie above ends on, and 1033
    // is what the scanner counts with this lane's file present. The pair this lane
    // ORIGINALLY moved on its pre-flip base (1031 -> 1032, capture
    // `p4t6-RED-scan-increment.log`) is kept in the evidence dir, not rewritten. The
    // V16/V17 work on this branch is an EDIT to an already-counted path and
    // contributes nothing; the V16/V17 RETIREMENT removes assertions, not files —
    // edits are not increments in either direction.
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
