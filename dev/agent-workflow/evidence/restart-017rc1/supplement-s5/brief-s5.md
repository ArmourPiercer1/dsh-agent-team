# S5 brief — real-host supplement (PR #31 supplemental fix round)

You are the S5 executor for the PR #31 supplemental fix round. This document is the
complete spec. Work until every leg has been run and the verdict written. Do not
stop early to ask questions unless you hit a hard blocker (report it with full
diagnostics instead of working around it).

## 0. Session-start requirement (AGENTS.md — read these FIRST, in this order)

1. `/home/user/dsh-plugins/dsh-agent-team/docs/ROUTER_RULES.md`
2. `/home/user/dsh-plugins/dsh-agent-team/docs/TEST_METHODS.md`
3. Guide: `/home/user/dsh-plugins/dsh-agent-team/docs/plans/active/pr31_supplemental_fix_guide.md`
   — read §4.5 (lines ~1157–1238, World F spec), §5 (lines ~1239–1274, browser hard
   gate), §7 S5 (lines ~1386–1401), §8 (lines ~1428–1447, forbidden methods) in full.
4. Commit-4 reference kit (the working pattern you must reuse/extend):
   `.worktrees/team-restart-017rc1/dev/agent-workflow/evidence/restart-017rc1/commit4/kit.mjs`
   (READ IT IN FULL — 2301 lines: world bootstrap, bare clone, profile/patch, host
   boot, mock, wire legs, browser hold, self-cleanup), plus
   `commit4/browser-leg-driver.mjs`, `commit4/driver-attach-gate5.mjs`,
   `commit4/explore-onboarding.mjs` (UI mechanics), `commit4/worlds-verdict.md`
   (verdict format precedent), `commit4/preflight.json`.
5. S3 evidence (grounds the World A prediction — read before running World A):
   `supplement-client/verification.md` in this directory's parent
   (`dev/agent-workflow/evidence/restart-017rc1/supplement-client/verification.md`)
   and `phase0/run2026-09-26T07-03-12/legB/q2-browser/Q2-FINDING.md`.

## 1. State of the world (facts you may rely on)

- Repo: `/home/user/dsh-plugins/dsh-agent-team` (main checkout). Task worktree:
  `.worktrees/team-restart-017rc1`, branch `task/team-restart-017rc1`,
  **tip = `833c69997a2d1893e69753b9ab697488e82efe8a`** (S1 `58d30de` activation core
  + S2 `673bb7c` host/root contract + S3 `833c699` client characterization evidence;
  product changes = S1+S2 only, S3 is evidence-only).
- The branch is visible from the main repo (worktree shares the object store) —
  `git clone --bare --branch task/team-restart-017rc1 /home/user/dsh-plugins/dsh-agent-team
  <dest>` reproduces the tip. **Preflight-assert cloned tip == 833c69997a2d1893e69753b9ab697488e82efe8a.**
- Committed install-surface artifacts at the tip = **1196 files, match a fresh build**
  (verified `node scripts/check-artifacts-committed.mjs` in the worktree, exit OK).
  The installed plugin therefore carries the S1+S2 runtime fixes.
- Upstream test runtime: `/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use`
  **pristine @ `46a7f68b0922371ce7144b668b90e377d8e799f4`** (0.1.7-rc.1). READ-ONLY.
  Never modify it. Host CLI = `node apps/cli/lib/bin.js web --port <N> --no-open`
  from that dir.
- Published client for the browser leg = the 0.1.7-rc.1 build served when the host
  runs with `DSH_CLIENT_COMMIT_HASH=46a7f68b09` (badge `0.1.7-rc.1-46a87f68`) —
  exactly the client S3 characterized.
- Ports: host **3492**, mock **3497** (both verified free at brief time; the kit must
  preflight-check and die loud if occupied). `:3080` = user GUI (NEVER touch, never
  even a probe). `:3180` untouched. `:3491` may be an orphan listener — never kill,
  never use.
- Environment: WSL, Node v24.21.0, 32 cores. Everything you create goes under the
  worktree (workspace-write only). Evidence/logs NEVER under /tmp.

