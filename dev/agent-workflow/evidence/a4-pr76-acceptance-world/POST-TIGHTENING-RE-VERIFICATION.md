# POST-TIGHTENING RE-VERIFICATION

Audience: whoever (agent or human) runs this acceptance world **after** the
harness sandbox switches from full access to workspace-write. Written for a
reader with no prior context on this task. Every command here was executed
once under full access on 2026-10-07 with the stated observation; re-run
them once after tightening and compare.

Repository root: `/home/user/dsh-plugins/dsh-agent-team`
Evidence dir (this file): `dev/agent-workflow/evidence/a4-pr76-acceptance-world/` (worktree `.worktrees/a4-pr76`, branch `feat/a4-pr76-acceptance-world`)
Label: **SIMULATED / MACHINE acceptance — NOT the human pass.**

## 0. Red lines (repeat, because these are why the flags exist)

- NEVER touch port `:3080` or its DSH_HOME (`~/.dsh`). This world boots on
  `:3180` only, its DSH_HOME is inside the workspace.
- The test runtime `tests/deepseek-harness-test-use` stays pristine
  (porcelain empty, HEAD `639ed01539`).
- Never leave the acceptance host running when your session ends
  (`node boot.mjs --stop`).

## 1. Boot

```bash
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr76/dev/agent-workflow/evidence/a4-pr76-acceptance-world
node boot.mjs --detach --model-delay-ms 4000
```

Expected observables:
- stdout ends with the **launch line** `http://127.0.0.1:3180/?token=<token>`
  (the token is also in `<world>/.accept-launch.json`; `<world>` =
  `/home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-accept-20261007T16-57-26Z`).
- Two lines `[a4-boot ...] stable :3080 probe (before-boot): status=401`
  (401 = the stable dev instance answering its own auth gate — observation
  ONLY; nothing else may appear from :3080 traffic).
- Re-running the same command while the world is up is **idempotent**:
  it prints `already running … NOTHING re-started` + the launch line, rc=0.
- If :3180 is occupied by a process this world did NOT start (no live
  `<world>/.accept-host.json` marker), boot **refuses** with rc=1 — that is
  correct behavior, free the port or fix the marker situation, never kill
  strangers.
- What breaks without pieces: boot.mjs refuses to run at all if any required
  artifact is missing (it names the path) — e.g. someone cleaned the
  main-checkout dist: rebuild with the documented build chain (TEST_METHODS §2),
  do not point the row at a different dist.

## 2. MACHINE legs

```bash
node driver.mjs        # prereq: booted with --model-delay-ms >= 2000
```

Expected: `8 MACHINE legs checked: 8 PASS, 0 SKIP, 0 FAIL`, rc=0, receipt
written under `receipts/`. If step 6 SKIPs with `needs boot with
--model-delay-ms >= 2000`, you forgot the flag on boot.mjs (the marker
records it). Raw wire responses in the receipt are the truth to compare
against `receipts/driver-run-20261007T171846.log`.

## 3. Stable-instance (:3080) before/after checks

boot.mjs appends a JSON line per probe to `<world>/accept-probe.log`:
`{"label":"before-boot","status":401}` and `{"label":"after-shutdown","status":401}`.
Both reads under full access on 2026-10-07: **401 before, 401 after**
(copied to `receipts/accept-probe.log`). Expected after tightening: the
same. A `status:0` means :3080 is down/unreachable — investigate before
assuming your boot broke it (it must not have). Manual equivalent:
`curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/` → `401`.

## 4. Why this survives the workspace-write tightening

Measured 2026-10-07 (full access), during a boot + full driver window
(marker-file window, `find ~ -newer …`): **zero files written outside
DSH_HOME**, test-use porcelain empty. What makes that structural (boot.mjs
"Environment hygiene" block):

- The spawned host env **strips every `DSH_*` variable inherited from the
  agent session** (measured leak: `DSH_PROFILE_DIR=/home/user/.dsh/profiles/web`,
  `DSH_WEB_URL=http://127.0.0.1:3080`, `DSH_SESSION_ID=…`). Without the
  strip, session identity/URLs leak into the test host and (worst case,
  if `DSH_HOME` were ever unset) HOME-derived world state would land in the
  **stable instance's** `~/.dsh` — a red-line breach that workspace-write
  would turn from a hazard into a denial mid-boot.
- `HOME`, `XDG_DATA_HOME/CONFIG_HOME/CACHE_HOME`, `NPM_CONFIG_CACHE` are
  pinned to `<world>/.tmp-home`, `<world>/.tmp-xdg/{data,config,cache}`,
  `<world>/.tmp-npm-cache`. Any HOME-derived scratch a Node process reaches
  for lands inside the world (workspace-internal ⇒ allowed). Without these
  pins, a denied write under `~` is plausible for any npm child process
  (update-notifier, `_logs/`) once the sandbox tightens.
- `XDG_RUNTIME_DIR` is intentionally preserved (system runtime dir; removing
  it breaks libraries that require it).

## 5. pnpm / store facts (settle the dependency question)

- The host boot runs **no install at all**: it spawns
  `node apps/cli/lib/bin.js web …` directly; profile bundles
  (`@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`) resolve from the
  pristine test runtime's own installed tree — the same arrangement the
  established f15 world uses (its `profiles/web` has no `node_modules`
  either). Measured: every boot today performed zero pnpm/npm invocations.
- Worktree deps were installed ONCE, store-pinned inside the workspace:
  `pnpm install --ignore-scripts --frozen-lockfile
  --store-dir=/home/user/dsh-plugins/dsh-agent-team/.tmp-pnpm-store`
  (rc=0, "Done in 5.9s" — the pin works and the store is warm; the dir is
  gitignored).
- After tightening, ANY future `pnpm install` WITHOUT `--store-dir` reaches
  for the default store under `~/.local/share/pnpm` (or similar) and is
  **denied**. Fix: keep passing `--store-dir=/home/user/dsh-plugins/dsh-agent-team/.tmp-pnpm-store`.
  `pnpm run`/`node` on the already-installed tree need no store.

## 6. Browser / Playwright verdict

- The MACHINE legs (driver.mjs) are pure HTTP (`fetch` against :3180) —
  **no Playwright, no browser binary, nothing to download**.
- The GUI half (the human §8 pass: tool list visibility, browser-side grant,
  watching the member session) runs in the operator's existing Chromium
  through the harness browser plugin. This machine's only Chromium is
  `/snap/bin/chromium`; `tests/homes/.playwright-browsers` is empty and
  needs to STAY empty — no leg of this artifact downloads a Playwright
  browser. If a future leg adopts Playwright, that download must happen
  while full access exists (or into a workspace-internal
  `PLAYWRIGHT_BROWSERS_PATH`).

## 7. Teardown (mandatory)

```bash
node boot.mjs --stop   # kills supervisor+host (only its OWN pids), removes marker,
                       # appends the after-shutdown :3080 probe line
```

Expected: `stopped (marker removed)` and port 3180 free. A background job
host does not outlive your session — stopping it yourself is the difference
between a clean world and a half-dead one (the mock model endpoint dies
with the supervisor; a host without its mock cannot run member turns).

## 8. If a gate disagrees with the recorded baseline

- `pnpm run check:artifacts` (worktree): expect `OK: 1508 files …` — this
  branch adds evidence files only, zero product/test files.
- Whole-repo `pnpm test`: failing-identity set must equal the recorded
  baseline (see LEGS.md step 1 + the commit message). Extra identities =
  someone moved the baseline; re-run once, then report — do not "fix"
  unrelated failures from this lane.
