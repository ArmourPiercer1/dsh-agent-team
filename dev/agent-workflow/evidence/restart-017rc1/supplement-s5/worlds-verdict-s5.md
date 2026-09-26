# S5 Commit-4 Worlds Verdict — restart-017 (0.1.7-rc.1 host)

**Verdict: S5 SUPPLEMENT COMPLETE — the World A §5 hard browser gate reproduces the
documented Q2-FINDING / S3 NO-GO-C1 (the published 0.1.7 client cannot clear the stuck
failed generation after the single "Open in Team mode" click without a reload). Every
regression world (B/C/D/E/F) PASSes. No S2 regression. RED LINE upheld.**

- Product tip under test: `5e16fa774d1793ab00ae3652dac8fca439f0ecbb`
  (= S1 `58d30de` + S2 `673bb7c` + S3 `833c699` evidence-only + S5a `5e16fa7` dist-glue placement fix)
- Host DSH: `0.1.7-rc.1` @ `46a7f68b0922371ce7144b668b90e799f4` (pristine test-use checkout)
- Ports: host `3492` + mock `3497` only (RED LINE: `:3080`/`:3180`/`:3491` never touched)
- Check ledger: **166 passed / 1 failed / fatal=null** — the single failure is the
  expected step-10 gate finding (see World A).
- Full-run stamp (B/C/D/E/F): `2026-09-26T17-48-44`; World A fixed-driver re-run stamp: `2026-09-26T18-09-18`.

---

## 1. S0 preflight (6/6 PASS)

| Check | Result |
| --- | --- |
| test-use HEAD == 0.1.7-rc.1 pin (`46a7f68b`) | PASS |
| test-use working tree pristine (empty porcelain) | PASS |
| task worktree at accepted S1+S2+S3+S5a tip (`5e16fa77`) | PASS |
| test-use CLI reports `0.1.7-rc.1` | PASS |
| committed install-surface artifacts match a fresh build (1196) | PASS |
| host/mock ports free (3492/3497) | PASS |

`preflight-s5.json` (stamp 18-09-18): pin/head/porcelain/worktreeHead/cliVersion/
artifactCount/ports/stableInstances all green.

---

## 2. World A — the §5 hard browser gate (THE FINDING)

World A: a dynamic Team root is created + live on boot 1 (the leader acknowledges with a
doneToken), then the host is **restarted** (boot 2, resume phase). A **fresh connected
browser page** (opened AFTER the restart) is driven by the strict, no-reload/no-blank/
no-switch Playwright driver (`browser-gate-driver-v2.mjs`) through the 15-step flow.

### 2.1 Wire leg (non-browser) — PASS

| Step | Result |
| --- | --- |
| A1 `team.create`(dynamic root) accepted over the public remote seam (RPC ok:true) | PASS |
| A2 dynamic leader live on boot 1 (first model request on the row staticModel) | PASS |
| A2b boot-1 session history present (assistant rows ≥ 1 in the session log) | PASS |
| boot-1 up (marker + auth + p6t6 ok + boot root live + fence probe ok, phase=create) | PASS |
| boot-2 up (marker + auth + p6t6 ok + boot root live + fence probe ok, phase=resume) | PASS |

### 2.2 Browser gate — FAIL at step 10 (predicted=10) — the documented finding

`gate-verdict.json`: `verdict=FAIL, failedStep=10, expectedFailureStep=10,
noReload=true, noBlank=true, noSwitch=true, takeoverClicks=1`.

| Step | Assertion | Result |
| --- | --- | --- |
| 5 | the fresh connected page opened the cold Team root from the UI session list | **PASS** (`how=sessionTitle(prefix)(post-ungrouped)`, pageLoadCount=1) |
| 6 | the ordinary activation was vetoed by the production fence (created → exact-gen disposed → api-session/error, exact wording) | **PASS** (created=3 disposed=2 err=1 wording=true) |
| 7 | the page shows "Session unavailable" (会话不可用) with the composer disabled | **PASS** (sessionUnavailable=true, composerDisabled=true, composerTag=DIV) |
| 8 | "Open in Team mode / Back to Leader" located (a11y tree) and clicked EXACTLY once | **PASS** (takeoverClicks=1, how=team-tab-button) |
| 9 | NO reload / NO blank-navigation / NO session switch-away-and-back | **PASS** (reloads=0 blank=0 switches=0) |
| **10** | **the composer is ENABLED after the single click WITHOUT any reload/blank/switch (GATE STEP)** | **FAIL** (composerTag=DIV, composerDisabled=true, composerEnabled=false, composerVisible=true) |
| 15 | no second ordinary surviving writer — exactly one surviving generation for the cold root | **PASS** (created=3 disposed=2 surviving=1) |
| 15 | one final Team generation is live (glue hasLive(root)==true after the UI takeover) | **PASS** (live=[boot root, dyn root]) |

