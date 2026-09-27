# restart-017rc1 — 0.1.7 backend-restart cold resume: Team root write-ownership fix (C1 activation fence)

## Overview

Fixes the 0.1.7-rc.1 backend-restart cold-resume failure where re-activating a Team root Session (via browser `session.follow` / ordinary auto-promotion) steals the Team root's write ownership, so `team.ensureRootLive` fails and the Team root cannot be brought live.

Authoritative spec: `docs/plans/active/dsh-agent-team-restart-recovery-0.1.7-rc.1-guide.md` (guide baseline = master @ `4fb79fc`, host = pristine DSH `0.1.7-rc.1 @ 46a7f68b09`).

**Plan C (C1 Team Session Activation Fence)** per the guide's preferred path; Phase 0 real-host characterization completed first with **VERDICT GO** (all seven §14 gates; the B+ SessionController-replacement fallback was NOT triggered).

Root cause: 0.1.7's stock SessionController ordinary auto-promotion can `agents.create/resume` a Team-managed Session without the Team glue holding the handle, and the old physical `sessionIsDurable` filename probe is no longer a valid authority under 0.1.7. The fix turns 0.1.7's **awaited-serial `agent/created`** into the Team Session activation ownership fence:

- every Team glue `agents.create/resume` runs under an explicit **owned guard spanning the operation's full AWAITED lifetime** (ref-counted, per session);
- a foreign (SessionController) activation of a Team-managed Session is **fail-closed BEFORE the first model request** — the fence vetoes it with the exact production wording on the user-visible error lane (never swallowed, never console-logged), records the vetoed Agent's exact object, and treats the exact-generation `agent/disposed` as the **writer-release barrier**;
- only the pre-existing Team glue may then re-resume through the complete `agentSetup` and hold the **real `AgentHandle`** (exactly ONE retry after the rollback barrier; no sleep/retry loops, no silent adopt of `ctx.agents.get()`);
- the physical `$DSH_HOME/sessions` filename probe is deleted; the durable check uses the public **`SessionPersistence.stat()`** seam (fail-closed `TEAM_PLUGIN_SERVICE_MISSING` when the service is absent);
- ordinary non-Team Sessions remain **fully upstream-equivalent** (World C negative control 7/7); the D3 "open in ordinary mode" semantics is kept with a **process-local one-shot ordinary activation permit** (new wire method `team.prepareOrdinaryOpen`, contract v5; the button does NOT run Team ensure) and a **gate-5 client composer reconcile** on Team takeover success.

## Commit chain

