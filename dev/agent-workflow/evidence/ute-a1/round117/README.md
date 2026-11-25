# Round 117 — the Candidate Acceptance Gate becomes a VERSION gate (contract round)

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, base `818eae405` (the round-117 documentation commit
is its child and is named in the settlement comment). PR **#822 stays DRAFT** — unmerged, no ready flip, no
history rewrite, no merge, no non-topic push, no upstream patch, no retry, no widened timeout, no weakened
judge, no added `knownRefuted`, no PRODUCT-PROVEN claim. `:3080` and its `DSH_HOME` were never touched.

## What this round is

**A contract change, ruled by the owner on 2026-11-25.** The Candidate Acceptance Gate is a **VERSION gate, not
a per-PR gate**: not required on ordinary PRs (one dual-host run is a measured `83 m 48 s` / 16 host boots — a
10x slowdown of the daily loop), but the formal gate for a candidate/release version, required at the
**frozen candidate SHA** with its receipt verified there. Therefore `PRODUCT-PROVEN` now means *gate-backed at
the frozen candidate SHA of a version, with the version gate Required and green at that SHA* — **not** "covered
by every PR's Required CI". **No row is PRODUCT-PROVEN today**, and the gate covers exactly the **31 judges per
host** (C2, C3, C5, C6, C8, C9, C12, C13 fs/subprocess base) and **never** C1, C4, C7's cold half, C10, C11,
C13's PTC/web/terminals/user faces, C14, C14b, C15, C16, C17, C18.

Implementation in this round:

| artifact | what it is |
| --- | --- |
| `.github/workflows/candidate-acceptance.yml` | version path (`push` tags `v*`, branches `release/**`, `candidate/**`; `workflow_dispatch` with a 40-hex `head` input), non-required label-gated PR opt-in, strict head binding, receipt publication, and the stable `version-gate (Required at frozen candidate SHA)` job that re-verifies the receipt |
| `scripts/candidate-acceptance-known-refuted.mjs` | THE known-refuted enumeration (one literal id → citation map), read by the gate AND the verifier |
| `scripts/version-gate-receipt.mjs` | the receipt writer; refuses a non-pass verdict, a head mismatch, a non-partitioning judges block, `envLimited != 0` |
| `scripts/version-gate-verify.mjs` | the fail-closed freeze check; 20 named `VERSION_GATE_*` refusal codes, exit 0 only on a full pass |
| `scripts/version-gate-verify.test.mjs` | the negative controls (22 tests), declared by the `version-gate-verify-unit` leg so the catalog classifies them COLLECTED |
| `dev/ci/eb3-ci-manifest.json` | explicit version-gate classification on both declared jobs + the `version-gate-verify-unit` dispatch leg |
| `scripts/eb3-ci-required.mjs` | asserts the classification in both directions (new `checkVersionGateClassification`) |
| `dev/agent-workflow/evidence/ute-a1/VERSION-GATE.md` | the definition, receipt schema, exact branch/tag ruleset, freeze procedure, and what is NOT exercised |

Contract documents updated to the single definition: `CANDIDATE-REPORT.md` (§1.1 + summary + decisions),
`D-ACCEPTANCE-REPORT.md` (§"ROUND 117" + status table + the round that defined the ladder), `CAPABILITY-MATRIX-C.md`
(status vocabulary + gate-coverage section + `V@B` paragraph), `C1-C18-SIGNOFF.md` (per-row `VG` column, §3.1
coverage/never table, summary note), `MIGRATED-SUITE-STATUS.md` (dated banner + the rule-giving lines),
`OWNER-DECISIONS.md` (§"ROUND 117" DECIDED, rationale, rejected alternative), `PR-BODY-draft.md` + the posted PR
body.

## Evidence produced this round

| artifact | content |
| --- | --- |
| `version-gate-dryrun.log` | receipt writer + verifier against the repository's own latest verdict (head `92be91dfb`, `62/60/2/0`, exit 0) and the wrong-head / missing-receipt refusals (exit 1). **No receipt is committed**: a receipt for an unfrozen SHA must not be mistakable for a freeze |
| `gate-dispatch-tests.log` | `ute-vnext-a1` 255 tests / 252 pass / 0 fail / 3 skipped, set `sha256:edd4f1c4…` |
| `gate-test-catalog.log` | tests=787 collected=735 excluded=14 uncollected=38, digest `sha256:5f94024c…`, findings=0 |
| `gate-ute-cut-closure.log` | `cut(0/148)` |
| `gate-ute-p0-assets.log` | `cut(148/148) modules=37 files=180 lines=69512` |
| `gate-docs-sync.log` | docs=193 findings=0 blocking=0 |
| `gate-place-dist-glue.log` | 35 placements, every line byte-identical |
| `gate-eb3-ci-required.log` | `pass workflows=11 findings=0` |
| `gate-bound-vitest.log` | `ci-integration` PASS suites=15 passed=238 failed=0 |
| `gate-ute-g1-argv.log` | 89 tests / 89 pass / 0 fail / 0 skip |
| `gate-eb3-run-manifest.log` | records=634 strict=0 incomplete=11 findings=0 |
| `gate-ci-pr-gate.log` | `ci-pr-gate --full --census-captures 2` |

## New scannable-surface delta — measured, not assumed

**One collected node:test suite** (`scripts/version-gate-verify.test.mjs`, +22 tests under the
`version-gate-verify-unit` leg), so the catalog moves `tests 786 → 787`, `collected 734 → 735`, digest
`sha256:8982e6e9… → sha256:5f94024c…`; **uncollected stays 38 and excluded stays 14**. `docs-sync` stays
`docs=193` (the new document is evidence, which it does not count). `ute-cut-closure` / `ute-p0-assets` /
`place-dist-glue` are unchanged; **no new workflow file**, so `eb3-ci-required` keeps `workflows=11`; the three
new `scripts/*.mjs` modules are not test surfaces.

## What is NOT exercised

The version gate has **not** run end-to-end as a version gate: no `v*` tag, no `release/**`/`candidate/**`
push, no `head`-input dispatch; the hosted two-job artifact→verifier path is unmeasured; and **no branch/tag
protection rule has been applied** (owner action — `VERSION-GATE.md` §5 lists the exact ruleset and §6 the
freeze order). No row is PRODUCT-PROVEN and none can be until that happens.
