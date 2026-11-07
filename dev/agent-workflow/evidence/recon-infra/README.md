# RECON-INFRA — D1 (dev-live slot leak + cross-namespace stale judgement) and E1 (capability default)

**Task** `task/recon-infra-20261113` · base `origin/master` = `743955e4ab81e15736727d6cf4d68b7d3b47843a` ·
date 2026-11-08 (workspace clock) · **0 Host boots, 0 ports bound, 0 DSH_HOME created**.

**Record class: host-free only.** Every check below is C1/static. No `DEV-LIVE` or `CANDIDATE-C2`
claim is made; this README is not merge evidence and carries no `V@B`.

Scope was deliberately two findings: D1 (dev-live slot accounting) and E1 (capability default).
No `packages/**` file was added or modified; `CORE PATCH BUDGET = 0`; Q7 / Authority / Required CI /
matrix grades / `V@B` are untouched. `p4t6` delta = **0** (no new files under `packages/**`).

---

## D1 — the dev-live slot leak, and the three pre-boot refusals

### What the recon round saw

`dev/agent-workflow/evidence/a5sf-recon-external/README.md` D1/D2 and its `driver.log` record
**7 real Host starts plus 3 pre-boot refusals** (16:02:44Z, 16:04:20Z, 16:06:57Z). The stock
`a5sf-live-member` driver ended every boot with:

```js
try { lease.release?.() } catch { /* slot cleanup */ }
```

but the lease returned by `preRegisterDevLiveBudget` exposes `releaseSlot()` / `finish()` — there is
no `release`. Optional chaining made the call a **silent no-op**, so every successful boot leaked
one machine-wide dev-Host slot until the runner process exited.

### Root cause: two mechanisms, not one

The three refusals are **not all the leak**. Matched against the slot listings in the logs:

| time (UTC) | refusal | cause |
| --- | --- | --- |
| 16:02:44 | `DEV_LIVE_SLOT_REQUIRED` | **cross-namespace sweep race**: a peer's acquire judged our slot dead (`pidAlive(3)` → `ESRCH` in the peer's namespace) and unlinked it between our acquire and the harness's `assertDevLiveSlotHeld` |
| 16:04:20 | `DEV_LIVE_LIMIT_REACHED` | **D1 leak**: the listing is `#0 run=a5sf-live-member…` + `#1 run=a5sf-recon-external…` — the second is *the same lane's own finished boot1*, still held because `release?.()` did nothing. At the then-limit 2, our own leaked slot refused our own boot2 |
| 16:06:57 | `DEV_LIVE_SLOT_REQUIRED` | **cross-namespace sweep race**, same as 16:02:44 |

So: **1 of 3 = D1 leak; 2 of 3 = a separate sweep/race defect.** The leak is the reason a *single
lane* can refuse its own next boot; the sweep is the reason a *live* peer loses its slot. Both are
fixed here. The recon README called the runner "并发 lane 竞争"; the slot files explain it: every
lane recorded `pid: 3` / `pid: 5` because each agent process lives in its **own PID namespace**, and
`pidAlive(n)` from a peer probes *its own* namespace's `n`, not the owner's. This also has a
false-alive direction (a ghost slot counted as live until the 4 h TTL), which is why the fix records
namespace identity rather than only tightening the dead branch.

Live slot files present in the shared root while this task ran (both `pid: 3`, two different live
processes) are the direct artifact of that assumption:
`.artifacts/tmp/port-leases/dev-live-hosts/{0,1}.json` (run ids `a5sf-recon-web-…`,
`a5sf-live-member-…`).

### Fix

1. **`run-boot.mjs` releases through the real API, after teardown, in `finally`.**
   The slot represents a LIVE Host, so it is now returned **after** `world.teardown(...)` (the old
   code released before teardown, which also under-counted the slot during teardown). The call is
   `settleDevLiveLease(lease)`.
2. **A leak cannot be silent.** `settleDevLiveLease` (one place, `lib/dev-live-slots.mjs`):
   - refuses a lease with no `releaseSlot()` — **`DEV_LIVE_SLOT_API_MISSING`** — instead of treating
     a missing method as "nothing to do" (the historical bug becomes a typed error, and the error
     names the bare `release()` trap);
   - refuses a lease that still reports `holdsSlot() === true` after releasing —
     **`DEV_LIVE_SLOT_LEAKED`**.
   The driver's `finally` logs `dev-live slot released (released=… held=…)` on success, and turns a
   settle failure into a failed boot (`abortStage = 'slot-release'`).
3. **Cross-namespace stale judgement** (`lib/dev-live-slots.mjs`):
   - each slot records `pidNs` = `/proc/self/ns/pid` at acquire;
   - liveness is now tri-state: `dead` (same namespace, signal-0 false), `alive` (same namespace,
     signal-0 true), `unknown` (**another namespace, or a legacy file with no `pidNs`**);
   - `unknown` is **never** treated as dead immediately: the slot is left alone until
     `CROSS_NAMESPACE_GRACE_MS` (5 min), and deletion is guarded by a **token re-read** — if the
     on-disk token changed since the scan, the file belongs to a peer and is not unlinked;
   - a live owner keeps its slot fresh by **heartbeat** (`slot.touch()` every
     `DEV_LIVE_SLOT_HEARTBEAT_MS` = 30 s, started/stopped by the lease), so a running cross-namespace
     boot never ages past the grace window while a crashed one does;
   - same-namespace crash recovery stays immediate (unchanged behaviour);
   - the 4 h TTL remains the last-resort valve.