## 2. Deliverables (all under
`.worktrees/team-restart-017rc1/dev/agent-workflow/evidence/restart-017rc1/supplement-s5/`)

1. `kit-s5.mjs` — the S5 kit (NEW file; you may copy/adapt code from commit4
   `kit.mjs` with a header note). Implements legs A–F, one host at a time, one fresh
   mock + one fresh DSH_HOME per world, serial, self-cleaning.
2. `browser-gate-driver-v2.mjs` — the §5 strict World A browser driver (NEW; extend
   the commit4 browser-leg-driver.mjs pattern). **No reload, no blank/new-session
   navigation, no session switch-away-and-back — ever** (the guide §5 DO-NOT list).
   Accessibility-tree-level operations only (no DOM hacks, no private store reach).
3. Per-world evidence dirs `world-A/ … world-F/`: host logs (every boot),
   fence-probe events (JSON), wire captures (mock-side model requests), screenshots
   (World A: one per gate step at minimum), per-iteration JSON for E and F1,
   preflight output.
4. `preflight-s5.json` — S0 checks: tip SHA, artifact count, test-use HEAD, ports
   free, plugin peer gate.
5. `worlds-verdict-s5.md` — per-world verdict with assertion tables in the commit4
   `worlds-verdict.md` format: per-leg PASS/FAIL, the exact step where World A's gate
   stops (if it fails), F1/F2/F3 numbers, run metadata (world names/stamps, SHAs,
   ports, durations), red-line compliance record, and any deviations.

## 3. The legs (guide §7 S5)

Serial order: A → B → C → D → E → F. One world = one fresh DSH_HOME named
`rst017-s5-<UTC-stamp>-<letter>` under `tests/homes/` (TEST_METHODS §7), kept after
the run (commit4 precedent: homes are kept and registered) — record every home name
in the verdict.

### World A — §5 hard browser gate (NEW, gold standard, strict)

Fixed flow (guide §5 verbatim — the driver must execute exactly this):

```text
1. create dynamic Team root
2. send one successful Team turn
3. stop backend
4. restart same DSH_HOME
5. fresh connected page open the cold Team root
6. ordinary activation is vetoed
7. page shows Session unavailable (会话不可用)
8. click exactly once: "Open in Team mode / back to Leader" (以 Team 模式 打开 / 回到 Leader)
9. DO NOT: reload / navigate to blank/new Session / switch to another Session and back
10. assert composer enabled
11. type prompt
12. send
13. answer renders
14. captured request has: Team leader persona / all 13 team_* tools /
    staticModel or expected model routing
15. activation probe: no second ordinary surviving writer / one final Team generation
```

Interpretation notes (record in the verdict):
- Step 5 = **fresh connected page** (open a new page/tab AFTER the restart, then
  open the cold root from the UI). This matches the authoritative Q2 evidence
  (run 20 keep-mode: the page opened the cold root against the restarted host).
  Do not attempt to keep a page alive across the host restart — connection-recovery
  noise is not what this gate tests.
