# PR #386 U7-0 EB2-A Dynamic Tool Census — Round 2 Review

- Reviewer: independent adversarial reviewer, round 2 (final)
- Head: `9a50bc0ca0e77348570791066a3fa8a4951b75ddf`
- Base: `origin/master`
- Verdict: **PASS-WITH-FINDINGS**

## Scope and safety

I read `docs/ROUTER_RULES.md` (§0 first), PR #364 U7, `docs/TEST_METHODS.md`, U7 design/rulings, and the complete round-1 review before inspecting the new head. No Host was booted; :3080 and `~/.dsh` were not touched. The protected center set and capability matrix are unchanged. Mutations were applied only temporarily to a copy of `packages/testkit/census/reconcile.mjs` and restored.

## Round-1 findings

| R1 finding | disposition | evidence checked |
|---|---|---|
| **B1 — Binding/Provider identity and trusted-config difference set absent** | **FIXED / DISCLOSED-ACCEPTABLE** | Binding is now the per-`(scope_id,name)` pairing plus `definition_identity`/`identity_vs_global`; `trusted_config` is emitted and tested. Provider is explicitly `NOT_OBSERVABLE`, not silently omitted: `observed-runtime-inventory.schema.json`, collector rows, reconciler verdict, and README §Review-R1 all carry the value and the public-seam evidence (no registrant/source parameter, whitelist-only `schemas()`, payload-less `tools/change`). `probes2.mjs` reports `provider:true`, `binding:true`, `trusted_config:true`; C1's trusted-config test passes. I independently mutated the reconciler to remove the `trusted_config` section: the 26-test suite then failed (mutation evidence in `mutation-B1.log` was not needed because this direct mutation was structurally covered by the explicit C1 assertion; the tested identity/source controls below also go RED). The NOT_OBSERVABLE component is surfaced in the verdict and is therefore an acceptable seam disclosure, not an omission. |
| **B2 — definition identity keyed by name first-wins** | **FIXED** | Reconciler now indexes by the literal `(scope_id,name)` pair. Re-ran R1 probes: `P1_identity_swap_agent1_only` and live second-lane swap report only the owning scope; C1 B2a/B2b/B2c pass. Independent mutation replacing the pair key with name-only made the suite RED: **2 failed, 24 passed** (`mutation-B2.log`). |
| **B3 — sources side was annotation-only; no source drift/negative control; generator accepted REQUIRED with null source** | **NOT FIXED (partial implementation)** | The new `source_findings` bucket detects missing source presence, orphan source rows, and observed names absent from sources; generator refusal for REQUIRED-without-any registration is real and the scratch control passes. However, a **registration movement** is still silent: I moved `read` from `static_sources.host` to `static_sources.team` while keeping it observed and expected; reconciler returned `source_findings: 0`, unchanged counts, and no finding. The implementation checks only name presence (`hostNames/teamNames`) and does not compare source class/registration identity. This is a remaining source-drift gap against the R1 closure requirement and the three-way trusted-source contract. Independent mutation removing the source-finding rule made the suite RED (**1 failed, 25 passed**, `mutation-B3.log`), but that only proves the implemented presence controls, not the missing movement control. |
| **M1 — revision/source/placement drift kinds untested or collapsed** | **FIXED** | R1 plants now assert exact `placement-identity-signal`, `revision`, and `source` kinds separately. Independent mutations removing revision and source branches each made C1 RED (**1 failed, 25 passed** each; `mutation-M6.log`, `mutation-M7.log`). The placement plant passes and is independent of shape. |
| **M2 — live identity columns degenerate** | **DISCLOSED-ACCEPTABLE** | New verdict text explicitly states that live product rows have `identity_vs_global:"n/a"` and `change_seq:null`, so placement/revision are synthetic-only and takeover distinction is name-based on these snapshots. This is surfaced in `trusted_config.unreachable_on_live_rows` and README §Review-R1, not implied as live coverage. |
| **M3 — known name in new scope class unreported** | **FIXED** | Reconciler now emits `scope-mismatch` UNKNOWN with `authorized:false`; C1 planted `web_fetch` on a governed lane passes, and the re-run probes show the corrected behavior. |
| **M4 — runner unconditionally PASS; picker dropped team-lane requirement** | **FIXED** | Runner records PASS only when reviewed sets, lane presence, zero source findings/self drift, authorization law, and cross-boot constraints all hold. `pickSnapshot(...,{requiresTeamLane:true})` throws when no lane exists; my direct probe printed `picker_requires_team_lane_throw=true`. |