### Regression tests (`tests/world-factory/a5sf-dev-live-slots.test.mjs`, host-free)

| arm | pins |
| --- | --- |
| `(d1-pin)` | the exact old `lease.release?.()` call leaves `holdsSlot()===true` and the counter at 1 — the failure mode, kept executable |
| `(d1-regression)` | boot → settle → the counter is 0; with `limit-1` other hosts held, the **next boot is admitted** as the last slot (old code refused it `DEV_LIVE_LIMIT_REACHED`) |
| `(d1-old-path-control)` | the historical cleanup + `limit-1` hosts still refuses the next boot — the 16:04:20Z consequence, documented forever |
| `(d1-fail-loud)` | missing `releaseSlot` → `DEV_LIVE_SLOT_API_MISSING`; a release that leaves the slot held → `DEV_LIVE_SLOT_LEAKED` |
| `(d1-wiring)` | `run-boot.mjs` imports `settleDevLiveLease`, calls it, and contains no `lease.release?.()` code |
| `(ns-unknown)` | a foreign-namespace slot is `unknown`, counted, and **not** stolen while young |
| `(ns-legacy)` | a legacy file without `pidNs` is unjudgeable, then reclaimed after the grace |
| `(ns-token)` | a peer that re-acquires the same slot is **never** unlinked by a stale scan (token re-read) |
| `(ns-heartbeat)` | `touch()` pulls a cross-namespace slot back out of the grace window |

Run output: `host-free-slot-tests.log` (9/9 pass). The pre-fix RED is preserved executably by
`(d1-old-path-control)` and `(d1-pin)`; the fix's admission arm is `(d1-regression)`.

`tests/world-factory/a5sf-dev-live.test.mjs` was updated in one place only: its dead-pid crash
recovery case now writes a slot **with the current `pidNs`**, so "dead in our own namespace ⇒
immediate reclaim" is still asserted for the new format (a bare legacy pid is deliberately
unjudgeable now). It passes unchanged otherwise (`host-free-dev-live-gate.log`).

---

## E1 — the capability default: contract, not defect

### Ruling: **design-as-documented** (`capabilities` absent = legacy mode = full team tool catalog)

Evidence, in authority order:

1. `packages/domain/blueprint/src/types.ts` — `capabilities`: *"Per-template capability policy
   (absent = legacy mode, no restrictions)."*
2. `packages/domain/blueprint/src/validate.ts` — *"Optional capabilities block (absent = legacy
   mode)"*; the parser leaves the key absent instead of synthesizing an empty block.
3. `packages/domain/policy/src/static-capability-source.ts` — `staticCapabilitiesOf` returns
   `{ mode: 'legacy' }` for an absent block; `packages/runtime/src/plugin/live/agent-bindings.mjs`
   imports it (`:360`), resolves the bound template (`:2471`) and compiles the team-tool surface as
   `capabilities.mode === 'selective' ? selectTeamTools(catalog, …) : [...catalog]` (`:3024`).
4. `.agents/skills/team-blueprint-authoring/SKILL.md` §5 — *"Absent `capabilities` = legacy mode
   (rc.1 behavior, everything inherited)."*
5. The live driver's own shipped v4 blueprint comment already measured this:
   `run-boot.mjs` — *"NO `capabilities` block … the anchor Leader surface carries all 19 `team_*`
   names with no capabilities block"*.

The contract says **"未声明 = 全部"**, so the semantics were **not changed**. The gap was that the
authoring contract said "everything inherited" without ever spelling out that this includes
`team_delegate` / `team_grant_permission` / `team_revoke_permission`. Per the task rule, this is a
debt registration + documentation declaration:

- **Debt line**: `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` §4 ("Not on this
  list, deliberately") — a single bullet explaining why this is a documented compatibility default,
  not a PD row, and what changing it would break.
- **Documentation declaration**: `.agents/skills/team-blueprint-authoring/SKILL.md` §5 now states
  the full fifteen-tool surface, the explicit narrowing (`teamTools: {kind: deny}` / allow list), and
  the one sub-field that is **not** inherited (`mcp` = no initial grant, fail-closed).
- **Executable evidence**: `tests/world-factory/a5sf-capability-defaults.test.mjs` (host-free). It
  drives the real product modules from the committed glue — `parseBlueprint` →
  `staticCapabilitiesOf` → `selectTeamTools` with the real `createTeamTools({}).tools` — and prints:

```
E1-UNDECLARED-CAPABILITIES mode=legacy teamTools=15
E1-TEAM-TOOL-SURFACE team_list_members,team_list_templates,team_inspect_config,team_create_member,team_delegate,team_follow_up,team_collect,team_send_message,team_report_progress,team_request_control,team_resolve_control,team_list_pending_control,team_archive_member,team_grant_permission,team_revoke_permission
```

The same suite pins the contrast (explicit `teamTools: {kind: deny}` ⇒ 0 tools; explicit allow ⇒
exactly those tools), the MCP exception (`initialMcpGrantOf(legacy) === undefined`), and the contract
text itself (SKILL.md still says "everything inherited" **and** now names the fifteen tools; the
domain type still says "no restrictions"). If someone flips the default to fail-closed without
changing the contract, this suite reds.

### Migration surface if it HAD been a defect (not executed)

A fail-closed default would change every blueprint template that omits `capabilities` — including
the shipped v4 anchor/`run-boot` blueprints and the legacy rc.1 compatibility line — and would remove
`team_delegate` / `team_grant_permission` from those Members. That is a product-semantics + owner
decision, not a recon fix. The suite makes the cost of such a change visible instead of silent.

---

## Gates (all run from this worktree)

| gate | result | evidence |
| --- | --- | --- |
| a5sf family (`node --test tests/world-factory/a5sf-*.test.mjs`) | **543 tests, 539 pass, 0 fail, 4 skipped** | `host-free-a5sf-family.log` |
| `a5sf-dev-live.test.mjs` + new slot suite | pass (see logs) | `host-free-dev-live-gate.log`, `host-free-slot-tests.log` |
| `pnpm -r typecheck` | **all 9 projects Done** (after linking the worktree's `node_modules` to the shared install; see Reproduce) | `typecheck.log` |
| `pnpm lint` | **129 pre-existing errors, 0 from changed files** — `tests/**` is eslint-ignored, docs are not linted; no changed path appears in the report | `eslint-full.log` |
| `pnpm check:artifacts` | **OK, 1971 files, 104 glue placements**, index == tree | `artifacts-check.log` |
| `docs:sync --check` (real tree) | **findings=0 blocking=0**, 117 docs / 79 plans / 20 contract pairs | `docs-sync-check.log` |
| `docs:probe --base origin/master` | **blocking=0 non_blocking=0 advisories=0**, 20 contract pairs | `docs-probe.log` |
| `doc-consistency-controls` | **96 controls, 8 pre-existing FAILs** (POS fixtures still use the retired `current_contract` graph shape, so their clean fixtures emit 4 authority-mirror WARNs; no failure names a changed file). Same failures on a pristine `origin/master` — `scripts/doc-sync.mjs` / the controls are unmodified by this branch | `doc-controls.log` |
| register test (`registries.test.mjs`) | **pre-existing FAIL**: the suite pin predates `150-a5sf-read.mjs` (expected 15 suites, derived list has 16 incl. `a5sf-read`). Identical on `origin/master`: `git show origin/master:tests/world-factory/suites/150-a5sf-read.mjs` exists while `git show origin/master:tests/world-factory/registries.test.mjs` still pins the 15-entry list. Not touched by this branch (out of scope) | `registries-preexisting-red.log` |
| `ci-pr-gate --only state-freshness` | **pass** (`DSH-CI-VERDICT pass`, pointer both ways, round 58, contract ok) | `state-freshness.log` |

### Pre-existing reds, explicitly out of scope

Both are **environment/pin drift on the base commit, not caused by this branch**, and both are left
unfixed to keep the two-finding scope:

- `registries.test.mjs` — stale expected suite list (`a5sf-read` missing). Fixing it is not the
  one-line pin it looks like: the same file also hardcodes the `SUITE_CASES` key list, which the
  dynamic registry now derives with `a5sf-read` included. Two hand-maintained pins lag one shipped
  suite; `preexisting-reds.txt` carries the `git show origin/master:` proof that both the suite and
  the stale pins are on the base commit, and that this branch touches neither.
- `doc-consistency-controls.mjs` — 8 POS fixtures still declare the retired `current_contract` graph
  mirror (`preexisting-reds.txt` shows the fixture line on `origin/master`); the real tree's
  `docs:sync --check` is 0 findings.

## Reproduce (host-free)

```bash
cd .worktrees/recon-infra
# this fresh worktree has no deps/pinned host of its own; the sibling convention is symlinks:
ln -s /home/armourpiercer/projects/dsh-agent-team/node_modules node_modules
for p in client domain runtime testkit; do ln -s /home/armourpiercer/projects/dsh-agent-team/packages/$p/node_modules packages/$p/node_modules; done
ln -s ../../../tests/deepseek-harness-test-use tests/deepseek-harness-test-use   # pinned host stays read-only
node --test tests/world-factory/a5sf-dev-live-slots.test.mjs
node --test tests/world-factory/a5sf-capability-defaults.test.mjs
node --test tests/world-factory/a5sf-dev-live.test.mjs
node --test tests/world-factory/a5sf-*.test.mjs
node scripts/docs-sync.mjs --check
pnpm -r typecheck
pnpm check:artifacts
node scripts/ci-pr-gate.mjs --only state-freshness
```

No boot was started for this task; the recon lanes' live evidence is cited, not re-run.
