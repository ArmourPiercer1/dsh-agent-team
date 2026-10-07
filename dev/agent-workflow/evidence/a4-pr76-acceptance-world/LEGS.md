# A4-PR76 acceptance world — per-leg plan & MACHINE run results

> **SIMULATED / MACHINE acceptance — NOT the human pass.**
> Everything below labeled PASS was machine-verified against a booted host
> (pristine test runtime + real plugin dist) with the repo harness **mock
> DeepSeek lane** as the only model oracle (no model credentials exist in
> this environment). The Alpha.4 **human** acceptance remains
> **BLOCKED / NOT_RUN** (`docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md` §7.7) —
> the browser checklist below (§8 steps 2–9 as a human performs them) is that
> acceptance and stays with the human/coordinator. Nothing in this directory
> may be read as the human pass.

Subject of acceptance: the Alpha.3 nine-step permission-surface checklist,
`dev/agent-workflow/evidence/alpha3-pr5-notification-projection/ALPHA3-PERMISSIONS-USER-FACING.md`
§8 (`:193`–`:240`), driven through the A4-PR76 acceptance world.

## The world (what the coordinator drives in the browser)

| item | value |
| --- | --- |
| DSH_HOME (world) | `/home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-accept-20261007T16-57-26Z` (gitignored, workspace-internal per TEST_METHODS §5/§7) |
| runtime | pristine `tests/deepseek-harness-test-use` @ `639ed01539` (0.2.0-rc.2, porcelain clean before and after every run) |
| plugin row source | `file:///home/user/dsh-plugins/dsh-agent-team/packages/runtime/dist/packages/runtime/src/plugin/host.js` — **main-checkout committed dist on master** (`git rev-parse HEAD` = `991348e0`), never a worktree dist |
| row config | derived from current code (`packages/runtime/src/plugin/types.ts` `TeamPluginConfig` + `host.ts:596` `validateTeamPluginConfig`), NOT the 2026-09-30 f15 example. Measured fact: **no envelope/authority field exists in the row config** — the Alpha.4 envelopes are carriers of the bound **v3 Blueprint document** (domain `validate.ts:1335-1337` requires BOTH `permissionMutationEnvelope` and `teamHardEnvelope` at `schemaVersion: 3`) |
| team Blueprint | `world-template/blueprints/a4-accept-team.yaml` — v3, `a4.accept.team`, **non-empty** envelope: one file rule `write / subtree grants / maximumEffect allow` in BOTH carriers; leader selects all 15 `team_*` tools (incl. `team_grant_permission` + `team_revoke_permission`); worker template has EMPTY permission lanes (so any granted rule is an observable RISE covered by the envelope); full governance `teamEnvelope`; quotas sized for repeated runs (32/28 — quota counts committed instances incl. ARCHIVED, `activation/checks.ts:470`); NO shell rules anywhere (Alpha.4 ships no Human Admin resolver — see Findings F5) |
| boot | `node boot.mjs --detach --model-delay-ms 4000` (idempotent; refuses a port 3180 it does not own; probes :3080 before/after into `<world>/accept-probe.log`; launch line printed, token also in `<world>/.accept-launch.json`) |
| teardown | `node boot.mjs --stop` — never leave this host running; supervisor + mock die with it |

## Per-leg classification (checklist §8 step → how it is covered)

