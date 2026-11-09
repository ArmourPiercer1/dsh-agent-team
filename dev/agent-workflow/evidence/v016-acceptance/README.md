# V016 acceptance — Gate 3 joint acceptance (DEV-LIVE)

- **Candidate under test:** `origin/integration/v0.1.6` @ `c66fa8b03` (frozen for this run).
- **Worktree / branch:** `.worktrees/v016-accept` on `task/v016-acceptance-20261109`, created off exactly `c66fa8b03`.
- **Host baseline:** `@deepseek-ai/dsh@0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (`tests/paths.mjs`).
- **Record class:** DEV-LIVE. No `V@B`, no grade, no `CANDIDATE-C2` claim. A red measurement reported as red is worth more than a green one we cannot defend.
- **Evidence commit:** `9daeebd33`; draft PR #698 (base `integration/v0.1.6`).
- **Product changes:** none. `CORE PATCH BUDGET = 0`; every scenario below runs on the frozen tree with operator config only (blueprint + profile patch + kit flags).
- **Head discipline:** every row in the table was measured on `c66fa8b03`. When the candidate moves, re-runs on the new head are appended in [Re-runs on a moved head](#re-runs-on-a-moved-head) and labelled with their head; rows above are not rewritten.

## Result table

| # | Acceptance item | Result | Decisive line |
| --- | --- | --- | --- |
| A | Alpha.5 zero-regression E2E, `run-boot.mjs --boots 2` | **PASS** (2/2 boots agreeing) | `RESULT PASS (2/2 boots; agreeing pair=true)` |
| B1 | Alpha.6 normal allow → execute | **PASS** (r1+r2 agree) | `PASS A6-27: ... executed=true ... outcome=succeeded facts=1` |
| B2 | Alpha.6 deny + post-consumption negative | **PASS** (r1+r2 agree) | `PASS A6-28: ... consumed=false execFacts=0 file=false` / `PASS A6-29: ... consumed=true execFacts=failed` |
| B3 | Alpha.6 declared Leader exception | **PASS** (r1+r2 agree) | `PASS A6-10: the PA leg of a declared Leader exception was decided by the Leader, never the Officer` |
| B4 | Alpha.6 Stop before consumption | **PASS** (r1+r2 agree) | `PASS A6-12: Stop before consumption prevents execution; a second allow is rejected as already decided — consumed=false file=""` |
| B5 | Alpha.6 crash / restart | **PASS** (r1+r2 agree) | `PASS A6-14: after a Host crash the dead invocation is settled without a deny rewrite and a late human allow cannot execute it` |
| B6 | Alpha.6 CLAIMED inbox recovery | **PASS** (r1+r2 agree) | `PASS A6-25: a wake claimed by a crashed turn is replaced by exactly one new wake; its durable request is preserved or decided` |
| B7 | Alpha.6 ACCEPTED-but-unclaimed (A6-26) | **FAIL** (r1+r2 agree; expected defect) | `FAIL A6-26: ... pendingBefore=1 pendingAfter=0 discoverable=true pendingCount=0 abandoned=1 recoveryCode=CONTROL_REQUEST_ABANDONED restart=ok verdict=abandoned-terminal` |
| C | Ordinary-install joint flow, **0.1.6 tarball**, run twice | **PASS with 2 findings** (r1+r2 agree) | `cold recovery: member=true goal=paused rounds=1->1 records=51->51 ok=true` |
| D | Required CI on the candidate | **NOT-RUN** (cannot run on this base) | `no checks reported on the 'task/v016-acceptance-20261109' branch` |

Every A6 row was run twice back-to-back on the same ports in sequence and the two runs produced the **same check set with the same verdicts**; the only row that fails is B7, and it fails identically in both runs.

## A. Alpha.5 zero-regression E2E

```
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --boots 2
```

- 19/19 cases PROVEN in both boots, agreement `agree` for every case, `RESULT PASS (2/2 boots; agreeing pair=true)`, host porcelain empty after the run.
- **A6 plane is NOT loaded:** `runs/boot01/preset-effective.json` and `runs/boot02/preset-effective.json` contain **no `alpha6*` key at all** (`alpha6` does not occur anywhere in the effective preset). The A5 E2E therefore measures the Alpha.5 path, not an accidental Alpha.6 boot.
- Raw evidence: `a5-e2e-r1/driver.log`, `a5-e2e-r1/agreement.json`, `a5-e2e-r1/runs/boot01|boot02/` (snapshot of the tracked driver output taken immediately after the run; the tracked driver evidence directory was restored to its committed state).

## B. Alpha.6 approval plane (real Host boots)

Kit: `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` with `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1` and the per-arm flag. Two consecutive runs per arm, evidence per run.

| Arm | Flags | Runs | Checks |
| --- | --- | --- | --- |
| normal allow | `C1_A6_*` default | `a6-allow-r1`, `a6-allow-r2` | A6-1,2,3,4,5,6,27 PASS |
| deny + negatives | `C1_A6_EXEC_NEG=1` (deny arm) | `a6-deny-r1`, `a6-deny-r2` | A6-1,2,3,4,5,6,7,27,28,29 PASS |
| exception / escalation | `C1_A6_EXCEPTION=1` | `a6-exception-r1`, `a6-exception-r2` | A6-1,2,3,4,5,6,10,27 PASS |
| Stop | `C1_A6_STOP=1` | `a6-stop-r1`, `a6-stop-r2` | A6-1,11,12 PASS |
| crash / restart | `C1_A6_CRASH=1` | `a6-crash-r1`, `a6-crash-r2` | A6-1,13,14 PASS |
| inbox CLAIMED | `C1_A6_INBOX=1` | `a6-inbox-r1`, `a6-inbox-r2` | A6-1,25 PASS |
| inbox ACCEPTED-unclaimed | `C1_A6_INBOX_UNCLAIMED=1` | `a6-unclaimed-r1`, `a6-unclaimed-r2` | A6-26 **FAIL** in both |

`a6-arms.log` is the master log (one line per arm, exit code, FAIL lines).

### B7 — A6-26 is red, and it is the known defect

The two runs fail identically:

```
FAIL A6-26: an ACCEPTED-but-never-CLAIMED wake after restart is claimed EXACTLY once,
or stranded with a discoverable durable request (never duplicated) —
accepted=review-wake:... pendingBefore=1 pendingAfter=0 discoverable=true pendingCount=0
abandoned=1 recoveryCode=CONTROL_REQUEST_ABANDONED restart=ok verdict=abandoned-terminal
```

The durable facts behind it (`a6-inbox-unclaimed.json`): `control-request-abandoned` with `reason:
"invocation-abandoned"`, `requestFactVisible: true`, `pendingControlCount: 0`, `wakesAfterRestart: 0`,
`deliveredAfterRestart: 0` — i.e. **no duplicate execution and no redelivery**; the request is visible in
the ledger page but is **not in the pending-control list and cannot be decided**.

**Release Notes sentence it should match** (`RELEASE-NOTES-0.1.6.md` §5):

> "the durable control request is marked `control-request-abandoned` with reason `invocation-abandoned`;
> the request is **not decidable afterwards**: `team_resolve_control` is refused with the typed
> `CONTROL_REQUEST_ABANDONED` ('can never become an allow'); the Inbox wake is not redelivered."

and the narrow promise:

> "an accepted wake may end in a durable, discoverable, side-effect-free abandonment; it is not a
> promise that every accepted wake is …"

**Discrepancy, stated plainly:** the note's word "discoverable" holds only for the **ledger page**
(`requestFactVisible: true`), not for the **pending-control surface** the kit's A6-26 checks
(`pendingControlCount: 0`, `pendingAfter: 0`). An operator who looks only at
`team_list_pending_control` sees nothing; an operator who reads the ledger page sees the abandonment.
The note's other clauses (reason `invocation-abandoned`, typed `CONTROL_REQUEST_ABANDONED`,
no redelivery, no duplicate execution, recovery = re-issue) are exactly what was measured. The note
does not say "recovery = re-issue" in the sentence quoted above; it says it two paragraphs later
("Recovery is re-issue, not resolve."). Nothing was smoothed.

## C. Ordinary-install joint flow on the 0.1.6 artifact (run twice)

Driver: `install-flow.mjs`. Per run it creates a **fresh world** and performs the ordinary install:

1. `pnpm pack` of the frozen tree → `dsh-agent-team-0.1.6.tgz`, **4,358,631 bytes**, sha256
   `e23257e8b07b6590904fa680b6a81c3a7a33f7b747f285f90018c506400a3929` (the 0.1.6 artifact, not an
   older tarball).
2. A clean directory containing **only** `@deepseek-ai/dsh@0.2.0-rc.2` (`npm install`-clean, plus the
   plugin's own dependency store).
3. Real CLI install: `dsh plugin --profile web add <tarball>` → `+ dsh-agent-team`, 7 packages, and a
   profile whose bundles are `[@deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app, dsh-agent-team]` (no
   `@deepseek-ai/dsh-tools`, so the PD-37 shape holds).
4. Profile patch = operator config: the shipped host row with the documented opt-in governed-member
   realm (`memberPresetId: a5sf-governed-member`, `a5sfGovernedRealm: true`), real model
   `qiyuan-self/deepseek-v4.1-flash-1017` via `llm-pi-ai`, and a v4 blueprint with `memberIoCeilings`.
5. Real `dsh web`, then the joint flow over the public RPCs: Team create → Member execute → approval →
   Goal → Stop → collect → SIGKILL + cold restart on the same `DSH_HOME`.

Both runs agree:

| Step | r1 (`install-r1/flow.log`) | r2 (`install-r2/flow.log`) |
| --- | --- | --- |
| `team.create` | `status=200 ok=true` | `status=200 ok=true` |
| Member created by the real Leader model | `label=w1` created, `childSessionId` set | same |
| Member bash side effect | `body="INSTALL_FLOW_r1"` | `body="INSTALL_FLOW_r2"` |
| Goal on the Member | `phase=active roundsStarted=1` | `phase=active roundsStarted=1` |
| Stop (`goals/pause` + `session/cancel`) | `pause=true cancel=200 phase=paused rounds=1 recordsDelta=0 ok=true` | same |
| Result collection | `collect: ok=true` | `collect: ok=true` |
| Cold recovery (SIGKILL + restart) | `member=true goal=paused rounds=1->1 records=51->51 ok=true` | same |

**Finding C-1 (honest red for one sub-step):** the shipped default **did not surface a human approval
prompt** for the Member's bash. In both runs the governed Member executed the command and the durable
approval never appeared (`no pending control for the member bash; side effect already present ->
approval=none-required`). The `人工审批` step is only real with the Alpha.6 approval plane, which is
**opt-in and experimental** (`RELEASE-NOTES-0.1.6.md` §2) and is measured in part B; an ordinary
install with the governed preset configured as documented executes without a prompt. This is recorded,
not worked around, and no product change was made to force a prompt.

**Finding C-2 — CORRECTED on re-read (see the appendix for the raw evidence).** The first write-up
said "post-Stop `team_collect` still returns the settled body". That was a **wrong reading of my own
driver**: the `collect: ok=true` it logged came from the **pre-Stop** collection inside the Leader's
first turn (`team_collect` at turn 1), not from a collection issued after Stop. On this head the
post-Stop prompt reached a turn that the Stop's `session/cancel` **interrupted** (run 1: turn 1
`interrupted`; run 2: turn 2 `interrupted`), so **no post-Stop collection happened at all**. Stop
therefore *does* withdraw continuation, as its name says; the durable result stays readable through
the collection already taken. I do not consider this a defect and am dropping it from the finding
list. The exact request/response and the turn records are in
`rerun-511a9142b/install-r2/team-collect-after-stop.json` and `.../root-session-turns.txt`.

Limitations: no headless browser is available in this environment (`bsk` missing), so Stop and the
approval decision were issued through the **exact RPCs the buttons issue** (`goals/get`,
`goals/pause`, `session/cancel`, `team.resolveControl`) — **no DOM click occurred**.

The scratch worlds (`tests/homes/v016-install-r1|r2`) are gitignored and deleted after the run; no
credential file is copied into any `DSH_HOME` (the driver never writes credentials; the model key is
resolved by the host from the operator store).

## D. Required CI — NOT-RUN, and why

The acceptance branch was pushed and the draft PR opened: **#698**, base `integration/v0.1.6`,
head `task/v016-acceptance-20261109` @ `9daeebd33` (evidence commit on top of `c66fa8b03`).

Measured on that PR:

```
$ gh pr checks 698
no checks reported on the 'task/v016-acceptance-20261109' branch
$ gh run list --branch task/v016-acceptance-20261109 --limit 5
(no runs)
```

Two independent reasons, both measured:

1. **The three required contexts are scoped to `master`.** `.github/workflows/ci-required.yml`,
   `.github/workflows/pr-gate.yml` and `.github/workflows/candidate-protection.yml` all declare
   `pull_request: branches: [master]` (only `pr-gate`/`candidate-protection` also have
   `push: branches: [master]`). GitHub evaluates the workflow file from the PR head, so a PR whose
   base is `integration/v0.1.6` does not start any of them. The earlier runs visible on
   `integration/v0.1.6` (`ci-required` / `pr-gate` / `candidate-protection`, 2026-11-09 18:55) are
   `pull_request` runs whose **head** was `integration/v0.1.6` and whose **base** was `master` —
   different event, different base.
2. **This base has no enforced required checks at all.** `GET branches/integration/v0.1.6/protection`
   → `404 Branch not protected`; the only ruleset in the repository (`default`, id 22936015) has
   `enforcement: "disabled"`. GitHub therefore reports no required contexts for this base.

**What that means, stated without softening:** there is **no CI signal attached to `c66fa8b03` as a
candidate**. Nothing in this row may be read as "CI passed on the candidate". The only CI that has
touched this lineage ran on PRs into `master` against different merge trees, and its most recent
result there was `ci-required: failure` / `pr-gate: failure` on `integration/v0.1.6` heads — not on
the frozen `c66fa8b03` head and not on this branch. To obtain a required-CI verdict for a candidate,
the candidate lineage has to be proposed against `master` (or the workflows' `branches:` lists and
the ruleset have to be widened); both are release-policy decisions outside this acceptance task.

The local gate entry point (`node scripts/ci-pr-gate.mjs`) was **not** run for this evidence commit:
it exercises the full product gate on the merge tree, and this lane's scope was the four acceptance
sets, not a substitute for required CI. Its absence is a gap in the evidence, not a pass.

## Teardown / hygiene

- Two Hosts maximum at a time; all ports in the 3180 family or an ephemeral pair from the reserved
  ranges; `:3080` and the stable dev instance were never addressed (`pre-stable-probe: 3080=401` in
  every run; `3180` unreachable throughout).
- Every run tears its Host down; A6 kit homes are removed unless `--keep`. Scratch worlds were
  deleted at the end (`tests/homes` is back to empty; each bash invocation runs in its own PID
  namespace, so a child Host from a *killed* job cannot be signalled from a later invocation).
- **Residue, disclosed rather than hidden:** one orphan host from a run killed at 19:10 still
  listens on `127.0.0.1:3185` (HTTP 401, the normal auth wall); its `DSH_HOME` was deleted and it
  holds no team state. It was not addressable from this session (separate PID namespace); the other
  orphan (`:3189`) was reaped through the job handle. Neither is `:3080` or the stable instance.
- The tracked `dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/` directory is byte-restored; only
  this new `v016-acceptance/` directory is added by the commit.


---

## Re-runs on a moved head — `511a9142b` (V016-FIX)

`origin/integration/v0.1.6` moved **once**, from `c66fa8b03` to `511a9142b` ("V016-FIX: gate the
relay attribution on the A6 opt-in; disclose the latch-scoped Sticky Stop", PR #697). The candidate
was therefore **not** stable during acceptance; that is why the rows below are a *subset* re-run on
the new head and the rows above are **not** rewritten. Each row carries its own head.

Worktree: `.worktrees/v016-accept2` at `511a9142b` (fresh, off the new head). Drivers copied from
this evidence directory; host baseline unchanged (`0.2.0-rc.2 @ 639ed01539`). Scratch worlds under
that worktree; teardown as before.

| Row (head `511a9142b`) | Result | Decisive line |
| --- | --- | --- |
| A5 zero-regression E2E `--boots 2` | **PASS** (2/2 agreeing) | `RESULT PASS (2/2 boots; agreeing pair=true)`; 19/19 PROVEN both boots; effective preset still contains no `alpha6` string |
| A6 normal allow → execute, r1 | **PASS** | `PASS A6-27: ... executed=true ... outcome=succeeded facts=1` |
| A6 normal allow → execute, r2 | **PASS** | `PASS A6-27: ... executed=true ... outcome=succeeded facts=1` |
| Install joint flow, 0.1.6 tarball from `511a9142b`, r1 | **PASS** (same two findings, C-1 stands) | `cold recovery: member=true goal=paused rounds=1->1 records=51->51 ok=true` |
| Install joint flow, 0.1.6 tarball from `511a9142b`, r2 | **PASS** (same two findings) | `cold recovery: member=true goal=paused rounds=1->1 records=51->51 ok=true` |

Tarball on this head: **`dsh-agent-team-0.1.6.tgz`, 4,359,449 bytes, sha256
`881065c9e195531109bea6f4398cfe6f8756f0a4f91bf4a76f2a8f80c01e296d`** (packed from `511a9142b`; the
`c66fa8b03` tarball was 4,358,631 bytes / `e23257e8…`). Both install runs on this head used the
new hash.

**Install flow, same shape as §C on the old head, and the same two observations:**

- **C-1 unchanged and not "fixed":** the shipped default still surfaced **no human approval prompt**
  for the governed member bash (`no pending control for the member bash; side effect already present
  -> approval=none-required` in both runs). Per the coordinator's ruling this is the correct boundary
  of the ordinary-install claim: the joint flow itself is proven, the *approval* step is the opt-in
  Alpha.6 plane (part B). Enabling A6 to make this row "look approved" would be the wrong measurement.
- **C-2 corrected:** no post-Stop collection occurred; the post-Stop turn was interrupted by the
  Stop. See the correction above and `rerun-511a9142b/install-r1|r2/root-session-turns.txt` —
  run 1 `turn/end {"turn":1,"reason":{"kind":"interrupted"}}`, run 2 `turn/start {"turn":2}` →
  `turn/end {"turn":2,"reason":{"kind":"interrupted"}}`.

Not re-run on `511a9142b` (unchanged code paths per the fix's disclosure, and out of the agreed
subset): deny/negatives, exception, Stop, crash/restart, claimed inbox, accepted-unclaimed. Their
`c66fa8b03` results above stand as measured; they are **not** claimed for `511a9142b`.

### Release Notes §5 on `511a9142b` — the surface distinction is still not stated (P2)

`V016-FIX` did add the id-scope box and now cites `a6-gaps-g2-unclaimed-r11/run.log` plus the
`FAIL A6-26 … verdict=abandoned-terminal` text, and it separates the `a56-semantics` PASS from the
abandonment FAIL. **But the sentence at line 189 is unchanged:**

> "an accepted wake may end in a durable, discoverable, side-effect-free abandonment; it is not a
> promise that every accepted wake is eventually delivered or decidable on this base."

"discoverable" is still unqualified: nothing in §5 says **which surface** makes it discoverable. The
measurement is `requestFactVisible: true` (ledger page) but `pendingControlCount: 0` and
`pendingAfter: 0` (`team_list_pending_control` shows nothing, and the request is not decidable).
An operator reading only §5 and then the pending-control list will conclude the request vanished.
This is a documentation defect, not a behaviour claim — the same P2 as before, still open on
`511a9142b`.