- Step 8 = locate the takeover button in the accessibility tree (the commit4
  driver did this; the button appears on the vetoed session's Team panel) and
  click it EXACTLY ONCE.
- The driver asserts step by step and **stops at the first failed assertion**,
  recording: DOM/accessibility state, screenshot, the fence-probe event timeline,
  and the host-side state. It must NOT attempt any recovery (no reload — that is
  both forbidden by the gate and a forbidden "repair" per §8).

**Prediction you MUST reason against (not a target to achieve):** S3
(`supplement-client/verification.md`) empirically proved (data layer, same client)
that no public client operation can clear the failed generation of the current main
session — refresh / same-SID reopen / reconnect all leave the sticky state; only a
generation replacement (reference count → 0 → re-retain) clears it, and the plugin
cannot reach 0 for a session it does not reference. Q2-FINDING.md is the browser
evidence of exactly this flow: after the permitted takeover, same page load, the
composer **remains** `会话不可用` [disabled] (finding #2), recovery only after a
full reload (findings #3/#4). Therefore World A is **expected to FAIL at step 10**
(composer not enabled after the single click). That failure is the FINDING —
record it precisely (step number, DOM state, screenshot, timeline, and the
Q2+S3 citations), then still collect the step-15 host-side activation probe
(no second ordinary surviving writer; one final Team generation — host-side
counts are collectable regardless of the stuck client) and write the gate verdict
as FAIL. **Do not iterate on the driver to make the gate pass** — the gate passes
only if the product restores the composer on one click, which S3 proved impossible
without a core patch (budget 0).

### World B — member restart (reuse commit4 World B definition verbatim)
team + member live → stop → restart → browser-style follow of the MEMBER child
(fenced) → leader team_send_message triggers the member ensure → member cold
resume success → role / owning root / member context / preset+base tools / Team
tools surface / single writer / no OUTSIDE_TEAM | writer-held.

### World C — ordinary non-Team negative control (reuse verbatim; the most
important non-regression): ordinary cold session → restart → browser follow →
ordinary SessionController promotion must SUCCEED normally (the fence never
intercepts a non-Team-owned session).

### World D — explicit ordinary mode (reuse verbatim): cold Team root → wire v5
team.prepareOrdinaryOpen → native open → ordinary Agent success (ensureRootLive
call count 0, glue hasLive false, upstream ctx.agents live, ordinary prompt runs,
a subsequent Team-mode ensure TYPED FAILS CLOSED (no silent adopt), backend
restart → ordinary owner gone → Team takeover works again).
NOTE for S2's change: with the S2 conditional wiring, the armer IS present in
these worlds (the plugin glue is installed), so prepareOrdinaryOpen must behave
as in commit4 (armed, permitted exactly once). If you instead observe
`TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE`, that is a REGRESSION to
diagnose and report (do not paper over).

### World E — follow-vs-Team race (reuse verbatim): ≥20 iterations of
restart → session.follow → concurrent Team ensure. Record created/disposed counts
per iteration (commit4: all 20 showed created=1/disposed=0 — the ordinary-
publication → veto → rollback handoff was never exercised; that gap is what F3
closes).

### World F — Team-vs-Team race (NEW, guide §4.5)

**F1** — Team ensure vs Team ensure, ≥20 rounds:
```text
restart → Promise.all([ ensureRootLive(root), ensureRootLive(root) ])
```
Every round must show: 2/2 caller success, one Team generation, one writer,
zero OUTSIDE_TEAM, zero unresolved writer-held. Record per-iteration JSON
(iteration, both call outcomes, generation id, writer count, OUTSIDE_TEAM
events, unresolved writer-held events).

**F2** — Team ensure vs message/work ensure, on a member child:
```text
restart → concurrent:
   leader sends message/work to cold member
   explicit member/root ensure path
```
Final: **one member generation** (record both triggers, the resulting
generation, and the outcome of the redundant one — success-join or typed
failure, but exactly one live member agent at the end).

**F3** — deterministic ordinary-first rollback handoff (the guide's
"deterministic ordinary-first rollback handoff" line): a deliberate kit-side
barrier so that
```text
ordinary agent/created actually happens FIRST
→ fence veto
→ exact disposed
→ Team ensure success
```
and at least one run records:
```text
created >= 2, disposed >= 1, final surviving = 1
```
Suggested mechanism (you own the design; this is a starting point): reuse the
commit4 kit's passive `fence-probe` patch row (reject:false, listed FIRST so its
awaited-serial agent/created listener registers before the production fence's —
it records every creation announcement) and GATE the kit's Team ensure on
observing the target SID's ordinary `agent/created` event first (kit-side
wait, bounded, with explicit timeout failure — test-harness waiting, not
product backoff). The ordinary promotion itself must be triggered the normal
way (e.g. the browser-style session/follow of the cold root, as in World A
step 5–6). Without this barrier the ordinary-vs-Team ordering is a timing coin
flip (World E's 20×2 created=1/disposed=0 shows it never landed ordinary-first
in practice). If the handoff does not survive even when forced (veto→disposed→
ensure fails), that is a PRODUCT DEFECT — record full diagnostics, do not fix
product code, continue the remaining legs.

## 4. Kit mechanics (from commit4 kit.mjs — read the source, these are the
coordinates)

