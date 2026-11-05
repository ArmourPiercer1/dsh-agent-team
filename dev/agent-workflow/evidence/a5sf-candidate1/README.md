# CANDIDATE-1 — the frozen trial candidate, measured on its own tree

**What this directory is.** The live FS/Search regression run on the **frozen candidate tree**
`1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`, for **boot allocation #1 of 5** (owner-granted
2026-11-06, relayed by coordinator `session-76eeddd5-4e2e-472f-a3ba-750a70c8a374`). One Host
start, budget `1/5`, **0 aborts**, **0 retries**.

**Why it exists.** The matrix's `M-01`/`M-02`/`M-06`/`M-07` rows were `NEEDS_REVALIDATION` /
`ENFORCE-PARTIAL` with `V@B=no` because their live evidence was measured on trees that are not
the current baseline. This run removes the "stale tree" excuse the honest way: it freezes a
candidate, publishes an authority snapshot whose `baseline` **is** that candidate head, moves the
pointer, and then boots **at the baseline commit itself**.

---

## 1. The freeze (done before the start)

| Step | Command (exact) | Result |
|---|---|---|
| candidate tree | `git commit` on `task/a5sf-candidate1-20261106` | **`1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`** (driver + fs-binding provider row + ruling; no product change) |
| publish | `node scripts/publish-authority.mjs publish dev/.as20261105r2.draft.json --root .` | `as20261105r2`, `content_digest sha256:d28bdf46c8c7af2d8d5ede38a25333101634469ac1ee85e28756eeee69c9e4c0`, snapshot file bytes sha256 `5336a0e5…` (one line + LF) |
| resolver cross-check | `node scripts/authority-baseline-resolver.mjs --snapshot dev/engineering/authority-snapshots/as20261105r2.json --expected-digest sha256:d28bdf46…` | stdout `1484fa4ee0ff9326a3dafcac060bf63f8d334a1f` |
| pointer move | `node scripts/switch-authority.mjs switch --root . --snapshot-version as20261105r2 --expected-digest sha256:d28bdf46… --expect-pointer-digest sha256:2cba2673b82f44f8979b360eb9efc2a60e8723f7e6dacbaffee1fcd3b4b15c65` | `ok:true, switched:true, two_current_pending:false` |

Pointer bytes **before** (`authority-pointer-before.json`, committed here):

```
{"content_digest":"sha256:55ab435ff43df3674d9655bea4c00d4ea53e953c06b720ce0fbe50fd9ca8d098","snapshot_version":"as20261105r1"}
sha256 2cba2673b82f44f8979b360eb9efc2a60e8723f7e6dacbaffee1fcd3b4b15c65
```

Pointer bytes **after**:

```
{"content_digest":"sha256:d28bdf46c8c7af2d8d5ede38a25333101634469ac1ee85e28756eeee69c9e4c0","snapshot_version":"as20261105r2"}
sha256 31ac81fb4c4818b4eb09a61723b7c15a963114272bb9095b18b8e21e5fbc7f0a
```

The snapshot was published in commit `8f0540b3f`; the pointer moved in `d23054e1a`. **Rollback**
(recorded, not needed): `git revert d23054e1a`, then
`node scripts/switch-authority.mjs switch --root . --snapshot-version as20261105r1 --expected-digest sha256:55ab435ff43df3674d9655bea4c00d4ea53e953c06b720ce0fbe50fd9ca8d098 --expect-pointer-digest sha256:31ac81fb4c4818b4eb09a61723b7c15a963114272bb9095b18b8e21e5fbc7f0a`.
Published snapshots are never deleted; `as20261105r1` and `as20261105r2` both stay immutable.

**The direction of the freeze matters.** The boot ran **at `1484fa4ee` (detached)**, i.e. at the
tree the snapshot names as `baseline`. That tree predates the pointer-move commit *by design*: a
snapshot cannot name a commit that contains the snapshot. So the run's `bindings.authority`
observed the **old** generation (`as20261105r1`) and was re-stamped afterwards to the live one,
with the observation preserved verbatim — the same rule the `a5sf-search-live` import used.

## 2. The boot

