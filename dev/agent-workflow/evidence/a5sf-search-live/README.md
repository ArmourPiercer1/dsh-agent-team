# a5sf-search-live — the live half of P2-03 / BL-16 (`grep`), the six-row search acceptance

**Status: the lane's ONE Host boot was spent on 2026-11-04T15:36–15:39Z and it
measured NOTHING. The cause is a DRIVER defect (a row set that was emitted but never
handed to the World), not a product finding. No row is PASS, no row is a product
verdict at all. `M-06`/`M-07` keep their grade and `V@B=no` unchanged — the matrix
was deliberately not touched, because promoting on this run would be a lie.**
`go-no-go.json` (current) refuses a retry: the ONE-ATTEMPT rule is spent and a
second boot needs the coordinator's explicit ruling. 2 of the pool's 3 `P2-04`
starts remain; this lane was allowed exactly 1.

- base: `origin/master` @ `a2c56fb8457a2729289a6d11ba975ac8eeb0c3a9`
- branch: `task/a5sf-search-live-20261104` (worktree `.worktrees/a5sf-search-live`)
- pinned host: `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
  (0.2.0-rc.2), porcelain empty at the gate
- CORE PATCH BUDGET = 0: nothing outside this branch's own files was modified; the
  product tree is byte-identical to `origin/master` (asserted by `dry-run.mjs`)

---

## 1. What this run proves, and what it does not

| | |
|---|---|
| **Proven host-free (0 boots)** | 98 assertions across three nets, all green: **45** `node:test` arms on the six judges (`tests/world-factory/a5sf-search-live.test.mjs`), **44** dry-run checks over the driver/row/product seam (`dry-run.mjs`), **9** mutation controls that each break the property a check guards and require that check to go RED (`negative-controls.mjs`). `--plan` additionally proves the four World rows are EMITTED — and the attempt is why the handoff, not the emission, is what the dry run now checks. |
| **NOT proven: the six live rows** | 0/6 measured. No Member was created, no realm was installed, no `rg` process ran, no fact was written to any sink. `run-record.json` records `overall=FAIL`, `6/6 FAIL` with `reason=DRIVER_ABORTED_AT_post-boot` — the **fail-closed** encoding: a Host was reached, so the abort may not be laundered into `NOT_REACHED`, and nothing may be read as a product verdict. |
| **NOT proven: the product composition surface the review named** | whether the live preset supplies a confined `subprocess` face to a Member realm. It does not (§5) — that is a reading of the product seams, not a measurement. |
| **Grade that follows** | `grep`/`glob` stay **`ENFORCE-PARTIAL`, `V@B=no`, `tested` unchanged**. The host-free half of BL-16 (merged at #583/#584) still stands on its own evidence (`evidence/a5sf-bl16-grep/`). This lane adds **no** live claim. |

## 2. The one attempt, exactly

```
15:36:59.674Z  boot sequence: 1 of 1 dedicated P2-04 start(s) (ledger boot rows=0)
15:36:59.674Z  grant materialised: grant-a5sf-search-a2c56fb8457a-b1 maxStarts=2 boundCommit=a2c56fb8...
15:36:59.704Z  candidate asserted: pin=639ed01539 host head=639ed01539 asserted=true
15:36:59.705Z  gate lease: intentRows=1 rowsBeforeIntent=0 rowsAfterIntent=1 remaining=1
15:36:59.751Z  rows: a5sf-search-realm,dsh-agent-team,p6t6-team-tools,preset-a5sf-search-base
15:36:59.752Z  home patch written: .../cordis.patch.yml sha256=edc4227e6a4e5250
15:37:06.133Z  mock started on 3493
15:37:18.920Z  BOOTED port=3183 (lease bootsSpent=1) log=.../instance-port3183.log
15:37:18.932Z  authenticated (token never recorded)
15:39:18.951Z  p6t6 health=false hostAlive=true
15:39:18.951Z  FAILURE at stage post-boot: the p6t6 harness route never answered: the World did not
               reach a usable Host
