# ROUND 72 DELETION AUDIT — challenging the hosted-CI repair's 252 deletions

> **Scope.** `29307bfa0..fc7ae61e0` ("Round 72, hosted-CI repair") on branch
> `vnext/a1-cut`. The round deleted **252 files (~71k lines)** and modified 47 to
> turn the hosted CI green. This audit classifies **every deleted test file**,
> restores what still tests a preserved capability, re-expresses missing negative
> controls where the new centre has an arm to carry them, checks the two
> `integration-order` bound raises, and audits the 101 `retiredSubjects` entries.
>
> **Stance.** The previous round is treated as a suspect, not a baseline. The
> question for each file is not "does it still load" but "was its subject retired,
> and if only its *mechanism* retired, does the law it proved still have an arm
> anywhere in the surviving population".
>
> Author: delegated deletion-audit agent · 2026-11-22 · worktree
> `/home/armourpiercer/projects/dsh-agent-team/.worktrees/vnext-a1-cut`.

## 0. Verdict in one paragraph

The mass deletion is **substantially justified but not clean**. All 108 deleted
test files drive a module in the frozen A1 delete/replace set, so none is a
preserved *subject*; 102 are retired-subject deletions with a surviving or
retired-together arm. However the round **over-deleted at the edges**: it deleted
a suite over a KEEP module (`a3p3-governance-lane-hygiene`), it deleted three
suites that were explicitly the "must be migrated, never deleted" class
(`a2c1`/`a2c2`/`a2c7` — all driven through the retired adapter but asserting kept
algebra), it left **ten deleted test files with no per-file disposition at all**,
and it put **three live test files** into `retiredSubjects`. Two preserved
capability laws lost their only arm in the tree (`pwsh` shell-class identity; the
setup-time permission-coverage gate). One negative control was weakened from
real-data to synthetic (the `p4t6` booking ledger). The two boundary raises are
**measurement-justified** and I left them in place.

## 1. Method and sources

* Deletion set: `git diff --name-status 29307bfa0..fc7ae61e0 -- 'tests/**' 'packages/**'`
  → 250 deleted paths under those roots (108 test/spec/helper files, 142
  `packages/testkit/test/p4t6-bookings/*.json` fixtures; the remaining 2 of the
  round's 252 are `scripts/eslint-node-globals/030-{inspect,web}-family*.json`,
  ESLint environment maps of the retired inspect/web families — also
  retired-subject, and not test files).
