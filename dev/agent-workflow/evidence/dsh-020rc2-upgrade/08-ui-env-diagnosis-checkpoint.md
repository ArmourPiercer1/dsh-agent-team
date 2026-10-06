# UI environment diagnosis — read-only checkpoint (2026-10-03)

Scope: read-only diagnosis only. No browser was launched by this round, no sandbox flag was
changed, no AppArmor/chown/chmod/provider change was attempted, no new route was invented.

## State

- full HEAD: `d8ddde6899818db310a8de57b70571c76e4b24fb` (pushed to `task/dsh-020rc2-upgrade-20261003`; PR #62, DRAFT, never merge)
- worktree porcelain at diagnosis start: `0`; this checkpoint file is the only new tracked file
- owned background jobs, terminal states: `bash-392` completed (kit refused: dirty tree), `bash-397` **killed** (owned teardown of the attempt-2/3 smoke host), `bash-407`/`bash-417`/`bash-435`/`bash-442`/`bash-446`/`bash-448`/`bash-449` completed, `bash-336` completed (artifacts/typecheck/lint). No job is left running; `:3181/:3496` released (my listeners = 0), `:3080` answered 401 before and after every run.

## Exact launch commands as recorded (no re-run)

Both from the driver's own launch log, `chromiumSandbox: true`, 43 args, and **no**
`--no-sandbox` / `--disable-setuid-sandbox` / `--remote-debugging-port` (the kit's own `WEAK`
argv guard would have thrown before any navigation):

- attempt 3: `/usr/bin/google-chrome --disable-field-trial-config --disable-background-networking … --disable-breakpad …` (token URL read from the private access record; never in evidence)
- attempt 4: `/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/.playwright-browsers/chromium-1228/chrome-linux64/chrome` + the same 43-arg default set

## Browser executables and versions

| engine | executable | version (read from package/build metadata, not by launching) | outcome in the recorded attempts |
| --- | --- | --- | --- |
| system Chrome | `/usr/bin/google-chrome` → `/opt/google/chrome/chrome` | `google-chrome-stable 154.0.8037.92-1` (`install ok installed`) | `setuid_sandbox_host.cc:172 FATAL: The SUID sandbox helper binary was found, but is not configured correctly`; helper `/opt/google/chrome/chrome-sandbox` = `-rwsr-xr-x nobody nogroup` (setuid bit present, **not root-owned**) → SIGABRT |
| Playwright Chromium | `tests/homes/.playwright-browsers/chromium-1228/chrome-linux64/chrome` | revision **1228** on disk; the pinned `playwright-core 1.63.0-alpha-2026-08-31` `browsers.json` expects revision **1243** (its `version` field is null, so no upstream version string is claimable) | `zygote_host_impl_linux.cc:128 FATAL: No usable sandbox!` → SIGTRAP (also with a writable `HOME`) |

## Current sandbox facts (this environment, read-only probes)

- `pid1 = bwrap`, `CapEff = 0000000000000000`, `NoNewPrivs = 1`, `Seccomp = 0`, `/.dockerenv` absent, `/usr/bin/bwrap` present → tool commands already run **inside a bubblewrap sandbox with no capabilities and NO_NEW_PRIVS**. Under `NO_NEW_PRIVS` a SUID helper is unusable by design; Chrome then falls back to the user-namespace sandbox, which it also refuses here.
- `unshare -U true` succeeds and `user.max_user_namespaces = 2147483647`, so the refusal is narrower than the global sysctl — consistent with the 2026-10-01 record `AppArmor unprivileged_userns DENIED (CAP_SYS_ADMIN)`.
- `landlock-run` is **ABSENT** from this environment (`command -v` and `/usr/bin` + `/usr/local/bin` listing). The prior round's acceptance ran where the user had installed it, so that fact does **not** transfer here.

## Is there an authorized, already-verified launch route? — No, not in this environment

Existing records show the verified real-UI acceptance ran in a **different environment session**, and its evidence was imported:

- `dev/agent-workflow/SESSION_ROUTER_LOG.md:5115` — "stage-2 LIVE run-7（**专用 env 会话**，MEMBER_MODE=1 真实 member 视角）: observer 40/40; kit VERDICT PASS 16/16"
- `:5096` — DoD #20 (a) closed because "用户自装 landlock-run 落位获验收" (the user installed the runner there)
- `:5095` — evidence "独立环境 session 实证导入" (imported from an independent environment session)
- `:5073` — the Landlock chain itself was **research only, not implemented** ("仅研究不实施")

So the blocker stands. The two minimal platform-side actions that would unblock it belong to the
main reviewer/user (root-level, outside this repo, deliberately not attempted here):
`chown root:root /opt/google/chrome/chrome-sandbox` (mode 4755), **or** relax the container's
unprivileged-userns policy — alternatively provide the same dedicated env session used for run-7.

## UI assertions still UNVERIFIED (nothing below may be claimed)

1. **Asset loading** — that the 0.2 host serves `client-bundle.js` and the four host externals (`react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-primitives`) to a browser over HTTP. Not verified: the launch-URL fetch never completed (two of my bounded runs overlapped and the kit's clean-tree pre-flight refused the second boot — my orchestration slip).
2. **React mount** of the TEAM client module in the host UI (no browser ever loaded the page).
3. **TEAM tab visible/clickable** and its route activation.
4. **Member row render + real click** (the derived member `inst-0iin89s0dvix` was never clicked).
5. **TEAM traffic from the browser** (WS/HTTP round-trips driven by a real UI interaction).
6. Any assertion about persona/preset UI state, selection sync, or disposed-history views.

What *is* verified and stays valid: the bundle builds on 0.2 and is byte-identical to the one the
CLIENT row mounts (`sha256 31a7e433bd304003…`, 1 188 638 B); the 0.2 test-host boots with the TEAM
plugin CLIENT row and reports positive readiness over HTTP (`team.getReadState → relation:"team-member"`);
unauthenticated `/` → 401; the seed-selection fix works against a current world.

## Raw logs (local only, gitignored — never commit; any token is inside these files only)

- `.private-raw-evidence/ui-gate-1/attempt3/driver.log` — system Chrome 154 launch + SUID-sandbox FATAL
- `.private-raw-evidence/ui-gate-1/attempt4/driver.log` — chromium-1228 launch + `No usable sandbox!`
- `.private-raw-evidence/ui-gate-1/attempt4/wrapper-host.log`, `attempt4/wrapper-stdout.log` — host boot/READY/teardown
- `.private-raw-evidence/ui-gate-1/attempt2/wrapper-host.log`, `attempt3/wrapper-host.log` — earlier boots
- `.private-raw-evidence/ui-gate-1/run-attempt4.sh`, `run-attempt5-assets.sh` — the exact bounded orchestration
- `.private-raw-evidence/ui-gate-1/fakehome/` — writable-HOME probe home (empty of interest)
- `.private-raw-evidence/dev/agent-workflow/evidence/team-view-sync-complete/wp9b-browser-smoke-*/` — the kit's own `smoke-host.json` / console logs moved out of the tracked tree
- worlds: `tests/homes/tvs-smoke-2026-10-03T19-03-23`, `…T19-05-03`, `…T19-14-02`, `…T19-14-35` (gitignored; each holds the private `browser-access.json`)

## Carried separately (unchanged, not claimed as done)

`main run6` remains **frozen** with its upload blocked; the 9 base-parity root failures and the
upstream `composition-client` packaging (21 deps / clsx) stay with the main reviewer as waiver
items; the Node composition import stays `pre-existing blocked / no NEW error`.

Idle pending the main reviewer.