15:39:18.951Z  case live:search-row1..row6: FAIL {"reason":"DRIVER_ABORTED_AT_post-boot"}
15:39:19.042Z  RUN-SUMMARY suite=a5sf-search overall=FAIL cases=6 FAIL:6 worlds=none
```

The Host **was** reached (`dsh web` printed its URL, `hostAlive=true`), but the
`/__p6t6/health` probe never returned 200 within 120 s. The reason is in the
profile the Host actually booted:

```
attempt-1-composed-profile.patch.yml
  - insert: [u5-canary, u6-fs-probe-host]      # the World's base rows
  - config: session-log-deepseek disabled
  - config: plugin-package-inventory-deepseek disabled
```

**None of the four rows the driver built are in it.** The driver logged that it
built them (`rows: a5sf-search-realm,dsh-agent-team,p6t6-team-tools,preset-...`)
and `emitPatchLayer` returned the text, but the driver never pushed the row array
into the World it was about to boot:

```js
const { rows, config, paths } = rowsFor({ ... })   // ← rows emitted…
// …but `world.u6Fs.rows.push(...rows)` was missing
world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
```

`harness.boot` composes the profile from `world.u6Fs.rows`, so it composed the
bare World: no p6t6 route (hence the 404/hang), no Team row, no preset
declaration, no evidence row. **Why `--plan` was green**: `--plan` checks the
*emitted text* and the row identity; it never checked the handoff into the World.
That is the defect class, and it is now guarded host-free:

- `dry-run.mjs` check **"driver: the composed rows are GIVEN to the World (not
  only emitted)"** — requires `world.u6Fs.rows.push(...rows)` and requires it
  **before** `harness.boot(`;
- `negative-controls.mjs` control **"the dry run must notice rows that are
  emitted but NEVER given to the World"** — rewrites the line to `void rows`,
  requires the dry run to go RED on exactly that check, restores the bytes and
  verifies the sha256.

Full diagnosis, artifacts and budget state: `attempt-1-defect.json`.
Composition proof: `attempt-1-composed-profile.patch.yml`. Host console:
`attempt-1-instance.log` (one line: the URL).

### 2.1 The ledger after the attempt (honest, no rewrite)

`run-ledger.jsonl` = 1 `budget-intent` row (`plannedStarts: 1`) + 1 boot row.
`bootRows(1) === plannedStarts(1) − aborts(0)` — the invariant holds, and the row
is **not** an abort: a Host existed. Grant `grant-a5sf-search-a2c56fb8457a-b1`,
`maxStarts=2` (0 prior rows + 1 intent + 1 boot), bound to `a2c56fb8…`.
Pool item `P2-04 grep (BL-16)`: 3 allocated, **1 spent, 2 remaining** — the
remaining 2 are not this lane's to spend.

### 2.2 Cleanup (verified after the run)

- port 3183: released (`/dev/tcp` refused) — never 3080, never its home
- `tests/homes/u5a5sfsrch-20261104T15-36-59Z`: deleted
- orphan processes carrying the world/home path: `ps` scan → none
- previous evidence archived to `runs/2026-11-04T15-36-59-673Z/` by the driver's
  own archive step (append-only)

## 3. The six rows: what each one *would* measure, and that none was reached

Each judge is three-way (`PROVEN` / `REFUTED` / `NOT_REACHED`) and **may not PASS
on null inputs**. The clauses below are the ones the 45 oracle arms pin — they are
the specification the live run would have had to satisfy.

| # | Row / case id | Product-call-chain claim | Judge clauses |
|---|---|---|---|
| 1 | `live:search-row1-grep-in-lane-allowed` | a Member `grep` in the lane returns the match, and the sink carries **exactly one `allow` fact** on the **binding realm** (`method=spawn`, `decidedBy=ALLOW`, locator = the declared root) | match present, one process, exit 0, no base-service spawn, fact realm `member`, `toolBindingIdentity` recorded |
| 2 | `live:search-row2-grep-outside-ceiling-refused` | an out-of-ceiling `grep` is refused **before any process**, with **exactly one `deny`** (`IO_READ_DENIED`), no out-of-lane bytes, no child process | error names the refusal, `spawns=0`, one deny fact at the outside operand, no secret/needle bytes in the result, no inherited base spawn |
| 3 | `live:search-row3-grep-outside-restriction-refused` | inside the ceiling but outside the **binding restriction** → refused at admission, one deny fact | restriction denies the operand, effective lane stays `deny` (no widening), refusal before a process. **The acceptance preset cannot express this restriction** (§5.2) → the row is `UNSUPPORTED` for preset-expression while the composed face is still measured |
| 4 | `live:search-row4-cancelled-search-settles-cancelled` | a cancelled search settles **cancelled** — not success, not a fabricated empty result | delivered ⇒ error naming the abort; undelivered ⇒ only with `childTerminatedBySignal`; `noSuccessResult`, `noFabricatedEmptyResult`, `noHang` |
| 5 | `live:search-row5-invalid-pattern-is-error` | an invalid pattern is a **tool error**, never "no matches" | `processExitedTwo` (rg exit 2), error result, no "No matches found" |
| 6 | `live:search-row6-teardown-no-callable-shadow` | after Member stop no callable shadow remains; the sink carries no fact after the stop instant; disposal faults are classified | `noFactAfterStop` by **timestamp** (never a delta), post-stop dispatches refused, `classifyDisposeFaults` grammar |

`glob` (`M-07`) rides rows 1/2 as a pair (`glob-face.json` in a run that reached
them): in-lane list + one allow fact; out-of-lane refusal + one deny fact.

## 4. The negative control (must not be vacuous)

Before any Member exists, the **anchor leader** (no a5sf realm) greps the same
out-of-lane file through the same preset. It must **succeed and leak**; otherwise
row 2 proves nothing about confinement, only that the path does not exist. The
control is judged (`judgeNegativeControl`) and written to `negative-control.json`
in a run that reaches it. In this attempt the anchor was never prompted (the abort
preceded it), so the control is **unmeasured** too — and it is now a *precondition*
of the run, not an afterthought: the member branch is checked **after** the anchor
branch, so the anchor cannot be mistaken for the leader and turned into a second
team.

## 5. What the live preset does and does not supply (the review's named gap)

### 5.1 The preset supplies the *plugin*, not the *confinement*

`@deepseek-ai/dsh-tool-fs-search` declares `inject: ["tools","systemPrompt",
"subprocess"]` and calls `ctx.subprocess.spawn`. The acceptance preset
(`a5sf-search-base`) mounts that plugin and grants `expectedTools`. **It supplies
no confined `subprocess` service.** The confined face in this lane comes from the
**evidence row** (`a5sf-search-realm-provider-row.mjs`), whose `compiledFor()`
returns `subprocess: {effective, provider, realmId, bindingId, memberScope}` and
whose provider is `createConfinedProcessProvider(...)`. The product row
(`a5sf-realm-row.mjs`) only **forwards** that face when present:
`faces = Object.freeze({fs:'confined', subprocess: subprocess ?? null})`.

Therefore: **a World composed from the preset alone cannot give a Member a
confined search face.** `mountNativeToolModules` refuses a `subprocess`-consuming
module on a realm whose `subprocess` face is `null` with `SUBPROCESS_UNCONFINED_REALM`
(BL-17). This is a **composition-surface gap**, not a per-call bug: the shipped
product has no provider that constructs a confined subprocess face for a Member.
It is exactly the gap the external review named, and it is now stated in the
product's own terms rather than as a test-harness trick.

### 5.2 The binding restriction is not expressible by the preset (row 3)

A **binding** realm has an `fs` face only; there is no binding-scoped `subprocess`
face today (BL-17 §6.3(5) — `faces.subprocess` is `null` on binding realms, so the
native search module is refused there). The two-axis restriction for row 3 is
therefore authored in the **evidence row** as two lane inputs —
`MemberCeiling = restricted[allowRoot]` and `ToolRestriction = restricted[
restrictionReadAllow]` — and intersected with the **product algebra**
(`intersectPathRuleSets` / `matchLocator` from `member-io-policy/src/path-rules.ts`,
imported from `dist`, not re-implemented). The row is graded `UNSUPPORTED` for
**preset-expression** of the restriction, while the composed effective face is
measured. `judgeRow3` records
`presetExpressesBindingRestriction:false` + `presetLimit` so the gap cannot be
silently re-read as support.

`lane: the restriction INPUT flips the row-3 effective answer` is a control that
proves the row-3 premise is sensitive to the very input it claims to measure:
widening the restriction to the ceiling flips the effective decision from `deny`
to `allow`.

### 5.3 Where the live fact would land

`realm: 'member'`, `toolBindingIdentity: null` (defaults at
`subprocess.ts:763`), because the confined face is the Member-scope one. A
binding-realm fact is not producible today for search. That is why row 1 records
`factRealm` **and** `toolBindingIdentity` in its evidence rather than asserting the
binding realm: the assertion would be false, and asserting it falsely is the
failure mode this lane exists to prevent.

## 6. The gates, verbatim

Host-free, at `HEAD=a2c56fb8…`, `digest=5b2a5b7b…` (product tree; evidence dir
excluded):

```
DRY RUN GREEN — 44 checks, head=a2c56fb8457a2729289a6d11ba975ac8eeb0c3a9 digest=5b2a5b7bfa0f20fc41d90ee28238ae515d4a71e2f1a0b87f54fd228957eeb8e4
NEGATIVE CONTROLS GREEN — 9 controls, every guarded check went RED on the broken property and the bytes were restored
```

`go-no-go.mjs` **before** the boot (archived as `go-no-go.go-before-boot.{json,log}`):

```
PASS dry-run evidence exists and is green: {"checks":43,"failed":0}
PASS negative controls exist and are green: {"controls":8,"failed":0}
PASS the PRODUCT tree matches the one the dry run measured
PASS the product tree has no uncommitted modifications: (clean)
PASS branch is this lane's branch: task/a5sf-search-live-20261104
PASS ledger: every row parses and each boot row has its intent row
PASS ledger: an abort row names an existing intent
PASS ledger: each intent's plannedStarts equals its boot rows, net of declared aborts
PASS budget: at least ONE P2-04 start is still available: boots=3 spent=0 remaining=3
PASS boot pool allocates the three P2-04 starts (the ruling)
PASS the ONE-ATTEMPT rule: this lane has spent NO start yet
PASS pinned host tree is at the pinned commit and clean: {"hostHead":"639ed01539…","pin":"639ed01539…","porcelain":""}
GO — head=a2c56fb8457a2729289a6d11ba975ac8eeb0c3a9 digest=5b2a5b7b…
```

(That GO block was captured when the dry run had 43 checks and the controls 8;
the handoff defect found by the attempt added one check and one control — the
numbers in §6 are current, the GO text is quoted as it was. Re-running the gate
now is *by design* a refusal, below.)

`go-no-go.mjs` **after** the boot (`go-no-go.{json,log}`, current):

```
PASS budget: at least ONE P2-04 start is still available: boots=3 spent=1 remaining=2
REFUSE the ONE-ATTEMPT rule: this lane has spent NO start yet: the lane already holds 1 boot row(s): a retry needs a NEW coordinator ruling, not this script
NO-GO — 1 refusal(s); fix them before spending the lane's single boot
```

That refusal is the budget working, not a red net: the network is green, the
start is gone.

Also recorded by `dry-run.mjs`: the worktree's `packages/` tree is identical to
`origin/master`, and every emitted artifact the rows depend on
(`team-services/src/subprocess.js`, `install.js`, `a5sf-realm-row.mjs`,
`member-io-policy/src/path-rules.js`) is **newer** than the last commit that
touched its source — so the boot would have measured the current product, not
yesterday's. Product-seam reads asserted at the same time: the `rg`-only static
allow-list, the admission order (`programAttributionRefusal` →
``readIntentsOf`` → ``programWriteLaneRefusal`` → per-intent
`await guard('spawn')` → provider call), `realm: options.realm ?? 'member'`, the
realm row forwarding an **optional** face, and the BL-17 typed refusal.

## 7. Files

| file | what it is |
|---|---|
| `run-boot.mjs` | the driver (`--plan` host-free; boot mode is the one shot). Fixed handoff + the archive/ledger/grant/teardown machinery. |
| `a5sf-search-realm-provider-row.mjs` | the evidence row: composes ceiling ∩ restriction with the product algebra, `compiledFor()` returns the confined `subprocess` face, counts installs/spawns at the prototype boundary. |
| `dry-run.mjs` | 44 host-free checks over driver, row, product seam, premises, dist provenance, budget 0. |
| `negative-controls.mjs` | 9 mutation controls: break the property, require the check RED, restore bytes, verify sha256 (incl. restoring the committed dry-run artifacts the mutated runs overwrite). |
| `go-no-go.mjs` | the boot authorisation gate (dry run, controls, digest, clean tree, branch, ledger invariant, pool, one-attempt, pinned host). |
| `attempt-1-defect.json` | the spent attempt: defect, proof, ledger, cleanup, budget. |
| `attempt-1-composed-profile.patch.yml` | the profile the Host actually booted: the proving artifact that the four rows were absent. |
| `attempt-1-instance.log` | the Host console: the URL and nothing else. |
| `run.log`, `run-record.json`, `run-ledger.jsonl`, `grant.json` | the append-only run log, the 6/6 FAIL record, the budget ledger, the grant. |
| `oracle-samples.json` | the samples handed to the judges (empty fact/process sets in this attempt). |
| `negative-controls.{json,log}`, `dry-run.{json,log}`, `plan.log`, `go-no-go*.{json,log}` | machine-readable gate output for review. |
| `logs/…`, `runs/…` | per-world console/profile and the previous-run archive. |

Re-run host-free: `node dev/agent-workflow/evidence/a5sf-search-live/dry-run.mjs &&
node dev/agent-workflow/evidence/a5sf-search-live/negative-controls.mjs`. The boot
mode is gated: `go-no-go.mjs` must print `GO`, and only a new ruling can make it
do that for this lane.

## 8. What is NOT proven (complete list)

1. **All six live rows** — unmeasured; no live claim, no grade change.
2. **The negative control** — unmeasured (the abort preceded it).
3. **The fact realm for search** — would be `member` with
   `toolBindingIdentity:null`; a binding-realm fact is not producible today
   (§5.1/§5.3). Recorded as a gap, not asserted as a pass.
4. **Preset-expression of the two-axis restriction** — `UNSUPPORTED` (§5.2).
5. **Cancellation semantics** — the FIFO window is proven to exist for the
   *packaged* `rg` (a regular file exits 1, the FIFO blocks), but whether the
   shipped `/api/session/cancel` lands after spawn and before exit, and whether
   the abort settles as an observable cancelled result or as an absent result
   with only child-signal evidence, is exactly what row 4 would have measured.
6. **`>cap` result clipping, streaming mid-read cancellation, atomic
   replace/version conflict** — not in scope here and untouched.
7. **Anything about `glob` beyond the judge parity with `grep`** — M-07's live
   half is equally unmeasured.

## 9. The one thing I am least sure about

Whether an authorised retry of this exact driver would get all the way to six
judged rows. The composition steps it would exercise for the first time are the
ones that never ran: the evidence row's `apply` (which creates the confined
provider and writes the lane report), the Team row's Member realm install with a
`subprocess`-consuming native module, and the leader's delegate prompt reaching
the member. Every one of those is a place where a *second* driver defect of the
same class (mechanism wired host-free, handoff not) could still be hiding — the
`--plan` and dry-run nets check the emitted text and the seam, and this attempt
proved that "emitted" is not the same as "given to the World".