* Frozen inventory (the only authority):
  * `docs/plans/memo/ute-p0-20261121/01-ASSET-INVENTORY.md` — per-module
    keep/delete (`DELETE (wave 1)` / `REPLACE`);
  * `docs/plans/memo/ute-p0-20261121/03-RETIRE-KEEP.md` — the decision over that
    list, including §2c ("tests of a kept capability that import a replaced entry
    … must be **re-pointed at the new entry in A1, never deleted**");
  * `docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md` — C1–C18, with
    C14b as the explicit "the drop of implementations is never a drop of safety".
  * `dev/agent-workflow/ledgers/ute-p0-assets.snapshot.json` — 37 modules,
    `delete=146 replace=2 keep=32`.
* Surviving population checked for an equivalent arm:
  `packages/runtime/test/vnext-admission.test.mjs` (ADM-1…ADM-96),
  `tests/checks/eb3-ute-migrated-suites.txt` (the 15 bound migrated suites),
  `packages/runtime/test/a5sf-path-rules.test.ts`,
  `packages/runtime/test/a2-canonical-operation.test.ts`,
  `packages/domain/test/a1-permission-policy.test.ts`,
  `packages/domain/test/exec-contract-a1-leader-allow.test.ts`,
  `packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts`.
* Every deleted test was restored into a scratch tree and run under the real
  vitest (the worktree's `.bin/vitest` is a shell shim — the runnable binary is
  the main worktree's `vitest.mjs`). The failure mode is the classification
  evidence: `installParameterPermissionListener is not a function` means the suite
  is coupled to the retired adapter, not that its law retired.

## 2. Classification counts

| class | count | meaning |
| --- | ---: | --- |
| RETIRED-SUBJECT (justified) | **102** | subject is a delete/replace module of the frozen set; no preserved capability claimed |
| PRESERVED — restored | **1** | subject is a KEEP module; restored and made green |
| AMBIGUOUS — needs a ruling | **5** | subject survives but its only end-to-end arm was the retired adapter |
| (fixtures, not tests) | 142 | `p4t6-bookings/*.json` re-baselined into one `round72relive.json` — see §7 |

Note on the 102: "justified as a *subject*" is not "the arm was worth deleting".
The negative-control losses inside that 102 are enumerated in §5.



### 2.1 The per-file table (all 108 deleted test files)

Legend: **RETIRED** = subject is a delete/replace module of the frozen set;
**AMBIGUOUS** = subject survives but its only end-to-end arm was a retired
component; **PRESERVED** = subject is a KEEP module.

| deleted file | subject it exercised | inventory citation | class |
| --- | --- | --- | --- |
| `packages/runtime/test/a2c1-pwsh-permission.test.ts` | pwsh shell-class permission: canonicalization/fingerprint (KEEP algebra) + the retired adapter | 01 §464 pre-execute-adapter DELETE; 03 §3 central-permission-algebra KEEP; 06 C14 | **AMBIGUOUS** |
| `packages/runtime/test/a2c2-permission-coverage.test.ts` | permission-coverage gate (operation-permission/permission-coverage.ts, KEEP) | 03 §3 central-permission-algebra KEEP; no frozen module line | **AMBIGUOUS** |
| `packages/runtime/test/a2c4-external-lastmile.test.ts` | external hard last-mile recheck through the retired adapter | 01 §464 pre-execute-adapter DELETE; ADM-52/88 carry recheck | RETIRED |
| `packages/runtime/test/a2c7-subtree-matcher.test.ts` | subtree matching over FileSystem.contains (KEEP algebra) + the retired adapter | 03 §3 central-permission-algebra KEEP; prefix trap re-expressed in a5sf-path-rules.test.ts:111 | **AMBIGUOUS** |
| `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` | governance lane (packages/runtime/governance) — a KEEP module | 03 §3 kept-whole; absent from the 37-module frozen set | **PRESERVED** (restored) |
| `packages/runtime/test/a3p4-pr4-decision-routing-regression.test.ts` | pre-execute decision routing over the replaced entry | 01 §464 pre-execute-adapter DELETE; migrated a3p4-pr4-production-entry-regression.test.ts | RETIRED |
| `packages/runtime/test/a3p4-pr7-entry-exec-contract-regression.test.ts` | production entry + exec-contract regressions over the replaced root | 03 §2 assembly-root replace; migrated suites | RETIRED |
| `packages/runtime/test/a3p4-production-permission-plane.test.ts` | the shipped production permission plane over the replaced root | 03 §2 assembly-root replace; migrated suites | RETIRED |
| `packages/runtime/test/a4p4-capability-vs-permission.test.ts` | capability-vs-permission lanes through the retired adapter | 01 §464 pre-execute-adapter DELETE; ADM-18/85-88 carry capability refusals | RETIRED |
| `packages/runtime/test/a4p4-operation-approval-authority.test.ts` | minimum-authority routing (leader/user/hard ceiling) | 03 §3 central-control KEEP; 06 C5 preserve — ladder arm not re-expressed | **AMBIGUOUS** |
| `packages/runtime/test/a4p4-operation-single-shot.test.ts` | one-approval-one-execution through the retired adapter | 01 §464 pre-execute-adapter DELETE; ADM-10..13/19/20/52 carry one-shot | RETIRED |
| `packages/runtime/test/a5-cancel-glob.test.ts` | cooperative cancel in the retired glob row | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/a5-cancel-search.test.ts` | cooperative cancel in the retired search row | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/a5-globoff-key.test.ts` | the closed planeCfg key `globEnabled` of the retired glob row | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/a5-m1-auth-bridge.test.ts` | the PA<->Control bridge (pa-control-bridge.ts) over the real durable Control plane | 01 §453 pa-control-bridge DELETE; 03 §2b (three contracts) | RETIRED |
| `packages/runtime/test/a5-m1-bash-c1.test.ts` | M1 BASH vertical slice over team-tool-plane + family-process | 01 §377 team-tool-plane, §120 family-process DELETE | RETIRED |
| `packages/runtime/test/a5-m1-correlation.test.ts` | PA call correlation over the retired plane mounts | 01 §399 pa-mount-registry DELETE | RETIRED |
| `packages/runtime/test/a5-m1-pa-mount-registry.test.ts` | the mount index + PaCallFacts adapter (pa-mount-registry.mjs) | 01 §399 pa-mount-registry DELETE | RETIRED |
| `packages/runtime/test/a5-m1-read-c1c2.test.ts` | M1 READ vertical slice over team-tool-plane + family-fs | 01 §377 team-tool-plane, §54 family-fs DELETE | RETIRED |
| `packages/runtime/test/a5-m1-seam-enforcement.test.ts` | the centre controlLeg seam of the retired plane | 01 §377 team-tool-plane DELETE | RETIRED |
| `packages/runtime/test/a5-m1-unsupported-c1.test.ts` | M1 unsupported-fail-closed over team-tool-plane | 01 §377 team-tool-plane DELETE | RETIRED |
| `packages/runtime/test/a5-pindir-subagent-flip.test.ts` | reserved-native claims on the retired plane | 01 §377 team-tool-plane, §410 native-tool-admission DELETE | RETIRED |
| `packages/runtime/test/a5-read-slice-window.test.ts` | the governed READ slice window of family-fs | 01 §54 family-fs DELETE; 06 C13 replace | RETIRED |
| `packages/runtime/test/a5-scratch-default.test.ts` | production default form of the retired glob row | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/a5a-pre-execute.test.ts` | the A5 tools/pre-execute listener (pre-execute-adapter.ts) | 01 §464 pre-execute-adapter DELETE | RETIRED |
| `packages/runtime/test/a5b2-exit-code-fidelity.test.ts` | confined STREAM exit-code fidelity (family-process) | 01 §120 family-process DELETE; 06 C14b (host owns execution) | RETIRED |
| `packages/runtime/test/a5b3-cancel-leg.test.ts` | the shell row cancel leg (a5p5-tools + family-process) | 01 §35 a5p5-tools, §120 family-process DELETE | RETIRED |
| `packages/runtime/test/a5int-r3-mount-integration.test.ts` | mount flip integration over team-tool-plane | 01 §377 team-tool-plane DELETE | RETIRED |
| `packages/runtime/test/a5intr3-kit-runner.test.ts` | runner for the int-r3 plane-mount kit (team-tool-plane + search rows) | 01 §377 team-tool-plane DELETE; kit survives as evidence-record | RETIRED |
| `packages/runtime/test/a5mcp-native-trust-filter.test.ts` | MCP native trust filter on the retired plane | 01 §377 team-tool-plane, §410 native-tool-admission DELETE | RETIRED |
| `packages/runtime/test/a5natexe-native-takeover.test.ts` | native takeover on the retired plane | 01 §377 team-tool-plane, §410 native-tool-admission DELETE | RETIRED |
| `packages/runtime/test/a5p1-closed-world-guard.test.ts` | closed-world guard / scoped dispatcher over tool-dispatch (governance-center group) | 01 §432 governance-closed-world DELETE (tool-dispatch is in the group) | RETIRED |
| `packages/runtime/test/a5p1-guard-install.test.ts` | closed-world guard / scoped dispatcher over tool-dispatch (governance-center group) | 01 §432 governance-closed-world DELETE (tool-dispatch is in the group) | RETIRED |
| `packages/runtime/test/a5p1-scoped-dispatcher.test.ts` | closed-world guard / scoped dispatcher over tool-dispatch (governance-center group) | 01 §432 governance-closed-world DELETE (tool-dispatch is in the group) | RETIRED |
| `packages/runtime/test/a5p1r-change-abort.test.ts` | closed-world guard / scoped dispatcher over tool-dispatch (governance-center group) | 01 §432 governance-closed-world DELETE (tool-dispatch is in the group) | RETIRED |
| `packages/runtime/test/a5p1r-gg-probes.test.ts` | closed-world guard / scoped dispatcher over tool-dispatch (governance-center group) | 01 §432 governance-closed-world DELETE (tool-dispatch is in the group) | RETIRED |
| `packages/runtime/test/a5p1r-scoped-registry-double.ts` | closed-world guard / scoped dispatcher over tool-dispatch (governance-center group) | 01 §432 governance-closed-world DELETE (tool-dispatch is in the group) | RETIRED |
| `packages/runtime/test/a5p1r-shadow-attribution.test.ts` | closed-world guard / scoped dispatcher over tool-dispatch (governance-center group) | 01 §432 governance-closed-world DELETE (tool-dispatch is in the group) | RETIRED |
| `packages/runtime/test/a5p1r-validate-resolve.test.ts` | closed-world guard / scoped dispatcher over tool-dispatch (governance-center group) | 01 §432 governance-closed-world DELETE (tool-dispatch is in the group) | RETIRED |
| `packages/runtime/test/a5p2-composition.test.ts` | PR1 guard x PR2 admission composition over tool-dispatch | 01 §432 governance-closed-world DELETE; a5p2-admission-kernel.test.ts survives | RETIRED |
| `packages/runtime/test/a5p7-jobs-assembly-actuator.test.ts` | the jobs actuator row (agent-bindings/jobs assembly) | 03 §2 replace assembly-agent-bindings | RETIRED |
| `packages/runtime/test/a5pbr2-binding-feed.test.ts` | the pb §6 binding feed on the retired guard | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/a5r-cause-relay.test.ts` | cause relay through the retired plane | 01 §377 team-tool-plane DELETE | RETIRED |
| `packages/runtime/test/a5w-bindseam-subtree-seam-c1.test.ts` | the plane bind seam + subtree over the retired assembly | 01 §377 team-tool-plane, §399 pa-mount-registry DELETE | RETIRED |
| `packages/runtime/test/a5w-vobs-admission-observe-c1.test.ts` | kernel audit rows over the retired plane | 01 §377 team-tool-plane DELETE | RETIRED |
| `packages/runtime/test/a5w-vseam-pa-verifier-seam-c1.test.ts` | Control-side PA verifier seam over the retired bridge | 01 §453 pa-control-bridge, §399 pa-mount-registry DELETE | RETIRED |
| `packages/runtime/test/a6-stop-fence.test.ts` | Stop fence through the retired pre-execute adapter | 01 §464 pre-execute-adapter DELETE; 06 C8 preserve -> ADM-56..61 | RETIRED |
| `packages/runtime/test/a6a-production-wiring.test.ts` | A6 production wiring of the A5 pre-execute listener | 03 §2 assembly-root/agent-bindings replace; ADM-26/27/44 | RETIRED |
| `packages/runtime/test/alpha2-explicit-agent-setup.test.ts` | host AgentSetup contract + setup-time coverage gate | 03 §2 assembly-root replace; coverage gate unwired (see a2c2) | **AMBIGUOUS** |
| `packages/runtime/test/alpha5-g1-deny-lane.test.ts` | the template deny lane through the retired plane control legs | 01 §377 team-tool-plane DELETE | RETIRED |
| `packages/runtime/test/alpha5-g6b-rc-first.test.ts` | the rc-first adjudication of the search glob row | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/alpha5-glob-backend-adversarial.test.ts` | anchored-glob row adversarial (symlink escape / race) | 01 §81 family-search DELETE; C14b arm survives in a5sf-path-rules.test.ts | RETIRED |
| `packages/runtime/test/alpha5-glob-backend.test.ts` | anchored-glob row (glob-backend.mjs) | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/alpha5-glob-harness.ts` | shared harness of the glob-row suites | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/alpha5-glue7-plane-backends.test.ts` | GLUE-7 plane backends over the retired plane | 01 §377 team-tool-plane DELETE | RETIRED |
| `packages/runtime/test/alpha5-search-backend.test.ts` | anchored-rg search row (search-backend.mjs) | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/alpha5-search-harness.ts` | shared harness of the search-row suites | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/artifact-read-permission-lane.test.ts` | artifact read permission lane through the retired adapter | 01 §464 pre-execute-adapter DELETE | RETIRED |
| `packages/runtime/test/exec-contract-dual-gate.test.ts` | exec-contract dual gate through the retired adapter | 01 §464 pre-execute-adapter DELETE; domain exec-contract-a1-leader-allow.test.ts survives | RETIRED |
| `packages/runtime/test/h1a-pre-execute-endcap.test.ts` | the monotonic end-cap guard of the retired adapter | 01 §464 pre-execute-adapter DELETE; ADM-44 carries the unmediated-refusal form | RETIRED |
| `packages/runtime/test/h4-rule-identity.test.ts` | rule identity through the retired adapter | 01 §464 pre-execute-adapter DELETE; a3-permission-resolver.test.ts survives | RETIRED |
| `packages/runtime/test/h5-bash-effects.test.ts` | bash effect fingerprint through the retired adapter | 01 §464 pre-execute-adapter DELETE; a2-canonical-operation bash arm survives | RETIRED |
| `packages/runtime/test/issue2-capability-permission-precedence.test.ts` | capability/permission precedence through the retired adapter | 01 §464 pre-execute-adapter DELETE; issue2-real-preset-restriction.test.ts survives | RETIRED |
| `packages/runtime/test/pd41-allow-semantics.test.ts` | PD-41 human allow semantics through the retired adapter | 01 §464 pre-execute-adapter DELETE; ADM-46..51 carry the real Control flow | RETIRED |
| `packages/runtime/test/pd42-execution-outcome.test.ts` | PD-42 execution outcome through the retired adapter | 01 §464 pre-execute-adapter DELETE; ADM-21..23 carry settlement outcomes | RETIRED |
| `packages/runtime/test/rc2a1-fs-containment.test.ts` | the replaced host.ts fs facade + containment chain | 03 §2 assembly-root replace; C14b arm survives in a5sf-path-rules.test.ts | RETIRED |
| `packages/runtime/test/u6-arc-a-fitness.test.ts` | Governance Center architecture fitness gate | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-arc-a-probe-family.test.ts` | U6 ARC-A probe family (governance-closed-world) + tests/u6-arc-a-probe-family/ | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-fixk-kernel-safety.test.ts` | U6 FIX-K kernel safety (governance-center kernel) | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr1-contribution-schema.test.ts` | governance-center contribution schema | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr1-kernel.test.ts` | governance-center kernel | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr1-registry.test.ts` | governance-center registry | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr2-kernel-flow.test.ts` | governance-center kernel flow / guard plants / read golden vectors | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr2-kernel-guard-plants.test.ts` | governance-center kernel flow / guard plants / read golden vectors | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr2-read-golden-vectors.test.ts` | governance-center kernel flow / guard plants / read golden vectors | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr2-rrem2-read-lane.test.ts` | governance-center kernel flow / guard plants / read golden vectors | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr3-kernel-flow.test.ts` | governance-center kernel flow / shell golden vectors | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr3-shell-golden-vectors.test.ts` | governance-center kernel flow / shell golden vectors | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr4-jobs-bridge.test.ts` | jobs bridge on the governance-center kernel | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr5-kernel-flow.test.ts` | search family on the governance-center kernel | 01 §432 governance-closed-world DELETE; §81 family-search | RETIRED |
| `packages/runtime/test/u6-pr5-search-golden-vectors.test.ts` | search golden vectors under the retired kernel | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr5-search-move-law.test.ts` | search-family move law vs the retired CANDIDATE-A factory | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/u6-pr6-arc-d-adversarial.test.ts` | ARC-D adversarial / matrix over production seams of the retired centre | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u6-pr6-arc-d-matrix.test.ts` | ARC-D adversarial / matrix over production seams of the retired centre | 01 §432 governance-closed-world DELETE | RETIRED |
| `packages/runtime/test/u7-9a-fs-mutation-c1.test.ts` | the governed FS-mutation family chain | 01 §54 family-fs DELETE; C14b path bounds survive in a5sf-path-rules.test.ts | RETIRED |
| `packages/runtime/test/u7-9a-mutation-golden-vectors.test.ts` | FS-mutation golden vectors | 01 §54 family-fs DELETE | RETIRED |
| `packages/runtime/test/u7-ac1-subagents-port-c1.test.ts` | subagent port over the retired family rows | 01 §180 family-agent-control DELETE | RETIRED |
| `packages/runtime/test/u7-agentstate-fs-store-audit.test.ts` | agent-state fs store (family-agent-state) | 01 §204 family-agent-state DELETE | RETIRED |
| `packages/runtime/test/u7-agentstate-fs-store-c1.test.ts` | agent-state fs store (family-agent-state) | 01 §204 family-agent-state DELETE | RETIRED |
| `packages/runtime/test/u7-f-agent-control-c1.test.ts` | family-agent-control rows | 01 §180 family-agent-control DELETE | RETIRED |
| `packages/runtime/test/u7-f-agent-control-native-output-schema-c1.test.ts` | family-agent-control native output schemas | 01 §180 family-agent-control DELETE | RETIRED |
| `packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts` | family-agent-state rows | 01 §204 family-agent-state DELETE | RETIRED |
| `packages/runtime/test/u7-f-ui-c1.test.ts` | family-ui rows (ask_user_question/present) | 01 §141 family-ui DELETE | RETIRED |
| `packages/runtime/test/u7-fixfwd-hardlink-alias.test.ts` | hardlink alias law over the retired family read path | 01 §54 family-fs DELETE; C14b arm survives in a5sf-path-rules.test.ts | RETIRED |
| `packages/runtime/test/u7-g6b-late-stream.test.ts` | the retired CANDIDATE-A glob factory late-stream reproducer | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/u7-grep-late-stream.test.ts` | late-stream in the retired grep row | 01 §81 family-search DELETE | RETIRED |
| `packages/runtime/test/u7-state-home-c1.test.ts` | state home projection over the retired families | 01 §204 family-agent-state DELETE; 06 C11 | RETIRED |
| `packages/runtime/test/u7-state-home-prod-c1.test.ts` | state home projection over the retired families | 01 §204 family-agent-state DELETE; 06 C11 | RETIRED |
| `packages/runtime/test/u7-w0b-approval-entry-law.test.ts` | one approval-entry binder over the retired plane | 01 §377 team-tool-plane DELETE | RETIRED |
| `packages/runtime/test/u7-w0b-family-seam.test.ts` | FamilyAssembly seam + plane fitness law | 01 §388 seam-family-assembly DELETE | RETIRED |
| `packages/runtime/test/u74a-jobs-producer.test.ts` | the jobs producer row (family-agent-control) | 01 §180 family-agent-control DELETE | RETIRED |
| `packages/runtime/test/u7f-inspect-family-c1.test.ts` | family-inspect (team_skill re-home subject) | 01 §160 family-inspect DELETE; 06 C15 | RETIRED |
| `packages/runtime/test/u7f-pwsh-row-c1.test.ts` | the governed PWSH shell-class row | 01 §120 family-process DELETE | RETIRED |
| `packages/runtime/test/u7f-web-c1.test.ts` | family-web chain | 01 §100 family-web DELETE | RETIRED |
| `packages/tools/test/u7f-ask-port-agent-binding.test.ts` | the governed ask row (family-ui) | 01 §141 family-ui DELETE | RETIRED |
| `tests/poc-web-native-reuse/poc-w1-native-shape.test.ts` | web native shape PoC over the replaced assembly | 01 §100 family-web / §344 shadow-web DELETE; 06 C13 | RETIRED |
| `tests/poc-web-native-reuse/poc-w2-ctx-web-adapter.test.ts` | ctx.web adapter PoC over the replaced assembly | 01 §100 family-web DELETE; 06 C13 | RETIRED |
| `tests/poc-web-native-reuse/poc-w3-fetch-parity.test.ts` | web_fetch parity PoC over the replaced assembly | 01 §100 family-web DELETE; 06 C13 | RETIRED |

> The 102 RETIRED rows are not equally strong. The ones that carried a
> **negative control** are re-examined one by one in §5; the rest are
> positive-control suites of a body that no longer exists.

## 3. What I restored, and why

### 3.1 `a3p3-governance-lane-hygiene.test.ts` — RESTORED, GREEN (21 tests)

Its imports are `../governance/*`, `../admission/types.js`,
`../coordination/index.js`, `../../domain/authority-envelope/*` and
`../../storage/schema/permission-overlay.js` — **all KEEP modules**. The
governance lane is not in the 37-module frozen set at all, and
`03-RETIRE-KEEP.md` §3 keeps it whole. The suite is the only arm that pins
(a) the mutation kernel's single write path, (b) the persistence-only port
(`append`/`latest`/`history`, anything else throws), (c) the zero-consumer walk,
and (d) the authority-grammar leaf/import-graph law.

It failed on **three layout pins only**, each naming a file the cut replaced or
deleted — not one assertion about the governance lane itself:

1. it read `src/plugin/root.ts` for a barrel host → re-anchored to
   `src/plugin/vnext/root.ts` (same law, the new assembly root);
2. its `authorityRank` consumer allow-list named `src/plugin/root.ts` but not
   `vnext/root.ts` → added the new root (the new assembly is a legitimate
   ladder consumer, exactly as the old root was);
3. its ceiling-importer allow-list named the deleted
   `operation-permission/pa-control-bridge.ts` → **removed the entry** rather
   than leaving a stale allow: an allow-list entry naming a deleted path would
   silently admit any future file created at that path. That is a tightening,
   not a weakening.

The law text is unchanged; no assertion was dropped, no skip added.

### 3.2 Migrations (the "must be migrated, never deleted" class)

Two preserved laws had **no arm left anywhere in the tree** after Round 72. Both
are re-expressed here at the original strength, on the KEEP algebra.

* **`pwsh` shell-class permission** (from `a2c1-pwsh-permission.test.ts`).
  Migrated into `packages/runtime/test/a2-canonical-operation.test.ts` (5 added
  arms): `classifyPermissionTool('pwsh') === tool-level`; resource identity
  `{kind:'tool', key:'pwsh'}`; **bash and pwsh with the same command have
  distinct fingerprints**; the raw command + every effect dimension change the
  fingerprint while `description` does not; the resolver is consulted exactly
  once, for the workdir key; malformed effect fields fail closed with the
  byte-mirrored `pwsh-*` reasons. Also migrated the schema half into
  `packages/domain/test/a1-permission-policy.test.ts` (3 added arms): pwsh +
  `exact` rejected in ask/deny, pwsh + `any` rejected in the member allow lane,
  pwsh + `any` parses in ask. This is `03-RETIRE-KEEP.md` §2c applied: the
  capability is kept, only the adapter that drove it retired.

  **What is NOT migrated:** the end-to-end legs (ask→allow-once, end-cap,
  hostile prepend-allow, cold-resume reinstall, real pipeline). They drove
  `installParameterPermissionListener`, which the frozen set deletes whole
  (`01` §464). Re-creating that adapter to keep them running is forbidden.
  This is what makes the file's disposition **AMBIGUOUS**, not closed.

* **The 142 `p4t6-bookings` fixtures** are not test files; see §7.

## 4. Files restored-but-red? None

I restored no file that cannot pass. The remaining AMBIGUOUS five are **not**
left in the tree as red files, because their only route to green is
re-creating a retired component (`pre-execute-adapter`), which the owner's rules
and the frozen set forbid. Restoring them would put an un-runnable suite back in
the tree and would require a second exemption registration — a widened skip
under a new name. They are recorded here as findings and as the rulings in §9.
The two migrations above are the part of them that can be honestly preserved.

## 5. Negative controls: which ones lost their only proof

The dangerous deletions are not positive-control suites; they are the ones that
proved a refusal. Ranked by whether an equivalent arm exists in the surviving
population:

| # | deleted file / law | invariant it proved | equivalent arm now? | verdict |
| --- | --- | --- | --- | --- |
| 1 | `a2c1` “shell-class rule contract” + authority separation | `pwsh`/`bash` are one shell class with **distinct** authority keys; `exact` illegal in every lane; `any` illegal in member allow | **NO** before this audit. `a2-canonical-operation` had no pwsh arm; the new centre maps both to `process.exec` (`admission.ts:41`) and has no fingerprint identity. | **MIGRATED** (§3.2). The *adapter-level* one-shot/end-cap arms are still unproven. |
| 2 | `a2c2` coverage gate | an UNKNOWN/known-sensitive unmanaged tool on a strict agent's surface must FAIL setup loudly; no auto-hide | **NO.** `permission-coverage.ts` survives and is still exported from `operation-permission/index.ts`, but nothing in the tree evaluates it. | **AMBIGUOUS** — ruling needed (dead code vs re-wire). |
| 3 | `h1a` end-cap / `a2c1` G12 hostile prepend-allow | a supported permission tool whose exec object the install never authorized is denied at the guard stage, body never runs, zero control rows | **PARTIAL.** ADM-44 (“a row that asked for the centre cannot run unmediated”) and ADM-4 (no fallthrough) cover the same *class*, but no arm constructs the hostile prepend-allow adversary. | RETIRED-SUBJECT, **control weakened in kind** |
| 4 | `a4p4-operation-approval-authority` | approval routes to the **minimum** authority (leader vs human) and a fresh rung above the frozen one is refused | **PARTIAL.** ADM-46/49/53 cover reviewer identity, order and fault; `a4p1-authority-envelope`/`a4p2-authority-ceiling` cover ceilings. The ladder-rise arm itself is not re-expressed. | **AMBIGUOUS** |
| 5 | `a2c7` subtree matcher | a prefix-sharing sibling (`/src` vs `/src2`) is never covered; the authority is `FileSystem.contains`, never `startsWith` | **YES, on the product lane.** `a5sf-path-rules.test.ts:111` pins the same trap over `member-io-policy`; `a3p4-permission-lifecycle-e2e` covers subtree through the new entry. The **resolver**-level arm (`resolveOperationPermission` with `subtree`) is not re-expressed. | **AMBIGUOUS** (narrow) |
| 6 | `alpha5-glob-backend-adversarial` | a symlinked middle/last component and a swapped root cannot escape the governed root; the real-rg race loop | **PARTIAL.** `a5sf-path-rules.test.ts` pins symlink escape, symlinked-parent escape and hardlink aliasing over the production lane; the real-rg race retired with the row (host owns the walker). | RETIRED-SUBJECT, safety arm survives |
| 7 | `rc2a1-fs-containment` | the host `fs` facade must preserve its receiver; containment uses `contains`, not string prefixes | **PARTIAL.** The containment law survives (`a5sf-path-rules`); the receiver-preservation bug surface retired with `host.ts`. | RETIRED-SUBJECT |
| 8 | `u7-9a-fs-mutation-c1`, `u7-fixfwd-hardlink-alias` | write stays inside the write lane; symlink/hardlink aliases do not widen it | **YES.** `a5sf-path-rules` (write-requires-read, symlink escape, hardlink alias). | RETIRED-SUBJECT, covered |
| 9 | `a6-stop-fence` | Stop is sticky, durable, non-replaying; SIGKILL arms | **YES.** ADM-56…61 (Stop authority, replay refusal, cancellation). | RETIRED-SUBJECT, covered |
| 10 | `p4t6-session-event-scan` booking ledger | the live tree is booked lane-by-lane; a retired path that comes back is caught | **WEAKENED.** Round 72 deleted all 142 booking ledgers, replaced them with one `round72relive.json` and changed the control to plant its **own** synthetic retirement. Still falsifiable, no longer driven by real data. | see §7 |

**Net:** one negative control was fully lost and has been migrated (pwsh); two
are rigor-degraded (end-cap adversary; approval ladder); one is lifecycle-
degraded (coverage gate has zero arms); one is evidence-degraded (p4t6 real →
synthetic).

## 6. The two boundary raises

`scripts/integration-order.mjs` changed `maxCandidates 6000 → 8000` and
`maxRecords 400 → 600` in the same round, with this rationale: on
`vnext/a1-cut`, `git ls-files` over the evidence root reports 6832 tracked
`.json`, of which 461 mention `u5-run-record/1` and 440 parse as that schema.

**Re-measured on this worktree (HEAD fc7ae61e0 + this audit):**
`git ls-files 'dev/agent-workflow/evidence/**/*.json' | wc -l` = **6834**;
files containing `u5-run-record/1` = **461**.

Verdict: **JUSTIFIED, left in place.** Both old bounds are genuinely exceeded by
the tree (6834 > 6000 candidates; 440 > 400 records), so `devex-diag`'s E5 (“the
bound is not hit on this tree”) could not go green by any correctness-preserving
route — the alternative was deleting committed evidence, which the header rule
forbids. The raise follows the file's own precedent (“a capacity budget, not a
safety assertion; raised with a measurement”).
Caveat recorded: the *need* is measured; the *increments* are headroom, not
measurement (8000 is 1.17× the current 6834; 600 is 1.36× the 440 records). If a
future reviewer wants a tighter budget, 7200/500 would also fit today — but
"headroom chosen after a measurement" is exactly what the prior raises did.

