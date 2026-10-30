# RV-428 Part A — run-c2.mjs CLI-seam refusal matrix + bypass hunt
- Worktree: .worktrees/rv1-428-1793194268 @ 83b4eb9772e2d6ecaeffb0af2fd5d7dc3b9c0374 (verified)
- Subject: dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs (493 lines; seam = lines 50-130)
- Seam facts (read 40-135): resolveRunConfig L79-107 (trio-or-refuse L99-101, budget int≥1 L102-103, path guard L63-70); assertBootBudget L115-119 throws when declared+1>budget; parseBootLedger L110-112 filters non-JSON/non-integer-boot lines; module-level RUN=resolveRunConfig at L126 before any host work.

## Task A — refusal matrix (all --dry-run; ALL 8 REFUSED, rc=1; nothing created)
1. 2-of-3 → throw run-c2.mjs:101 "must be given together (got 2 of 3)"
2. 1-of-3 → same :101 refusal
3. valid trio, no --fixtures → rc=1, but DEFECT (LOW): dryRun fixture lookup process.argv[indexOf('--fixtures')+1] → indexOf=-1 yields argv[0]=node ELF binary; the :175 empty-guard is defeated; runtime SyntaxError at run-c2.mjs:177:24 "ELF... not valid JSON". Fails safe, no writes.
4. --budget abc → :103 "bad --budget: abc"
5. --evidence inside closed lane → :68 "must not point inside the closed lane dir"
6. --budget-ledger = closed-lane boot-budget.jsonl → :68 same refusal
7. --evidence ../../../tmp/outside-428 → :66 "must stay inside the repo"
8. duplicate --evidence → :86 "duplicate --evidence"
Side effects: boot-budget.jsonl unchanged (git status empty; 8 lines = 7 boot entries + 1 disclosure line, counted as 7 by parseBootLedger :110-112); no dev/agent-workflow/evidence/tmp-probe; no /tmp/outside-428; final `git status --short` EMPTY.

## Task B — bypass hunt (read-only)
B1 No-ledger boot: none on live path — declareBoot asserts BEFORE append (:162→:164) and runs (:235) before world.startHost (:241); no-flags = closed-lane ledger 7/7, budget 7 → assertBootBudget (:115-119) throws = fail closed. MEDIUM: dryRun writes dry-run-GREEN.json into OUT_DIR (:203-204) with NO boot declaration — a passing artifact with zero budget consumed, misreadable as boot evidence. MEDIUM: assert→append is unlocked check-then-write (:161-164); concurrent runs on one ledger can double-spend a boot slot.
B2 Cross-lane ledger: only the closed lane is rejected (:63-70). --budget-ledger may target another live lane's ledger → boots charged into/against the wrong lane (cross-lane exhaustion + misattribution): harmful, not merely noisy. HIGH (governance): --budget is self-declared with NO cap; a fresh empty ledger + --budget 999 authorizes arbitrary boots. Ceiling rests solely on git review, not code.
B3 Misattributed binding: YES — record evidence list = own-dir names filtered by existsSync (:276). Stale host-bootN.log/mock-excerpt files left in a reused evidence dir pass the filter un-written; boot numbering restarts at 1 after a ledger reset → old files re-cited as new. MEDIUM.
B4 Ordering: resolveRunConfig executes at module top-level (:126), before dryRun dispatch (:488) and before main() → createWorld/startMock/declareBoot/startHost (:219/:234/:235/:241). Guard is reached before any startHost.

## Round-1 re-review @ ce4ca22b411a9ee470123cc258681d885706f89c (F1–F4 closure, executed)
F1 CLOSED: --budget 4 → rc=1 typed refusal naming "cap 3 (MAX_FLAGGED_BUDGET)" (:166); --budget 3 accepted; U7TB_BUDGET_OVERRIDE_REASON + --budget 9 accepted, and recordBudgetStamp → {"bootBudgetOverride":{"budget":9,"cap":3,"env":"U7TB_BUDGET_OVERRIDE_REASON","reason":"test reason"}} (self-disclosing; stamped into boot entry :285 + record :403); DEFAULT_BUDGET still 7 (:85), cap applies only to flagged runs.
F2 CLOSED: --budget-ledger → other lane's committed ledger (u7-family-records-20261027/budget-ledger.jsonl) refused rc=1 "F2: one lane declares against ITS OWN ledger" (:175); ledger inside --evidence dir accepted (reached downstream guards).
F3 CLOSED: decoy boot1-something.log in --evidence dir → rc=1 "dir is not empty… pass --allow-reused-dir" (:211 via ensureOutDir), wrote nothing (dir held decoy only); with opt-in run produced its own dry-run-GREEN.json rc=0. Old existsSync dir-scan filter: grep existsSync(join(REPO → zero hits; record cites writtenOut only (:242, recordEvidencePaths :223), names runId-stamped via outputTagOf (:217-218); seam test pins this (assertFreshEvidenceDir referenced in test file).
F4 CLOSED: no --fixtures → "[u7tb-c2] DRY-RUN FATAL Error: --dry-run requires --fixtures <json>: the --fixtures flag is missing" (resolveFixturesArg :231) — named message, no ELF/JSON.parse crash; valueless/flag-swallowed --fixtures also guarded (:233).
Tests: node --test tests/world-factory/u7-tbash-seam.test.mjs → pass 9, fail 0 (first run ENOENT mkdtemp = missing gitignored .artifacts/tmp in fresh worktree, environmental; mkdir fixed). NEW (LOW): with --allow-reused-dir a second dry-run silently overwrites the static-name dry-run-GREEN.json (runId stamping covers live-path evidence names only).
Verdict: F1/F2/F3/F4 all CLOSED; one LOW note. ROUND-1 RE-REVIEW: 通过
