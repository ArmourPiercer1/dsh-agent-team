# CANDIDATE-1 — the frozen trial candidate, measured at its own tree

**What this directory is.** Two live FS/Search runs of the **frozen candidate**
`1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`, which is the `baseline` of authority snapshot
`as20261105r2`:

| allocation | run | verdict | where |
|---|---|---|---|
| **#1 of 5** (owner, 2026-11-06) | `a5sf-candidate1-2026-11-05T12-17-52-246Z` | `FAIL`, 9/11 PASS | `runs/allocation1/` |
| **#4 of 5** (coordinator-authorised retry) | `a5sf-candidate1-2026-11-05T12-33-06-567Z` | **`PASS`, 11/11** | this directory |

Both runs used one Host start each (port 3184, `tests/homes/u5a5sfc1-*`), both sit on the shared
BL-14 ledger, and neither was retried after a refusal. **Spend: 2 of 5, 0 aborts.**

**Why it exists.** The matrix's `M-01`/`M-02`/`M-06`/`M-07` rows were `NEEDS_REVALIDATION` /
`ENFORCE-PARTIAL` with `V@B=no` because their live evidence came from trees that are not the
current baseline. These runs remove that excuse the honest way: freeze a candidate, publish an
authority snapshot whose `baseline` **is** that candidate head, move the pointer, and boot **at
the baseline commit itself**.

---

## 1. The freeze (unchanged by the retry)

| Step | Command (exact) | Result |
|---|---|---|
| candidate tree | `git commit` on `task/a5sf-candidate1-20261106` | **`1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`** |
| publish | `node scripts/publish-authority.mjs publish dev/.as20261105r2.draft.json --root .` | `as20261105r2`, `content_digest sha256:d28bdf46c8c7af2d8d5ede38a25333101634469ac1ee85e28756eeee69c9e4c0` |
| resolver cross-check | `node scripts/authority-baseline-resolver.mjs --snapshot dev/engineering/authority-snapshots/as20261105r2.json --expected-digest sha256:d28bdf46…` | `1484fa4ee0ff9326a3dafcac060bf63f8d334a1f` |
| pointer move | `node scripts/switch-authority.mjs switch --root . --snapshot-version as20261105r2 --expected-digest sha256:d28bdf46… --expect-pointer-digest sha256:2cba2673…` | `ok:true, switched:true, two_current_pending:false` |

Pointer bytes **before** (`authority-pointer-before.json`):

```
{"content_digest":"sha256:55ab435ff43df3674d9655bea4c00d4ea53e953c06b720ce0fbe50fd9ca8d098","snapshot_version":"as20261105r1"}
sha256 2cba2673b82f44f8979b360eb9efc2a60e8723f7e6dacbaffee1fcd3b4b15c65
```

Pointer bytes **after**:

```
{"content_digest":"sha256:d28bdf46c8c7af2d8d5ede38a25333101634469ac1ee85e28756eeee69c9e4c0","snapshot_version":"as20261105r2"}
sha256 31ac81fb4c4818b4eb09a61723b7c15a963114272bb9095b18b8e21e5fbc7f0a
```

**Rollback** (recorded, never needed): `git revert <pointer-move commit>`, then
`node scripts/switch-authority.mjs switch --root . --snapshot-version as20261105r1 --expected-digest sha256:55ab435f… --expect-pointer-digest sha256:31ac81fb…`.
Published snapshots are immutable and are never deleted.

**The direction of the freeze matters.** A snapshot cannot name a commit that contains the
snapshot, so each run executed at the candidate tree *as frozen*, one commit before the pointer
moved:

- **#1** executed **at `1484fa4ee`** (detached), i.e. exactly the commit the snapshot names. It
  therefore *observed* the previous generation `as20261105r1`, and its record was re-stamped to
  the live one afterwards while keeping the observation verbatim
  (`bindings.authorityObserved`).
- **#4** executed at `25e106b4…`, the frozen candidate **plus the fixture split** (§3). It
  observed `as20261105r2` directly, so no re-stamp was needed. Its `bindings.baseline` names
  `1484fa4ee`, and `bindings.productTreeProof` shows every product path byte-identical.