**The finding (Q2-FINDING / S3 NO-GO-C1), reproduced on the real 0.1.7-rc.1 host:**

After the single "Open in Team mode / Back to Leader" click, **no reload, no blank
navigation, no session switch** — the host-side Team takeover **succeeds** (step 15: the
final Team generation is live, exactly one surviving writer, no second ordinary writer),
but the **client composer remains disabled** (step 10: `composerEnabled=false`,
`composerDisabled=true`, the page still shows "Session unavailable" / "No delegations
yet"). The published 0.1.7 client cannot clear the stuck failed generation without a
reload. This is the documented NO-GO-C1 finding — a product gap, **not** a driver defect.

The exact production veto wording (step 6 / step-15 probe):
`resume failed for session "...dyn...": TeamSessionActivationInterceptedError:
dsh-agent-team: intercepted foreign Agent activation for Team-managed session "..."` —
i.e. the ordinary open of the cold Team root is correctly intercepted by the production
fence (the host side is sound); the defect is purely client-side (the composer does not
re-enable after the in-place Team takeover).

### 2.3 Driver defects found and fixed (pre-gate mechanics, NOT gate assertions)

The gate could not reach step 10 until three **driver** defects (none of them product
behavior) were fixed. The gate assertions (steps 5–15) and the strict
no-reload/no-blank/no-switch counter-assertions were left intact.

1. **Onboarding path walk** (`browser-gate-driver-v2.mjs`, ~line 182): the workspace
   picker is walked by path segments; the world-dir name is the **second-to-last**
   segment (the last is the literal `workspace`). The pre-fix `.pop()` returned the leaf
   `workspace`, so the walk clicked `homes` and then `workspace` ×2 (absent) and `Open`
   picked the wrong directory. Fixed to take `parts[parts.length-2]` when the last
   segment is `workspace`. (Parent-diagnosed.)
2. **Step-5 lazy-render race**: the session list renders lazily after the workspace opens
   (the `01d-main-screen` dump shows an empty list; the row appears a few seconds later).
   The pre-fix code computed the candidate list via `.count()` **before** the row
   rendered, so every candidate came up empty → a `no-match` false-negative. Fixed to
   `waitFor({state:'visible'})` the row (up to 25s) before building candidates, and to
   rebuild the candidates after the Ungrouped-bucket expand.
3. **`readDomState` composer detection**: the composer is an a11y `textbox` (a
   `[contenteditable]` DIV / `<input>` / `role=textbox`), but the pre-fix query only
   covered `textarea` + `[contenteditable="true"]`, so the composer was invisible to it
   (composerCount=0) and step 7's "composer disabled" assertion could never be evaluated.
   Fixed to query all textbox-like elements and derive disabled/enabled correctly.

Intermediate evidence of each defect is preserved:
- `world-A-buggy-driver/` — the full-run World A gate (onboarding-path bug; step-5 `no-match`).
- `world-A-step7-composer-defect/` — the fixed-onboarding World A gate (stopped at step 7; composer not detected).
- `world-A/` — the **final** fixed-driver World A gate (reached step 10, the documented finding).

---

## 3. Regression worlds (B/C/D/E/F) — all PASS

### 3.1 World B — base restart (16/16 PASS)
create → live → restart → resume → live. The ordinary Team restart path works.

### 3.2 World C — ordinary (non-Team) negative control (7/7 PASS)
- C1 the ordinary session is created over the public session channel — PASS
- C2 the ordinary session works before the restart (model answer) — PASS
- C3 the ordinary SessionController promotion SUCCEEDED NORMALLY (agent/created; **NO fence veto**: zero disposed, zero api-error) — PASS
- C3b the fence never fired for the ordinary session (negative control) — PASS
- C4 the browser-style session/follow(ordinary) yields the snapshot (the stream survives) — PASS
- C5 the ordinary session is fully usable AFTER the restart (post-restart prompt → model answer) — PASS
- C6 the anchor Team is unaffected (Team own-path works alongside the ordinary promotion) — PASS

**The fence is Team-scoped**: it vetoes only Team-managed roots, never ordinary sessions.

### 3.3 World D — `team.prepareOrdinaryOpen` arming / the S2 regression watch (15/15 PASS)
- D2 the cold Team root is fenced on restart (ordinary open WITHOUT a permit is vetoed) — PASS
- D3 wire v5 `team.prepareOrdinaryOpen` grants the one-shot ordinary permit — **PASS** (`permitted:true` + `rootSessionId` + `contractVersion:5`)
- D5 the ordinary activation PASSED the fence via the one-shot permit (exactly one surviving creation after the pre-permit veto) — PASS
- D6 the Team glue hasLive(root) is still FALSE (the ordinary owner is NOT a Team handle) — PASS
- D7 the ordinary Agent runs a normal prompt (NO `team_*` tools on its surface) — PASS
- D8 the `ensureRootLive` call count during the ordinary open = 0 — PASS
- D9/D9b/D9c the subsequent Team-mode `ensureRootLive` TYPED FAILS CLOSED (`TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM`; no silent adopt) — PASS
- D10 after a backend restart the ordinary owner is gone and re-fenced — PASS
- D11/D11b the Team mode can take over AGAIN after the restart (`ensureRootLive` ok) — PASS

**S2 regression watch: CLEAR.** `prepareOrdinaryOpen` is armed and grants the one-shot
permit (`permitted:true`, contractVersion 5); there is **no**
`TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE` (the S2 blocker did not regress).

### 3.4 World E — the 20× restart race (23/23 PASS)
- E-final 20× race: **20/20 final Team live / 0 unresolved writer-held / 0 double Agent /
  0 leaked handle** (every boot after a prior iteration came up clean — a leaked write
  handle would break the next boot gate). iterations=20 good=20.

### 3.5 World F — single-flight / rollback handoff (F1 23 + F2 7 + F3 8 = 38/38 PASS)
- **F1** 20× caller race: every iteration 2/2 caller success, one Team generation, one
  writer, **zero OUTSIDE_TEAM, zero unresolved writer-held** (iterations=20 good=20).
- **F2** member single-flight: two concurrent member-targeting `team` tools → **exactly
  ONE** member generation (memberCreated=1, memberDisposed=0), member live, no
  OUTSIDE_TEAM/writer-held; both concurrent callers succeed (A_ok=true B_ok=true).
- **F3** deterministic ordinary-first rollback handoff (the Q3 TOCTOU test): the ordinary
  `agent/created` fires and its exact-generation rollback (disposed) completes **BEFORE**
  the Team ensure; the Team ensure **SUCCEEDS** after the ordinary handoff (the C1 repair
  path); the deterministic handoff record: created=2 (ordinary + Team), disposed=1 (the
  vetoed ordinary), **final surviving=1 (the Team generation)**; no OUTSIDE_TEAM/writer-held.

---

## 4. RED LINE / hygiene

- `post-stable-probe.json`: **RED LINE — `:3080`/`:3180`/`:3491` never touched or probed**
  (no before/after probe); the kit used only `3492` (host) + `3497` (mock) and stopped
  both after the last world.
- Bare-clone tip for the install == `5e16fa77` (the accepted S1+S2+S5a fix build with
  committed dist/composition).
- `dsh plugin add` exits 0 (0.1.7 compat gate passes on the declared peer); no
  `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`; `dsh.profile.bundles` auto-contains
  `dsh-agent-team`; installed package dir carries the committed install surface.

---

## 5. Evidence index (`supplement-s5/`)

- `worlds-verdict-s5.md` — this verdict.
- `checks.json` — merged check ledger (166p/1f; the single failure = the expected
  step-10 gate finding). `checks-full-run.json` — the raw full-run ledger (B/C/D/E/F + the
  pre-fix World A) for reference.
- `preflight-s5.json` — S0 preflight (stamp 18-09-18).
- `post-stable-probe.json` — RED LINE note.
- `run-s5-all-rerun.log` — the full-run (B/C/D/E/F + pre-fix A) transcript (stamp 17-48-44).
- `run-s5-worldA-rerun3.log` — the fixed-driver World A re-run transcript (stamp 18-09-18).
- `world-A/` — **final** World A evidence (the gate): `boot-2/gate-verdict.json`,
  `boot-2/driver-done.json`, `boot-2/step15-activation-probe.json`,
  `boot-2/browser-hold.json`, `boot-2/browser-driver/*` (a11y trees, text dumps, PNG
  screenshots: `01-landing`, `01d-main-screen`, `02-after-open`, `07-session-unavailable`,
  `10-composer-check`), `boot-2/probe-events/`, `boot-2/instance.log`.
- `world-A-buggy-driver/` — pre-fix World A gate (onboarding-path bug evidence).
- `world-A-step7-composer-defect/` — fixed-onboarding World A gate (readDomState defect evidence).
- `world-B/`, `world-C/`, `world-D/`, `world-E/`, `world-F/` — the regression worlds
  (per-world mock/wire logs, probe events, boot markers, instance logs).
- `kit-s5.mjs` — the S5 kit (per-world boot/restart/follow/fence/activate logic).
- `browser-gate-driver-v2.mjs` — the strict no-reload/no-blank/no-switch Playwright gate driver.
- `mock-deepseek.mjs` — the mock model.
