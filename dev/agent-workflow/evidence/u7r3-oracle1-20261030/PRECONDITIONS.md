# PRECONDITIONS — what `oracle complete=true` requires, item by item

<!-- lane: R-ORACLE-1 · seat: qiyuan-self/qwen3.8-flash-next · real UTC 2026-10-30T17:3xZ · head f7d5b3e75 -->
<!-- law homes: remediation row R-ORACLE-1 (`dev/agent-workflow/evidence/review-routing-20261028/REVIEW-REMEDIATION-20261028.md:23`), R-G4R-1a design doc §2/§6, F1/F2 completeness law in `tests/world-factory/lib/binding-digests.mjs:295-303`. This lane measures and queues; it rules nothing. -->

`complete=true` is a property of FUTURE records produced by a suite whose closure has no
unresolvable dynamic import and no unreadable source (GAP-TABLE §0). Four P-rows gate it; P-6 is
this package's own landing. Nothing below is answered on the lead's or the user's behalf.

| # | precondition | owner | current state |
|---|---|---|---|
| **P-1** | **Edge-law adjudication for the G1 host entry-module edge** (`host-sandbox-assets.mjs:231`, cited `:223`@candidate / `:228`@#490): the remediation row offers exactly two branches — "解析或白名单化该边" (resolve, or whitelist). MEASURED STRUCTURAL FACT (GAP-TABLE §2 G1): the resolve branch is NOT mechanically available — the target `native/system/packages/entry/lib/index.js` lives in the gitignored pristine runtime tree, OUTSIDE the repo root; the closure law (`binding-digests.mjs` `isUnder(root,…)` → `unfollowedPaths`) refuses to bind out-of-root bytes, and CORE PATCH BUDGET = 0 forbids pinning a modified host copy. The whitelist branch is therefore the only branch consistent with the existing laws; two concrete whitelist shapes are proposed in DECISION-TABLE DT-3 (baseline-anchored declared boundary vs HELPER_EXCLUSIONS-style named exclusion). | user/lead (adjudication), implementing lane afterwards | **OPEN — blocks most.** Everything downstream waits here. Measurement this lane; zero self-ruling. |
| **P-2** | **Implement the chosen G1 law in plane code** (`binding-digests.mjs` walker or a named-disclosure registry) with unit RED/GREEN in `tests/world-factory/binding-digests.test.mjs`. Non-effects are pre-proven: `binding-digests.mjs` is in its own `HELPER_EXCLUSIONS`, so editing the WALKER moves no suite's recorded digest; only a suite-side edit moves that suite's FUTURE digests. Offline work, no boots. | future offline code lane (post-P-1 dispatch) | QUEUED behind P-1. |
| **P-3** | **G2 lockseam edges** (`130-u7r3-b49-lockseam.mjs:102/384/435` → `packages/tools/agent-state-family/src/fs-state-store.mjs`, path constant at `:177`): two branches (walker constant-fold vs suite literal-import rewrite) in DECISION-TABLE DT-4; either moves the lockseam suite's FUTURE digest (no historical record binds the rewritten bytes, the 10-30 record binds the old ones — untouched by law). Distinct from P-1: this target is repo-internal, so the "resolve" branch IS available here. | lead choice, suite-lane implementation | QUEUED. Not part of the G4-era BL-22 wording — BL-22 predates the b49 suite (DECISION-TABLE DT-2). |
| **P-4** | **Rebind records**: a boot-pool-C lane produces NEW u6-arc-d / u7-4a-jobs / lockseam records emitted by the P-2/P-3-implemented runners, carrying `complete=true` (+ for the TrustedSources family, a `world-oracle` entry over a COMPLETE closure — GAP-TABLE §4). Historical records are never rewritten (R-G4R-1a §0). | boot pool C lane + boot budget | BLOCKED behind P-1+P-2 (and P-3 for lockseam). Zero boots spent this lane. |
| **P-5** | **Immutability re-derivation** demanded by BL-22/R-ORACLE-1's own clause ("任何后续 commit 触该文件…须重推"): the trigger HAS fired — `host-sandbox-assets.mjs` edited by `3e5e3f74a`/`38a348c44` post-candidate, `run-record.mjs` by `71fa5cfab`, `u7astore-assembly.mjs` by `9a6ffab05` post-b49-binding; all four complete=false digests drift vs tip (GAP-TABLE §3, four rows measured). The re-derivation is an argument about JUDGE bytes between a record's own teamSha and what its verdicts claim — the R2 mitigation "candidate..HEAD judge diff empty" is VOID today for arc-d/jobs; whoever consumes those legs' verdicts next must re-run the argument against each record's own binding head. | lead / consuming lane at time of use (ledger-visible) | TRIGGERED, UNDISCHARGED — registered here with the exact commit set. |
| **P-6** | **R-BL-QUEUE package landing**: this lane's trio+PINNED commit (BL-20..23 rows + regenerated artifacts + manifest + `u7-0-census-reconcile.test.ts` PINNED) with `--check` green + u7-0 26/26 + docs-sync findings=0 + docs:probe blocking=0, then **independent review** per the R-BL-QUEUE row ("`--check` 绿 + 独立评审"). | reviewers (independent seat), merge = main agent | DELIVERED by this PR, awaiting review. |

## Headline

**P-1 blocks the most**: one adjudication ("resolve vs whitelist" for a host-tree dynamic import,
which measurement narrows to whitelist-shape choice DT-3a/DT-3b) gates P-2 → P-4 for the two
G4-era suites; P-3 adds a second, INDEPENDENT small gate for the newest suite and was never named
in the reserved backlog rows. Until at least P-1+P-2 land, every ARC-D/Jobs/lockseam record can
only honestly say `complete=false` — which all four existing records do, honestly.

## Non-preconditions (do not queue these)

- G3/G5 entries (World-state reads, `/proc` boot id) — non-voiding by the recorded F1 law; binding World output into the oracle would bind the answer to the run.
- G4 entries (authority pointer, composed profile) — each already carries its own digest cell (`bindings.authority`, `composedProfileDigest`); R-G4R-1a §2 deliberately keeps the authority binding out of the union.
- TrustedSources family code changes — the `world-oracle` entry consumes whatever the closure cell says; completeness is decided upstream of the entry (GAP-TABLE §4).
