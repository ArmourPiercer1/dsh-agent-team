# U6-PR6-REVIEW-R1 — independent review (verbatim)

> Provenance: qiyuan-inter/gpt-6.1-sol independent session; source `dev/agent-workflow/evidence/u6-pr6-review-r1/REVIEW.md`; copied verbatim.

# U6 PR6 / G4 independent review — round 1

Reviewed detached tree `98b88e3dc0c95392742ffcabf204a5cde3bd9f62` against `origin/master` (`dfd25b015`), including the U6 architecture §§1–2, 8–10.6, PR6 slice plan, conditions, GATE-LEDGER, U6 handoff, prior PR2/3/4/5 reviews, PR6 C1/C2 receipts, and the PR diff. No host boot was performed by this review. The standalone `node --test tests/world-factory/u6-arc-d.test.mjs` passed 7/7; Vitest could not be run because this detached worktree has no `node_modules` (the PR receipt records the same offline-store/link environment limitation).

## Verdicts

- **PR6: 投机通过**
- **G4: G4-CORE-PASS/BRIDGE-BLOCKED**

PR6 is materially sound: the three legacy hub files are deleted, PLACEMENTS drops from 29 to 28, production import scan has no live import of the removed hub, the family ledger identifies one home for read/bash/grep/glob and the named Jobs bridge, ARC-D has real adversarial plants and a one-boot disk/ledger receipt, and the protected product set is untouched (CORE PATCH BUDGET 0). It is not a clean 通过 because the matrix's sensitivity assertion is largely ledger-shape rather than a machine pairing assertion, and the C2 CI-03 native-parity claim is computed from native tool-result text rather than an independent disk read (details below). These are evidence-honesty weaknesses, not evidence of a core authorization bypass.

The decisive G4 ruling is **G4-CORE-PASS/BRIDGE-BLOCKED** under §10.6. ARC-A/B/D and the shared identity, pre-body refusal, and one-shot consume primitives are sufficiently evidenced. Full G4 is not achieved because no real named Bridge has a positive live effect integration: R-U6P4-1..3 leave Jobs attribution/effect legs unproven; R-U6P3-1 leaves governed-bash positive effect unproven; R-U6P5-1/GLUE-4 leaves governed search assurance inadmissible. R-U6P6-1 and R-G3-1 are carried test gaps. These are local Bridge/assurance gaps, not CORE BLOCKER conditions: none presently changes shared identity trust, authorization primitives, body-before refusal, or one-shot Grant consumption. Therefore §10.6 permits restricted continuation for non-dependent Families, but does **not** unlock CA-03/full G4, G5/S5, or Alpha.5 release.

## Findings (≤15)

1. **C2 CI-03 oracle is not independent of tool return text (medium).** `tests/world-factory/u5-canary-runner.mjs:2373-2381` computes `nativeClaimFound` by counting the fixture claim in `toolMsgsOf(r).text`; `tests/world-factory/lib/u6-arc-d-assembly.mjs:449-453` turns that boolean directly into PASS. The receipt's `nativeClaimFound:true` is genuine in the sense that the native grep is deny-listed and the claim was authored to disk, but the PASS predicate itself trusts a native tool-result string. For the user's requested “independent of tool returns” standard, this should be tightened to read/verify the fixture file directly (while retaining deny-listed native grep as a separate provenance/parity fact), then re-run the nine legs.

2. **Matrix blinded-twin check is structurally weak (low/medium).** `packages/runtime/test/u6-pr6-arc-d-matrix.test.ts:593-607` checks only that refusal IDs and a small list of sensitivity IDs exist; it does not assert a one-to-one mapping, execute each counterpart, or prove the same input move changes outcome. Individual scenario bodies contain real twin logic, but the gate-level assertion can remain green if a future refusal loses its genuine twin while an unrelated sensitivity cell remains. Add explicit pair metadata and execute/assert each pair, or document each in a machine-checked pair table.