| step | classification | machine witness (executed 2026-10-07) | GUI / human part |
| --- | --- | --- | --- |
| 1 build gate | **MACHINE** | worktree `pnpm run check:artifacts` → `OK: 1508 files` (baseline, unchanged — this branch adds evidence only, zero product/test files); whole-repo `pnpm test` failing-identity set identical to baseline (receipt pointer below) | — |
| 2 boot + team from envelope-carrying v3 Blueprint | **MACHINE PASS** | bare `/`→401, `/?token=`→303+cookie, health ready/15 tools, catalog lists both blueprints `migrationState=current`, `catalog.get` document `schemaVersion:3`, `team.create` v2 ok. Non-emptiness of the envelope is proven **behaviorally** by step 4 (an expansion above the member's static deny-lane commits ONLY under envelope coverage) + the v3 validator boot-gate | open the launch URL; confirm the team renders in the UI and the Blueprint is selectable |
| 3 tool surface | **MACHINE PASS (half) / GUI (half)** | `team_grant_permission`+`team_revoke_permission` route to production on the Leader (typed `TEAM_TOOL_BAD_ARGUMENTS` on bad args = registered); catalog control `team_definitely_not_a_tool` → `UNKNOWN_TOOL`; on a MEMBER child `team_grant_permission` → `UNKNOWN_TOOL` (Blueprint template filter is live) | Leader session's visible tool list shows the two permission tools in the browser |
| 4 WRITE leg | **MACHINE PASS** | Leader `team_grant_permission` exact file → `changed:true`; identical replay → `changed:false reason:no-change`; operator-side remote `override.mutatePermission` **v7** (`actor:{kind:'human'}`) → `changed:true` | perform one grant from the UI as the human |
| 5 READ leg | **MACHINE PASS** | remote `override.getPermission` v7: `authority.present:true`, server-canonicalized absolute rule path, `history` generations ascending `[1,2]`. NOTE (per checklist): this is overlay+history ONLY — the effective permission OUTCOME must be confirmed by safely attempting the operation | read-back panel + an actual write attempt by the member |
| 6 ACTIVE notification | **MACHINE PASS (SIMULATED lane)** | async delegate puts the member RUNNING (mock 4 s turn) → CHANGING grant inside the window → exactly **one** model-visible `[team-perm-changed team=… instance=… generation=…]` message in the member's next model request (full mock capture, counted in `messages[]` only, spec header, **no rule bodies**); member not restarted (same instanceId/child session). 0 is also legitimate best-effort (driver reports it as such) | watch the member session in the browser during a running turn |
| 7 IDLE no-wake | **MACHINE PASS** | idle window ≥ 2×model-delay: CHANGING grant + revoke → both `changed:true`; mock request count **unchanged (4→4)**, zero notifications; WRITE committed (history gens grew to 5) | confirm no new member activity appears in the UI |
| 8 negative reads | **MACHINE PASS** | foreign teamSessionId → `TEAM_REMOTE_FOREIGN_TEAM`; current team + grammar-valid ghost instance → `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN` (not an empty view); contract v6 call → `method-version-unsupported`. Disclosed (F4): a GRAMMAR-INVALID id answers `RECORD_INVALID` at the param gate, before the lifecycle read | — |
| 9 lifecycle audit | **MACHINE PASS** | archive → `to:ARCHIVED`, history still readable ascending `[1..5]`; fresh member → `authority.present:false`, `history.entries:0` (no inheritance) | archive in the UI; open a fresh member's permission view |

**BLOCKED (named missing input):** the *real-model* dimension of steps 4–7.
There are no `DEEPSEEK_*` credentials in this environment; agent turns run
only through the repo harness mock oracle
(`packages/tools/harness/mock-deepseek.mjs` — the same lane the pr-f/pr-e
real-host kits use, per their evidence). This is disclosed, never simulated
as a pass: the mock lane is stated in every PASS note above.

## How to reproduce

```bash
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr76/dev/agent-workflow/evidence/a4-pr76-acceptance-world
node boot.mjs --detach --model-delay-ms 4000   # prints the launch line (token)
node driver.mjs                                # MACHINE legs; raw receipts under receipts/
node boot.mjs --stop                           # ALWAYS tear down
```

Receipts: `receipts/driver-run-20261007T171559.log` (first full pass),
`receipts/driver-run-20261007T171846.log` (canonical, after boot env
hardening) — both 8/8 PASS; `receipts/accept-probe.log` (stable :3080 GET
before/after: `401`/`401`, instance untouched). Raw model captures
(`[team-perm-changed]` evidence) live in `<world>/logs/mock-req-*.json`
(gitignored — they carry absolute paths; receipts cite matched excerpts only).

## Findings (recorded, NOT worked around)

- **F1 — frozen-row schemaVersion conflation (latent product defect).** For
  `origin:frozen` entries, `catalog.list` reports the storage L3 row stamp
  (`TEAM_DOMAIN_SCHEMA_VERSION = 2`: `packages/storage/schema/blueprint-registry.ts:106`,
  `packages/storage/schema/stores.ts:61`) while
  `packages/runtime/src/plugin/blueprint-authority.ts:466-475` consumes that
  field as the Blueprint **document** version. Live reproduction in both
  receipts: `a4.accept.team` (frozen at boot) lists `schemaVersion:2`,
  `a4.accept.anchor` (saved) lists `3`, `catalog.get` document truth = `3`.
  Today benign (2 ∈ SUPPORTED ⇒ `current`); after the A4-PR7 7.3 flip
  (SUPPORTED=`[3]`, RETIRED=`[1,2]`) every frozen row would misclassify as
  `migration-required` and be refused at the start/freeze boundaries. This
  world reproduces it on demand.
- **F2 — coverage-gate boot dependency.** Strict-permission (Alpha.3) boot
  passes the A2C-2 coverage gate ONLY with the live-surface remainder denied
  via `builtinToolDeny` (exec kit convention, `tests/kits/exec-contract-live-smoke/blueprint.mjs`).
  This world bakes the 19 names **discovered on this host build** (error
  `alpha2-permission-coverage-unmanaged-tools`, logged 2026-10-07T17:06). If
  the host surface drifts, boot fails loudly — recovery: copy the names from
  the error into `builtinToolDeny` in `world-template/blueprints/a4-accept-team.yaml`.
- **F3 — envelope carriers live in the Blueprint, not the row config.** The
  task premise ("row config carries `teamHardEnvelope`") does not match the
  code: `TeamPluginConfig` has no envelope field (measured:
  `packages/runtime/src/plugin/types.ts:180-290`); both envelopes are v3
  Blueprint-document required fields. The world follows the code.
- **F4 — malformed instance-id grammar answers `RECORD_INVALID` before the
  lifecycle read.** The checklist's "unknown/ghost id ⇒
  `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN`" holds for grammar-valid ghost ids
  (measured); grammar-INVALID ids get `RECORD_INVALID` — still a typed
  refusal, never an empty view. Disclosed so the human isn't surprised.
- **F5 — no Human Admin resolver (given, re-confirmed).**
  `packages/runtime/src/plugin/root.ts:3745`
  (`resolverExists: input.reviewAuthority !== 'human-admin'`, ADR A1-3): a
  declared shell rule below `allow` would close as authority-unavailable, so
  the world declares NO shell rules anywhere. Shell-class permission surface
  is out of acceptance scope for this world by design.
- **F6 — client ignores `migrationState` (given, re-confirmed).**
  `packages/client/src/model/team-intent-model.ts:134-159` reads only
  `blueprintId`/`revisions`. Post-7.3, a migration-required Blueprint would
  still render as selectable until a typed refusal hits. (With F1, this
  currently masks/misstates the frozen-row truth in the UI direction too.)

## Four facts, kept separate

1. **A4-PR7 merged:** yes (master `991348e0`, PR #107 era merge line) — product
   surface on master.
2. **Implementation merged:** the permission-surface implementation this
   checklist targets is on master (the world boots it from committed dist).
3. **Human acceptance:** **NOT_RUN / BLOCKED** — owner: coordinator/human;
   trigger: browser pass over this world (§8 steps 2–9 as GUI rows above);
   blocker: a human at a browser is required; this artifact only makes it
   one-command reproducible.
4. **Stage closure:** pending — per the checklist's stage-completion rule it
   follows the human acceptance, not this artifact.