| SHA | Content |
| --- | --- |
| `9cf57a0` | Commit 1 — Phase 0 characterization only: real-host kit (spike/keepfinal/fence-probe + regressions RUN-14/RUN-19), runs 5–20, repros 1–6, GO-NO-GO verdict (zero product code) |
| `e951344` | Commit 2 — C1 activation core: fence module + ownership classifier + host wiring + `sessionPersistence.exists` seam + physical-probe deletion + 9 call-site `runOwned` wrappers + `ensureLiveAgent` one-retry recovery + writer-held mapping + host-side `prepareOrdinaryOpen` port + **33 new tests** (A1–A8/D1–D4/G1–G6/R1–R5) + dist rebuild |
| `61419de` | Commit 3 — ordinary-mode one-shot permit: wire v5 (`REMOTE_CONTRACT_VERSION_V5`, catalog 27→28, 18th port, invariant-4b) + client two-phase ordinary open (permit settles first, typed rejection never swallowed) + gate-5 `sessions.refresh()` in `openTeamMode` success + 14 remote + rewritten client tests |
| `f3d5a71b` | Fix — C1 fence `runOwned` must span the operation's AWAITED lifetime (real-host defect caught by the Commit-4 kit, see below) + A9 real-shape regression test + A4 correction |
| `2a3df15` | Commit 4 — real-host kit **Worlds A–E + 20× writer-held race, ALL GREEN** + full evidence + gate-5 live closure + the first-run BLOCKED defect record |
| `ede088b` | Commit 5 — final verification **§17 sixteen criteria 16/16 PASS** + closing bookkeeping |
| `3499d31` | Merge `origin/master` (PR #30 model-preference-routing, landed on master after this branch diverged) — p4t6 pin unioned to 763, dist rebuilt, post-merge battery re-verified |
| `0db7a28` | Push bookkeeping (PR #31 opened, merge + re-verification record) |

## The real-host kit caught a committed product defect (why this round has a fix commit)

The first Commit-4 run (build `61419de`) was **BLOCKED on every fresh home**: the fence's `runOwned` was synchronous (`return operation()` without `await`), so its `try/finally` released the ownership guard the moment the create promise was *returned* — while 0.1.7's awaited-serial `agent/created` seam fires several awaited hops later (in-host verified: `createAgent → setupAndPublish → initializeAgent → runMaintenance → publish → announce → ctx.serial`). The fence read `ownedDepth=0` for the Team's **own** bootstrap activation and vetoed it → `bootstrap FAILED: …intercepted foreign Agent activation…` → FATAL on every fresh home.

Unit CI missed it because tests A3/A4 put the fence decision in the operation's *synchronous prefix*. Attribution was settled with in-host `registerHooks` observation (exactly one `apply()`, one fence instance, the guard on the awaited create-chain stack, the same fence reading depth 0 at the seam) — full evidence chain in `dev/agent-workflow/evidence/restart-017rc1/commit4/DEFECT-c1-runOwned-guard-lifetime.md`. The subagent reported it without bypassing or downgrading anything (per §17.16).

Fix `f3d5a71b`: `async runOwned` + `return await operation()` (guard spans the full awaited lifetime; nested-guard semantics preserved) + **A9** regression test in the real host shape (decision deferred across awaited hops) + **A4 correction** (its pre-fix step-2 expectation only held *under* the defect — A4 had green-lit the bug; the guide's A4 semantics now pinned, attribution noted in the test). After the fix, the kit re-ran Worlds A–E + the 20× race: **all green**.

## Verification (independently re-verified by the main agent)

**Real-host kit (0.1.7-rc.1 pristine, per-world fresh homes, deterministic mock, serial, S0 preflight, self-teardown, :3080 probed UNCHANGED in every run):**

| World | Result | Coverage |
| --- | --- | --- |
| A wire (run 4) | 38P/0F | create closed set; fence veto (exact wording, user-visible lane, thrown); exact-generation rollback; `ensureRootLive` ok/live (the C1 repair path); exactly one live Agent; all 13 `team_*` on the resumed leader; real `team_list_members` execution; history intact (23→34); first-request Team model selection; zero duplicate-listener/MCP side effects; **zero foreign-agent model requests in the veto window** |
| A browser (run 7, Playwright gold standard) | 22P/0F | gate-5 five-check: veto (created=3 disposed=2 err=1) → exact wording in the user-visible lane → UI takeover live → **typed prompt answered without any page reload** (recovery via legitimate in-app session switch, zero new activation events) → answer on the **Team leader surface** (13 `team_*` + row staticModel) |
| B (run 10) | 30P/0F | member child cold resume, seven-item §13.6 assertion (role/owning root/persona/base tools/13-tool closed set/single writer/clean delivery) |
| C (run 3) | 7/7 | ordinary non-Team negative control (most important non-regression) |
| D (run 9) | 30P/0F | v5 `prepareOrdinaryOpen` → native open → ordinary prompt works; `ensureRootLive` calls = 0; re-takeover typed fail-closed (`TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM`, no silent adopt); post-restart re-takeover |
| E (run 3) | 20/20 | writer-held race: followOk/ensureOk/teamLive/singleWriter all 20/20, created=20, **disposed=0** (main agent independently re-parsed `race-iterations.json`) |

**Static + suites (re-verified after the `origin/master` merge):** typecheck/build/build:composition all exit 0; check:artifacts **OK — 1196 files**, committed install surface byte-identical to the fresh build (1180 pre-merge + 16 from PR #30's new sources); zero-core scan PASS (0 findings); test-use pristine @ `46a7f68b09` (porcelain empty, re-verified at acceptance time); root suite (quiet, post-merge) = **10 files failing = the pre-existing debt baseline file-for-file and count-for-count (3968 passed of 3989; +72 tests = PR #30's new suites) — new-failure set empty**. Transient observations attributed in `commit5/verification-17.md` / `commit5/merge-30/`: the p4t6 pin drift (754→755, a Commit-3 bookkeeping increment — corrected per the single-writer pin protocol; unioned to 763 at the master merge) and the `p6t1-parallel` load flake (pre-existing — the identical assertion-point failure appears in PR #30's own evidence on clean master `4fb79fc` with neither branch's code present, and in the PR-#29 supplement round as the F7-1 family; provably import-graph-isolated from every product change on this branch).

## ## Red lines held

CORE PATCH BUDGET = 0 (zero upstream modifications; zero-core 0 findings; test-use pristine); no error swallowing anywhere; stable instance `:3080` untouched (read-only 401 probes only); frozen anchors unmoved; 1 task = 1 branch = 1 worktree = 1 writer; homes registered per TEST_METHODS §7 (scratch removed with audit trail, orphan world untouched per user ruling).

## Evidence pointers

- `dev/agent-workflow/evidence/restart-017rc1/phase0/` — characterization kit + runs 5–20 + `verdict/GO-NO-GO.md`
- `dev/agent-workflow/evidence/restart-017rc1/commit4/` — real-host kit + `worlds-verdict.md` (re-issued; first-run BLOCKED preserved verbatim) + `DEFECT-c1-runOwned-guard-lifetime.md` + per-world dumps + gate-5 screenshots + 20× race JSON
- `dev/agent-workflow/evidence/restart-017rc1/commit5/` — `verification-17.md` (final acceptance) + battery/root-suite logs
- `dev/agent-workflow/graph.yaml` block `restart_recovery_017rc1_20260926` + `SESSION_ROUTER_LOG.md` (append-only, through this round)