| | |
|---|---|
| start | **1** (budget `1/5`); 0 aborts; 0 retries |
| ledger | `run-ledger.jsonl`: **1 `budget-intent` row + 1 boot row**, `plannedStarts: 1` ⇒ `bootRows (1) === plannedStarts (1) - aborts (0)` |
| port | **3184** (lease from the 3180 family; `:3080` never touched) |
| `DSH_HOME` | `tests/homes/u5a5sfc1-20261105T12-17-52Z` (inside the workspace; deleted at teardown) |
| grant | `grant.json` — `grantId grant-a5sf-candidate1-1484fa4ee0ff-b1`, `maxStarts 2`, `allocationItem "candidate-1 of 5: frozen-candidate FS/Search regression (M-01/M-02/M-06/M-07)"`, `boundCommit 1484fa4ee…` |
| composed rows | `u5-canary, u6-fs-probe-host, a5sf-candidate1-realm, dsh-agent-team, p6t6-team-tools, preset-a5sf-candidate1-base` (all present, none missing) |
| run record | `run-record.json` — `runId a5sf-candidate1-2026-11-05T12-17-52-246Z`, `suite a5sf-candidate1`, `teamSha 1484fa4ee…`, `hostSha 639ed015397290b3745d163aafe02ffee4aa3f84` |
| verdict | **`overall=FAIL`, `partial=false`** — 11 cases: **9 PASS, 2 FAIL** |

`run-record.json` carries `bindings.authority` = live `as20261105r2` (pointer bytes sha256
`31ac81fb…`) and `bindings.authorityObserved` = the generation the run actually saw
(`as20261105r1`, pointer bytes sha256 `2cba2673…`, snapshot digest `a60e707b…`), with
`authorityRestamped: true`. Measurements untouched.

## 3. The 11 rows, as judged

The FS rows are the frozen judges in `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`;
the Search rows are the frozen judges in `tests/world-factory/lib/a5sf-search-live.mjs`. Same
assertions as their accepted runs, no local re-wording.

| # | case | verdict | reason | numbers |
|---|---|---|---|---|
| 1 | search row1 — grep in lane | **PASS** | `IN_LANE_GREP_ALLOWED_AND_CONFINED` | 1 confined spawn, 0 base spawns, 1 allow fact, `confined-exit code=0` |
| 2 | search row2 — grep outside ceiling | **PASS** | `OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS` | 0 confined + 0 base spawns, 1 deny fact, no leaked bytes |
| 3 | search row3 — grep outside restriction | **FAIL** | `ROW3_CLAUSE_FAILED` | `exactlyOneDenyFact` false — **2** deny facts at this locator; 0/0 spawns, no leak |
| 4 | search row4 — cancel settles CANCELLED | **PASS** | `CANCELLED_SEARCH_ABORTED_WITH_KILLED_CHILD_NO_RESULT` | child terminated 143, no result |
| 5 | search row5 — invalid pattern | **PASS** | `INVALID_PATTERN_SURFACED_AS_TOOL_ERROR` | tool error, 1 fact, no no-match disguise |
| 6 | search row6 — archive boundary | **PASS** | `NO_USABLE_CALLABLE_SHADOW_AFTER_STOP` | post-stop 422, 0 facts, 0 spawns; home deleted, port released, no orphan |
| 7 | FS row1 — read A (both lanes allow) | **PASS** | `READ_A_ALLOWED_AND_CONFINED` | 2 binding-realm allow facts, 1 confined provider read |
| 8 | FS row2 — read B (ceiling allow, restriction deny) | **FAIL** | `ROW2_CLAUSE_FAILED` | `everyReadPathFactOnBindingLane` false: 2 read-path facts (`stat` binding deny + `spawn` member deny), both **deny**; `bindingDenyOnReadPath`, `everyReadPathConsultationDenied`, `noProviderRead`, `noClaimLeak`, `typedLaneRefusal` all true |
| 9 | FS row3 — read C (ceiling deny, restriction allow) | **PASS** | `REFUSED_WITHOUT_WIDENING` | exactly 1 binding deny, ceiling deny / restriction allow / effective deny, 0 provider reads |
| 10 | FS row4a — write in-lane readable | **PASS** | `CEILING_WRITE_IN_LANE_READABLE` | disk equals the written bytes, 1 write-ALLOW fact on the **ceiling** realm, 1 confined provider write |
| 11 | FS row4b — write B (read not implied) | **PASS** | `CEILING_WRITE_ALLOWED_READ_NOT_IMPLIED` | guard allows the write, native read-before-write refuses it, planted bytes unchanged, no planted bytes returned |

Also measured on the same start:

- **glob face (M-07)**: `glob-face.json` — in-lane `PROVEN`, outside-ceiling `PROVEN` (0 processes, 1 deny fact, out-of-lane file name absent).
- **negative control**: `PROVEN` — with no Member realm the anchor leader's same out-of-lane `grep` **succeeds** and returns both secret lines (11 base spawns, 0 guard facts before the realm). Row 2 is therefore not vacuous.

## 4. The two FAILs are ONE instrument defect, not a product finding

Both failures have the same cause and it is in **my fixture layout**, not in the product:

- FS row2's target `B` is `workspace/lane/outside-restriction.txt`.
- Search row3's target is **the same file** (it is the "inside ceiling, outside restriction" operand).

Each judge collects the facts at its declared locator. Because the two rows share a locator:

- the FS row2 judge sees the **member-realm `spawn` deny** produced by the search row3 `grep`
  admission check, in addition to the binding-realm `stat` deny from its own read, and its
  "every read-path fact is on the binding lane" clause fails;
- the search row3 judge sees the **binding-realm `stat` deny** from the FS read, in addition to
  its own `spawn` deny, and its `exactlyOneDenyFact` clause fails.

Every behavioural clause on both rows is green: typed `IO_READ_DENIED`, no bytes leaked, no
provider call, 0 confined processes. The `spawn` fact is expected to be `realm=member` — BL-17
forbids a binding-realm subprocess face, so the search face necessarily rides the member realm.
The defect is **cross-row locator aliasing in the composition**, and it is exactly what a retry
with one distinct path per row fixes.

**Not retried.** A failing row is reported as a failure, not retried into a pass; the ruling in
`lane-ruling.json` authorises **one** start and the remaining four are the coordinator's to spend
(`#2`/`#3` are the BL-17/BL-18 live halves; `#4`/`#5` are retries of this class). Nothing in this
directory was edited after the run to make a row green.

## 5. What this does and does not support

**Supports (current, exact tree):**

- **`M-02` (write) → `ENFORCE-PARTIAL` / `V@B=yes`**: both write rows PASS at
  `1484fa4ee` (= snapshot `as20261105r2` baseline). Uncovered items unchanged: atomic replace /
  version check; the write-without-read *team* semantics are `BL-38`.
- **`M-07` (glob) → `ENFORCE-PARTIAL` / `V@B=yes`**: both glob arms PROVEN at `1484fa4ee`; the
  glob operands do not share a locator with any other row.

**Does not support:**

- **`M-01` (read) stays `NEEDS_REVALIDATION` / `V@B=no`**: row 2 is **REFUTED** on this run.
  Rows 1 and 3 are green on the same tree, but a row set with one REFUTED row is not a pass.
- **`M-06` (grep) stays `ENFORCE-PARTIAL` / `V@B=no`**: five of six Search rows are green at
  `1484fa4ee` (plus the unconfined negative control), but row 3 is **REFUTED**. The failure is
  the aliasing above, so it is *not* evidence that the product widened the lane — it is also not
  a pass, and is not recorded as one.

**Explicitly out of scope here** (deliberately not run): `edit` live, `Bash`/PTY live, Web live,
FS row 5 (post-invalidation), the FS composition precondition row, and any host-free re-derivation.

## 6. Provenance of the non-obvious files

| file | provenance |
|---|---|
| `lane-report.json` | the object handed to the judges, **recovered from `oracle-samples.json`** (`sample.laneReport` of FS row3) because the driver does not copy the world-home copy out before teardown. Values are the ones the run produced; nothing was recomputed. |
| `search-counter.jsonl` | the driver's persisted copy of the world-home `candidate-counter.jsonl` (the copy name is the accepted search driver's hard-coded channel name). Legs: `base-spawn 10, read-call 2, write-call 2, confined-spawn 4, confined-exit 4`. |
| `plan-lanes.json`, `plan-rows.json`, `plan-paths.json`, `plan.log` | host-free `--plan` run **at `1484fa4ee`** before the start (no ledger row, no spawn). `plan-lanes.json` asserts the six lane dispositions with the product's own `matchLocator`. |
| `run-ledger.jsonl` | the shared BL-14 ledger for this directory; its first row is the `preRegisterReadBudget` intent (`suite a5sf-read`), the second is the boot. |
| `logs/` | composed profile + instance log from the boot (kept). |

## 7. Reproduce

```bash
git checkout 1484fa4ee0ff9326a3dafcac060bf63f8d334a1f
node dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs --plan   # host-free, no ledger row
node dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs          # needs a NEW authorised start
```

The second command refuses unless `lane-ruling.json` authorises another start (`readRuling()`:
`bootSequence > ruling.starts` ⇒ `BUDGET_NOT_GRANTED`). That refusal is intentional.

**Correction relative to earlier claims:** none of the earlier evidence is withdrawn. The
accepted Search `6/6` PASS at `c658d974d` and the FS `8/8` PASS at `44babbfcf` remain true **of
their own trees**; this run neither re-confirms nor contradicts them. What is new, and now
stated: the FS row-2 judge and the Search row-3 judge are **locator-scoped**, so a composition
that reuses one path for two rows produces REFUTED verdicts without any product change.