## 7. The 142 booking fixtures — an undispositioned re-baseline

Round 72 deleted every `packages/testkit/test/p4t6-bookings/*.json` (142 files)
and added one `round72relive.json`, then modified
`p4t6-session-event-scan.test.ts`. This was **not** covered by the round's claim
("every deleted test file tested a retired subject") because these are not test
files, and it is **not in the frozen inventory** (the inventory enumerates
module sources, not ledgers).

What it does: the p4t6 scan books every scannable path lane-by-lane and fails if
a **retired** path reappears. The old bookings recorded 553 retired paths. The
relive snapshot re-books the current tree, so the historical retired-path set is
gone, and the control now **plants its own retirement** to stay falsifiable. The
modified test says so (“the re-baselined live lane books no retirements”).

Assessment: the re-baseline is defensible **as a maintenance act** (the old
ledgers named files the cut deleted; re-booking the current tree is how the
ledger stays true), but it is an **unrecorded disposition of 142 deleted files**
and it silently converts a real-data negative control into a synthetic one.
Finding, not a restoration: a ledger snapshot is not a capability and
reconstructing 142 per-lane books would be re-creating history. Recommended
ruling: keep the relive snapshot, but commit a machine-readable list of the 553
retired paths it dropped so the "retired path must not return" guard can still
be driven from real data.

