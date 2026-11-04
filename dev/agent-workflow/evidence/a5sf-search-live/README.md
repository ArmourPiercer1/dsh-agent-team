# a5sf-search-live — the live half of P2-03 / BL-16 (`grep`), the six-row search acceptance

**Status: 2 of the lane's 3 pooled `P2-04` starts are SPENT, and 0 of 6 rows are
judged. Both attempts died for reasons that are now named. No grade is promoted:
`M-06`/`M-07` keep `ENFORCE-PARTIAL`, `V@B=no`, and their `tested` value.**

| attempt | when | port | got to | died at |
|---|---|---|---|---|
| 1 | 15:36:59–15:39:18Z | 3183 | Host booted, authenticated, health never answered | **composition** — the driver emitted the four World rows but never gave them to the World |
| 2 | 15:56:53–16:00:00Z | 3182 | composition verified, health 200 in 3 s, surface 24 tools, negative control ran | **team-create** — the product's permission coverage gate refused `grep`/`glob` on the leader |

- base: `origin/master` @ `a2c56fb8457a2729289a6d11ba975ac8eeb0c3a9`
- branch: `task/a5sf-search-live-20261104`; draft PR #588
- pinned host: `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain empty at each gate
- CORE PATCH BUDGET = 0; `packages/` byte-identical to `origin/master` (asserted host-free)
- budget: `lane-ruling.json` authorises 2 starts, both with a named ruling; the driver and
  `go-no-go.mjs` both refuse a third, and `go-no-go.mjs` currently prints `NO-GO`

## 1. What is proven, and what is not

| | |
|---|---|
| **Proven host-free (0 boots)** | 45 `node:test` arms on the six judges (`tests/world-factory/a5sf-search-live.test.mjs`), 47 dry-run checks (`dry-run.mjs`), 9 mutation controls (`negative-controls.mjs`), plus the `--plan` handoff identity. All green at the commit this file lands on. |
| **Proven live (2 boots)** | The World **composition** now carries the rows it is given (attempt 2: `presentRowIds=[u5-canary, u6-fs-probe-host, a5sf-search-realm, dsh-agent-team, p6t6-team-tools, preset-a5sf-search-base]`, `missingRowIds=[]`), the p6t6 health route answers in 3 s, and the anchor preset exposes a **24-tool surface including `grep` and `glob`**. |
| **NOT proven: the six rows** | 0/6 judged. Attempt 2 recorded `6/6 FAIL, reason=DRIVER_ABORTED_AT_team-create` — the fail-closed encoding, not a product verdict. No Member, no realm install, no `rg` process, no fact. |
| **NOT proven: the negative control** | Attempt 2 **ran it and it REFUTED** (§4): the unconfined path could not launch ripgrep at all, so the control is vacuous until that is fixed. |
| **Grade that follows** | `grep`/`glob`: `ENFORCE-PARTIAL`, `V@B=no`, `tested` unchanged. The host-free half of BL-16 (`evidence/a5sf-bl16-grep/`) still stands on its own evidence. |

## 2. Attempt 1: a driver defect, and the net that now guards it

The Host booted and authenticated, then `p6t6 health=false hostAlive=true` after
the 120 s poll. The profile it booted from (`attempt-1-composed-profile.patch.yml`)
carried only the base rows. The driver had logged that it built the four rows and
`emitPatchLayer` returned their text, but it never pushed them into the World:
`harness.boot` composes `world.u6Fs.rows`, which was empty. `--plan` was green
because it judged the **emitted text**, not the **handoff**.

Fixed, and the class is guarded in three ways (all required by the retry ruling):

1. `handOverRows(world, rows)` is the single place the rows reach the World;
2. `--plan` runs that same function against a probe and writes `plan-rows.json`
   (`emittedRowIds` vs `worldRowIds`, ordered identity, health-probe row present);
3. `go-no-go.mjs` evaluates the artifact **and** re-reads the source for the call
   before `harness.boot(`, so a gate that cannot see the handoff cannot say GO.

A mutation control rewrites the call to `void rows` and requires the dry run to go
RED on exactly that check, then restores the bytes and verifies the sha256.

## 3. Attempt 2: composition verified, then the coverage gate

```
15:56:53.720Z  boot sequence: 2 of 2 authorised P2-04 start(s) (ledger boot rows=1; rulings:
               1x direct task instruction | 1x coordinator ruling, session-76eeddd5…)
15:56:53.720Z  grant materialised: grant-a5sf-search-098f445f51ee-b2 boundCommit=098f445f51ee…
15:56:55.361Z  mock started on 3491
15:56:58.699Z  composed profile: presentRowIds=[u5-canary,u6-fs-probe-host,a5sf-search-realm,
               dsh-agent-team,p6t6-team-tools,preset-a5sf-search-base] missingRowIds=[]
15:56:58.700Z  BOOTED port=3182
15:56:59.067Z  p6t6 health=true hostAlive=true
15:56:59.088Z  discovery prompt status=200
15:59:59.925Z  NEGATIVE CONTROL: verdict=REFUTED reason=NEGATIVE_CONTROL_CLAUSE_FAILED
               failed=["controlSucceeded","controlLeaked"]
15:59:59.926Z  model-visible surface (24): bash,edit,glob,grep,read,read_image,team_*…,write
16:00:00.021Z  team.create status=200 ok=false
               TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED: starting the root (leader) agent for
               'session-a5sf-acceptance-team' failed: permission coverage gate failed for
               instance 'inst-leader': 2 unmanaged tool(s) on the final model-facing surface:
               glob (known-sensitive-unmanaged), grep (known-sens…)
16:00:00.021Z  FAILURE at stage team-create (team.create must accept the main blueprint …)
16:00:00.115Z  RUN-SUMMARY overall=FAIL cases=6 FAIL:6 worlds=none
```

`stage-diagnosis.json` records the stage probe: `rows` (the four ids),
`composedProfile` (all present), `counter` (`base-spawn=2`, `confined-spawn=0`,
`install-*=0`), `laneReport` (present: the evidence row applied and computed the
two-axis lane), `member: null`, `mockRequests`, `memberTurnSeen: false`.

## 4. The two live findings

### F1 — the unconfined base `subprocess` cannot launch the packaged `rg` in a World

Negative control result, verbatim:

```
{"result":{"isError":true,"text":"Error: grep could not start its search command (ripgrep launch failed)"},
 "leakedTokens":[],"baseSpawns":2,"confinedSpawns":0,"guardFactsBeforeRealm":0}
```

The message is the search module's synchronous-catch text, i.e.
`ctx.subprocess.spawn({argv:[await resolveRgPath(), …]})` threw before returning a
handle. Host-free eliminations, all run at this commit:

- **not module resolution**: `import('@vscode/ripgrep')` resolves and returns the
  binary from the host-tree module path *and* from the pnpm package path;
- **not the Linux scope launch**: `probeLinuxScope()` is false here (`systemd-run
  --user --scope … → status 1, "Failed to connect to user scope bus via local
  transport: No data available"`), so `subprocess-local` selects the plain
  `spawnSubprocess` fallback, not `launchLinuxScope`.

So the throw is inside `validateSubprocessSpec` or `spawnSubprocess`, and the cause
object is not recoverable from this attempt: the module wraps it in a `SearchError`,
the harness printed only the message, and the World home (which would carry the
plugin's own log) is deleted by teardown. **This is not isolated** — it is recorded
as the top item for the next start.

**Why it matters:** the confined class delegates to the same base spawn. If the base
cannot launch `rg`, the Member's `grep` cannot either, so BL-16's live half is
blocked on this independently of any confinement question — and the negative control
that makes row 2 discriminating cannot run until it is fixed.

### F2 — the acceptance preset exposes `grep`/`glob` to the leader, where they are unmanaged

The native attach that makes `grep`/`glob` "managed" runs on a **Member** realm.
The leader is the root session and has no realm, so the same tools are
`known-sensitive-unmanaged` on its surface and the product's permission coverage
gate refuses `team.create`. That gate is behaving correctly; the composition is
wrong. The driver now denies `grep`/`glob` on the leader (`LEADER_MANAGED_TOOL_NAMES`)
while the Member still receives them through its realm. **Unvalidated**: it needs a
start, and none is authorised.

This is also the composition-surface answer the external review asked for, now
measured rather than read: the preset supplies the *plugin*, the evidence row
supplies the confined `subprocess` face, and the leader gets neither — so the
preset alone cannot produce a confined search on any agent.

## 5. Row 3, and the realm

Row 3 (a binding restriction narrower than the ceiling) stays **`UNSUPPORTED` for
preset-expression**. A binding realm has no `subprocess` face today (BL-17 refuses
the module with `SUBPROCESS_UNCONFINED_REALM`), so the two-axis restriction is
composed from lane inputs with the **product** algebra
(`intersectPathRuleSets`/`matchLocator` from `dist`) and `judgeRow3` records
`presetExpressesBindingRestriction:false` + `presetLimit`. The lane report in
attempt 2 shows the composition it would have used (ceiling = the workspace,
restriction = the in-lane subtree, effective = the intersection). The live fact
would be `realm='member'`, `toolBindingIdentity=null`; that stays a recorded gap,
never an asserted pass.

## 6. The budget, honestly

`lane-ruling.json` holds two named rulings (1 start: the original task; 1 start: the
coordinator's retry after the instrument defect). `run-ledger.jsonl` holds 2 intents
and 2 boot rows; the invariant `bootRows === plannedStarts − aborts` holds per run
(`1 = 1 − 0` twice). Pool item `P2-04 grep (BL-16)`: 3 allocated, **2 spent, 1
remaining — not this lane's**. `go-no-go.mjs` now prints:

```
PASS budget: this start is authorised by the rulings and is NOT a third:
     authorised=2 spent=2 — a further start needs a NEW ruling entry appended to
     lane-ruling.json, not an edit to authorisedStarts
REFUSE the same check when a third is asked  →  NO-GO
```

### The cost line the retry ruling asked for

**This vertical has spent 2 of 3 starts, and the composed-profile gap was invisible
to a green `--plan`.** The reusable lesson for every later live lane (P3-00
inventory will hit the same handoff): *a host-free gate must run the handoff, not
just render it* — emit-and-pray passes every text-level check. Concretely: the plan
artifact must compare the rows the runtime will actually compose against the rows
the patch text names, by identity and in order; and the boot must read the composed
profile before it waits on health.

Attempt 2's second lesson: **stage attribution earns its keep.** The generic
`post-boot` of attempt 1 became, in attempt 2, `composition` → verified in 3 s,
`team-create` → refused with the product's own error code, plus a probe that
records what the world looked like. Two starts bought two named handoffs, not two
"it didn't work".

## 7. Gates, verbatim (current)

```
DRY RUN GREEN — 47 checks, head=098f445f51eed45ff599f6d1067b3ce3203e9cb9 digest=24d3edfb…
NEGATIVE CONTROLS GREEN — 9 controls, every guarded check went RED on the broken property and the bytes were restored
```

`go-no-go.go-before-boot.json` (archived, attempt 1) and
`go-no-go.retry-go.json` (archived, attempt 2) are the two `GO` authorisations.
`go-no-go.json` (current) is the post-spend refusal. Both `GO`s are quoted in
`go-no-go.retry-go.log` / `go-no-go.go-before-boot.log`, including:

```
PASS handoff: the rows the World composes EQUAL the emitted rows, by identity and in order:
     {"emitted":["a5sf-search-realm","dsh-agent-team","p6t6-team-tools","preset-a5sf-search-base"],
      "world":["a5sf-search-realm","dsh-agent-team","p6t6-team-tools","preset-a5sf-search-base"],
      "identityHolds":true}
PASS handoff: the driver CALLS the handoff before harness.boot( (independent source read)
```

## 8. Files

| file | what it is |
|---|---|
| `run-boot.mjs` | the driver (`--plan` host-free; boot mode is the one shot). `handOverRows`, the ruling-based budget, the stage taxonomy, the composed-profile probe. |
| `a5sf-search-realm-provider-row.mjs` | the evidence row: composes ceiling ∩ restriction with the product algebra, `compiledFor()` returns the confined `subprocess` face, counts installs/spawns at the prototype boundary, writes the lane report. |
| `dry-run.mjs` | 47 host-free checks: driver, row, product seam, premises, dist provenance, handoff, budget 0. |
| `negative-controls.mjs` | 9 mutation controls (break the property, require RED, restore bytes, verify sha256, restore the committed dry-run artifacts the mutated runs overwrite). |
| `go-no-go.mjs` | the boot authorisation gate (dry run, controls, handoff identity, digest, clean tree, branch, ledger invariant, pool, ruling, pinned host). |
| `lane-ruling.json` | the two authorised starts, each with `by` + `reason`; the driver and the gate both read it. |
| `plan-rows.json` | the handoff proof: `emittedRowIds` vs `worldRowIds`, ordered identity, health-probe row. |
| `attempt-1-defect.json`, `attempt-1-composed-profile.patch.yml`, `attempt-1-instance.log` | the spent first attempt: defect, proof, host console. |
| `stage-diagnosis.json` | the attempt-2 stage probe (stage, rows, composed profile, counter legs, lane report, member state). |
| `run.log`, `run-record.json`, `run-ledger.jsonl`, `grant.json`, `negative-control.json` | append-only run log, the 6/6 FAIL record, the budget ledger, the grant, the control result. |
| `logs/…`, `runs/…` | per-world console/profile and the previous-run archive. |

Re-run host-free: `node dev/agent-workflow/evidence/a5sf-search-live/dry-run.mjs &&
node dev/agent-workflow/evidence/a5sf-search-live/negative-controls.mjs`. Boot mode
is gated by `go-no-go.mjs` and by `lane-ruling.json`.

## 9. What is NOT proven (complete list)

1. **All six live rows** — unmeasured.
2. **The negative control** — ran and REFUTED because of F1; it is vacuous until the
   base spawn can launch `rg`.
3. **F1's exact cause** — narrowed to `validateSubprocessSpec`/`spawnSubprocess`,
   not isolated.
4. **The leader-deny fix (F2)** — applied, unvalidated.
5. **The fact realm for search** — would be `member` with `toolBindingIdentity:null`.
6. **Preset-expression of the two-axis restriction** — `UNSUPPORTED`.
7. **Cancellation semantics** — the FIFO window is proven for the *packaged* `rg`,
   but the end-to-end timing is unmeasured.
8. **`>cap` clipping, streaming mid-read cancel, atomic replace/version conflict** —
   out of scope, untouched. **M-07 `glob`** — equally unmeasured.

## 10. The one handoff I would test next

If another start existed, I would not touch the blueprint or the rows: I would boot
the same composition and, **before** `team.create`, call `grep` from the anchor
leader again and capture the `SearchError.cause` on the host side — the plugin's own
error object, not the message — by adding a host-side log sink for the tool result
(the cause is what F1 needs, and it costs no new mechanism). In parallel, the
leader-deny fix (F2) is already in the tree, so `team.create` should reach the
member-install stage and the stage probe would then tell us whether the realm, the
dispatch, or the cancellation window breaks next.

## 11. F1 closed (host-free): the cause was our own counter, and F2's deny is verified

**F1 is found, reproduced and fixed without a Host start.** `f1-cause.mjs` drives the
real pinned `@deepseek-ai/dsh-tool-fs-search` module through the product tool seam
over the real pinned `subprocess-local` service and the real packaged `rg`
(`f1-cause.json`, `f1-cause.log`; RED run `f1-cause.red.log`).

**The cause.** `a5sf-search-realm-provider-row.mjs` wrapped the base spawn with

```js
return original.apply(this, spec)        // ← the whole of F1
```

`Function.prototype.apply` takes an **array-like argument list**. `spec` is an
object without a `length`, so the pinned service was called as `spawn(undefined)`,
`validateSubprocessSpec` read `spec.graceMs` (`subprocess-local/src/spawn.ts:165`)
and threw a **synchronous** `TypeError`. `search-core.ts`'s launch catch turns every
synchronous throw into its one text — `grep could not start its search command
(ripgrep launch failed)` — so the World reported a ripgrep launch failure for a
ripgrep that was present, executable and never started. The **same** wrapper broke
the `git rev-parse` spawn of `workspace-changes` (warned, never surfaced), which is
why the World ledger carries exactly two `base-spawn` rows and zero successful
unconfined searches: both rows are failures, not a successful git call plus a failed
rg call. The message was never about confinement, the spec shape, the session cwd or
the packaged binary — the negative control was broken by the instrument that was
supposed to observe it, and the leak it was supposed to prove could not happen.

Captured cause fields (mutation arm, verbatim):

```
name   TypeError
message Cannot read properties of undefined (reading 'graceMs')
at     validateSubprocessSpec (…/subprocess-local/lib/runner-launch-*.js)
surface Error: grep could not start its search command (ripgrep launch failed)
```

**The fix, at the right layer.** One line in the evidence row: `original.call(this,
spec)`. The pinned tree is untouched (`CORE PATCH BUDGET = 0`), and no product code
changed. The row now also records a `base-spawn-failed` row (cause fields + whether
`argv[0]` / the cwd existed) before rethrowing, so a launch failure can never again
be recorded as a successful spawn.

**Arms** (all in-process, no port, no `DSH_HOME`, no `tests/homes`):

| arm | what it measures | state |
| --- | --- | --- |
| `F1-SYNC-MATRIX` | which `spawn()` failures are synchronous (the message's whole cause surface) | measured |
| `F1-SPEC-REPLAY` | the World's recorded spec (`negative-control.json` verbatim) exits 0 and matches here | PASS |
| `F1-MUTATION` | the pre-fix `apply(this, spec)` reproduces F1's exact text + the TypeError (mutation control) | PASS |
| `F1-ROW-SPAWN` | **regression arm**: through the fixed row the same grep returns an `rg` match | RED before / GREEN after (`f1-cause.red.log`) |
| `F1-CAPTURE` | a synchronous launch failure now leaves an attributable `base-spawn-failed` row | PASS |

The arm that would have caught F1 without a boot is `F1-ROW-SPAWN` itself: it asserts
a real base spawn of the packaged `rg` **through the evidence row**, which is exactly
the composition the World ran. (`F1-CAPTURE` is the forward-looking half: had it
existed, the World's ledger would have carried the TypeError and the F1 row would
never have been misread as a product finding.) Note the boundary: a *synchronous*
launch failure is captured; an asynchronous one settles through `handle.done` and
surfaces as the module's distinct "provider failure" text.

**F2 verified host-free** (`f2-deny-unit.mjs`, `f2-deny.json`), against the REAL
`evaluatePermissionCoverage` gate and the World's **own recorded final surface**
(24 tools, from `run.log`):

1. with the leader deny computed exactly as the driver computes it
   (`[glob, grep, u5_canary, u6fs_probe]`), the gate returns `ok: true` on the 20
   remaining tools — `read/read_image/write/edit/bash` are managed vocabulary, the 15
   `team_*` names are managed Team tools;
2. **mutation control**: re-admitting `grep`/`glob` makes the gate refuse with exactly
   `glob (known-sensitive-unmanaged), grep (known-sensitive-unmanaged)`, and the
   reproduced typed detail continues the World's recorded refusal prefix character
   for character (the driver persisted that text truncated to 300 chars, so the
   comparison is on the surviving prefix);
3. the deny is **leader-only**: the Member preset still expects `['grep', 'glob']`
   from the search module, and the executed proof that a Member realm exposes and
   confines them is the BL-16 arm suite (`bl16-grep-arms.log`), unchanged and green.

**Gates this round** (all host-free): `f1-cause.mjs` 5/5, `f2-deny-unit.mjs` 4/4,
`dry-run.mjs` 47/47, `negative-controls.mjs` 9/9, world-factory `node --test`
(see `wf-suite.log`), `pnpm -r run typecheck` and
`tsc -p packages/runtime/tsconfig.json --noEmit` clean (the branch changes no `.ts`
source: the delta vs `origin/master` is evidence `.mjs`/`.json`/`.md` only),
`git diff --check origin/master...HEAD` rc=0.

**What is left for a judged row.** F1 no longer blocks the negative control: a boot
should now record a *successful* unconfined base spawn and the out-of-lane leak, and
`team.create` should clear the coverage gate (F2) and reach the member-install stage.
The next thing to test is therefore the **member-install / realm-dispatch stage** —
whether the Member's confined `grep` is served by the confined face (one
`confined-spawn` row, one deny fact for the out-of-lane operand, no secret bytes) —
followed by the cancellation window on the FIFO. The one instrumentation to add
before the next start is nothing new: `base-spawn-failed` now covers the F1 class, and
the ledger's `confined-spawn` rows already discriminate the confined face.
