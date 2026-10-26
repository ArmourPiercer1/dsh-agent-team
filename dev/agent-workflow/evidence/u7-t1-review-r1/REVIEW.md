# U7-T1 PR #389 adversarial review R1

**Verdict: PASS-WITH-FINDINGS**

Scope reviewed: `origin/master...origin/task/u7-t1-harness-closure-20261026` and PR #389. No Host was booted by this review; ports 3080 and `~/.dsh` were not touched. The review branch contains this report only; no product source was changed.

## Findings

### 1. MAJOR — `u6jobs8` BINDING_UNVERIFIED is misclassified as a product boundary; it is a harness-gap disclosure

- **File:line:** `tests/world-factory/lib/u6-jobs-assembly.mjs:148-156,263-283`; evidence `dev/agent-workflow/evidence/u7-t1-20261026/README.md:78-89`.
- **What is wrong:** The jobs fixture mounts `teamToolPlane` with `jobsEnabled: true` but does not provide `names: { bash: 'bash' }`. The current plane defaults `names.bash` to `team_bash` (`packages/runtime/src/plugin/live/team-tool-plane.mjs:146-147`), while the U7-4a producer's documented creating-lane law requires `names.bash === 'bash'`. The fixture therefore asks a governed member to execute a `team_bash` alias that is not the producer's creating lane. The live receipt is exactly the expected result of that mismatch: every governed birth attempt is refused with `Tool Binding for "bash" cannot be verified at dispatch time`, with no job id.
- **Evidence:** The PR #389 receipt records `jobIds: []` and the BINDING_UNVERIFIED refusal (`dev/agent-workflow/evidence/u7-t1-20261026/c2/u5-u6-jobs-u6jobs8-2026-10-26T10-41-34Z.u6jobs-evidence.json:49,300-304`). The U7-4a router evidence explicitly says this is “the default naming面 assembly fact (无 `names.bash` 接管)” and not related to the producer product change. The source confirms the fixture has no `names` entry, while the plane's default is `team_bash`.
- **Evidence needed:** A corrected harness run with the producer-compatible `names.bash: 'bash'` creating-lane assembly (or an explicit harness negative control proving that omission is intentional) before attributing this refusal to a product binding defect. The corrected run must exercise the governed member through `team.resolveControl`, produce a real host job id, and then test attribution/list/output/kill.
- **Classification:** **Defect in review claim / disclosure gap**, not evidence of a product defect. PR #389 should have flagged this as a harness gap and excluded it from the product-boundary list. This is a major finding because the PR body and README use the failed lane to support a product-boundary conclusion while the fixture is not compatible with the required U7-4a creating-lane contract.

### 2. MINOR — “6/6 host starts” is not fully self-contained in the committed run receipts

- **File:line:** `dev/agent-workflow/evidence/u7-t1-20261026/README.md:199-207,239-262` and the six C2 evidence files.
- **What is wrong:** The README honestly states six starts, but only four of the six JSON evidence files carry a `hostStarts.thisRunCount: 1` field. The jobs and proc receipts contain the run data but no per-receipt `hostStarts` object. A machine recount over `u7-t1-20261026/**/*.json` found four JSON files with `thisRunCount=1`, not six. The six count is reconstructable from the six committed instance logs and the README narrative, but not from a uniform machine-readable ledger in each claimed run receipt.
- **Evidence needed:** Add a committed aggregate budget ledger or add `hostStarts` to the jobs/proc receipts, with six unique run IDs, six boot phases, and a hard cap check. The aggregate must distinguish live starts from zero-start offline reconstructions and show no seventh attempt.
- **Classification:** **Disclosure/evidence-shape gap**, not a demonstrated overrun. The count is consistent with the six committed instance logs and the README, but the evidence contract should be machine-auditable without relying on prose.

### 3. MINOR — R-G3-1 remains correctly FAIL/SYNTHESIS, but the report should make the non-delivery status harder to miss

- **File:line:** `dev/agent-workflow/evidence/u7-t1-20261026/README.md:8-47,207-218`.
- **What is wrong:** The report does preserve the source live `other-world-unaffected FAIL` and labels the synthetic reconstruction `SYNTHESIS`; this is correct under the universal rule that FAIL and synthetic/offline evidence are not delivery. However, the synthetic JSON has `overall: PASS` and the README later says the forward fix “produces” the missing boolean. A reader scanning only PASS fields could mistake this for a live closure.
- **Evidence needed:** Add an explicit machine field such as `delivery: NOT_DELIVERY`, `liveConfirmation: REQUIRED`, and `verdict: FAIL` to the synthetic artifact and the aggregate summary. Keep the source live FAIL verbatim.
- **Classification:** **Disclosure gap**, not a false PASS in the current text. The current evidence does not prove live `other-world-unaffected`.

