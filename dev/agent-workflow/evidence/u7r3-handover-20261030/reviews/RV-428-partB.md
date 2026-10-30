# RV-428 Part B — narrow verification (worktree rv1-428-1793194268 @ 83b4eb9772e2d6ecaeffb0af2fd5d7dc3b9c0374)

Verified pwd + HEAD before any work. Cap: head -30/tail -12; no installs; no Host boots.

## Task A — defaults unchanged + judge untouched
(pending)

## Task B — mutation test of new C1 (target: dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs; suite: tests/world-factory/u7-tbash-seam.test.mjs)
(pending)

## Task C — scope + evidence sanity
(pending)
- A1: `node --test` on u7-tbash + seam + offline-drive = 14 tests, 14 pass, 0 fail.
- A2: No-FLAG defaults still pinned: DEFAULT_BUDGET=7, DEFAULT_BUDGET_PATH=join(HERE,'boot-budget.jsonl') (beside file), DEFAULT_EVIDENCE_REL=`dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2` (closed-lane prefix), DEFAULT_EVIDENCE_DIR=HERE (outputs beside file). All-three-flags-together fail-closed documented.
- A3: Only judge/verdict-adjacent diff line = verdict output path HERE -> OUT_DIR. judgeTbash calls, `async function drive`, verdict computation: NO +/- lines => unmodified.
- B1 (partial flags -> silent default fallback): KILLED — seam test `throws /must be given together/` failed. Load-bearing.
- B2 (evidencePathOf hardcodes closed-lane prefix): KILLED — routing equality assertion (true==false) failed. Load-bearing.
- B3 (closed-lane rejection branch removed): KILLED — `throws /closed lane/` failed. Load-bearing.
- No SURVIVED mutants. After each mutation `git checkout -- run-c2.mjs`; final `git status --short` = EMPTY (verified).
- C1: `git diff --name-only origin/master...HEAD | grep -c '^packages/\|^scripts/'` = 0 (PASS, no core/script surface touched).
- C2: no files >1M under u7-tbash-seam-20261028 (PASS, empty output).
- C3: fixture boot-budget.jsonl is 0 bytes and IS load-bearing: seam test references fixture-next-lane 5x; line 128 `parseBootLedger(readFileSync(cfg.budgetPath)).length` reads it, asserting a fresh lane starts at 0 entries.
- C4 README sections: 1.The seam / 2.Why / 3.C1 RED/GREEN / 4.The default is unchanged / 5.The exact command a NEW lane must use / 6.Changed files / 7.Gates / 8.File index.
- Final: git status --short empty; HEAD 83b4eb977; no HIGH findings (no SURVIVED mutants).
