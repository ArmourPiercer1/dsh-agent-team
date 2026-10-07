# §7.7 SIMULATED / MACHINE GUI pass — partial, coordinator-driven

> **This is not the human acceptance.** Alpha.3 §8 nine-step checklist, GUI half, driven by the
> coordinator through the plugin's `browser_*` tools against a booted host. The **human** pass
> remains **BLOCKED / NOT_RUN** (`alpha4-implementation-plan.md` §7.7). Nothing here may be
> quoted as the human pass, and nothing here claims the steps marked `NOT COMPLETED` below.

## The run

| item | value |
| --- | --- |
| repo | main checkout @ `62488ce5` (master), porcelain clean before; plugin row source = **main-checkout committed `packages/runtime/dist/…/plugin/host.js`**, never a worktree dist (per `a4-pr76-acceptance-world/LEGS.md`) |
| host runtime | pristine `tests/deepseek-harness-test-use` @ `639ed01539` (0.2.0-rc.2), porcelain clean before and after; `pnpm run build` run fresh in this session (`build: recorded 347 client artifact(s)`), `node apps/cli/lib/bin.js --version` → `0.2.0-rc.2` |
| world | `tests/homes/a4-accept-20261007T16-57-26Z` (world materialized by `dev/agent-workflow/evidence/a4-pr76-acceptance-world/boot.mjs`) |
| launch | `node apps/cli/lib/bin.js web --port 3180 --no-open` as a **managed background job**; launch line `http://127.0.0.1:3180/?token=…` |
| browser | plugin-owned Agent Window, 1440×900, session `hpbb` |
| teardown | host job killed; `:3180` and `:3491` verified clear; **stable dev instance `:3080` probed before and after, `401` both times — untouched** |

## Host-side facts observed during this boot (log, not inferred)

```
[dsh-agent-team] registered 2 bundled team skill(s) from .agents/skills (source "dsh-agent-team", rank 550)
dsh web: http://127.0.0.1:3180/?token=…
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote (late, after 103ms — the connection service appeared after the mount step)
[dsh-agent-team] durable permission authority ACTIVE for row session-a4-accept-boot: anchor templates declaring
  capabilities.permissions = ["leader","worker"], facts resolve per ADDRESSED team through the bound-Blueprint
  resolver (anchor a4.accept.team@1), canonicalized at each target member's effective workspace; expansion ceiling
  = the bound Blueprint's explicit permissionMutationEnvelope carrier (facts healthy: true)
```

`GET /` without a token → **401**; with `?token=` → app renders. Both are the documented behaviour.

## GUI steps — what this run actually observed

| §8 step | status | what was seen |
| --- | --- | --- |
| 1 build gate | MACHINE (earlier rounds) | `check:artifacts` → `OK: 1508 files`; unchanged this round (this branch adds evidence only) |
| 2 boot + team renders, Blueprint selectable | **PARTIAL** | app shell renders (`gui-01-app-shell.png`): sidebar 新会话 / 插件 / 工作区, composer with 选择工作区 + mode selector. **The team itself never rendered** — see the blocker below |
| 3 Leader tool surface visible in browser | **NOT COMPLETED** | needs a Leader session |
| 4 one grant performed from the UI | **NOT COMPLETED** | needs a Leader session |
| 5 read-back panel + a real member write attempt | **NOT COMPLETED** | needs a Leader session |
| 6 ACTIVE notification watched during a running turn | **NOT COMPLETED** | mock model lane was not running in this boot (below) |
| 7 IDLE no-wake observed | **NOT COMPLETED** | same |
| 8 negative reads | MACHINE (earlier rounds) | not re-run in GUI |
| 9 human sign-off | **HUMAN — NOT_RUN** | owner: human |

## Two environment findings this probe produced, both real, neither a product defect

1. **`boot.mjs --detach` does not survive the invoking command in this harness.** The supervisor was
   spawned and printed its world-materialization line, then died with its process group when the
   shell command returned: the port never listened and this run's `host-*.log` was **zero bytes**,
   while the identical foreground command booted in ~1.5 s. A lane or human following `LEGS.md`
   verbatim gets a silent non-boot. **Fix for the kit: run the host as a managed background job (or
   `setsid`), and have `boot.mjs --detach` verify the port is listening before printing success** —
   printing a launch line for a host that never bound is the same failure class we keep fixing:
   *a success message that was never conditioned on the thing succeeding.*
2. **The mock DeepSeek lane (`127.0.0.1:3491`) comes up only under that supervisor**, so a
   background-job host has no model oracle. Steps 3–7 need one (they drive a Leader/member turn),
   which is why this receipt stops at step 2 rather than faking the rest.

**Blocker for step 2 completion:** within a bounded probe (four UI interactions) I did not reach a
team-mode entry point — the composer's mode menu offers 标准/PTC/极简/创造 and no team entry, and
**the workspace picker lists host-home directories, not the acceptance world's materialized
workspace**. A human performing §8 knows the path; the coordinator's simulated pass does not, and
**"I could not find the button in four clicks" is recorded as NOT COMPLETED rather than as a defect
in the UI or a pass.** The next attempt should drive the team panel from the plugin's own entry
(插件 panel → dsh-agent-team) or via a pre-seeded session in the world template, and seed the world
workspace into the picker.

## Standing claim, unchanged by this receipt

Implementation progress ≠ implementation complete ≠ human acceptance ≠ stage closure. §7.7
**human** acceptance is `BLOCKED / NOT_RUN` with the human as owner; the trigger remains booting
`tests/homes/a4-accept-*` and walking §8 steps 2–9 with a dated receipt.