## What I VERIFIED

### Scope / protected center / tests-only

Command:

```text
git diff --name-only origin/master...HEAD | while read f; do case "$f" in packages/*/test/*|tests/*|dev/agent-workflow/evidence/*) ;; *) echo "$f";; esac; done
```

Verbatim tail:

```text
```

No protected center path appears in the PR diff. The changed `packages/` path is `packages/runtime/test/u6-pr6-arc-d-matrix.test.ts`; all other product-looking changes are under `tests/**` or evidence. This satisfies the tests-only/zero-product-file-diff claim.

Command:

```text
git diff --check origin/master...HEAD
```

Verbatim tail:

```text
```

### C1 targeted tests

Command:

```text
node --test tests/world-factory/world-factory.test.mjs tests/world-factory/u6-arc-d.test.mjs
```

Verbatim tail:

```text
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 12434.91996
```

### E1 direct-disk oracle

Verified from the committed receipt and README: the old claim-text arm was green while `nativeEvidence.readFromDisk=true, present=false`; the new judge records `arcd:ci03-native-parity FAIL`. This is the required RED negative control, not a delivery PASS. The later edit chain is explicitly unbooted after the 6/6 budget, so no native positive effect was claimed.

### E2 blinded-twin mutation sensitivity

Verified in `packages/runtime/test/u6-pr6-arc-d-matrix.test.ts` and `tests/world-factory/u6-arc-d.test.mjs`: the machine check requires both twin executions and body/gate disagreement, and the five planted mismatches throw. The targeted test run above passed the mutation-sensitive suite.

### R-U6P4-2 stall and R-U6P3-1 targeting

Verified disk/ledger evidence:

- jobs receipt: `controlRead.channel=remote:team.getLedgerPage`, `anchoredToBootRoot=false`, `positiveReadProven=true`, three `team.resolveControl` 200/ok responses, and leader telemetry `{requests:46, exchanges:11, wakes:29, wakeRejected:0}`.
- proc receipt: `teamSessionId=session-u6proc-team-...`, `anchoredToBootRoot=false`, identity derived from the `team.create` response; the judge fails when `positiveReadProven=false`.
- proc receipt records the required product-boundary refusal verbatim: `a5p5-refused kind=refused-admission code=APPROVAL_DENIED`, with `controlDigest.requests=[]` and `positiveReadProven=false`.

The judges therefore fail the positive arms rather than treating an empty/unproven ledger as a pass.

### 6/6 budget accounting

Verified six distinct committed instance logs in `c2/logs/` (jobs, proc, arc-d u7arc1–u7arc4) and the README's explicit 6/6 statement. I also checked the JSON receipts: four expose `hostStarts.thisRunCount=1`; jobs/proc do not, which is Finding 2.

### U7-4a source cross-check

Verified that the current plane default is `DEFAULT_PLANE_NAMES = { ..., bash: 'team_bash' }` and that `u6-jobs-assembly.mjs` does not override `names.bash`. The U7-4a router evidence states the producer's creating-lane pin is `names.bash='bash'` and explicitly attributes `u6jobs8` to the missing takeover. Therefore PR #389's product-finding wording should be corrected to a harness-gap finding.

## Could NOT verify

- No live re-run of the corrected U7-4a-compatible `u6jobs` fixture was performed, because this review must not consume the PR's exhausted 6/6 host-start budget and must not boot a Host.
- No live crash-reclaim confirmation was performed. The committed R-G3-1 material is an offline re-judgement plus clearly labelled synthetic straddle; the original live survivor-straddle fact remains FAIL.
- No positive governed bash spawn/one-shot/replay was verified in PR #389; the committed proc and jobs runs fail before the positive arm reaches a durable request/effect.
- I did not count the hosted GitHub `census-runtime` result as local disk evidence; it is referenced by the PR body/README but not independently reproduced in this review worktree. The local full gate explicitly records `census` as REFUSED because the pristine host tree is absent from this worktree.