3. **Removal census preserves many historical hub mentions, including source/test comments and README provenance (`legacy-path-removal-machine.json:1`; production examples at `packages/tools/search-family/README.md:14-31`, `packages/tools/fs-family/README.md:14-22`, `packages/runtime/src/plugin/live/team-tool-plane.mjs:205,1502`).** The ledger correctly classifies these as provenance/history or absence pins, and the production import scan found no actual importer. Before U7, keep the classification machine-readable and ensure no “ongoing re-export” wording remains; do not treat raw mention count (150 total/42 code-classified) as a production dependency count.

4. **The PR's local C1 replay is not reproducible in this detached worktree without install.** `dev/agent-workflow/evidence/u6-pr6-20261026/README.md:48-54,57-65` records pnpm-store and missing-link failures; `node --test` is green, but Vitest could not be independently rerun here because `node_modules` is absent. This is an environment limitation already disclosed, not a product regression; CI/fresh offline install must remain the authoritative C1 confirmation.

5. **The CI-07 row is correctly carried, not passed.** `docs/plans/memo/unified-baseline-alpha5-20261025/u6/G4-CORE-EVIDENCE.md:24` explicitly carries R-U6P5-1/GLUE-4 and says the family effectSet is declarative. This is honest and must not be promoted in U7 until the assurance face admits and measures a governed member-lane search.

6. **Condition 8 is correctly carried, not passed.** `G4-CORE-EVIDENCE.md:42` identifies eq9/R-G3-1 lineage and only re-scores state-first fail-closed ordering offline. It does not claim the live exec-mode race. U7 must keep this distinction until the authorized live crash-reclaim/exec-mode leg is green.

7. **C2 receipt’s CI-03 native proof is otherwise credible but narrow.** The run receipt has `nativeClaimFound:true`, a deny list containing `grep`/`glob`/probe names, one boot, host porcelain empty, and all nine `arcd:*` cases PASS (`c2/run-record-u6-arc-d-arc-d1.json:264-286,740-835`). It proves this fixture’s native parity, not universal non-Team parity for every native tool.

## Scope-B / protected-set conclusions

- `packages/runtime/src/plugin/live/plane-effect-backends.mjs`, `.d.mts`, and dist mirror are deleted; `scripts/place-dist-glue.mjs` has 28 placements. Production import scan over `packages/**` found no actual import of the removed hub.
- The single-home ledger is coherent: read→fs-family, bash→process-family, grep/glob→search-family, Jobs trio→`jobs-family-bridge.mjs`; residual mentions are provenance or absence pins, not second production implementations.
- Diff path audit shows no changes under `control/**`, `tool-admission/**`, `tool-dispatch/**`, `operation-permission/**`, or `pa-mount-registry.mjs`; the protected-set budget is zero.

## Conditions before U7 starts

1. Preserve the G4-CORE-PASS/BRIDGE-BLOCKED label and all named risks in the ledger; do not call full G4 or release green.
2. Close R-U6P4-1..3 with a real Team-owned attribution producer and a fresh live Jobs run proving birth, management, owner fence, and cancel/uncertain settlement through the common kernel.
3. Close R-U6P3-1 with a governed-bash run that resolves the governed ask, consumes exactly once, produces the real spawn effect, and refuses replay; fix the lane-scoped grant representation/seam rather than bypassing it.
4. Close R-U6P5-1/GLUE-4 with assurance-face admission and live governed search positive/refusal legs; retain the narrow TEST_ONLY v3 pin.
5. Re-run R-U6P6-1's real builtinToolDeny restrict/lift pair and R-G3-1's authorized crash-reclaim/exec-mode race, including `other-world-unaffected`.
6. Tighten and re-run the CI-03 oracle so its PASS is based on direct disk evidence plus separately recorded native-grep parity, not solely tool-result text.
7. Strengthen the matrix pair table to machine-check every refusal’s blinded twin and rerun the full 37 offline + 3 live + 3 carried accounting (including the disclosed fixture-heal row).
8. Keep CORE PATCH BUDGET 0 and protected-set digests unchanged; regenerate dist and placement checks after any family changes.

## Unlock statement

This ruling unlocks continued implementation/testing for Families that do not depend on the blocked Jobs, governed-bash-positive, or governed-search-assurance bridges. It does **not** unlock full G4/CA-03, G5, S5, Alpha.5 release, or any claim that the carried live effect legs are complete.
