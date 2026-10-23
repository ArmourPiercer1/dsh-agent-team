# w-pa-host-chain — M1 real-Host reference chain (member native `read` ask → approve → deny)

Task: drive the REAL production chain — the plugin's real `createTeamProductionRoot` +
real Control service + the real remote `team.resolveControl` presenter path (no factory
mocks, no unit-test substitutes) through three legs with a member's native `read` tool.

* **Worktree / branch**: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-m1-kernel` · `feat/a5-m1-center-kernel`
* **HEAD recorded at session start**: `8e16c954924c73d5b093bcf6a931f27b66259635`
  (expected `a64f7c680` — differed; recorded actual and CONTINUED per instruction.
  The M1 writer advanced the branch mid-session: `b18991865` (dist rebuild from a64f7c680),
  `00534fd89` (AUTH audit (e) — binding by bindingId FAMILY). No commits were made by this runner.)
* **Host**: `tests/deepseek-harness-test-use` pristine @ `639ed01539…` (0.2.0-rc.2, `tests/paths.mjs`)
  — `git status --porcelain` = **0 before AND after both runs** (`testuse-head-pre.txt`/`testuse-head-post.txt`).
* **DSH_HOME**: `tests/homes/pa-host-chain-pn-<stamp>` / `…-pl-<stamp>` (workspace-internal, removed at teardown; lock files beside).
* **Ports**: dynamically picked host `3181`, mock `3497` (3181–3186 / 3491–3500 family; `:3080`/`:3180` probed read-only pre/post, untouched).
* **Mount**: production `dsh-agent-team` row from `packages/runtime/dist/…/src/plugin/host.js`
  (+ `live/agent-bindings.mjs` glue + `root-binding/harness/seam.mjs`) via the public profile-patch seam only.

## Commands

```
node dev/agent-workflow/evidence/alpha5/w-pa-host-chain/run-pa-host-chain.mjs          # run-1 (plain row world)
node dev/agent-workflow/evidence/alpha5/w-pa-host-chain/run-pa-host-chain.mjs --plane  # run-2 (plane-fed world)
```

## Runs & verdicts

| run | world shape | verdict | dir |
|---|---|---|---|
| `live-2026-10-22T21-45-43` | plain row (no `teamToolPlane`) | **20/21 — L2.2 FAIL** (see FAILURE.md) | `runs/live-2026-10-22T21-45-43/` |
| `live-plane-2026-10-22T21-46-48` | `teamToolPlane` + C-FS `fsInstance` (read row at `read` takeover) | **PASS 21/21, exit 0** | `runs/live-plane-2026-10-22T21-46-48/` |

### The first real failure (run-1, captured verbatim before anything else) — FAILURE.md

L1 + the whole durable-control trio PASSED on the plain world; the member's read died at
the closed-world dispatch gate after the allow was consumed:

```
contentRows=0 reply=PAHC_MEMA_NO_CONTENT :: Error: team tool guard: the Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body) rowHead=
```

This is the GLUE-8 A4.4 landing that the natexe round registered (unattributed native
name → typed refusal, zero execution). The shipped executable shape is the plane-fed
world (team-tool-plane readName `read` takeover with placement-attributed Binding) —
run-2 is that world, and it is end-to-end green. No product source was edited to pass.

### Three-leg verdict (run-2, all PASS)

* **L1 ask-pending zero effect** — member delegation → scripted model `read` on fixture A
  (worker `permissions.default: ask`, no allow subtree) → durable
  `control-request-recorded` (`kind=leader-approval`, `toolName=read`,
  `correlation=call-pahc-ysiwr8wi`, `executionCoupling=guarded`, `approvalCaseId=case-…`,
  `summary="read <ABSOLUTE_PATH>"`), PENDING (0 decisions, 0 consumptions), carried by the
  leader-facing `team_list_pending_control` row; the read had NOT executed (0 content rows,
  fixture CONTENT token in ZERO model-request bodies).
* **L2 real approve, one read** — ALLOW over `POST /team-remote/team.resolveControl` (v4,
  cookie transport exactly as the prior-art kit) → closed success envelope
  (`decision=allow`, `decider={kind:'human'}`); member tool row returned the fixture
  CONTENT, exactly ONE tool row (rowHead `<path>…pahc-fixture-a-….txt</path><type>file</type>`);
  durable trio on the remote ledger **and** local `storages/team_domain.json`:
  recorded ×1 → `control-decision-recorded`(allow, human) ×1 → `control-allow-consumed` ×1
  with the SAME callId (`scope.correlation=call-pahc-ysiwr8wi`).
* **L3 deny zero effect** — second `read` (fixture B) opened its OWN ask
  (`ctrl-11mxors1psdyv70k47sg60xj`), pending with zero effect; DENY over the same endpoint
  → refusal row verbatim `Error: the approval was denied`; fixture B CONTENT token appears
  in ZERO model-request bodies (ever); `control-decision-recorded`(deny) ×1; **0** consumption facts.

## Build-artifact sync note (recorded, not silent)

`packages/runtime/dist/…/src/plugin/live/pa-mount-registry.mjs` was **missing** from the
committed dist rebuild `b18991865` (only tsc runs under `pnpm -r run build`; `live/*.mjs`
land in dist by the writer's copy step), so the mounted production row failed to import
(`Cannot find module '…/pa-mount-registry.mjs'`). The runner synced that ONE file verbatim
from this HEAD's tracked source into dist (`cp src→dist`, untracked new file, kept for the
M1 writer to re-commit with their next dist build). This is build-output sync, NOT a product
source edit; both runs ran against the real built row.

## Evidence files

Per-run dirs contain: `run.log`, `summary.json`, `l0-surface.json`, `l1-evidence.json`,
`l1-pending-list.json`, `l2-resolve-envelope.json`, `l2-member-wire.json`, `l2-ledger.json`,
`l3-resolve-envelope.json`, `l3-refusal-row.txt`, `l3-member-wire.json`, `l3-ledger.json`,
`mock-transcript.json`, `api-transcript.json`, `instance(-captured).log`, ports/stable probes,
`testuse-head-{pre,post}.txt`; run-1 additionally `FAILURE.md`. Launch tokens redacted
throughout (`token=REDACTED-<sha8>`).