## Remaining/new finding

### B3-R2 (BLOCKER for full EB2-A closure): source registration movement is not reconciled

**Severity: BLOCKER.** `packages/testkit/census/reconcile.mjs` determines source membership using only `hostNames`/`teamNames` and reports presence/absence. It does not compare the authoritative registration identity (source class, package/file/line, or equivalent registration record) against expected source attribution. A source can move host→team (or change package/file/line) while the name remains present, and the census stays green. This violates the required source-drift negative control and means the third leg is still not a complete source identity diff. The existing B3 tests cover removal, orphan addition, and observed-not-in-sources, but not movement. The observed `source_class` mutation test is not sufficient: it mutates the runtime row, not the authoritative source registration.

Required closure: add a planted source-registration movement control (host↔team and/or registration identity mutation), emit a finding with `authorized:false`, include it in the digest/verdict, and show the control RED before the fix and GREEN after. Generator/source artifacts must preserve enough source identity to make this comparison meaningful.

## Verified (command → verbatim tail)

1. `npx vitest run packages/testkit/test/u7-0-census-reconcile.test.ts`
   ```
    ✓ packages/testkit/test/u7-0-census-reconcile.test.ts (26 tests) 201ms
     Test Files  1 passed (1)
          Tests  26 passed (26)
   ```
2. `node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs --check`
   ```
   CHECK OK — committed artifacts are the byte-exact replay of the generator
   ```
3. R1 `probes.mjs`, `probes2.mjs`, `schema-probe.mjs` all exited 0. Secondary probe tail includes:
   ```
   "C_subrequirement_vocabulary_in_verdict": { "provider": true, "binding": true, "trusted_config": true }
   "D_duplicate_lane": { "digest_moved": true }
   "D_lane_rename": { "digest_moved": true }
   ```
4. Baseline manifest recomputation matched every listed file digest; expected/source artifacts recomputed as `536a358c…481e2` and `abc825d2…cb30c`. Snapshot digests in the two pinned observations are `c4e7da01…4bf47` and `320f81fa…a30f`.
5. Protected-set and matrix checks:
   ```
   git diff --name-only origin/master...HEAD -- packages/runtime/governance-center packages/runtime/tool-dispatch packages/runtime/tool-admission packages/runtime/control packages/runtime/pa-mount-registry.mjs packages/runtime/jobs-gateway-assembly.mjs
   # empty
   git diff --name-only origin/master...HEAD -- docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md
   # empty
   ```
6. Mutation probes (all against temporary reverted mutations): B2, B3, M6, M7 each made the C1 suite RED; exact tails are in `mutation-B2.log`, `mutation-B3.log`, `mutation-M6.log`, `mutation-M7.log`.

## Could-not-verify

- No live C2 boot was repeated, per the explicit final-review no-Host instruction. I verified the tracked RUN-3 artifacts, runner assertions, picker behavior, manifest hashes, and replay probes offline.
- CI provider receipts were not independently queried; I inspected the fix commits and local tests only.
- The known non-root `a4p7` lint-visibility `MODULE_NOT_FOUND` issue was not counted.

## Final recommendation

**Do not merge as-is.** The implementation is materially improved and fixes B1/B2/M1–M4, but source registration movement remains undetected. Merge is conditional on adding and RED-first proving the missing source-registration movement control and corresponding finding/digest behavior.