## 8. `ute-cut-closure.allow.json#retiredSubjects` — the 101-entry audit

The round added a new top-level key with **101 entries**. Findings:

1. **Three entries were LIVE test files, not retired subjects.** 
   `u6-pr2-review-r1.test.ts`, `u6-pr3-bl01-ask-door.test.ts` and
   `a5-pindir-reserved-native.test.ts` are `M` (modified) in this very range —
   they still exist and are still executed. Their entries claimed
   “migrated-positive-control” / “migrated-preserved-control”, i.e. they used
   the retirement list to record a *migration*. That is exactly the quiet
   absorption the owner's rule forbids: a reader of `retiredSubjects` would
   believe those suites were deleted. **Removed** (the migrated population is
   already declared in `tests/checks/eb3-ute-migrated-suites.txt`), and the
   key's `note` now states that a file which still exists must never be listed.
2. **Ten deleted test files had no entry at all** — a per-file disposition gap:
   `a6a-production-wiring`, `alpha2-explicit-agent-setup`, `alpha5-g6b-rc-first`,
   `alpha5-glob-backend-adversarial`, `rc2a1-fs-containment`,
   `u6-arc-a-probe-family`, `u6-pr5-search-move-law`,
   `u7-f-agent-control-native-output-schema-c1`, `u7-g6b-late-stream`,
   `a5intr3-kit-runner`. **Added** each with its subject and citation.
