# A5M2-B-TEAM C2 — Host window **v2**: ONE public-path reachability proof (REVISED per root; PREPARATION ONLY, NO boot)

Window-1 proves **public path reachability only**. It is deliberately one call, not the Team C2 family matrix.
Nothing here runs until root issues the boot GO for exactly these identities.

## 1) THE ONE CALL — named by driver code evidence (no overselling)

| what | evidence |
|---|---|
| The query | **`team_list_members`** — a read on the real Leader surface, exactly once. |
| Driver leg | `C-LEADER-MEMBERS`, wired at `a5m2-team-c2-runner.mjs:772-773` (`rec('C-LEADER-MEMBERS', members.ok, … same-call pairs=… calls=…)`), implemented by `runLeaderMembersCase` at **`:497`**. |
| Entry point (real, public) | a **real Leader session** driven over `POST /api/session/prompt` with RPC body `method: 'session/prompt'` (`:222-229` `apiPrompt`), carrying a marker directive: *"Call the team tool `team_list_members` exactly once now and report the member instance ids verbatim."* Team remote reads go over `POST /team-remote/<method>`. **No internal module call is used as a tool entry.** |
| What is asserted | the durable session log under the window HOME is parsed (`sessionEventsForRun` + `durableToolPairs(events, 'team_list_members')`); the leg is green only on `pairCount === 1` (`expectOnce`), **every** pair outcome `ok` (`outcomeCounts {ok,error,unknown}`), and the expected needles present in the paired result content. Three-state: an unreadable answer is `unknown`, never green. |
| **What this call does NOT prove (stated, not hidden)** | it is a **read**: it exercises no PA/approval consumption. The driver today asserts **no** PA/consumption fact (grep over `a5m2-team-c2-runner.mjs`: no `consume`/PA assertions — the only related lines are the plane-drift note at `:76` and the named `GAP-DURABLE-REPLAY` at `:191`). The consume law lives on the **guarded mutation** path (`live/governed-families/team-wiring.mjs:385` closed B-TEAM input set incl. `callerGate`/`pa`, `:641` settled emission; `team-adapters.mjs:835` settled return) — and every such leg is **out of window-1** by root's item (4). So: `PA-SAME-CALL-CONSUMPTION = NOT_RUN / NOT-OBSERVABLE in window-1`. |

## 2) ALLOW / DENY LANE + THE ONE LAW OBSERVABLE IN THIS WINDOW

* **Allow lane**: the public RPC success law is asserted exactly as the kit law — `res.status === 200 && res.body?.result?.ok === true`, payload read from `body.result.value` (`remoteOutcome` three-state: `ok` / `error` / `unknown`).
* **The one law observable in this window = the SAME-CALL law**, proven from the durable log: one `assistant/message` tool-call event pairs to exactly one `tool/result` event by call id (`toolCallId` / `source.callId`), one outcome, `pairCount === 1`. Nothing is inferred from a count alone.
* **Deny lane (in-window, zero side effect)**: the same endpoint called (a) with **no auth cookie** and (b) against a **foreign/absent `sessionId`** ⇒ expect a typed gateway/RPC refusal (not a 200-ok), recorded with its code. A refusal here is a **pass** of the deny lane; an unparseable answer stays `unknown`.
* **PA consumption**: see the NOT_RUN row above — not claimed.

## 3) `team.create` — initialization only

`team.create` is invoked **only** to bring the isolated Team/root into existence for this window
(driver `createUniqueTeamRoot`, closed create params, revision converted to a positive safe integer per the
contract), from the lane artifact `dev/agent-workflow/evidence/alpha5/natexe/runs/live-2026-10-18T03-32-07/blueprints-v3/a5nx-main.yaml`
(2,279 B, `schemaVersion: 3`, `blueprintId: team.a5nx-main`, `revision: "1"`). All durable rows land **strictly
inside this window's HOME**. It creates no members and admits no work.

## 4) EXPLICITLY OUT OF WINDOW-1

`team_create_member`, `team_delegate`, `team_collect`, `team_follow_up`, `team_send_message`,
`team_archive_member`, any approval/mutation, any side-effect chain, and the rest of the C matrix
(`C-ROOT-LIVE / C-READ-STATE / C-TEAM-QUERY / C-LEDGER-PAGE` stay for a later window). No negative-control
chain beyond the two zero-side-effect deny-lane reads above.

## 5) FIXED identities, surfaces, budget, timeout, cleanup

| item | value |
|---|---|
| product commit | `699cc4fb7a27941b19c1550c42d45d45520535da` |
| product package | `dsh-agent-team-0.1.1-alpha.2.tgz` sha256 `c8dd3f07b940efec03ec69173a3f98a9ded6106ccf725e0bda88efa74c754b0e` (4,107,270 B, 1,837 entries) |
| driver code identity | blob `3a1eae2e76f6ae632be807d6d93d0259b4f9f81c` (`a5m2-team-c2-runner.mjs`, unchanged since lane commit `43ebd01c1cad8670539b1e6e975d04aaf34e7ca7`); **the 40-SHA carrying this revised plan is the lane tip reported in the push receipt** (a commit cannot contain its own SHA) |
| kit | `dev/agent-workflow/evidence/alpha5/live/a5m2-team-c2-kit.mjs` (lane) |
| Host runtime | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (detached, porcelain 0 — measured) |
| boot face | `…/install-c8dd3f07b` — read-only module resolution root; its parent dry world is **not** the DSH_HOME and stays untouched |
| DSH_HOME | new independent temp world `tests/homes/a5m2-team-c2-h1-<YYYYMMDD>T<HH-MM-SS>Z` (`mkdir`, exists⇒throw), naming per `docs/TEST_METHODS.md:84-91` |
| port | **3180**; freedom check that must print nothing: `ss -ltn \| grep -E ':318[0-6]\b'` (measured EMPTY this arc; only `127.0.0.1:3080` listens — stable instance and its home stay untouched) |
| budget | world-increment ceiling **≤ 2 MiB** for this window (precedent ≈117 KB/round); disk `df -B1 --output=avail /` = 8,867,430,400 B, rule **keep ≥ 6 GiB** |
| hard timeout | **`timeout 900`** wall-clock on the driver process (single call + 2 deny probes need far less); per-RPC leg timeout 60 s; durable pairing poll budget 120 s |
| first-error-stop | first non-green leg ends the window; no leg skipping, no retry-to-green, no second attempt on a failed leg; an *expected* typed refusal on the deny probes is a pass, not an error |
| cleanup / exit proof | Host down ⇒ `ss -ltn \| grep -E ':3180\b'` empty; `tests/homes/a5m2-team-c2-h1-<stamp>.lock` released/absent (`:89` lock law); world retained as evidence per §7 (never committed, deletion = separate ordered impact op); post read-backs: repo `git status --porcelain -uno` = 0, install face lock still `dad670ae749c2da364b42d19aa3eacc0ec0f01b60d1c1009bff5ef37fb35217a`, old face lock still `7faee42f88306edb43888cbd3d822a45596d6a05d0641e32457cbcd553568cfe`; zero writes outside the new world (+ lock) and this lane's evidence dir |

## 6) NOT IN THE WINDOW

No installs, no pack/re-pack, no clone, no new worktree, no repo writes, no second Host, no other family
(G5/G6/Schedule/search out), no matrix sweep. `GAP-INITIAL-WORK-TOKEN` and `GAP-DURABLE-REPLAY` stay
named-open and unclaimed by any leg here.

**Gate:** root's boot GO, per identity set above.
