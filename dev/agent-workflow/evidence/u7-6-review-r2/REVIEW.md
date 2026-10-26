# U7-6 GLUE-4 adversarial review R2

Branch: `task/u7-6-review-r2-20261026`  
Subject: PR #391 / `task/u7-6-glue4-search-assurance-20261026`  
Reviewed head: `4cbf414f6`

## Verdict: PASS

Round-1 F1/F2/F3 fixes are present, enforced on the production construction path, and backed by re-runnable RED-first evidence. The focused admission/effects tests pass (54 + 17 = 71 tests), the committed mutation probes re-run and catch all four mutants, the C2 fixed-head record contains the required post-admission backend-refusal facts, and the PR/ledger terminology correctly identifies the template-policy coverage/projection gate rather than claiming an assurance-runtime adapter. I found no remaining merge-blocking defect in the requested scope.

## Findings

None.

## VERIFIED

1. **Mandatory source/design reading completed.** Read `docs/ROUTER_RULES.md` with §0 first, PR #364 unified execution plan (U7), `dev/agent-workflow/evidence/u7-design-20261026/U7-PLAN.md` item U7-6, and the R1 review from commit `16c22b740` (`dev/agent-workflow/evidence/u7-6-review-r1/REVIEW.md`).

2. **F1 — required known class world and production enforcement.**
   - `packages/runtime/tool-admission/admission-kernel.ts:742-778` declares `knownEffectClasses`; `:842-909` validates inventory shape/presence and membership. A law without inventory returns `projection-inventory-missing`; a well-formed unknown key returns `projection-invoke-class-unknown`.
   - `packages/runtime/tool-admission/admission-kernel.ts:1081-1165` carries both `invokeClasses` and `knownEffectClasses` through `ProductionAdmissionConfig` and `createProductionAdmissionAssembly`; the center does not invent the class list.
   - `packages/runtime/src/plugin/live/team-tool-plane.mjs:837-838` supplies the trusted mount data `{ grep: ['read'], glob: ['read'] }` and `knownEffectClasses: ['grep', 'glob']`. No `bash` is supplied in the plane or U6 Arc-A assembly class inventory.
   - The production-path test in `packages/runtime/test/a5p2-admission-kernel.test.ts:989-1018` drives `createProductionAdmissionAssembly`, not only a helper. The `{evil:['read']}` probe with a supplied world refuses with `TOOL_BINDING_UNVERIFIED / projection-invoke-class-unknown`; the classless construction refuses with `projection-inventory-missing`. The same test pins bash non-ride at `:942-948`.
   - The center carries no search-class name literals in the law implementation. `grep`/`glob` occurrences in the center are existing permission-coverage registry/documentation data, not `invokeClasses` ride literals; the new class map is mounted in the trusted plane. No `knownEffectClasses` or `invokeClasses` declaration containing `bash` exists in the plane/assembly files.
   - Committed post-fix reproduction (`glue4-offline-repro-postfix.txt:27-30`) records R8/R10/R11 typed refusals, including the reviewer-verbatim derive probe.

3. **F2 — committed and re-runnable mutation probes.**
   - `mutation-probes/manifest.txt:1-6` records M1 deny-source mirroring removed, M2 unknown-class membership relaxed, M3 nameable-class guard removed, and M4 ride ceiling relaxed; all are `CAUGHT (exit 1)` and the kernel restore digest is recorded.
   - The script `mutation-probes/run-mutation-probes.mjs:29-89` has exact source anchors, mutates one clause at a time, runs focused Vitest, restores before judging, verifies byte restoration, and writes transcripts.
   - I re-ran the committed script from the review worktree. Verbatim result:
     ```
     M1-deny-mirror-removed: CAUGHT (exit 1)
     M2-unknown-class-accepted: CAUGHT (exit 1)
     M3-nameable-class-rides: CAUGHT (exit 1)
     M4-ride-ceiling-relaxed-to-allow: CAUGHT (exit 1)
     ```
     The script exited 0 and `git status --porcelain packages/ tests/` was empty after restoration. M1 and M2 transcripts show the expected failed assertions.