3. The other 98 are genuinely retired subjects (95 `retired-module`, 1
   `retired-execution-route`, 1 `governance-center-fitness-gate`, plus the two
   re-labelled migrated files removed above). No entry hides a live suite after
   the fix.
4. The key is **record-only** — `ute-cut-closure.mjs --check` reads `entries`,
   not `retiredSubjects`. So the 101 entries can never turn a gate red; the list
   is only as honest as its author. That is a structural weakness worth a
   ruling: either the check should cross-reference it (a live path in
   `retiredSubjects` = red), or the list should not be in a gate ledger.

After the fix: **108 entries**, each one a file that is actually gone.

## 9. What still needs a ruling

1. **`a2c1` end-to-end pwsh enforcement.** Is the shell-class permission still
   product law now that the centre maps `pwsh` and `bash` to one `process.exec`
   axis? If yes, the retired adapter's ask/one-shot/end-cap arms need a new
   centre-level home; if no, C14 (“pwsh parity dropped”) should say so explicitly
   and the migrated pure arms become documentation of a dead rule.
2. **`a2c2` permission-coverage gate.** `permission-coverage.ts` is a KEEP
   module, still exported, but wired nowhere and now tested nowhere. Either wire
   it to the new centre's setup path and migrate its suite, or delete it with its
   suite as a second, recorded retirement (it is a kept module, so that needs the
   owner).