## 2. Allocation #1 — the run that found the instrument defect

Boot: port 3184, `DSH_HOME tests/homes/u5a5sfc1-20261105T12-17-52Z`, grant
`grant-a5sf-candidate1-1484fa4ee0ff-b1`, ledger `1 intent + 1 boot`, `plannedStarts 1`, 0 aborts.
Verdict `overall=FAIL`, `partial=false`, 11 cases → **9 PASS / 2 FAIL**.

| # | case | verdict | numbers |
|---|---|---|---|
| 1 | search row1 grep in lane | PASS | 1 confined spawn, 0 base, 1 allow fact, exit 0 |
| 2 | search row2 outside ceiling | PASS | 0/0 processes, 1 deny fact, no leaked bytes |
| 3 | search row3 outside restriction | **FAIL** `ROW3_CLAUSE_FAILED` | `exactlyOneDenyFact` saw **2** deny facts; 0/0 spawns, no leak |
| 4 | search row4 cancel | PASS | child 143, no result |
| 5 | search row5 invalid pattern | PASS | tool error, not a no-match |
| 6 | search row6 archive boundary | PASS | post-stop 422, 0 facts, 0 spawns, home deleted, port released |
| 7 | FS row1 read A | PASS | 2 binding allow facts, 1 confined provider read |
| 8 | FS row2 read B | **FAIL** `ROW2_CLAUSE_FAILED` | `everyReadPathFactOnBindingLane` false: 2 read-path facts (`stat` binding deny + `spawn` member deny), both deny; every other clause green |
| 9 | FS row3 read C | PASS | exactly 1 binding deny, ceiling deny / restriction allow / effective deny |
| 10 | FS row4a write in-lane | PASS | disk matches, write ALLOW on the ceiling realm, 1 confined write |
| 11 | FS row4b write B | PASS | guard allows, native read-before-write refuses, disk unchanged |

Plus negative control **PROVEN** (with no Member realm the same out-of-lane `grep` returns both
secret lines: 11 base spawns, 0 guard facts) and both glob arms **PROVEN**.