4. **F3 — terminology and ledger.**
   - `gh pr view 391` body names the **template-policy coverage/projection gate (`admitCall`)**, explicitly says the assurance-level face is vacuous on this mount, and says no assurance-runtime capability is claimed/countable.
   - `dev/agent-workflow/ledgers/arc-a-protected-center.json:147-150` cites PR #391, names the template-policy coverage/projection gate, and explicitly excludes the assurance-level face.
   - The PR body and ledger disclose that `assurance-runtime.ts` is untouched/vacuous rather than claiming delivery of an assurance-runtime capability.

5. **Seven center hunks and override digest.**
   - `git diff origin/master...HEAD -- packages/runtime/tool-admission/admission-kernel.ts` reports exactly seven hunks at `:686`, `:729`, `:797`, `:843`, `:879`, `:976`, and `:1046` (diff coordinates).
   - The ledger override at `dev/agent-workflow/ledgers/arc-a-protected-center.json:147-150` cites PR #391 and records digest `6f25963e...`; `sha256sum packages/runtime/tool-admission/admission-kernel.ts` independently produced `6f25963ec2222c6866c94af0eb08fecc8714cec3e44c9e3d056f0810e33014cd`, matching the booked digest.

6. **Blinded negatives / teeth.**
   - `glue4-offline-repro-postfix.txt:15-26` records empty-template, elsewhere-root, and read-ANY policies refusing with `IO_POLICY_UNSUPPORTED` at the template-default-deny coverage gate. Focused tests passed: `a5p2-admission-kernel.test.ts` 54/54 and `a5p5-effects-schema.test.ts` 17/17.

7. **`/etc` backend-refused leg is post-admission and zero-effect.**
   - Fixed-head C2 record `c2/u5-u6-arc-a-x-2026-10-26T12-44-28-788Z.evidence.json:418-423` contains `refused:true`, `outsideRootCodeSeen:true`, `admissionRefused:false`, `censusUnchanged:true`, and `kind=backend-failed code=target-outside-governed-root`.
   - This proves admission passed, backend anchor law refused before spawn, and no effect/census change occurred. The receipt repeats the same facts at `glue4-c2-receipt.md:47-59`.

8. **C2 fixed-head record and identity.**
   - The fixed-head console record `c2/run2-console.log:1-10` reports `overall=PASS cases=10 PASS:10`.
   - The committed record binds team SHA `a26b6039...`, run ID `u5-u6-arc-a-x-2026-10-26T12-44-28-788Z`, world `u5x-20261026T12-44-28Z`, and a distinct start timestamp. The prior record is `u5-u6-arc-a-u76r1-2026-10-26T11-57-28-224Z`, world `u5u76r1-20261026T11-57-28Z`, team SHA `52dbf56c...`; therefore the fixed-head run is not a copied prior run. The required refusal fields are present as cited above.

9. **No Host boot by this review; no protected runtime contamination.** I did not boot a Host, touch port 3080, or touch `~/.dsh`. Product/test status was clean after the mutation rerun and restoration.

## COULD-NOT-VERIFY

- I did not independently boot a Host or reproduce the live C2; this review relies on the committed fixed-head C2 record and sanitized receipts, per the no-Host-boot instruction.
- The JSON schema exposes `runId`/`startedAt`/world/team identity rather than fields literally named `bootId`, `utc`, and `instanceId`; non-identity and distinct-run status is nevertheless established by the distinct run IDs, timestamps, worlds, and team SHA.
- I did not independently verify the unavailable local install/lint claims from the PR body; this did not affect the requested F1/F2/F3 or C2 checks.

## End-state discipline

This review worktree contains only the review evidence file added by this branch. `git status --porcelain packages/ tests/` is empty, and all mutation source changes were restored byte-identically.