3. **`a4p4-operation-approval-authority` ladder.** Does the min-authority
   routing law survive the centre's approval model? ADM-46/49/53 cover reviewer
   identity and faults, not the ladder rise.
4. **`a2c7` resolver-level subtree.** The product lane law survives
   (`a5sf-path-rules`); the resolver arm does not. Rule whether that arm is still
   required given the centre judges lanes, not resolver rules.
5. **p4t6 ledger.** Commit the dropped 553 retired paths (see §7).
6. **`retiredSubjects` should be checked** (see §8.4).

## 10. Gates

Run after the restorations/migrations on this worktree. Pasted verbatim below
(a `head` of each where long).

```
```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 182
ℹ pass 180
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2          # the two pre-existing host-ABI skips of the os-confinement arms
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=785 instruments=3 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32
  DISCOVERED_AND_COLLECTED 733
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              38
  by runner: node=146 none=7 vitest=632
DSH-TEST-CATALOG ... refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
AUTHORITY_SOURCE_BINDING {"kind":"authority-pointer","snapshot_version":"as20261109r1","pointer_digest_verified":true,...}
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))      # byte-identical; no dist change staged

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration \
    --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

Also run directly (not part of the ten-leg invocation, but the restored/migrated
suites themselves):

```
$ vitest run packages/runtime/test/a3p3-governance-lane-hygiene.test.ts
  Tests  21 passed (21)                      # restored file
$ vitest run packages/runtime/test/a2-canonical-operation.test.ts
  Tests  36 passed (36)                      # 5 pwsh arms migrated in
$ vitest run packages/domain/test/a1-permission-policy.test.ts
  Tests  52 passed (52)                      # 3 pwsh schema arms migrated in
```

The catalog grew by exactly one file (the restored `a3p3` suite) and the
`ute-vnext-a1` leg is unchanged.

```

## 11. Final count

| outcome | count |
| --- | ---: |
| deleted test files audited | 108 |
| RETIRED-SUBJECT (justified) | 102 |
| PRESERVED — restored and green | 1 |
| PRESERVED — migrated into a surviving suite | 2 laws (5 + 3 new arms) |
| AMBIGUOUS — needs a ruling | 5 |
| restored-but-red files left in tree | 0 |
| negative controls fully lost | 1 (`pwsh`) — **now migrated** |
| negative controls rigor-degraded | 2 (end-cap adversary; approval ladder) |
| negative controls evidence-degraded | 1 (p4t6 real → synthetic) |
| `retiredSubjects` entries corrected | 3 live removed + 10 missing added |
| boundary raises reverted | 0 (both measurement-justified) |