**Diagnosis (the reason #4 exists).** Row 8's target and row 3's operand were the *same* path,
`workspace/lane/outside-restriction.txt`, and both judges collect guard facts **by locator**. Each
therefore saw the other lane's deny fact — the FS judge a member-realm `spawn` deny from the search
admission, the search judge a binding-realm `stat` deny from the read. Every behavioural clause on
both rows was green (typed `IO_READ_DENIED`, 0 confined processes, no bytes leaked, no provider
call). **Instrument aliasing, not product widening** — and not retried into a pass.

## 3. Allocation #4 — the authorised retry

**Authorisation:** second entry of `lane-ruling.json` (`starts: 1`, `authorisedStarts: 2`),
coordinator `session-76eeddd5…`, 2026-11-05. Same snapshot, **no pointer move, no new snapshot**.

### The fixture split (the only change)

| file | change |
|---|---|
| `run-boot.mjs` `rowPathsOf` | FS read B moves to **its own path** `workspace/lane/fs/outside-restriction.txt` (new `readBDir`, planted with the same claim). Search row 3 keeps `restrictedFile` = `workspace/lane/outside-restriction.txt`, untouched. |
| `run-boot.mjs` `laneProbePaths` | `readB` added, so the provider-row lane report records its dispositions too. |
| `run-boot.mjs` boot phase | follows the ledger sequence (`a5sf-candidate1-boot<N>`), so #1 and #4 are distinguishable rows. |
| `lane-ruling.json` | the #4 ruling entry. |
| run #1 outputs | moved byte-identically to `runs/allocation1/` (`git mv`). |

**Nothing else.** Proof, from `git rev-parse <commit>:<path>` (all `equal: true`; also recorded in
`run-record.json` → `bindings.productTreeProof`):

| path | kind | frozen `1484fa4ee` | executed `25e106b4` |
|---|---|---|---|
| `packages` | tree | `44535c94dbb871a8ab132911507fa29936363689` | same |
| `scripts` | tree | `d4bcc3580eca5eb6d5f23a2787b28be74c59dbad` | same |
| `tests/paths.mjs` | blob | `1bf4829eb8709a0121c80f9e91cb00855e0db7eb` | same |
| `package.json` | blob | `2946fe23bb540ccfa7d9cc31a2d0082ec2bd6191` | same |
| `pnpm-lock.yaml` | blob | `f70001d314807dfeb789401efdf6e7a46fdbbb8f` | same |
| `tests/world-factory/lib/a5sf-acceptance-preflight.mjs` | blob | `de66ee86e0c8d8cbd8935857645592384b1c9ab4` | same |
| `tests/world-factory/lib/a5sf-search-live.mjs` | blob | `e386ab796116c39525063da2fc31a712a02a12b4` | same |

The **judges are byte-identical**, so "it passed because a judge got looser" is excluded by
construction: no clause changed, only the locator the FS row declares.

### The boot

| | |
|---|---|
| start | **1** (allocation #4); 0 aborts, 0 retries |
| ledger | `run-ledger.jsonl`, 4 rows total: `intent(b1)`, `boot1`, `intent(b2)`, **`boot2`** — `plannedStarts 1` for this run, `bootRows 1 === 1 - 0` |
| grant | `grant.json` — `grantId grant-a5sf-candidate1-25e106b4573c-b2`, `maxStarts 4` (= 2 prior rows + intent + boot), `boundCommit 25e106b4…` |
| port / home | **3184** / `tests/homes/u5a5sfc1-20261105T12-33-06Z` (deleted at teardown, port released, no orphans) |
| composed rows | all six present, none missing |
| run record | `runId a5sf-candidate1-2026-11-05T12-33-06-567Z`, `suite a5sf-candidate1`, `teamSha 25e106b4…`, `hostSha 639ed015397290b3745d163aafe02ffee4aa3f84` |
| verdict | **`overall=PASS`, `partial=false`, 11/11** |

### The 11 rows

| # | case | verdict | reason / numbers |
|---|---|---|---|
| 1 | search row1 | PASS | `IN_LANE_GREP_ALLOWED_AND_CONFINED` — 1 confined spawn, 0 base, 1 allow fact (member realm, `spawn`), exit 0 |
| 2 | search row2 | PASS | `OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS` — 0/0 processes, 1 deny fact, no leak |
| 3 | search row3 | **PASS** | `RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION` — exactly 1 deny fact (member/`spawn`/`IO_READ_DENIED`), 0 confined + 0 base spawns, no leaked tokens |
| 4 | search row4 | PASS | `CANCELLED_SEARCH_ABORTED_WITH_KILLED_CHILD_NO_RESULT` |
| 5 | search row5 | PASS | `INVALID_PATTERN_SURFACED_AS_TOOL_ERROR` |
| 6 | search row6 | PASS | `NO_USABLE_CALLABLE_SHADOW_AFTER_STOP` — all clauses true (422 dispatch, 0 facts, host dead, port released, home deleted) |
| 7 | FS row1 | PASS | `READ_A_ALLOWED_AND_CONFINED` — 2 binding allow facts, 1 confined provider read |
| 8 | FS row2 | **PASS** | `BINDING_DENY_ON_READ_PATH` — `readPathFacts 1` (method `stat`, decision `deny`, **all** on the binding lane), `noProviderRead`, `counterRows 0`; refusal text "outside every allow subtree of the lane" |
| 9 | FS row3 | PASS | `REFUSED_WITHOUT_WIDENING` — ceiling deny / restriction allow / effective deny, exactly 1 binding deny |
| 10 | FS row4a | PASS | `CEILING_WRITE_IN_LANE_READABLE` — disk matches, write ALLOW on the ceiling realm, 1 confined write |
| 11 | FS row4b | PASS | `CEILING_WRITE_ALLOWED_READ_NOT_IMPLIED` — guard allows, native read-before-write refuses, planted bytes unchanged |

Same boot: negative control **PROVEN** (`UNCONFINED_CONTROL_LEAKS`: 11 base spawns, 0 guard facts,
both secret lines returned), glob in-lane **PROVEN**, glob outside-ceiling **PROVEN**.
Counter legs: `base-spawn 10, read-call 2, write-call 2, confined-spawn 4, confined-exit 4`.

## 4. What this supports now

- **`M-01` (read) → `ENFORCE-PARTIAL` / `V@B=yes`**: rows 1/2/3 PASS on the frozen candidate
  (product tree identical to `1484fa4ee`). Uncovered: row 5 (post-invalidation), `edit` live,
  Bash/PTY live, Web live.
- **`M-02` (write) → `ENFORCE-PARTIAL` / `V@B=yes`**: row4a/row4b PASS at `1484fa4ee` itself.
  Uncovered: atomic replace / version check; write-without-read team semantics = `BL-38`.
- **`M-06` (grep) → `ENFORCE-PARTIAL` / `V@B=yes`**: 6/6 at `25e106b4…` (product = `1484fa4ee`)
  plus the unconfined negative control.
- **`M-07` (glob) → `ENFORCE-PARTIAL` / `V@B=yes`**: both arms PROVEN at `1484fa4ee` itself.

**The one deliberate deviation from the instruction as worded.** The retry's run record does not
put `1484fa4ee` in `bindings.teamSha`; it puts it in `bindings.baseline`. `teamSha` names the
tree that *executed* (`25e106b4…` = frozen candidate + evidence-only fixture split), because a
run at `1484fa4ee` would have re-created the very aliasing it was authorised to fix. Writing
`teamSha = 1484fa4ee` while executing elsewhere would have been false; the product-tree proof
above is what makes `V@B=yes` legitimate, and any reviewer can check it with `git rev-parse`.

## 5. Provenance of the non-obvious files

| file | provenance |
|---|---|
| `allocation-map.json` | the driver writes `allocationItem` from a constant that names allocation #1. This run is **#4**: `grantId …-b2`, `bootSequence 2`, ledger phase `a5sf-candidate1-boot2`, and `grant.json` → `grantedBy` carries the #4 ruling verbatim. The constant is **not** edited in place; the mapping is recorded here. Fixing the constant belongs to a future run, so the committed driver stays identical to the executed one. |
| `search-counter.jsonl` | the driver's persisted copy of the world-home `candidate-counter.jsonl` (the copy name is the accepted search driver's hard-coded channel name). |
| `runs/allocation1/lane-report.json` | the object handed to the judges, **recovered from `runs/allocation1/oracle-samples.json`** (`sample.laneReport` of FS row3) because the driver does not copy the world-home report out before teardown. Values are the ones the run produced. |
| `plan-*.json`, `plan.log` | host-free `--plan` at `25e106b4…` before the start (no ledger row, no spawn); `plan-lanes.json` asserts the six lane dispositions with the product's own `matchLocator`. |
| `run-ledger.jsonl` | the shared BL-14 ledger: 2 intent rows + 2 boot rows; `bootRows === plannedStarts - aborts` holds **per run** (1 = 1 − 0 twice). |
| `runs/2026-11-05T12-17-52-245Z/`, `runs/2026-11-05T12-33-06-566Z/` | the boot console each shell opened *before* its run started; archive-before-start moved it there (kept as-is, one directory per run). |

## 6. Reproduce

```bash
git checkout 1484fa4ee0ff9326a3dafcac060bf63f8d334a1f   # allocation #1, aliased fixture
node dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs --plan
git checkout 25e106b4573cac0ab624c7e0bc5ca7d36dba3730   # allocation #4, split fixture
node dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs --plan
node dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs   # needs a NEW authorised start
```

The last command refuses unless `lane-ruling.json` authorises another start (`readRuling()`:
`bootSequence > ruling.starts` ⇒ `BUDGET_NOT_GRANTED`).

## 7. Corrections

- **2026-11-05 (after allocation #4):** allocation #1's two REFUTED rows are **withdrawn as
  verdicts about the product** and recorded as what they were — cross-row locator aliasing in the
  composed fixture. The rows PASS unchanged after the split, with byte-identical judges.
- No earlier evidence is withdrawn: Search `6/6` at `c658d974d` and FS `8/8` at `44babbfcf`
  remain true **of their own trees**.