- Per world: fresh home `tests/homes/rst017-s5-<stamp>-<letter>`; inside it:
  `repo.git` (bare clone of the branch, tip-asserted), `profiles/web/cordis.patch.yml`
  (the kit writes it — patch rows: passive fence-probe row FIRST, then the
  dsh-agent-team row; read kit.mjs ~lines 956–1000 for the exact construction),
  `workspace/`, `.xdg/`, `blueprints/`, `spill/`.
- Plugin install per world: the dsh CLI in the home, `dsh plugin add
  git+file:///<home>/repo.git` — exit 0 = the 0.1.7 compat gate passes on the
  declared peer (record it).
- Host boot (per boot, including restarts): from the test-use dir,
  `node apps/cli/lib/bin.js web --port 3492 --no-open` with env
  `DSH_HOME=<home>`, `DSH_CLIENT_COMMIT_HASH=46a7f68b09`, plus whatever else the
  commit4 kit sets (read it). Use the same process supervision + bwrap
  `--die-with-parent` pattern as commit4 (TEST_METHODS §5; note the commit4
  header's SIGTERM-handler caveat under bwrap and how it was handled).
- Mock model: fresh per world on 3497 (commit4 pattern — scripted model server;
  it also serves as the request captor for the "captured request" assertions).
- One host at a time (3492); one mock at a time (3497); worlds strictly serial.
- Self-cleanup after each world: kill host + mock, verify ports freed, keep the
  home. A kit crash must not leave listeners: preflight every world boot by
  checking 3492/3497 free and die loud otherwise.
- The World A browser leg needs the kit to HOLD the restarted host (the commit4
  `--browser-hold` pattern) while the driver runs the UI flow; the driver
  returns its step results (assertions + screenshots + accessibility captures)
  and the kit asserts on them.

## 5. Red lines (guide §8 + round constraints — violations = abort and report)

- No product code changes. No test-use modifications (pristine @ 46a7f68b09,
  zero edits including temporary). No upstream modifications. CORE PATCH BUDGET = 0.
- No `session.lock` deletion; no sleep/backoff or while-retry in PRODUCT (bounded
  waits in the kit/driver with explicit timeout failure are test-harness
  mechanics — document them); no substring-only writer authority; no silent
  adopt; no physical `$DSH_HOME/sessions` scanning; no DOM click hacks to fix
  the composer; no private store reach; no full-page-reload "repair"; no
  blank-switch-and-back.
- World A driver: the §5 DO-NOT list is absolute (no reload / blank / switch-away
  at any point, including after a failed assertion).
- `:3080` user GUI and `:3180`: never touched. `:3491`: never touched.
- No push of any kind (the main agent pushes at S6). No branch/worktree changes
  other than creating files under `dev/agent-workflow/evidence/restart-017rc1/
  supplement-s5/` and `tests/homes/rst017-s5-*` (gitignored).
  Do NOT edit graph.yaml, SESSION_ROUTER_LOG.md, or any other tracked file —
  the main agent does bookkeeping.
- If a world fails: complete the remaining worlds, then report with full
  diagnostics (host log excerpt, probe events, wire capture, timeline). Do not
  "fix" by weakening an assertion — record the failure as-is.
- Workspace-write only. If a sandbox denial blocks an operation, record it and
  report — do not escalate or route around it.

## 6. Definition of done

- All six worlds ran (A, B, C, D, E, F with F1/F2/F3), serially, on tip
  833c6999; every world's evidence dir populated; `preflight-s5.json` written;
  `worlds-verdict-s5.md` complete (per-leg verdict + assertion tables + World A
  gate step + F numbers + red-line compliance + run metadata + home registry).
- Hosts/mocks all stopped; 3492/3497 verified free at the end; test-use still
  pristine (`git -C tests/deepseek-harness-test-use status --porcelain` empty,
  HEAD = 46a7f68b0922371ce7144b668b90e377d8e799f4).
- Final report to the main agent: one paragraph per world (PASS/FAIL + the key
  numbers), the World A gate's exact failure step (or pass), F1/F2/F3 results,
  the full file list created, and any deviations or blockers.
