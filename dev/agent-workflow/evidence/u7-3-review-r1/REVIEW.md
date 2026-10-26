# PR #394 adversarial review (U7-3 / EB4-B/C/D/E)

## Verdict

**PASS-WITH-FINDINGS**

The implementation and negative controls are reproducible for EB4-B/D/E, the package surface is untouched, and the honest gaps are disclosed. EB4-C has documentation/evidence consistency defects: at least one command is claimed observed without a matching receipt, and release facts are stale/inconsistent with the checked receipt. These should be corrected before merge; they undermine the requirement that every documented command be either receipt-backed or explicitly UNRUN.

## Findings

### F1 — MEDIUM — recovery command claims are not receipt-backed

**File:** `docs/RECOVERY.md:18-24`

The table says the combined commands `git status --short --branch` and `git log --oneline -1` were observed and reports “clean, on the task branch.” The EB4-C receipt (`dev/agent-workflow/evidence/u7-3-20261026/eb4c-receipts.txt`) contains no execution or output for either command (it starts with install/build and later records sparse-checkout, authority, host, evidence-store, and release probes). Under EB4-C acceptance, a command must have a quoted receipt or be marked `UNRUN`; this row is neither fully receipt-backed nor marked UNRUN. Add the command/output to the receipt or mark the row UNRUN.

### F2 — MEDIUM — release fact is stale and contradicts the supplied receipt

**File:** `docs/RELEASE.md:3-6,17-22`

The page says its facts were read at `origin/master` `f71159648`, and line 19 states `master carries 1418 commits not in stable`. The EB4-C receipt records the release commands against the reviewed tree and reports `git rev-list --count origin/stable..origin/master` = **1429** (`eb4c-receipts.txt:65-75`). The PR body and EB4-D/E receipt identify the rebased candidate as `origin/master` `94890f090`, not `f71159648`. Thus the release manual's “read from git” claim is not reproducible from the committed receipt and contains a contradictory count. Refresh the facts/receipt atomically (or explicitly identify the older snapshot and mark it historical).

## VERIFIED

- `node --test tests/diag-call-chain/diag-call-chain.test.mjs` — **21/21 pass**; covers N1–N5 redaction, token-located self-test with a 5-line shift, unknown classifications, and bounds.
- `node --test tests/u7-3-devex/devex-integration.test.mjs` — **16/16 pass**; covers typed host/release refusal and integration-order classes.
- `node scripts/diag-call-chain.mjs --code IO_POLICY_UNSUPPORTED --kind refused-admission` — exit **0**, attribution `AMBIGUOUS`, all four admission faces present: `pa-default-deny-coverage`, `assurance`, `admission-kernel`, `closed-world-guard`; output 2261 bytes.
- Synthetic integration check using `classify()` — a finished record with a descendant SHA classifies `BRANCH_LOCAL`; a record bound to candidate SHA classifies `EXACT_MERGED_HEAD`.
- Over-limit synthetic diagnostic input (10,000 refusal lines) — `diagnose()` returned exit **1**, stdout **8,750 bytes**, `truncated=true`, `reported=12`, `seen=10000`; therefore bounded and fail-closed for unknown code.
- `grep -rn --exclude-dir=dist invocationCorrelation packages/tools/a5p5-tools packages/runtime/src/plugin/live packages/runtime/tool-admission` — no live correlation field output was found; the disclosed `NOT_OBSERVABLE_FROM_INPUT` gap is genuine.
- `grep`/source inspection confirms both `scripts/diag-call-chain.mjs` and `scripts/sanitize-evidence.mjs` import `PATTERNS` from `scripts/redaction-patterns.mjs`; no duplicated table.
- `git diff --name-only origin/master...HEAD -- packages/` and `git status --porcelain packages/` — no output; zero product/package diff.
- `git status --porcelain` at review completion — clean after adding this review file (apart from the committed review file before commit).

## COULD-NOT-VERIFY

- No Host was booted, per explicit task prohibition. Therefore no live C2/body-effect or live correlation proof was attempted; this is consistent with the PR's disclosed scope.
- The review did not independently rerun the full install/cold-start/recovery/release command suite; EB4-C was checked by receipt/document cross-audit and targeted commands only.
- `IO_POLICY_UNSUPPORTED` four-face claim is source-level/static attribution, not a live emitter run; the PR correctly presents it as ambiguous and names all four.

## Honest gaps accepted

- EB4-B live correlation is not delivered because `a5p5-refused` input lacks `invocationCorrelation`; disclosed as `NOT_OBSERVABLE_FROM_INPUT`.
- `IO_POLICY_UNSUPPORTED` on admission kind names all four faces rather than choosing one arbitrarily.
- Alpha.5 release is explicitly `BLOCKED`; promotion/tag/push steps are UNRUN and approval-gated.
- Recovery history movers are explicitly UNRUN.

## Merge recommendation

Do not merge without correcting F1 and F2 (or adding explicit historical-snapshot labeling and matching receipts). After documentation/evidence refresh, rerun the EB4-C receipt sanity check; no product changes are requested.
